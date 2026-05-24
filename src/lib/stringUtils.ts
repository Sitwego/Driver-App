import { CONSTANTS } from "~/constants/CONSTANTS";

/**
 *  Remove invisible characters from a string except for spaces and format characters for emoji, and trim it.
 */
function removeInvisibleCharacters(value: string): string {
  let result = value;

  // Remove spaces:
  // - \u200B: zero-width space
  // - \u2060: word joiner
  result = result.replace(/[\u200B\u2060]/g, "");

  const invisibleCharacterRegex = /[\p{Cc}\p{Cs}\p{Co}\p{Cn}]/gu;

  // The control unicode (Cc) regex removes all newlines,
  // so we first split the string by newline and rejoin it afterward to retain the original line breaks.
  result = result
    .split("\n")
    .map((part) =>
      // Remove all characters from the 'Other' (C) category except for format characters (Cf)
      // because some of them are used for emojis
      part.replace(invisibleCharacterRegex, ""),
    )
    .join("\n");

  // Remove characters from the (Cf) category that are not used for emojis
  result = result.replace(/[\u200E-\u200F]/g, "");

  // Remove all characters from the 'Separator' (Z) category except for Space Separator (Zs)
  result = result.replace(/[\p{Zl}\p{Zp}]/gu, "");

  // If the result consist of only invisible characters, return an empty string
  if (isEmptyString(result)) {
    return "";
  }

  return result.trim();
}
/**
 *  Check if the string would be empty if all invisible characters were removed.
 */
function isEmptyString(value: string): boolean {
  // \p{C} matches all 'Other' characters
  // \p{Z} matches all separators (spaces etc.)
  // Source: http://www.unicode.org/reports/tr18/#General_Category_Property
  let transformed = value.replace(
    CONSTANTS.REGEX.INVISIBLE_CHARACTERS_GROUPS,
    "",
  );

  // Remove other invisible characters that are not in the above unicode categories
  transformed = transformed.replace(
    CONSTANTS.REGEX.OTHER_INVISIBLE_CHARACTERS,
    "",
  );

  // Check if after removing invisible characters the string is empty
  return transformed === "";
}
export const StringUtils = {
  removeInvisibleCharacters,
  isEmptyString,
};
