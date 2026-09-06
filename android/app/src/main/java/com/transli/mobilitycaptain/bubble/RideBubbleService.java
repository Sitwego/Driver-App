package com.transli.mobilitycaptain.bubble;

import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.graphics.PixelFormat;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.IBinder;
import android.provider.Settings;
import android.util.DisplayMetrics;
import android.util.Log;
import android.view.Gravity;
import android.view.LayoutInflater;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewConfiguration;
import android.view.WindowManager;

import androidx.annotation.Nullable;
import androidx.core.content.ContextCompat;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;

import com.transli.mobilitycaptain.AppConfig;
import com.transli.mobilitycaptain.MainActivity;
import com.transli.mobilitycaptain.OverlayPopUp;
import com.transli.mobilitycaptain.R;

/**
 * The floating ride assistant — a small bubble drawn over other apps while the
 * driver is online.
 *
 * <p><b>Lifetime is not its own.</b> This service is started and stopped by
 * {@link com.transli.mobilitycaptain.GeoKalman}, the location foreground service,
 * which is already the definition of "the driver is online": it is set up by the
 * on-duty toggle, torn down by going offline and by logout, and restored after a
 * reboot by BootReceiver. Binding to it means there is no second foreground
 * service, no second notion of availability, and no path where the bubble
 * outlives the shift. {@code START_NOT_STICKY} is deliberate — the bubble must
 * never resurrect on its own after a process death, only because GeoKalman put
 * it back.
 *
 * <p>The bubble displays and it routes. It cannot accept, decline or cancel
 * anything; those decisions stay in the app.
 */
public class RideBubbleService extends Service {

    private static final String TAG = "RideBubbleService";

    /** Bounded, per the brief: an attention cue, not a permanent animation. */
    private static final int PULSE_COUNT = 3;
    private static final long PULSE_DURATION_MS = 320;
    private static final long SNAP_DURATION_MS = 180;

    /**
     * Whether the gRPC offer stream is connected, reported by
     * {@link com.transli.mobilitycaptain.GrpcNotificationService}.
     *
     * <p>Starts false on purpose. Offers arrive over that stream, so until it says
     * otherwise we cannot honestly claim the driver is reachable — and a bubble
     * that keeps showing green while the backend has stopped hearing from us is
     * the exact failure this flag exists to prevent.
     */
    private static volatile boolean channelReady = false;

    /**
     * Whether the full-width offer card is currently on screen.
     *
     * <p>Reported explicitly by {@link OverlayPopUp} rather than probed with
     * ActivityManager: the system server updates its running-services list on its
     * own schedule, so a probe can race the card and briefly leave two overlay
     * windows stacked on top of each other.
     */
    private static volatile boolean offerCardVisible = false;

    /**
     * Whether a bubble is currently attached.
     *
     * <p>Tracked here rather than asked of ActivityManager: the running-services
     * query is a binder round trip on a path that fires on every offer and every
     * connectivity flip, and its answer lags the actual lifecycle. This flag is
     * set by the service itself, so it cannot disagree with reality. Statics reset
     * with the process, which is correct — a dead process has no bubble either.
     */
    private static volatile boolean attached = false;

    private WindowManager windowManager;
    private View bubbleView;
    private WindowManager.LayoutParams layoutParams;
    private BubbleState appliedState;

    // --- static control surface ---------------------------------------------

    /**
     * Show the bubble, if it is allowed to exist at all.
     *
     * <p>Two gates, both fail-closed: the remote kill switch, and the overlay
     * permission. A driver who never grants "appear on top" must be able to work
     * all day without noticing anything is missing, so a refusal here is silent.
     */
    public static void start(Context context) {
        if (!isPermitted(context)) return;
        try {
            context.startService(new Intent(context, RideBubbleService.class));
        } catch (Exception e) {
            // Never let the bubble take down whatever started it.
            Log.e(TAG, "Failed to start bubble", e);
        }
    }

    public static void stop(Context context) {
        try {
            context.stopService(new Intent(context, RideBubbleService.class));
        } catch (Exception e) {
            Log.e(TAG, "Failed to stop bubble", e);
        }
    }

    /**
     * Re-read state and repaint.
     *
     * <p>Every refresh is triggered by something that already happened — an offer
     * arriving, a ride event, a connectivity change, a JS state transition. There
     * is no polling and no timer: the bubble must not add a single wakeup.
     *
     * <p>Deliberately a no-op when the bubble is not already running, so a stray
     * poke can never bring one back after teardown.
     */
    public static void refresh(Context context) {
        if (!attached) return;
        start(context);
    }

    /** Reported by {@link OverlayPopUp} as its window comes and goes. */
    public static void setOfferCardVisible(Context context, boolean visible) {
        if (offerCardVisible == visible) return;
        offerCardVisible = visible;
        refresh(context);
    }

    /** Reported by the gRPC service from its existing channel-state watcher. */
    public static void setChannelReady(Context context, boolean ready) {
        if (channelReady == ready) return;
        channelReady = ready;
        Log.d(TAG, "Channel ready = " + ready);
        refresh(context);
    }

