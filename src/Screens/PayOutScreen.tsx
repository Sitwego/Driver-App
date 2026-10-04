import { LegendList } from "@legendapp/list";
import { format } from "date-fns";
import { PressableScale } from "pressto";
import { Animated } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Icon from "~/components/Icons";
import RnText from "~/components/RnText";
import { RnView } from "~/components/RnView";
import { st, useFadeIn } from "~/components/SubscriptionPlans";
import {
  useDiscountedRides,
  useDriverWallet,
  usePayoutHistory,
  useWithdrawFromWallet,
} from "~/hooks/apis";
import { s } from "~/styles/Common-Styles";
import { useAppTheme } from "~/ui/theme/ThemeProvider";
import { atoms } from "~/ui/theme/atoms";
import { themes } from "~/ui/theme/theme_utils";
import { formatTime } from "~/utils/dates/utils";
import { formatAmount, roundToOneDecimal } from "~/utils/metrics/numbers";
import { describeOutstandingCredits } from "~/utils/payoutUtils";

import type { CreditStatus, DiscountedRide } from "~/hooks/apis";
import type { PayOutScreenProps } from "~/navigation/types";

const LIME = "#CCFF00";
const LIME_DIM = "rgba(204,255,0,0.55)";

// The payout destination is NOT editable from the app. The server pays the
// number on the driver's verified profile and ignores anything a client
// sends, so an edit sheet here would imply funds can be redirected from a
// logged-in session. A number-change flow belongs behind OTP verification,
// not behind a text input.

/**
 * How each status is spoken to the driver.
 *
 * "On its way" rather than "Paid": a requested withdrawal has left the wallet
 * but can still fail and be credited back, and a driver told they were paid for
 * money that then reappears has been lied to twice.
 */
const STATUS_COPY: Record<CreditStatus, { label: string; color: string }> = {
  awaiting_payout: { label: "In your wallet", color: LIME },
  in_transit: { label: "On its way", color: themes.green_400 },
  paid_out: { label: "Paid out", color: themes.gray_400 },
  settled_off_bill: { label: "Credited to your bill", color: themes.gray_400 },
};

function StatusChip({ status }: { status: CreditStatus }) {
  const { fonts } = useAppTheme();
  // An unrecognised status from a newer server reads as still owed, which is
  // the safe direction to be wrong in.
  const { label, color } = STATUS_COPY[status] ?? STATUS_COPY.awaiting_payout;

  return (
    <RnText
      style={[atoms.text_2xs, { color, fontFamily: fonts.medium.fontFamily }]}
    >
      {label}
    </RnText>
  );
}

// ─── Ride card ────────────────────────────────────────────────────────────────

function DiscountedRideItem({ ride }: { ride: DiscountedRide }) {
  const { colors, fonts } = useAppTheme();

  const time = ride.created_at
    ? format(new Date(ride.created_at), "hh:mm aa")
    : "—";
  const destination =
    [ride.to_ward, ride.to_city].filter(Boolean).join(", ") || "—";
  const distance = ride.estimated_distance
    ? `${roundToOneDecimal(ride.estimated_distance)} Km`
    : null;
  const duration = ride.estimated_duration
    ? formatTime(ride.estimated_duration)
    : null;
  const distanceLabel =
    [distance, duration].filter(Boolean).join(" · ") || null;

  return (
    <RnView
      style={[
        s.px14,
        s.py14,
        s.borderRadius_sm,
        {
          backgroundColor: themes.bg_900,
          borderWidth: 1,
          borderColor: themes.bg_800,
        },
      ]}
    >
      {/* Top row: discount tile + amount + where the money has got to */}
      <RnView style={[s.flexDirectionRow, s.alignCenter, s.gap12]}>
        <RnView
          style={[
            s.alignCenter,
            s.justifyCenter,
            {
              width: 44,
              height: 44,
              borderRadius: 12,
              backgroundColor: themes.primary_950,
            },
          ]}
        >
          <Icon
            name="Percent"
            size={22}
            strokeWidth={1.8}
            color={themes.primary_300}
          />
        </RnView>

        <RnView style={[s.flex1]}>
          <RnView style={[s.flexDirectionRow, s.justifyBetween, s.alignCenter]}>
            <RnText
              style={[atoms.text_md, { fontFamily: fonts.heavy.fontFamily }]}
            >
              KES {formatAmount(Number(ride.discount))}
            </RnText>
            <StatusChip status={ride.status} />
          </RnView>
          <RnText
            style={[atoms.text_xs, { color: colors.lightGray, marginTop: 2 }]}
            numberOfLines={2}
          >
            {destination}
          </RnText>
        </RnView>
      </RnView>

      {/* Divider */}
      <RnView
        style={{
          height: 1,
          backgroundColor: themes.bg_800,
          marginTop: 12,
          marginBottom: 10,
        }}
      />

      {/* Bottom row: when + how far, and what the ride actually earned */}
      <RnView style={[s.flexDirectionRow, s.justifyBetween, s.alignCenter]}>
        <RnView style={[s.flexDirectionRow, s.alignCenter, s.gap6]}>
          <Icon
            name="MapPin"
            size={13}
            strokeWidth={2}
            color={colors.lightGray}
          />
          <RnText
            style={[
              atoms.text_2xs,
              { color: colors.lightGray, fontFamily: fonts.medium.fontFamily },
            ]}
          >
            {[time, distanceLabel].filter(Boolean).join(" · ")}
          </RnText>
        </RnView>

        {/* The FULL fare — what the driver earned, not the reduced amount the
            rider handed over. Showing the discounted figure here would make the
            card read as though the promotion cost them the difference. */}
        <RnText
          style={[
            atoms.text_2xs,
            { color: colors.lightGray, fontFamily: fonts.medium.fontFamily },
          ]}
        >
          Earned {formatAmount(Number(ride.fare))}
        </RnText>
      </RnView>
    </RnView>
  );
}

