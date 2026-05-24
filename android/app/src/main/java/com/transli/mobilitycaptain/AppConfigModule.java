package com.transli.mobilitycaptain;

import android.util.Log;

import androidx.annotation.NonNull;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

/**
 * React Native bridge that lets JS push Remote Config URL values into native code.
 *
 * Usage from JS:
 *   import { NativeModules } from 'react-native';
 *   NativeModules.AppConfig.update(grpcServerUrl, restApiBaseUrl, locationUpdateEndpoint);
 *
 * Pass an empty string for any value you don't want to override.
 */
public class AppConfigModule extends ReactContextBaseJavaModule {

    private static final String TAG = "AppConfigModule";

    AppConfigModule(ReactApplicationContext context) {
        super(context);
    }

    @NonNull
    @Override
    public String getName() {
        return "AppConfig";
    }

    /**
     * Push updated URLs from Remote Config into native.
     * If grpcServerUrl changed the gRPC channel is reset so the next call reconnects.
     */
    @ReactMethod
    public void update(String grpcServerUrl, String restApiBaseUrl, String locationUpdateEndpoint) {
        Log.d(TAG, "update called from JS: grpc=" + grpcServerUrl + " rest=" + restApiBaseUrl);
        boolean grpcChanged = grpcServerUrl != null
                && !grpcServerUrl.isEmpty()
                && !grpcServerUrl.equals(AppConfig.getGrpcServerUrl());
        AppConfig.update(grpcServerUrl, restApiBaseUrl, locationUpdateEndpoint);
        if (grpcChanged) {
            Log.d(TAG, "gRPC URL changed — resetting channel");
            RpcChannelManager.resetChannel();
        }
    }
}
