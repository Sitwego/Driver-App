import React, { useCallback } from "react";
import { StyleSheet, TouchableOpacity, View, Text } from "react-native";
import MapView from "react-native-maps";

import Icon from "~/components/Icons";
import { useDriverLocation } from "~/lib/Providers/DriverLocationProvider";
import { themes } from "~/ui/theme/theme_utils";
import { getLocationAsync, GpsData } from "~/utils/geo";
import { height } from "~/utils/metrics/dimm";

interface MapToolbarProps {
  mapRef: React.RefObject<MapView>;
  currentLocation?: GpsData;
}

const MapToolbar = ({ mapRef, currentLocation }: MapToolbarProps) => {
  const onMyLocationPress = useCallback(async () => {
    const { latitude, longitude, altitude } = (await getLocationAsync()).coords;
    mapRef.current?.animateCamera(
      {
        center: { latitude, longitude },
        // heading: heading ?? undefined,
        altitude: altitude ?? undefined,
        zoom: 16,
      },
      { duration: 1000 },
    );
  }, [mapRef]);

  return (
    <TouchableOpacity
      style={styles.myLocationBtn}
      onPress={onMyLocationPress}
      activeOpacity={0.6}
    >
      <Icon name="LocateFixed" size={24} color={themes.bg_900} />
    </TouchableOpacity>
  );
};

export default MapToolbar;

const styles = StyleSheet.create({
  etaBadge: {
    position: "absolute",
    bottom: height * 0.75 + 60,
    right: 5,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  etaText: {
    fontSize: 13,
    fontWeight: "600",
    color: themes.bg_900,
  },
  myLocationBtn: {
    position: "absolute",
    bottom: height * 0.75,
    right: 5,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    borderRadius: 28,
    padding: 12,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
});
