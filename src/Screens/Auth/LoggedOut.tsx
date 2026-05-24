import {
  getAuth,
  onAuthStateChanged,
  signInWithPhoneNumber,
} from "@react-native-firebase/auth";
import { PressableScale as Pressable } from "pressto";
import React, {
  ForwardedRef,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { BackHandler, Image } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import RnText from "~/components/RnText";
import { RnView } from "~/components/RnView";
import { s } from "~/styles/Common-Styles";
import { useAppTheme } from "~/ui/theme/ThemeProvider";
import { atoms } from "~/ui/theme/atoms";

import { AuthScreenState } from "./AuthScreenType";
import { CreateAccountScreen } from "./CreateAccount";
import { LogInScreen } from "./Loggin";
import { OTPConfirmationRef, OtpSheet } from "./OtpSheet";
import { PhoneModal } from "./PhoneModal";

export const AuthAccessScreens = () => {
  const insets = useSafeAreaInsets();
  const { colors, fonts } = useAppTheme();
  const { show_otp_modal, hide_otp_modal } = useSheetOtp();
  const { setAuthState, authState } = useAuthState();
  const [isOpen, setIsOpen] = useState<boolean>(false);

  const _setAuthScreenState = useCallback(
    (screen?: AuthScreenState) => {
      setAuthState((prev) => ({}));
      setIsOpen(false);
    },
    [setAuthState],
  );

  const sendOTP = useCallback(
    async (phoneNumber: string) => {
      const resp = await signInWithPhoneNumber(getAuth(), phoneNumber);
      show_otp_modal(resp);
    },
    [show_otp_modal],
  );

  /**
   * Handle firebase auth state changes using useEffect hook
   */
  useEffect(() => {
    const sub = onAuthStateChanged(getAuth(), (user) => {
      if (user) {
        console.log("User is logged in:", user.phoneNumber);
      } else {
        console.log("No user is logged in.");
      }
    });

    return sub; // unsubscribe on unmount
  }, []);

  const _closePhoneModal = useCallback(() => {
    setIsOpen(false);
    return;
  }, []);

  const createAccount = useCallback(() => {
    setAuthState((prev) => ({
      ...prev,
      stateType: AuthScreenState.Auth_S_CreateAccountScreen,
    }));
    setIsOpen(true);
  }, [setAuthState]);

  const loginDriver = useCallback(() => {
    setAuthState((prev) => ({
      ...prev,
      stateType: AuthScreenState.Auth_S_LoginScreen,
    }));
    setIsOpen(true);
  }, [setAuthState]);

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      hide_otp_modal();
      _setAuthScreenState(undefined);
      return true;
    });
    return () => sub.remove();
  }, [_setAuthScreenState, hide_otp_modal]);

  console.log(
    "Auth Screen State:",
    authState.stateType,
    authState.phone_number,
  );

  if (
    authState.stateType === AuthScreenState.Auth_S_CreateAccountScreen &&
    authState.phone_number
  ) {
    return (
      <CreateAccountScreen
        phone_number={authState.phone_number}
        setScreen={_setAuthScreenState}
      />
    );
  }
  if (
    authState.stateType === AuthScreenState.Auth_S_LoginScreen &&
    authState.phone_number
  ) {
    return <LogInScreen setScreen={_setAuthScreenState} />;
  }
  // if (authScreenState === AuthScreenState.Auth_S_ForgotPasswordScreen) {
  //   return <ForgotPasswordScreen setScreen={_setAuthScreenState} />;
  // }

  return (
    <>
      <RnView
        style={{
          flex: 1,
          paddingTop: insets.top,
          paddingBottom: insets.bottom + 16,
        }}
      >
        {/* Branding */}
        <RnView style={[s.flex1, s.alignCenter, s.justifyCenter, s.px16]}>
          <RnText
            style={[
              atoms.text_2xl,
              {
                fontFamily: fonts.heavy.fontFamily,
                textAlign: "center",
                marginBottom: 8,
              },
            ]}
          >
            Sitwego Driver App
          </RnText>
          <RnText
            style={[atoms.text_sm, { textAlign: "center", opacity: 0.55 }]}
          >
            Drive Smarter. Earn More.
          </RnText>
        </RnView>

        {/* Actions */}
        <RnView style={[s.px16, { gap: 12 }]}>
          <Pressable
            onPress={createAccount}
            style={[
              s.p16,
              s.alignCenter,
              s.justifyCenter,
              { backgroundColor: colors.primary, borderRadius: 12 },
            ]}
          >
            <RnText
              style={{
                color: colors.text,
                fontFamily: fonts.medium.fontFamily,
              }}
            >
              Create Account
            </RnText>
          </Pressable>
          <Pressable
            onPress={loginDriver}
            style={[
              s.p16,
              s.alignCenter,
              s.justifyCenter,
              { backgroundColor: colors.lightBackground, borderRadius: 12 },
            ]}
          >
            <RnText style={{ color: colors.text }}>Log In</RnText>
          </Pressable>
        </RnView>
      </RnView>
      {isOpen && (
        <PhoneModal
          isOpen={isOpen}
          setPhoneNumber={sendOTP}
          close={_closePhoneModal}
        />
      )}
    </>
  );
};
// -------------------------------------------- AUth Provider Component -----------------------------------------
type AuthProviderProps = React.PropsWithChildren<{
  onAuthSuccess: (token: string) => void;
}>;

type AuthState = {
  phone_number?: string;
  isVerified_phone_number?: boolean;
  stateType?: AuthScreenState;
};

export const Context = React.createContext<OTPConfirmationRef>({
  show_otp_modal: function (props: any): void {},
  hide_otp_modal: function (): void {},
  // verify_otp_code: async function (code: string): Promise<void> {},
});

const AuthStateContext = React.createContext<{
  authState: AuthState;
  setAuthState: React.Dispatch<React.SetStateAction<AuthState>>;
}>({
  authState: {},
  setAuthState: () => {},
});

const { Provider } = Context;
export const useSheetOtp = () => useContext(Context);
export const useAuthState = () => useContext(AuthStateContext);

export function AuthProvider({ children, onAuthSuccess }: AuthProviderProps) {
  const ref: ForwardedRef<OTPConfirmationRef> = useRef(null);
  const [state, setAuthState] = useState<AuthState>({});
  const getContext = useMemo(
    () => ({
      show_otp_modal: (props: any) => {
        ref.current?.show_otp_modal(props);
      },
      hide_otp_modal: () => {
        ref.current?.hide_otp_modal();
      },
    }),
    [],
  );
  return (
    <Provider value={getContext}>
      <AuthStateContext.Provider value={{ authState: state, setAuthState }}>
        <OtpSheet ref={ref}>{children}</OtpSheet>
      </AuthStateContext.Provider>
    </Provider>
  );
}

export const LoggedOut = () => {
  return (
    <AuthProvider
      onAuthSuccess={function (token: string): void {
        throw new Error("Function not implemented.");
      }}
    >
      <AuthAccessScreens />
    </AuthProvider>
  );
};
