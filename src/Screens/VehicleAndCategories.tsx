import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScrollView } from "react-native-gesture-handler";
import { Checkbox } from "expo-checkbox";
import { Image } from "expo-image";
import Icon from "~/components/Icons";
import PressableWithFeedBack from "~/components/PressableButton/PressableWithFeedBack";
import RnText from "~/components/RnText";
import { RnView } from "~/components/RnView";
import { s } from "~/styles/Common-Styles";
import { atoms } from "~/ui/theme/atoms";
import { themes } from "~/ui/theme/theme_utils";
import { useAppTheme } from "~/ui/theme/ThemeProvider";
import { useCallback, useMemo, useState } from "react";
import { useUserState } from "~/lib/state/userState";
import { vehicleCategoryStore } from "~/lib/store";
import { getCategoryFromPlanId } from "~/utils/subscription";
import {
  getVehicleHeroImage,
  normalizeVehicleCategory,
} from "~/utils/vehicleImage";

export function VehicleAndCategoriesScreen({ navigation, route }: any) {
  const { colors, fonts } = useAppTheme();
  const inssts = useSafeAreaInsets();
  const data = route.params?.data;
  const driver = useUserState();
  const v_categories = vehicleCategoryStore.get(["categories"]);
  const [selectedCategory, setSelectedCategories] = useState<string[]>(() => {
    if (v_categories) {
      return v_categories;
    }
    // If no categories are available take first category from the data
    return [data.categories[0]];
  });

  // Keep the artwork here in step with the detail screen: a boda rider should
  // not see a car on this screen and a motorcycle on the next one.
  const category = useMemo(
    () =>
      normalizeVehicleCategory(data?.vehicle_type) ??
      (driver.plan_id ? getCategoryFromPlanId(driver.plan_id) : "Taxi"),
    [data?.vehicle_type, driver.plan_id],
  );

  const handleCheckBox = useCallback((value: string) => {
    setSelectedCategories((prev) => {
      if (prev.includes(value)) {
        // Prevent deselecting the last category
        if (prev.length === 1) return prev;
        const newCategories = prev.filter((item) => item !== value);
        vehicleCategoryStore.set(["categories"], newCategories);
        return newCategories;
      }
      const newCategories = [...prev, value];
      vehicleCategoryStore.set(["categories"], newCategories);
      return newCategories;
    });
  }, []);
  return (
    <ScrollView
      style={[s.flex1]}
      contentContainerStyle={[
        s.px16,
        // The category list grows with the driver's approved categories, so the
        // last row needs clearance from the gesture bar rather than sitting on it.
        { paddingBottom: inssts.bottom + 24 },
      ]}
    >
      <RnView
        style={[
          s.pb20,
          s.alignSelf,
          s.flexDirectionRow,
          s.justifyBetween,
          {
            borderBlockColor: themes.bg_800,
            borderBottomWidth: 1,
            width: "95%",
          },
        ]}
      >
        <RnView style={[s.flexCol, s.gap6]}>
          <RnText
            style={[atoms.text_md, { fontFamily: fonts.bold.fontFamily }]}
          >
            {data?.y_manufacturing}
          </RnText>
          <RnText
            style={[atoms.text_md, { fontFamily: fonts.bold.fontFamily }]}
          >
            {data?.make} {data?.model}
          </RnText>
          <RnText
            style={[atoms.text_md, { fontFamily: fonts.bold.fontFamily }]}
          >
            {data?.plate_number}
          </RnText>
          <RnView
            style={[
              s.p4,
              s.borderRadius_md,
              { backgroundColor: themes.green_600 },
            ]}
          >
            <RnText style={[s.textCenter, atoms.text_sm]}>In Use</RnText>
          </RnView>
        </RnView>
        <RnView
          style={[
            {
              width: 200,
              top: -8,
              right: -30,
            },
          ]}
        >
          <Image
            source={getVehicleHeroImage(category)}
            style={{ flex: 1, height: null, width: null }}
            // "contain" rather than "cover": the bike and auto art is top-view
            // and square-ish, so cover would crop it to a sliver.
            contentFit="contain"
            accessible={true} // Must set for `accessibilityLabel` to work
            accessibilityIgnoresInvertColors
            accessibilityLabel={""}
          />
        </RnView>
      </RnView>
      <PressableWithFeedBack
        accessibilityRole="button"
        accessibilityLabel="See vehicle details"
        onPress={() => navigation.push("VehicleDetails", { vehicle: data })}
        style={[
          s.w100pct,
          s.px10,
          s.mt10,
          s.flexDirectionRow,
          s.justifyBetween,
        ]}
      >
        <RnView style={[s.flexDirectionRow, s.gap14]}>
          <Icon
            name="Info"
            size={20}
            color={colors.lightGray}
            strokeWidth={1}
          />
          <RnView>
            <RnText style={[atoms.text_sm]}>See details</RnText>
          </RnView>
        </RnView>
        <Icon
          name="ChevronRight"
          size={28}
          strokeWidth={2}
          color={colors.lightGray}
        />
      </PressableWithFeedBack>
      {/* No flex:1 here — inside a ScrollView's content container it fights the
          intrinsic height the scroll view measures from. */}
      <RnView>
        <RnView style={[s.mt20]}>
          <RnText
            style={[atoms.text_xl, { fontFamily: fonts.heavy.fontFamily }]}
          >
            Categories
          </RnText>
          <RnView
            style={[
              s.w100pct,
              s.flexDirectionRow,
              s.mt26,
              s.ml10,
              { flexWrap: "wrap", gap: 16 },
            ]}
          >
            {data?.categories.length > 0 && (
              <>
                {data.categories.map((category: string, index: number) => (
                  <RnView
                    key={category}
                    style={[s.flexDirectionRow, s.gap20, { marginBottom: 14 }]}
                  >
                    <Checkbox
                      style={[{ width: 24, height: 24 }]}
                      value={selectedCategory.includes(category)}
                      onValueChange={() => handleCheckBox(category)}
                      color={
                        selectedCategory.includes(category)
                          ? themes.green_600
                          : undefined
                      }
                    />
                    <RnView>
                      <RnText
                        style={[
                          atoms.text_sm,
                          { fontFamily: fonts.bold.fontFamily },
                        ]}
                      >
                        {category}
                      </RnText>
                    </RnView>
                  </RnView>
                ))}
              </>
            )}
          </RnView>
        </RnView>
      </RnView>
    </ScrollView>
  );
}
