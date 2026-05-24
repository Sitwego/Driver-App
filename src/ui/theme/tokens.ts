import { Platform } from "react-native";

export const TRACKING = Platform.OS === "android" ? 0.1 : 0;

export const space = {
  _2xs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  _2xl: 24,
  _3xl: 28,
  _4xl: 32,
  _5xl: 40,
} as const;

export const fontSize = {
  _2xs: 10,
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 20,
  _2xl: 22,
  _3xl: 26,
  _4xl: 32,
  _5xl: 40,
} as const;

export const lineHeight = {
  none: 1,
  normal: 1.5,
  relaxed: 1.625,
} as const;

export const borderRadius = {
  _2xs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  full: 999,
} as const;

export const fontWeight = {
  normal: "400",
  semibold: "500",
  bold: "600",
  heavy: "700",
  extraBord: "900",
} as const;

export const fontFamily = {
  bold: "FontAwesome5_Pro_Solid",
  light: "FontAwesome5_Pro_Light",
  normal: "FontAwesome5_Pro_Brands",
  pro_regular: "FontAwesome5_Pro_Regular",
  medium: "Inter-SemiBold",
  regular: "Inter-Regular",
  codeBold: "FiraCode-Bold",
  codeRegular: "FiraCode-Regular",
  codeLight: "FiraCode-Light",
  codeMedium: "FiraCode-Medium",
  codeRetina: "FiraCode-Retina",
  codeSemiBold: "FiraCode-SemiBold",
} as const;
