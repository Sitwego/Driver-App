package com.transli.mobilitycaptain;

import android.util.Log;

import com.tencent.mmkv.MMKV;

/**
 * Single source of truth for runtime-configurable values in native code.
 *
 * Initialisation order (each layer wins over the previous):
 *   1. BuildConfig — compile-time defaults, separate values for debug / release.
 *   2. MMKV ("APP_CONFIG") — values persisted from the last successful Remote Config fetch.
 *      Call {@link #initFromMMKV()} once after {@code MMKV.initialize()} to restore them.
 *   3. Live update — JS calls {@link AppConfigModule} which calls {@link #update} and
 *      persists the new values to MMKV so they survive the next cold start.
 */
public final class AppConfig {

    private static final String TAG = "AppConfig";
    static final String MMKV_ID = "APP_CONFIG";
    static final String KEY_REST_API_BASE_URL = "REST_API_BASE_URL";
    static final String KEY_LOCATION_UPDATE_ENDPOINT = "LOCATION_UPDATE_ENDPOINT";
    static final String KEY_GRPC_SERVER_URL = "GRPC_SERVER_URL";
    static final String KEY_FLOATING_ASSISTANT_ENABLED = "FLOATING_ASSISTANT_ENABLED";

    private static volatile String restApiBaseUrl = BuildConfig.REST_API_BASE_URL;
    private static volatile String locationUpdateEndpoint = BuildConfig.LOCATION_UPDATE_ENDPOINT;
    private static volatile String grpcServerUrl = BuildConfig.GRPC_SERVER_URL;

    /**
     * Floating ride assistant (overlay bubble) kill switch.
     *
     * <p>Defaults to FALSE and stays false until Remote Config says otherwise, so a
     * fresh install shows no bubble until the flag is explicitly turned on — and
     * turning it off in Firebase kills the bubble on the next launch without a
     * store release.
     *
     * <p>Native needs its own copy because {@code BootReceiver} can start GeoKalman
     * (and therefore the bubble) headless after a reboot, long before any JS runs.
     */
    private static volatile boolean floatingAssistantEnabled = false;

    private AppConfig() {}

    /** Restore values persisted from the last Remote Config fetch. Call after MMKV.initialize(). */
    public static void initFromMMKV() {
        MMKV kv = MMKV.mmkvWithID(MMKV_ID, MMKV.SINGLE_PROCESS_MODE);
        String rest = kv.decodeString(KEY_REST_API_BASE_URL);
        String location = kv.decodeString(KEY_LOCATION_UPDATE_ENDPOINT);
        String grpc = kv.decodeString(KEY_GRPC_SERVER_URL);
        if (rest != null && !rest.isEmpty()) restApiBaseUrl = rest;
        if (location != null && !location.isEmpty()) locationUpdateEndpoint = location;
        if (grpc != null && !grpc.isEmpty()) grpcServerUrl = grpc;
        // Absent key => false => no bubble. Fails closed.
        floatingAssistantEnabled = kv.decodeBool(KEY_FLOATING_ASSISTANT_ENABLED, false);
        Log.d(TAG, "initFromMMKV grpc=" + grpcServerUrl + " rest=" + restApiBaseUrl
                + " floatingAssistant=" + floatingAssistantEnabled);
    }

    /**
     * Apply new URLs pushed from Remote Config via the JS bridge.
     * Null or empty values are ignored — the current value is kept.
     * Persists accepted values to MMKV so they survive cold starts.
     */
    public static void update(String grpc, String rest, String location) {
        MMKV kv = MMKV.mmkvWithID(MMKV_ID, MMKV.SINGLE_PROCESS_MODE);
        if (grpc != null && !grpc.isEmpty()) {
            grpcServerUrl = grpc;
            kv.encode(KEY_GRPC_SERVER_URL, grpc);
        }
        if (rest != null && !rest.isEmpty()) {
            restApiBaseUrl = rest;
            kv.encode(KEY_REST_API_BASE_URL, rest);
        }
        if (location != null && !location.isEmpty()) {
            locationUpdateEndpoint = location;
            kv.encode(KEY_LOCATION_UPDATE_ENDPOINT, location);
        }
        Log.d(TAG, "update grpc=" + grpcServerUrl + " rest=" + restApiBaseUrl);
    }

    /**
     * Apply the floating-assistant flag pushed from Remote Config.
     *
     * <p>Deliberately separate from {@link #update}: that method carries the gRPC and
     * REST base URLs, and a signature change there would put the whole networking
     * path in the blast radius of a UI feature flag.
     */
    public static void setFloatingAssistantEnabled(boolean enabled) {
        floatingAssistantEnabled = enabled;
        MMKV.mmkvWithID(MMKV_ID, MMKV.SINGLE_PROCESS_MODE)
                .encode(KEY_FLOATING_ASSISTANT_ENABLED, enabled);
        Log.d(TAG, "setFloatingAssistantEnabled " + enabled);
    }

    public static boolean isFloatingAssistantEnabled() { return floatingAssistantEnabled; }

    public static String getRestApiBaseUrl() { return restApiBaseUrl; }
    public static String getLocationUpdateEndpoint() {
        String base = restApiBaseUrl.endsWith("/") ? restApiBaseUrl : restApiBaseUrl + "/";
        String path = locationUpdateEndpoint.startsWith("/") ? locationUpdateEndpoint.substring(1) : locationUpdateEndpoint;
        return base + path;
    }
    public static String getGrpcServerUrl() { return grpcServerUrl; }
}
