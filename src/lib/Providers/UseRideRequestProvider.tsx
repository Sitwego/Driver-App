import React, { useCallback, useEffect } from "react";
import { AppState, DeviceEventEmitter } from "react-native";

import { DriverLocationProvider } from "~/lib/Providers/DriverLocationProvider";
import { navigate } from "~/navigation/navigation";
import { RideEvent, RideRequsetNotification } from "~/types/rideRequstTypes";
import {
  formatedRideData,
  parseRideRequestData,
  rideRequestRemainingSec,
} from "~/utils/rideUtils";

import { routeForBubbleTarget } from "../floatingAssistant/bubbleLaunch";
import {
  consumeBubbleLaunchTarget,
  consumePendingRideRequest,
  nativeAppEvents,
  refreshRideBubble,
  startEventService,
  stopEventService,
} from "../native";
import { rideStore } from "../store";

const reducer = (state: any, action: any) => {
  switch (action.type) {
    case "SET_RIDE":
      return { ...state, ride: action.payload };
    case "REMOVE_RIDE": {
      rideStore.set(["ride"], undefined);
      rideStore.remove(["arrivedAt"]);
      return { ...state, ride: null };
    }
    default:
      return state;
  }
};
const _initialRideStatus: RideStatus = {
  hasRideStarted: false,
  hasRideCanceled: false,
  hasDriverArrived: false,
};

export const initialRideStatus = { rideStatus: _initialRideStatus };

function rideStatusReducer(state: RideState, action: RideAction): RideState {
  switch (action.type) {
    case "UPDATE_RIDE_STATUS": {
      const rideState = {
        ...state,
        rideStatus: {
          ...state?.rideStatus,
          ...action.payload,
        },
      };
      rideStore.set(["rideStatus"], rideState);
      // Persist arrivedAt as a dedicated store key so TimerComponent can read
      // it synchronously on mount without waiting for context hydration.
      if (action.payload?.arrivedAt !== undefined) {
        rideStore.set(["arrivedAt"], action.payload.arrivedAt);
      }
      // Clear the timestamp when the ride is no longer in an arrived state.
      if (action.payload?.hasDriverArrived === false) {
        rideStore.remove(["arrivedAt"]);
      }
      return rideState;
    }
    default:
      return state;
  }
}

export const RideRequestStatusContext = React.createContext<{
  setRideStatus: React.Dispatch<RideAction>;
  rideStatus: RideState;
}>({
  setRideStatus: () => {
    throw new Error("Function not implemented.");
  },
  rideStatus: initialRideStatus,
});

export const useRideRequestStatus = () => {
  const context = React.useContext(RideRequestStatusContext);
  if (!context) {
    throw new Error(
      "useRideRequestStatus must be used within a UseRideRequestProvider",
    );
  }
  return context;
};

type RideRequestApiContextProps = {
  setRide: (p: any) => void;
  removeRide: () => void;
  rideState?: any;
};
const RideRequestApiContext = React.createContext<RideRequestApiContextProps>({
  setRide: () => {},
  removeRide: () => {},
});
export const useRideRequest = () => {
  const context = React.useContext(RideRequestApiContext);
  if (!context) {
    throw new Error(
      "useRideRequest must be used within a UseRideRequestProvider",
    );
  }
  return context;
};