const renderRide = ({ item }: { item: DiscountedRide }) => (
  <DiscountedRideItem ride={item} />
);

const keyExtractor = (item: DiscountedRide) => item.ride_id;

const ItemSeparator = () => <RnView style={{ height: 10 }} />;

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState() {
  const { fonts } = useAppTheme();

  return (
    <RnView
      style={[
        s.alignCenter,
        s.justifyCenter,
        s.gap6,
        { paddingVertical: 48, paddingHorizontal: 24 },
      ]}
    >
      <Icon
        name="TicketPercent"
        size={32}
        strokeWidth={1.5}
        color={themes.gray_500}
      />
      <RnText
        style={[
          atoms.text_sm,
          { fontFamily: fonts.heavy.fontFamily, marginTop: 4 },
        ]}
      >
        No discounted rides yet
      </RnText>
      <RnText
        style={[atoms.text_xs, { color: themes.gray_400, textAlign: "center" }]}
      >
        Rides where the customer used a discount will appear here.
      </RnText>
    </RnView>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export function PayOutScreen(_props: PayOutScreenProps) {
  const { fonts } = useAppTheme();
  const insets = useSafeAreaInsets();
  const opacity = useFadeIn();

  const { data: wallet, refetch: refetchWallet } = useDriverWallet();
  const { data: payouts, refetch: refetchPayouts } = usePayoutHistory();
  const {
    data: discounted,
    isPending: ridesLoading,
    refetch: refetchRides,
  } = useDiscountedRides();
  const { mutateAsync: withdraw, isPending } = useWithdrawFromWallet();

  // What Sitwego owes this driver: the platform's share of every discounted
  // ride plus any referral rewards, minus whatever they have already taken out.
  const balance = Number(wallet?.balance ?? 0);
  const inFlight = payouts?.some(
    (p) => p.state === "requested" || p.state === "acked",
  );
  const canWithdraw = balance > 0 && !inFlight && !isPending;

  const rides = discounted?.rides ?? [];
  // The count comes from the server's summary, which spans the driver's whole
  // history — deriving it from `rides.length` would count rides already paid
  // out, and would shrink as the list paged.
  const countLabel = describeOutstandingCredits(discounted?.summary);

  const handleRequestPayout = async () => {
    if (!canWithdraw) return;
    try {
      // Whole shillings only — M-Pesa will not send fractions, and asking for
      // more than the balance is refused server-side anyway.
      await withdraw({ amount: Math.floor(balance) });
    } catch (err) {
      console.warn("Withdrawal failed:", err);
    } finally {
      // Either way the balance and payout state may have moved: a successful
      // request debits the wallet, a failed one leaves it untouched, and a
      // rejection tells us something about in-flight payouts we did not know.
      // The ride list moves with it — a withdrawal reclassifies rides from
      // "in your wallet" to "on its way", so a stale list would keep claiming
      // money is somewhere it no longer is.
      refetchWallet();
      refetchPayouts();
      refetchRides();
    }
  };

  const ListHeader = (
    <RnView style={[s.flexCol, s.gap16, { marginBottom: 12 }]}>
      {/* Hero — total owed */}
      <RnView
        style={[
          s.flexCol,
          s.alignCenter,
          s.justifyCenter,
          s.borderRadius_sm,
          {
            backgroundColor: themes.bg_900,
            padding: 28,
            gap: 6,
            borderWidth: 1,
            borderColor: "rgba(204,255,0,0.18)",
          },
        ]}
      >
        <RnView style={[s.flexDirectionRow, { gap: 8, alignItems: "center" }]}>
          <Icon name="TicketPercent" size={18} color={LIME} />
          <RnText style={[atoms.text_sm, { color: themes.gray_300 }]}>
            Your Sitwego wallet
          </RnText>
        </RnView>

        <RnText
          style={[
            atoms.text_5xl,
            {
              fontFamily: fonts.heavy.fontFamily,
              color: LIME,
              letterSpacing: -1,
            },
          ]}
        >
          {formatAmount(balance)}
        </RnText>
        <RnText
          style={[
            atoms.text_md,
            { fontFamily: fonts.heavy.fontFamily, color: themes.gray_400 },
          ]}
        >
          KSH
        </RnText>

        <RnText
          style={[
            atoms.text_xs,
            { color: LIME_DIM, textAlign: "center", marginTop: 2 },
          ]}
        >
          {inFlight
            ? "A withdrawal is on its way to your phone"
            : "Sitwego's share of your discounted rides, plus referral rewards"}
        </RnText>
      </RnView>

      {/* Section header. The number is labelled rather than bare: a count on
          its own next to "Discounted rides" reads as the total, and would then
          contradict itself the moment the driver withdrew and it dropped. */}
      <RnView style={[s.flexDirectionRow, s.justifyBetween, s.alignCenter]}>
        <RnText style={[atoms.text_sm, { fontFamily: fonts.heavy.fontFamily }]}>
          Discounted rides
        </RnText>
        <RnText style={[atoms.text_xs, { color: themes.gray_400 }]}>
          {countLabel}
        </RnText>
      </RnView>
    </RnView>
  );

  return (
    <Animated.View style={[s.flex1, { opacity }]}>
      <LegendList
        data={rides}
        renderItem={renderRide}
        keyExtractor={keyExtractor}
        showsVerticalScrollIndicator={false}
        estimatedItemSize={120}
        recycleItems
        ListHeaderComponent={ListHeader}
        // Nothing rather than "no discounted rides yet" while the first fetch
        // is still out — a driver who has some would otherwise be told they
        // have none, briefly, every time they open the screen.
        ListEmptyComponent={ridesLoading ? null : EmptyState}
        ItemSeparatorComponent={ItemSeparator}
        contentContainerStyle={[
          s.flexCol,
          s.px10,
          { paddingTop: 16, paddingBottom: 24 },
        ]}
      />

      {/* Sticky footer — payout destination + CTA */}
      <RnView
        style={[
          st.stickyFooter,
          s.flexCol,
          s.gap12,
          {
            backgroundColor: themes.bg_950,
            paddingBottom: insets.bottom + 65,
          },
        ]}
      >
        {/* Destination is read-only on purpose. The server pays the number on
            the driver's verified profile and ignores anything a client sends —
            an Edit button here would imply the money can be redirected from the
            app, which is exactly what must not be true. */}
        <RnView style={[st.card, s.flexDirectionRow, s.alignCenter, s.gap12]}>
          <Icon name="Smartphone" size={18} color={themes.gray_300} />
          <RnView style={[s.flex1]}>
            <RnText style={[atoms.text_2xs, { color: themes.gray_400 }]}>
              Payout to
            </RnText>
            <RnText
              style={[
                atoms.text_sm,
                { fontFamily: fonts.heavy.fontFamily, marginTop: 2 },
              ]}
            >
              Your registered M-Pesa number
            </RnText>
            <RnText
              style={[atoms.text_2xs, { color: themes.gray_400, marginTop: 2 }]}
            >
              To change it, contact support.
            </RnText>
          </RnView>
        </RnView>

        <PressableScale
          onPress={canWithdraw ? handleRequestPayout : undefined}
          enabled={canWithdraw}
          accessibilityRole="button"
          accessibilityLabel="Request payout"
          accessibilityState={{ disabled: !canWithdraw }}
          style={[
            s.alignCenter,
            s.justifyCenter,
            s.borderRadius_sm,
            {
              backgroundColor: LIME,
              paddingVertical: 16,
              opacity: canWithdraw ? 1 : 0.5,
            },
          ]}
        >
          <RnView style={[s.flexDirectionRow, { gap: 8 }]}>
            <Icon name="ArrowDownToLine" size={18} color="#0d0d0d" />
            <RnText
              style={[
                atoms.text_md,
                { fontFamily: fonts.heavy.fontFamily, color: "#0d0d0d" },
              ]}
            >
              {isPending
                ? "Sending..."
                : inFlight
                  ? "Payout on its way"
                  : "Withdraw to M-Pesa"}
            </RnText>
          </RnView>
        </PressableScale>
      </RnView>
    </Animated.View>
  );
}
