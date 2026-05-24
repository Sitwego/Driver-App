package mad.location.manager.lib.Services;
import android.Manifest;
import android.annotation.SuppressLint;
import android.app.ActivityManager;
import android.app.Service;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.hardware.GeomagneticField;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.location.Location;
import android.location.LocationManager;
import android.os.Binder;
import android.os.HandlerThread;
import android.os.IBinder;
import android.os.Build;
import android.os.PowerManager;

import androidx.annotation.Nullable;
import androidx.core.app.ActivityCompat;

import android.util.Log;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Queue;
import java.util.concurrent.Executors;
import java.util.concurrent.PriorityBlockingQueue;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;

import mad.location.manager.lib.Commons.Coordinates;
import mad.location.manager.lib.Commons.GeoPoint;
import mad.location.manager.lib.Commons.SensorGpsDataItem;
import mad.location.manager.lib.Commons.Utils;
import mad.location.manager.lib.Filters.GPSAccKalmanFilter;
import mad.location.manager.lib.Interfaces.LocationServiceInterface;
import mad.location.manager.lib.Interfaces.LocationServiceStatusInterface;
import mad.location.manager.lib.Loggers.GeohashRTFilter;
import mad.location.manager.lib.locationProviders.GPSCallback;
import mad.location.manager.lib.locationProviders.GPSLocationProvider;
import mad.location.manager.lib.locationProviders.FusedLocationProvider;
import mad.location.manager.lib.locationProviders.LocationProviderCallback;

