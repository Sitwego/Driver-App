package com.transli.mobilitycaptain;

import android.app.ActivityManager;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.PixelFormat;
import android.graphics.Typeface;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.provider.Settings;
import android.util.DisplayMetrics;
import android.util.Log;
import android.view.Gravity;
import android.view.LayoutInflater;
import android.view.View;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.ImageButton;
import android.widget.TextView;

import androidx.annotation.Nullable;
import androidx.interpolator.view.animation.FastOutLinearInInterpolator;

public class OverlayPopUp extends Service {

    private static final String TAG = "OverlayPopUp";
    private static final int RAM_THRESHOLD_GB = 7;
    private static final long BASE_DELAY_MS = 1000;
    private static final long DELAY_PER_GB_MS = 500;

    // Intent extra keys — used by NotificationController to inject ride data
    public static final String EXTRA_CATEGORY        = "extra_category";
    public static final String EXTRA_IS_EXCLUSIVE    = "extra_is_exclusive";
    public static final String EXTRA_FARE            = "extra_fare";
    public static final String EXTRA_RATING          = "extra_rating"; // optional — hide view when absent
    public static final String EXTRA_PICKUP_DISTANCE = "extra_pickup_distance";
    public static final String EXTRA_DROPOFF_DISTANCE= "extra_dropoff_distance";
    public static final String EXTRA_DROPOFF_LOCATION= "extra_dropoff_location";

