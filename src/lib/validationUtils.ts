import { StringUtils } from "./stringUtils";

/**
 * This function is used to remove invisible characters from strings before validation and submission.
 */
function prepareValues(values: ValuesType): ValuesType {
  const trimmedStringValues: ValuesType = {};

  for (const [inputID, inputValue] of Object.entries(values)) {
    if (typeof inputValue === "string") {
      trimmedStringValues[inputID] =
        StringUtils.removeInvisibleCharacters(inputValue);
    } else {
      trimmedStringValues[inputID] = inputValue;
    }
  }

  return trimmedStringValues;
}

type EmptyObject = Record<string, never>;

type EmptyValue = EmptyObject | null | undefined;

function isEmptyObject<T>(obj: T | EmptyValue): obj is EmptyValue {
  return Object.keys(obj ?? {}).length === 0;
}

export { isEmptyObject };
export type { EmptyObject };

type ValuesType = Record<string, unknown>;
export { prepareValues };
export type { ValuesType };
