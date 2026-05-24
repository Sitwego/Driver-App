import { memo, useCallback, useMemo, useRef } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Avatar from "~/components/Avatar";
import Icon from "~/components/Icons";
import RnText from "~/components/RnText";
import { RnView } from "~/components/RnView";
import { useImageLoader } from "~/hooks/useImageLoader";
import { useUserState } from "~/lib/state/userState";
import { s } from "~/styles/Common-Styles";
import { useAppTheme } from "../theme/ThemeProvider";
import { atoms } from "../theme/atoms";
import { themes } from "../theme/theme_utils";
import { StyleSheet } from "react-native";
import { width } from "~/utils/metrics/dimm";
import { ScrollView } from "react-native-gesture-handler";
import { icons } from "lucide-react-native";
import PressableWithFeedBack from "~/components/PressableButton/PressableWithFeedBack";
import { useGetDriverVehicleCategories } from "~/hooks/apis";
import { formatPrice } from "~/utils/metrics/numbers";
import {
  DEFAULT_TRAVEL_PREFERENCES,
  travelPreferencesStore,
  useStorage,
} from "~/lib/store";
import { preferences } from "~/lib/store/userPreferences";
import LoadingIndicator from "~/components/LoadingIndicator";
const Pressable = PressableWithFeedBack;

export type AboutDriverTypes = {
  navigation?: any;
};

