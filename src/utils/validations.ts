import { CONSTANTS } from "~/constants/CONSTANTS";

export function isNumeric(value: string): boolean {
  if (typeof value !== "string") {
    return false;
  }
  return CONSTANTS.REGEX.NUMBER.test(value);
}