    private static boolean isPermitted(Context context) {
        if (!AppConfig.isFloatingAssistantEnabled()) return false;
        // Re-checked on every start, not cached: the driver can revoke this from
        // system settings at any moment, and addView would then throw.
        return Settings.canDrawOverlays(context);
    }

    // --- lifecycle ----------------------------------------------------------

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onCreate() {
        super.onCreate();
        attachToWindowManager();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        applyState();
        return START_NOT_STICKY;
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        detachFromWindowManager();
    }

    // --- window -------------------------------------------------------------

    private void attachToWindowManager() {
        if (!Settings.canDrawOverlays(this)) {
            Log.w(TAG, "Overlay permission not held — bubble will not attach");
            stopSelf();
            return;
        }
        try {
            windowManager = (WindowManager) getSystemService(WINDOW_SERVICE);
            bubbleView = LayoutInflater.from(this).inflate(R.layout.ride_bubble_layout, null);

            layoutParams = new WindowManager.LayoutParams(
                    WindowManager.LayoutParams.WRAP_CONTENT,
                    WindowManager.LayoutParams.WRAP_CONTENT,
                    // minSdk is 27, so TYPE_APPLICATION_OVERLAY always applies —
                    // no TYPE_PHONE fallback is reachable here.
                    WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
                    WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
                    PixelFormat.TRANSLUCENT
            );
            layoutParams.gravity = Gravity.TOP | Gravity.START;

            int savedX = BubbleStateStore.savedX(this);
            int savedY = BubbleStateStore.savedY(this);
            if (savedX >= 0 && savedY >= 0) {
                layoutParams.x = savedX;
                layoutParams.y = savedY;
            } else {
                // First run: right edge, upper third — clear of the status bar and
                // of whatever the driver is likely reading at the bottom.
                layoutParams.x = Math.max(0, screenWidth() - dp(74));
                layoutParams.y = screenHeight() / 3;
            }

            bubbleView.setOnTouchListener(new DragTouchListener());
            windowManager.addView(bubbleView, layoutParams);
            attached = true;
        } catch (Exception e) {
            // Permission revoked between the check above and addView, or an OEM
            // window-manager quirk. Either way the app continues without a bubble.
            Log.e(TAG, "Failed to attach bubble", e);
            bubbleView = null;
            stopSelf();
        }
    }

    private void detachFromWindowManager() {
        attached = false;
        if (windowManager != null && bubbleView != null) {
            try {
                windowManager.removeView(bubbleView);
            } catch (Exception e) {
                Log.w(TAG, "Bubble view already detached", e);
            }
        }
        windowManager = null;
        bubbleView = null;
        layoutParams = null;
        appliedState = null;
    }

    // --- state --------------------------------------------------------------

    private void applyState() {
        if (bubbleView == null) return;

        // The full-width offer card is the decision surface. While it is up the
        // bubble would only compete with it, so it stands down and returns when
        // the card goes away.
        if (offerCardVisible) {
            bubbleView.setVisibility(View.GONE);
            return;
        }
        bubbleView.setVisibility(View.VISIBLE);

        BubbleState state = BubbleStateStore.currentState(this, channelReady);
        if (state == appliedState) return;

        View ring = bubbleView.findViewById(R.id.bubbleRing);
        if (ring != null && ring.getBackground() instanceof GradientDrawable) {
            GradientDrawable shape = (GradientDrawable) ring.getBackground().mutate();
            shape.setStroke(dp(3), ContextCompat.getColor(this, colorFor(state)));
        }

        if (state == BubbleState.REQUESTED) {
            pulse();
        }

        appliedState = state;
        Log.d(TAG, "State -> " + state);
    }

    private static int colorFor(BubbleState state) {
        switch (state) {
            case AVAILABLE:    return R.color.bubble_state_available;
            case REQUESTED:    return R.color.bubble_state_attention;
            case ARRIVING:     return R.color.bubble_state_arriving;
            case ACCEPTED:
            case TRIP_STARTED: return R.color.bubble_state_trip;
            case UNKNOWN:
            default:           return R.color.bubble_state_unknown;
        }
    }

    /** A short, finite attention cue. Never a loop. */
    private void pulse() {
        if (bubbleView == null) return;
        bubbleView.animate().cancel();
        bubbleView.setScaleX(1f);
        bubbleView.setScaleY(1f);
        pulseStep(0);
    }

    private void pulseStep(int index) {
        if (bubbleView == null || index >= PULSE_COUNT) return;
        bubbleView.animate()
                .scaleX(1.18f).scaleY(1.18f)
                .setDuration(PULSE_DURATION_MS / 2)
                .withEndAction(() -> {
                    if (bubbleView == null) return;
                    bubbleView.animate()
                            .scaleX(1f).scaleY(1f)
                            .setDuration(PULSE_DURATION_MS / 2)
                            .withEndAction(() -> pulseStep(index + 1))
                            .start();
                })
                .start();
    }

    // --- interaction --------------------------------------------------------

