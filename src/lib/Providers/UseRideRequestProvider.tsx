import React, { useCallback, useEffect } from "react";

import { DriverLocationProvider } from "~/lib/Providers/DriverLocationProvider";
import { RideEvent, RideRequsetNotification } from "~/types/rideRequstTypes";
import { formatedRideData, parseRideRequestData } from "~/utils/rideUtils";

import {
  nativeAppEvents,
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

  const removeRide = React.useCallback(() => {
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
  useEffect(() => {
    const subs = [
      nativeAppEvents.addListener(
        "onRideReqMessage",
        (ride_request: RideRequsetNotification) => {
          const ride_data = parseRideRequestData(ride_request);
          if (!ride_data.data) return;
          let notificationData = formatedRideData(ride_data.data);
          setRideState({
            type: "SET_RIDE",
            payload: {
              ...ride_data,
              data: notificationData,
            },
          });
        },
      ),
      nativeAppEvents.addListener("onRideEvent", event_handler),
    ];

    return () => {
      subs.forEach((sub) => sub.remove());
    };
  }, [event_handler]);

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
