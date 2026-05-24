import { StyleProp, ViewStyle } from "react-native";
import { RnView } from "../RnView";
import { Fragment } from "react/jsx-runtime";
import OptionItem from "./OptionItem";
import { s } from "~/styles/Common-Styles";
import { OptionsPickerProps } from "~/lib/store/userPreferences";

function OptionsPicker<TKey extends string>({
  options,
  selectedOption,
  onOptionSelected,
  style,
  isDisabled,
}: OptionsPickerProps<TKey>) {
  return (
    <RnView style={[s.flexCol, s.w100pct, style]}>
      {options.map((option, index) => (
        <Fragment key={option.key}>
          <OptionItem
            title={option.title}
            isSelected={selectedOption === option.key}
            isDisabled={isDisabled}
            onPress={() => onOptionSelected(option.key)}
            style={[s.w100pct]}
          />
          {index < options.length - 1 && <RnView style={s.mr3} />}
        </Fragment>
      ))}
    </RnView>
  );
}

OptionsPicker.displayName = "OptionsPicker";

export default OptionsPicker;
