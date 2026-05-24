package com.transli.mobilitycaptain.common.utils;

import android.content.Context;
import android.content.Intent;
import android.util.Log;

import com.transli.mobilitycaptain.OverlayPopUp;

import org.json.JSONObject;

import java.util.Locale;

public class NotificationController {

    private static final String TAG = "NotificationController";

    public static void showPopUpNotification(Context context, String data) {
        Intent popupIntent = new Intent(context, OverlayPopUp.class);

        try {
            JSONObject json = new JSONObject(data);

            String category            = json.optString("vc", "Standard");
            int    fare                = json.optInt("fare", 0);
            double distanceKm          = json.optDouble("distance", 0);
            int    durationSec         = json.optInt("duration", 0);
            double distanceToPickupM   = json.optDouble("distance_to_pickup", 0);
            double durationToPickupMin = json.optDouble("duration_to_pickup", 0);

            JSONObject to = json.optJSONObject("to");
            String dropoffLocation = resolveLocation(to);

            popupIntent.putExtra(OverlayPopUp.EXTRA_CATEGORY,         category);
            popupIntent.putExtra(OverlayPopUp.EXTRA_IS_EXCLUSIVE,     false);
            popupIntent.putExtra(OverlayPopUp.EXTRA_FARE,             "KES " + fare);
            popupIntent.putExtra(OverlayPopUp.EXTRA_RATING,           "★ 5.0");
            popupIntent.putExtra(OverlayPopUp.EXTRA_PICKUP_DISTANCE,  formatPickupDistance(distanceToPickupM, durationToPickupMin));
            popupIntent.putExtra(OverlayPopUp.EXTRA_DROPOFF_DISTANCE, formatTripDistance(distanceKm, durationSec));
            popupIntent.putExtra(OverlayPopUp.EXTRA_DROPOFF_LOCATION, dropoffLocation);

        } catch (Exception e) {
            Log.e(TAG, "Failed to parse ride data", e);
        }

        popupIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            context.startService(popupIntent);
        } catch (Exception e) {
            Log.e(TAG, "Error starting OverlayPopUp service", e);
        }
    }

    /** Resolves the best human-readable label from a location object. */
    private static String resolveLocation(JSONObject loc) {
        if (loc == null) return "";
        String ward = loc.optString("ward", "");
        if (!ward.isEmpty()) return ward;
        String city = loc.optString("city", "");
        if (!city.isEmpty()) return city;
        return loc.optString("street", "");
    }

    /**
     * Formats pickup distance.
     * distance_to_pickup is in metres, duration_to_pickup is in minutes.
     * Example: "2 min (479 m) away"
     */
    private static String formatPickupDistance(double metres, double minutes) {
        int roundedMin = (int) Math.ceil(minutes);
        if (metres >= 1000) {
            return String.format(Locale.getDefault(), "%d min (%.1f km) away", roundedMin, metres / 1000);
        }
        return String.format(Locale.getDefault(), "%d min (%d m) away", roundedMin, (int) metres);
    }

    /**
     * Formats the full trip distance.
     * distance is in km, duration is in seconds.
     * Example: "1.1 km · 2 min 42 sec"
     */
    private static String formatTripDistance(double km, int seconds) {
        int minutes = seconds / 60;
        int remainingSec = seconds % 60;
        String timeStr = remainingSec > 0
                ? String.format(Locale.getDefault(), "%d min %d sec", minutes, remainingSec)
                : String.format(Locale.getDefault(), "%d min", minutes);
        return String.format(Locale.getDefault(), "%.1f km · %s", km, timeStr);
    }

}
