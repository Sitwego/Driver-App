package com.transli.mobilitycaptain.bubble;

import androidx.annotation.Nullable;

import org.json.JSONObject;

/**
 * What the floating ride assistant is currently showing.
 *
 * <p>The bubble is a <em>projection</em>. It never derives, caches or votes on
 * driver availability — it reads state that already exists and renders it. The
 * resolver below is the whole decision, kept in one pure static method so the
 * rules are reviewable in isolation.
 *
 * <p>The two "cannot confirm" rules are the important ones. If the offer stream
 * is not connected, or the ride record cannot be read, the bubble must degrade
 * to {@link #UNKNOWN} rather than keep asserting a green "you are online and
 * connected" that the backend may not agree with.
 */
public enum BubbleState {
    /** Cannot confirm current state. Rendered muted — never green. */
    UNKNOWN,
    /** Online, connected, no ride. */
    AVAILABLE,
    /** An offer is live and the driver has not acted on it yet. */
    REQUESTED,
    /** Ride accepted, driver en route to pickup. */
    ACCEPTED,
    /** Driver has marked arrival at the pickup point. */
    ARRIVING,
    /** Trip underway. */
    TRIP_STARTED;

    /**
     * Resolve what to show.
     *
     * <p>Both JSON arguments are raw MMKV values from the {@code ACTIVE_RIDE_DATA}
     * store that JS writes. That store wraps every value as {@code {"data": …}}
     * (see the {@code Storage} class in src/lib/store/index.ts), so both are
     * unwrapped one level before use.
     *
     * @param channelReady   whether the gRPC offer stream is connected
     * @param hasLiveOffer   whether an un-expired offer is sitting in the native slot
     * @param rideEnvelope   raw value of the {@code ride} key, or null when absent
     * @param statusEnvelope raw value of the {@code rideStatus} key, or null when absent
     */
    public static BubbleState resolve(
            boolean channelReady,
            boolean hasLiveOffer,
            @Nullable String rideEnvelope,
            @Nullable String statusEnvelope
    ) {
        // Offers arrive over this stream. If it is down we are not reachable,
        // whatever the last known state said.
        if (!channelReady) return UNKNOWN;

        if (hasLiveOffer) return REQUESTED;

        Boolean rideActive = hasRide(rideEnvelope);
        // Unreadable: refuse to claim AVAILABLE. A corrupt record is exactly the
        // case where a confident green light would be a lie.
        if (rideActive == null) return UNKNOWN;
        if (!rideActive) return AVAILABLE;

        return refineWithStatus(statusEnvelope);
    }

    /**
     * @return TRUE when a ride is held, FALSE when the slot is empty or cleared,
     *         and null when the record exists but could not be parsed.
     */
    @Nullable
    private static Boolean hasRide(@Nullable String envelope) {
        // Key removed (removeMany on end-ride) — unambiguously no ride.
        if (envelope == null || envelope.isEmpty()) return Boolean.FALSE;
        try {
            JSONObject root = new JSONObject(envelope);
            // REMOVE_RIDE writes `undefined`, which stringifies to `{}` — the
            // data key is absent rather than the whole record being removed.
            if (!root.has("data") || root.isNull("data")) return Boolean.FALSE;
            JSONObject data = root.optJSONObject("data");
            if (data == null) return Boolean.FALSE;
            return data.optJSONObject("ride") != null;
        } catch (Exception e) {
            return null;
        }
    }

    /**
     * Narrow an active ride to its phase.
     *
     * <p>Unlike the ride record, an unreadable status is <em>not</em> escalated to
     * UNKNOWN: the ride itself is already confirmed, so ACCEPTED is the honest
     * floor rather than a guess.
     */
    private static BubbleState refineWithStatus(@Nullable String envelope) {
        if (envelope == null || envelope.isEmpty()) return ACCEPTED;
        try {
            JSONObject data = new JSONObject(envelope).optJSONObject("data");
            if (data == null) return ACCEPTED;
            JSONObject status = data.optJSONObject("rideStatus");
            if (status == null) return ACCEPTED;
            // Started is checked first: it implies arrival already happened, and
            // both flags are true for the rest of the trip.
            if (status.optBoolean("hasRideStarted", false)) return TRIP_STARTED;
            if (status.optBoolean("hasDriverArrived", false)) return ARRIVING;
            return ACCEPTED;
        } catch (Exception e) {
            return ACCEPTED;
        }
    }
}
