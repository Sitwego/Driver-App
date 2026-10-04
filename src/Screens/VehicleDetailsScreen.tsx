import { Image } from "expo-image";
import { memo, useMemo } from "react";
import { ScrollView } from "react-native-gesture-handler";

import Icon from "~/components/Icons";
import PressableWithFeedBack from "~/components/PressableButton/PressableWithFeedBack";
import RnText from "~/components/RnText";
import { RnView } from "~/components/RnView";
import { useUserState } from "~/lib/state/userState";
import { s } from "~/styles/Common-Styles";
import { useAppTheme } from "~/ui/theme/ThemeProvider";
import { atoms } from "~/ui/theme/atoms";
import { themes } from "~/ui/theme/theme_utils";
import { SUPPORT_PHONE, openWhatsApp } from "~/utils/open_uri";
import { getCategoryFromPlanId } from "~/utils/subscription";
import {
  getVehicleHeroImage,
  normalizeVehicleCategory,
} from "~/utils/vehicleImage";

import type { VehicleDetailsScreenProps } from "~/navigation/types";

type Spec = { label: string; value: string };

/**
 * Read-only view of the vehicle the driver is registered to drive.
 *
 * The vehicle record is set during onboarding and can only be changed by our
 * team, so nothing here is editable — the way out is the support action at the
 * bottom, matching how MyDocumentsScreen handles a driver who is stuck.
 *
 * Only make, model, plate_number, y_manufacturing and categories are known to
 * come back from `api/get-driver-vehicle-categories`. Every other field is
 * optional and rendered only when the response actually carries it, so a
 * thinner payload degrades to a shorter card rather than to empty rows.
 */
