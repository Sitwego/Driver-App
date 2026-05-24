package com.transli.mobilitycaptain;

import android.app.Service;
import android.content.Intent;
import android.os.IBinder;
import android.util.Log;

import androidx.annotation.NonNull;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;
import com.transli.mobilitycaptain.helpers.ThreadUtils;

import org.json.JSONException;

import java.util.Objects;

import io.github.resilience4j.core.IntervalFunction;
import io.grpc.ManagedChannel;
import io.grpc.Status;
import io.grpc.StatusException;
import io.grpc.StatusRuntimeException;
import io.grpc.stub.StreamObserver;
import io.github.resilience4j.retry.Retry;
import io.github.resilience4j.retry.RetryConfig;
import io.vavr.control.Try;

import java.util.concurrent.Callable;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Supplier;
import java.time.Duration;
import rides_events.Events;
import rides_events.RideEventServiceGrpc;

public class RpcRideEventService extends Service implements RpcEventInterface {
    private final static String TAG = RpcRideEventService.class.getCanonicalName();
    private ManagedChannel channel = null;
    private RideEventServiceGrpc.RideEventServiceStub rideEventServiceStub = null;
    private final AtomicInteger retryCount = new AtomicInteger(0);
    private final ScheduledExecutorService retryExecutor = Executors.newSingleThreadScheduledExecutor();
    private final java.util.concurrent.atomic.AtomicBoolean streamActive = new java.util.concurrent.atomic.AtomicBoolean(false);

    private DeviceEventManagerModule.RCTDeviceEventEmitter eventEmitter;

    private Retry grpcRetry;

    public RpcRideEventService() {
    }


    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onCreate() {
        super.onCreate();
        configureResilience4jRetry();
        ReactApplicationContext reactContext = GeoKalmanModule.getReactAppContext();
        this.eventEmitter = reactContext.getJSModule(
                DeviceEventManagerModule.RCTDeviceEventEmitter.class
        );
        this.channel = RpcChannelManager.getChannel(this);

    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        Log.d(TAG, "Starting RpcRideEventService");
        if (channel != null) {
            this.rideEventServiceStub = RideEventServiceGrpc.newStub(channel);
            if (streamActive.get()) {
                Log.w(TAG, "Stream already active, ignoring duplicate start");
            } else {
                startRetriableGrpcStream();
            }
        } else {
            Log.e(TAG, "Channel is null");
            stopSelf();
        }
        return START_NOT_STICKY;
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        channel = null;
        streamActive.set(false);
        retryExecutor.shutdownNow();
        Log.w(TAG, "Destroying GRPC service");
    }

    /**
     * @param e error
     */
    @Override
    public void onError(Throwable e) {
        streamActive.set(false);
        Log.e(TAG, "Error: " + e);
        if (isRetriable(e)) {
            int attempts = retryCount.incrementAndGet();
            if (attempts >= grpcRetry.getRetryConfig().getMaxAttempts()) {
                Log.e(TAG, "Max retries (" + attempts + ") reached. Giving up.");
                stopSelf();
                return;
            }
            long delaySeconds = Math.min((long) Math.pow(2, attempts), 300);
            Log.i(TAG, "Retrying gRPC stream in " + delaySeconds + "s (attempt " + attempts + ")");
            retryExecutor.schedule(this::startRetriableGrpcStream, delaySeconds, TimeUnit.SECONDS);
        } else {
            Log.e(TAG, "Non-recoverable error: " + e);
            stopSelf();
        }
    }

    /**
     * Check if the string contains any of the substrings
     * @param description string
     * @param substrings string array
     * @return boolean
     */
    private boolean containsAny(String description, String[] substrings) {
        if (description == null) {
            return false;
        }
        for (String substring : substrings) {
            if (description.contains(substring)) {
                return true;
            }
        }
        return false;
    }

    @Override
    public void onComplete() {
        streamActive.set(false);
        Log.d(TAG, "gRPC stream completed by the server, reconnecting in 4s");
        retryExecutor.schedule(this::startRetriableGrpcStream, 4, TimeUnit.SECONDS);
    }

    /**
     * @param event message event
     */
    @Override
    public void onRideEvent(Events.RideEvent event) {
        Log.d(TAG, "Event received: " + event.toString());
        // Ensure event is not null
        WritableMap jsEvent = jsEvent(event);
        if (jsEvent != null) {
            eventEmitter.emit("onRideEvent", jsEvent);
        }
    }

