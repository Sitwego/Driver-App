import { Picker } from "@react-native-picker/picker";
import { PressableScale as Pressable } from "pressto";
import { useCallback, useRef } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import RnText from "~/components/RnText";
import RnTextInput from "~/components/RnTextInput";
import { RnView } from "~/components/RnView";
import { CONSTANTS } from "~/constants/CONSTANTS";
import { VehicleFormData } from "~/hooks/useOnboardingApi";
import { s } from "~/styles/Common-Styles";
import { OnboardingControls } from "~/ui/onboarding/OnBoardingControls";
import { useAppTheme } from "~/ui/theme/ThemeProvider";
import { atoms } from "~/ui/theme/atoms";

import { useOnboardingControls } from "../state";

/**
 * Kenyan number plate rules, keyed by the vehicle-type value selected in the
 * picker. Patterns live in {@link CONSTANTS.REGEX}; the example doubles as the
 * input placeholder and the format shown in the error message.
 */
const PLATE_RULES: Record<string, { pattern: RegExp; example: string }> = {
  Taxi: { pattern: CONSTANTS.REGEX.KENYAN_PLATE_CAR, example: "KDY 564B" },
  Bike: { pattern: CONSTANTS.REGEX.KENYAN_PLATE_BIKE, example: "KMAA 123A" },
  Auto: { pattern: CONSTANTS.REGEX.KENYAN_PLATE_TUKTUK, example: "KTWA 001A" },
};

/**
 * Validates a Kenyan number plate against the rule for the selected vehicle
 * type. Returns `true` when valid, otherwise an error message.
 */
function validatePlate(plate: string, vehicleType: string): true | string {
  const rule = PLATE_RULES[vehicleType];
  if (!rule) return "Select a vehicle type first";
  const normalized = plate.trim().toUpperCase();
  return (
    rule.pattern.test(normalized) ||
    `Invalid plate — use the ${rule.example} format`
  );
}

const MANUFACTURE_YEARS = Array.from(
  { length: new Date().getFullYear() - 2013 + 1 },
  (_, i) => 2013 + i,
);

