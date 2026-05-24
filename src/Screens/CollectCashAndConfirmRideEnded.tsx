import { useCallback } from "react";
import { DeviceEventEmitter, StyleSheet } from "react-native";

import Icon from "~/components/Icons";
import RnText from "~/components/RnText";
import { RnView, RnAnimatedView } from "~/components/RnView";
import { useConfirmCollectedCash } from "~/hooks/useRideApi";
import { rideStore, useStorage } from "~/lib/store";
import { NavigationProps } from "~/navigation/types";
import SwipeSlider from "~/ui/SliderButton";
import { useAppTheme } from "~/ui/theme/ThemeProvider";
import { atoms } from "~/ui/theme/atoms";
import { themes } from "~/ui/theme/theme_utils";
import { width } from "~/utils/metrics/dimm";
import { formatPrice } from "~/utils/metrics/numbers";

export function CollectCashAndConfirmRideEnded({
  navigation,
  route,
}: NavigationProps<"CollectCashAndConfirmRideEnded">) {
  const { colors, fonts } = useAppTheme();
  const { fare, ride_id } = route.params;
  const [overtimeCharge] = useStorage(rideStore, ["overtimeCharge"]);
  const totalFare = fare + (overtimeCharge ?? 0);
  const { mutateAsync: collectedCash } = useConfirmCollectedCash();
  const handlePaymentConfirmation = useCallback(async () => {
    await collectedCash({ ride_id, is_discounted: false, discount: 0 });
    rideStore.remove(["overtimeCharge"]);
    //TODO::
    // emit event to show rating modal
    navigation.push("RatingScreen", { rideId: ride_id, riderName: "" });
    DeviceEventEmitter.emit("onRideComplete", true);
  }, [collectedCash, navigation, ride_id]);
  return (
    <RnAnimatedView style={[styles.container]}>
      <RnView style={[styles.paymentD, atoms.gap_md]}>
        <RnText style={[atoms.text_xl, { fontFamily: fonts.heavy.fontFamily }]}>
          {formatPrice(totalFare)}Ksh
        </RnText>
        <Icon
          name="Banknote"
          size={35}
          strokeWidth={2}
          color={themes.green_500}
        />
      </RnView>
      <RnView style={styles.breakdown}>
        <RnView style={styles.breakdownRow}>
          <RnText
            style={[
              atoms.text_sm,
              { fontFamily: fonts.regular.fontFamily, color: colors.lightGray },
            ]}
          >
            Base fare
          </RnText>
          <RnText
            style={[atoms.text_sm, { fontFamily: fonts.regular.fontFamily }]}
          >
            {formatPrice(fare)} Ksh
          </RnText>
        </RnView>
        {(overtimeCharge ?? 0) > 0 && (
          <RnView style={styles.breakdownRow}>
            <RnText
              style={[
                atoms.text_sm,
                {
                  fontFamily: fonts.regular.fontFamily,
                  color: colors.lightGray,
                },
              ]}
            >
              Waiting charge
            </RnText>
            <RnText
              style={[
                atoms.text_sm,
                {
                  fontFamily: fonts.regular.fontFamily,
                  color: themes.green_500,
                },
              ]}
            >
              +{formatPrice(overtimeCharge!)} Ksh
            </RnText>
          </RnView>
        )}
      </RnView>
      <RnView style={[styles.vertSpace]}>
        <RnText
          style={[atoms.text_sm, { fontFamily: fonts.regular.fontFamily }]}
        >
          Collect Cash
        </RnText>
      </RnView>
      <RnView>
        <SwipeSlider
          onSwipeComplete={handlePaymentConfirmation}
          initialTrackColor={themes.green_400}
          completeTrackColor={themes.green_600}
          sliderBackgroundColor={colors.text}
          textColor={colors.text}
          initialText="Confirm Payment"
          completeText="Cash Collected"
          endIcon={<Icon name="HandCoins" size={24} color={themes.green_600} />}
          startIcon={
            <Icon name="ChevronsRight" size={24} color={themes.green_400} />
          }
          borderRadius={16}
          sliderTrackWidth={width * 0.8}
          sliderSize={50}
          sliderTrackHeight={50}
          enableHaptics={true}
          reduceMotion="never"
        />
      </RnView>
    </RnAnimatedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  paymentD: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    marginBottom: 16,
  },
  vertSpace: {
    marginVertical: 10,
  },
  breakdown: {
    width: "80%",
    marginBottom: 12,
  },
  breakdownRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginVertical: 2,
  },
});
