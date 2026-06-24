import { PressableScale as Pressable } from "pressto";
import React, {
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from "react";
import { ViewProps, StyleSheet, View } from "react-native";
import {
  useSharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  interpolate,
  AnimatedProps,
  withTiming,
  runOnJS,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAcceptRideRequestMutation } from "~/hooks/useRideApi";
import { useRideRequest } from "~/lib/Providers/UseRideRequestProvider";
import { rideStore } from "~/lib/store";
import { RideNotificationType } from "~/types/rideRequstTypes";
import { UpcomingRideInfo } from "~/ui/Views/UpcomingRide";
import { useAppTheme } from "~/ui/theme/ThemeProvider";
import { atoms } from "~/ui/theme/atoms";
import { height } from "~/utils/metrics/dimm";

import Avatar from "./Avatar";
import Icon from "./Icons";
import ProgressBarTimer from "./RequestTimeout";
import { useBottomSheet } from "./RnBottomSheet/BottomSheetProvider";
import RnText from "./RnText";
import { RnAnimatedView, RnView } from "./RnView";
import PickupToDestination from "./route/PickUpDropOff-Indicator";

export const BackDropView: React.FC<
  AnimatedProps<ViewProps> & { close: () => void }
> = ({ close, ...rest }) => {
  const { colors } = useAppTheme();
  const { top } = useSafeAreaInsets();
  return (
    <RnAnimatedView
      {...rest}
      style={[
        {
          position: "absolute",
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
          backgroundColor: "transparent",
          zIndex: 0,
        },
      ]}
    >
      <Pressable
        onPress={close}
        style={{
          top: top + 16,
          right: 16,
          position: "absolute",
          alignItems: "center",
          justifyContent: "center",
          width: 48,
          height: 48,
          zIndex: 1,
          backgroundColor: "rgba(0, 0, 0, 0.6)",
          borderRadius: 24,
        }}
      >
        <Icon name="X" size={26} strokeWidth={2} color={colors.text} />
      </Pressable>
    </RnAnimatedView>
  );
};

/** Just for debugging */
const initialIsModalOpened = false;
interface Props {
  children: React.ReactNode | React.ReactElement;
}
const RequestNotificationModal = React.forwardRef(
  ({ children }: Props, ref) => {
    const { colors, fonts } = useAppTheme();
    const insets = useSafeAreaInsets();
    const { rideState, removeRide, setRide } = useRideRequest();
    const { mutateAsync: accepRideRequset, isPending } =
      useAcceptRideRequestMutation();
    const ride = useMemo(() => {
      return (rideState as { ride: RideNotificationType })?.ride;
    }, [rideState]);

    useImperativeHandle(ref, () => ({
      open: onRequestPress,
      close: closeModal,
    }));
    const openAnimValue = useSharedValue(initialIsModalOpened ? 1 : 0);
    const { show } = useBottomSheet();
    const getIsModalOpened = useCallback(
      () => openAnimValue.value === 1,
      [openAnimValue],
    );

    const backdropProps = useAnimatedProps(() => ({
      pointerEvents:
        openAnimValue.value === 1 ? ("auto" as const) : ("box-none" as const),
    }));

    const drawerContainerProps = useAnimatedProps(() => ({
      pointerEvents:
        openAnimValue.value === 1 ? ("auto" as const) : ("none" as const),
    }));

    const translateYStyle = useAnimatedStyle(() => ({
      transform: [
        {
          translateY: interpolate(openAnimValue.value, [0, 1, 2], [90, 0, 90]),
        },
      ],
    }));
    const opacityStyle = useAnimatedStyle(() => ({
      opacity: interpolate(openAnimValue.value, [0, 1, 2], [0, 1, 0]),
    }));
    const maxHeight = height - insets.bottom - insets.top;

    const [isOpened, setIsOpened] = useState(false);

    const openModal = useCallback(() => {
      setIsOpened(true);

      openAnimValue.value = 0;
      openAnimValue.value = withTiming(1, { duration: 400 }, (finished) => {
        if (finished) {
          // Do something when the animation is finished
        }
      });
    }, [openAnimValue]);

    const closeModal = useCallback(() => {
      const animCallback = async () => {
        setIsOpened(false);
      };
      openAnimValue.value = withTiming(2, { duration: 400 }, (finished) => {
        if (finished) {
          openAnimValue.value = 0;
          runOnJS(animCallback)();
        }
      });
    }, [openAnimValue]);

    const onRequestPress = useCallback(() => {
      if (getIsModalOpened()) {
        closeModal();
      } else {
        openModal();
      }
    }, [getIsModalOpened, closeModal, openModal]);

    const vc = ride?.data?.vc!;

    const onAcceptRideRequest = useCallback(async () => {
      closeModal();
      const ride_data = {
        ...ride,
        opened: true,
      } as RideNotificationType;
      // Call the accept ride request API To notify the backend
      if (!ride?.data?.id) return;
      const accepted = await accepRideRequset({
        ride_id: ride_data.id,
        from: ride_data.data.from.geo_point,
        to: ride_data.data.to.geo_point,
        vc,
      });
      // Persist the server-locked pickup (approach) fare onto the ride so the
      // end-ride breakdown can surface it. Server is authoritative here.
      ride_data.data.pickup_fare = accepted?.pickup_fare ?? 0;
      setRide(ride_data);
      rideStore.set(["ride"], {
        ride: ride_data,
      });
    }, [accepRideRequset, closeModal, ride, setRide, vc]);

    const onCancelRideRequest = useCallback(async () => {
      removeRide();
      closeModal();
    }, [removeRide, closeModal]);

    useEffect(() => {
      if (!getIsModalOpened() && ride?.opened) {
        console.log("CAN_OPPEN_BOTTOM_SHEET", ride?.opened);
        show({
          hasBackDrop: true,
          hasCancel: true,
          snaps: ["50%", height * 0.5 + 56],
          enablePanDownToClose: true,
          cmp: (props) => <UpcomingRideInfo {...props} />,
        });
      }
    }, [getIsModalOpened, ride, show]);

    useEffect(() => {
      if (!ride || !ride?.data) return;
      console.log("Ride Request Notification Data Changed:-", ride?.opened);
      if (!ride?.opened) {
        onRequestPress();
      }
    }, [onRequestPress, ride]);

    const fare = useMemo(() => `${ride?.data?.fare}Ksh`, [ride?.data?.fare]);

    const pickupToDestination = useMemo(() => {
      if (!ride?.data) return null;
      return (
        <PickupToDestination
          from={{
            city: ride?.data?.from?.city,
            street: ride.data?.from?.street,
            ward: ride.data?.from?.ward,
            country: ride.data?.from?.country ?? undefined,
          }}
          to={{
            city: ride.data?.to?.city,
            street: ride.data?.to?.street,
            ward: ride.data?.to?.ward,
            country: ride.data?.to?.country ?? undefined,
          }}
        />
      );
    }, [ride?.data]);

    // create rider name from the ride data
    const riderName = useMemo(() => {
      const firstName = ride?.data?.rider_info?.first_name ?? "Rider";
      const lastName = ride?.data?.rider_info?.last_name ?? "Name";
      return `${firstName} ${lastName}`;
    }, [ride?.data?.rider_info?.first_name, ride?.data?.rider_info?.last_name]);

    console.log("Ride Request Modal Rendered with Ride Data:-", ride);

    return (
      <React.Fragment>
        {children}
        {isOpened && (
          <>
            <BackDropView
              close={onCancelRideRequest}
              animatedProps={backdropProps}
              style={opacityStyle}
            />

            <RnAnimatedView
              animatedProps={drawerContainerProps}
              style={[
                opacityStyle,
                translateYStyle,
                {
                  width: "100%",
                  display: "flex",
                  maxHeight: maxHeight,
                  paddingHorizontal: 10,
                  paddingTop: insets.top - 10,
                  paddingBottom: insets.bottom + 16 + 50,
                  alignSelf: "flex-end",
                  justifyContent: "flex-end",
                  position: "absolute",
                  bottom: 0,
                  backgroundColor: colors.background,
                  borderTopRightRadius: 16,
                  borderTopLeftRadius: 16,
                },
              ]}
            >
              <RnView
                style={{
                  width: "100%",
                  justifyContent: "flex-start",
                  flexDirection: "column",
                }}
              >
                <View
                  style={[
                    atoms.gap_md,
                    {
                      flexDirection: "row",
                      alignItems: "center",
                      paddingVertical: 8,
                    },
                  ]}
                >
                  <RnText
                    style={[
                      atoms.text_md,
                      { fontFamily: fonts.heavy.fontFamily },
                    ]}
                  >
                    {fare}
                  </RnText>

                  <RnText
                    style={[
                      atoms.text_xl,
                      {
                        fontFamily: fonts.heavy.fontFamily,
                        color: colors.lightGray,
                      },
                    ]}
                  >
                    {vc}
                  </RnText>
                </View>
                <ProgressBarTimer duration={20} close={onCancelRideRequest} />
              </RnView>
              <RnView style={[styles.content_view]}>
                {pickupToDestination}
                <RnView style={{ marginBottom: 16 }} />
                <RnView style={[styles.USER_details]}>
                  <RnView
                    style={[
                      {
                        flexDirection: "row",
                        alignContent: "center",
                        alignItems: "flex-start",
                        justifyContent: "center",
                      },
                      atoms.gap_xs,
                    ]}
                  >
                    <Avatar size={35} onLoad={() => {}} />
                    <RnText
                      style={[atoms.text_xs, { color: colors.lightGray }]}
                    >
                      {riderName}
                    </RnText>
                  </RnView>
                  <RnView
                    style={[
                      {
                        flexDirection: "row",
                        justifyContent: "center",
                        alignItems: "center",
                      },
                      atoms.gap_xs,
                    ]}
                  >
                    <Icon name="Star" size={24} color={colors.lightGray} />
                    <RnText
                      style={[atoms.text_xs, { color: colors.lightGray }]}
                    >
                      {ride?.data?.rider_info?.total_rating_score
                        ? ride.data.rider_info.total_rating_score.toFixed(1)
                        : "N/A"}
                    </RnText>
                  </RnView>
                </RnView>
              </RnView>
            </RnAnimatedView>
            <Pressable
              onPress={onAcceptRideRequest}
              style={[
                {
                  padding: 14,
                  width: "95%",
                  alignSelf: "center",
                  borderRadius: 16,
                  bottom: insets.bottom + 5,
                  backgroundColor: colors.primary,
                  justifyContent: "center",
                  alignItems: "center",
                },
              ]}
            >
              <RnText style={[{ fontFamily: fonts.regular.fontFamily }]}>
                ACCEPT REQUEST
              </RnText>
            </Pressable>
          </>
        )}
      </React.Fragment>
    );
  },
);
RequestNotificationModal.displayName = "RequestNotificationModal";
export default memo(RequestNotificationModal);

const styles = StyleSheet.create({
  content_view: {
    flex: 1,
    flexDirection: "column",
    justifyContent: "flex-start",
  },
  USER_details: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
});
