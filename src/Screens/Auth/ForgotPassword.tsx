import React, { useCallback, useRef, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import RnText from "~/components/RnText";
import { RnView } from "~/components/RnView";
import { useAppTheme } from "~/ui/theme/ThemeProvider";
import { AuthScreenState } from "./AuthScreenType";

interface Props {
  setScreen: (prop: AuthScreenState) => void;
}
export const ForgotPasswordScreen: React.FC<Props> = () => {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  return (
    <RnView style={{ flex: 1, paddingTop: insets.top }}>
      <RnText>Forgot Password</RnText>
    </RnView>
  );
};
ForgotPasswordScreen.displayName = "ForgotPasswordScreen";
