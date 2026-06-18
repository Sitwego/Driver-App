/**
 * SubscriptionPlans – shared utilities module
 *
 * Exports types, plan data, and small UI building-blocks used by the three
 * subscription stack screens:
 *   - SubscriptionOverviewScreen
 *   - SubscriptionPlanDetailsScreen
 *   - SubscriptionActiveManagementScreen
 */
import { PressableScale as Pressable } from "pressto";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet } from "react-native";

import { s } from "~/styles/Common-Styles";
import { useAppTheme } from "~/ui/theme/ThemeProvider";
import { atoms } from "~/ui/theme/atoms";
import { themes } from "~/ui/theme/theme_utils";

import Icon from "./Icons";
import RnText from "./RnText";
import { RnView } from "./RnView";

import type { SubscriptionCategory } from "~/navigation/types";

// Re-export so callers can import ActiveSubscription from either location.
export type { ActiveSubscription } from "~/navigation/types";

// ─── Types ────────────────────────────────────────────────────────────────────

export type Faq = { question: string; answer: string };

export type Plan = {
  id: string;
  vehicle_type: string;
  plan_name: string;
  cost: number;
  billing_type: string;
  no_ride_no_charge: boolean;
  description: string;
  features: string[];
  faqs: Faq[];
  max_charge?: number;
  max_rides?: number;
};

// ─── useFadeIn ────────────────────────────────────────────────────────────────

/** Returns an Animated.Value that fades from 0 → 1 on mount. */
export function useFadeIn(duration = 260): Animated.Value {
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return opacity;
}

// ─── Accordion ────────────────────────────────────────────────────────────────

/**
 * Animated collapsible section. Chevron rotates on toggle.
 * Content is clipped via maxHeight interpolation – no height measurement needed.
 */
export function Accordion({
  title,
  children,
  initialOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  initialOpen?: boolean;
}) {
  const { fonts } = useAppTheme();
  const [open, setOpen] = useState(initialOpen);
  const anim = useRef(new Animated.Value(initialOpen ? 1 : 0)).current;

  const toggle = useCallback(() => {
    const next = !open;
    setOpen(next);
    Animated.timing(anim, {
      toValue: next ? 1 : 0,
      duration: 280,
      easing: Easing.out(Easing.ease),
      useNativeDriver: false,
    }).start();
  }, [open, anim]);

  const chevronRotate = anim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "180deg"],
  });
  const maxHeight = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 600], // safe upper bound
  });
  const contentOpacity = anim.interpolate({
    inputRange: [0, 0.6, 1],
    outputRange: [0, 0.4, 1],
  });

  return (
    <RnView style={s.flexCol}>
      <Pressable
        onPress={toggle}
        accessibilityRole="button"
        accessibilityLabel={`${title}, ${open ? "collapse" : "expand"}`}
        style={st.accordionHeader}
      >
        <RnText style={[atoms.text_sm, { fontFamily: fonts.heavy.fontFamily }]}>
          {title}
        </RnText>
        <Animated.View style={{ transform: [{ rotate: chevronRotate }] }}>
          <Icon
            name="ChevronDown"
            size={18}
            color={themes.gray_400}
            strokeWidth={2}
          />
        </Animated.View>
      </Pressable>

      <Animated.View
        style={{ maxHeight, overflow: "hidden", opacity: contentOpacity }}
      >
        {children}
      </Animated.View>
    </RnView>
  );
}

// ─── BenefitRow ───────────────────────────────────────────────────────────────

export function BenefitRow({ text }: { text: string }) {
  return (
    <RnView
      style={[s.flexDirectionRow, s.px10, { paddingVertical: 6 }]}
      accessibilityLabel={text}
    >
      <Icon name="Check" color={themes.green_500} size={16} strokeWidth={3} />
      <RnText style={[atoms.text_sm, { flex: 1 }]}>{text}</RnText>
    </RnView>
  );
}

// ─── ProgressBar ──────────────────────────────────────────────────────────────

/**
 * Animated fill bar that grows from 0 to (used/total) on mount.
 * Turns red when ≥ 90 % of rides are consumed.
 */
export function ProgressBar({ used, total }: { used: number; total: number }) {
  const pct = total > 0 ? Math.min(used / total, 1) : 0;
  const fillColor = pct >= 0.9 ? themes.red_500 : themes.primary_500;
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: pct,
      duration: 700,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [pct, anim]);

  const width = anim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  return (
    <RnView
      style={st.progressTrack}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: total, now: used }}
    >
      <Animated.View
        style={[st.progressFill, { backgroundColor: fillColor, width }]}
      />
    </RnView>
  );
}

