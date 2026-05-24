import { PressableScale as Pressable } from "pressto";
import { ScrollView, Linking, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Icon from "~/components/Icons";
import RnText from "~/components/RnText";
import { RnView } from "~/components/RnView";
import { NavigationProps } from "~/navigation/types";
import { s } from "~/styles/Common-Styles";
import { useAppTheme } from "~/ui/theme/ThemeProvider";
import { atoms } from "~/ui/theme/atoms";
import { themes } from "~/ui/theme/theme_utils";

const APP_VERSION = "0.0.1";
const BUILD_NUMBER = "1";

type LinkRowProps = {
  label: string;
  icon: string;
  onPress: () => void;
};

function LinkRow({ label, icon, onPress }: LinkRowProps) {
  const { colors, fonts } = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[
        s.flexDirectionRow,
        s.justifyBetween,
        s.alignCenter,
        s.py16,
        {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: themes.bg_800,
        },
      ]}
    >
      <RnView style={[s.flexDirectionRow, s.gap12, s.alignCenter]}>
        <Icon
          name={icon as any}
          size={18}
          color={colors.text}
          strokeWidth={1.5}
        />
        <RnText
          style={[atoms.text_sm, { fontFamily: fonts.regular.fontFamily }]}
        >
          {label}
        </RnText>
      </RnView>
      <Icon
        name="ExternalLink"
        size={16}
        color={colors.lightGray}
        strokeWidth={1.5}
      />
    </Pressable>
  );
}

export function AboutScreen({ navigation }: NavigationProps<"AboutScreen">) {
  const { colors, fonts } = useAppTheme();
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      contentContainerStyle={[
        s.px16,
        s.py16,
        { paddingBottom: insets.bottom + 32 },
      ]}
    >
      {/* App identity */}
      <RnView style={[s.alignCenter, s.py24, s.gap8]}>
        <RnView
          style={[
            s.alignCenter,
            s.justifyCenter,
            {
              width: 72,
              height: 72,
              borderRadius: 18,
              backgroundColor: colors.primary,
              marginBottom: 4,
            },
          ]}
        >
          <Icon name="Car" size={36} color="#fff" strokeWidth={1.5} />
        </RnView>
        <RnText style={[atoms.text_lg, { fontFamily: fonts.heavy.fontFamily }]}>
          Mobility Captain
        </RnText>
        <RnText style={[atoms.text_xs, { color: colors.lightGray }]}>
          Version {APP_VERSION} (Build {BUILD_NUMBER})
        </RnText>
      </RnView>

      <RnText
        style={[
          atoms.text_xs,
          {
            color: colors.lightGray,
            fontFamily: fonts.bold.fontFamily,
            letterSpacing: 0.8,
            marginBottom: 4,
            textTransform: "uppercase",
          },
        ]}
      >
        Legal
      </RnText>
      <LinkRow icon="FileText" label="Terms of Service" onPress={() => {}} />
      <LinkRow icon="Shield" label="Privacy Policy" onPress={() => {}} />
      <LinkRow
        icon="BookOpen"
        label="Open source licenses"
        onPress={() => {}}
      />

      <RnText
        style={[
          atoms.text_xs,
          {
            color: colors.lightGray,
            fontFamily: fonts.bold.fontFamily,
            letterSpacing: 0.8,
            marginTop: 24,
            marginBottom: 4,
            textTransform: "uppercase",
          },
        ]}
      >
        Community
      </RnText>
      <Pressable
        onPress={() => Linking.openURL("https://github.com/sitwego")}
        style={[
          s.flexDirectionRow,
          s.alignCenter,
          s.gap12,
          s.py16,
          s.px16,
          s.borderRadius_sm,
          {
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: themes.bg_800,
            backgroundColor: themes.bg_900,
          },
        ]}
      >
        <RnView
          style={[
            s.alignCenter,
            s.justifyCenter,
            {
              width: 36,
              height: 36,
              borderRadius: 8,
              backgroundColor: colors.lightBackground,
            },
          ]}
        >
          <Icon name="Github" size={20} color={colors.text} strokeWidth={1.5} />
        </RnView>
        <RnView style={[{ flexShrink: 1 }]}>
          <RnText
            style={[atoms.text_sm, { fontFamily: fonts.bold.fontFamily }]}
          >
            GitHub
          </RnText>
          <RnText style={[atoms.text_xs, { color: colors.lightGray }]}>
            View source code and contribute
          </RnText>
        </RnView>
        <Icon
          name="ExternalLink"
          size={16}
          color={colors.lightGray}
          strokeWidth={1.5}
        />
      </Pressable>

      <RnView style={[s.alignCenter, s.mt24]}>
        <RnText style={[atoms.text_xs, { color: colors.lightGray }]}>
          © {new Date().getFullYear()} Sitwego. All rights reserved.
        </RnText>
      </RnView>
    </ScrollView>
  );
}
