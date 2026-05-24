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
                GeoKalman.stopGeokalmanService(reactContext);
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
        return Settings.canDrawOverlays(reactApplicationContext);
    }

    @ReactMethod
    public void openOverlaySettings() {
        Activity activity = getCurrentActivity();
        if (activity == null) return;
        Intent intent = new Intent(
                Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                Uri.parse("package:" + reactApplicationContext.getPackageName())
        );
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        activity.startActivity(intent);
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
