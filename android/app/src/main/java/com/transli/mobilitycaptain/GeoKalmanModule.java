package com.transli.mobilitycaptain;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.provider.Settings;
import android.util.Log;

import androidx.annotation.NonNull;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.LifecycleEventListener;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

import com.transli.mobilitycaptain.bubble.BubbleStateStore;
import com.transli.mobilitycaptain.bubble.RideBubbleService;
import com.transli.mobilitycaptain.common.utils.OverlaySettings;
import com.transli.mobilitycaptain.helpers.ThreadUtils;
import mad.location.manager.lib.Services.ServicesHelper;

public class GeoKalmanModule extends ReactContextBaseJavaModule {
    private static ReactApplicationContext reactApplicationContext;
    private final SharedPreferences sharedPref;
    Intent overlayIntent;

    private static final String activityStatusKey = "ACTIVITY_STATUS";

    public GeoKalmanModule(ReactApplicationContext reactContext) {
        super(reactContext);
        reactApplicationContext = reactContext;
        sharedPref = reactContext.getSharedPreferences(reactContext.getString(R.string.sit_we_go_shared_preferences), Context.MODE_PRIVATE);
        reactContext.addLifecycleEventListener(new LifecycleEventListener() {
            @Override
            public void onHostResume() {
                RpcChannelManager.init();
                SharedPreferences.Editor editor = sharedPref.edit();
                editor.putString(activityStatusKey, "onResume");
                editor.apply();
                if (overlayIntent != null) {
                     reactContext.stopService(overlayIntent);
                }
                // Only resume KalmanLocationService if GeoKalman is actually running.
                // ServicesHelper.getLocationService uses BIND_AUTO_CREATE, so calling it
                // unconditionally would start KalmanLocationService even when offline.
                if (GeoKalman.isGeokalmanServiceRunning(reactContext)) {
                    ServicesHelper.getLocationService(reactContext, service -> service.resume());
                }
                // The services survive task removal (stopWithTask=false, no stop in
                // onHostDestroy), so after the user swipes the app away and reopens
                // it they hold a dead React context. Re-attach so JS events
                // (onGeoKalman, onRideReqMessage) reach the new instance.
                GeoKalman runningService = GeoKalman.getInstance();
                if (runningService != null) {
                    runningService.refreshReactContext();
                }
                GrpcNotificationService.refreshReactContextIfRunning();
                android.util.Log.d("LifecycleEvent", "onHostResume: ACTIVITY_STATUS set to onResume");
            }

            @Override
            public void onHostPause() {
                SharedPreferences.Editor editor = sharedPref.edit();
                editor.putString(activityStatusKey, "onPause");
                editor.apply();
                android.util.Log.d("LifecycleEvent", "onHostPause: ACTIVITY_STATUS set to onPause");
            }

            @Override
            public void onHostDestroy() {
                SharedPreferences.Editor editor = sharedPref.edit();
                editor.putString(activityStatusKey, "onDestroy");
                editor.apply();
                // Deliberately NOT stopping GeoKalman here: tracking must keep
                // running when the user swipes the app away. Going offline is an
                // explicit action (JS stopGeokalmanService) or logout.
                android.util.Log.d("LifecycleEvent", "onHostDestroy: ACTIVITY_STATUS set to onDestroy");
            }
        });
    }

    @NonNull
    @Override
    public String getName() {
        return "GeoKalmanModule";
    }

    @Override
    public void initialize() {
        // TODO: Handle initialization if needed
        super.initialize();
        overlayIntent = new Intent(getReactAppContext(), OverlayPopUp.class);
    }

    /**
     * Check if GeoKalman service is running
     * @return boolean
     */
    @ReactMethod(isBlockingSynchronousMethod = true)
    public boolean isGeokalmanServiceRunning() {
        boolean isRunning = GeoKalman.isGeokalmanServiceRunning(reactApplicationContext);
        Log.d("GeoKalmanModule", "isGeokalmanServiceRunning: " + isRunning);
        return isRunning;
    }

    @ReactMethod(isBlockingSynchronousMethod = true)
    public boolean startEventService() {
        if (!HelperMethods.isServiceRunning(getReactAppContext(), RpcRideEventService.class)){
           Intent intent = new Intent(getReactAppContext(), RpcRideEventService.class);
           getReactAppContext().startService(intent);
            Log.d("GeoKalmanModule", "RpcRideEventService started");
            return true;
        } else {
            Log.d("GeoKalmanModule", "RpcRideEventService already running");
            return false;
        }
    }

    @ReactMethod(isBlockingSynchronousMethod = true)
    public boolean stopEventService() {
        if (HelperMethods.isServiceRunning(getReactAppContext(), RpcRideEventService.class)){
            Intent intent = new Intent(getReactAppContext(), RpcRideEventService.class);
            getReactAppContext().stopService(intent);
            Log.d("GeoKalmanModule", "RpcRideEventService stopped");
            return true;
        } else {
            Log.d("GeoKalmanModule", "RpcRideEventService not running");
            return false;
        }
    }

