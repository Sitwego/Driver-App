import { TrueSheet, TrueSheetProps } from "@lodev09/react-native-true-sheet";
import {
  ReanimatedTrueSheet,
  useReanimatedTrueSheet,
} from "@lodev09/react-native-true-sheet/reanimated";
import { useNavigation } from "@react-navigation/native";
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  DeviceEventEmitter,
  Linking,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedReaction,
  useAnimatedStyle,
  SharedValue,
  WithSpringConfig,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  useCreateRideRequestMutation,
  useEndrideRequestMutation,
  useSetDriverArrived,
} from "~/hooks/useRideApi";
import {
  useRideRequest,
  useRideRequestStatus,
} from "~/lib/Providers/UseRideRequestProvider";
import { locationStore } from "~/lib/store";
import { s } from "~/styles/Common-Styles";
import { RideNotificationType } from "~/types/rideRequstTypes";
import SwipeSlider from "~/ui/SliderButton";
import { useAppTheme } from "~/ui/theme/ThemeProvider";
import { atoms } from "~/ui/theme/atoms";
import { themes } from "~/ui/theme/theme_utils";
import { height, width } from "~/utils/metrics/dimm";
import { generateGoogleMapsNavigationLink } from "~/utils/navigation";
import { makePhoneCall } from "~/utils/open_uri";

import Icon from "../Icons";
import RnText from "../RnText";
import { useOvertimeCharge } from "../TimerComponent";

import { ACTBottomSheetProps } from "./BottomSheetProvider";
import { ChatBottomSheet } from "./ChatBottomSheet";
import { OtpBottomSheet } from "./OtpBottomSheet";

interface Props {
  children: React.ReactNode;
  // Shared values owned by BottomSheetProvider and exposed via SheetAnimationContext.
  // RnBottomSheetView syncs the real TrueSheet animated values into these so any
  // component in the tree can consume them through useSheetAnimation().
  sheetAnimatedIndex: SharedValue<number>;
  sheetAnimatedPosition: SharedValue<number>;
}
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface GestureSheetProps extends TrueSheetProps {}

