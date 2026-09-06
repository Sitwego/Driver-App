package com.transli.mobilitycaptain.bubble;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Log;

import androidx.annotation.Nullable;

import com.tencent.mmkv.MMKV;
import com.transli.mobilitycaptain.PendingRideRequestStore;
import com.transli.mobilitycaptain.R;

/**
 * Everything the floating ride assistant reads or persists.
 *
 * <p><b>Ride state is read, never written.</b> The values come out of the same
 * MMKV store the JS layer writes ({@code ACTIVE_RIDE_DATA} — see
 * {@code rideStore} in src/lib/store/index.ts). This is the pattern already used
 * in the other direction: GeoKalman writes {@code CURRENT_LOCATION} and
 * {@code VEHICLE_CATEGORY_DATA}, which JS reads through the same ids. Sharing the
 * store is what keeps this a projection rather than a second source of truth.
 *
 * <p>The two things this store <em>does</em> own are the bubble's own concerns:
 * where the driver dragged it, and which screen a tap should land on.
 */
public final class BubbleStateStore {

    private static final String TAG = "BubbleStateStore";

    /** Must match `rideStore` in src/lib/store/index.ts. */
    private static final String RIDE_MMKV_ID = "ACTIVE_RIDE_DATA";
    private static final String KEY_RIDE = "ride";
    private static final String KEY_RIDE_STATUS = "rideStatus";

    private static final String KEY_LAUNCH_TARGET = "BUBBLE_LAUNCH_TARGET";
    private static final String KEY_POSITION_X = "BUBBLE_POSITION_X";
    private static final String KEY_POSITION_Y = "BUBBLE_POSITION_Y";

    private BubbleStateStore() {}

    private static SharedPreferences prefs(Context context) {
        return context.getApplicationContext().getSharedPreferences(
                context.getString(R.string.sit_we_go_shared_preferences),
                Context.MODE_PRIVATE
        );
    }

    // --- ride state (read-only projection) ----------------------------------

    /**
     * Resolve the current bubble state from shared storage.
     *
     * <p>Any failure reading MMKV resolves to UNKNOWN rather than throwing: this
     * runs on the main thread from a service that must never take the app down.
     */
    public static BubbleState currentState(Context context, boolean channelReady) {
        try {
            MMKV kv = MMKV.mmkvWithID(RIDE_MMKV_ID, MMKV.SINGLE_PROCESS_MODE);
            return BubbleState.resolve(
                    channelReady,
                    PendingRideRequestStore.hasLiveOffer(context),
                    kv == null ? null : kv.decodeString(KEY_RIDE),
                    kv == null ? null : kv.decodeString(KEY_RIDE_STATUS)
            );
        } catch (Exception e) {
            Log.e(TAG, "Failed to read ride state — degrading to UNKNOWN", e);
            return BubbleState.UNKNOWN;
        }
    }

    // --- launch target ------------------------------------------------------

    /**
     * Record which screen a bubble tap should land on.
     *
     * <p>A resume can also come from the launcher or a notification, so the tap
     * cannot simply route on every foreground. JS drains this slot on resume and
     * routes only when something is in it — the same single-slot handoff
     * {@link PendingRideRequestStore} uses for offers.
     */
    public static void writeLaunchTarget(Context context, BubbleState state) {
        prefs(context).edit().putString(KEY_LAUNCH_TARGET, state.name()).apply();
        Log.d(TAG, "Launch target set to " + state.name());
    }

    /** Read and clear in one step. Null when the app was not opened from the bubble. */
    @Nullable
    public static String consumeLaunchTarget(Context context) {
        SharedPreferences p = prefs(context);
        String target = p.getString(KEY_LAUNCH_TARGET, null);
        if (target != null) {
            p.edit().remove(KEY_LAUNCH_TARGET).apply();
        }
        return target;
    }

    // --- position -----------------------------------------------------------

    /** Persisted x, or -1 when the driver has never moved the bubble. */
    public static int savedX(Context context) {
        return prefs(context).getInt(KEY_POSITION_X, -1);
    }

    /** Persisted y, or -1 when the driver has never moved the bubble. */
    public static int savedY(Context context) {
        return prefs(context).getInt(KEY_POSITION_Y, -1);
    }

    public static void savePosition(Context context, int x, int y) {
        prefs(context).edit()
                .putInt(KEY_POSITION_X, x)
                .putInt(KEY_POSITION_Y, y)
                .apply();
    }
}
