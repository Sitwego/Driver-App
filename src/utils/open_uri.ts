import { Linking, Alert } from "react-native";

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

export { makePhoneCall, openWhatsApp };
