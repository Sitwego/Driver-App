import React from "react";
import { View, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Icon from "~/components/Icons";
import RnText from "~/components/RnText";
import { useDriverLocation } from "~/lib/Providers/DriverLocationProvider";
import { useRideRequest } from "~/lib/Providers/UseRideRequestProvider";
import { themes } from "~/ui/theme/theme_utils";

const EtaBadge = () => {
  const { etaInfo } = useDriverLocation();
  const { rideState } = useRideRequest();
  const { top } = useSafeAreaInsets();

  if (!rideState?.ride?.data || etaInfo == null) return null;

  const distanceLabel =
    etaInfo.distance < 1000
      ? `${Math.round(etaInfo.distance)} m`
      : `${(etaInfo.distance / 1000).toFixed(1)} km`;

  const etaLabel =
    etaInfo.eta < 60
      ? `${Math.round(etaInfo.eta)}s`
      : `${Math.round(etaInfo.eta / 60)} min`;

  return (
    <View style={[styles.badge, { top: top + 80 }]}>
      <View style={styles.row}>
        <Icon
          name="MapPin"
          size={13}
          strokeWidth={2.5}
          color={themes.primary_500}
        />
        <RnText style={styles.text}>{distanceLabel}</RnText>
      </View>
      <View style={styles.divider} />
      <View style={styles.row}>
        <Icon
          name="Clock"
          size={13}
          strokeWidth={2.5}
          color={themes.primary_500}
        />
        <RnText style={styles.text}>{etaLabel}</RnText>
      </View>
    </View>
  );
};

export default EtaBadge;

const styles = StyleSheet.create({
  badge: {
    position: "absolute",
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
    gap: 8,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  divider: {
    width: 1,
    height: 14,
    backgroundColor: themes.bg_700,
  },
  text: {
    fontSize: 13,
    fontWeight: "600",
    color: themes.bg_900,
  },
});