    /**
     * Drag with edge-snap, or a tap.
     *
     * <p>The two are told apart by the system touch slop rather than a timeout, so
     * a driver who taps with a slightly moving thumb still gets a tap.
     */
    private final class DragTouchListener implements View.OnTouchListener {
        private int startX, startY;
        private float touchX, touchY;
        private boolean dragged;
        private final int slop = ViewConfiguration.get(RideBubbleService.this).getScaledTouchSlop();

        @Override
        public boolean onTouch(View v, MotionEvent event) {
            if (layoutParams == null || windowManager == null) return false;
            switch (event.getAction()) {
                case MotionEvent.ACTION_DOWN:
                    startX = layoutParams.x;
                    startY = layoutParams.y;
                    touchX = event.getRawX();
                    touchY = event.getRawY();
                    dragged = false;
                    return true;

                case MotionEvent.ACTION_MOVE: {
                    int dx = (int) (event.getRawX() - touchX);
                    int dy = (int) (event.getRawY() - touchY);
                    if (!dragged && Math.hypot(dx, dy) < slop) return true;
                    dragged = true;
                    layoutParams.x = startX + dx;
                    layoutParams.y = clampY(startY + dy);
                    safeUpdateView();
                    return true;
                }

                case MotionEvent.ACTION_UP:
                case MotionEvent.ACTION_CANCEL:
                    if (dragged) {
                        snapToEdge();
                    } else {
                        onBubbleTapped();
                    }
                    return true;

                default:
                    return false;
            }
        }
    }

    /**
     * Keep the bubble clear of the status bar and, more importantly, the system
     * navigation bar — parking on top of Back/Home would make the phone feel
     * broken.
     */
    private int clampY(int y) {
        int top = 0;
        int bottom = screenHeight();
        if (bubbleView != null) {
            WindowInsetsCompat insets = ViewCompat.getRootWindowInsets(bubbleView);
            if (insets != null) {
                Insets bars = insets.getInsets(WindowInsetsCompat.Type.systemBars());
                top = bars.top;
                bottom = screenHeight() - bars.bottom;
            }
        }
        int height = bubbleView == null || bubbleView.getHeight() == 0
                ? dp(68) : bubbleView.getHeight();
        return Math.max(top, Math.min(y, bottom - height));
    }

    private void snapToEdge() {
        if (bubbleView == null || layoutParams == null) return;
        int width = bubbleView.getWidth() == 0 ? dp(68) : bubbleView.getWidth();
        int rightEdge = screenWidth() - width;
        int target = (layoutParams.x + width / 2) < screenWidth() / 2 ? 0 : rightEdge;

        final int from = layoutParams.x;
        final int distance = target - from;
        final long started = System.currentTimeMillis();
        bubbleView.post(new Runnable() {
            @Override
            public void run() {
                if (bubbleView == null || layoutParams == null) return;
                float t = Math.min(1f, (System.currentTimeMillis() - started) / (float) SNAP_DURATION_MS);
                // Ease-out so it settles rather than stopping dead.
                layoutParams.x = from + (int) (distance * (1 - (1 - t) * (1 - t)));
                safeUpdateView();
                if (t < 1f) {
                    bubbleView.postOnAnimation(this);
                } else {
                    BubbleStateStore.savePosition(
                            RideBubbleService.this, layoutParams.x, layoutParams.y);
                }
            }
        });
    }

    private void safeUpdateView() {
        try {
            windowManager.updateViewLayout(bubbleView, layoutParams);
        } catch (Exception e) {
            Log.w(TAG, "Failed to move bubble", e);
        }
    }

    /**
     * Open the app on the screen that matches what the bubble is showing.
     *
     * <p>The target is handed over through {@link BubbleStateStore} rather than an
     * intent extra because the decision has to survive a cold start: the activity
     * may not exist yet, and JS reads the slot once it is up. Routing itself is
     * left to JS, which already owns the navigation ref.
     */
    private void onBubbleTapped() {
        BubbleState state = appliedState == null ? BubbleState.UNKNOWN : appliedState;
        BubbleStateStore.writeLaunchTarget(this, state);
        try {
            Intent intent = getPackageManager().getLaunchIntentForPackage(getPackageName());
            if (intent == null) intent = new Intent(this, MainActivity.class);
            // MainActivity is singleTask, so this reuses the existing instance
            // rather than stacking a second one.
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);
            startActivity(intent);
        } catch (Exception e) {
            Log.e(TAG, "Failed to open app from bubble", e);
        }
    }

    // --- metrics ------------------------------------------------------------

    private int screenWidth() {
        return bounds()[0];
    }

    private int screenHeight() {
        return bounds()[1];
    }

    private int[] bounds() {
        WindowManager wm = windowManager != null
                ? windowManager
                : (WindowManager) getSystemService(WINDOW_SERVICE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            android.graphics.Rect r = wm.getCurrentWindowMetrics().getBounds();
            return new int[]{r.width(), r.height()};
        }
        DisplayMetrics dm = new DisplayMetrics();
        wm.getDefaultDisplay().getRealMetrics(dm);
        return new int[]{dm.widthPixels, dm.heightPixels};
    }

    private int dp(int value) {
        return (int) (value * getResources().getDisplayMetrics().density);
    }
}
