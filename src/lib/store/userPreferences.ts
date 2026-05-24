import { StyleProp, ViewStyle } from "react-native";

export type OptionsPickerItem<TKey extends string> = {
  /** A unique identifier for each option */
  key: TKey;

  /** Text to be displayed */
  title: string;
};

export type OptionsPickerProps<TKey extends string> = {
  /** Options list */
  options: OptionsPickerItem<TKey>[];

  /** Selected option's identifier */
  selectedOption: TKey;

  /** Option select handler */
  onOptionSelected: (option: TKey) => void;

  /** Indicates whether the picker is disabled */
  isDisabled?: boolean;

  /** Optional style */
  style?: StyleProp<ViewStyle>;
};
export const preferences = {
  chattiness: [
    {
      key: "chatty",
      title: "I'm a chatty traveler",
    },
    {
      key: "quiet",
      title: "I'm a quiet traveler",
    },
    {
      title: "I'm chatty when I feel comfortable",
      key: "considerate",
    },
  ],
  music: [
    {
      key: "chill",
      title: "It's all about the playlist!",
    },
    {
      key: "mood",
      title: "I'll jam depending on the mood",
    },
    {
      title: "Silence is golden",
      key: "silent",
    },
  ] as OptionsPickerItem<any>[],
  smoking: [
    {
      key: "allowed",
      title: "Smoking 🚬 allowed",
    },
    {
      key: "considerate",
      title: "Cigarette breaks outside the car are oky 🙂",
    },
    {
      title: "No smoking 🚭 please!",
      key: "nosmoking",
    },
  ] as OptionsPickerItem<any>[],
  pets: [
    {
      key: "pets_allowed",
      title: "I love pets. Woof! 🐕🐈🐰",
    },
    {
      key: "considerate",
      title: "I'll travel with pets depending on the animal",
    },
    {
      title: "I'd prefer not to travel with pets/animals",
      key: "no_pets",
    },
  ] as OptionsPickerItem<any>[],
};
