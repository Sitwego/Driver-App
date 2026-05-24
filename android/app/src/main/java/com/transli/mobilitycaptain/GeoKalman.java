package com.transli.mobilitycaptain;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.ActivityManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.net.ConnectivityManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.location.Location;
import android.location.LocationManager;
import android.os.Build;
import android.os.IBinder;
import android.util.Log;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;
import com.transli.mobilitycaptain.helpers.ThreadUtils;
import com.google.android.gms.maps.model.LatLng;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.google.gson.JsonSyntaxException;
import com.google.maps.android.PolyUtil;
import com.google.maps.android.SphericalUtil;
import com.tencent.mmkv.MMKV;
import com.transli.mobilitycaptain.common.utils.NetworkApiCalls;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.Executors;
import java.util.concurrent.PriorityBlockingQueue;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;

import android.text.TextUtils;

import mad.location.manager.lib.Commons.Utils;
import mad.location.manager.lib.Interfaces.ILogger;
import mad.location.manager.lib.Interfaces.LocationServiceInterface;
import mad.location.manager.lib.Services.ServicesHelper;
import mad.location.manager.lib.Services.KalmanLocationService;
import mad.location.manager.lib.Loggers.GeohashRTFilter;
import mad.location.manager.lib.Services.Settings;


public class GeoKalman extends Service implements ILogger, LocationServiceInterface {

    public static String BEARER_TOKEN = "";

    public static final String TAG = "GeoKalman";
    private static final String CHANNEL_ID = "GeoNotificationChannel";
    private static final int NOTIFICATION_ID = 1;
    private static GeoKalman instance;
    private static volatile MMKV mmkv;
    private static volatile MMKV locationMmkv;

    private GeohashRTFilter m_geoHashRTFilter;

    public static Class<? extends Activity> activityClassOpenfromNotification;

    private DeviceEventManagerModule.RCTDeviceEventEmitter eventEmitter = null;

    private ReactApplicationContext reactApplicationContext;

    private ScheduledExecutorService scheduler;

    long lastApiCall = 0;

    SharedPreferences sharedPref;

    /**
     * Maximum locations to hold in the queue.
     * Prevents unbounded memory growth when the app is backgrounded.
     */
    private static final int MAX_QUEUE_SIZE = 50;

    private static final long BATCH_TIMEOUT_MS = 10000;

    private ExecutorService queueExecutor;
    private ScheduledExecutorService apiExecutor;
    private final PriorityBlockingQueue<LocationData> locationQueue = new PriorityBlockingQueue<>();
    private final AtomicBoolean isRunning = new AtomicBoolean(false);
    private static final int MIN_BATCH_SIZE = 1;
    private static final int MAX_BATCH_SIZE = 20;
    private static final long UPDATE_INTERVAL_MS = 10000;
    private final AtomicInteger currentBatchSize = new AtomicInteger(5);
    private final AtomicLong lastUpdateTime = new AtomicLong(System.currentTimeMillis());
    private final AtomicInteger locationCount = new AtomicInteger(0);
    private static final int MAX_RETRIES = 5;
    private static final long RETRY_DELAY_MS = 1000;

    private ScheduledFuture<?> batchSizeUpdaterFuture;