    private boolean isRetriable(Throwable t) {
        if (t instanceof StatusRuntimeException sre) {
            Status.Code code = sre.getStatus().getCode();
            String desc = sre.getStatus().getDescription();
            return (code == Status.Code.INTERNAL || (code == Status.Code.UNAVAILABLE && !Objects.equals(desc, "Channel shutdownNow invoked"))) ||
                    (containsAny(desc,
                            new String[]{
                                    "Rst Stream",
                                    "End of stream or IOException",
                                    "Keepalive failed",
                                    "TIMEOUT",
                                    "RETRY",
                                    "CONNECTION RESET",
                                    "NETWORK",
                                    "CONNECTIVITY",
                                    "SOCKET",
                                    "CONNECTION ABORT",
                                    "TRANSPORT"
                            }));
        }
        return false;
    }

    
    private void configureResilience4jRetry() {
        RetryConfig config;
        config = RetryConfig.custom()
                .maxAttempts(30)
                .intervalFunction(IntervalFunction.ofExponentialBackoff(
                        Duration.ofSeconds(5),
                        2.0,
                        Duration.ofMinutes(5)
                ))       // Exponential: 1s, 2s, 4s, 8s...
                .retryOnException(throwable -> {
                    if (isRetriable(throwable)) {
                        Log.w(TAG, "Retrying due to: " + throwable);
                        return true;
                    } else {
                        Log.e(TAG, "Non-recoverable error: " + throwable);
                        return false;
                    }
                })
                .build();

        grpcRetry = Retry.of("grpcStreamingRetry", config);

        // Optional: Listen to retry events for logging
        grpcRetry.getEventPublisher()
                .onRetry(event -> Log.w(TAG, "Retry #" + event.getNumberOfRetryAttempts() +
                        " due to: " + event.getLastThrowable()))
                .onError(event -> Log.e(TAG, "Retry exhausted after " +
                        event.getNumberOfRetryAttempts() + " attempts"))
                .onSuccess(event -> {
                    Log.i(TAG, "gRPC stream connected successfully");
                    retryCount.set(0); // reset so future failures get the full retry budget
                });
    }

    private void startRetriableGrpcStream() {
        Supplier<Void> retriable = getVoidSupplier();

        // Execute asynchronously (since Android Service)
        new Thread(() -> {
            Try<Void> result = Try.ofSupplier(retriable);
            if (result.isFailure()) {
                // All retries exhausted → non-recoverable
                Log.e(TAG, "Non-recoverable gRPC error after retries", result.getCause());
                stopSelf(); // Or fallback logic
            }
            // If success → stream is running, nothing to do
        }).start();
    }

    @NonNull
    private Supplier<Void> getVoidSupplier() {
        Supplier<Void> streamStarter = () -> {
            if (rideEventServiceStub == null) return null;
            if (!streamActive.compareAndSet(false, true)) {
                Log.w(TAG, "Concurrent stream start suppressed");
                return null;
            }
            Log.i(TAG, "Attempting to start gRPC stream...");
            try {
                RpcEventResponseObserver rpcEventResponseObserver = new RpcEventResponseObserver(this);
                StreamObserver<Events.DriverEventRequest> streamObserver = rideEventServiceStub.streamDriverEvents(rpcEventResponseObserver);
                rpcEventResponseObserver.streamObserver(streamObserver);
                retryCount.set(0);
                Log.i(TAG, "gRPC stream started");
            } catch (Exception e) {
                streamActive.set(false);
                throw e;
            }
            return null;
        };

        return Retry.decorateSupplier(grpcRetry, streamStarter);
    }