export const UseRideRequestProvider: React.FC<React.PropsWithChildren<{}>> = ({
  children,
}) => {
  const data = rideStore.get(["ride"]);
  const initRideStatus = rideStore.get([
    "rideStatus",
  ]) as typeof initialRideStatus;
  const [rideState, setRideState] = React.useReducer(reducer, data);
  const [rideStatus, setRideStatus] = React.useReducer(
    rideStatusReducer,
    initRideStatus,
  );

  // Id of the offer currently held in state, so the live event and the native
  // replay slot cannot both apply the same request.
  const appliedRequestId = React.useRef<string | null>(null);

  const removeRide = React.useCallback(() => {
    appliedRequestId.current = null;
    setRideState({ type: "REMOVE_RIDE" });
  }, [setRideState]);

  const setRide = React.useCallback(
    (ride: any) => {
      setRideState({ type: "SET_RIDE", payload: ride });
    },
    [setRideState],
  );

  const event_handler = useCallback(
    (event: RideEvent) => {
      switch (event.eventType) {
        case "RideStartEvent": {
          break;
        }
        case "RideCancelEvent": {
          removeRide();
          setRideStatus({
            type: "UPDATE_RIDE_STATUS",
            payload: {
              hasRideCanceled: true,
              hasRideStarted: false,
              hasDriverArrived: false,
            },
          });
          break;
        }
        case "FareChange": {
          // Handle fare change event
          break;
        }
        case "LocationUpdateEvent": {
          // Handle location update event
          break;
        }
      }
    },
    [removeRide],
  );
  const applyRideRequest = useCallback(
    (ride_request: RideRequsetNotification) => {
      // Every offer is both emitted live and written to the native replay slot,
      // so the same request can arrive twice. Re-applying it hands the modal a
      // fresh `ride` identity, which re-runs its open effect and toggles the
      // already-open modal shut — the request appears to flash and vanish.
      if (ride_request.id && ride_request.id === appliedRequestId.current) {
        return;
      }
      const ride_data = parseRideRequestData(ride_request);
      if (!ride_data.data) return;
      appliedRequestId.current = ride_request.id ?? null;
      let notificationData = formatedRideData(ride_data.data);
      setRideState({
        type: "SET_RIDE",
        payload: {
          ...ride_data,
          data: notificationData,
        },
      });
    },
    [setRideState],
  );

  /**
   * Recover an offer that arrived while the React context was dead — the app
   * swiped away, or still cold-starting. The native emitter does not buffer, so
   * without this the driver taps the overlay, the app opens, and the request is
   * simply gone. Native persists every offer; we drain that slot here.
   */
  const drainPendingRideRequest = useCallback(async () => {
    try {
      const pending: RideRequsetNotification | null =
        await consumePendingRideRequest();
      if (!pending) return;
      // Expired while the app was booting — the server has almost certainly
      // reassigned it, so surfacing it would only produce a failed accept.
      if (rideRequestRemainingSec(pending.received_at) <= 0) return;
      // Already working a ride: a stale offer must not hijack the screen.
      if (rideStore.get(["ride"])) return;
      applyRideRequest(pending);
    } catch (error) {
      console.warn("Failed to drain pending ride request:", error);
    }
  }, [applyRideRequest]);

  /**
   * Route a tap on the floating ride assistant.
   *
   * The bubble records which screen it was showing and opens the app; the
   * decision of where to land is made here, because at tap time the activity may
   * not exist yet. The slot is empty for every other way of opening the app, and
   * `routeForBubbleTarget` returns null for that — a launcher start must never be
   * yanked somewhere the driver did not ask for.
   */
  const handleBubbleLaunch = useCallback(async () => {
    try {
      const target: string | null = await consumeBubbleLaunchTarget();
      const destination = routeForBubbleTarget(target);
      if (!destination) return;
      await navigate(destination.route);
      if (destination.reopenRideSheet) {
        // The active-trip UI is a sheet over the map, not a screen. This is the
        // same event the "Return to Ride" pill in the tab bar fires.
        DeviceEventEmitter.emit("onReopenRideSheet");
      }
    } catch (error) {
      console.warn("Failed to route floating assistant tap:", error);
    }
  }, []);

  useEffect(() => {
    const subs = [
      nativeAppEvents.addListener("onRideReqMessage", applyRideRequest),
      nativeAppEvents.addListener("onRideEvent", event_handler),
    ];

    return () => {
      subs.forEach((sub) => sub.remove());
    };
  }, [event_handler, applyRideRequest]);

  useEffect(() => {
    // On mount covers the cold start from the overlay; on foreground covers a
    // warm resume where the activity was destroyed but the process survived.
    drainPendingRideRequest();
    // Cold start: the NavigationContainer mounts *below* this provider, so the
    // navigation ref is not ready yet and navigate() would silently no-op. Same
    // 500ms the killed-state push tap uses for the identical problem — see
    // useNotificationHandler.ts.
    const bubbleLaunchTimer = setTimeout(handleBubbleLaunch, 500);
    const sub = AppState.addEventListener("change", (status) => {
      if (status === "active") {
        drainPendingRideRequest();
        // Warm resume — navigation is already up, so route straight away.
        handleBubbleLaunch();
      }
    });
    return () => {
      clearTimeout(bubbleLaunchTimer);
      sub.remove();
    };
  }, [drainPendingRideRequest, handleBubbleLaunch]);

  // The one place that tells native the ride projection moved. The bubble reads
  // the shared ACTIVE_RIDE_DATA store itself, so this carries no payload — it
  // only says "look again". Keeping it to a single effect is what stops the
  // native view of ride state drifting from this one.
  useEffect(() => {
    try {
      refreshRideBubble();
    } catch {
      // Bridge unavailable (e.g. legacy remote debugging). The bubble repaints
      // on the next native event regardless.
    }
  }, [rideState?.ride, rideStatus]);

  const rideStatusApi = React.useMemo(
    () => ({
      rideStatus,
      setRideStatus,
    }),
    [setRideStatus, rideStatus],
  );

  const ride_api = React.useMemo(
    () => ({
      rideState,
      setRide,
      removeRide,
    }),
    [rideState, setRide, removeRide],
  );

  useEffect(() => {
    // Start event listener service only if there is an ongoing ride
    async function _startEventService() {
      console.log("Starting event service for ongoing ride...");
      await startEventService();
    }
    async function _stopEventService() {
      console.log("No ongoing ride found, stoping event service.");
      await stopEventService();
    }
    if (rideState?.ride?.data) {
      _startEventService();
      return;
    }
    _stopEventService();
  }, [rideState?.ride?.data]);
  return (
    <RideRequestApiContext.Provider value={ride_api}>
      <RideRequestStatusContext.Provider value={rideStatusApi}>
        <DriverLocationProvider>{children}</DriverLocationProvider>
      </RideRequestStatusContext.Provider>
    </RideRequestApiContext.Provider>
  );
};

interface RideStatus {
  hasRideStarted: boolean;
  hasRideCanceled: boolean;
  hasDriverArrived: boolean;
  // let keep track of driver arrival
  arrivedAt?: number;
  waitingTime?: string;
}

interface RideState {
  rideStatus: RideStatus;
}

type RideAction = {
  type: string;
  payload?: Partial<RideStatus>;
};