// ─── PlanCard ─────────────────────────────────────────────────────────────────

export function PlanCard({
  plan,
  isActive,
  onSubscribe,
}: {
  plan: Plan;
  isActive: boolean;
  onSubscribe: () => void;
}) {
  const { fonts } = useAppTheme();

  return (
    <RnView
      style={[
        st.card,
        isActive && { borderWidth: 1.5, borderColor: themes.green_500 },
      ]}
      accessibilityLabel={`${plan.plan_name}, ${plan.cost} Ksh ${plan.billing_type}`}
    >
      <RnView style={[s.flexDirectionRow, s.justifyBetween]}>
        <RnText style={[atoms.text_md, { fontFamily: fonts.heavy.fontFamily }]}>
          {plan.plan_name}
        </RnText>
        <RnText
          style={[
            atoms.text_lg,
            { fontFamily: fonts.heavy.fontFamily, color: themes.primary_400 },
          ]}
        >
          {plan.cost} Ksh
        </RnText>
      </RnView>

      <RnText style={[atoms.text_xs, { color: themes.gray_300, marginTop: 2 }]}>
        {plan.billing_type}
      </RnText>

      <RnText style={[atoms.text_xs, { color: themes.gray_100, marginTop: 6 }]}>
        {plan.description}
      </RnText>

      <RnView style={[s.flexCol, { marginTop: 10 }]}>
        {plan.features.slice(0, 3).map((f, idx) => (
          <BenefitRow key={idx} text={f} />
        ))}
      </RnView>

      {isActive ? (
        <RnView style={st.activeTag}>
          <Icon
            name="Check"
            size={14}
            color={themes.green_500}
            strokeWidth={3}
          />
          <RnText
            style={[
              atoms.text_sm,
              { color: themes.green_500, fontFamily: fonts.heavy.fontFamily },
            ]}
          >
            Current Plan
          </RnText>
        </RnView>
      ) : (
        <Pressable
          onPress={onSubscribe}
          accessibilityRole="button"
          accessibilityLabel={`Subscribe to ${plan.plan_name}`}
          style={st.subscribeBtn}
        >
          <RnText
            style={[
              atoms.text_md,
              { fontFamily: fonts.heavy.fontFamily, color: "#fff" },
            ]}
          >
            Subscribe
          </RnText>
        </Pressable>
      )}
    </RnView>
  );
}

// ─── Shared styles ────────────────────────────────────────────────────────────

export const st = StyleSheet.create({
  // Shared
  card: {
    backgroundColor: themes.bg_900,
    borderRadius: 12,
    padding: 16,
  },
  iconBtn: {
    width: 35,
    height: 35,
    borderRadius: 99,
    backgroundColor: themes.bg_900,
    alignItems: "center",
    justifyContent: "center",
  },
  subscribeBtn: {
    marginTop: 12,
    backgroundColor: themes.primary_500,
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
    justifyContent: "center",
  },

  // Overview
  activeBanner: {
    backgroundColor: themes.bg_900,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1.5,
    borderColor: themes.green_800,
  },
  activeTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 12,
    paddingVertical: 10,
    justifyContent: "center",
    backgroundColor: themes.green_950,
    borderRadius: 10,
  },

  // Details
  accordionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
  },
  detailsHero: {
    marginHorizontal: 10,
    marginTop: 4,
    backgroundColor: themes.primary_800,
    borderRadius: 16,
    padding: 20,
  },
  stickyFooter: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: themes.bg_700,
  },
  compareToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 4,
  },

  // Active management
  activePillBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: themes.green_950,
    borderRadius: 99,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: "flex-start",
  },
  progressTrack: {
    height: 8,
    backgroundColor: themes.bg_700,
    borderRadius: 99,
    overflow: "hidden",
  },
  progressFill: {
    height: 8,
    borderRadius: 99,
  },
  switchPlanBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: themes.bg_900,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: themes.primary_800,
    justifyContent: "center",
  },
  cancelCard: {
    backgroundColor: themes.bg_900,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: themes.bg_900,
  },
  cancelBtn: {
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
});

// ─── Plan data ────────────────────────────────────────────────────────────────

