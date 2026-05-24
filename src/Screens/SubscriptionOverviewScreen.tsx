import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { PressableScale as Pressable } from "pressto";
import { useCallback, useMemo } from "react";
import { Animated } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Icon from "~/components/Icons";
import RnText from "~/components/RnText";
import { RnView } from "~/components/RnView";
import { PlanCard, plans, st, useFadeIn } from "~/components/SubscriptionPlans";
import { useUserState } from "~/lib/state/userState";
import { s } from "~/styles/Common-Styles";
import { useAppTheme } from "~/ui/theme/ThemeProvider";
import { atoms } from "~/ui/theme/atoms";
import { themes } from "~/ui/theme/theme_utils";
import { formatDate } from "~/utils/dates/formatDate";

import type {
  ActiveSubscription,
  RootStackNavigationType,
  SubscriptionOverviewScreenProps,
} from "~/navigation/types";

export function SubscriptionOverviewScreen({
  route,
}: SubscriptionOverviewScreenProps) {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackNavigationType>>();
  const { category } = route.params;
  const userState = useUserState();
  const activeSub = useMemo(() => {
    return {
      plan_id: userState?.plan_id,
      rides_used: 15,
      next_billing_date: formatDate(userState?.plan_end_date || ""),
    } as ActiveSubscription;
  }, [userState?.plan_id, userState?.plan_end_date]);
  const { fonts, colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const opacity = useFadeIn();

  const categoryPlans = useMemo(() => plans[category] ?? [], [category]);

  const handleSubscribe = useCallback(
    (planId: string) => {
      navigation.push("SubscriptionPlanDetails", {
        planId,
        category,
        activeSub,
      });
    },
    [navigation, category, activeSub],
  );

  const handleManage = useCallback(() => {
    if (!activeSub) return;
    const activePlan = categoryPlans.find((p) => p.id === activeSub.plan_id);
    if (!activePlan) return;
    navigation.push("SubscriptionActiveManagement", {
      planId: activePlan.id,
      category,
      activeSub,
    });
  }, [navigation, categoryPlans, category, activeSub]);

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
      {activeSub && (
        <RnView style={st.activeBanner}>
          <RnView
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
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
                  {
                    color: themes.green_500,
                    fontFamily: fonts.heavy.fontFamily,
                  },
                ]}
              >
                Active
              </RnText>
            </RnView>

            <Pressable
              onPress={handleManage}
              accessibilityRole="button"
              accessibilityLabel="Manage subscription"
            >
              <RnText
                style={[
                  atoms.text_xs,
                  {
                    color: themes.primary_400,
                    fontFamily: fonts.heavy.fontFamily,
                  },
                ]}
              >
                Manage
              </RnText>
            </Pressable>
          </RnView>

          <RnText
            style={[atoms.text_sm, { color: themes.gray_100, marginTop: 8 }]}
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
      )}

      <RnText style={[atoms.text_md, { fontFamily: fonts.heavy.fontFamily }]}>
        {category} Plans
      </RnText>

      {categoryPlans.map((plan) => (
        <PlanCard
          key={plan.id}
          plan={plan}
          isActive={activeSub?.plan_id === plan.id}
          onSubscribe={() => handleSubscribe(plan.id)}
        />
      ))}
      <RnView style={{ marginBottom: 50 }} />
    </Animated.ScrollView>
  );
}
