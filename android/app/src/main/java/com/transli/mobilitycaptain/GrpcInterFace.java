package com.transli.mobilitycaptain;

import org.json.JSONException;

import rides_events.Events;

public interface GrpcInterFace {
    void onError(Throwable e);
    void onMessage(NotificationPayload notificationPayload);
    void onComplete();

    void onEvent(Events.RideEvent event) throws JSONException;
}
