import { ScrollView } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import RnText from "~/components/RnText";
import { RnView } from "~/components/RnView";
import { s } from "~/styles/Common-Styles";
import { atoms } from "~/ui/theme/atoms";
import Icon from "~/components/Icons";
import { useAppTheme } from "~/ui/theme/ThemeProvider";
import { NavigationProps } from "~/navigation/types";
import { Pressable, StyleSheet, Switch } from "react-native";
import { themes } from "~/ui/theme/theme_utils";
import {
  useDriverSettings,
  type NavApp,
} from "~/lib/Providers/DriverSettingsProvider";

type NavAppOption = {
  id: NavApp;
  label: string;
  subtitle: string;
  iconName: string;
  iconColor: string;
  iconBg: string;
  isDefault?: boolean;
};

const NAV_APPS: NavAppOption[] = [
  {
    id: "google_maps",
    label: "Google Maps",
    subtitle: "Default navigation app",
    iconName: "Map",
    iconColor: "#fff",
    iconBg: "#4285F4",
    isDefault: true,
  },
  {
    id: "waze",
    label: "Waze",
    subtitle: "Community-based navigation",
    iconName: "Navigation2",
    iconColor: "#fff",
    iconBg: "#33CCFF",
  },
];

function NavAppCard({
  app,
  selected,
  onSelect,
}: {
  app: NavAppOption;
  selected: boolean;
  onSelect: () => void;
}) {
  const { colors, fonts } = useAppTheme();
  return (
    <Pressable
      onPress={onSelect}
      style={[
        s.flexDirectionRow,
        s.alignCenter,
        s.gap12,
        s.px16,
        s.py14,
        s.borderRadius_sm,
        {
          borderWidth: 1.5,
          borderColor: selected ? themes.green_500 : themes.bg_800,
          backgroundColor: selected ? `${themes.green_950}` : themes.bg_900,
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
            backgroundColor: app.iconBg,
          },
        ]}
      >
        <Icon
          name={app.iconName as any}
          size={20}
          color={app.iconColor}
          strokeWidth={1.8}
        />
      </RnView>

      <RnView style={[{ flexShrink: 1 }]}>
        <RnView style={[s.flexDirectionRow, s.alignCenter, s.gap6]}>
          <RnText
            style={[
              atoms.text_sm,
              {
                fontFamily: fonts.bold.fontFamily,
                color: selected ? themes.green_300 : colors.text,
              },
            ]}
          >
            {app.label}
          </RnText>
          {app.isDefault && (
            <RnView
              style={[
                {
                  paddingHorizontal: 6,
                  paddingVertical: 2,
                  borderRadius: 4,
                  backgroundColor: themes.bg_800,
                },
              ]}
            >
              <RnText
                style={[
                  atoms.text_xs,
                  { color: colors.lightGray, fontSize: 10 },
                ]}
              >
                Default
              </RnText>
            </RnView>
          )}
        </RnView>
        <RnText
          style={[atoms.text_xs, { color: colors.lightGray, marginTop: 1 }]}
        >
          {app.subtitle}
        </RnText>
      </RnView>

      <RnView
        style={[
          s.alignCenter,
          s.justifyCenter,
          {
            width: 22,
            height: 22,
            borderRadius: 11,
            borderWidth: 2,
            borderColor: selected ? themes.green_500 : themes.bg_800,
            backgroundColor: selected ? themes.green_500 : "transparent",
          },
        ]}
      >
        {selected && (
          <Icon name="Check" size={12} color="#fff" strokeWidth={3} />
        )}
      </RnView>
    </Pressable>
  );
}

type SettingRowProps = {
  label: string;
  subtitle?: string;
  value: boolean;
  onToggle: (v: boolean) => void;
};

function SettingRow({ label, subtitle, value, onToggle }: SettingRowProps) {
  const { colors, fonts } = useAppTheme();
  return (
    <RnView
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
      <RnView style={[{ flexShrink: 1, marginRight: 12 }]}>
        <RnText style={[atoms.text_sm, { fontFamily: fonts.bold.fontFamily }]}>
          {label}
        </RnText>
        {subtitle && (
          <RnText
            style={[atoms.text_xs, { color: colors.lightGray, marginTop: 2 }]}
          >
            {subtitle}
          </RnText>
        )}
      </RnView>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ true: themes.green_500, false: themes.bg_800 }}
        thumbColor={value ? themes.green_200 : themes.bg_200}
      />
    </RnView>
  );
}

export function NavigationAndSoundsScreen({
  navigation,
}: NavigationProps<"NavigationAndSoundsScreen">) {
  const { colors, fonts } = useAppTheme();
  const insets = useSafeAreaInsets();

  const {
    navApp: selectedNavApp,
    setNavApp: setSelectedNavApp,
    voiceNav,
    setVoiceNav,
    arrivalSounds,
    setArrivalSounds,
    requestSounds,
    setRequestSounds,
    vibration,
    setVibration,
  } = useDriverSettings();

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
            name="Navigation2"
            size={24}
            color={colors.primary}
            strokeWidth={1.5}
          />
        </RnView>
        <RnView>
          <RnText
            style={[atoms.text_md, { fontFamily: fonts.heavy.fontFamily }]}
          >
            Navigation & Sounds
          </RnText>
          <RnText style={[atoms.text_xs, { color: colors.lightGray }]}>
            Manage your in-trip audio preferences
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
            marginBottom: 8,
            textTransform: "uppercase",
          },
        ]}
      >
        Navigation App
      </RnText>
      <RnView style={[s.gap8, s.mb24]}>
        {NAV_APPS.map((app) => (
          <NavAppCard
            key={app.id}
            app={app}
            selected={selectedNavApp === app.id}
            onSelect={() => setSelectedNavApp(app.id)}
          />
        ))}
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
        Navigation
      </RnText>
      <SettingRow
        label="Voice navigation"
        subtitle="Spoken turn-by-turn directions during trips"
        value={voiceNav}
        onToggle={setVoiceNav}
      />

      <RnText
        style={[
          atoms.text_xs,
          {
            color: colors.lightGray,
            fontFamily: fonts.bold.fontFamily,
            letterSpacing: 0.8,
            marginTop: 20,
            marginBottom: 4,
            textTransform: "uppercase",
          },
        ]}
      >
        Sounds
      </RnText>
      <SettingRow
        label="Arrival sounds"
        subtitle="Play a chime when a rider arrives"
        value={arrivalSounds}
        onToggle={setArrivalSounds}
      />
      <SettingRow
        label="New request sounds"
        subtitle="Alert sound for incoming ride requests"
        value={requestSounds}
        onToggle={setRequestSounds}
      />
      <SettingRow
        label="Vibration"
        subtitle="Vibrate on new requests and alerts"
        value={vibration}
        onToggle={setVibration}
      />
    </ScrollView>
  );
}
