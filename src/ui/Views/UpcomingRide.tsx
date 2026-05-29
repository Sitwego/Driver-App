import { PressableScale as Pressable } from "pressto";
import { useCallback, useMemo, memo } from "react";
import { View, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Icon from "~/components/Icons";
import { useBottomSheet } from "~/components/RnBottomSheet/BottomSheetProvider";
import RnText from "~/components/RnText";
import { RnView } from "~/components/RnView";
import TimerComponent, { useOvertimeCharge } from "~/components/TimerComponent";
import PickupToDestination from "~/components/route/PickUpDropOff-Indicator";
import { useCancelRideRequest } from "~/hooks/useRideApi";
import {
  useRideRequest,
  useRideRequestStatus,
} from "~/lib/Providers/UseRideRequestProvider";
import { s } from "~/styles/Common-Styles";
import { formatTime } from "~/utils/dates/utils";
import { roundToNearestTen, roundToOneDecimal } from "~/utils/metrics/numbers";

import { useAppTheme } from "../theme/ThemeProvider";
import { atoms } from "../theme/atoms";
import { themes } from "../theme/theme_utils";

type Props = {
  showOtpSheet: () => void;
  setArrived: () => Promise<void>;
  endRide: () => Promise<void>;
};

export const UpcomingRideInfo = memo(function UpcomingRideInfo({
  showOtpSheet,
  setArrived,
}: Props) {
  const { fonts } = useAppTheme();
  const { bottom } = useSafeAreaInsets();
  const { hide } = useBottomSheet();
  const { removeRide, rideState } = useRideRequest();
  const { rideStatus } = useRideRequestStatus();
  const { mutateAsync: cancelRide, isPending } = useCancelRideRequest();

  // Direct access — no computation, no benefit from useMemo
  const _ride_data = rideState?.ride?.data;
  const hasDriverArrived = rideStatus?.rideStatus.hasDriverArrived;
  const hasRideStarted = rideStatus?.rideStatus?.hasRideStarted ?? false;

  const formartedDx = useMemo(
    () => roundToOneDecimal(_ride_data?.distance ?? 0),
    [_ride_data?.distance],
  );

  const ride_duration = useMemo(
    () => formatTime(_ride_data?.duration ?? 0),
    [_ride_data?.duration],
  );

  const formattedFare = useMemo(
    () => roundToNearestTen(_ride_data?.fare ?? 0),
    [_ride_data?.fare],
  );

  const overtimeCharge = useOvertimeCharge();

  const onCanceltRideRequest = useCallback(async () => {
    await hide();
    await cancelRide({
      reason: "Unspecified",
      note: "None",
    }).catch((err) => {
      console.log("Error cancelling ride request:", err);
    });
    removeRide();
  }, [cancelRide, hide, removeRide]);

  return (
    <View style={styles.UP_container}>
      <View style={styles.Up_rideData}>
        <RnText
          style={[
            styles.Up_title,
            atoms.text_lg,
            { left: 10, fontFamily: fonts.heavy.fontFamily },
          ]}
        >
          {_ride_data?.vc}
        </RnText>
        <View style={styles.Up_eta_container}>
          <View style={[styles.ETA_info_view, atoms.gap_xs]}>
            <Icon
              name="Hourglass"
              size={16}
              strokeWidth={2}
              color={themes.bg_400}
            />
            <RnText
              style={[
                atoms.text_sm,
                styles.ETA_time,
                { fontFamily: fonts.regular.fontFamily },
              ]}
            >
              {ride_duration}
            </RnText>
          </View>
          <View style={[styles.ETA_info_view, atoms.gap_xs]}>
            <Icon
              name="Waypoints"
              size={16}
              strokeWidth={2}
              color={themes.bg_400}
            />
            <RnText
              style={[
                atoms.text_sm,
                styles.ETA_time,
                { fontFamily: fonts.regular.fontFamily },
              ]}
            >
              {formartedDx}Km
            </RnText>
          </View>
          <View style={[styles.ETA_info_view, atoms.gap_xs]}>
            <Icon
              name="HandCoins"
              size={16}
              strokeWidth={2}
              color={themes.bg_400}
            />
            <RnText
              style={[
                atoms.text_sm,
                styles.ETA_time,
                { fontFamily: fonts.regular.fontFamily },
              ]}
            >
              {formattedFare} KSH
              <RnText style={[atoms.text_sm, { color: "#FFD700" }]}>
                {overtimeCharge > 0 ? ` (+ ${overtimeCharge})` : ""}
              </RnText>
            </RnText>
          </View>
        </View>
        <RnView style={[s.w100pct, s.flexDirectionRow, s.gap40, s.px10]}>
          <RnView>
            <RnText
              style={[atoms.text_sm, { fontFamily: fonts.regular.fontFamily }]}
            >
              Waiting time
            </RnText>
          </RnView>
          <TimerComponent />
        </RnView>
      </View>
      <View style={styles.Up_rideData}>
        <PickupToDestination
          from={{
            city: _ride_data?.from?.city,
            street: _ride_data?.from?.street,
            ward: _ride_data?.from?.ward,
            country: _ride_data?.from?.country,
          }}
          to={{
            city: _ride_data?.to?.city,
            street: _ride_data?.to?.street,
            ward: _ride_data?.to?.ward,
            country: _ride_data?.to?.country,
          }}
        />
      </View>
      {!hasRideStarted && (
        <>
          <RnView collapsable={false} style={styles.Up_buttonRow}>
            <Pressable
              onPress={async () => {
                // hasDriverArrived ? showOtpSheet() : setArrived();
                if (hasDriverArrived) {
                  await showOtpSheet();
                } else {
                  await setArrived();
                }
              }}
              style={[
                styles.START_button,
                {
                  backgroundColor: themes.primary_600,
                  width: "95%",
                  zIndex: 999,
                },
              ]}
            >
              {hasDriverArrived ? (
                <RnText>Start Ride</RnText>
              ) : (
                <RnText style={{ textAlign: "center" }}>
                  Arrived at pick up location?
                </RnText>
              )}
            </Pressable>
          </RnView>
          <RnView
            collapsable={false}
            style={[
              s.flex1,
              s.flexGrow1,
              s.justifyFlexEnd,
              { marginBottom: bottom + 20 },
            ]}
          >
            <Pressable
              onPress={onCanceltRideRequest}
              enabled={!isPending}
              style={[
                styles.START_button,
                { backgroundColor: themes.red_600, width: "95%", zIndex: 999 },
              ]}
            >
              <RnText
                style={[
                  atoms.text_md,
                  { color: themes.bg_100, fontFamily: fonts.bold.fontFamily },
                ]}
              >
                Cancel Request
              </RnText>
            </Pressable>
          </RnView>
        </>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  UP_container: {
    flex: 1,
    paddingVertical: 10,
  },
  Up_rideData: {
    marginBottom: 8,
    paddingVertical: 5,
    borderRadius: 16,
    backgroundColor: themes.bg_900,
  },
  Up_buttonRow: {},
  Up_title: {},
  Up_route_text: {
    color: themes.bg_300,
  },
  Up_eta_container: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 20,
    paddingHorizontal: 10,
    alignItems: "center",
  },
  ETA_info_view: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  ETA_icon: {},
  ETA_time: {
    color: themes.bg_300,
  },
  START_button: {
    padding: 14,
    height: 50,
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "center",
    borderRadius: 10,
  },
});
