import {
  TextInputFocusEventData,
  TextInputSubmitEditingEventData,
} from "react-native";
import {
  GestureResponderEvent,
  NativeSyntheticEvent,
} from "react-native/Libraries/Types/CoreEventTypes";
import { CONSTANTS } from "~/constants/CONSTANTS";
import { FileObject } from "~/types/fileModal";
import type { ValueOf } from "type-fest";
import { Key, Ref, RefObject } from "react";

type ValueTypeKey =
  | "string"
  | "boolean"
  | "date"
  | "country"
  | "reportFields"
  | "disabledListValues"
  | "entityChart";
type Country = keyof typeof CONSTANTS.ALL_COUNTRIES;
type ValueTypeMap = {
  string: string;
  boolean: boolean;
  date: Date;
  country: Country | "";
  reportFields: string[];
  disabledListValues: boolean[];
  entityChart: FileObject[];
};
export type FormValue = ValueOf<ValueTypeMap>;

type InputComponentValueProps<TValue extends ValueTypeKey = ValueTypeKey> = {
  valueType?: TValue;
  value?: ValueTypeMap[TValue];
  defaultValue?: ValueTypeMap[TValue];
  onValueChange?: (value: ValueTypeMap[TValue], key: string) => void;
  shouldSaveDraft?: boolean;
  shouldUseDefaultValue?: boolean;
};

type MeasureLayoutOnSuccessCallback = (
  left: number,
  top: number,
  width: number,
  height: number,
) => void;
export type InputComponentBaseProps<
  TValue extends ValueTypeKey = ValueTypeKey,
> = InputComponentValueProps<TValue> & {
  InputComponent: any;
  inputID: string;
  errorText?: string;
  shouldSetTouchedOnBlurOnly?: boolean;
  isFocused?: boolean;
  measureLayout?: (
    ref: unknown,
    callback: MeasureLayoutOnSuccessCallback,
  ) => void;
  focus?: () => void;
  label?: string;
  minDate?: Date;
  maxDate?: Date;
  onTouched?: (event: GestureResponderEvent) => void;
  onBlur?: (
    event: FocusEvent | NativeSyntheticEvent<TextInputFocusEventData>,
  ) => void;
  onPressOut?: (event: GestureResponderEvent) => void;
  onPress?: (event: GestureResponderEvent) => void;
  onInputChange?: (value: FormValue, key: string) => void;
  onSubmitEditing?: (
    event: NativeSyntheticEvent<TextInputSubmitEditingEventData>,
  ) => void;
  key?: Key;
  ref?: Ref<unknown>;
  multiline?: boolean;
  autoGrowHeight?: boolean;
  blurOnSubmit?: boolean;
  shouldSubmitForm?: boolean;
  uncontrolled?: boolean;
};
export type InputRefs = Record<string, RefObject<InputComponentBaseProps>>;