export function VehicleDetails() {
  const insets = useSafeAreaInsets();
  const { dispatch } = useOnboardingControls();

  const pickerRef = useRef(null);
  const { colors, fonts } = useAppTheme();
  const {
    control,
    handleSubmit,
    trigger,
    getValues,
    formState: { errors },
  } = useForm<VehicleFormData>();

  const selectedVehicleType = useWatch({ control, name: "vehicle_type" });

  const _onSubmit = useCallback(
    (values: VehicleFormData) => {
      dispatch({
        type: "setVehicleDetails",
        vehicleDetails: { ...values },
        apiResponse: false,
      });
      dispatch({ type: "next" });
    },
    [dispatch],
  );

  return (
    <RnView style={[s.align_start, s.justifyBetween]}>
      <RnView
        style={[
          s.w100pct,
          atoms.gap_sm,
          s.flexCol,
          { flexWrap: "wrap", marginTop: insets.top },
        ]}
      >
        <RnText style={[atoms.text_xl]}>Account Setup</RnText>
        <RnText
          style={[{ lineHeight: 20, fontSize: 14, color: colors.lightGray }]}
        >
          Provide Vehicle Details
        </RnText>
      </RnView>
      <RnView style={{ marginVertical: 10 }} />
      <KeyboardAvoidingView style={[s.w100pct, s.flex1]} behavior="padding">
        <RnView style={[s.w100pct, s.flex1, s.flexCol, s.gap16]}>
          {/* Vehicle type */}
          <RnView style={[s.gap8]}>
            <RnText>
              Vehicle type{" "}
              <RnText style={{ color: colors.notification, fontSize: 18 }}>
                *
              </RnText>
            </RnText>
            <RnView
              style={[
                {
                  borderWidth: 1,
                  borderColor: errors.vehicle_type
                    ? colors.danger
                    : colors.lightBackground,
                  borderRadius: 8,
                },
                s.py4,
                s.px4,
              ]}
            >
              <Controller
                name="vehicle_type"
                rules={{ required: "Please select a vehicle type" }}
                control={control}
                render={({ field: { onChange, value } }) => (
                  <Picker
                    ref={pickerRef}
                    mode="dropdown"
                    selectedValue={value ?? ""}
                    onValueChange={(itemValue) => {
                      if (itemValue) {
                        onChange(itemValue);
                        // Re-validate the plate against the new vehicle type if
                        // the user already entered one.
                        if (getValues("license_plate")) {
                          trigger("license_plate");
                        }
                      }
                    }}
                  >
                    <Picker.Item
                      style={{
                        fontSize: 20,
                        fontFamily: fonts.regular.fontFamily,
                        color: colors.lightGray,
                      }}
                      label="Choose your vehicle"
                      value=""
                      enabled={false}
                    />
                    <Picker.Item
                      style={{
                        fontSize: 20,
                        fontFamily: fonts.medium.fontFamily,
                      }}
                      label="Boda"
                      value="Bike"
                    />
                    <Picker.Item
                      style={{
                        fontSize: 20,
                        fontFamily: fonts.medium.fontFamily,
                      }}
                      label="Car"
                      value="Taxi"
                    />
                    <Picker.Item
                      style={{
                        fontSize: 20,
                        fontFamily: fonts.medium.fontFamily,
                      }}
                      label="Tuk Tuk"
                      value="Auto"
                    />
                  </Picker>
                )}
              />
            </RnView>
            {errors.vehicle_type && (
              <RnText style={[atoms.text_xs, { color: colors.danger }]}>
                {errors.vehicle_type.message}
              </RnText>
            )}
          </RnView>

          {/* Year of manufacture */}
          <RnView style={[s.gap8]}>
            <RnText>
              Year of manufacture{" "}
              <RnText style={{ color: colors.notification, fontSize: 18 }}>
                *
              </RnText>
            </RnText>
            <RnView
              style={[
                {
                  borderWidth: 1,
                  borderColor: errors.year
                    ? colors.danger
                    : colors.lightBackground,
                  borderRadius: 8,
                },
                s.py4,
                s.px4,
              ]}
            >
              <Controller
                name="year"
                rules={{ required: "Please select a year" }}
                control={control}
                render={({ field: { onChange, value } }) => (
                  <Picker
                    selectedValue={value ?? ""}
                    mode="dropdown"
                    onValueChange={(itemValue) => {
                      if (itemValue) onChange(itemValue);
                    }}
                  >
                    <Picker.Item
                      style={{ fontSize: 16, color: colors.lightGray }}
                      label="Select year..."
                      value=""
                      enabled={false}
                    />
                    {MANUFACTURE_YEARS.map((year) => (
                      <Picker.Item
                        key={year}
                        style={{
                          fontSize: 20,
                          fontFamily: fonts.medium.fontFamily,
                        }}
                        label={year.toString()}
                        value={year.toString()}
                      />
                    ))}
                  </Picker>
                )}
              />
            </RnView>
            {errors.year && (
              <RnText style={[atoms.text_xs, { color: colors.danger }]}>
                {errors.year.message}
              </RnText>
            )}
          </RnView>

          {/* Make */}
          <RnView style={[s.gap8]}>
            <RnText>
              Vehicle make / brand{" "}
              <RnText style={{ color: colors.notification, fontSize: 18 }}>
                *
              </RnText>
            </RnText>
            <Controller
              name="make"
              rules={{
                required: "Vehicle make is required",
                minLength: {
                  value: 2,
                  message: "At least 2 characters required",
                },
              }}
              control={control}
              render={({ field: { onBlur, onChange, value } }) => (
                <RnTextInput
                  style={[
                    s.input,
                    s.f16,
                    s.w100pct,
                    {
                      fontFamily: fonts.regular.fontFamily,
                      color: colors.text,
                      borderColor: errors.make
                        ? colors.danger
                        : colors.lightBackground,
                    },
                  ]}
                  autoCorrect={false}
                  cursorColor={colors.lightBackground}
                  autoCapitalize="words"
                  maxLength={15}
                  inputMode="text"
                  onChangeText={onChange}
                  onBlur={onBlur}
                  placeholder="Toyota"
                  placeholderTextColor={colors.lightGray}
                  value={value}
                />
              )}
            />
            {errors.make && (
              <RnText style={[atoms.text_xs, { color: colors.danger }]}>
                {errors.make.message}
              </RnText>
            )}
          </RnView>

          {/* Model */}
          <RnView style={[s.gap8]}>
            <RnText>
              Vehicle model{" "}
              <RnText style={{ color: colors.notification, fontSize: 18 }}>
                *
              </RnText>
            </RnText>
            <Controller
              name="model"
              rules={{
                required: "Vehicle model is required",
                minLength: {
                  value: 2,
                  message: "At least 2 characters required",
                },
              }}
              control={control}
              render={({ field: { onBlur, onChange, value } }) => (
                <RnTextInput
                  style={[
                    s.input,
                    s.f16,
                    s.w100pct,
                    {
                      fontFamily: fonts.regular.fontFamily,
                      color: colors.text,
                      borderColor: errors.model
                        ? colors.danger
                        : colors.lightBackground,
                    },
                  ]}
                  autoCorrect={false}
                  cursorColor={colors.lightBackground}
                  autoCapitalize="words"
                  maxLength={15}
                  inputMode="text"
                  onChangeText={onChange}
                  onBlur={onBlur}
                  placeholder="Camry"
                  placeholderTextColor={colors.lightGray}
                  value={value}
                />
              )}
            />
            {errors.model && (
              <RnText style={[atoms.text_xs, { color: colors.danger }]}>
                {errors.model.message}
              </RnText>
            )}
          </RnView>

          {/* License plate */}
          <RnView style={[s.gap8]}>
            <RnText>
              License plate number{" "}
              <RnText style={{ color: colors.notification, fontSize: 18 }}>
                *
              </RnText>
            </RnText>
            <Controller
              name="license_plate"
              rules={{
                required: "License plate is required",
                validate: (v, formValues) =>
                  validatePlate(v, formValues.vehicle_type),
              }}
              control={control}
              render={({ field: { onBlur, onChange, value } }) => (
                <RnTextInput
                  style={[
                    s.input,
                    s.f16,
                    s.w100pct,
                    {
                      fontFamily: fonts.regular.fontFamily,
                      color: colors.text,
                      borderColor: errors.license_plate
                        ? colors.danger
                        : colors.lightBackground,
                    },
                  ]}
                  autoCorrect={false}
                  cursorColor={colors.lightBackground}
                  autoCapitalize="characters"
                  inputMode="text"
                  maxLength={10}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  placeholder={
                    PLATE_RULES[selectedVehicleType]?.example ?? "KDY 564B"
                  }
                  placeholderTextColor={colors.lightGray}
                  value={value}
                />
              )}
            />
            {errors.license_plate && (
              <RnText style={[atoms.text_xs, { color: colors.danger }]}>
                {errors.license_plate.message}
              </RnText>
            )}
          </RnView>

          {/* Capacity */}
          <RnView style={[s.gap8]}>
            <RnText>
              Passenger capacity{" "}
              <RnText style={{ color: colors.notification, fontSize: 18 }}>
                *
              </RnText>
            </RnText>
            <Controller
              name="capacity"
              rules={{
                required: "Capacity is required",
                validate: (v) => {
                  const n = Number(v);
                  if (!v || isNaN(n)) return "Must be a number";
                  if (n < 1) return "Must be at least 1";
                  if (n > 9) return "Maximum capacity is 9";
                  return true;
                },
              }}
              control={control}
              render={({ field: { onBlur, onChange, value } }) => (
                <RnTextInput
                  style={[
                    s.input,
                    s.f16,
                    s.w100pct,
                    {
                      fontFamily: fonts.regular.fontFamily,
                      color: colors.text,
                      borderColor: errors.capacity
                        ? colors.danger
                        : colors.lightBackground,
                    },
                  ]}
                  autoCorrect={false}
                  cursorColor={colors.lightBackground}
                  inputMode="numeric"
                  maxLength={1}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  placeholder="4"
                  placeholderTextColor={colors.lightGray}
                  value={value ? value.toString() : ""}
                />
              )}
            />
            {errors.capacity && (
              <RnText style={[atoms.text_xs, { color: colors.danger }]}>
                {errors.capacity.message}
              </RnText>
            )}
          </RnView>

          {/* Color */}
          <RnView style={[s.gap8]}>
            <RnText>
              Vehicle color{" "}
              <RnText style={{ color: colors.notification, fontSize: 18 }}>
                *
              </RnText>
            </RnText>
            <Controller
              name="color"
              rules={{
                required: "Vehicle color is required",
                minLength: {
                  value: 2,
                  message: "At least 2 characters required",
                },
              }}
              control={control}
              render={({ field: { onBlur, onChange, value } }) => (
                <RnTextInput
                  style={[
                    s.input,
                    s.f16,
                    s.w100pct,
                    {
                      fontFamily: fonts.regular.fontFamily,
                      color: colors.text,
                      borderColor: errors.color
                        ? colors.danger
                        : colors.lightBackground,
                    },
                  ]}
                  autoCorrect={false}
                  cursorColor={colors.lightBackground}
                  autoCapitalize="words"
                  maxLength={15}
                  inputMode="text"
                  onChangeText={onChange}
                  onBlur={onBlur}
                  placeholder="White"
                  placeholderTextColor={colors.lightGray}
                  value={value}
                />
              )}
            />
            {errors.color && (
              <RnText style={[atoms.text_xs, { color: colors.danger }]}>
                {errors.color.message}
              </RnText>
            )}
          </RnView>
        </RnView>
      </KeyboardAvoidingView>
      <OnboardingControls.Portal>
        <RnView
          style={[
            { marginBottom: insets.bottom },
            s.justifyCenter,
            s.alignCenter,
            s.py8,
          ]}
        >
          <Pressable
            onPress={() => handleSubmit(_onSubmit)()}
            style={[
              s.p16,
              {
                width: "80%",
                backgroundColor: colors.primary,
                borderRadius: 8,
              },
            ]}
          >
            <RnText style={[atoms.text_lg, s.textCenter]}>Continue</RnText>
          </Pressable>
        </RnView>
      </OnboardingControls.Portal>
    </RnView>
  );
}
