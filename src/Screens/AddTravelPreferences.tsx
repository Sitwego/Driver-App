import { useCallback, useRef, useState } from "react";
import { ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useUpdateTravelPreferences } from "~/hooks/apis";
import OptionsPicker from "~/components/OptionPicker";
import RnText from "~/components/RnText";
import { RnView } from "~/components/RnView";
import {
  DEFAULT_TRAVEL_PREFERENCES,
  travelPreferencesStore,
} from "~/lib/store";
import { preferences } from "~/lib/store/userPreferences";
import { s } from "~/styles/Common-Styles";
import { atoms } from "~/ui/theme/atoms";
import { useAppTheme } from "~/ui/theme/ThemeProvider";
import { themes } from "~/ui/theme/theme_utils";

const CATEGORY_LABELS: Record<keyof typeof preferences, string> = {
  chattiness: "Chattiness 🗣️",
  music: "Music 🎶🎵",
  smoking: "Smoking 🚬",
  pets: "Pets 🐕🐈",
};

export function TravelPreferencesScreen() {
  const { fonts } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { mutate: updatePreferences } = useUpdateTravelPreferences();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [selected, setSelected] = useState<
    Record<keyof typeof preferences, string>
  >(
    () =>
      travelPreferencesStore.get(["preferences"]) ?? DEFAULT_TRAVEL_PREFERENCES,
  );

  const onOptionSelected = useCallback(
    (category: keyof typeof preferences, key: string) => {
      setSelected((prev) => {
        const next = { ...prev, [category]: key };
        travelPreferencesStore.set(["preferences"], next);

        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => updatePreferences(next), 600);

        return next;
      });
    },
    [updatePreferences],
  );

  return (
    <RnView style={[s.flex1]}>
      <ScrollView
        contentContainerStyle={[
          s.px16,
          { paddingTop: 16, paddingBottom: insets.bottom + 100, gap: 28 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {(Object.keys(preferences) as (keyof typeof preferences)[]).map(
          (category) => (
            <RnView key={category} style={[s.flexCol, { gap: 10 }]}>
              <RnText
                style={[atoms.text_md, { fontFamily: fonts.heavy.fontFamily }]}
              >
                {CATEGORY_LABELS[category]}
              </RnText>

              <RnText style={[atoms.text_xs, { color: themes.gray_300 }]}>
                {preferences[category].find((o) => o.key === selected[category])
                  ?.title ?? ""}
              </RnText>

              <OptionsPicker
                options={preferences[category]}
                selectedOption={selected[category]}
                onOptionSelected={(key) => onOptionSelected(category, key)}
                style={[s.gap6]}
              />
            </RnView>
          ),
        )}
      </ScrollView>
    </RnView>
  );
}