export const COMMON_FAQS: Faq[] = [
  {
    question: "When am I charged?",
    answer:
      "You are charged based on your plan type — per ride taken, or a flat daily rate. No hidden fees ever.",
  },
  {
    question: "Can I cancel anytime?",
    answer:
      "Yes. You can cancel at any time from the Manage Subscription screen. Access ends immediately.",
  },
  {
    question: "What if I don't take rides today?",
    answer:
      "With the Per Ride plan you only pay when you ride. The Daily Unlimited plan is charged regardless of activity.",
  },
];

export const plans: Record<SubscriptionCategory, Plan[]> = {
  Taxi: [
    {
      id: "plan_taxi_per_ride",
      vehicle_type: "Taxi",
      plan_name: "Daily Per Ride",
      cost: 20.0,
      billing_type: "Per Ride",
      no_ride_no_charge: true,
      max_charge: 200.0,
      max_rides: 10,
      description:
        "Pay 20 Ksh per ride with a 200 Ksh daily cap. Ideal for flexible schedules.",
      features: [
        "20 Ksh per ride, no commitment",
        "Capped at 200 Ksh / day (10 rides max)",
        "Zero commission on every fare",
        "Pay only when you take rides",
        "No cancellation required",
      ],
      faqs: COMMON_FAQS,
    },
    {
      id: "plan_taxi_unlimited",
      vehicle_type: "Taxi",
      plan_name: "Daily Unlimited",
      cost: 125.0,
      billing_type: "Per Day",
      no_ride_no_charge: false,
      description:
        "One flat daily rate for unlimited rides. Best for high-volume driving days.",
      features: [
        "Unlimited rides for 125 Ksh / day",
        "Zero commission on every fare",
        "No per-ride charges",
        "Earn today, pay daily",
        "Best value for busy drivers",
      ],
      faqs: COMMON_FAQS,
    },
  ],
  Bike: [
    {
      id: "plan_bike_per_ride",
      vehicle_type: "Bike",
      plan_name: "Bike Per Ride",
      cost: 6.0,
      billing_type: "Per Ride",
      no_ride_no_charge: true,
      max_charge: 60.0,
      max_rides: 10,
      description:
        "Pay 6 Ksh per ride with a 60 Ksh daily cap. No commitment required.",
      features: [
        "6 Ksh per ride, no commitment",
        "Capped at 60 Ksh / day (10 rides max)",
        "Zero commission on every fare",
        "Pay only when you take rides",
        "No cancellation required",
      ],
      faqs: COMMON_FAQS,
    },
    {
      id: "plan_bike_unlimited",
      vehicle_type: "Bike",
      plan_name: "Bike Unlimited",
      cost: 40.0,
      billing_type: "Per Day",
      no_ride_no_charge: false,
      description: "Flat 40 Ksh daily rate for unlimited bike rides.",
      features: [
        "Unlimited rides for 40 Ksh / day",
        "Zero commission on every fare",
        "No per-ride charges",
        "Earn today, pay daily",
        "Best value for high-volume days",
      ],
      faqs: COMMON_FAQS,
    },
  ],
  TukTuk: [
    {
      id: "plan_tuk_tuk_per_ride",
      vehicle_type: "TukTuk",
      plan_name: "Daily Per Ride",
      cost: 10.0,
      billing_type: "Per Ride",
      no_ride_no_charge: true,
      max_charge: 100.0,
      max_rides: 10,
      description:
        "Pay 10 Ksh per ride with a 100 Ksh daily cap. Great for flexible schedules.",
      features: [
        "10 Ksh per ride, no commitment",
        "Capped at 100 Ksh / day (10 rides max)",
        "Zero commission on every fare",
        "Pay only when you take rides",
        "No cancellation required",
      ],
      faqs: COMMON_FAQS,
    },
    {
      id: "plan_tuk_tuk_unlimited",
      vehicle_type: "TukTuk",
      plan_name: "Daily Unlimited",
      cost: 60.0,
      billing_type: "Per Day",
      no_ride_no_charge: false,
      description: "Flat 60 Ksh daily rate for unlimited TukTuk rides.",
      features: [
        "Unlimited rides for 60 Ksh / day",
        "Zero commission on every fare",
        "No per-ride charges",
        "Earn today, pay daily",
        "Best value for busy drivers",
      ],
      faqs: COMMON_FAQS,
    },
  ],
};
