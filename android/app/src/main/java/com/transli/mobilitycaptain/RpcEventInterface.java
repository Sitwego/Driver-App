package com.transli.mobilitycaptain;

import org.json.JSONException;

import rides_events.Events;

public interface RpcEventInterface {
    void onError(Throwable e);
    void onComplete();
    void onRideEvent(Events.RideEvent event) throws JSONException;
}