    /**
     * Start GeoKalman service
     */
    @ReactMethod
    public void startGeokalmanService(String token) {
        Activity activity = getCurrentActivity();
        if (activity != null) {
            activity.runOnUiThread(() -> {
                GeoKalman.startGeokalmanService(activity.getClass(), reactApplicationContext, token);
            });
        }
    }

    /**
     * Stop GeoKalman service — dispatched to a background thread so that
     * ServicesHelper.disconnect() and the stopService intent don't run on
     * the React Native modules queue (or main thread).
     */
    @ReactMethod
    public void stopGeokalmanService() {
        ThreadUtils.runOnExecutor(() -> GeoKalman.stopGeokalmanService(reactApplicationContext));
    }

    @ReactMethod
    public void addListener(String eventName) {
    }

    @ReactMethod
    public void removeListeners(Integer count) {
    }

    public static ReactApplicationContext getReactAppContext(){
        return reactApplicationContext;
    }

    @ReactMethod
    public void getETA(double currLat, double currLng, int speed, String gpsPoints, Promise promise){
        ThreadUtils.runOnExecutor(() -> {
            try {
                String eta = GeoKalman.findPositionInPolyline(currLat, currLng, speed, gpsPoints);
                if (eta.isEmpty()) {
                    promise.reject("EMPTY_RESULT", "ETA calculation returned an empty result.");
                } else {
                    promise.resolve(eta);
                }
            } catch (Exception e) {
                promise.reject("ERROR", e.getMessage());
            }
        });
    }
    @ReactMethod
    public void isDriverOnline(Promise promise){
        Log.d("GeoKalmanModule", "isDriverOnline: " + isGeokalmanServiceRunning());
        promise.resolve(isGeokalmanServiceRunning());
    }

    @ReactMethod(isBlockingSynchronousMethod = true)
    public boolean canDrawOverlays() {
        return OverlaySettings.canDrawOverlays(reactApplicationContext);
    }

    /**
     * Kept for existing JS callers; delegates to {@link OverlaySettings} so the
     * OEM-specific intent handling lives in exactly one place.
     */
    @ReactMethod
    public void openOverlaySettings() {
        Activity activity = getCurrentActivity();
        OverlaySettings.open(activity != null ? activity : reactApplicationContext);
    }

    /**
     * Read and clear the ride request that arrived while the React context was
     * dead (app swiped away). Resolves null when there is nothing pending.
     */
    @ReactMethod
    public void consumePendingRideRequest(Promise promise) {
        try {
            promise.resolve(PendingRideRequestStore.consume(reactApplicationContext));
        } catch (Exception e) {
            promise.reject("ERROR", e.getMessage());
        }
    }

    /** Drop the pending offer once JS has handled or expired it. */
    @ReactMethod
    public void clearPendingRideRequest(Promise promise) {
        try {
            PendingRideRequestStore.clear(reactApplicationContext);
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("ERROR", e.getMessage());
        }
    }

    /**
     * Repaint the floating ride assistant after a ride-state transition in JS.
     *
     * <p>The bubble reads the shared ride store directly, so this carries no
     * payload — it only says "something changed, look again". Keeping it to a
     * single JS call site (UseRideRequestProvider) is what stops the projection
     * drifting from the real state.
     */
    @ReactMethod
    public void refreshRideBubble() {
        RideBubbleService.refresh(reactApplicationContext);
    }

    /**
     * Bring the bubble into line with whether the driver is currently online.
     *
     * <p>Needed because the overlay permission has no grant callback: a driver can
     * go online, decline, flip the toggle in system settings and come back, and
     * nothing would otherwise start the bubble until the next shift. Also covers
     * the reverse — permission revoked while online.
     */
    @ReactMethod
    public void syncRideBubble() {
        if (isGeokalmanServiceRunning()) {
            RideBubbleService.start(reactApplicationContext);
        } else {
            RideBubbleService.stop(reactApplicationContext);
        }
    }

    /**
     * Read and clear the screen a bubble tap asked for. Resolves null when the app
     * was opened any other way, so a normal launch never gets hijacked.
     */
    @ReactMethod
    public void consumeBubbleLaunchTarget(Promise promise) {
        try {
            promise.resolve(BubbleStateStore.consumeLaunchTarget(reactApplicationContext));
        } catch (Exception e) {
            promise.reject("ERROR", e.getMessage());
        }
    }

    @ReactMethod void saveTokenToSharedPreferences(String token, Promise promise) {
        try {
            SharedPreferences.Editor editor = sharedPref.edit();
            editor.putString("token", token);
            editor.apply();
            Log.d("GeoKalmanModule", "Token saved to shared preferences: " + token);
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("ERROR", e.getMessage());
        }
    }

}
