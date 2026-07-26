import { PressableScale as Pressable } from "pressto";
import { useCallback, useEffect, useMemo, memo, useRef, useState } from "react";
import { View, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAppBottomSheet } from "~/components/AppBottomSheet";
import Icon from "~/components/Icons";
import { useBottomSheet } from "~/components/RnBottomSheet/BottomSheetProvider";
import RnText from "~/components/RnText";
import RnTextInput, {
  type AnimatedTextInputRef,
} from "~/components/RnTextInput";
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

const CancelRideNote = ({ onSubmit }: { onSubmit: (note: string) => void }) => {
  const { colors, fonts } = useAppTheme();
  const [note, setNote] = useState("");
  const inputRef = useRef<AnimatedTextInputRef>(null);

  // Focus after the sheet's own animate-in so the keyboard opens against its
  // final size, not a mid-animation one.
  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 350);
    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.cancelNoteContainer}>
      <RnText style={[atoms.text_lg, { fontFamily: fonts.bold.fontFamily }]}>
        Cancel ride request
      </RnText>
      <RnTextInput
        ref={inputRef}
        style={[
          styles.cancelNoteInput,
          {
            fontFamily: fonts.regular.fontFamily,
            color: colors.text,
            borderColor: colors.lightBackground,
          },
        ]}
        autoCorrect
        multiline
        numberOfLines={4}
        maxLength={300}
        textAlignVertical="top"
        value={note}
        onChangeText={setNote}
        placeholder="Add a note for this cancellation (optional)"
        placeholderTextColor={colors.lightGray}
      />
      <Pressable
        onPress={() => onSubmit(note)}
        style={[
          styles.START_button,
          { backgroundColor: themes.red_600, width: "100%" },
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
    </View>
  );
};

export const UpcomingRideInfo = memo(function UpcomingRideInfo({
  showOtpSheet,
  setArrived,
}: Props) {
  const { fonts } = useAppTheme();
  const { bottom } = useSafeAreaInsets();
  const { hide } = useBottomSheet();
  const sheets = useAppBottomSheet();
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

  const onCanceltRideRequest = useCallback(
    async (note: string) => {
      await cancelRide({
        reason: "Unspecified",
        note: note.trim() || "None",
      }).catch((err) => {
        console.log("Error cancelling ride request:", err);
      });
      removeRide();
    },
    [cancelRide, removeRide],
  );

  const confirmCancelRide = useCallback(async () => {
    // A same-window portal sheet always renders below the TrueSheet-based
    // ride-info sheet (RnBottomSheetView.tsx) regardless of tree order, and
    // `nativeOverlay` (a separate native Dialog window) doesn't get the
    // Activity's `adjustResize` behavior, so keyboard: "avoid" can't work
    // inside it (verified on-device: autofocus never opens the keyboard, and
    // a manual tap opens it but hides the sheet content behind it). Dismiss
    // the TrueSheet first so the note sheet can render through the default
    // portal, where keyboard avoidance is verified working.
    await hide();
    const sheetId = sheets.present(
      <CancelRideNote
        onSubmit={(note) => {
          sheets.dismiss(sheetId);
          onCanceltRideRequest(note);
        }}
      />,
      {
        keyboard: "avoid",
        detents: ["content"],
      },
    );
  }, [hide, sheets, onCanceltRideRequest]);

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
              onPress={confirmCancelRide}
              disabled={isPending}
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
  cancelNoteContainer: {
    padding: 16,
    gap: 12,
  },
  cancelNoteInput: {
    width: "100%",
    minHeight: 96,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
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