export const AboutDriver = memo(function AboutDriver({
  navigation,
}: AboutDriverTypes) {
  const insets = useSafeAreaInsets();
  const scrollview = useRef<ScrollView>(null);
  const { colors, fonts } = useAppTheme();
  const state = useUserState();
  const { data, isPending } = useGetDriverVehicleCategories();
  const [savedPreferences] = useStorage(travelPreferencesStore, [
    "preferences",
  ]);

  const { isLoading, uri, onLoad } = useImageLoader();

  const contacts = useMemo(() => {
    return [
      {
        type: "Mobile",
        value: state.phone,
        verified: true,
        icons: "Phone" as keyof typeof icons,
      },
      {
        type: "Email",
        value: state.email,
        verified: false,
        icons: "Mail" as keyof typeof icons,
      },
    ];
  }, [state.email, state.phone]);

  const goToDriverProfile = useCallback(() => {
    navigation?.navigate("DriverProfile");
  }, [navigation]);

  const goToEditProfilePicture = useCallback(() => {
    navigation?.navigate("EditProfilePicture");
  }, [navigation]);

  const goToEditPersonalDetails = useCallback(() => {
    navigation?.navigate("EditPersonalDetails");
  }, [navigation]);

  const addBio = useCallback(() => {
    navigation?.navigate("AddBio");
  }, [navigation]);

  const goToSubscriptionPlans = useCallback(() => {
    const params = {
      planId: "plan_taxi_per_ride",
      category: "Taxi" as const,
      activeSub: {
        plan_id: "plan_taxi_per_ride",
        rides_used: 10,
        next_billing_date: "Mar 4, 2026",
      },
    };
    navigation?.navigate("SubscriptionOverview", params);
  }, [navigation]);
  return (
    <ScrollView
      style={[s.h100pct, s.w100pct, s.flex1, { paddingTop: insets.top }]}
      contentContainerStyle={{ borderWidth: 0 }}
      ref={scrollview}
    >
      <RnView style={[s.flex1, s.px16, s.flexCol, s.gap12, { marginTop: 10 }]}>
        <Pressable
          onPress={goToDriverProfile}
          style={[s.flexDirectionRow, s.justifyBetween]}
        >
          <RnView style={[s.flexDirectionRow, s.gap12]}>
            <RnView style={[]}>
              <Avatar size={80} onLoad={onLoad} avatar={uri} />
            </RnView>
            <RnView style={[s.gap4]}>
              <RnText
                style={[atoms.text_md, { fontFamily: fonts.heavy.fontFamily }]}
              >
                {state.first_name} {state.last_name}
              </RnText>
              <RnText
                style={[
                  atoms.text_xs,
                  {
                    fontFamily: fonts.heavy.fontFamily,
                    color: colors.lightGray,
                  },
                ]}
              >
                Newcomer
              </RnText>
            </RnView>
          </RnView>
          <RnView>
            <Icon
              name="ChevronRight"
              size={28}
              color={colors.text}
              strokeWidth={2.5}
            />
          </RnView>
        </Pressable>
        <RnView
          style={[
            s.px10,
            s.py5,
            s.borderRadius_sm,
            s.flexDirectionRow,
            {
              borderColor: themes.bg_900,
              borderWidth: StyleSheet.hairlineWidth,
              justifyContent: "flex-start",
            },
          ]}
        >
          <RnView style={[s.flexDirectionRow, s.gap5]}>
            <RnView
              style={[
                s.borderRadius_full,
                s.p8,
                { backgroundColor: "hsla(152 82.2% 42% / 0.16)" },
              ]}
            >
              <Icon name="HandCoins" size={32} color={themes.green_600} />
            </RnView>
            <RnView style={[s.gap5]}>
              <RnText
                style={[atoms.text_md, { fontFamily: fonts.heavy.fontFamily }]}
              >
                KSH {formatPrice(state.total_earnings as number)}
              </RnText>
              <RnText
                style={[
                  atoms.text_2xs,
                  {
                    fontFamily: fonts.heavy.fontFamily,
                    color: colors.lightGray,
                  },
                ]}
              >
                Saved so far
              </RnText>
            </RnView>
          </RnView>
          <RnView style={[s.flexDirectionRow, s.gap5, { marginLeft: "14%" }]}>
            <RnView
              style={[
                s.borderRadius_full,
                s.p8,
                { backgroundColor: "hsla(152 82.2% 42% / 0.16)" },
              ]}
            >
              <Icon name="CarTaxiFront" size={32} color={themes.green_600} />
            </RnView>
            <RnView style={[s.gap5]}>
              <RnText
                style={[atoms.text_md, { fontFamily: fonts.heavy.fontFamily }]}
              >
                {state.total_rides || 0}
              </RnText>
              <RnText
                style={[
                  atoms.text_2xs,
                  {
                    fontFamily: fonts.heavy.fontFamily,
                    color: colors.lightGray,
                  },
                ]}
              >
                Total rides
              </RnText>
            </RnView>
          </RnView>
        </RnView>
        <RnView style={[s.gap8, { marginTop: 16 }]}>
          <Pressable style={[s.p8]} onPress={goToEditProfilePicture}>
            <RnText
              style={[
                // atoms.text_md,
                { fontFamily: fonts.heavy.fontFamily, color: colors.primary },
              ]}
            >
              Edit profile picture
            </RnText>
          </Pressable>
          <Pressable style={[s.p8]} onPress={goToEditPersonalDetails}>
            <RnText
              style={[
                // atoms.text_md,
                { fontFamily: fonts.heavy.fontFamily, color: colors.primary },
              ]}
            >
              Edit personal details
            </RnText>
          </Pressable>
        </RnView>
        <RnView
          style={[
            {
              marginVertical: 16,
              borderColor: themes.bg_900,
              borderWidth: StyleSheet.hairlineWidth,
            },
          ]}
        />
        <RnView style={[s.gap12]}>
          <RnText
            style={[atoms.text_md, { fontFamily: fonts.heavy.fontFamily }]}
          >
            Contacts
          </RnText>
          {contacts.map((c, i) => {
            return (
              <Pressable
                key={i}
                style={[
                  s.flexDirectionRow,
                  s.justifyBetween,
                  s.py8,
                  { marginTop: 8 },
                ]}
              >
                <RnView style={[s.flexDirectionRow, s.gap16]}>
                  <Icon
                    name={c.icons}
                    size={28}
                    color={themes.green_600}
                    strokeWidth={1.56}
                  />
                  <RnView
                    style={[s.flexCol, s.gap2, { maxWidth: width - 120 }]}
                  >
                    <RnText
                      style={[
                        atoms.text_2xs,
                        {
                          fontFamily: fonts.heavy.fontFamily,
                          color: colors.lightGray,
                        },
                      ]}
                    >
                      {c.type} {"   "}
                      <RnText
                        style={[atoms.text_2xs, { color: themes.green_600 }]}
                      >
                        Verified
                      </RnText>
                    </RnText>
                    <RnText
                      style={[
                        atoms.text_sm,
                        { fontFamily: fonts.heavy.fontFamily },
                      ]}
                    >
                      {c.value}
                    </RnText>
                  </RnView>
                </RnView>
              </Pressable>
            );
          })}
        </RnView>
        <RnView style={[s.gap12, s.w100pct, { marginTop: 16 }]}>
          <RnText
            style={[atoms.text_md, { fontFamily: fonts.heavy.fontFamily }]}
          >
            More about you
          </RnText>
          <Pressable
            style={[s.flexDirectionRow, s.justifyBetween, { marginTop: 8 }]}
            onPress={addBio}
          >
            <RnView style={[s.flexDirectionRow, s.gap16, { flex: 1 }]}>
              <Icon
                name={savedPreferences?.bio ? "Pencil" : "CirclePlus"}
                size={24}
                color={colors.primary}
                strokeWidth={1.56}
              />
              <RnView style={[s.gap2, s.px16, { width: "75%" }]}>
                <RnText
                  style={[
                    atoms.text_sm,
                    {
                      fontFamily: fonts.heavy.fontFamily,
                      color: colors.primary,
                    },
                  ]}
                >
                  {savedPreferences?.bio ? "Edit bio" : "Add a mini bio"}
                </RnText>
                {savedPreferences?.bio ? (
                  <RnText
                    style={[
                      atoms.text_2xs,
                      {
                        color: themes.gray_300,
                        flexWrap: "wrap",
                        flexShrink: 1,
                      },
                    ]}
                    numberOfLines={12}
                  >
                    {savedPreferences.bio}
                  </RnText>
                ) : null}
              </RnView>
            </RnView>
          </Pressable>
          <Pressable
            style={[s.flexDirectionRow, s.justifyBetween, { marginTop: 8 }]}
            onPress={() => navigation?.navigate("AddTravelPreferences")}
          >
            <RnView style={[s.flexDirectionRow, s.gap16]}>
              <Icon
                name="SquarePen"
                size={24}
                color={colors.primary}
                strokeWidth={1.56}
              />
              <RnText
                style={[
                  atoms.text_sm,
                  { fontFamily: fonts.heavy.fontFamily, color: colors.primary },
                ]}
              >
                Edit travel preferences
              </RnText>
            </RnView>
          </Pressable>
          <RnView
            style={[
              s.flexDirectionRow,
              { flexWrap: "wrap", gap: 8, marginTop: 4 },
            ]}
          >
            {(Object.keys(preferences) as (keyof typeof preferences)[]).map(
              (category) => {
                const key = (savedPreferences ?? DEFAULT_TRAVEL_PREFERENCES)[
                  category
                ];
                const title =
                  preferences[category].find((o) => o.key === key)?.title ??
                  key;
                return (
                  <RnView
                    key={category}
                    style={[
                      s.px10,
                      s.py5,
                      s.borderRadius_full,
                      { backgroundColor: themes.bg_900 },
                    ]}
                  >
                    <RnText
                      style={[
                        atoms.text_2xs,
                        { fontFamily: fonts.heavy.fontFamily },
                      ]}
                    >
                      {title}
                    </RnText>
                  </RnView>
                );
              },
            )}
          </RnView>
        </RnView>
        <RnView style={[s.gap12, { marginTop: 16 }]}>
          <RnText
            style={[atoms.text_md, { fontFamily: fonts.heavy.fontFamily }]}
          >
            Vehicle and Categories
          </RnText>
          {isPending ? (
            <LoadingIndicator
              dotSize={4}
              gap={8}
              color={themes.green_500}
              bounceHeight={12}
            />
          ) : (
            <PressableWithFeedBack
              style={[s.flexDirectionRow, s.justifyBetween, { marginTop: 8 }]}
              onPress={() =>
                navigation.push("VehicleAndCategoriesScreen", { data })
              }
            >
              <RnView style={[s.flexDirectionRow, s.gap16]}>
                <Icon
                  name="CarTaxiFront"
                  size={28}
                  color={themes.green_600}
                  strokeWidth={1.56}
                />
                <RnView
                  style={[
                    s.flexCol,
                    s.gap2,
                    s.justifyCenter,
                    { maxWidth: width - 120 },
                  ]}
                >
                  <RnText
                    style={[
                      atoms.text_sm,
                      { fontFamily: fonts.heavy.fontFamily },
                    ]}
                  >
                    {data.make} {data.model} - {data?.plate_number}
                  </RnText>
                  <RnText
                    style={[
                      atoms.text_2xs,
                      {
                        fontFamily: fonts.heavy.fontFamily,
                        color: colors.lightGray,
                      },
                    ]}
                  >
                    {data?.categories.join(", ") || "No categories added yet"}
                    <RnText
                      style={[atoms.text_2xs, { color: themes.green_600 }]}
                    >
                      <Icon
                        name="Dot"
                        size={20}
                        strokeWidth={1}
                        color={colors.text}
                      />
                      ({data?.color})
                    </RnText>
                  </RnText>
                </RnView>
              </RnView>
              <Icon
                name="ChevronRight"
                strokeWidth={2}
                color={colors.text}
                size={28}
              />
            </PressableWithFeedBack>
          )}
        </RnView>
        {/* For Payment */}
        <RnView style={[s.gap12, { marginTop: 16 }]}>
          <RnText
            style={[atoms.text_md, { fontFamily: fonts.heavy.fontFamily }]}
          >
            Payouts and Subscriptions
          </RnText>
          <Pressable
            style={[s.flexDirectionRow, s.justifyBetween, { marginTop: 8 }]}
            onPress={() => navigation.push("PayOut")}
          >
            <RnView style={[s.flexDirectionRow, s.gap16]}>
              <Icon
                name="CreditCard"
                size={28}
                color={themes.green_600}
                strokeWidth={1.56}
              />
              <RnView style={[s.flexCol, s.gap2, { maxWidth: width - 120 }]}>
                <RnText
                  style={[
                    atoms.text_2xs,
                    {
                      fontFamily: fonts.heavy.fontFamily,
                      color: colors.lightGray,
                    },
                  ]}
                >
                  Mpesa Payout {"   "}
                  <RnText style={[atoms.text_2xs, { color: themes.green_600 }]}>
                    Verified
                  </RnText>
                </RnText>
                <RnText
                  style={[
                    atoms.text_sm,
                    { fontFamily: fonts.heavy.fontFamily },
                  ]}
                >
                  07*****234
                </RnText>
              </RnView>
            </RnView>
            <RnView>
              <Icon
                name="ChevronRight"
                size={28}
                color={colors.text}
                strokeWidth={2.5}
              />
            </RnView>
          </Pressable>
        </RnView>
        {/* Manage Subscriptions */}
        <RnView style={[s.gap12, { marginTop: 16 }]}>
          <PressableWithFeedBack
            onPress={goToSubscriptionPlans}
            style={[s.flexDirectionRow, s.justifyBetween, { marginTop: 8 }]}
          >
            <RnView style={[s.flexDirectionRow, s.gap16]}>
              <Icon
                name="Wallet"
                size={28}
                color={themes.green_600}
                strokeWidth={1.56}
              />
              <RnView style={[s.flexCol, s.gap2, { maxWidth: width - 120 }]}>
                <RnText
                  style={[
                    atoms.text_sm,
                    { fontFamily: fonts.heavy.fontFamily },
                  ]}
                >
                  Manage Subscriptions
                </RnText>
                <RnText
                  style={[
                    atoms.text_2xs,
                    {
                      fontFamily: fonts.heavy.fontFamily,
                      color: colors.lightGray,
                    },
                  ]}
                >
                  You are currently not subscribed to any plan.
                </RnText>
              </RnView>
            </RnView>
            <RnView style={[]}>
              <Icon name="ChevronRight" size={28} color={colors.text} />
            </RnView>
          </PressableWithFeedBack>
        </RnView>
      </RnView>
      <RnView style={{ height: 300 }} />
    </ScrollView>
  );
});
