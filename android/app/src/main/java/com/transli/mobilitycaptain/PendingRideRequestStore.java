package com.transli.mobilitycaptain;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Log;

import androidx.annotation.Nullable;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.WritableMap;

import org.json.JSONObject;

/**
 * Single-slot, disk-backed holder for the most recent unconsumed ride request.
 *
 * <p>GrpcNotificationService outlives the activity (see MainApplication /
 * GeoKalmanModule#onHostDestroy), so an offer can arrive while the React
 * context is dead. RCTDeviceEventEmitter does not buffer, so that offer would
 * otherwise be lost between the overlay tap and the app finishing its cold
 * start. The service writes every offer here; JS drains it on mount and on
 * foreground.
 *
 * <p>Backed by SharedPreferences rather than MMKV so it works on a headless
 * service start (BootReceiver) without depending on MMKV.initialize() having
 * run in MainApplication.
 */
public final class PendingRideRequestStore {

    private static final String TAG = "PendingRideRequestStore";
    private static final String KEY = "PENDING_RIDE_REQUEST";

    private static final String FIELD_ID = "id";
    private static final String FIELD_CATEGORY = "category";
    private static final String FIELD_TYPE = "type";
    private static final String FIELD_ENTITY_ID = "entity_id";
    private static final String FIELD_DATA = "data";
    private static final String FIELD_RECEIVED_AT = "received_at";

    /**
     * Mirrors {@code RIDE_REQUEST_TTL_SEC} in src/utils/rideUtils.ts. A JS constant
     * cannot be read from here, so this is a deliberate duplicate — keep the two
     * in step if the offer window ever changes.
     */
    private static final long TTL_MS = 20_000L;

    private PendingRideRequestStore() {
    }

    private static SharedPreferences prefs(Context context) {
        return context.getApplicationContext().getSharedPreferences(
                context.getString(R.string.sit_we_go_shared_preferences),
                Context.MODE_PRIVATE
        );
    }

    /**
     * Persist an incoming offer, overwriting any older one — the driver only
     * ever acts on the newest request.
     *
     * @param receivedAt wall-clock ms the offer arrived; JS uses it to compute
     *                   the remaining time on the request timer.
     */
    public static void save(
            Context context,
            String id,
            String category,
            String type,
            String entityId,
            String data,
            long receivedAt
    ) {
        try {
            JSONObject json = new JSONObject();
            json.put(FIELD_ID, id);
            json.put(FIELD_CATEGORY, category);
            json.put(FIELD_TYPE, type);
            json.put(FIELD_ENTITY_ID, entityId);
            json.put(FIELD_DATA, data);
            json.put(FIELD_RECEIVED_AT, receivedAt);
            prefs(context).edit().putString(KEY, json.toString()).apply();
            Log.d(TAG, "Saved pending ride request " + id);
        } catch (Exception e) {
            Log.e(TAG, "Failed to save pending ride request", e);
        }
    }

    /**
     * Read and clear the slot in one step.
     *
     * @return the stored offer, or null when there is nothing pending.
     */
    @Nullable
    public static WritableMap consume(Context context) {
        SharedPreferences sharedPreferences = prefs(context);
        String stored = sharedPreferences.getString(KEY, null);
        // Clear regardless of parse outcome so a corrupt record cannot wedge
        // the slot and block later offers.
        sharedPreferences.edit().remove(KEY).apply();
        if (stored == null) return null;

        try {
            JSONObject json = new JSONObject(stored);
            WritableMap map = Arguments.createMap();
            map.putString(FIELD_ID, json.optString(FIELD_ID));
            map.putString(FIELD_CATEGORY, json.optString(FIELD_CATEGORY));
            map.putString(FIELD_TYPE, json.optString(FIELD_TYPE));
            map.putString(FIELD_ENTITY_ID, json.optString(FIELD_ENTITY_ID));
            map.putString(FIELD_DATA, json.optString(FIELD_DATA));
            // WritableMap has no long: epoch ms exceeds int range, and doubles
            // hold ms precision well past year 2100.
            map.putDouble(FIELD_RECEIVED_AT, json.optLong(FIELD_RECEIVED_AT));
            Log.d(TAG, "Consumed pending ride request " + json.optString(FIELD_ID));
            return map;
        } catch (Exception e) {
            Log.e(TAG, "Failed to parse pending ride request", e);
            return null;
        }
    }

    /**
     * Whether an offer is sitting in the slot and is still within its window.
     *
     * <p>Unlike {@link #consume}, this does not clear anything — the floating ride
     * assistant only reads. The TTL check is what stops a stale offer pinning the
     * bubble in its attention state: the slot is only drained when JS comes back
     * up, so an offer that arrived and expired while the app was closed would
     * otherwise sit here indefinitely.
     */
    public static boolean hasLiveOffer(Context context) {
        String stored = prefs(context).getString(KEY, null);
        if (stored == null) return false;
        try {
            long receivedAt = new JSONObject(stored).optLong(FIELD_RECEIVED_AT, 0L);
            return receivedAt > 0 && System.currentTimeMillis() - receivedAt < TTL_MS;
        } catch (Exception e) {
            Log.e(TAG, "Failed to read pending ride request", e);
            return false;
        }
    }

    /** Drop the pending offer — dismissed on the overlay, or handled in-app. */
    public static void clear(Context context) {
        prefs(context).edit().remove(KEY).apply();
        Log.d(TAG, "Cleared pending ride request");
    }
}
