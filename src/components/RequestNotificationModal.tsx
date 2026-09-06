import React, {
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import {
  useSharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  interpolate,
  withTiming,
  runOnJS,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAcceptRideRequestMutation } from "~/hooks/useRideApi";
import { useRideRequest } from "~/lib/Providers/UseRideRequestProvider";
import { clearPendingRideRequest } from "~/lib/native";
import { rideStore } from "~/lib/store";
import { RideNotificationType } from "~/types/rideRequstTypes";
import { UpcomingRideInfo } from "~/ui/Views/UpcomingRide";
import { useAppTheme } from "~/ui/theme/ThemeProvider";
import { atoms } from "~/ui/theme/atoms";
import { themes } from "~/ui/theme/theme_utils";
import { height, width } from "~/utils/metrics/dimm";
import {
  normalizeDriverFareSplit,
  rideRequestRemainingSec,
} from "~/utils/rideUtils";

import Avatar from "./Avatar";
import Icon from "./Icons";
import ProgressBarTimer from "./RequestTimeout";
import OfferBanner from "./RideOffer/OfferBanner";
import OfferFooter from "./RideOffer/OfferFooter";
import OfferPromotionStrip from "./RideOffer/OfferPromotionStrip";
import OfferRoute from "./RideOffer/OfferRoute";
import OfferStatHeader from "./RideOffer/OfferStatHeader";
import OfferTags from "./RideOffer/OfferTags";
import { useBottomSheet } from "./RnBottomSheet/BottomSheetProvider";
import RnText from "./RnText";
import { RnAnimatedView } from "./RnView";

/** Just for debugging */
const initialIsModalOpened = false;

interface Props {
  children: React.ReactNode | React.ReactElement;
}
const RequestNotificationModal = React.forwardRef(
  ({ children }: Props, ref) => {
    const { colors } = useAppTheme();
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

    // What the rider actually hands over versus what this ride pays. Null on a
    // full-price ride, and also null if the figures fail to reconcile — see
    // `normalizeDriverFareSplit`.
    const promotion = useMemo(
      () => normalizeDriverFareSplit(ride?.data?.promotion),
      [ride?.data?.promotion],
    );

    const onAcceptRideRequest = useCallback(async () => {
      closeModal();
      // Handled in-app — drop the native slot so a later foreground cannot
      // replay this same offer as a fresh modal.
      clearPendingRideRequest().catch(() => {});
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
      // The accept response is the newer answer, so it wins outright —
      // including when it is absent. A reservation released between offer and
      // accept must not leave a stale discount telling the driver to collect
      // less than they are owed; that is money out of their pocket, whereas
      // quoting full price costs them nothing.
      ride_data.data.promotion = accepted?.promotion;
      setRide(ride_data);
      rideStore.set(["ride"], {
        ride: ride_data,
      });
    }, [accepRideRequset, closeModal, ride, setRide, vc]);

    const onCancelRideRequest = useCallback(async () => {
      removeRide();
      closeModal();
      clearPendingRideRequest().catch(() => {});
    }, [removeRide, closeModal]);

    useEffect(() => {
      if (!getIsModalOpened() && ride?.opened) {
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
      // onRequestPress toggles, so it must only be reached while the modal is
      // closed: a repeat SET_RIDE for an offer already on screen would
      // otherwise close the modal instead of leaving it alone.
      if (!ride?.opened && !isOpened) {
        onRequestPress();
      }
    }, [isOpened, onRequestPress, ride]);

    // Computed once per offer, not per render: a fresh Date.now() on every
    // render would restart the bar's animation. A replayed request (app was
    // killed when it arrived) gets only the time it has actually left.
    const requestDuration = useMemo(
      () => rideRequestRemainingSec(ride?.received_at),
      [ride?.received_at],
    );

    // create rider name from the ride data
    const riderName = useMemo(() => {
      const firstName = ride?.data?.rider_info?.first_name ?? "Rider";
      const lastName = ride?.data?.rider_info?.last_name ?? "Name";
      return `${firstName} ${lastName}`;
    }, [ride?.data?.rider_info?.first_name, ride?.data?.rider_info?.last_name]);

    const rating = ride?.data?.rider_info?.total_rating_score;

    return (
      <React.Fragment>
        {children}
        {isOpened && (
          <RnAnimatedView
            animatedProps={drawerContainerProps}
            style={[
              opacityStyle,
              translateYStyle,
              styles.panel,
              {
                backgroundColor: colors.background,
                paddingTop: insets.top,
                paddingBottom: insets.bottom + 12,
              },
            ]}
          >
            <OfferBanner />

            <View style={[atoms.px_md, atoms.pt_md, atoms.gap_sm]}>
              <OfferStatHeader
                fare={ride?.data?.fare ?? 0}
                distanceKm={ride?.data?.distance ?? 0}
              />
              <OfferPromotionStrip split={promotion} />
            </View>

            <ProgressBarTimer
              duration={requestDuration}
              close={onCancelRideRequest}
              barWidth={width}
            />

            <ScrollView
              style={atoms.flex_1}
              contentContainerStyle={[
                atoms.px_md,
                atoms.pt_md,
                atoms.gap_xl,
                styles.scrollContent,
              ]}
              showsVerticalScrollIndicator={false}
            >
              <OfferTags
                vc={vc}
                distanceToPickup={ride?.data?.distance_to_pickup ?? 0}
              />

              <OfferRoute from={ride?.data?.from} to={ride?.data?.to} />

              <View
                style={[
                  styles.riderRow,
                  atoms.pt_md,
                  atoms.border_t,
                  { borderTopColor: themes.bg_800 },
                ]}
              >
                <View style={[styles.riderIdentity, atoms.gap_sm]}>
                  <Avatar size={36} onLoad={() => {}} />
                  <RnText numberOfLines={1} style={atoms.text_sm}>
                    {riderName}
                  </RnText>
                </View>
                <View style={[styles.riderRating, atoms.gap_2xs]}>
                  <Icon name="Star" size={16} color={colors.lightGray} />
                  <RnText style={[atoms.text_sm, { color: colors.lightGray }]}>
                    {rating ? rating.toFixed(1) : "N/A"}
                  </RnText>
                </View>
              </View>
            </ScrollView>

            <View style={[atoms.px_md, atoms.pt_md]}>
              <OfferFooter
                onSkip={onCancelRideRequest}
                onAccept={onAcceptRideRequest}
                disabled={isPending}
              />
            </View>
          </RnAnimatedView>
        )}
      </React.Fragment>
    );
  },
);
RequestNotificationModal.displayName = "RequestNotificationModal";
export default memo(RequestNotificationModal);

const styles = StyleSheet.create({
  panel: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 10,
  },
  scrollContent: {
    paddingBottom: 16,
  },
  riderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  riderIdentity: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  riderRating: {
    flexDirection: "row",
    alignItems: "center",
  },
});
