import { useCallback } from "react";
import { DeviceEventEmitter, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Icon from "~/components/Icons";
import RnText from "~/components/RnText";
import { RnView, RnAnimatedView } from "~/components/RnView";
import { useConfirmCollectedCash, useRideFare } from "~/hooks/useRideApi";
import { rideStore } from "~/lib/store";
import { NavigationProps } from "~/navigation/types";
import { s } from "~/styles/Common-Styles";
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
  const { breakdown, total } = useRideFare(ride_id);
  const { top } = useSafeAreaInsets();

  // Fall back to the route-param fare until the snapshot loads (or if it fails).
  const totalFare = total || fare;
  const lines =
    breakdown.length > 0
      ? breakdown.filter((line) => line.isEstimate || line.amount > 0)
      : [
          {
            key: "estimated_fare",
            label: "Ride fare",
            amount: fare,
            isEstimate: true,
          },
        ];

  const { mutateAsync: collectedCash } = useConfirmCollectedCash();

  const handlePaymentConfirmation = useCallback(async () => {
    await collectedCash({ ride_id, is_discounted: false, discount: 0 });
    rideStore.remove(["overtimeCharge"]);
    navigation.push("RatingScreen", { rideId: ride_id, riderName: "" });
    DeviceEventEmitter.emit("onRideComplete", true);
  }, [collectedCash, navigation, ride_id]);
  return (
    <RnAnimatedView style={[styles.container, { paddingTop: top }]}>
      <RnView
        style={[
          styles.card,
          {
            borderColor: themes.bg_900,
          },
        ]}
      >
        <RnText
          style={[
            atoms.text_xs,
            styles.cardTitle,
            { fontFamily: fonts.bold.fontFamily, color: colors.lightGray },
          ]}
        >
          FARE BREAKDOWN
        </RnText>

        <RnView style={atoms.gap_sm}>
          {lines.map((line) => (
            <RnView key={line.key} style={styles.breakdownRow}>
              <RnText
                style={[
                  atoms.text_sm,
                  {
                    fontFamily: fonts.regular.fontFamily,
                    color: colors.lightGray,
                  },
                ]}
              >
                {line.label}
              </RnText>
              <RnText
                style={[
                  atoms.text_sm,
                  {
                    fontFamily: fonts.bold.fontFamily,
                    color: line.isEstimate ? colors.text : themes.green_500,
                  },
                ]}
              >
                {line.isEstimate ? "" : "+"}
                {formatPrice(line.amount)} Ksh
              </RnText>
            </RnView>
          ))}
        </RnView>

        <RnView style={[styles.divider, { borderColor: themes.bg_900 }]} />

        <RnView style={styles.totalRow}>
          <RnView style={styles.totalLabel}>
            <Icon
              name="Banknote"
              size={20}
              strokeWidth={2}
              color={themes.green_500}
            />
            <RnText
              style={[
                atoms.text_sm,
                {
                  fontFamily: fonts.regular.fontFamily,
                  color: colors.lightGray,
                },
              ]}
            >
              Total to collect
            </RnText>
          </RnView>
          <RnText
            style={[atoms.text_xl, { fontFamily: fonts.heavy.fontFamily }]}
          >
            {formatPrice(totalFare)} Ksh
          </RnText>
        </RnView>
        <RnView style={[styles.note, { backgroundColor: themes.green_975 }]}>
          <Icon
            name="ShieldCheck"
            size={16}
            strokeWidth={2}
            color={themes.green_500}
          />
          <RnText
            style={[
              atoms.text_xs,
              styles.noteText,
              {
                fontFamily: fonts.regular.fontFamily,
                color: colors.lightGray,
              },
            ]}
          >
            100% fare is collected in cash. No deductions or commissions are
            applied.
          </RnText>
        </RnView>
      </RnView>
      <RnView style={[s.flex1, s.justifyCenter, s.pb40]}>
        <RnView style={[styles.vertSpace]}>
          <RnText
            style={[
              atoms.text_xl,
              //@ts-ignore
              atoms.text_center,
              { fontFamily: fonts.regular.fontFamily },
            ]}
          >
            Collect Cash
          </RnText>
        </RnView>
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
    // justifyContent: "center",
    alignItems: "center",
  },
  vertSpace: {
    paddingVertical: 20,
  },
  card: {
    width: "92%",
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    gap: 14,
    marginBottom: 20,
  },
  cardTitle: {
    letterSpacing: 1,
  },
  breakdownRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  divider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  totalLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  note: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  noteText: {
    flex: 1,
    lineHeight: 18,
  },
});
