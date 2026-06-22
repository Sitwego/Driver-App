package mad.location.manager.lib.locationProviders;

import android.content.Context;

import android.location.Location;
import android.location.LocationManager;

import android.os.HandlerThread;
import android.os.SystemClock;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.annotation.RequiresPermission;

import androidx.core.location.LocationManagerCompat;

import com.google.android.gms.location.FusedLocationProviderClient;
import com.google.android.gms.location.LocationAvailability;
import com.google.android.gms.location.LocationCallback;
import com.google.android.gms.location.LocationRequest;
import com.google.android.gms.location.LocationResult;
import com.google.android.gms.location.LocationServices;
import com.google.android.gms.location.LocationSettingsRequest;
import com.google.android.gms.location.LocationSettingsResponse;
import com.google.android.gms.location.Priority;
import com.google.android.gms.location.SettingsClient;
import com.google.android.gms.tasks.CancellationTokenSource;
import com.google.android.gms.tasks.OnFailureListener;
import com.google.android.gms.tasks.OnSuccessListener;
import com.google.android.gms.tasks.Task;

import mad.location.manager.lib.Services.Settings;

public class FusedLocationProvider {
    private final FusedLocationProviderClient m_fusedLocationProviderClient;
    private LocationRequest m_locationRequest;
    LocationSettingsRequest.Builder builder;
    SettingsClient client;
    Task<LocationSettingsResponse> task;
    Context context;
    LocationProviderCallback m_locationProvider;

    CancellationTokenSource cancellationTokenSource;
    private final LocationCallback locationCallback = new LocationCallback() {
        @Override
        public void onLocationResult(@NonNull LocationResult locationResult) {
            super.onLocationResult(locationResult);
            // FIX #5: dispatch location only once; previously it was sent twice when accuracy < 30m
            Location lastLocation = locationResult.getLastLocation();
            if (lastLocation != null && lastLocation.hasAccuracy() && lastLocation.getAccuracy() < 20) {
                Log.d("FusedLocationProvider", "Watched Last location: " + lastLocation);
                m_locationProvider.onLocationAvailable(lastLocation);
            } else if (lastLocation != null) {
                Log.d("FusedLocationProvider", "Skipped location — accuracy too low: " +
                        (lastLocation.hasAccuracy() ? lastLocation.getAccuracy() + "m" : "unknown"));
            }
        }

        @Override
        public void onLocationAvailability(@NonNull LocationAvailability locationAvailability) {
            builder = new LocationSettingsRequest.Builder()
                    .addLocationRequest(m_locationRequest);
            client = LocationServices.getSettingsClient(context);
            task = client.checkLocationSettings(builder.build());
            task.addOnSuccessListener(new OnSuccessListener<LocationSettingsResponse>() {
                @Override
                public void onSuccess(LocationSettingsResponse locationSettingsResponse) {
                    m_locationProvider.locationAvailabilityChanged(true);
                }
            });
            task.addOnFailureListener(new OnFailureListener() {
                @Override
                public void onFailure(@NonNull Exception e) {
                    m_locationProvider.locationAvailabilityChanged(false);
                }
            });

        }
    };

    public FusedLocationProvider(Context context, LocationProviderCallback m_locationProvider) {
        this.m_fusedLocationProviderClient = LocationServices.getFusedLocationProviderClient(context);
        this.context = context;
        this.m_locationProvider = m_locationProvider;
    }

    @RequiresPermission("android.permission.ACCESS_FINE_LOCATION")
    public void startLocationUpdates(Settings m_settings, HandlerThread thread) {
        // Default interval in seconds
        int locationRequestInterval = 10;
        int intervalMs = locationRequestInterval * m_settings.gpsMinTime;
        Log.d("FusedLocationProvider", "intervalMs: " + intervalMs); //20-000
        // Default max waiting time to get location in milliseconds
        int locationMaxTimeThreshold = 1000;
        m_locationRequest = new LocationRequest.Builder(intervalMs)
                // Time-based updates
                .setIntervalMillis(intervalMs)                     // Target update interval
                .setMinUpdateIntervalMillis(intervalMs / 2)        // Fastest allowed update rate
                .setMaxUpdateDelayMillis(locationMaxTimeThreshold)           // Maximum time without updates

                // Distance-based updates - device will update when moved this far
                .setMinUpdateDistanceMeters(m_settings.gpsMinDistance)

                // This ensures we get location updates EITHER when time passes OR when distance changes
                // whichever happens first
                .setWaitForAccurateLocation(true) // if driver is on ride or not
                .setPriority(Priority.PRIORITY_HIGH_ACCURACY)
                .build();
        m_fusedLocationProviderClient.requestLocationUpdates(m_locationRequest,
                locationCallback,
                thread.getLooper());
    }


    public void stop() {
        Log.i("STOPPING", "STOPPING FUSED LOCATION PROVIDER");
        m_fusedLocationProviderClient.removeLocationUpdates(locationCallback);
    }

    public boolean isProviderEnabled() {
        return LocationManagerCompat.isLocationEnabled((LocationManager) context.getSystemService(Context.LOCATION_SERVICE));
    }

   @RequiresPermission("android.permission.ACCESS_FINE_LOCATION")
    public void onCurrentLocationChanged(boolean USE_CURRENT) {
        if (USE_CURRENT){
            m_fusedLocationProviderClient.getCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY, null)
                    .addOnSuccessListener(loc -> {
                        if (loc != null) {
                            Log.d("FusedLocationProvider", "Current getCurrentLocation: " + loc);
                            if (loc.hasAccuracy()) {
                                if (loc.getAccuracy() < 20){
                                    m_locationProvider.onLocationAvailable(loc);
                                } else {
                                    Log.d("FusedLocationProvider", "Current location accuracy is too high");
                                }
                            }
                        } else {
                            Log.d("FusedLocationProvider", "Current location is null");
                        }
                    })
                    .addOnFailureListener(e -> {
                        Log.e("LocationService", "Failed to get location", e);
                    });
        } else {
            m_fusedLocationProviderClient.getLastLocation()
                    .addOnSuccessListener(loc -> {
                        if (loc != null) {
                            long locationAgeMs = SystemClock.elapsedRealtime() - (loc.getElapsedRealtimeNanos() / 1_000_000);

                            if (loc.hasAccuracy() && locationAgeMs < 5000) {
                                Log.e("FusedLocationProvider", "Last getLastLocation: " + loc);
                                if (loc.getAccuracy() < 20){
                                    m_locationProvider.onLocationAvailable(loc);
                                } else {
                                    Log.d("FusedLocationProvider", "Current location accuracy is too high");
                                }
                            }
                        }
                    });
        }
    }

}