    private int layoutFlag;
    private WindowManager windowManager;
    private View popUpView;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        showPopUpRideRequest(intent);
        return START_STICKY;
    }

    @Override
    public void onCreate() {
        super.onCreate();
        registerOverlayPopUpToWindowManager();
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        mainHandler.removeCallbacksAndMessages(null);
        if (windowManager != null && popUpView != null) {
            windowManager.removeView(popUpView);
            windowManager = null;
            popUpView = null;
        }
    }

    private void registerOverlayPopUpToWindowManager() {
        if (!Settings.canDrawOverlays(this)) return;

        float density = getResources().getDisplayMetrics().density;
        layoutFlag = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
                : WindowManager.LayoutParams.TYPE_PHONE;

        windowManager = (WindowManager) getSystemService(WINDOW_SERVICE);
        popUpView = LayoutInflater.from(this).inflate(R.layout.popup_overly_layout, null);

        int popupWidth;
        int screenHeight;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            android.graphics.Rect bounds = windowManager.getCurrentWindowMetrics().getBounds();
            popupWidth = bounds.width();
            screenHeight = bounds.height();
        } else {
            DisplayMetrics dsm = new DisplayMetrics();
            windowManager.getDefaultDisplay().getRealMetrics(dsm);
            popupWidth = dsm.widthPixels;
            screenHeight = dsm.heightPixels;
        }

        int horizontalMargin = (int) (16 * density);
        WindowManager.LayoutParams layoutParams = new WindowManager.LayoutParams(
                popupWidth - (horizontalMargin * 2),
                WindowManager.LayoutParams.WRAP_CONTENT,
                layoutFlag,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
                PixelFormat.TRANSLUCENT
        );
        layoutParams.gravity = Gravity.BOTTOM | Gravity.CENTER;
        layoutParams.x = 0;
        layoutParams.y = screenHeight / 4;

        windowManager.addView(popUpView, layoutParams);
    }

    private void showPopUpRideRequest(Intent intent) {
        if (popUpView == null) return;
        withAnimation(popUpView);

        try {
            TextView categoryTypeText   = popUpView.findViewById(R.id.categoryTypeText);
            TextView exclusiveTagText   = popUpView.findViewById(R.id.exclusiveTagText);
            TextView rideFareTextView   = popUpView.findViewById(R.id.priceText);
            TextView riderRating        = popUpView.findViewById(R.id.ratingText);
            TextView netFeeText         = popUpView.findViewById(R.id.netFeeText);
            TextView dxToPickup         = popUpView.findViewById(R.id.pickupDistanceText);
            TextView pickupLocation     = popUpView.findViewById(R.id.pickupLocationText);
            TextView rideDistanceTextView = popUpView.findViewById(R.id.dropoffDistanceText);
            TextView dropOffLocationText  = popUpView.findViewById(R.id.dropoffLocationText);

            // Typefaces
            Typeface firaBold     = Typeface.createFromAsset(getAssets(), "fonts/FiraCode-Bold.ttf");
            Typeface firaSemiBold = Typeface.createFromAsset(getAssets(), "fonts/FiraCode-SemiBold.ttf");
            Typeface firaMedium   = Typeface.createFromAsset(getAssets(), "fonts/FiraCode-Medium.ttf");
            Typeface firaRegular  = Typeface.createFromAsset(getAssets(), "fonts/FiraCode-Regular.ttf");
            Typeface firaLight    = Typeface.createFromAsset(getAssets(), "fonts/FiraCode-Light.ttf");

            // Numbers / fare — Bold
            rideFareTextView.setTypeface(firaBold);
            // Rating (★ + number) — Medium
            riderRating.setTypeface(firaMedium);
            // Distance labels with numbers — Regular
            dxToPickup.setTypeface(firaRegular);
            rideDistanceTextView.setTypeface(firaRegular);
            // Category name — SemiBold
            categoryTypeText.setTypeface(firaSemiBold);
            // Badge — Bold
            exclusiveTagText.setTypeface(firaBold);
            // Location names and caption — Light
            pickupLocation.setTypeface(firaLight);
            dropOffLocationText.setTypeface(firaLight);
            netFeeText.setTypeface(firaLight);

            // Bind data
            categoryTypeText.setText(intent.getStringExtra(EXTRA_CATEGORY));
            rideFareTextView.setText(intent.getStringExtra(EXTRA_FARE));
            riderRating.setText(intent.getStringExtra(EXTRA_RATING));
            dxToPickup.setText(intent.getStringExtra(EXTRA_PICKUP_DISTANCE));
            rideDistanceTextView.setText(intent.getStringExtra(EXTRA_DROPOFF_DISTANCE));
            dropOffLocationText.setText(intent.getStringExtra(EXTRA_DROPOFF_LOCATION));
            exclusiveTagText.setText("Exclusive");
            exclusiveTagText.setVisibility(View.VISIBLE);

            ImageButton closeButton = popUpView.findViewById(R.id.closeButton);
            closeButton.setOnClickListener(v -> stopSelf());

            setOnClickListener();
        } catch (Exception e) {
            Log.e(TAG, "Failed to populate popup views", e);
        }
    }

    private void withAnimation(View view) {
        view.setVisibility(View.VISIBLE);
        view.setTranslationX(-1500);
        view.animate()
                .translationX(0)
                .setInterpolator(new FastOutLinearInInterpolator())
                .setDuration(600)
                .start();
    }

    private long getTimeBasedOnRamSize() {
        ActivityManager.MemoryInfo mi = new ActivityManager.MemoryInfo();
        ActivityManager activityManager = (ActivityManager) getSystemService(ACTIVITY_SERVICE);
        activityManager.getMemoryInfo(mi);
        double totalRamInGB = ((double) mi.totalMem) / 1024 / 1024 / 1024;
        if (totalRamInGB >= RAM_THRESHOLD_GB) {
            return BASE_DELAY_MS;
        }
        return (long) (BASE_DELAY_MS + (RAM_THRESHOLD_GB - totalRamInGB) * DELAY_PER_GB_MS);
    }

    private void openMainActivity() {
        Intent intent = getPackageManager().getLaunchIntentForPackage(getPackageName());
        if (intent != null) {
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);
            getApplicationContext().startActivity(intent);
            stopSelf();
        }
    }

    private void setOnClickListener() {
        if (popUpView == null) return;
        long ramBasedTime = getTimeBasedOnRamSize();
        Button button = popUpView.findViewById(R.id.confirmButton);
        button.setOnClickListener(v -> {
            SharedPreferences prefs = getApplicationContext().getSharedPreferences(
                    getString(R.string.sit_we_go_shared_preferences),
                    Context.MODE_PRIVATE
            );
            boolean appKilled = prefs.getString("ACTIVITY_STATUS", "null").equals("onDestroy");
            if (!appKilled) {
                minimizeApp();
                mainHandler.postDelayed(this::openMainActivity, ramBasedTime);
            } else {
                openMainActivity();
            }
        });
    }

    public void minimizeApp() {
        Intent intent = new Intent(Intent.ACTION_MAIN);
        intent.addCategory(Intent.CATEGORY_HOME)
                .setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        startActivity(intent);
    }
}
