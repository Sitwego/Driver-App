package com.transli.mobilitycaptain;

import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.media.MediaPlayer;
import android.os.IBinder;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;


import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.modules.core.DeviceEventManagerModule;
import com.facebook.react.bridge.WritableMap;
import com.transli.mobilitycaptain.common.utils.NotificationController;

import org.json.JSONException;

import java.util.Objects;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

import io.grpc.ConnectivityState;
import io.grpc.ManagedChannel;
import io.grpc.Status;

import io.grpc.StatusRuntimeException;
import io.grpc.stub.StreamObserver;
import rides_events.Events;

public class GrpcNotificationService extends Service implements GrpcInterFace {
    public static final String TAG = GrpcNotificationService.class.getName();
    private final ScheduledExecutorService retryExecutor = Executors.newSingleThreadScheduledExecutor();
    public static final String TOKEN_KEY = "TOKEN_KEY";
    private static NotificationGrpc.NotificationStub asyncStub;
    public ManagedChannel channel = null;

    private String token;

    private ReactApplicationContext reactContext;
    private DeviceEventManagerModule.RCTDeviceEventEmitter eventEmitter;

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onCreate() {
        super.onCreate();
        this.reactContext = GeoKalmanModule.getReactAppContext();
        this.token = RpcChannelManager.getToken();
        SharedPreferences sharedPref = getApplicationContext().getSharedPreferences(
                getApplicationContext().getString(R.string.sit_we_go_shared_preferences),
                Context.MODE_PRIVATE
        );
        channel = RpcChannelManager.getChannel(this);
        this.eventEmitter = this.reactContext.getJSModule(
                DeviceEventManagerModule.RCTDeviceEventEmitter.class
        );

    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        Log.w(TAG, "Destroying GRPC service");
        retryExecutor.shutdownNow();
        // Only null out the local reference — RpcChannelManager owns the channel
        // lifecycle. Calling RpcChannelManager.shutdown() here would destroy the
        // shared channel and break any other service (e.g. RpcRideEventService)
        // that is still using it.
        channel = null;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {

        if (channel != null && this.token != null) {
            initGrpc(this.token);
        } else {
            Log.e(TAG, "Channel and token is null");
            retryExecutor.shutdownNow();
            stopSelf();
        }

        //return START_STICKY; // Adjust as per your service behavior START_STICKY
        return super.onStartCommand(intent, flags, startId);
    }

    @Override
    public void onError(Throwable e) {
        if (e instanceof StatusRuntimeException statusRuntimeException) {
            Status.Code code = statusRuntimeException.getStatus().getCode();
            String desc = statusRuntimeException.getStatus().getDescription();
            if ((code == Status.Code.INTERNAL || (code == Status.Code.UNAVAILABLE && !Objects.equals(desc, "Channel shutdownNow invoked"))) ||
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
                            }))) {
                Log.e(TAG, "[Retrying GRPC Connection]");
                retryExecutor.schedule(() -> initGrpc(this.token), 2, TimeUnit.SECONDS);
                return;
            }
            Log.e(TAG, "[Non-recoverable Error] : " + statusRuntimeException.getStatus());
            retryExecutor.shutdownNow();
            stopSelf();
        }
    }


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
    public void onMessage(NotificationPayload notificationPayload) {
        Log.i(TAG, "[Incoming Notification]" + notificationPayload.getEntity().getData());
        // Build the payload on the calling thread (no JS heap access yet)
        final String id = notificationPayload.getId();
        final String category = notificationPayload.getCategory();
        final String type = notificationPayload.getEntity().getType();
        final String entityId = notificationPayload.getEntity().getId();
        final String data = notificationPayload.getEntity().getData();

        // Show overlay and play sound regardless of React bridge state
        NotificationController.showPopUpNotification(getApplicationContext(), data);
        MediaPlayer mp = MediaPlayer.create(getApplicationContext(), R.raw.silent_notif);
        if (mp != null) mp.start();

        // JS event only when the bridge is alive
        if (this.eventEmitter == null || this.reactContext == null) return;
        // Dispatch to the JS queue thread to avoid racing with Hermes GC
        this.reactContext.runOnJSQueueThread(() -> {
            WritableMap msg = Arguments.createMap();
            msg.putString("id", id);
            msg.putString("category", category);
            msg.putString("type", type);
            msg.putString("entity_id", entityId);
            msg.putString("data", data);
            this.eventEmitter.emit("onRideReqMessage", msg);
        });
    }

    @Override
    public void onEvent(Events.RideEvent event) throws JSONException {
        Log.d(TAG, "Event received: " + event.toString());
    }

    @Override
    public void onComplete() {
        Log.d(TAG, "GRPC Connection Completed by server");
        if(!retryExecutor.isShutdown()){
            Log.d(TAG, "Retrying GRPC Connection after server close");
            // start a new retry after 5
            retryExecutor.schedule(() -> initGrpc(this.token), 5, TimeUnit.SECONDS);
        }
    }


    private void initGrpc(String t) {
        Log.d(TAG, "Initializing GRPC Connection for Token: " + t);
        if (channel == null) {
            Log.w(TAG, "Channel is null");
            stopSelf();
            retryExecutor.shutdownNow();
            return;
        }
        watchChannelState(channel);
        asyncStub = NotificationGrpc.newStub(channel);

        startGRPCNotificationService();
        Log.d(TAG, "GRPC Connection Initialized");
    }

    private void watchChannelState(ManagedChannel channel) {
        ConnectivityState state = channel.getState(false);
        Log.d(TAG, "Initial channel state: " + state);

        channel.notifyWhenStateChanged(state, () -> {
            ConnectivityState newState = channel.getState(false);
            Log.d(TAG, "Channel state changed to: " + newState);

            if (newState == ConnectivityState.IDLE) {
                Log.d(TAG, "Channel is idle. Forcing reconnection...");
                channel.getState(true);
            }

            if (newState != ConnectivityState.SHUTDOWN) {
                watchChannelState(channel);
            }
        });
    }

    private void startGRPCNotificationService() {
        GRPCNotificationResponseObserver notificationObserver = new GRPCNotificationResponseObserver(this);
        StreamObserver<NotificationAck> streamObserver = asyncStub.streamPayload(notificationObserver);
        notificationObserver.startGRPCNotification(streamObserver);
    }
}

