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

export { makePhoneCall };
