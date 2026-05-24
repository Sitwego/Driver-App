import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { PlatformPressable } from "@react-navigation/elements";
import { useLinkBuilder, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { PressableScale } from "pressto";
import * as React from "react";
import { Alert, DeviceEventEmitter, View } from "react-native";
import { Pressable } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { EarningsScreen } from "~/Screens/EarningsScreen";
import { MapScreen } from "~/Screens/MapScreen";
import Icon from "~/components/Icons";
import RnText from "~/components/RnText";
import { ActiveSubscription, plans } from "~/components/SubscriptionPlans";
import { useGoOnline, useGoOffline } from "~/hooks/apis";
import { useIsdriverOnline } from "~/hooks/useIsdriverOnline";
import { useSubscriptionModal } from "~/lib/Providers/SubscriptionProvider";
import { useRideRequest } from "~/lib/Providers/UseRideRequestProvider";
import {
  canDrawOverlays,
  openOverlaySettings,
  startBackgroundService,
  stopGeokalmanService,
} from "~/lib/native";
import { useUserState } from "~/lib/state/userState";
import { nativeStackNavigationWithAuth } from "~/navigation/nativeStackNavigationWithAuth";
import { s } from "~/styles/Common-Styles";
import { useAppTheme } from "~/ui/theme/ThemeProvider";
import { atoms } from "~/ui/theme/atoms";
import { themes } from "~/ui/theme/theme_utils";
import { isPaymentDue } from "~/utils/dates/sub_expiry";
import { isNowBeforeOrEqual } from "~/utils/dates/utils";
import { getLocationAsync } from "~/utils/geo";

import { sharedStackScreens } from "../stack";

import GoOnlineSlider from "./BottomView/bottom-view";

import type { RootStackNavigationType } from "~/navigation/types";

function GoOnlineScreen() {
  return null;
}

const returnToRideBtnStyle = {
  width: 160,
  height: 40,
  borderRadius: 25,
  backgroundColor: themes.primary_500,
  alignItems: "center" as const,
  justifyContent: "center" as const,
  overflow: "hidden" as const,
};

const centerBtnStyle = [
  s.p10,
  s.alignCenter,
  s.justifyCenter,
  s.borderRadius_sm,
  { backgroundColor: themes.bg_900, overflow: "hidden" as const },
];

function TabBar({ state, descriptors, navigation }: any) {
  const { colors, fonts } = useAppTheme();
  const { buildHref } = useLinkBuilder();
  const isDriverOnline = useIsdriverOnline();
  const { mutateAsync: goOnline } = useGoOnline();
  const { mutateAsync: goOffline } = useGoOffline();
  const nav =
    useNavigation<NativeStackNavigationProp<RootStackNavigationType>>();
  const insets = useSafeAreaInsets();
  const [isOnduty, setOnduty] = React.useState<boolean>(false);
  const userState = useUserState();
  const { rideState } = useRideRequest();
  const { open } = useSubscriptionModal();

  const [showReturnBtn, setShowReturnBtn] = React.useState(false);
  const returnBtnOpacity = useSharedValue(0);
  const returnBtnTranslateY = useSharedValue(20);
  const returnBtnScale = useSharedValue(0.85);

  const returnBtnStyle = useAnimatedStyle(() => ({
    opacity: returnBtnOpacity.value,
    transform: [
      { translateY: returnBtnTranslateY.value },
      { scale: returnBtnScale.value },
    ],
  }));

  const categoryPlans = React.useMemo(() => plans["Taxi"] ?? [], []);

  React.useEffect(() => {
    (async function () {
      const _isOnduty = await isDriverOnline();
      setOnduty(_isOnduty);
    })();
  }, [isDriverOnline]);

  const hasSession = React.useMemo(
    () => userState.isLoggedIn && userState.activated,
    [userState.activated, userState.isLoggedIn],
  );

  const isFreeTrialExpired = React.useMemo(
    () =>
      userState.isOnFreeTrial &&
      isNowBeforeOrEqual(userState.free_trial_end_date),
    [userState.isOnFreeTrial, userState.free_trial_end_date],
  );

  const { last_billed_at, plan_end_date, amount_due } = userState;
  const _isPaymentDue = React.useMemo(() => {
    if (isFreeTrialExpired || !plan_end_date || Number(amount_due) === 0) {
      return false;
    }
    return isPaymentDue({ plan_end_date, last_billed_at });
  }, [isFreeTrialExpired, last_billed_at, plan_end_date, amount_due]);

  const settlePlansDues = React.useCallback(() => {
    const activeSub: ActiveSubscription = {
      plan_id: "plan_taxi_unlimited",
      rides_used: 0,
      next_billing_date: "Mar 10, 2026",
    };
    const activePlan = categoryPlans.find((p) => p.id === activeSub.plan_id);
    if (!activePlan) return;
    nav.navigate("SubscriptionActiveManagement", {
      planId: activePlan.id,
      category: "Taxi",
      activeSub,
    });
  }, [categoryPlans, nav]);

  const showReturnButton = React.useCallback(() => {
    setShowReturnBtn(true);
    returnBtnOpacity.value = withSpring(1, { damping: 20, stiffness: 200 });
    returnBtnTranslateY.value = withSpring(0, { damping: 20, stiffness: 200 });
    returnBtnScale.value = withSpring(1, { damping: 20, stiffness: 200 });
  }, [returnBtnOpacity, returnBtnTranslateY, returnBtnScale]);

  const hideReturnButton = React.useCallback(() => {
    returnBtnOpacity.value = withTiming(0, { duration: 180 });
    returnBtnTranslateY.value = withTiming(10, { duration: 180 });
    returnBtnScale.value = withTiming(0.85, { duration: 180 });
    setTimeout(() => setShowReturnBtn(false), 200);
  }, [returnBtnOpacity, returnBtnTranslateY, returnBtnScale]);

  const onReturnToRidePress = React.useCallback(() => {
    hideReturnButton();
    DeviceEventEmitter.emit("onReopenRideSheet");
  }, [hideReturnButton]);

  const cb = React.useCallback(
    async (state: boolean) => {
      setOnduty(state);
      try {
        if (state) {
          if (!canDrawOverlays()) {
            Alert.alert(
              "Permission required",
              "Mobility Captain needs to display ride requests over other apps. Tap 'Open settings', enable 'Allow display over other apps', then go online again.",
              [
                { text: "Not now", style: "cancel" },
                { text: "Open settings", onPress: openOverlaySettings },
              ],
            );
            throw new Error("overlay_permission_denied");
          }
          console.log("Going online with location...", state);
          await goOnline({
            score: Number(userState.rating ?? 0),
            latitude: 0,
            longitude: 0,
            timestamp: new Date().toISOString(),
          });
          startBackgroundService(userState.profile_id);
        } else {
          setOnduty(state);
          await goOffline();
          stopGeokalmanService();
        }
      } catch {
        // API failed — revert slider to previous state
        console.warn("Failed to change online state");
        setOnduty(!state);
      }
    },
    [goOffline, goOnline, userState.profile_id, userState.rating],
  );
  React.useEffect(() => {
    if (rideState?.ride && !isOnduty) {
      cb(true);
    }
  }, [cb, isOnduty, rideState?.ride]);

  React.useEffect(() => {
    const sub = DeviceEventEmitter.addListener("onRideSheetDismissed", () => {
      showReturnButton();
    });
    return () => sub.remove();
  }, [showReturnButton]);

  React.useEffect(() => {
    if (!rideState?.ride) {
      hideReturnButton();
    }
  }, [rideState?.ride, hideReturnButton]);

  if (!hasSession) {
    return null;
  }

  return (
    <View
      style={{
        flexDirection: "row",
        backgroundColor: themes.bg_800, // "rgb(30, 61, 73)",
        justifyContent: "space-between",
        alignSelf: "center",
        alignItems: "center",
        borderRadius: 20,
        width: "87%",
        height: 50,
        position: "absolute",
        bottom: insets.bottom + 2, // Adjusted to account for bottom inset
        paddingHorizontal: 20,
      }}
    >
      {state.routes.map(
        (
          route: {
            key: string | number;
            name: string;
            params: object | undefined;
          },
          index: React.Key | null | undefined,
        ) => {
          const { options } = descriptors[route.key];
          const label =
            options.tabBarLabel !== undefined
              ? options.tabBarLabel
              : options.title !== undefined
                ? options.title
                : route.name;

          const isFocused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          const onLongPress = () => {
            navigation.emit({
              type: "tabLongPress",
              target: route.key,
            });
          };

          if (index === 1) {
            return (
              <View key={route.key}>
                {isFreeTrialExpired ? (
                  <Pressable style={centerBtnStyle} onPress={open}>
                    <RnText style={[{ color: "#CCFF00" }, atoms.text_sm]}>
                      Select Plan
                    </RnText>
                  </Pressable>
                ) : _isPaymentDue ? (
                  <PressableScale
                    style={centerBtnStyle}
                    onPress={settlePlansDues}
                  >
                    <RnText style={[{ color: "#CCFF00" }, atoms.text_sm]}>
                      Pay KSH{"  "}
                      <RnText style={[{ color: "#CCFF00" }, atoms.text_lg]}>
                        {userState.amount_due}
                      </RnText>
                    </RnText>
                  </PressableScale>
                ) : showReturnBtn ? (
                  <Animated.View style={returnBtnStyle}>
                    <Pressable
                      onPress={onReturnToRidePress}
                      style={[
                        returnToRideBtnStyle,
                        s.flexDirectionRow,
                        s.alignCenter,
                        s.justifyCenter,
                        s.gap8,
                      ]}
                    >
                      <Icon
                        name="Route"
                        strokeWidth={3}
                        color={colors.text}
                        size={24}
                      />
                      <RnText
                        style={[
                          atoms.text_md,
                          { fontFamily: fonts.heavy.fontFamily },
                        ]}
                      >
                        Return to Ride
                      </RnText>
                    </Pressable>
                  </Animated.View>
                ) : (
                  <GoOnlineSlider isOnline={isOnduty} onStateChange={cb} />
                )}
              </View>
            );
          }
          return (
            <PlatformPressable
              key={route.key}
              href={buildHref(route.name, route.params)}
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel}
              testID={options.tabBarButtonTestID}
              onPress={onPress}
              onLongPress={onLongPress}
            >
              <Icon
                name={label}
                size={28}
                color={isFocused ? colors.primary : colors.text}
                strokeWidth={2}
              />
            </PlatformPressable>
          );
        },
      )}
    </View>
  );
}

