import { useCallback, useImperativeHandle, useState } from "react";
import { Keyboard } from "react-native";
import DatePicker from "react-native-date-picker";
import { useAppTheme } from "./theme/ThemeProvider";
import { DateFieldButton } from "./DateInputField";
import { toSimpleDateString } from "~/utils/dates/simpleDateString";

export type DateFieldRef = {
  focus: () => void;
  blur: () => void;
};
export type DateFieldProps = {
  value: string | Date;
  onChangeDate: (date: string) => void;
  label: string;
  inputRef?: React.Ref<DateFieldRef>;
  isInvalid?: boolean;
  testID?: string;
  accessibilityHint?: string;
  maximumDate?: string | Date;
  minimumDate?: string | Date;
};

export function DateInputField({
  value,
  inputRef,
  onChangeDate,
  label,
  isInvalid,
  maximumDate,
  minimumDate,
}: DateFieldProps) {
  const { colors, fonts, themeMode } = useAppTheme();
  const [open, setOpen] = useState(false);

  const onConfirmDate = useCallback(
    (date: Date) => {
      setOpen(false);

      const formatted = toSimpleDateString(date);
      onChangeDate(formatted);
    },
    [onChangeDate, setOpen],
  );

  useImperativeHandle(
    inputRef,
    () => ({
      focus: () => {
        Keyboard.dismiss();
        setOpen(true);
      },
      blur: () => {
        setOpen(false);
      },
    }),
    [],
  );

  const onPress = useCallback(() => {
    setOpen(true);
  }, []);

  const onCancel = useCallback(() => {
    setOpen(false);
  }, []);

  return (
    <>
      <DateFieldButton label={label} value={value} onPress={onPress} />

      {open && (
        <DatePicker
          modal
          open
          timeZoneOffsetInMinutes={0}
          theme={themeMode as any}
          buttonColor={colors.text}
          date={value ? new Date(value) : new Date()}
          onConfirm={onConfirmDate}
          onCancel={onCancel}
          mode="date"
          locale="en"
          is24hourSource="locale"
          minimumDate={
            minimumDate ? new Date(toSimpleDateString(minimumDate)) : undefined
          }
          maximumDate={
            maximumDate ? new Date(toSimpleDateString(maximumDate)) : undefined
          }
        />
      )}
    </>
  );
}
