import { PressableScale as Pressable } from "pressto";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ScrollView } from "react-native-gesture-handler";
import { isValidNumber } from "react-native-phone-entry";
import { Keyframe } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Icon from "~/components/Icons";
import PhoneInputComponet from "~/components/PhoneInput";
import RnText from "~/components/RnText";
import { RnAnimatedView, RnView } from "~/components/RnView";
import usePolling from "~/hooks/usePoling";
import { useSendMpesaPrompt } from "~/hooks/useSubscriptionPlans";
import { useUserState } from "~/lib/state/userState";
import { PaymentScreenProps } from "~/navigation/types";
import { s } from "~/styles/Common-Styles";
import { useAppTheme } from "~/ui/theme/ThemeProvider";
import { atoms } from "~/ui/theme/atoms";
import { themes } from "~/ui/theme/theme_utils";

const LIME = "#CCFF00";

function normalizePhoneNumber(phone: string): string {
  return phone.replace(/^\+/, "");
}

const promptEntering = new Keyframe({
  from: { opacity: 0, transform: [{ translateY: 24 }] },
  to: { opacity: 1, transform: [{ translateY: 0 }] },
})
  .duration(280)
  .delay(80);

export default memo(function PaymentScreen({
  navigation,
  route,
}: PaymentScreenProps) {
  const { fonts } = useAppTheme();
  const insets = useSafeAreaInsets();
  const userState = useUserState();
  const isMounted = useRef<boolean>(false);

  const { amountDue } = route.params;

  const { mutateAsync } = useSendMpesaPrompt();
  const [isLoading, setIsLoading] = useState(false);
  const [checkout_req_id, setCheckoutId] = useState<string | undefined>();
  const [mpesaPhoneNumber, setMpesaPhoneNumber] = useState<string | undefined>(
    userState?.phone ? `+${normalizePhoneNumber(userState.phone)}` : undefined,
  );

  const onChangeMpesaPhoneNumber = useCallback((phone: string) => {
    setMpesaPhoneNumber(phone);
  }, []);

  const { data } = usePolling<{ id?: string | null }, string>({
    shouldPoll: isMounted.current && !!checkout_req_id,
    id: checkout_req_id as string,
    queryKeyPrefix: "paymentCheck",
    urlBuilder: (id) => "payment/confirm-payment/" + id,
    refetchInterval: 2000,
  });

  const _isValidPhone = useMemo(
    () => !!mpesaPhoneNumber && isValidNumber(mpesaPhoneNumber, "KE"),
    [mpesaPhoneNumber],
  );

  const onPress = useCallback(async () => {
    console.log(mpesaPhoneNumber, userState?.sub_id);
    if (!mpesaPhoneNumber || !userState?.sub_id) return;
    setIsLoading(true);
    const resp = await mutateAsync({
      phone_number: normalizePhoneNumber(mpesaPhoneNumber),
      amount: amountDue,
      sub_id: userState.sub_id,
    });
    if (resp.checkout_request_id) {
      setCheckoutId(resp.checkout_request_id);
    }
  }, [mpesaPhoneNumber, mutateAsync, userState?.sub_id, amountDue]);

  useEffect(() => {
    if (!data?.id) return;
    setIsLoading(false);
    if (navigation.canGoBack()) navigation.popToTop();
  }, [data, navigation]);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={[
        s.flexCol,
        s.gap20,
        s.px10,
        { paddingTop: insets.top + 28, paddingBottom: insets.bottom + 32 },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      {/* Amount hero card */}
      <RnView
        style={[
          s.flexCol,
          s.alignCenter,
          s.justifyCenter,
          s.borderRadius_sm,
          {
            backgroundColor: themes.bg_900,
            padding: 28,
            gap: 6,
            borderWidth: 1,
            borderColor: "rgba(204,255,0,0.18)",
          },
        ]}
      >
        <RnView style={[s.flexDirectionRow, { gap: 8, alignItems: "center" }]}>
          <Icon name="Wallet" size={18} color={LIME} />
          <RnText style={[atoms.text_sm, { color: themes.gray_300 }]}>
            Outstanding balance
          </RnText>
        </RnView>

        <RnText
          style={[
            atoms.text_5xl,
            {
              fontFamily: fonts.heavy.fontFamily,
              color: LIME,
              letterSpacing: -1,
            },
          ]}
        >
          {amountDue}
        </RnText>
        <RnText
          style={[
            atoms.text_md,
            { fontFamily: fonts.heavy.fontFamily, color: themes.gray_400 },
          ]}
        >
          KSH
        </RnText>
      </RnView>

      {/* Instruction */}
      <RnView style={[s.flexCol, { gap: 16 }]}>
        <RnView
          style={[s.flexDirectionRow, { gap: 10, alignItems: "flex-start" }]}
        >
          <Icon
            name="Smartphone"
            size={16}
            color={themes.gray_300}
            style={{ marginTop: 2 }}
          />
          <RnText style={[atoms.text_sm, { color: themes.gray_200, flex: 1 }]}>
            Enter the M-Pesa number to receive the payment prompt.
          </RnText>
        </RnView>

        <PhoneInputComponet
          phone={mpesaPhoneNumber}
          onPhoneTextChange={onChangeMpesaPhoneNumber}
        />
      </RnView>

      {/* Submit button — animates in once phone is valid */}
      {_isValidPhone && (
        <RnAnimatedView entering={promptEntering}>
          <Pressable
            onPress={onPress}
            enabled={!isLoading}
            accessibilityRole="button"
            accessibilityLabel="Send M-Pesa prompt"
            style={[
              s.alignCenter,
              s.justifyCenter,
              s.borderRadius_sm,
              {
                backgroundColor: LIME,
                paddingVertical: 16,
                opacity: isLoading ? 0.6 : 1,
              },
            ]}
          >
            <RnView style={[s.flexDirectionRow, { gap: 8 }]}>
              <Icon name="Send" size={18} color="#0d0d0d" />
              <RnText
                style={[
                  atoms.text_md,
                  { fontFamily: fonts.heavy.fontFamily, color: "#0d0d0d" },
                ]}
              >
                {isLoading ? "Sending…" : "Send M-Pesa Prompt"}
              </RnText>
            </RnView>
          </Pressable>
        </RnAnimatedView>
      )}

      {/* Waiting indicator */}
      {isLoading && checkout_req_id && (
        <RnView
          style={[s.flexCol, s.alignCenter, { gap: 6, paddingVertical: 8 }]}
        >
          <Icon name="Clock" size={20} color={themes.gray_400} />
          <RnText
            style={[
              atoms.text_xs,
              { color: themes.gray_400, textAlign: "center" },
            ]}
          >
            Waiting for M-Pesa confirmation…
          </RnText>
        </RnView>
      )}
    </ScrollView>
  );
});
