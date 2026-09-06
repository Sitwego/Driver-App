import { useCallback, useMemo } from "react";
import { DeviceEventEmitter, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Icon from "~/components/Icons";
import RnText from "~/components/RnText";
import { RnView, RnAnimatedView } from "~/components/RnView";
import {
  useConfirmCollectedCash,
  useDriverFareBreakdown,
  useRideFare,
} from "~/hooks/useRideApi";
import { rideStore } from "~/lib/store";
import { NavigationProps } from "~/navigation/types";
import { s } from "~/styles/Common-Styles";
import SwipeSlider from "~/ui/SliderButton";
import { useAppTheme } from "~/ui/theme/ThemeProvider";
import { atoms } from "~/ui/theme/atoms";
import { themes } from "~/ui/theme/theme_utils";
import { width } from "~/utils/metrics/dimm";
import { formatPrice, formatWholeKes } from "~/utils/metrics/numbers";
import { normalizeDriverFareSplit } from "~/utils/rideUtils";

export function CollectCashAndConfirmRideEnded({
  navigation,
  route,
}: NavigationProps<"CollectCashAndConfirmRideEnded">) {
  const { colors, fonts } = useAppTheme();
  const { fare, ride_id } = route.params;
  const { breakdown, total } = useRideFare(ride_id);
  const { data: fareSplit } = useDriverFareBreakdown(ride_id);
  const { top } = useSafeAreaInsets();

  // The server's split is authoritative — it re-prices against the live fare,
  // which the offer-time copy cannot do once a stop has been added. That cached
  // copy is only the fallback for a failed request; null from both means this
  // is an ordinary full-price ride and the screen renders as it always has.
  const split = useMemo(
    () =>
      normalizeDriverFareSplit(fareSplit) ??
      normalizeDriverFareSplit(
        (rideStore.get(["ride"]) as any)?.ride?.data?.promotion,
      ),
    [fareSplit],
  );

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
    // `is_discounted`/`discount` are the DRIVER-granted discount and must stay
    // zero here even on a promoted ride. They feed the driver's own earnings
    // report; putting Sitwego's marketing spend in them would double-count the
    // promotion, which the backend flags as `tag=double_discount`. The
    // platform's side is already recorded server-side against the ride.
    await collectedCash({ ride_id, is_discounted: false, discount: 0 });
    rideStore.remove(["overtimeCharge"]);
    navigation.push("RatingScreen", { rideId: ride_id, riderName: "" });
    DeviceEventEmitter.emit("onRideComplete", true);
  }, [collectedCash, navigation, ride_id]);
  return (
    <RnAnimatedView style={[styles.container, { paddingTop: top }]}>
      <RnView style={[styles.card]}>
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

        {/* Every figure below comes from the same server-computed split, so the
            three of them reconcile with each other by construction. Mixing in
            the fare snapshot's total here would risk showing a discount that
            does not subtract to the amount printed underneath it. */}
        {split ? (
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
              Sitwego promotion
            </RnText>
            <RnText
              style={[
                atoms.text_sm,
                { fontFamily: fonts.bold.fontFamily, color: themes.green_500 },
              ]}
            >
              −{formatWholeKes(split.platform_covers)} Ksh
            </RnText>
          </RnView>
        ) : null}

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
            {split
              ? `${formatWholeKes(split.collect_from_rider)} Ksh`
              : `${formatPrice(totalFare)} Ksh`}
          </RnText>
        </RnView>

        {/* The driver's earnings are unchanged by the discount (invariant D1),
            so this line has to be on screen next to the smaller cash figure —
            otherwise the promotion reads as a pay cut. */}
        {split ? (
          <RnView style={styles.totalRow}>
            <RnView style={styles.totalLabel}>
              <Icon
                name="Wallet"
                size={20}
                strokeWidth={2}
                color={colors.lightGray}
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
                You earn
              </RnText>
            </RnView>
            <RnText
              style={[atoms.text_lg, { fontFamily: fonts.bold.fontFamily }]}
            >
              {formatWholeKes(split.you_earn)} Ksh
            </RnText>
          </RnView>
        ) : null}

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
            {/* The stock reassurance is contradicted by the screen it sits on
                once a promotion applies — the driver is being asked to collect
                less than the fare. Still no deduction, though, which is the
                part that actually reassures. */}
            {split
              ? `Sitwego is funding ${formatWholeKes(
                  split.platform_covers,
                )} Ksh of this ride. You still earn the full ${formatWholeKes(
                  split.you_earn,
                )} Ksh — the ${formatWholeKes(
                  split.platform_covers,
                )} Ksh goes into your Sitwego wallet, ready to withdraw to M-Pesa.`
              : "100% fare is collected in cash. No deductions or commissions are applied."}
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
    paddingVertical: 12,
  },
  noteText: {
    flex: 1,
    lineHeight: 18,
  },
});
