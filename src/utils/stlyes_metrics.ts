import { PixelRatio } from "react-native";

export function getValueUsingPixelRatio(
  defaultValue: number,
  maxValue: number,
): number {
  return PixelRatio.getFontScale() * defaultValue > maxValue
    ? maxValue
    : defaultValue * PixelRatio.getFontScale();
}