public class KalmanLocationService extends Service
        implements SensorEventListener, GPSCallback, LocationProviderCallback {

    public static final String TAG = "mlm:Service";

    /**
     * Maximum number of items allowed in the sensor data queue.
     * Prevents unbounded memory growth when the app is backgrounded
     * and sensor events continue to fire.
     */
    private static final int MAX_QUEUE_SIZE = 100;

    //region Location service implementation
    protected List<LocationServiceInterface> m_locationServiceInterfaces;
    protected List<LocationServiceStatusInterface> m_locationServiceStatusInterfaces;

    protected Location m_lastLocation;

    protected ServiceStatus m_serviceStatus = ServiceStatus.SERVICE_STOPPED;

    /**
     * Whether the service is paused (app is in background).
     * When paused, sensor listeners are unregistered and periodic
     * location updates are stopped to prevent queue buildup.
     */
    private volatile boolean m_isPaused = false;

    @Override
    public void locationAvailabilityChanged(boolean isLocationAvailable) {
        m_gpsEnabled = isLocationAvailable;
        for (LocationServiceStatusInterface ilss : m_locationServiceStatusInterfaces) {
            ilss.GPSEnabledChanged(m_gpsEnabled);
        }
    }

    @Override
    public void onLocationAvailable(Location location) {
        processLocation(location);
    }

    @Override
    public void gpsSatelliteCountChanged(int noOfSatellites) {
        if (noOfSatellites != 0) {
            m_activeSatellites = noOfSatellites;
            for (LocationServiceStatusInterface locationServiceStatusInterface : m_locationServiceStatusInterfaces) {
                locationServiceStatusInterface.GPSStatusChanged(m_activeSatellites);
            }
        }
    }

    public enum ServiceStatus {
        PERMISSION_DENIED(0),
        SERVICE_STOPPED(1),
        SERVICE_STARTED(2),
        HAS_LOCATION(3),
        SERVICE_PAUSED(4);

        final int value;

        ServiceStatus(int value) {
            this.value = value;
        }

        public int getValue() {
            return value;
        }
    }

    public boolean isSensorsEnabled() {
        return m_sensorsEnabled;
    }

    public boolean IsRunning() {
        return m_serviceStatus != ServiceStatus.SERVICE_STOPPED
                && m_serviceStatus != ServiceStatus.SERVICE_PAUSED
                && m_sensorsEnabled;
    }

    public void addInterface(LocationServiceInterface locationServiceInterface) {
        if (m_locationServiceInterfaces.add(locationServiceInterface) && m_lastLocation != null) {
            locationServiceInterface.locationChanged(m_lastLocation);
        }
    }

    public void addInterfaces(List<LocationServiceInterface> locationServiceInterfaces) {
        if (m_locationServiceInterfaces.addAll(locationServiceInterfaces) && m_lastLocation != null) {
            for (LocationServiceInterface locationServiceInterface : locationServiceInterfaces) {
                locationServiceInterface.locationChanged(m_lastLocation);
            }
        }
    }

    public void removeInterface(LocationServiceInterface locationServiceInterface) {
        m_locationServiceInterfaces.remove(locationServiceInterface);
    }

    public void removeStatusInterface(LocationServiceStatusInterface locationServiceStatusInterface) {
        m_locationServiceStatusInterfaces.remove(locationServiceStatusInterface);
    }

    public void addStatusInterface(LocationServiceStatusInterface locationServiceStatusInterface) {
        if (m_locationServiceStatusInterfaces.add(locationServiceStatusInterface)) {
            locationServiceStatusInterface.serviceStatusChanged(m_serviceStatus);
            locationServiceStatusInterface.GPSStatusChanged(m_activeSatellites);
            locationServiceStatusInterface.GPSEnabledChanged(m_gpsEnabled);
            locationServiceStatusInterface.lastLocationAccuracyChanged(m_lastLocationAccuracy);
        }
    }

    public void addStatusInterfaces(List<LocationServiceStatusInterface> locationServiceStatusInterfaces) {
        if (m_locationServiceStatusInterfaces.addAll(locationServiceStatusInterfaces)) {
            for (LocationServiceStatusInterface locationServiceStatusInterface : locationServiceStatusInterfaces) {
                locationServiceStatusInterface.serviceStatusChanged(m_serviceStatus);
                locationServiceStatusInterface.GPSStatusChanged(m_activeSatellites);
                locationServiceStatusInterface.GPSEnabledChanged(m_gpsEnabled);
                locationServiceStatusInterface.lastLocationAccuracyChanged(m_lastLocationAccuracy);
            }
        }
    }

    public Location getLastLocation() {
        return m_lastLocation;
    }

    /*Service implementation*/
    public class LocalBinder extends Binder {
        public KalmanLocationService getService() {
            return KalmanLocationService.this;
        }
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return new LocalBinder();
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        super.onTaskRemoved(rootIntent);
        stop();
        Log.d(TAG, "onTaskRemoved: " + rootIntent);
        m_locationServiceInterfaces.clear();
        m_locationServiceStatusInterfaces.clear();
        stopSelf();
    }
    //endregion

    private GeohashRTFilter m_geoHashRTFilter = null;

    public GeohashRTFilter getGeoHashRTFilter() {
        return m_geoHashRTFilter;
    }

    public static Settings defaultSettings =
            new Settings(
                    Utils.ACCELEROMETER_DEFAULT_DEVIATION,
                    Utils.GPS_MIN_DISTANCE,
                    Utils.GPS_MIN_TIME,
                    Utils.SENSOR_POSITION_MIN_TIME,
                    Utils.GEOHASH_DEFAULT_PREC,
                    Utils.GEOHASH_DEFAULT_MIN_POINT_COUNT,
                    Utils.SENSOR_DEFAULT_FREQ_HZ,
                    null,
                    true,
                    true,
                    false,
                    Utils.DEFAULT_VEL_FACTOR,
                    Utils.DEFAULT_POS_FACTOR,
                    Settings.LocationProvider.GPS,
                    true
            );

    private Settings m_settings;

    public FusedLocationProvider fusedLocationProvider;
    public GPSLocationProvider gpsLocationProvider;
    private PowerManager.WakeLock m_wakeLock;

    private ScheduledExecutorService scheduler;
    private ScheduledFuture<?> scheduledFuture;

    private boolean m_gpsEnabled = false;
    private boolean m_sensorsEnabled = false;

    private int m_activeSatellites = 0;
    private float m_lastLocationAccuracy = 0;

    private GPSAccKalmanFilter m_kalmanFilter;
    private SensorDataEventLoopTask m_eventLoopTask;
    private final List<Sensor> m_lstSensors;
    private SensorManager m_sensorManager;
    private double m_magneticDeclination = 0.0;

    private static final int[] sensorTypes = {
            Sensor.TYPE_LINEAR_ACCELERATION,
            Sensor.TYPE_ROTATION_VECTOR,
    };

    private final float[] rotationMatrix = new float[16];
    private final float[] rotationMatrixInv = new float[16];
    private final float[] absAcceleration = new float[4];
    private final float[] linearAcceleration = new float[4];

    private final Queue<SensorGpsDataItem> m_sensorDataQueue =
            new PriorityBlockingQueue<>();

    private final HandlerThread thread = new HandlerThread("kalmanThread");

    private void log2File(String format, Object... args) {
        if (m_settings != null && m_settings.logger != null)
            m_settings.logger.log2file(format, args);
    }

    // region SensorDataEventLoopTask
    static class SensorDataEventLoopTask implements Runnable {
        volatile boolean needTerminate = false;
        long deltaTMs;
        public KalmanLocationService owner;
        private final android.os.Handler mainHandler = new android.os.Handler(android.os.Looper.getMainLooper());

        SensorDataEventLoopTask(long deltaTMs, KalmanLocationService owner) {
            this.deltaTMs = deltaTMs;
            this.owner = owner;
        }

        private void handlePredict(SensorGpsDataItem sdi) {
            owner.log2File("%d%d KalmanPredict : accX=%f, accY=%f",
                    Utils.LogMessageType.KALMAN_PREDICT.ordinal(),
                    (long) sdi.getTimestamp(),
                    sdi.getAbsEastAcc(),
                    sdi.getAbsNorthAcc());
            owner.m_kalmanFilter.predict(sdi.getTimestamp(), sdi.getAbsEastAcc(), sdi.getAbsNorthAcc());
        }

        private void handleUpdate(SensorGpsDataItem sdi) {
            double courseRad = Math.toRadians(sdi.getCourse());
            double xVel = sdi.getSpeed() * Math.sin(courseRad);
            double yVel = sdi.getSpeed() * Math.cos(courseRad);
            owner.log2File("%d%d KalmanUpdate : pos lon=%f, lat=%f, xVel=%f, yVel=%f, posErr=%f, velErr=%f",
                    Utils.LogMessageType.KALMAN_UPDATE.ordinal(),
                    (long) sdi.getTimestamp(),
                    sdi.getGpsLon(),
                    sdi.getGpsLat(),
                    xVel,
                    yVel,
                    sdi.getPosErr(),
                    sdi.getVelErr()
            );

            owner.m_kalmanFilter.update(
                    sdi.getTimestamp(),
                    Coordinates.longitudeToMeters(sdi.getGpsLon()),
                    Coordinates.latitudeToMeters(sdi.getGpsLat()),
                    xVel,
                    yVel,
                    sdi.getPosErr(),
                    sdi.getVelErr()
            );
        }

        private Location locationAfterUpdateStep(SensorGpsDataItem sdi) {
            double xVel, yVel;
            Location loc = new Location(TAG);
            GeoPoint pp = Coordinates.metersToGeoPoint(owner.m_kalmanFilter.getCurrentX(),
                    owner.m_kalmanFilter.getCurrentY());
            loc.setLatitude(pp.Latitude);
            loc.setLongitude(pp.Longitude);
            loc.setAltitude(sdi.getGpsAlt());
            xVel = owner.m_kalmanFilter.getCurrentXVel();
            yVel = owner.m_kalmanFilter.getCurrentYVel();
            double speed = Math.sqrt(xVel * xVel + yVel * yVel);
            loc.setBearing((float) sdi.getCourse());
            loc.setSpeed((float) speed);
            loc.setTime(System.currentTimeMillis());
            loc.setElapsedRealtimeNanos(System.nanoTime());
            loc.setAccuracy((float) sdi.getPosErr());

            if (owner.m_geoHashRTFilter != null) {
                owner.m_geoHashRTFilter.filter(loc);
            }

            return loc;
        }

        @SuppressLint("DefaultLocale")
        @Override
        public void run() {
            while (!needTerminate && !Thread.currentThread().isInterrupted()) {
                try {
                    Thread.sleep(deltaTMs);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    break;
                }

                // Skip processing if paused (app in background)
                if (owner.m_isPaused) {
                    continue;
                }

                SensorGpsDataItem sdi;
                double lastTimeStamp = 0.0;
                while ((sdi = owner.m_sensorDataQueue.poll()) != null) {
                    if (sdi.getTimestamp() < lastTimeStamp) {
                        continue;
                    }
                    lastTimeStamp = sdi.getTimestamp();

                    if (sdi.getGpsLat() == SensorGpsDataItem.NOT_INITIALIZED) {
                        handlePredict(sdi);
                    } else {
                        handleUpdate(sdi);
                        Location loc = locationAfterUpdateStep(sdi);
                        // Post to main thread for UI callbacks
                        mainHandler.post(() -> onLocationChangedImp(loc));
                    }
                }
            }
        }

        void onLocationChangedImp(Location location) {
            if (location == null || !Objects.equals(location.getProvider(), TAG)) {
                return;
            }
            Log.i(TAG, "Final location after processing: " + location);
            owner.m_serviceStatus = ServiceStatus.HAS_LOCATION;
            owner.m_lastLocation = location;
            owner.m_lastLocationAccuracy = location.getAccuracy();
            for (LocationServiceInterface locationServiceInterface : owner.m_locationServiceInterfaces) {
                locationServiceInterface.locationChanged(location);
            }
            for (LocationServiceStatusInterface locationServiceStatusInterface : owner.m_locationServiceStatusInterfaces) {
                locationServiceStatusInterface.serviceStatusChanged(owner.m_serviceStatus);
                locationServiceStatusInterface.lastLocationAccuracyChanged(owner.m_lastLocationAccuracy);
                if (owner.m_settings.provider == Settings.LocationProvider.GPS) {
                    owner.m_activeSatellites = owner.gpsLocationProvider.getGPSSatteliteCount();
                    locationServiceStatusInterface.GPSStatusChanged(owner.m_activeSatellites);
                }
            }
        }
    }
    // endregion SensorDataEventLoopTask

    public KalmanLocationService() {
        m_locationServiceInterfaces = new ArrayList<>();
        m_locationServiceStatusInterfaces = new ArrayList<>();
        m_lstSensors = new ArrayList<Sensor>();
        m_eventLoopTask = null;
        reset(defaultSettings);
    }

    @Override
    public void onCreate() {
        super.onCreate();
        thread.start();
        scheduler = Executors.newSingleThreadScheduledExecutor();
        fusedLocationProvider = new FusedLocationProvider(this, this);
        gpsLocationProvider = new GPSLocationProvider(this, this, this);
        m_sensorManager = (SensorManager) getSystemService(SENSOR_SERVICE);
        PowerManager m_powerManager = (PowerManager) getSystemService(POWER_SERVICE);
        m_wakeLock = m_powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, TAG);
        startPeriodicLocationUpdates();

        if (m_sensorManager == null) {
            m_sensorsEnabled = false;
            return;
        }

        for (Integer st : sensorTypes) {
            Sensor sensor = m_sensorManager.getDefaultSensor(st);
            if (sensor == null) {
                Log.d(TAG, String.format("Couldn't get sensor %d", st));
                continue;
            }
            m_lstSensors.add(sensor);
        }
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        thread.quitSafely();
        if (scheduledFuture != null) {
            scheduledFuture.cancel(true);
        }
        scheduler.shutdown();
        if (m_eventLoopThread != null) {
            m_eventLoopThread.interrupt();
        }
    }

    /**
     * Pause the service when the app goes to background.
     * Unregisters sensor listeners and stops periodic location updates
     * to prevent unbounded queue growth and memory leaks.
     */
    public void pause() {
        m_isPaused = true;

        // Unregister sensor listeners to stop queue buildup
        for (Sensor sensor : m_lstSensors) {
            m_sensorManager.unregisterListener(this, sensor);
        }

        // Stop periodic location updates
        if (scheduledFuture != null) {
            scheduledFuture.cancel(true);
        }

        // Drain the queue — stale sensor data is useless after resume
        m_sensorDataQueue.clear();

        Log.d(TAG, "Service paused — sensors and periodic updates stopped. Queue cleared.");
    }

    /**
     * Resume the service when the app comes back to foreground.
     * Re-registers sensor listeners and restarts periodic location updates.
     * The Kalman filter is reset so it re-initializes with a fresh GPS fix.
     */
    public void resume() {
        m_isPaused = false;

        // Clear any stale data that might have accumulated
        m_sensorDataQueue.clear();

        // Reset the Kalman filter so it re-initializes with fresh GPS data
        m_kalmanFilter = null;

        // Re-register sensor listeners
        m_sensorsEnabled = true;
        for (Sensor sensor : m_lstSensors) {
            m_sensorsEnabled &= m_sensorManager.registerListener(
                    this, sensor,
                    Utils.hertz2periodUs(m_settings.sensorFrequencyHz));
        }

        // Restart periodic location updates
        startPeriodicLocationUpdates();

        // Restart event loop thread if it was killed by a previous stop() call.
        // Without this, sensors re-register and queue fills up but nothing drains it.
        if (m_eventLoopThread == null || !m_eventLoopThread.isAlive()) {
            m_eventLoopTask = new SensorDataEventLoopTask(m_settings.positionMinTime, KalmanLocationService.this);
            m_eventLoopTask.needTerminate = false;
            m_eventLoopThread = new Thread(m_eventLoopTask, "KalmanEventLoop");
            m_eventLoopThread.start();
            Log.d(TAG, "Service resumed — event loop thread restarted.");
        }

        Log.d(TAG, "Service resumed — sensors and periodic updates restarted.");
    }

    // Thread for the event loop (replaces deprecated AsyncTask)
    private Thread m_eventLoopThread;

    public void start() {
        m_wakeLock.acquire(10 * 60 * 1000L);
        m_sensorDataQueue.clear();
        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            m_serviceStatus = ServiceStatus.PERMISSION_DENIED;
        } else {
            m_serviceStatus = ServiceStatus.SERVICE_STARTED;
            if (m_settings.provider == Settings.LocationProvider.GPS) {
                gpsLocationProvider.startLocationUpdates(m_settings, thread);
                m_gpsEnabled = gpsLocationProvider.isProviderEnabled(LocationManager.GPS_PROVIDER);
            } else {
                fusedLocationProvider.startLocationUpdates(m_settings, thread);
                m_gpsEnabled = fusedLocationProvider.isProviderEnabled();
            }
            startEventLoop(m_gpsEnabled);
        }
        m_sensorsEnabled = true;
        for (Sensor sensor : m_lstSensors) {
            m_sensorManager.unregisterListener(this, sensor);
            m_sensorsEnabled &= m_sensorManager.registerListener(this, sensor,
                    Utils.hertz2periodUs(m_settings.sensorFrequencyHz));
        }
    }

    private void startEventLoop(boolean m_gpsEnabled) {
        for (LocationServiceStatusInterface ilss : m_locationServiceStatusInterfaces) {
            ilss.serviceStatusChanged(m_serviceStatus);
            ilss.GPSEnabledChanged(m_gpsEnabled);
        }

        m_eventLoopTask = new SensorDataEventLoopTask(m_settings.positionMinTime, KalmanLocationService.this);
        m_eventLoopTask.needTerminate = false;

        // Use a plain Thread instead of deprecated AsyncTask
        m_eventLoopThread = new Thread(m_eventLoopTask, "KalmanEventLoop");
        m_eventLoopThread.start();
    }

    public void stop() {
        if (m_wakeLock.isHeld())
            m_wakeLock.release();

        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            m_serviceStatus = ServiceStatus.SERVICE_STOPPED;
        } else {
            m_serviceStatus = ServiceStatus.SERVICE_PAUSED;
            if (m_settings.provider == Settings.LocationProvider.GPS) {
                gpsLocationProvider.stop();
            } else {
                fusedLocationProvider.stop();
            }
        }

        if (m_geoHashRTFilter != null) {
            m_geoHashRTFilter.stop();
        }

        m_sensorsEnabled = false;
        m_gpsEnabled = false;
        for (Sensor sensor : m_lstSensors)
            m_sensorManager.unregisterListener(this, sensor);

        for (LocationServiceStatusInterface ilss : m_locationServiceStatusInterfaces) {
            ilss.serviceStatusChanged(m_serviceStatus);
            ilss.GPSEnabledChanged(m_gpsEnabled);
        }

        if (m_eventLoopTask != null) {
            m_eventLoopTask.needTerminate = true;
        }
        if (m_eventLoopThread != null) {
            m_eventLoopThread.interrupt();
        }
        m_sensorDataQueue.clear();
    }

    public void reset(Settings settings) {
        m_settings = settings;
        m_kalmanFilter = null;

        if (m_settings.geoHashPrecision != 0 &&
                m_settings.geoHashMinPointCount != 0) {
            m_geoHashRTFilter = new GeohashRTFilter(m_settings.geoHashPrecision,
                    m_settings.geoHashMinPointCount);
        }
    }

    @Override
    public void onSensorChanged(SensorEvent event) {
        // Don't queue sensor data when paused or queue is too large
        if (m_isPaused) {
            return;
        }

        // Cap queue size to prevent unbounded memory growth.
        // Use >= so the queue never exceeds MAX_QUEUE_SIZE, which prevents
        // processLocation's overflow check (> MAX_QUEUE_SIZE) from ever triggering.
        if (m_sensorDataQueue.size() >= MAX_QUEUE_SIZE) {
            return;
        }

        final int east = 0;
        final int north = 1;
        final int up = 2;

        long now = android.os.SystemClock.elapsedRealtimeNanos();
        long nowMs = Utils.nano2milli(now);
        switch (event.sensor.getType()) {
            case Sensor.TYPE_LINEAR_ACCELERATION:
                System.arraycopy(event.values, 0, linearAcceleration, 0, event.values.length);
                android.opengl.Matrix.multiplyMV(absAcceleration, 0, rotationMatrixInv,
                        0, linearAcceleration, 0);

                String logStr = String.format(Locale.ENGLISH, "%d%d abs acc: %f %f %f",
                        Utils.LogMessageType.ABS_ACC_DATA.ordinal(),
                        nowMs, absAcceleration[east], absAcceleration[north], absAcceleration[up]);
                log2File(logStr);

                if (m_kalmanFilter == null) {
                    break;
                }

                SensorGpsDataItem sdi = new SensorGpsDataItem(nowMs,
                        SensorGpsDataItem.NOT_INITIALIZED,
                        SensorGpsDataItem.NOT_INITIALIZED,
                        SensorGpsDataItem.NOT_INITIALIZED,
                        absAcceleration[north],
                        absAcceleration[east],
                        absAcceleration[up],
                        SensorGpsDataItem.NOT_INITIALIZED,
                        SensorGpsDataItem.NOT_INITIALIZED,
                        SensorGpsDataItem.NOT_INITIALIZED,
                        SensorGpsDataItem.NOT_INITIALIZED,
                        m_magneticDeclination);
                m_sensorDataQueue.add(sdi);
                break;
            case Sensor.TYPE_ROTATION_VECTOR:
                SensorManager.getRotationMatrixFromVector(rotationMatrix, event.values);
                android.opengl.Matrix.invertM(rotationMatrixInv, 0, rotationMatrix, 0);
                break;
        }
    }

    @Override
    public void onAccuracyChanged(Sensor sensor, int accuracy) {
        /*do nothing*/
    }

    private void processLocation(Location loc) {
        // Skip when paused
        if (m_isPaused) return;

        if (m_settings.filterMockGpsCoordinates && loc.isFromMockProvider()) return;

        // If queue is overflowing, clear it and reset the filter
        if (m_sensorDataQueue.size() > MAX_QUEUE_SIZE) {
            Log.w(TAG, "Queue overflow — clearing and resetting Kalman filter");
            m_sensorDataQueue.clear();
            m_kalmanFilter = null;
        }

        // On high-end devices skip the Kalman filter and emit raw location directly.
        // Low-end devices (isLowRamDevice) go through the full filter pipeline instead.
        ActivityManager am = (ActivityManager) getSystemService(ACTIVITY_SERVICE);
        if (am != null && !am.isLowRamDevice()) {
            Log.i(TAG, "High-end device: emitting unprocessed location directly");
            m_serviceStatus = ServiceStatus.HAS_LOCATION;
            m_lastLocation = loc;
            m_lastLocationAccuracy = loc.getAccuracy();
            for (LocationServiceInterface locationServiceInterface : m_locationServiceInterfaces) {
                locationServiceInterface.locationChanged(loc);
            }
            for (LocationServiceStatusInterface locationServiceStatusInterface : m_locationServiceStatusInterfaces) {
                locationServiceStatusInterface.serviceStatusChanged(m_serviceStatus);
                locationServiceStatusInterface.lastLocationAccuracyChanged(m_lastLocationAccuracy);
                if (m_settings.provider == Settings.LocationProvider.GPS) {
                    m_activeSatellites = gpsLocationProvider != null ? gpsLocationProvider.getGPSSatteliteCount() : 0;
                    locationServiceStatusInterface.GPSStatusChanged(m_activeSatellites);
                }
            }
            return;
        }

        Log.i(TAG, "Got Location For Processing: " + loc);
        double x, y, xVel, yVel, posDev, course, speed;
        long timeStamp;
        speed = loc.getSpeed();
        course = loc.getBearing();
        x = loc.getLongitude();
        y = loc.getLatitude();
        double courseRad = Math.toRadians(course);
        xVel = speed * Math.sin(courseRad);
        yVel = speed * Math.cos(courseRad);
        posDev = loc.getAccuracy();
        timeStamp = Utils.nano2milli(loc.getElapsedRealtimeNanos());

        double velErr;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            velErr = loc.getSpeedAccuracyMetersPerSecond();
        } else {
            velErr = loc.getAccuracy() * 0.1;
        }

        String logStr = String.format(Locale.ENGLISH, "%d%d GPS : pos lat=%f, lon=%f, alt=%f, hdop=%f, speed=%f, bearing=%f, sa=%f",
                Utils.LogMessageType.GPS_DATA.ordinal(),
                timeStamp, loc.getLatitude(),
                loc.getLongitude(), loc.getAltitude(), loc.getAccuracy(),
                loc.getSpeed(), loc.getBearing(), velErr);
        log2File(logStr);

        GeomagneticField f = new GeomagneticField(
                (float) loc.getLatitude(),
                (float) loc.getLongitude(),
                (float) loc.getAltitude(),
                timeStamp);
        m_magneticDeclination = f.getDeclination();

        if (m_kalmanFilter == null) {
            log2File("%d%d KalmanAlloc : lon=%f, lat=%f, speed=%f, course=%f, m_accDev=%f, posDev=%f",
                    Utils.LogMessageType.KALMAN_ALLOC.ordinal(),
                    timeStamp, x, y, speed, course, m_settings.accelerationDeviation, posDev);
            m_kalmanFilter = new GPSAccKalmanFilter(
                    m_settings.useGpsSpeed,
                    Coordinates.longitudeToMeters(x),
                    Coordinates.latitudeToMeters(y),
                    xVel,
                    yVel,
                    m_settings.accelerationDeviation,
                    posDev,
                    timeStamp,
                    m_settings.mVelFactor,
                    m_settings.mPosFactor);
            return;
        }

        SensorGpsDataItem sdi = new SensorGpsDataItem(
                timeStamp, loc.getLatitude(), loc.getLongitude(), loc.getAltitude(),
                SensorGpsDataItem.NOT_INITIALIZED,
                SensorGpsDataItem.NOT_INITIALIZED,
                SensorGpsDataItem.NOT_INITIALIZED,
                loc.getSpeed(),
                loc.getBearing(),
                loc.getAccuracy(),
                velErr,
                m_magneticDeclination);
        m_sensorDataQueue.add(sdi);
    }

    private void startPeriodicLocationUpdates() {
        if (scheduledFuture != null) {
            scheduledFuture.cancel(true);
        }
        scheduledFuture = scheduler.scheduleWithFixedDelay(
                () -> {
                    try {
                        // Skip if paused
                        if (m_isPaused) return;

                        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
                            // TODO
                        } else {
                            fusedLocationProvider.onCurrentLocationChanged(m_settings.useCurrent);
                        }
                    } catch (Exception e) {
                        Log.e("LocationService", "Error in location update", e);
                    }
                },
                0,
                5,
                TimeUnit.SECONDS
        );
    }
}
