import { Linking, Alert } from "react-native";

/**
 * The number driver support answers on.
 *
 * Shared rather than repeated per screen: a driver who is told one number
 * during onboarding and a different one when a document is rejected has no way
 * to know which is current.
 *
 * TODO: replace with the real driver-support number (or wire to config/env).
 */
const SUPPORT_PHONE = "+254780526523";

const makePhoneCall = (phoneNumber: string) => {
  const url = `tel:${phoneNumber}`;
  Linking.canOpenURL(url)
    .then((supported) => {
      if (!supported) {
        Alert.alert(
          "Phone number is not available or supported on this device.",
        );
      } else {
        return Linking.openURL(url).catch((err) =>
          console.error("An error occurred while trying to call", err),
        );
      }
    })
    .catch((err) => console.error("An error occurred", err));
};

const openWhatsApp = (phoneNumber: string, message = "") => {
  // WhatsApp expects the number without "+", spaces or leading zeros.
  const normalized = phoneNumber.replace(/[^\d]/g, "");
  const appUrl = `whatsapp://send?phone=${normalized}${
    message ? `&text=${encodeURIComponent(message)}` : ""
  }`;
  const webUrl = `https://wa.me/${normalized}${
    message ? `?text=${encodeURIComponent(message)}` : ""
  }`;

  Linking.canOpenURL(appUrl)
    .then((supported) =>
      Linking.openURL(supported ? appUrl : webUrl).catch((err) =>
        console.error("An error occurred while trying to open WhatsApp", err),
      ),
    )
    .catch((err) => console.error("An error occurred", err));
};

export { SUPPORT_PHONE, makePhoneCall, openWhatsApp };
