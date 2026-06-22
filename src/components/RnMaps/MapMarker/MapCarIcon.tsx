import React, { memo, useEffect, useMemo, useRef } from "react";
import { Animated, Image } from "react-native";
import { MarkerAnimated } from "react-native-maps";

import { SubscriptionCategory } from "~/navigation/types";
import {
  getMarkerRotation,
  getPolylineBearing,
  snapToPolyline,
  GeoPoint,
  GpsData,
} from "~/utils/geo";

const DEFAULT_VEHICLE_ICON = require("../../../../assets/images/ic_taxi.png");
const VEHICLE_TOP_VIEW_IMAGES: Record<string, number> = {
  Bike: require("../../../../assets/images/ny_ic_bike_top_view.png"),
  Auto: require("../../../../assets/images/ny_ic_auto_top_view.png"),
};

interface Props {
  geo_point: GpsData[];
  polylinePoints?: GeoPoint[];
  vc: SubscriptionCategory;
}

const MapCarIcon: React.FC<Props> = ({ geo_point, polylinePoints, vc }) => {
  const currentPosition = geo_point?.[0]?.geo_point;
  const prevPositionRef = useRef<typeof currentPosition>(undefined);
  const coordAnim = useRef<Animated.ValueXY | null>(null);
  const rotationAngle = useMemo(() => new Animated.Value(0), []);
  // Accumulated angle (unbounded) so we always take the shortest arc.
  const accumulatedAngleRef = useRef(0);

  // Snap GPS position onto the road; fall back to raw GPS when no polyline.
  const displayPosition = useMemo(() => {
    if (!currentPosition) return null;
    if (polylinePoints && polylinePoints.length >= 2) {
      return snapToPolyline(currentPosition, polylinePoints) ?? currentPosition;
    }
    return currentPosition;
  }, [currentPosition, polylinePoints]);

  if (!coordAnim.current && displayPosition) {
    coordAnim.current = new Animated.ValueXY({
      x: displayPosition.latitude,
      y: displayPosition.longitude,
    });
  }

  useEffect(() => {
    const prev = prevPositionRef.current;
    prevPositionRef.current = currentPosition;

    if (
      !currentPosition ||
      !prev ||
      (prev.latitude === currentPosition.latitude &&
        prev.longitude === currentPosition.longitude)
    ) {
      return; // no movement — hold current heading
    }

    // Prefer road-segment bearing from polyline; fall back to GPS-to-GPS.
    const rawBearing =
      (displayPosition &&
        polylinePoints &&
        getPolylineBearing(displayPosition, polylinePoints)) ??
      getMarkerRotation(prev, currentPosition);
    const accumulated = accumulatedAngleRef.current;

    // Shortest angular delta: clamp to [-180, 180]
    let delta = rawBearing - (accumulated % 360);
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;

    const next = accumulated + delta;
    accumulatedAngleRef.current = next;

    Animated.timing(rotationAngle, {
      toValue: next,
      duration: 1000,
      useNativeDriver: false,
    }).start();
  }, [currentPosition, rotationAngle, polylinePoints, displayPosition]);

  useEffect(() => {
    if (!displayPosition || !coordAnim.current) return;
    Animated.timing(coordAnim.current, {
      toValue: { x: displayPosition.latitude, y: displayPosition.longitude },
      duration: 1500,
      useNativeDriver: false,
    }).start();
  }, [displayPosition]);

  const CAR_ICON = useMemo(() => {
    switch (vc) {
      case "Bike":
        return VEHICLE_TOP_VIEW_IMAGES.Bike;
      case "TukTuk":
        return VEHICLE_TOP_VIEW_IMAGES.Auto;
      default:
        return DEFAULT_VEHICLE_ICON;
    }
  }, [vc]);

  if (!displayPosition) return null;

  console.log("Map Icon", CAR_ICON);

  return (
    <MarkerAnimated
      anchor={{ x: 0.5, y: 0.5 }}
      flat
      coordinate={{
        latitude: coordAnim.current!.x as unknown as number,
        longitude: coordAnim.current!.y as unknown as number,
      }}
      rotation={rotationAngle}
    >
      <Image
        source={CAR_ICON}
        style={{ height: 60, width: 60 }}
        resizeMode="contain"
      />
    </MarkerAnimated>
  );
};

export default memo(MapCarIcon);
