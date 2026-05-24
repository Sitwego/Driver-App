import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useCallback, useEffect, useState } from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Icon from "~/components/Icons";
import RnText from "~/components/RnText";
import { RnView } from "~/components/RnView";
import {
  Accordion,
  BenefitRow,
  plans,
  st,
  useFadeIn,
  type Plan,
} from "~/components/SubscriptionPlans";
import { toastApi } from "~/components/Toast";
import { useSetSubscriptionPlan } from "~/hooks/useSubscriptionPlans";
import { useUserState } from "~/lib/state/userState";
import { s } from "~/styles/Common-Styles";
import { useAppTheme } from "~/ui/theme/ThemeProvider";
import { atoms } from "~/ui/theme/atoms";
import { themes } from "~/ui/theme/theme_utils";

import type {
  RootStackNavigationType,
  SubscriptionPlanDetailsScreenProps,
} from "~/navigation/types";

// ─── Confirmation toast ───────────────────────────────────────────────────────

function SubscribeConfirmToast({
  plan,
  onConfirm,
  onCancel,
}: {
  plan: Plan;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <RnView
      style={[
        s.flexCol,
        s.gap12,
        s.px10,
        s.borderRadius_sm,
        { padding: 16, backgroundColor: themes.bg_900 },
      ]}
    >
      <RnView style={[s.flexDirectionRow, { gap: 10 }]}>
        <Icon name="BadgeCheck" size={20} color={themes.primary_400} />
        <RnView style={[s.flexCol, { flex: 1, gap: 2 }]}>
          <RnText
            style={[
              atoms.text_sm,
              { color: themes.gray_50, fontWeight: "700" },
            ]}
          >
            Confirm subscription
          </RnText>
          <RnText style={[atoms.text_xs, { color: themes.gray_300 }]}>
            {plan.plan_name} · {plan.cost} Ksh {plan.billing_type}
          </RnText>
        </RnView>
      </RnView>

      <RnView style={[s.flexDirectionRow, { gap: 8 }]}>
        <Pressable
          onPress={onCancel}
          accessibilityRole="button"
          style={[
            s.flex1,
            s.alignCenter,
            s.justifyCenter,
            {
              paddingVertical: 10,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: themes.bg_700,
            },
          ]}
        >
          <RnText style={[atoms.text_sm, { color: themes.gray_200 }]}>
            Cancel
          </RnText>
        </Pressable>

        <Pressable
          onPress={onConfirm}
          accessibilityRole="button"
          style={[
            s.flex1,
            s.alignCenter,
            s.justifyCenter,
            {
              paddingVertical: 10,
              borderRadius: 8,
              backgroundColor: themes.primary_500,
            },
          ]}
        >
          <RnText style={[atoms.text_sm, { color: "#fff", fontWeight: "700" }]}>
            Confirm
          </RnText>
        </Pressable>
      </RnView>
    </RnView>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export function SubscriptionPlanDetailsScreen({
  route,
}: SubscriptionPlanDetailsScreenProps) {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackNavigationType>>();
  const { planId, category, activeSub } = route.params;
  const { fonts } = useAppTheme();
  const insets = useSafeAreaInsets();
  const opacity = useFadeIn();
  const userState = useUserState();
  const { mutateAsync: setPlan, isPending } = useSetSubscriptionPlan();

  const categoryPlans = plans[category] ?? [];
  const plan = categoryPlans.find((p) => p.id === planId);
  const isActive = activeSub?.plan_id === planId;

  useEffect(() => {
    if (plan) {
      navigation.setOptions({ title: plan.plan_name });
    }
  }, [navigation, plan]);

  const [showBackdrop, setShowBackdrop] = useState(false);

  const dismissConfirm = useCallback((toastId: string) => {
    toastApi.dismiss(toastId);
    setShowBackdrop(false);
  }, []);

  const doSubscribe = useCallback(async () => {
    if (!userState?.sub_id || !plan) return;
    await setPlan({
      plan_id: plan.id,
      ontrial: false,
      sub_id: userState.sub_id,
    });
    navigation.goBack();
  }, [setPlan, userState, plan, navigation]);

  const handleSubscribePress = useCallback(async () => {
    if (!plan) return;
    console.log("Subscribing to plan:", plan);
    const toastId = `confirm-sub-${plan.id}`;
    setShowBackdrop(true);
    toastApi.custom(
      <SubscribeConfirmToast
        plan={plan}
        onConfirm={async () => {
          dismissConfirm(toastId);
          await doSubscribe();
        }}
        onCancel={() => dismissConfirm(toastId)}
      />,
      { id: toastId, duration: Infinity, position: "center" },
    );
  }, [plan, doSubscribe, dismissConfirm]);

  if (!plan) return null;

  return (
    <View style={{ flex: 1 }}>
      <Animated.ScrollView
        style={{ flex: 1, opacity }}
        contentContainerStyle={[s.flexCol, s.gap20, { paddingBottom: 100 }]}
      >
        {/* Hero */}
        <RnView style={st.detailsHero}>
          <RnText
            style={[atoms.text_lg, { fontFamily: fonts.heavy.fontFamily }]}
          >
            {plan.plan_name}
          </RnText>
          <RnText
            style={[
              atoms.text_3xl,
              {
                fontFamily: fonts.heavy.fontFamily,
                color: themes.primary_300,
                marginTop: 4,
              },
            ]}
          >
            {plan.cost} Ksh
          </RnText>
          <RnText style={[atoms.text_xs, { color: themes.primary_200 }]}>
            {plan.billing_type}
          </RnText>
          <RnText
            style={[atoms.text_sm, { color: themes.gray_100, marginTop: 10 }]}
          >
            {plan.description}
          </RnText>
        </RnView>

        {/* Features */}
        <RnView style={[s.px10, s.flexCol, s.gap8]}>
          <RnText
            style={[
              atoms.text_sm,
              { fontFamily: fonts.heavy.fontFamily, color: themes.gray_50 },
            ]}
          >
            What&apos;s included
          </RnText>
          {plan.features.map((feature, idx) => (
            <BenefitRow key={idx} text={feature} />
          ))}
        </RnView>

        {/* FAQs */}
        <RnView style={[s.px10, s.flexCol]}>
          <RnText
            style={[
              atoms.text_sm,
              {
                fontFamily: fonts.heavy.fontFamily,
                color: themes.gray_50,
                marginBottom: 4,
              },
            ]}
          >
            FAQs
          </RnText>
          {plan.faqs.map((faq, idx) => (
            <Accordion key={idx} title={faq.question}>
              <RnText
                style={[
                  atoms.text_sm,
                  { color: themes.gray_200, paddingBottom: 10 },
                ]}
              >
                {faq.answer}
              </RnText>
            </Accordion>
          ))}
        </RnView>
      </Animated.ScrollView>

      {/* Sticky footer */}
      <RnView style={[st.stickyFooter, { paddingBottom: insets.bottom + 65 }]}>
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
                atoms.text_md,
                { color: themes.green_500, fontFamily: fonts.heavy.fontFamily },
              ]}
            >
              Current Plan
            </RnText>
          </RnView>
        ) : (
          <Pressable
            onPress={handleSubscribePress}
            disabled={isPending}
            accessibilityRole="button"
            accessibilityLabel={`Subscribe to ${plan.plan_name}`}
            style={[st.subscribeBtn, isPending && { opacity: 0.6 }]}
          >
            <RnText
              style={[atoms.text_md, { fontFamily: fonts.heavy.fontFamily }]}
            >
              {isPending ? "Subscribing…" : "Subscribe"}
            </RnText>
          </Pressable>
        )}
      </RnView>

      {showBackdrop && (
        <Pressable
          onPress={() => dismissConfirm(`confirm-sub-${plan.id}`)}
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: "hsla(197, 42%, 10%, 0.9)" },
          ]}
          accessibilityLabel="Dismiss"
        />
      )}
    </View>
  );
}
