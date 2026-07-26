package com.transli.mobilitycaptain.common.utils;

import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.util.Log;

/**
 * Opens the per-app "Appear on top" (SYSTEM_ALERT_WINDOW) settings screen.
 *
 * <p>There is no API for an app to grant this itself — it is an appop, not a
 * runtime permission, so {@code requestPermissions()} does not apply and even a
 * Device Owner cannot set it. Sending the user to the right screen is the only
 * option.
 *
 * <p>The obvious intent, {@link Settings#ACTION_MANAGE_OVERLAY_PERMISSION} with a
 * {@code package:} URI, is documented to open the per-app screen but Samsung One
 * UI ignores the URI and opens the full app list instead (verified on an
 * SM-A307FN: it resolves to {@code Settings$OverlaySettingsActivity}, the list).
 * {@link Settings#ACTION_MANAGE_APP_OVERLAY_PERMISSION}, added in API 30, does
 * land on the per-app toggle ({@code Settings$AppDrawOverlaySettingsActivity}),
 * so it is tried first and the older action is kept as the fallback for API 29
 * and below.
 */
public final class OverlaySettings {

    private static final String TAG = "OverlaySettings";

    /**
     * {@code Settings.ACTION_MANAGE_APP_OVERLAY_PERMISSION}, which exists from API
     * 30 but is annotated {@code @SystemApi} and so is not on the public SDK —
     * hence the literal. Resolving it before use keeps a device without it safe.
     */
    private static final String ACTION_MANAGE_APP_OVERLAY_PERMISSION =
            "android.settings.MANAGE_APP_OVERLAY_PERMISSION";

    private OverlaySettings() {}

    /** Whether the app currently holds the overlay permission. */
    public static boolean canDrawOverlays(Context context) {
        return Settings.canDrawOverlays(context);
    }

    /**
     * Launch the settings screen, most specific target first.
     *
     * <p>{@code context} may be an Activity or the application context; when it is
     * not an Activity the intent is given {@code FLAG_ACTIVITY_NEW_TASK} so it can
     * still start.
     *
     * @return true if some screen was opened, false if every candidate failed.
     */
    public static boolean open(Context context) {
        String uri = "package:" + context.getPackageName();

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R
                && start(context, new Intent(
                        ACTION_MANAGE_APP_OVERLAY_PERMISSION, Uri.parse(uri)))) {
            return true;
        }

        // Correct per the docs, and what non-Samsung devices honour.
        if (start(context, new Intent(
                Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse(uri)))) {
            return true;
        }

        // The app list — worse, but better than dropping the user nowhere.
        if (start(context, new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION))) {
            return true;
        }

        // Last resort: this app's details page, two taps from the toggle.
        if (start(context, new Intent(
                Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse(uri)))) {
            return true;
        }

        Log.w(TAG, "No settings screen could be opened for overlay permission");
        return false;
    }

    private static boolean start(Context context, Intent intent) {
        // A missing Activity is normal here — OEMs vary in which of these they
        // expose, and the caller walks the list until one sticks.
        if (intent.resolveActivity(context.getPackageManager()) == null) {
            return false;
        }
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            context.startActivity(intent);
            return true;
        } catch (ActivityNotFoundException | SecurityException e) {
            Log.w(TAG, "Failed to start " + intent.getAction(), e);
            return false;
        }
    }
}