    public static boolean isGeokalmanServiceRunning(ReactApplicationContext reactApplicationContext) {
        return GeoKalman.isServiceRunning(reactApplicationContext, GeoKalman.class);
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onCreate() {
        super.onCreate();
        instance = this;
        sharedPref = getApplicationContext().getSharedPreferences(
                getApplicationContext().getString(R.string.sit_we_go_shared_preferences),
                Context.MODE_PRIVATE
        );
        BEARER_TOKEN = sharedPref.getString("token", "");
        reactApplicationContext = GeoKalmanModule.getReactAppContext();
        mmkv = MMKV.mmkvWithID("VEHICLE_CATEGORY_DATA", MMKV.SINGLE_PROCESS_MODE);
        locationMmkv = MMKV.mmkvWithID("CURRENT_LOCATION", MMKV.SINGLE_PROCESS_MODE);
        scheduler = Executors.newSingleThreadScheduledExecutor();
        // Note: executors are created lazily in startQueueProcessor, not here
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        sharedPref = getApplicationContext().getSharedPreferences(
                getApplicationContext().getString(R.string.sit_we_go_shared_preferences),
                Context.MODE_PRIVATE
        );
        BEARER_TOKEN = sharedPref.getString("token", "");
        Notification notification = createNotification();
        m_geoHashRTFilter = new GeohashRTFilter(Utils.GEOHASH_DEFAULT_PREC, Utils.GEOHASH_DEFAULT_MIN_POINT_COUNT);
        ServicesHelper.addLocationServiceInterface(instance);
        LocationManager locationManager = (LocationManager) getSystemService(Context.LOCATION_SERVICE);
        String token = intent != null ? intent.getStringExtra("token") : null;

        if (locationManager != null) {
            Log.d(TAG, "LocationManager is not null");
            ServicesHelper.getLocationService(this, value -> {
                Log.d(TAG, "[ServiceHelper]" + value);
                Log.d(TAG, String.valueOf(value.IsRunning()));
                startTracking(!value.IsRunning());
            });
        }

        if (reactApplicationContext != null) {
            this.eventEmitter = reactApplicationContext.getJSModule(
                    DeviceEventManagerModule.RCTDeviceEventEmitter.class
            );
        }

        startQueueProcessor();
        startBatchSizeUpdater();

        // Start gRPC notification service if not running
        try {
            assert reactApplicationContext != null;
            if (!isServiceRunning(reactApplicationContext, GrpcNotificationService.class)) {
                Intent grpcIntent = new Intent(reactApplicationContext, GrpcNotificationService.class);
                grpcIntent.putExtra(GrpcNotificationService.TOKEN_KEY, token);
                reactApplicationContext.startService(grpcIntent);
            }
        } catch (Exception e) {
            Log.e("GeoKalman", "Error starting Grpc Notification Service" + e);
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            this.startForeground(NOTIFICATION_ID, notification,
                    android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION);
        } else {
            this.startForeground(NOTIFICATION_ID, notification);
        }
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        stopLocationUpdates();
        ServicesHelper.disconnect(this);
        if (m_geoHashRTFilter != null) {
            m_geoHashRTFilter.stop();
        }
        stopQueueProcessor();
        shutdownExecutorSafely(apiExecutor);

        try {
            if (reactApplicationContext != null && isServiceRunning(reactApplicationContext, GrpcNotificationService.class)) {
                Log.d("GrpcNotificationService", "Stopping Grpc Notification Service");
                reactApplicationContext.stopService(new Intent(reactApplicationContext, GrpcNotificationService.class));
            }
        } catch (Exception e) {
            Log.i("GrpcNotificationService", "Error stopping Grpc Notification Service" + e);
        }
        instance = null;
        stopForeground(true);
        stopSelf();
    }

    // =========================================================================
    // App lifecycle: call these from your React Native module on AppState change
    // =========================================================================

    /**
     * Call when the app goes to background.
     * Clears all location queues and pauses the Kalman service sensors
     * to prevent unbounded queue growth and memory leaks.
     */
    public void onAppBackgrounded() {
        Log.d(TAG, "App backgrounded — clearing queues and pausing Kalman");

        // Clear the location queue to prevent stale data buildup
        locationQueue.clear();
        locationCount.set(0);

        // Pause sensor listeners in KalmanLocationService
        ServicesHelper.getLocationService(this, KalmanLocationService::pause);
    }

    /**
     * Call when the app comes back to foreground.
     * Clears any stale queued data and resumes Kalman service sensors.
     */
    public void onAppResumed() {
        Log.d(TAG, "App resumed — clearing stale data and resuming Kalman");

        // Clear any data that accumulated during the transition
        locationQueue.clear();
        locationCount.set(0);

        // Resume sensor listeners in KalmanLocationService
        ServicesHelper.getLocationService(this, KalmanLocationService::resume);
    }

    /**
     * Get the singleton instance (for the RN bridge module to call
     * onAppBackgrounded / onAppResumed).
     */
    public static GeoKalman getInstance() {
        return instance;
    }

    // =========================================================================

    private static void createNotificationChannel(Context context) {
        NotificationChannel serviceChannel = new NotificationChannel(
                CHANNEL_ID,
                "Getting location in background",
                NotificationManager.IMPORTANCE_DEFAULT);
        serviceChannel.setShowBadge(false);
        serviceChannel.enableLights(false);
        serviceChannel.setVibrationPattern(new long[]{0});
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        manager.createNotificationChannel(serviceChannel);
    }

    @SuppressLint("WrongConstant")
    private Notification createNotification() {
        Intent notificationIntent = new Intent(this, activityClassOpenfromNotification);
        PendingIntent pendingIntent = PendingIntent.getActivity(this, 0, notificationIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("On Duty")
                .setContentText("Listening to location changes in background")
                .setSmallIcon(R.drawable.ic_notif_launcher)
                .setContentIntent(pendingIntent)
                .setAutoCancel(false)
                .setCategory(NotificationCompat.CATEGORY_CALL)
                .setOngoing(true)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
                .setOnlyAlertOnce(true)
                .build();
    }

    private void startTracking(boolean start) {
        Log.d(TAG, String.valueOf(start));
        if (start) {
            m_geoHashRTFilter.stop();
            m_geoHashRTFilter.reset(this);
            ServicesHelper.getLocationService(this, value -> {
                Log.i(TAG, "Updating Settings");
                value.stop();
                Settings settings = new Settings(
                        Utils.ACCELEROMETER_DEFAULT_DEVIATION,
                        0,
                        1000,
                        100,
                        7,
                        2,
                        10,
                        this,
                        false,
                        false,
                        true,
                        Utils.DEFAULT_VEL_FACTOR,
                        Utils.DEFAULT_POS_FACTOR,
                        Settings.LocationProvider.FUSED,
                        true
                );
                value.reset(settings);
                value.start();
            });
        } else {
            ServicesHelper.getLocationService(this, KalmanLocationService::stop);
        }
    }

    @Override
    public void locationChanged(Location location) {
        if (m_geoHashRTFilter == null) {
            Log.w(TAG, "locationChanged called but geoHashRTFilter is null — skipping");
            return;
        }

        Log.v(TAG, "[RECEIVED LOCATION DATA]  " + location.toString());

        // Always emit the raw Kalman-filtered location to RN.
        // The geohash filter clusters points for batch API uploads and only
        // adds a new entry when the driver crosses a geohash cell boundary,
        // so using it for display causes stale/frozen coordinates between cells.
        if (eventEmitter != null) {
            WritableMap geo = Arguments.createMap();
            geo.putDouble("latitude", location.getLatitude());
            geo.putDouble("longitude", location.getLongitude());
            geo.putDouble("accuracy", location.getAccuracy());
            geo.putDouble("speed", location.getSpeed());
            geo.putDouble("distance", m_geoHashRTFilter.getDistanceGeoFiltered());
            geo.putDouble("bearing", location.getBearing());
            geo.putDouble("altitude", location.getAltitude());
            geo.putBoolean("isMoving", location.hasSpeed());
            geo.putDouble("timestamp", location.getTime());
            eventEmitter.emit("onGeoKalman", geo);
        }

        // Use the geohash-filtered point for the batch API queue so uploads
        // are deduplicated by cell (avoids sending the same coordinate twice).
        List<Location> latestFilteredLoc = m_geoHashRTFilter.getGeoFilteredTrack();
        Location forQueue = latestFilteredLoc.isEmpty()
                ? location
                : latestFilteredLoc.get(latestFilteredLoc.size() - 1);

        if (locationQueue.size() > MAX_QUEUE_SIZE) {
            Log.w(TAG, "Location queue overflow (" + locationQueue.size() + ") — clearing stale data");
            locationQueue.clear();
        }
        locationQueue.offer(new LocationData(forQueue));
        locationCount.incrementAndGet();

        Log.d(TAG, "Location accuracy: " + location.getAccuracy());

        // Persist to MMKV on a background thread — avoids blocking the callback thread.
        if (locationMmkv != null) {
            final double lat = location.getLatitude();
            final double lng = location.getLongitude();
            final double acc = location.getAccuracy();
            final double spd = location.getSpeed();
            final double dist = m_geoHashRTFilter.getDistanceGeoFiltered();
            final double brg = location.getBearing();
            final double alt = location.getAltitude();
            final boolean mov = location.hasSpeed();
            final long ts = location.getTime();
            ThreadUtils.runOnExecutor(() -> {
                try {
                    JSONObject locationData = new JSONObject();
                    locationData.put("latitude", lat);
                    locationData.put("longitude", lng);
                    locationData.put("accuracy", acc);
                    locationData.put("speed", spd);
                    locationData.put("distance", dist);
                    locationData.put("bearing", brg);
                    locationData.put("altitude", alt);
                    locationData.put("isMoving", mov);
                    locationData.put("timestamp", ts);
                    JSONObject wrapper = new JSONObject();
                    wrapper.put("data", locationData);
                    locationMmkv.putString("location", wrapper.toString());
                } catch (JSONException e) {
                    Log.e(TAG, "Failed to persist location to MMKV", e);
                }
            });
        }
    }

    @Override
    public void log2file(String format, Object... args) {
    }

    public static void startGeokalmanService(Class<? extends Activity> activityClass, Context context, String token) {
        activityClassOpenfromNotification = activityClass;
        createNotificationChannel(context);
        Intent intent = new Intent(context, GeoKalman.class);
        intent.putExtra("token", token);
        ContextCompat.startForegroundService(context, intent);
    }

    public static void stopGeokalmanService(Context context) {
        ServicesHelper.disconnect(context);
        Intent serviceIntent = new Intent(context, GeoKalman.class);
        context.stopService(serviceIntent);
    }

    private void stopLocationUpdates() {
        if (scheduler != null && !scheduler.isShutdown()) {
            scheduler.shutdown();
            // Await on a background thread — avoids blocking the main thread (onDestroy)
            final ScheduledExecutorService ref = scheduler;
            ThreadUtils.runOnExecutor(() -> {
                try {
                    if (!ref.awaitTermination(2, TimeUnit.SECONDS)) {
                        ref.shutdownNow();
                    }
                } catch (InterruptedException e) {
                    ref.shutdownNow();
                    Thread.currentThread().interrupt();
                }
            });
        }
    }

    private void locationUpdate(String json, int retryCount) {
        String vc = getVehicleCategories();
        String url = AppConfig.getLocationUpdateEndpoint();
        Log.d(TAG, "Location update triggered with json: " + vc + "url" + url);
        NetworkApiCalls.getInstance().postData(
            url,
            json, vc, BEARER_TOKEN,
            new NetworkApiCalls.ApiCallback() {
                @Override
                public void onSuccess(String response) {
                    Log.d("GeoKalman", "API call successful");
                }
                @Override
                public void onFailure(Throwable e) {
                    if (retryCount < MAX_RETRIES) {
                        long delay = RETRY_DELAY_MS * (1L << retryCount);
                        if (apiExecutor != null && !apiExecutor.isShutdown()) {
                            apiExecutor.schedule(() -> locationUpdate(json, retryCount + 1),
                                delay, TimeUnit.MILLISECONDS);
                        }
                    }
                }
            }
        );
    }

    private String getVehicleCategories() {
        if (mmkv == null) {
            return "Swift";
        }

        String vc = mmkv.getString("categories", null);

        if (vc == null) {
            return "Swift";
        }

        Log.i(TAG, "DRIVERs ELIGIBLE: vehicle categories " + vc);

        try {
            JsonObject jsonObject = JsonParser.parseString(vc).getAsJsonObject();
            JsonArray dataArray = jsonObject.getAsJsonArray("data");

            if (dataArray == null || dataArray.isEmpty()) {
                return "Swift";
            }

            List<String> categories = new ArrayList<>();
            for (JsonElement element : dataArray) {
                if (element.isJsonNull()) continue;
                categories.add(element.getAsString());
            }
            return TextUtils.join(",", categories);

        } catch (JsonSyntaxException e) {
            Log.e(TAG, "Invalid JSON format", e);
        } catch (Exception e) {
            Log.e(TAG, "Failed to parse vehicle categories", e);
        }

        return "Swift";
    }

    private void processBatch(List<LocationData> batch) {
        if (batch.isEmpty()) {
            return;
        }

        JSONArray locations = new JSONArray();
        for (LocationData data : batch) {
            locations.put(createLocationJsonArray(data.getLocation()));
        }

        if (locations.length() < 1) return;

        Log.d("GeoKalman", "Processing batch of " + locations.length() + " locations");

        if (apiExecutor != null && !apiExecutor.isShutdown()) {
            apiExecutor.execute(() -> locationUpdate(locations.toString(), 0));
        }
    }

    private void startQueueProcessor() {
        if (isRunning.get()) {
            Log.d(TAG, "Queue processor already running");
            return;
        }

        queueExecutor = Executors.newSingleThreadExecutor(r -> {
            Thread thread = new Thread(r, "LocationQueueProcessor");
            thread.setPriority(Thread.NORM_PRIORITY + 1);
            thread.setDaemon(false);
            thread.setUncaughtExceptionHandler((t, e) ->
                    Log.e("GeoKalman", "Uncaught exception in " + t.getName(), e));
            return thread;
        });
        apiExecutor = Executors.newScheduledThreadPool(2);
        isRunning.set(true);

        queueExecutor.execute(() -> {
            while (isRunning.get()) {
                try {
                    // Block until at least one location is available
                    LocationData firstItem = locationQueue.take();
                    List<LocationData> batch = new ArrayList<>();
                    batch.add(firstItem);

                    // Collect additional items within the timeout
                    long endTime = System.currentTimeMillis() + BATCH_TIMEOUT_MS;
                    while (batch.size() < currentBatchSize.get() && System.currentTimeMillis() < endTime) {
                        long remainingTime = endTime - System.currentTimeMillis();
                        if (remainingTime <= 0) break;
                        LocationData nextItem = locationQueue.poll(remainingTime, TimeUnit.MILLISECONDS);
                        if (nextItem != null) {
                            batch.add(nextItem);
                        } else {
                            break;
                        }
                    }

                    Log.i("GeoKalman", "Batch collected. Size: " + batch.size()
                            + ", Queue remaining: " + locationQueue.size());
                    processBatch(batch);

                } catch (InterruptedException e) {
                    Log.d("GeoKalman Queue", "Processor interrupted — shutting down");
                    Thread.currentThread().interrupt();
                    break;
                } catch (Exception e) {
                    Log.e("GeoKalman Queue", "Error processing batch", e);
                }
            }
        });
    }

    private void startBatchSizeUpdater() {
        batchSizeUpdaterFuture = scheduler.scheduleWithFixedDelay(() -> {
            long currentTime = System.currentTimeMillis();
            long timeElapsed = currentTime - lastUpdateTime.get();
            int locationsReceived = locationCount.getAndSet(0);

            if (locationsReceived > 0) {
                double arrivalRate = (double) locationsReceived / (timeElapsed / 1000.0);
                if (arrivalRate > 2) {
                    currentBatchSize.set(Math.min(MAX_BATCH_SIZE, currentBatchSize.get() + 1));
                } else if (arrivalRate < 0.5) {
                    currentBatchSize.set(Math.max(MIN_BATCH_SIZE, currentBatchSize.get() - 1));
                }
                Log.d("GeoKalman", "Locations received: " + locationsReceived
                        + ", Arrival rate: " + arrivalRate
                        + ", Batch size: " + currentBatchSize.get());
            } else if (currentBatchSize.get() > MIN_BATCH_SIZE) {
                currentBatchSize.set(MIN_BATCH_SIZE);
                Log.d("GeoKalman", "No locations received, reset batch size to " + currentBatchSize.get());
            }

            lastUpdateTime.set(currentTime);
        }, UPDATE_INTERVAL_MS, UPDATE_INTERVAL_MS, TimeUnit.MILLISECONDS);
    }

    public void stopQueueProcessor() {
        isRunning.set(false);

        // Drain remaining locations
        List<LocationData> remaining = new ArrayList<>();
        locationQueue.drainTo(remaining);
        if (!remaining.isEmpty()) {
            processBatch(remaining);
        }

        if (batchSizeUpdaterFuture != null) {
            batchSizeUpdaterFuture.cancel(true);
        }

        shutdownExecutorSafely(queueExecutor);
        shutdownExecutorSafely(apiExecutor);
    }

    private void shutdownExecutorSafely(ExecutorService executor) {
        if (executor != null && !executor.isShutdown()) {
            executor.shutdown();
            // Await on a background thread — avoids blocking the main thread (onDestroy)
            final ExecutorService ref = executor;
            ThreadUtils.runOnExecutor(() -> {
                try {
                    if (!ref.awaitTermination(2, TimeUnit.SECONDS)) {
                        ref.shutdownNow();
                    }
                } catch (InterruptedException e) {
                    ref.shutdownNow();
                    Thread.currentThread().interrupt();
                }
            });
        }
    }

    public boolean hasNetworkConnection(Context context) {
        ConnectivityManager connectivityManager = (ConnectivityManager)
                context.getSystemService(Context.CONNECTIVITY_SERVICE);
        android.net.Network network = connectivityManager.getActiveNetwork();
        if (network == null) return false;

        android.net.NetworkCapabilities capabilities = connectivityManager.getNetworkCapabilities(network);

        return capabilities != null && (
                capabilities.hasTransport(android.net.NetworkCapabilities.TRANSPORT_WIFI) ||
                        capabilities.hasTransport(android.net.NetworkCapabilities.TRANSPORT_CELLULAR) ||
                        capabilities.hasTransport(android.net.NetworkCapabilities.TRANSPORT_ETHERNET)
        );
    }

    private JSONObject createLocationJsonArray(Location location) {
        try {
            JSONObject latLng = new JSONObject();
            latLng.put("lat", location.getLatitude());
            latLng.put("lon", location.getLongitude());

            JSONObject locationObj = new JSONObject();
            locationObj.put("lat_lng", latLng);
            locationObj.put("speed", location.getSpeed());
            locationObj.put("accuracy", location.getAccuracy());
            locationObj.put("timestamp", Instant.now().toString());
            return locationObj;
        } catch (JSONException e) {
            Log.e("GeoKalman", "JSON creation error: " + e.getMessage());
            return null;
        }
    }

    //region ETA
    public static String findPositionInPolyline(double currLat, double currLng, int speed, String gpsPoints) {
        try {
            LatLng currentCoordinates = new LatLng(currLat, currLng);
            ArrayList<LatLng> polylinePath = new ArrayList<>();
            JSONArray coordinates = new JSONArray(gpsPoints);
            int polylineIndex;
            int remainingDistance;
            int etaSeconds;
            JSONObject result = new JSONObject();

            for (int i = coordinates.length() - 1; i >= 0; i--) {
                JSONObject coordinate = (JSONObject) coordinates.get(i);
                double lng = coordinate.getDouble("longitude");
                double lat = coordinate.getDouble("latitude");
                LatLng latLng = new LatLng(lat, lng);
                polylinePath.add(latLng);
            }
            if (polylinePath.isEmpty()) return "";
            polylineIndex = PolyUtil.locationIndexOnEdgeOrPath(currentCoordinates, polylinePath,
                    PolyUtil.isClosedPolygon(polylinePath), true, 30);

            if (polylineIndex == -1) {
                result.put("eta", 0);
                result.put("distance", 0);
                result.put("polylineCoordinates", coordinates);
                result.put("isInPolyline", false);
            } else if (polylineIndex == (polylinePath.size() - 2) || polylineIndex == (polylinePath.size() - 1)) {
                remainingDistance = (int) SphericalUtil.computeLength(polylinePath);
                etaSeconds = (int) Math.ceil((double) remainingDistance / speed);
                result.put("eta", etaSeconds);
                result.put("distance", remainingDistance);
                result.put("polylineCoordinates", coordinates);
                result.put("isInPolyline", true);
            } else if (polylineIndex == 0) {
                polylinePath.clear();
                result.put("eta", 0);
                result.put("distance", 0);
                result.put("polylineCoordinates", new JSONArray());
                result.put("isInPolyline", true);
            } else {
                polylinePath.subList(polylineIndex + 1, polylinePath.size()).clear();

                remainingDistance = (int) SphericalUtil.computeLength(polylinePath);
                etaSeconds = (int) Math.ceil((double) remainingDistance / speed);
                JSONArray coordinatesRemaining = new JSONArray();
                for (int i = polylinePath.size() - 1; i >= 0; i--) {
                    JSONObject coordinate = new JSONObject();
                    coordinate.put("latitude", polylinePath.get(i).latitude);
                    coordinate.put("longitude", polylinePath.get(i).longitude);
                    coordinatesRemaining.put(coordinate);
                }
                result.put("isInPolyline", true);
                result.put("eta", etaSeconds);
                result.put("distance", remainingDistance);
                result.put("polylineCoordinates", coordinatesRemaining);
            }
            return result.toString();

        } catch (Exception e) {
            Log.e("GeoKalman", "Error finding position in polyline: " + e.getMessage());
            return "";
        }
    }
    //endregion ETA

    private static class LocationData implements Comparable<LocationData> {
        private final Location location;
        private final long timestamp;

        public LocationData(Location location) {
            this.location = location;
            this.timestamp = location.getTime();
        }

        public Location getLocation() {
            return location;
        }

        @Override
        public int compareTo(LocationData other) {
            return Long.compare(this.timestamp, other.timestamp);
        }
    }

    public static Boolean isServiceRunning(Context context, Class<?> serviceClass) {
        final ActivityManager activityManager = (ActivityManager) context.getSystemService(Context.ACTIVITY_SERVICE);
        final List<ActivityManager.RunningServiceInfo> serviceInfos = activityManager.getRunningServices(Integer.MAX_VALUE);
        for (ActivityManager.RunningServiceInfo info : serviceInfos) {
            if (info.service.getClassName().equals(serviceClass.getName())) {
                return true;
            }
        }
        return false;
    }
}




// import android.annotation.SuppressLint;
// import android.app.Activity;
// import android.app.ActivityManager;
// import android.app.Notification;
// import android.app.NotificationChannel;
// import android.app.NotificationManager;
// import android.app.PendingIntent;
// import android.app.Service;
// import android.net.ConnectivityManager;
// import android.net.Network;
// import android.content.Context;
// import android.content.Intent;
// import android.content.SharedPreferences;
// import android.icu.text.SimpleDateFormat;
// import android.icu.util.TimeZone;
// import android.location.Location;
// import android.location.LocationManager;
// import android.os.Build;
// import android.os.Handler;
// import android.os.IBinder;
// import android.os.Looper;
// import android.os.Message;
// import android.text.TextUtils;
// import android.util.Log;

// import androidx.annotation.NonNull;
// import androidx.annotation.Nullable;
// import androidx.annotation.RequiresApi;
// import androidx.core.app.NotificationCompat;
// import androidx.core.content.ContextCompat;

// import com.facebook.react.bridge.Arguments;
// import com.facebook.react.bridge.ReactApplicationContext;
// import com.facebook.react.bridge.WritableMap;
// import com.facebook.react.modules.core.DeviceEventManagerModule;
// import com.google.android.gms.maps.model.LatLng;
// import com.google.gson.JsonArray;
// import com.google.gson.JsonElement;
// import com.google.gson.JsonObject;
// import com.google.gson.JsonParser;
// import com.google.gson.JsonSyntaxException;
// import com.google.maps.android.PolyUtil;
// import com.google.maps.android.SphericalUtil;
// import com.tencent.mmkv.MMKV;
// import com.transli.mobilitycaptain.common.utils.NetworkApiCalls;

// import org.json.JSONArray;
// import org.json.JSONException;
// import org.json.JSONObject;

// import java.time.Instant;
// import java.util.ArrayList;
// import java.util.List;
// import java.util.Locale;
// import java.util.Queue;
// import java.util.concurrent.ConcurrentLinkedQueue;
// import java.util.concurrent.Executors;
// import java.util.concurrent.PriorityBlockingQueue;
// import java.util.concurrent.ScheduledExecutorService;
// import java.util.concurrent.ExecutorService;
// import java.util.concurrent.TimeUnit;
// import java.util.concurrent.atomic.AtomicBoolean;
// import java.util.concurrent.atomic.AtomicInteger;
// import java.util.concurrent.atomic.AtomicLong;
// import java.util.concurrent.locks.ReentrantLock;

// import mad.location.manager.lib.Commons.Utils;
// import mad.location.manager.lib.Interfaces.ILogger;
// import mad.location.manager.lib.Interfaces.LocationServiceInterface;
// import mad.location.manager.lib.Services.ServicesHelper;
// import mad.location.manager.lib.Services.KalmanLocationService;
// import mad.location.manager.lib.Loggers.GeohashRTFilter;
// import mad.location.manager.lib.Services.Settings;


// public class GeoKalman extends Service implements ILogger, LocationServiceInterface {

//     public static String BEARER_TOKEN = "";

//     public static final String TAG = GeoKalman.class.getName();
//     private static final String CHANNEL_ID = "GeoNotificationChannel";
//     private static final int NOTIFICATION_ID = 1;
//     private static GeoKalman instance;
//     private static volatile MMKV mmkv;

//     private GeohashRTFilter m_geoHashRTFilter;

//     public  static Class<? extends Activity> activityClassOpenfromNotification;

//     private DeviceEventManagerModule.RCTDeviceEventEmitter eventEmitter = null;

//     private ReactApplicationContext reactApplicationContext;

//     private final ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(1);
//     private ExecutorService executorService;

//     long lastApiCall = 0;

//     SharedPreferences sharedPref;

//     // Test Thread currentLocationCalls //

//     // 2 seconds max wait time for a batch
//     private static final long BATCH_TIMEOUT_MS = 10000;

//     private ExecutorService queueExecutor;
//     private ScheduledExecutorService apiExecutor;
//     private final PriorityBlockingQueue<LocationData> locationQueue = new PriorityBlockingQueue<>();
//     // Controls the queue processor
//     private final AtomicBoolean isRunning = new AtomicBoolean(true);
//     private static final int MIN_BATCH_SIZE = 1;
//     private static final int MAX_BATCH_SIZE = 20;
//     private static final long UPDATE_INTERVAL_MS = 10000; // Update every 10 seconds
//     private final AtomicInteger currentBatchSize = new AtomicInteger(5); // Initial batch size
//     private final AtomicLong lastUpdateTime = new AtomicLong(System.currentTimeMillis());
//     private final AtomicInteger locationCount = new AtomicInteger(0);
//     private static final int MAX_RETRIES = 5;
//     //Initial delay in second
//     private static final long RETRY_DELAY_MS = 1000;

//     // Batch processing lock
//     private final ReentrantLock batchProcessingLock = new ReentrantLock();
//     private final AtomicBoolean isBatchProcessing = new AtomicBoolean(false);

//     @Nullable
//     private LocationQueue msgLocationQueue;


//     public static boolean isGeokalmanServiceRunning(ReactApplicationContext reactApplicationContext) {
//         return GeoKalman.isServiceRunning(reactApplicationContext, GeoKalman.class);
//     }
//     // End Test Thread currentLocationCalls //

//     @Nullable
//     @Override
//     public IBinder onBind(Intent intent) {
//         return null;
//     }

//     @Override
//     public void onCreate() {
//         super.onCreate();
//         instance = this;sharedPref = getApplicationContext().getSharedPreferences(
//                 getApplicationContext().getString(R.string.sit_we_go_shared_preferences),
//                 Context.MODE_PRIVATE
//         );
//         BEARER_TOKEN = sharedPref.getString("token", "");
//         reactApplicationContext = GeoKalmanModule.getReactAppContext();
//         executorService = createExecutorService();
//         queueExecutor = createExecutorService();
//         queueExecutor.shutdown();
//         executorService.shutdown();
//         mmkv = MMKV.mmkvWithID("VEHICLE_CATEGORY_DATA", MMKV.SINGLE_PROCESS_MODE);
//         // Initialize the location queue
//         initLocationQueue();
//     }

//     @SuppressLint("ForegroundServiceType")
//     @Override
//     public int onStartCommand(Intent intent, int flags, int startId) {
//         //Set BEARER_TOKEN from shared preferences
//         sharedPref = getApplicationContext().getSharedPreferences(
//                 getApplicationContext().getString(R.string.sit_we_go_shared_preferences),
//                 Context.MODE_PRIVATE
//         );
//         BEARER_TOKEN = sharedPref.getString("token", "");
//         Notification notification = createNotification();
//         m_geoHashRTFilter = new GeohashRTFilter(Utils.GEOHASH_DEFAULT_PREC, Utils.GEOHASH_DEFAULT_MIN_POINT_COUNT);
//         ServicesHelper.addLocationServiceInterface(instance);
//         LocationManager locationManager = (LocationManager) getSystemService(Context.LOCATION_SERVICE);
//         String token = intent.getStringExtra("token");

//         if (locationManager != null) {
//             Log.d(TAG, "LocationManager is not null");
//             ServicesHelper.getLocationService(this, value -> {
//                 Log.d(TAG, "[ServiceHelper]" + value);
//                 Log.d(TAG, String.valueOf(value.IsRunning()));
//                 startTracking(!value.IsRunning());
//             });
//         }

//         if (reactApplicationContext != null){
//             this.eventEmitter = reactApplicationContext.getJSModule(
//                     DeviceEventManagerModule.RCTDeviceEventEmitter.class
//             );
//         }
//         startQueueProcessor();
//         startBatchSizeUpdater();
//         // TODO do some initialization.... e.g startDistanceCalculation();

//         // TODO do check whether Grpc is running
//         try {
//             assert reactApplicationContext != null;
//             if (!isServiceRunning(reactApplicationContext, GrpcNotificationService.class)){
//                 Intent grpcIntent = new Intent(reactApplicationContext, GrpcNotificationService.class);
//                 grpcIntent.putExtra(GrpcNotificationService.TOKEN_KEY, token);
//                 reactApplicationContext.startService(grpcIntent);
//             }
//         } catch (Exception e) {
//             Log.e("GeoKalman", "Error starting Grpc Notification Service" + e);
//         }

//         this.startForeground(NOTIFICATION_ID, notification);
//         return START_STICKY;
//     }

//     @Override
//     public void onDestroy() {
//         super.onDestroy();
//         stopLocationUpdates();
//         ServicesHelper.getLocationService(this, KalmanLocationService::stop);
//         m_geoHashRTFilter.stop();
//         if (executorService != null) executorService.shutdown();
//         stopQueueProcessor();
//         shutdownExecutorSafely();
//         try {
//             if (isServiceRunning(reactApplicationContext, GrpcNotificationService.class)){
//                 Log.d("GrpcNotificationService", "Stopping Grpc Notification Service");
//                 reactApplicationContext.stopService(new Intent(reactApplicationContext, GrpcNotificationService.class));
//             }
//         } catch (Exception e) {
//             Log.i("GrpcNotificationService", "Error stopping Grpc Notification Service" + e);
//         }
//         instance = null;
//         stopForeground(true);
//         stopSelf();
//     }

//     private static void createNotificationChannel(Context context) {
//         NotificationChannel serviceChannel = new NotificationChannel(
//                 CHANNEL_ID,
//                 "Getting location in background",
//                 NotificationManager.IMPORTANCE_DEFAULT);
//         serviceChannel.setShowBadge(false);
//         serviceChannel.enableLights(false);
//         serviceChannel.setVibrationPattern(new long[]{0});
//         NotificationManager manager = context.getSystemService(NotificationManager.class);
//         manager.createNotificationChannel(serviceChannel);
//     }

//     @SuppressLint("WrongConstant")
//     private Notification createNotification() {
//         Intent notificationIntent = new Intent(this, activityClassOpenfromNotification);
//         PendingIntent pendingIntent = PendingIntent.getActivity(this, 0, notificationIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
//         return new NotificationCompat.Builder(this, CHANNEL_ID)
//                 .setContentTitle("On Duty")
//                 .setContentText("Listening to location changes in background")
//                 .setSmallIcon(R.drawable.ic_notif_launcher)
//                 .setContentIntent(pendingIntent)
//                 .setAutoCancel(false)
//                 .setCategory(NotificationCompat.CATEGORY_CALL)
//                 .setOngoing(true)
//                 .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
//                 .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
//                 .setOnlyAlertOnce(true)
//                 .build();
//     }


//     private void startTracking(boolean start) {
//         Log.d(TAG, String.valueOf(start));
//         if (start) {
//             m_geoHashRTFilter.stop();
//             m_geoHashRTFilter.reset(this);
//             ServicesHelper.getLocationService(this, value -> {
//                 Log.i("[UPDATING GEOKALMN SETTINGS]", "Updating Settings");
//                 value.stop();
//                 Settings settings = new Settings(
//                         Utils.ACCELEROMETER_DEFAULT_DEVIATION,
//                         0,
//                         1000,
//                         100,
//                         7,
//                         2,
//                         10,
//                         this,
//                         false,
//                         false,
//                         true,
//                         Utils.DEFAULT_VEL_FACTOR,
//                         Utils.DEFAULT_POS_FACTOR,
//                         Settings.LocationProvider.FUSED,
//                         false
//                 );
//                 value.reset(settings);
//                 value.start();
//             });

//         } else {
//             ServicesHelper.getLocationService(this, KalmanLocationService::stop);
//         }
//     }


//     @Override
//     public void locationChanged(Location location) {
//         assert m_geoHashRTFilter != null;
//         List<Location> latestFilteredLoc = m_geoHashRTFilter.getGeoFilteredTrack();
//         Location latestFiltered;

//         if (!latestFilteredLoc.isEmpty()) {
//             latestFiltered = latestFilteredLoc.get(latestFilteredLoc.size() - 1);
//         } else {
//             latestFiltered = location;
//         }
//         assert latestFiltered != null;

//         LocationData latestFilteredData = new LocationData(latestFiltered);
//         if (msgLocationQueue != null) msgLocationQueue.enqueueLocation(latestFilteredData);
//         locationQueue.offer(latestFilteredData);
//         locationCount.incrementAndGet();
//         Log.d("Location Accuracy", "Location Accuracy"+ latestFiltered.getAccuracy());
//         if (eventEmitter != null){
//             WritableMap geo = Arguments.createMap();
//             geo.putDouble("latitude", latestFiltered.getLatitude());
//             geo.putDouble("longitude", latestFiltered.getLongitude());
//             geo.putDouble("accuracy", latestFiltered.getAccuracy());
//             geo.putDouble("speed", latestFiltered.getSpeed());
//             geo.putDouble("distance", m_geoHashRTFilter.getDistanceGeoFiltered());
//             geo.putDouble("bearing", latestFiltered.getBearing());
//             geo.putDouble("altitude", latestFiltered.getAltitude());
//             geo.putBoolean("isMoving", latestFiltered.hasSpeed());
//             geo.putDouble("timestamp", latestFiltered.getTime());
//             eventEmitter.emit("onGeoKalman", geo);
//         }
//     }

//     /**
//      * Initialize the location queue
//      */
//     private void initLocationQueue(){
//         msgLocationQueue = new LocationQueue(Looper.getMainLooper());
//     }

//     @Override
//     public void log2file(String format, Object... args) {}

//     public static void startGeokalmanService(Class<? extends Activity> activityClass, Context context, String token) {
//         activityClassOpenfromNotification = activityClass;
//         createNotificationChannel(context);
//         Intent intent = new Intent(context, GeoKalman.class);
//         intent.putExtra("token", token);
//         ContextCompat.startForegroundService(context, intent);
//     }
//     public static void stopGeokalmanService(Context context) {
//         Intent serviceIntent = new Intent(context, GeoKalman.class);
//         context.stopService(serviceIntent);
//     }

//     private void stopLocationUpdates() {
//         scheduler.shutdown();
//         try {
//             if (!scheduler.awaitTermination(2, TimeUnit.SECONDS)) {
//                 scheduler.shutdownNow(); // Force shutdown if tasks don't terminate
//             }
//             System.out.println("Location updates stopped.");
//         } catch (InterruptedException e) {
//             Thread.currentThread().interrupt();
//             System.out.println("Location updates stopped.");
//         } finally {
//             scheduler.shutdownNow();
//             Thread.currentThread().interrupt();
//         }
//     }

//     private boolean canCallApi(boolean isShutdown) {
//         long currentTime = System.currentTimeMillis();
//         long elapsedTime = currentTime - lastApiCall;
//         if (isShutdown && elapsedTime >= 2000 && hasNetworkConnection(getApplicationContext())){
//             lastApiCall = currentTime;
//             return true;
//         }
//         return false;
//     }

//     private void locationUpdate(String json, int retryCount) {
// //        String vc = getVehicleCategories();
// //        Log.d(TAG, "Location update triggered with json: " + json);
// //        Log.v(TAG, "Vehicle Eligible Categories: " + vc);
// //        NetworkApiCalls.getInstance().postData(
// //                "https://nymphaeaceous-viscometrically-freeda.ngrok-free.dev/update-location-coordinates",
// //                json,
// //                vc,
// //                BEARER_TOKEN,
// //                new NetworkApiCalls.ApiCallback() {
// //                    @Override
// //                    public void onSuccess(String response) {
// //                        Log.d("GeoKalman", "API call successful");
// //                    }
// //                    @Override
// //                    public void onFailure(Throwable e) {
// //                        Log.d("GeoKalman", "API call failed", e);
// //                        if (retryCount < MAX_RETRIES) {
// //                            // Exponential backoff: 1s, 2s, 4s
// //                            long delay = RETRY_DELAY_MS * (1L << retryCount);
// //                            Log.w("GeoKalman API", "Error sending batch, retrying in " + delay + "ms. Attempt " + (retryCount + 1));
// //                            try {
// //                                if (apiExecutor == null || apiExecutor.isShutdown()) {
// //                                    Log.e("GeoKalman API", "apiExecutor is unavailable, cannot schedule retry");
// //                                    return;
// //                                }
// //                                apiExecutor.schedule(() -> locationUpdate(json, retryCount + 1), delay, TimeUnit.MILLISECONDS);
// //                            } catch ( Exception ex) {
// //                                Log.e("GeoKalman API", "Error scheduling retry", ex);
// //                            }
// //                        } else {
// //                            Log.e("GeoKalman API", "Failed to send batch after " + MAX_RETRIES + " retries", e);
// //                        }
// //                    }
// //                }
// //        );
//     }

//     /**
//      *
//      * @return String vehicle categories (comma separated)
//      */
//     private String getVehicleCategories() {
//         if (mmkv == null) {
//             return "Swift";
//         }

//         String vc = mmkv.getString("categories", null);

//         if (vc == null) {
//             return "Swift";
//         }

//         Log.i(TAG, "DRIVERs ELIGIBLE: vehicle categories " + vc);

//         try {
//             JsonObject jsonObject = JsonParser.parseString(vc).getAsJsonObject();
//             JsonArray dataArray = jsonObject.getAsJsonArray("data");

//             if (dataArray == null || dataArray.isEmpty()) {
//                 return "Swift";
//             }

//             List<String> categories = new ArrayList<>();

//             for (JsonElement element : dataArray) {
//                 categories.add(element.getAsString());
//             }

//             return TextUtils.join(",", categories);

//         } catch (JsonSyntaxException e) {
//             Log.e(TAG, "Invalid JSON format", e);
//         } catch (Exception e) {
//             Log.e(TAG, "Failed to parse vehicle categories", e);
//         }

//         return "Swift";
//     }

//     private void processBatch(List<LocationData> batch) {
//         if (batch.isEmpty()) {
//             Log.d("GeoKalman", "No locations to process in this batch");
//             return;
//         }

//         JSONArray locations = new JSONArray();

//         for (LocationData data : batch) {
//             locations.put(createLocationJsonArray(data.getLocation()));
//         }

//         if (locations.length() < 1) return;

//         Log.d("GeoKalman", "Processing batch of " + locations.length() + " locations");

//         apiExecutor.execute(() -> locationUpdate(locations.toString(), 0));
//     }

//     private void startQueueProcessor() {
//         try {
//             if (canCallApi(isServiceRunning(this, GeoKalman.class)) && queueExecutor.isShutdown()) {
//                 queueExecutor = createExecutorService();
//                 apiExecutor = Executors.newScheduledThreadPool(2);
//             }
//             queueExecutor.execute(() -> {
//                 while (isRunning.get()) {
//                     try {
//                         List<LocationData> batch = new ArrayList<>();
//                         LocationData firstItem = locationQueue.take();
//                         batch.add(firstItem);

//                         Log.i(TAG, "Batch Collected. Size: " + batch.size());
//                         // Collect additional items within the timeout
//                         long endTime = System.currentTimeMillis() + BATCH_TIMEOUT_MS;
//                         while (batch.size() < currentBatchSize.get() && System.currentTimeMillis() < endTime) {
//                             long remainingTime = endTime - System.currentTimeMillis();
//                             if (remainingTime <= 0) break;
//                             LocationData nextItem = locationQueue.poll(remainingTime, TimeUnit.MILLISECONDS);
//                             if (nextItem != null) {
//                                 batch.add(nextItem);
//                             } else {
//                                 break; // Timeout reached
//                             }
//                         }

//                         Log.i("GeoKalman", "Batch collected. Size: " + batch.size() + ", Queue size: " + locationQueue.size());
//                         processBatch(batch);

//                     } catch (InterruptedException e) {
//                         Log.e("GeoKalman Queue", "Processor interrupted", e);
//                         Thread.currentThread().interrupt();
//                         break;
//                     } catch (Exception e) {
//                         Log.e("GeoKalman Queue", "Error processing batch", e);
//                     }
//                 }
//             });
//             isRunning.set(true);
//         } catch (Exception e) {
//             Log.e("GeoKalman Queue", "Error starting queue processor", e);
//             e.printStackTrace();
//         }

//     }

//     private void startBatchSizeUpdater() {
//         scheduler.scheduleWithFixedDelay(() -> {
//             long currentTime = System.currentTimeMillis();
//             long timeElapsed = currentTime - lastUpdateTime.get();
//             int locationsReceived = locationCount.getAndSet(0);

//             if (msgLocationQueue != null) msgLocationQueue.triggerBatchProcessing();

//             if (locationsReceived > 0) {
//                 double arrivalRate = (double) locationsReceived / (timeElapsed / 1000.0);
//                 if (arrivalRate > 2) {
//                     currentBatchSize.set(Math.min(MAX_BATCH_SIZE, currentBatchSize.get() + 1));
//                 } else if (arrivalRate < 0.5) {
//                     currentBatchSize.set(Math.max(MIN_BATCH_SIZE, currentBatchSize.get() - 1));
//                 }
//                 Log.d("GeoKalman", "Locations received: " + locationsReceived + ", Arrival rate: " + arrivalRate +
//                         ", Batch size: " + currentBatchSize.get());
//             } else if (currentBatchSize.get() == MIN_BATCH_SIZE) {
//                 currentBatchSize.set(1); // Reset
//                 Log.d("GeoKalman", "No locations received, reset batch size to " + currentBatchSize.get());
//             }

//             lastUpdateTime.set(currentTime);
//         }, UPDATE_INTERVAL_MS, UPDATE_INTERVAL_MS, TimeUnit.MILLISECONDS);
//     }

//     public void stopQueueProcessor() {
//         isRunning.set(false);
//         // Drain remaining locations
//         List<LocationData> remaining = new ArrayList<>();
//         locationQueue.drainTo(remaining);
//         if (!remaining.isEmpty()) {
//             processBatch(remaining);
//         }
//         try {
//             if (!queueExecutor.awaitTermination(5, TimeUnit.SECONDS)) {
//                 queueExecutor.shutdownNow();
//             }
//             if (!apiExecutor.awaitTermination(5, TimeUnit.SECONDS)) {
//                 apiExecutor.shutdownNow();
//             }
//         } catch (InterruptedException e) {
//             Log.e("GeoKalman", "Error during shutdown", e);
//             queueExecutor.shutdownNow();
//             apiExecutor.shutdownNow();
//             Thread.currentThread().interrupt();
//         }
//     }
//     private ExecutorService createExecutorService() {
//         return Executors.newSingleThreadExecutor(r -> {
//             Thread thread = new Thread(r, "LocationApiThread");
//             thread.setPriority(Thread.NORM_PRIORITY + 1);
//             thread.setDaemon(false);
//             thread.setUncaughtExceptionHandler((t, e) -> Log.e("GeoKalman", "ExecutorService LocationApiThread Uncaught exception in " + t.getName(), e));
//             return thread;
//         });
//     }

//     public static Boolean isServiceRunning(Context context, Class<?> serviceClass){
//         final ActivityManager activityManager = (ActivityManager) context.getSystemService(Context.ACTIVITY_SERVICE);
//         final List<ActivityManager.RunningServiceInfo> serviceInfos = activityManager.getRunningServices(Integer.MAX_VALUE);
//         for (ActivityManager.RunningServiceInfo info : serviceInfos) {
//             if (info.service.getClassName().equals(serviceClass.getName())) {
//                 return true;
//             }
//         }
//         return false;
//     }

//     private void shutdownExecutorSafely() {
//         if (executorService != null && !executorService.isShutdown()) {
//             try {
//                 executorService.shutdown();
//                 if (!executorService.awaitTermination(2, TimeUnit.SECONDS)) {
//                     executorService.shutdownNow();
//                 }
//             } catch (InterruptedException e) {
//                 executorService.shutdownNow();
//                 Thread.currentThread().interrupt();
//             }
//         }
//     }

//     /**
//      * Check if device has network connection
//      * @param context context
//      * @return true if device has network connection
//      */
//     public boolean hasNetworkConnection(Context context) {
//         ConnectivityManager connectivityManager = (ConnectivityManager)
//                 context.getSystemService(Context.CONNECTIVITY_SERVICE);
//         android.net.Network network = connectivityManager.getActiveNetwork();
//         if (network == null) return false;

//         android.net.NetworkCapabilities capabilities = connectivityManager.getNetworkCapabilities(network);

//         return capabilities !=null && (
//                 capabilities.hasTransport(android.net.NetworkCapabilities.TRANSPORT_WIFI) ||
//                         capabilities.hasTransport(android.net.NetworkCapabilities.TRANSPORT_CELLULAR) ||
//                         capabilities.hasTransport(android.net.NetworkCapabilities.TRANSPORT_ETHERNET)
//                 );
//     }


//     private JSONObject createLocationJsonArray(Location location) {
//         try {
//             // Create nested lat_lng object
//             JSONObject latLng = new JSONObject();
//             latLng.put("lat", location.getLatitude());
//             latLng.put("lon", location.getLongitude());

//             // Create main location object
//             JSONObject locationObj = new JSONObject();
//             locationObj.put("lat_lng", latLng);
//             locationObj.put("speed", location.getSpeed());
//             locationObj.put("accuracy", location.getAccuracy());
//             if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
//                 locationObj.put("timestamp", Instant.now().toString());
//             } else {
//                 //Timestamp for older Android
//                 SimpleDateFormat isoFormat = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.getDefault());
//                 isoFormat.setTimeZone(TimeZone.getTimeZone("UTC"));
//                 String timestamp = isoFormat.format(location.getTime());
//                 locationObj.put("timestamp", timestamp);
//             }

//             return locationObj;
//         } catch (JSONException e) {
//             Log.e("GeoKalman", "JSON creation error: " + e.getMessage());
//             return null;
//         }
//     }

//     //region ETA

//     public static String findPositionInPolyline(double currLat, double currLng, int speed, String gpsPoints){
//         try {
//             LatLng currentCoordinates = new LatLng(currLat, currLng);
//             ArrayList<LatLng> polylinePath = new ArrayList<>();
//             JSONArray coordinates = new JSONArray(gpsPoints);
//             int polylineIndex;
//             int remainingDistance;
//             int etaSeconds;
//             JSONObject result = new JSONObject();

//             for (int i = coordinates.length() - 1; i >= 0; i--) {
//                 JSONObject coordinate = (JSONObject) coordinates.get(i);
//                 double lng = coordinate.getDouble("longitude");
//                 double lat = coordinate.getDouble("latitude");
//                 LatLng latLng = new LatLng(lat, lng);
//                 polylinePath.add(latLng);
//             }
//             if (polylinePath.isEmpty()) return "";
//             polylineIndex = PolyUtil.locationIndexOnEdgeOrPath(currentCoordinates, polylinePath, PolyUtil.isClosedPolygon(polylinePath), true, 30);

//             if (polylineIndex == -1){
//                 result.put("eta", 0);
//                 result.put("distance", 0);
//                 result.put("polylineCoordinates", coordinates);
//                 result.put("isInPolyline", false);
//             } else if (polylineIndex == (polylinePath.size() - 2) || polylineIndex == (polylinePath.size() - 1)){
//                 Log.d("GeoKalman", "fist isInPolylinePath check");
//                 remainingDistance = (int) SphericalUtil.computeLength(polylinePath);
//                 etaSeconds = (speed > 0) ? (int) Math.ceil((double) remainingDistance / speed / 60) : -1;
//                 result.put("eta", etaSeconds);
//                 result.put("distance", remainingDistance);
//                 result.put("polylineCoordinates", coordinates);
//                 result.put("isInPolyline", true);
//             } else if (polylineIndex == 0){
//                 Log.d("GeoKalman", "second isInPolylinePath check");
//                 polylinePath.clear();
//                 result.put("eta", 0);
//                 result.put("distance", 0);
//                 result.put("polylineCoordinates", new JSONArray());
//                 result.put("isInPolyline", true);
//             } else {
//                 Log.w("GeoKalman", "Size Before Removal" + polylinePath.size());
//                 List<LatLng> removedItems = new ArrayList<>(polylinePath.subList(polylineIndex + 1, polylinePath.size()));
//                 Log.d("GeoKalman", "Removed Items Size:" + removedItems.size());
//                 polylinePath.removeAll(removedItems);

//                 Log.e("GeoKalman", "Polyline Size After Removal:" + polylinePath.size());
//                 remainingDistance = (int) SphericalUtil.computeLength(polylinePath);
//                 etaSeconds = (speed > 0) ? (int) Math.ceil((double) remainingDistance / speed / 60) : -1;
//                 JSONArray coordinatesRemaining = new JSONArray();
//                 for (int i = polylinePath.size() - 1; i >= 0; i--) {
//                     JSONObject coordinate = new JSONObject();
//                     coordinate.put("latitude", polylinePath.get(i).latitude);
//                     coordinate.put("longitude", polylinePath.get(i).longitude);
//                     coordinatesRemaining.put(coordinate);
//                 }
//                 result.put("isInPolyline", true);
//                 result.put("eta", etaSeconds);
//                 result.put("distance", remainingDistance);
//                 result.put("polylineCoordinates", coordinatesRemaining);
//             }
//             return result.toString();

//         } catch (Exception e) {
//             Log.e("GeoKalman", "Error finding position in polyline: " + e.getMessage());
//             return e.getMessage();
//         }
//     }
//     //end region ETA

//     private static class LocationData implements Comparable<LocationData> {
//         private final Location location;
//         private final long timestamp;

//         public LocationData(Location location) {
//             this.location = location;
//             this.timestamp = location.getTime();
//         }

//         public Location getLocation() {
//             return location;
//         }

//         @Override
//         public int compareTo(LocationData other) {
//             return Long.compare(this.timestamp, other.timestamp);
//         }
//     }



//     private static final int LOCATION_UPDATE = 1;
//     private static final int PROCESS_BATCH_LOCATION_UPDATE = 2;
//     private static final int SAVE_TO_CACHE_FLUSH = 3;

//     /**
//      * Queue for location updates
//      * That provides a thread safe way to store and process location updates
//      *
//      */
//     class LocationQueue {
//         private final Queue<LocationData> queue = new ConcurrentLinkedQueue<>();
//         private final ExecutorService executorService = Executors.newSingleThreadScheduledExecutor();
//         private final Handler handler;


//         /**
//          * Enqueue a location update
//          * @param locationData location data
//          */
//         void enqueueLocation(LocationData locationData) {
//             Message msg = handler.obtainMessage(LOCATION_UPDATE, locationData);
//             handler.sendMessage(msg);
//         }

//         void triggerBatchProcessing() {
//             // Send an empty message
//             handler.sendEmptyMessage(PROCESS_BATCH_LOCATION_UPDATE);
//         }

//         LocationQueue(Looper looper) {
//             this.handler = new Handler(looper){
//                 @Override
//                 public void handleMessage(@NonNull Message msg) {
//                     switch (msg.what){
//                         case LOCATION_UPDATE:
//                             LocationData locationData = (LocationData) msg.obj;
//                             queue.add(locationData);
//                             break;
//                         case PROCESS_BATCH_LOCATION_UPDATE:
//                             processBatchLocationUpdate();
//                             break;
//                         case SAVE_TO_CACHE_FLUSH:
//                             saveToCache();
//                             break;
//                     }
//                 }

//             };
//         }


//         private void processBatchLocationUpdate() {
//             if (queue.isEmpty() || !hasNetworkConnection(getApplicationContext())) return;

//             if (batchProcessingLock.tryLock()){
//                 try {
//                     isBatchProcessing.set(true);

//                     if (queue.size() >= MAX_BATCH_SIZE) {
//                         int locationsToProcess = Math.min(MAX_BATCH_SIZE, queue.size());

//                         List<LocationData> batch = locationBatchlist(locationsToProcess);

//                         if (!batch.isEmpty()){
//                             Log.d("GeoKalmanBatchProcessing", "Processing batch of " + batch.size() + " locations");
//                         } else {
//                             isBatchProcessing.set(false);
//                         }

//                     } else {
//                         isBatchProcessing.set(false);
//                     }
//                 } finally {
//                     batchProcessingLock.unlock();
//                 }
//             }
//         }

//         private void saveToCache() {
//         }


//         List<LocationData> locationBatchlist(int maxBatchSize) {
//             List<LocationData> batch = new ArrayList<>();
//             int size = Math.min(queue.size(), maxBatchSize);

//             for (int i = 0; i < size; i++) {
//                 LocationData locationData = queue.poll();
//                 if (locationData != null) batch.add(locationData);
//             }
//             return batch;
//         }
//     }

// }
