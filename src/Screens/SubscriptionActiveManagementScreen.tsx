import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { PressableScale } from "pressto";
import { use, useCallback, useMemo } from "react";
import { Animated } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Icon from "~/components/Icons";
import RnText from "~/components/RnText";
import { RnView } from "~/components/RnView";
import {
  plans,
  ProgressBar,
  st,
  useFadeIn,
} from "~/components/SubscriptionPlans";
import { useUserState } from "~/lib/state/userState";
import { s } from "~/styles/Common-Styles";
import { useAppTheme } from "~/ui/theme/ThemeProvider";
import { atoms } from "~/ui/theme/atoms";
import { themes } from "~/ui/theme/theme_utils";

import type {
  RootStackNavigationType,
  SubscriptionActiveManagementScreenProps,
} from "~/navigation/types";

const LIME = "#CCFF00";
const LIME_DIM = "rgba(204,255,0,0.55)";

export function SubscriptionActiveManagementScreen({
  route,
}: SubscriptionActiveManagementScreenProps) {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackNavigationType>>();
  const { planId, category, activeSub } = route.params;
  const { fonts } = useAppTheme();
  const userState = useUserState();
  const amountDue = userState?.amount_due ?? 0;
  const insets = useSafeAreaInsets();
  const opacity = useFadeIn();

  const plan = useMemo(() => {
    const p = userState?.plan_id;
    return plans[category].find((plan) => plan.id === p);
  }, [category, userState?.plan_id]);

  const handleSwitchPlan = useCallback(() => {
    navigation.push("SubscriptionOverview", { category, activeSub });
  }, [navigation, category, activeSub]);

  const handlePayment = useCallback(() => {
    navigation.navigate("Payment", {
      amountDue,
      planId: plan?.id,
    });
  }, [amountDue, navigation, plan?.id]);

  if (!plan) return null;

  const DUE_LIMIT = 1400;

  return (
    <Animated.ScrollView
      style={{ flex: 1, opacity }}
      contentContainerStyle={[
        s.flexCol,
        s.gap16,
        s.px10,
        { paddingTop: 16, paddingBottom: insets.bottom + 24 },
      ]}
    >
      {/* Active badge */}
      <RnView style={st.activePillBadge}>
        <Icon
          name="CircleCheck"
          size={12}
          color={themes.green_500}
          strokeWidth={2.5}
        />
        <RnText
          style={[
            atoms.text_xs,
            { color: themes.green_500, fontFamily: fonts.heavy.fontFamily },
          ]}
        >
          Active
        </RnText>
      </RnView>

      {/* Plan info card */}
      <RnView style={st.card}>
        <RnText style={[atoms.text_md, { fontFamily: fonts.heavy.fontFamily }]}>
          {plan.plan_name}
        </RnText>
        <RnText
          style={[atoms.text_xs, { color: themes.gray_300, marginTop: 2 }]}
        >
          {plan.billing_type} · {plan.cost} Ksh
        </RnText>

        <RnView style={{ marginTop: 16 }}>
          <RnView
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              marginBottom: 6,
            }}
          >
            <RnText style={[atoms.text_xs, { color: themes.gray_300 }]}>
              Accumulated dues
            </RnText>
            <RnText
              style={[
                atoms.text_xs,
                { fontFamily: fonts.heavy.fontFamily, color: themes.gray_100 },
              ]}
            >
              {amountDue} / {DUE_LIMIT} Ksh
            </RnText>
          </RnView>
          <ProgressBar used={Number(amountDue)} total={DUE_LIMIT} />
        </RnView>

        <RnText
          style={[atoms.text_sm, { color: themes.gray_200, marginTop: 12 }]}
        >
          Next billing:{" "}
          <RnText
            style={{
              fontFamily: fonts.heavy.fontFamily,
              color: themes.gray_50,
            }}
          >
            {activeSub.next_billing_date}
          </RnText>
        </RnText>
      </RnView>

      {/* Switch plan */}
      <PressableScale
        onPress={handleSwitchPlan}
        accessibilityRole="button"
        accessibilityLabel="Switch plan"
        style={st.switchPlanBtn}
      >
        <Icon name="ArrowLeftRight" size={16} color={themes.primary_400} />
        <RnText
          style={[
            atoms.text_sm,
            { fontFamily: fonts.heavy.fontFamily, color: themes.primary_400 },
          ]}
        >
          Switch Plan
        </RnText>
      </PressableScale>

      {/* Pay outstanding balance */}
      <RnView style={[st.cancelCard, { borderColor: "rgba(204,255,0,0.5)" }]}>
        <RnText
          style={[
            atoms.text_sm,
            { fontFamily: fonts.heavy.fontFamily, color: LIME },
          ]}
        >
          Outstanding Balance
        </RnText>
        <RnText
          style={[
            atoms.text_3xl,
            { fontFamily: fonts.heavy.fontFamily, color: LIME, marginTop: 4 },
          ]}
        >
          {amountDue} Ksh
        </RnText>
        <RnText
          style={[
            atoms.text_xs,
            { color: LIME_DIM, marginTop: 4, marginBottom: 12 },
          ]}
        >
          Accumulated charges from the last 7 days.
        </RnText>
        <PressableScale
          onPress={handlePayment}
          accessibilityRole="button"
          accessibilityLabel="Pay outstanding balance"
          style={[st.cancelBtn, { backgroundColor: "#CCFF00" }]}
        >
          <Icon name="Wallet" size={16} color="#0d0d0d" />
          <RnText
            style={[
              atoms.text_sm,
              { fontFamily: fonts.heavy.fontFamily, color: "#0d0d0d" },
            ]}
          >
            Pay Now
          </RnText>
        </PressableScale>
      </RnView>
    </Animated.ScrollView>
  );
}
