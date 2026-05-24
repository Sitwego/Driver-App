import { TrueSheet } from "@lodev09/react-native-true-sheet";
import {
  forwardRef,
  useImperativeHandle,
  useRef,
  type Ref,
  useCallback,
  useState,
  useEffect,
} from "react";
import { Keyboard } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAppTheme } from "~/ui/theme/ThemeProvider";
import { atoms } from "~/ui/theme/atoms";

import OtpInput, { OtpInputMethods } from "../OtpInput";
import RnText from "../RnText";
import { RnView } from "../RnView";

type Props = {
  confirmOtpCodes: (otp: string) => Promise<void>;
};
export const OtpBottomSheet = forwardRef(
  ({ confirmOtpCodes }: Props, ref: Ref<TrueSheet>) => {
    const { colors } = useAppTheme();
    const sheetRef = useRef<TrueSheet>(null);
    const inset = useSafeAreaInsets();
    const [validCode, setValidateCode] = useState("");
    const inputValidateCodeRef = useRef<OtpInputMethods>(null);
    const [isSheetVisible, setIsSheetVisible] = useState(false);

    useEffect(() => {
      if (!inputValidateCodeRef.current) {
        return;
      }
      inputValidateCodeRef.current.focus();
    }, []);

    useEffect(() => {
      if (!inputValidateCodeRef.current || validCode.length > 0) {
        return;
      }
      inputValidateCodeRef.current.clear();
    }, [validCode]);

    useEffect(() => {
      let showSub = Keyboard.addListener("keyboardDidShow", () => {
        if (isSheetVisible && sheetRef.current) {
          sheetRef.current.resize(1);
        }
      });
      let hidSub = Keyboard.addListener("keyboardDidHide", () => {
        if (isSheetVisible && sheetRef.current) {
          sheetRef.current.resize(0);
        }
      });

      return () => {
        showSub.remove();
        hidSub.remove();
      };
    }, [isSheetVisible]);

    const onPresent = useCallback((e: any) => {
      console.log("OTP Sheet moadl presented!");
      setIsSheetVisible(true);
    }, []);

    useImperativeHandle<TrueSheet | null, TrueSheet | null>(
      ref,
      () => sheetRef.current,
    );

    const _hideOtpSheet = useCallback(async () => {
      await sheetRef.current?.dismiss();
    }, []);

    const onDismiss = useCallback(() => {
      console.log("OTP Sheet dismissed!");
      setIsSheetVisible(false);
      inputValidateCodeRef.current?.clear();
    }, []);

    const onFufill = useCallback(
      async (otp: string) => {
        await confirmOtpCodes(otp);
        await _hideOtpSheet();
      },
      [_hideOtpSheet, confirmOtpCodes],
    );

    /**
     * Handle text input and clear formError upon text change
     */
    const onTextInput = useCallback((text: string) => {
      setValidateCode(text);
    }, []);

    return (
      <TrueSheet
        ref={sheetRef}
        name="OTP_SHEET"
        detents={[0.56, 1]}
        style={{ top: inset.top }}
        dimmed
        dismissible={true}
        backgroundColor={colors.background}
        onDidDismiss={onDismiss}
        onDidPresent={onPresent}
      >
        <RnView style={{ flexGrow: 1, paddingVertical: 16 }}>
          <RnText style={[atoms.text_md, { paddingBottom: 5 }]}>
            Enter Start OTP
          </RnText>
          <OtpInput
            ref={(ref) => {
              if (!ref) return;
              inputValidateCodeRef.current = ref;
            }}
            name="validateCode"
            value={validCode}
            onChangeText={onTextInput}
            // errorText={errorText}
            // hasError={canShowError && !isEmptyObject(finalValidateError)}
            autoFocus={false}
            allowResubmit={false}
            onFulfill={onFufill}
          />
          <RnView
            style={[
              { alignSelf: "center", alignItems: "center", marginTop: 40 },
            ]}
          >
            <RnText style={[atoms.text_sm, {}]}>
              Ask your customer for the start OTP
            </RnText>
          </RnView>
        </RnView>
      </TrueSheet>
    );
  },
);

OtpBottomSheet.displayName = "OtpBottomSheet";
