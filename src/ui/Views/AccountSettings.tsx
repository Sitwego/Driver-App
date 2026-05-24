import { useFocusEffect } from "@react-navigation/native";
import { memo, useCallback, useRef } from "react";
import { ScrollView } from "react-native-gesture-handler";
import { PressableScale as Pressable } from "pressto";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import RnText from "~/components/RnText";
import { RnView } from "~/components/RnView";
import { s } from "~/styles/Common-Styles";
import { useAppTheme } from "../theme/ThemeProvider";
import Icon from "~/components/Icons";
import { atoms } from "../theme/atoms";
import { StyleSheet } from "react-native";
import { themes } from "../theme/theme_utils";

const data = [
  {
    title: "Navigation and sounds",
    icon: "Navigation2" as const,
    route: "NavigationAndSoundsScreen",
  },
  // {
  //   title: "Saved passengers",
  //   icon: "Users" as const,
  //   route: "SavedPassengersScreen",
  // },
  {
    title: "Radius settings",
    icon: "Radius" as const,
    route: "RadiusSettingsScreen",
    // subtitle: "Navigation, voice, and sounds",
  },
  {
    title: "Security center",
    icon: "LockKeyhole" as const,
    route: "SecurityCenterScreen",
    subtitle: "Keep your account secure",
  },
  {
    title: "Help",
    icon: "Headset" as const,
    route: "HelpScreen",
  },
  {
    title: "About",
    icon: "Info" as const,
    route: "AboutScreen",
  },
];

export type AccountSettingsTypes = { navigation: any };
export const AccountSettings = memo(function AccountSettings({
  navigation,
}: AccountSettingsTypes) {
  const insets = useSafeAreaInsets();
  const scrollview = useRef<ScrollView>(null);
  const { colors, fonts } = useAppTheme();

  const navigate = useCallback(
    (route: string) => {
      navigation.navigate(route as any);
    },
    [navigation],
  );
  return (
    <RnView style={[s.flex1]}>
      <ScrollView
        style={[s.h100pct, s.w100pct, { paddingTop: insets.top }]}
        contentContainerStyle={{ borderWidth: 0 }}
        ref={scrollview}
      >
        <RnView
          style={[s.flex1, s.px16, s.flexCol, s.gap12, { marginTop: 10 }]}
        >
          {data.map((item, index) => {
            return (
              <RnView
                key={index}
                style={[
                  s.w100pct,
                  {
                    borderBlockColor: themes.bg_800,
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    paddingBottom: 12,
                  },
                ]}
              >
                <Pressable
                  onPress={() => {
                    navigate(item.route);
                  }}
                  style={[s.flexDirectionRow, s.justifyBetween]}
                >
                  <RnView style={[s.flexDirectionRow, s.gap16]}>
                    <Icon
                      name={item.icon}
                      color={colors.text}
                      size={24}
                      strokeWidth={1}
                    />
                    <RnView
                      style={[s.justifyCenter, s.flexCol, { flexShrink: 1 }]}
                    >
                      <RnText
                        style={[
                          atoms.text_sm,
                          { fontFamily: fonts.heavy.fontFamily },
                        ]}
                      >
                        {item.title}
                      </RnText>
                      {item.subtitle && (
                        <RnText
                          style={[
                            atoms.text_xs,
                            {
                              fontFamily: fonts.regular.fontFamily,
                              color: colors.lightGray,
                            },
                          ]}
                        >
                          {item.subtitle}
                        </RnText>
                      )}
                    </RnView>
                  </RnView>
                  <Icon
                    name="ChevronRight"
                    color={colors.text}
                    size={28}
                    strokeWidth={2}
                  />
                </Pressable>
              </RnView>
            );
          })}
        </RnView>
      </ScrollView>
      <RnView style={[{ bottom: insets.bottom + 70 }]}>
        <Pressable>
          <RnText
            style={[
              atoms.text_md,
              s.textCenter,
              s.py16,
              {
                color: colors.danger,
                fontFamily: fonts.heavy.fontFamily,
              },
            ]}
          >
            Log out
          </RnText>
        </Pressable>
        {/* Version text goes here */}
        <RnView style={[s.alignCenter, s.justifyCenter]}>
          <RnText
            style={[
              atoms.text_xs,
              s.textCenter,
              {
                color: colors.lightGray,
                paddingBottom: 20,
                fontFamily: fonts.regular.fontFamily,
              },
            ]}
          >
            <RnText
              style={[
                atoms.text_xs,
                s.textCenter,
                {
                  color: colors.lightGray,
                  paddingBottom: 20,
                  fontFamily: fonts.regular.fontFamily,
                },
              ]}
            >
              <RnText style={[s.textCenter]}>©</RnText> 2025 Sitwego
            </RnText>
            <Icon name="Dot" size={14} color={colors.lightGray} />
            Version 0.0.1
          </RnText>
        </RnView>
      </RnView>
    </RnView>
  );
});
