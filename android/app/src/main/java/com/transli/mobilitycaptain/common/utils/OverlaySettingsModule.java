package com.transli.mobilitycaptain.common.utils;

import android.app.Activity;
import android.content.Context;

import androidx.annotation.NonNull;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

/**
 * React Native bridge for the "Appear on top" (overlay) permission.
 *
 * Usage from JS:
 *   import { NativeModules } from 'react-native';
 *   NativeModules.OverlaySettings.canDrawOverlays();   // sync boolean
 *   await NativeModules.OverlaySettings.open();        // resolves true if a screen opened
 */
public class OverlaySettingsModule extends ReactContextBaseJavaModule {

    OverlaySettingsModule(ReactApplicationContext context) {
        super(context);
    }

    @NonNull
    @Override
    public String getName() {
        return "OverlaySettings";
    }

    @ReactMethod(isBlockingSynchronousMethod = true)
    public boolean canDrawOverlays() {
        return OverlaySettings.canDrawOverlays(getReactApplicationContext());
    }

    /**
     * Open the per-app overlay settings screen. Resolves false when no settings
     * screen could be opened at all, so JS can fall back to instructing the user.
     */
    @ReactMethod
    public void open(Promise promise) {
        try {
            // Prefer the Activity so the screen opens in the app's own task and
            // back returns here; the application context still works otherwise.
            Activity activity = getCurrentActivity();
            Context context = activity != null ? activity : getReactApplicationContext();
            promise.resolve(OverlaySettings.open(context));
        } catch (Exception e) {
            promise.reject("OVERLAY_SETTINGS_ERROR", e.getMessage(), e);
        }
    }
}