const Tab = createBottomTabNavigator();
const HomeStack = nativeStackNavigationWithAuth();
const GoOnlineTabStack = nativeStackNavigationWithAuth();
const EarningsStack = nativeStackNavigationWithAuth();

function HomeTabSreens() {
  const { colors } = useAppTheme();
  return (
    <HomeStack.Navigator
      screenOptions={
        {
          headerShown: false,
          animation: "slide_from_right",
          headerStyle: {
            backgroundColor: colors.background,
          },
        } as any
      }
    >
      <HomeStack.Screen
        name="MapScreen"
        component={MapScreen}
        options={{ headerShown: false }}
      />
      {sharedStackScreens(HomeStack)}
    </HomeStack.Navigator>
  );
}

function GoOnlineTab() {
  const { colors } = useAppTheme();
  return (
    <GoOnlineTabStack.Navigator
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
        headerStyle: {
          backgroundColor: colors.background,
        },
      }}
    >
      <GoOnlineTabStack.Screen
        name="__Screen"
        component={GoOnlineScreen}
        options={{ headerShown: false }}
      />
      {sharedStackScreens(GoOnlineTabStack)}
    </GoOnlineTabStack.Navigator>
  );
}
function EarningsTab() {
  const { colors } = useAppTheme();
  return (
    <EarningsStack.Navigator
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
        headerStyle: {
          backgroundColor: colors.background,
        },
      }}
    >
      <EarningsStack.Screen
        name="HandCoinsScreen"
        component={EarningsScreen}
        options={{ headerShown: false }}
      />
      {sharedStackScreens(EarningsStack)}
    </EarningsStack.Navigator>
  );
}

export const TabsNavigator = () => {
  return (
    <>
      <Tab.Navigator
        tabBar={(props) => <TabBar {...props} />}
        initialRouteName="Map"
        backBehavior="history"
        screenOptions={{
          tabBarStyle: [
            {
              height: 300,
              borderTopWidth: 1,
              elevation: 5,
            },
          ],
          tabBarShowLabel: false,
          headerShown: false,
        }}
      >
        <Tab.Screen
          name="Map"
          component={HomeTabSreens}
          listeners={({ navigation }) => ({
            tabPress: (e) => {
              // Prevent default action
              e.preventDefault();

              // Do something manually
              navigation.navigate("Map");
            },
          })}
        />
        <Tab.Screen name="__" component={GoOnlineTab} />
        <Tab.Screen name="HandCoins" component={EarningsTab} />
      </Tab.Navigator>
    </>
  );
};
