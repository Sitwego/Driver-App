import { Platform } from "react-native";

export function generateUUID(): string {
  if (Platform.OS !== "web" && global.crypto?.randomUUID) {
    console.log("// Check for modern React Native (0.71+) with Hermes");
    return global.crypto.randomUUID();
  }

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