export const VehicleDetailsScreen = memo(function VehicleDetailsScreen({
  route,
}: VehicleDetailsScreenProps) {
  const { colors, fonts } = useAppTheme();
  const { plan_id } = useUserState();
  const { vehicle } = route.params;

  // The vehicle's own type wins when the response carries it. It may not, so
  // fall back to the category implied by the driver's plan — the same
  // derivation MapScreen uses to pick its marker.
  const category = useMemo(
    () =>
      normalizeVehicleCategory(vehicle.vehicle_type) ??
      (plan_id ? getCategoryFromPlanId(plan_id) : "Taxi"),
    [vehicle.vehicle_type, plan_id],
  );

  const specs = useMemo(() => {
    const rows: Spec[] = [];
    const push = (label: string, value?: string | number | null) => {
      if (value === undefined || value === null || value === "") return;
      rows.push({ label, value: String(value) });
    };

    push("Type", vehicle.vehicle_type);
    push("Colour", vehicle.color);
    // A zero-seat vehicle is not a real value, so treat it as absent.
    push(
      "Capacity",
      vehicle.capacity ? vehicle.capacity + " seats" : undefined,
    );
    push("Year", vehicle.y_manufacturing);
    push("VIN", vehicle.vin);

    return rows;
  }, [vehicle]);

  // Absent means "this is the vehicle they drive" — only an explicit false
  // demotes the badge, so a response without the field keeps today's wording.
  const inUse = vehicle.in_use !== false;

  return (
    <ScrollView
      style={[s.flex1]}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[s.px16, { paddingVertical: 16, gap: 16 }]}
    >
      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <RnView
        style={[
          s.p16,
          s.borderRadius_md,
          s.flexDirectionRow,
          s.justifyBetween,
          { backgroundColor: themes.bg_900, overflow: "hidden" },
        ]}
      >
        <RnView style={[s.flexCol, s.gap6, s.flex1]}>
          <RnText
            style={[atoms.text_lg, { fontFamily: fonts.heavy.fontFamily }]}
          >
            {vehicle.y_manufacturing} {vehicle.make} {vehicle.model}
          </RnText>
          <RnText style={[atoms.text_md, { color: colors.lightGray }]}>
            {vehicle.plate_number}
          </RnText>
          <RnView
            style={[
              s.px10,
              s.py4,
              s.mt8,
              s.borderRadius_full,
              s.alignSelf,
              s.flexDirectionRow,
              s.alignCenter,
              s.gap6,
              { backgroundColor: inUse ? themes.green_600 : themes.bg_700 },
            ]}
          >
            <Icon
              name={inUse ? "CircleCheck" : "CircleSlash"}
              size={14}
              strokeWidth={2}
              color={inUse ? colors.text : colors.lightGray}
            />
            <RnText
              style={[
                atoms.text_2xs,
                {
                  fontFamily: fonts.bold.fontFamily,
                  color: inUse ? colors.text : colors.lightGray,
                },
              ]}
            >
              {inUse ? "In Use" : "Not in use"}
            </RnText>
          </RnView>
        </RnView>
        <Image
          source={getVehicleHeroImage(category)}
          style={{ width: 140, height: 92, marginRight: -18 }}
          contentFit="contain"
          accessible
          accessibilityIgnoresInvertColors
          accessibilityLabel={vehicle.make + " " + vehicle.model}
        />
      </RnView>

      {/* ── Specifications ───────────────────────────────────────────── */}
      {specs.length > 0 && (
        <RnView style={[s.gap12]}>
          <RnText
            style={[
              atoms.text_xs,
              { color: colors.lightGray, letterSpacing: 0.8 },
            ]}
          >
            SPECIFICATIONS
          </RnText>
          <RnView
            style={[
              s.borderRadius_md,
              s.px16,
              { backgroundColor: themes.bg_900 },
            ]}
          >
            {specs.map((spec, index) => (
              <RnView
                key={spec.label}
                style={[
                  s.py14,
                  s.flexDirectionRow,
                  s.justifyBetween,
                  s.alignCenter,
                  s.gap16,
                  index < specs.length - 1 && {
                    borderBottomWidth: 1,
                    borderBottomColor: themes.bg_800,
                  },
                ]}
              >
                <RnText style={[atoms.text_sm, { color: colors.lightGray }]}>
                  {spec.label}
                </RnText>
                <RnText
                  style={[
                    atoms.text_sm,
                    s.flex1,
                    s.textRight,
                    { fontFamily: fonts.bold.fontFamily },
                  ]}
                >
                  {spec.value}
                </RnText>
              </RnView>
            ))}
          </RnView>
        </RnView>
      )}

      {/* ── Categories ───────────────────────────────────────────────── */}
      {vehicle.categories?.length > 0 && (
        <RnView style={[s.gap12]}>
          <RnText
            style={[
              atoms.text_xs,
              { color: colors.lightGray, letterSpacing: 0.8 },
            ]}
          >
            CATEGORIES
          </RnText>
          <RnView style={[s.flexDirectionRow, { flexWrap: "wrap", gap: 8 }]}>
            {vehicle.categories.map((category) => (
              <RnView
                key={category}
                style={[
                  s.px12,
                  s.py6,
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
                  {category}
                </RnText>
              </RnView>
            ))}
          </RnView>
          <RnText style={[atoms.text_2xs, { color: colors.lightGray }]}>
            These are the ride types you can be matched with. Choose which ones
            are active on the previous screen.
          </RnText>
        </RnView>
      )}

      {/* ── Correction request ───────────────────────────────────────── */}
      <RnView style={[s.gap12, s.mt8]}>
        <RnText style={[atoms.text_sm, { color: colors.lightGray }]}>
          Something look wrong?
        </RnText>
        <PressableWithFeedBack
          accessibilityRole="button"
          accessibilityLabel="Request a correction to your vehicle details"
          onPress={() =>
            openWhatsApp(
              SUPPORT_PHONE,
              "Hi👋, my vehicle details need a correction. Vehicle: " +
                vehicle.y_manufacturing +
                " " +
                vehicle.make +
                " " +
                vehicle.model +
                ", plate " +
                vehicle.plate_number +
                ".",
            )
          }
          style={[
            s.w100pct,
            s.px16,
            s.py14,
            s.borderRadius_md,
            s.flexDirectionRow,
            s.alignCenter,
            s.justifyBetween,
            { backgroundColor: colors.lightBackground },
          ]}
        >
          <RnView style={[s.flexDirectionRow, s.alignCenter, s.gap12]}>
            <Icon name="Headset" size={20} color={colors.primary} />
            <RnText
              style={[
                atoms.text_sm,
                { fontFamily: fonts.bold.fontFamily, color: colors.primary },
              ]}
            >
              Request a correction
            </RnText>
          </RnView>
          <Icon
            name="ChevronRight"
            size={20}
            strokeWidth={2}
            color={colors.primary}
          />
        </PressableWithFeedBack>
        <RnText style={[atoms.text_2xs, { color: colors.lightGray }]}>
          Vehicle details are verified by our team, so they can only be changed
          by support.
        </RnText>
      </RnView>
      <RnView style={{ paddingBottom: 100 }} />
    </ScrollView>
  );
});