    private WritableMap jsEvent(Events.RideEvent event){
        try {
            return (WritableMap) ThreadUtils
                    .submitToExecutor((Callable<?>) () -> {
                        WritableMap msg = Arguments.createMap();
                        WritableMap eventPayload = Arguments.createMap();
                        switch (event.getEventPayloadCase()){
                            case RIDE_CANCEL -> {
                                Events.RideCancelEvent rideCancel = event.getRideCancel();
                                eventPayload.putString("reason", rideCancel.getReason());
                                Events.CancelSource cancelSource = rideCancel.getCanceledBy();
                                eventPayload.putInt("cancel_by", cancelSource.getNumber());
                                eventPayload.putString("note", rideCancel.getNote());
                            }
                            case RIDE_END -> {
                                Events.RideEndEvent rideEnd = event.getRideEnd();
                                eventPayload.putDouble("final_fare", rideEnd.getFinalFare());
                                eventPayload.putDouble("dx", rideEnd.getDistanceKm());
                                eventPayload.putLong("duration_seconds", rideEnd.getDurationSeconds());
                                Events.Rating rating = rideEnd.getRiderRating();
                                eventPayload.putDouble("rider_rating", rating.getScore());
                                eventPayload.putString("comment", rating.getComment());
                                Events.Location endLocation = rideEnd.getEndLocation();
                                eventPayload.putDouble("end_lat", endLocation.getLatitude());
                                eventPayload.putDouble("end_lng", endLocation.getLongitude());

                            }
                            case FARE_CHANGE -> {
                                Events.FareChangeEvent fareChange = event.getFareChange();
                                eventPayload.putDouble("new", fareChange.getNewFare());
                                eventPayload.putDouble("old", fareChange.getOldFare());
                                eventPayload.putString("reason", fareChange.getReason());
                            }
                            case LOCATION_UPDATE -> {
                                Events.LocationUpdateEvent locationUpdate = event.getLocationUpdate();
                                eventPayload.putDouble("speed_kph", locationUpdate.getSpeedKph());
                                eventPayload.putDouble("bearing", locationUpdate.getBearing());
                                eventPayload.putLong("location_timestamp", locationUpdate.getLocationTime());
                                eventPayload.putInt("accuracy", locationUpdate.getAccuracy());
                                Events.Location location = locationUpdate.getLocation();
                                eventPayload.putDouble("lat", location.getLatitude());
                                eventPayload.putDouble("lng", location.getLongitude());
                            }
                            default -> { return null; }
                        }
                        msg.putLong("timestamp", event.getTimestamp());
                        msg.putString("eventType", event.getEventType());
                        msg.putString("driver_id", event.getDriverId());
                        msg.putString("rider_id", event.getRiderId());
                        msg.putString("ride_id", event.getRideId());
                        msg.putString("session_token", event.getEventId());
                        msg.putMap("eventPayload", eventPayload);
                        return msg;
                    })
                    .get();
        } catch (ExecutionException | InterruptedException e) {
            throw new RuntimeException(e);
        }
    }
}

class RpcEventResponseObserver implements StreamObserver<Events.RideEvent> {
    private final RpcEventInterface notificationListener;
    StreamObserver<Events.DriverEventRequest> streamObserver;


    RpcEventResponseObserver(RpcEventInterface notificationListener1) {

        this.notificationListener = notificationListener1;
    }

    void streamObserver(StreamObserver<Events.DriverEventRequest> streamObserver) {
        this.streamObserver = streamObserver;
        String driverId = RpcChannelManager.getToken();
        if (driverId == null) driverId = "";
        Events.DriverEventRequest request = Events.DriverEventRequest.newBuilder()
                .setDriverId(driverId)
                .build();
        streamObserver.onNext(request);
    }


    /**
     * Receives a value from the stream.
     *
     * <p>Can be called many times but is never called after {@link #onError(Throwable)} or {@link
     * #onCompleted()} are called.
     *
     * <p>Unary calls must invoke onNext at most once.  Clients may invoke onNext at most once for
     * server streaming calls, but may receive many onNext callbacks.  Servers may invoke onNext at
     * most once for client streaming calls, but may receive many onNext callbacks.
     *
     * <p>If an exception is thrown by an implementation the caller is expected to terminate the
     * stream by calling {@link #onError(Throwable)} with the caught exception prior to
     * propagating it.
     *
     * @param value the value passed to the stream
     */
    @Override
    public void onNext(Events.RideEvent value) {
        try {
            notificationListener.onRideEvent(value);
        } catch (JSONException e) {
            throw new RuntimeException(e);
        }
    }

    /**
     * Receives a terminating error from the stream.
     *
     * <p>May only be called once and if called it must be the last method called. In particular if an
     * exception is thrown by an implementation of {@code onError} no further calls to any method are
     * allowed.
     *
     * <p>{@code t} should be a {@link StatusException} or {@link
     * StatusRuntimeException}, but other {@code Throwable} types are possible. Callers should
     * generally convert from a {@link Status} via {@link Status#asException()} or
     * {@link Status#asRuntimeException()}. Implementations should generally convert to a
     * {@code Status} via {@link Status#fromThrowable(Throwable)}.
     *
     * @param t the error occurred on the stream
     */
    @Override
    public void onError(Throwable t) {
        Log.e("GRPC STREAM", "[onError] : " + t);
        notificationListener.onError(t);
    }

    /**
     * Receives a notification of successful stream completion.
     *
     * <p>May only be called once and if called it must be the last method called. In particular if an
     * exception is thrown by an implementation of {@code onCompleted} no further calls to any method
     * are allowed.
     */
    @Override
    public void onCompleted() {
        Log.d("GRPC STREAM", "[onCompleted] ");
        notificationListener.onComplete();
    }
}
