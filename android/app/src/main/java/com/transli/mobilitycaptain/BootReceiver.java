package com.transli.mobilitycaptain;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.util.Log;

import com.transli.mobilitycaptain.helpers.ThreadUtils;

/**
 * Restarts the driver's location tracking (GeoKalman foreground service and,
 * transitively, the gRPC notification service) after a device reboot or an app
 * update — but only when the driver was online at the time the process died.
 * GeoKalman persists that state under {@link GeoKalman#PREF_KEY_DRIVER_ONLINE}.
 */
public class BootReceiver extends BroadcastReceiver {
    private static final String TAG = "BootReceiver";

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        if (!Intent.ACTION_BOOT_COMPLETED.equals(action)
                && !Intent.ACTION_MY_PACKAGE_REPLACED.equals(action)) {
            return;
        }

        Context appContext = context.getApplicationContext();
        // goAsync so the prefs read + service start can run off the main thread
        // without the system considering the broadcast finished.
        PendingResult pendingResult = goAsync();
        ThreadUtils.runOnExecutor(() -> {
            try {
                resumeTrackingIfOnline(appContext, action);
            } catch (Exception e) {
                Log.e(TAG, "Failed to resume tracking after " + action, e);
            } finally {
                pendingResult.finish();
            }
        });
    }

    private void resumeTrackingIfOnline(Context context, String action) {
        SharedPreferences prefs = context.getSharedPreferences(
                context.getString(R.string.sit_we_go_shared_preferences),
                Context.MODE_PRIVATE
        );

        if (!prefs.getBoolean(GeoKalman.PREF_KEY_DRIVER_ONLINE, false)) {
            Log.d(TAG, action + " received but driver was offline — nothing to resume");
            return;
        }

        String token = prefs.getString("token", "");
        if (token == null || token.isEmpty()) {
            Log.w(TAG, "Driver was online but no auth token persisted — skipping resume");
            return;
        }

        Log.i(TAG, action + " received — driver was online, resuming tracking");
        try {
            GeoKalman.startGeokalmanService(MainActivity.class, context, token);
        } catch (SecurityException e) {
            Log.e(TAG, "Missing permission to restart tracking", e);
        } catch (IllegalStateException e) {
            // ForegroundServiceStartNotAllowedException on Android 12+
            Log.e(TAG, "Foreground service start not allowed from background", e);
        }
    }
}
