import { ScrollView } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import RnText from "~/components/RnText";
import { RnView } from "~/components/RnView";
import { s } from "~/styles/Common-Styles";
import { atoms } from "~/ui/theme/atoms";
import Icon from "~/components/Icons";
import { useAppTheme } from "~/ui/theme/ThemeProvider";
import { NavigationProps } from "~/navigation/types";
import { Pressable, StyleSheet } from "react-native";
import { themes } from "~/ui/theme/theme_utils";

type SecurityItemProps = {
  icon: string;
  label: string;
  subtitle: string;
  onPress: () => void;
  danger?: boolean;
};

function SecurityItem({
  icon,
  label,
  subtitle,
  onPress,
  danger,
}: SecurityItemProps) {
  const { colors, fonts } = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[
        s.flexDirectionRow,
        s.alignCenter,
        s.gap16,
        s.py16,
        {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: themes.bg_800,
        },
      ]}
    >
      <RnView
        style={[
          s.alignCenter,
          s.justifyCenter,
          {
            width: 40,
            height: 40,
            borderRadius: 10,
            backgroundColor: danger
              ? `${themes.red_600}18`
              : colors.lightBackground,
          },
        ]}
      >
        <Icon
          name={icon as any}
          size={20}
          color={danger ? themes.red_600 : colors.text}
          strokeWidth={1.5}
        />
      </RnView>
      <RnView style={[{ flexShrink: 1 }]}>
        <RnText
          style={[
            atoms.text_sm,
            {
              fontFamily: fonts.bold.fontFamily,
              color: danger ? themes.red_600 : colors.text,
            },
          ]}
        >
          {label}
        </RnText>
        <RnText style={[atoms.text_xs, { color: colors.lightGray, marginTop: 2 }]}>
          {subtitle}
        </RnText>
      </RnView>
      <Icon
        name="ChevronRight"
        size={20}
        color={colors.lightGray}
        strokeWidth={2}
      />
    </Pressable>
  );
}

export function SecurityCenterScreen({
  navigation,
}: NavigationProps<"SecurityCenterScreen">) {
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
      <RnView style={[s.flexDirectionRow, s.alignCenter, s.gap12, s.mb20]}>
        <RnView
          style={[
            s.alignCenter,
            s.justifyCenter,
            {
              width: 48,
              height: 48,
              borderRadius: 12,
              backgroundColor: colors.lightBackground,
            },
          ]}
        >
          <Icon
            name="LockKeyhole"
            size={24}
            color={colors.primary}
            strokeWidth={1.5}
          />
        </RnView>
        <RnView>
          <RnText style={[atoms.text_md, { fontFamily: fonts.heavy.fontFamily }]}>
            Security Center
          </RnText>
          <RnText style={[atoms.text_xs, { color: colors.lightGray }]}>
            Keep your account secure
          </RnText>
        </RnView>
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
        Account Security
      </RnText>

      <SecurityItem
        icon="KeyRound"
        label="Change password"
        subtitle="Update your account password"
        onPress={() => {}}
      />
      <SecurityItem
        icon="Smartphone"
        label="Two-factor authentication"
        subtitle="Add an extra layer of protection"
        onPress={() => {}}
      />
      <SecurityItem
        icon="MonitorSmartphone"
        label="Active sessions"
        subtitle="View and manage logged-in devices"
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
        Danger Zone
      </RnText>
      <SecurityItem
        icon="Trash2"
        label="Delete account"
        subtitle="Permanently remove your account and data"
        onPress={() => {}}
        danger
      />
    </ScrollView>
  );
}