/***
 * GRPCNotificationResponseObserver
 * This class is responsible to observe the stream of the bidirectional communication happening between client application and GRPC server
 * Implements StreamObserver class as the duplex communication will be in stream
 * ***/
class GRPCNotificationResponseObserver implements StreamObserver<NotificationPayload> {
    private StreamObserver<NotificationAck> notificationRequestObserver;
    private final GrpcInterFace notificationListener;

    public GRPCNotificationResponseObserver(GrpcInterFace notificationListener) {
        this.notificationListener = notificationListener;
    }

    /***
     * This method is responsible for initiating the connection to the server ( initially the acknowledgement will be sent for a random notification id )'''
     * ***/
    public void startGRPCNotification( StreamObserver<NotificationAck> notificationRequestObserver){
        this.notificationRequestObserver = notificationRequestObserver;
        Log.i("GRPC NOTIFICATION", "[Started]");
        this.notificationRequestObserver.onNext(NotificationAck.newBuilder().setId("").build());
    }

    @Override
    public void onNext(@NonNull NotificationPayload notification) {
        if (notification.getId() != null && !notification.getId().isEmpty()) {
            this.notificationRequestObserver.onNext(NotificationAck.newBuilder().setId(notification.getId()).build());
        } else {
            Log.w("GRPC", "Received invalid notification ID");
        }
        notificationListener.onMessage(notification);
    }

    @Override
    public void onError(@NonNull Throwable t) {
        Log.e("GRPC NotificationService", "[Error] : " + t);
        notificationListener.onError(t);
    }

    @Override
    public void onCompleted() {
        Log.e("GRPC STREAM", "[onCompleted] ");
        notificationListener.onComplete();
    }
}

/***
 * GRPCNotificationHeaderInterceptor
 * This class is responsible for modifying the message ( here adding header in the message ) before sending the message to the server in duplex communication
 * ***/

class GRPCNotificationHeaderInterceptor extends GRPCHeaderInterceptor {
    GRPCNotificationHeaderInterceptor(String token) {
        super(token);
    }

}

//adb -s RZ8M91D2CEA reverse tcp:8080 tcp:50051
