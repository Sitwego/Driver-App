package mad.location.manager.lib.locationProviders;

import android.location.Location;

// Step 1: Define the callback interface
public interface FusedLocationCallback {
    void onLocationResult(Location location);
}
