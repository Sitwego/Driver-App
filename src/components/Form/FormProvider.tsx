import { useFocusEffect } from "@react-navigation/native";
import type {
  ForwardedRef,
  MutableRefObject,
  ReactNode,
  RefAttributes,
  RefObject,
} from "react";
import React, {
  createContext,
  createRef,
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { InteractionManager } from "react-native";
import type {
  NativeSyntheticEvent,
  StyleProp,
  TextInputSubmitEditingEventData,
  ViewStyle,
} from "react-native";
import FormContext, { RegisterInput } from "./FormContext";
import { InputComponentBaseProps, InputRefs } from "./types";
import type Form from "~/types/FormTypes";
import useDebounceNonReactive from "~/hooks/useDebounceNonReactive";
import { isEmptyObject, prepareValues } from "~/lib/validationUtils";
import keyboardUtils from "~/utils/keyboard";

type FormProviderProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Should validate function be called when input loose focus */
  shouldValidateOnBlur?: boolean;

  /** Should validate function be called when the value of the input is changed */
  shouldValidateOnChange?: boolean;
  /** Whether the form is loading */
  isLoading?: boolean;
  /** Whether to remove invisible characters from strings before validation and submission */
  shouldTrimValues?: boolean;
  onSubmit?: (event: any) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  onChange?: () => void;
  onReset?: () => void;
  onChangeText?: (text: string) => void;
};
const FormProvider = forwardRef<any, FormProviderProps>(
  ({ children, ...rest }, ref) => {
    const {
      shouldValidateOnBlur,
      shouldValidateOnChange,
      isLoading,
      shouldTrimValues,
      onSubmit,
    } = rest;
    const inputRefs = useRef<InputRefs>({});
    //TODO:: we will need to initialize this with actual values from mmkv
    const [inputValues, setInputValues] = useState<Form>(() => ({}));
    //TODO:: create type for fieldErrorMessage
    const [errors, setErrors] = useState<any>({});
    const touchedInputs = useRef<Record<string, boolean>>({});
    /** @param inputID - The inputID of the input being touched */
    const setTouchedInput = useCallback(
      (inputID: keyof Form) => {
        touchedInputs.current[inputID] = true;
      },
      [touchedInputs],
    );
    const onValidate = useCallback((values: any) => {}, []);

    useImperativeHandle(ref, () => ({
      // resetForm,
      // resetErrors,
      // resetFormFieldError,
      submit,
    }));

    const submit = useDebounceNonReactive(
      useCallback(() => {
        // Return early if the form is already submitting to avoid duplicate submission
        if (isLoading) {
          return;
        }

        // Prepare values before submitting
        const trimmedStringValues = shouldTrimValues
          ? prepareValues(inputValues)
          : inputValues;

        // Touches all form inputs, so we can validate the entire form
        Object.keys(inputRefs.current).forEach(
          (inputID) => (touchedInputs.current[inputID] = true),
        );

        // Validate form and return early if any errors are found
        if (!isEmptyObject(onValidate(trimmedStringValues))) {
          return;
        }

        // Do not submit form if network is offline and the form is not enabled when offline
        // if (network?.isOffline && !enabledWhenOffline) {
        //   return;
        // }

        keyboardUtils.dismiss().then(() => onSubmit?.(trimmedStringValues));
      }, [inputValues, isLoading, onSubmit, onValidate, shouldTrimValues]),
      1000,
      { leading: true, trailing: false },
    );

    // Keep track of the focus state of the current screen.
    // This is used to prevent validating the form on blur before it has been interacted with.
    const isFocusedRef = useRef(true);

    useFocusEffect(
      useCallback(() => {
        isFocusedRef.current = true;
        return () => {
          isFocusedRef.current = false;
        };
      }, []),
    );

    const _registerInput = useCallback<RegisterInput>(
      (inputID, shouldSubmitForm, inputProps) => {
        const newRef: RefObject<InputComponentBaseProps> =
          inputRefs.current[inputID] ?? inputProps.ref ?? createRef();
        if (inputRefs.current[inputID] !== newRef) {
          inputRefs.current[inputID] = newRef;
        }
        const inputRef = inputProps.ref;
        // const errorFields = formState?.errorFields?.[inputID] ?? {};
        // const fieldErrorMessage =
        //   Object.keys(errorFields)
        //     .sort()
        //     .map((key) => errorFields[key])
        //     .at(-1) ?? "";
        return {
          ...inputProps,
          ...(shouldSubmitForm && {
            onSubmitEditing: (
              event: NativeSyntheticEvent<TextInputSubmitEditingEventData>,
            ) => {
              // submit();

              inputProps.onSubmitEditing?.(event);
            },
            returnKeyType: "go",
          }),
          ref:
            typeof inputRef === "function"
              ? (instance: InputComponentBaseProps) => {
                  newRef.current = instance;
                  inputRef(instance);
                }
              : (newRef as MutableRefObject<InputComponentBaseProps>),
          inputID: inputID,
          key: inputProps.key ?? inputID,
          errorText: errors[inputID] ?? "", //TODO::
          value: inputValues[inputID],
          // As the text input is controlled, we never set the defaultValue prop
          // as this is already happening by the value prop.
          // If it's uncontrolled, then we set the `defaultValue` prop to actual value
          defaultValue: inputProps.uncontrolled
            ? inputProps.defaultValue
            : undefined,
          onTouched: (event) => {
            if (!inputProps.shouldSetTouchedOnBlurOnly) {
              setTimeout(() => {
                setTouchedInput(inputID);
              }, 200);
            }
            inputProps.onTouched?.(event);
          },
          onPress: (event) => {
            if (!inputProps.shouldSetTouchedOnBlurOnly) {
              setTimeout(() => {
                setTouchedInput(inputID);
              }, 200);
            }
            inputProps.onPress?.(event);
          },
          onPressOut: (event) => {
            // To prevent validating just pressed inputs, we need to set the touched input right after
            // onValidate and to do so, we need to delay setTouchedInput of the same amount of time
            // as the onValidate is delayed
            if (!inputProps.shouldSetTouchedOnBlurOnly) {
              setTimeout(() => {
                setTouchedInput(inputID);
              }, 200);
            }
            inputProps.onPressOut?.(event);
          },
          onBlur: (event) => {
            inputProps.onBlur?.(event);
          },
          onInputChange: (value, key) => {
            const inputKey = key ?? inputID;
            setInputValues((prevState) => {
              const newState = {
                ...prevState,
                [inputKey]: value,
              };

              if (shouldValidateOnChange) {
                onValidate(newState);
              }
              return newState as Form;
            });

            // if (inputProps.shouldSaveDraft && !formID.includes("Draft")) {
            //   setDraftValues(formID, { [inputKey]: value });
            // }
            inputProps.onValueChange?.(value, inputKey);
          },
        };
      },
      [
        errors,
        inputValues,
        onValidate,
        setTouchedInput,
        shouldValidateOnChange,
      ],
    );
    const value = useMemo(
      () => ({ registerInput: _registerInput }),
      [_registerInput],
    );
    return (
      <FormContext.Provider value={value}>
        <React.Fragment>{children}</React.Fragment>
      </FormContext.Provider>
    );
  },
);

FormProvider.displayName = "FormProvider";
