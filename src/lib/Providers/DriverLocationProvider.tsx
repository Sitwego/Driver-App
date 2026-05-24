import React, {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useRideRequest } from "~/lib/Providers/UseRideRequestProvider";
import { nativeAppEvents, getETA } from "~/lib/native";
import { RideNotificationType } from "~/types/rideRequstTypes";
import { GpsData, OnGpsData } from "~/utils/geo";

interface DriverLocationContextValue {
  currentDriverLocation: GpsData | undefined;
  etaInfo: { distance: number; eta: number } | null;
  latestGeoKalman: OnGpsData | null;
}

const DriverLocationContext = createContext<DriverLocationContextValue | null>(
  null,
);

export const DriverLocationProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [currentDriverLocation, setCurrentDriverLocation] = useState<GpsData>();
  const [etaInfo, setEtaInfo] = useState<{
    distance: number;
    eta: number;
  } | null>(null);
  const [latestGeoKalman, setLatestGeoKalman] = useState<OnGpsData | null>(
    null,
  );

  const { rideState } = useRideRequest();
  const ride = useMemo(
    () => (rideState as { ride: RideNotificationType })?.ride,
    [rideState],
  );

  const getLocationStatusOnPath = useCallback(
    async (
      {
        geo_point: { latitude, longitude },
        accuracy,
        pitch,
        heading: _heading,
        bearing,
        speed,
      }: GpsData,
      _altitude: number,
    ) => {
      const polylinePoints = ride?.data?.ride_line_str || [];
      setCurrentDriverLocation({
        geo_point: { latitude, longitude },
        accuracy,
        pitch,
        bearing,
      });
      if (!polylinePoints.length) return;
      const _eta = await getETA(
        latitude,
        longitude,
        speed,
        JSON.stringify(polylinePoints),
      );
      const eta = JSON.parse(_eta);
      setEtaInfo({ distance: eta.distance, eta: eta.eta });
    },
    [ride?.data?.ride_line_str],
  );

  useEffect(() => {
    const sub = nativeAppEvents.addListener(
      "onGeoKalman",
      async (data: OnGpsData) => {
        const { latitude, longitude, accuracy, bearing, altitude, speed } =
          data;
        getLocationStatusOnPath(
          { geo_point: { latitude, longitude }, accuracy, bearing, speed },
          altitude,
        );
        setLatestGeoKalman(data);
      },
    );
    return () => sub.remove();
  }, [getLocationStatusOnPath]);

  return (
    <DriverLocationContext.Provider
      value={{ currentDriverLocation, etaInfo, latestGeoKalman }}
    >
      {children}
    </DriverLocationContext.Provider>
  );
};

export const useDriverLocation = (): DriverLocationContextValue => {
  const ctx = use(DriverLocationContext);
  if (!ctx)
    throw new Error(
      "useDriverLocation must be used within DriverLocationProvider",
    );
  return ctx;
};