const RnBottomSheetView = forwardRef(
  (
    {
      children,
      sheetAnimatedIndex,
      sheetAnimatedPosition,
      ...rest
    }: Props & GestureSheetProps,
    ref,
  ) => {
    const sheetRef = useRef<TrueSheet>(null);
    const chatSheetRef = useRef<TrueSheet>(null);
    const navigation = useNavigation<any>();
    const otpSheetRef = useRef<TrueSheet>(null);
    const insets = useSafeAreaInsets();
    const [data, setData] = useState<ACTBottomSheetProps>();
    const { rideStatus, setRideStatus } = useRideRequestStatus();
    const { mutateAsync: _endRide } = useEndrideRequestMutation();
    const { mutateAsync: startRide } = useCreateRideRequestMutation();
    const { mutateAsync: setDriverArrivedMutation } = useSetDriverArrived();
    const { colors } = useAppTheme();
    const { rideState } = useRideRequest();

    const overtimeCharge = useOvertimeCharge();
    const overtimeChargeRef = useRef(overtimeCharge);
    useLayoutEffect(() => {
      overtimeChargeRef.current = overtimeCharge;
    });

    const hasRideStarted = rideStatus?.rideStatus?.hasRideStarted;

    const ride = (rideState as { ride: RideNotificationType })?.ride;

    const { animatedPosition: buttonY, animatedIndex } =
      useReanimatedTrueSheet();

    // Sync TrueSheet's values into the shared values exposed via context so
    // sibling/ancestor components (e.g. MapScreen) can react to sheet motion.
    useAnimatedReaction(
      () => animatedIndex.value,
      (value) => {
        sheetAnimatedIndex.value = value;
      },
    );
    useAnimatedReaction(
      () => buttonY.value,
      (value) => {
        sheetAnimatedPosition.value = value;
      },
    );

    const show = useCallback(
      async (props: React.SetStateAction<ACTBottomSheetProps | undefined>) => {
        setData(props);
        if (sheetRef.current) {
          // await delay(100);
          await sheetRef.current.present(0);
        }
      },
      [],
    );

    const hide = useCallback(async () => {
      buttonY.value = 0;
      await sheetRef.current?.dismiss();
    }, [buttonY]);

    useImperativeHandle(ref, () => ({ show, hide }));

    const onClose = useCallback(() => {
      buttonY.value = 0;
      if (ride?.id && !rideStatus?.rideStatus?.hasRideCanceled) {
        DeviceEventEmitter.emit("onRideSheetDismissed");
      }
    }, [buttonY, ride, rideStatus]);

    const controlsStyle = useAnimatedStyle(() => {
      // --- Position ---
      // animatedPosition is the Y coordinate of the sheet's top edge from the
      // top of the screen. As the sheet is pulled DOWN, buttonY grows.
      // The controls view has `bottom: 0`, so its bottom edge sits at the
      // screen bottom without any transform.
      //
      // Formula:  translateY = buttonY - screenHeight - GAP
      //
      //   • buttonY - screenHeight  →  aligns controls bottom edge with the
      //     sheet's top edge (both referenced from the screen bottom).
      //   • - GAP                   →  lifts controls GAP pixels above the top
      //     edge of the sheet.
      //
      // ↑ Increase GAP for more breathing room above the sheet.
      // ↓ Decrease GAP to bring controls closer to the sheet edge.
      const GAP = 4; // px above the sheet's top edge — adjust here
      const translateY = buttonY.value - height - GAP;

      // --- Visibility ---
      // animatedIndex goes from -1 (fully dismissed) → 0 (first detent) → 1 (fully open).
      // Mapping [-1, 0] → [0, 1] means the controls fade in and scale up as the
      // sheet rises from dismissed to its first snap point, and reverse smoothly
      // when the sheet is pulled down toward dismissal.
      //
      // ↑ Change -1 to a value closer to 0 (e.g., -0.5) for a shorter fade zone.
      // ↓ Change 0 to a higher detent index to keep fading beyond the first snap.
      const visibility = interpolate(
        animatedIndex.value,
        [-1, 0], // input: dismissed → first detent
        [0, 1], // output: hidden → fully visible
        {
          extrapolateLeft: Extrapolation.CLAMP,
          extrapolateRight: Extrapolation.CLAMP,
        },
      );

      return {
        transform: [{ translateY }, { scale: visibility }],
        opacity: visibility,
      };
    }, [buttonY, animatedIndex]);

    const onOpenNavigation = useCallback(async () => {
      const dropOff = ride?.data?.to.geo_point;
      if (!dropOff) return;
      const { latitude, longitude } = dropOff;
      const navUrl = generateGoogleMapsNavigationLink(
        { lat: latitude, lng: longitude },
        { travelMode: "d" },
      );
      try {
        const supported = await Linking.canOpenURL(navUrl);
        if (supported) {
          await Linking.openURL(navUrl);
        }
      } catch (error) {
        console.log("Error opening navigation:", error);
      }
    }, [ride?.data?.to.geo_point]);

    const openChatSheet = useCallback(async () => {
      await chatSheetRef.current?.present();
    }, []);

    const showOtpSheet = useCallback(async () => {
      await otpSheetRef.current?.present();
    }, []);

    const confirmOtp = useCallback(
      async (otp: string) => {
        console.log(
          "Confirming OTP:",
          otp,
          "Overtime charge:",
          overtimeChargeRef.current,
        );
        await startRide({
          start_otp: otp,
          waiting_charge: Number(overtimeChargeRef.current) || 0,
          toll: 0,
          extra_dx: 0,
        });
        sheetRef.current?.resize(0);
        setRideStatus({
          type: "UPDATE_RIDE_STATUS",
          payload: {
            hasRideStarted: true,
            hasDriverArrived: undefined,
            hasRideCanceled: false,
          },
        });
      },
      [setRideStatus, startRide],
    );
    const endRide = useCallback(async () => {
      if (!ride) return;
      const lastKnown = locationStore.get(["location"]);
      console.log("Last known location:", lastKnown);
      const last_location = lastKnown
        ? { latitude: lastKnown.latitude, longitude: lastKnown.longitude }
        : ride.data.to.geo_point;

      await _endRide({ last_location });
      navigation.navigate("CollectCashAndConfirmRideEnded", {
        ride_id: ride.id,
        fare: ride.data.fare,
      });
      await hide();
    }, [_endRide, hide, navigation, ride]);

    const setDriverArrived = useCallback(async () => {
      const arrivedAt = new Date().getTime();
      setRideStatus({
        type: "UPDATE_RIDE_STATUS",
        payload: { hasDriverArrived: true, arrivedAt },
      });
      await setDriverArrivedMutation({ arrivedAt });
    }, [setDriverArrivedMutation, setRideStatus]);

    const renderComponent = useMemo(
      () =>
        data?.cmp
          ? data.cmp({
              showOtpSheet,
              endRide,
              setArrived: setDriverArrived,
            })
          : null,
      [data, showOtpSheet, endRide, setDriverArrived],
    );

    useEffect(() => {
      if (!rideStatus?.rideStatus?.hasRideCanceled) return;
      const dismissAndReset = async () => {
        await sheetRef.current?.dismiss(false);
        setRideStatus({
          type: "UPDATE_RIDE_STATUS",
          payload: {
            hasRideCanceled: false,
            hasRideStarted: false,
            hasDriverArrived: false,
          },
        });
      };
      dismissAndReset();
    }, [rideStatus, setRideStatus]);

    useEffect(() => {
      const sub = DeviceEventEmitter.addListener("onReopenRideSheet", () => {
        sheetRef.current?.present(0);
      });
      return () => sub.remove();
    }, []);

    const footerComponent = useCallback(
      () => (
        <GestureHandlerRootView
          style={[s.alignCenter, { paddingBottom: insets.bottom - 8 }]}
        >
          <View style={[s.w100pct, s.alignCenter]}>
            <View style={styles.Up_rideData}>
              {hasRideStarted && (
                <SwipeSlider
                  onSwipeComplete={endRide}
                  initialTrackColor={themes.red_400}
                  completeTrackColor={themes.red_500}
                  sliderBackgroundColor={colors.text}
                  textColor={colors.text}
                  initialText="Slide to End the ride"
                  completeText="Ride Completed"
                  endIcon={
                    <Icon name="HandCoins" size={24} color={themes.red_500} />
                  }
                  startIcon={
                    <Icon
                      name="ChevronsRight"
                      size={24}
                      color={themes.red_400}
                    />
                  }
                  borderRadius={16}
                  sliderTrackWidth={width * 0.9}
                  sliderSize={50}
                  sliderTrackHeight={50}
                  enableHaptics={true}
                  reduceMotion="never"
                />
              )}
            </View>
          </View>
        </GestureHandlerRootView>
      ),
      [colors.text, endRide, hasRideStarted, insets.bottom],
    );

    return (
      <>
        {children}
        <ReanimatedTrueSheet
          detents={[0.45, 1]}
          name="RIDE-SHEET"
          ref={sheetRef}
          dismissible={true}
          dimmedDetentIndex={1}
          backgroundColor={colors.background}
          cornerRadius={20}
          onDidDismiss={onClose}
          footer={footerComponent}
          {...rest}
        >
          <GestureHandlerRootView style={styles.sheetContent}>
            {renderComponent}
          </GestureHandlerRootView>
          <ChatBottomSheet ref={chatSheetRef} />
          <OtpBottomSheet confirmOtpCodes={confirmOtp} ref={otpSheetRef} />
        </ReanimatedTrueSheet>
        {ride?.opened && (
          <Animated.View style={[styles.controls, controlsStyle]}>
            {!hasRideStarted && (
              <View style={[atoms.gap_lg, styles.controlsRow]}>
                <Pressable
                  onPress={() => {
                    makePhoneCall(ride.data.rider_info?.phone_number!);
                  }}
                  style={[$CTRL_styles.CTRL_contact_view]}
                >
                  <Icon
                    strokeWidth={2.5}
                    name="Phone"
                    size={30}
                    color={colors.primary}
                  />
                </Pressable>
                <Pressable
                  onPress={openChatSheet}
                  style={[$CTRL_styles.CTRL_contact_view]}
                >
                  <Icon
                    strokeWidth={2.4}
                    name="MessageCircle"
                    size={30}
                    color={colors.primary}
                  />
                </Pressable>
              </View>
            )}
            <View style={atoms.flex_1}>
              <Pressable
                onPress={onOpenNavigation}
                style={[
                  $CTRL_styles.CTRL_contact_navigation,
                  { backgroundColor: colors.primary },
                ]}
              >
                <Icon
                  strokeWidth={2}
                  name="Navigation"
                  size={24}
                  color={colors.text}
                />
                <RnText style={atoms.text_sm}>Map</RnText>
              </Pressable>
            </View>
          </Animated.View>
        )}
      </>
    );
  },
);

export default RnBottomSheetView;
RnBottomSheetView.displayName = "RnBottomSheetView";

const styles = StyleSheet.create({
  Up_rideData: {
    marginBottom: 8,
    paddingVertical: 5,
    borderRadius: 16,
  },
  controls: {
    position: "absolute",
    flexDirection: "row",
    justifyContent: "space-between",
    alignSelf: "center",
    bottom: 0,
    flex: 1,
    width: "91%",
  },
  controlsRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  sheetContent: {
    flexGrow: 1,
    flexBasis: "100%",
    paddingHorizontal: 8,
  },
});

const $CTRL_styles = StyleSheet.create({
  CTRL_contact_view: {
    width: 48,
    height: 35,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    padding: 4,
    backgroundColor: "white",
  },
  CTRL_contact_navigation: {
    height: 38,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    borderRadius: 24,
    alignSelf: "flex-end",
  },
});

export const SPRING_CONFIG: WithSpringConfig = {
  damping: 500,
  stiffness: 1000,
  mass: 3,
  overshootClamping: true,
};
