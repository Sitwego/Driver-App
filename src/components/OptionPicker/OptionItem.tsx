import React from "react";
import { StyleSheet, type StyleProp, type ViewStyle } from "react-native";

import { RnView } from "../RnView";
import PressableWithFeedBack from "../PressableButton/PressableWithFeedBack";
import Icon from "../Icons";
import { getValueUsingPixelRatio } from "~/utils/stlyes_metrics";
import { themes } from "~/ui/theme/theme_utils";
import RnText from "../RnText";
import { s } from "~/styles/Common-Styles";
import { atoms } from "~/ui/theme/atoms";
import { useAppTheme } from "~/ui/theme/ThemeProvider";

type SelectCircleProps = {
  /** Should we show the checkmark inside the circle */
  isChecked: boolean;

  /** Additional styles to pass to SelectCircle */
  selectCircleStyles?: StyleProp<ViewStyle>;
  iconSize?: number;
  iconColor?: string;
  iconName?: string;
  iconStrokeWidth?: number;
};

function SelectCircle({
  isChecked = false,
  selectCircleStyles,
  iconSize = 20,
  iconColor = themes.green_600,
  iconName = "Check",
  iconStrokeWidth = 2,
}: SelectCircleProps) {
  return (
    <RnView
      style={[styles.selectCircle, styles.alignSelfCenter, selectCircleStyles]}
    >
      {isChecked && (
        <Icon
          name={iconName}
          size={iconSize}
          strokeWidth={iconStrokeWidth}
          color={iconColor}
        />
      )}
    </RnView>
  );
}

type OptionItemProps = {
  /** Text to be rendered */
  title: string;

  /** Press handler */
  onPress?: () => void;

  /** Indicates whether the option is currently selected (active) */
  isSelected?: boolean;

  /** Indicates whether the option is disabled */
  isDisabled?: boolean;

  /** Optional style prop */
  style?: StyleProp<ViewStyle>;
};

function OptionItem({
  title,
  onPress,
  isSelected = false,
  isDisabled,
  style,
}: OptionItemProps) {
  const { fonts } = useAppTheme();
  return (
    <PressableWithFeedBack
      onPress={onPress}
      role="radio"
      accessibilityLabel={title}
      disabled={isDisabled}
      wrapperStyle={[style]}
    >
      <RnView
        style={[
          styles.borderedContentCard,
          // isSelected && styles.borderColorFocus,
          s.p5,
          s.py14,
        ]}
      >
        <RnView style={{ paddingRight: 20 }}>
          <RnView style={[s.flexDirectionRow, s.gap12, s.alignCenter]}>
            {/* Icon Here later */}
            {!isDisabled && (
              <RnView>
                <SelectCircle
                  isChecked={isSelected}
                  selectCircleStyles={styles.sectionSelectCircle}
                />
              </RnView>
            )}
            <RnText
              style={[
                s.mt2,
                atoms.text_sm,
                { fontFamily: fonts.regular.fontFamily },
              ]}
              numberOfLines={2}
            >
              {title}
            </RnText>
          </RnView>
        </RnView>
      </RnView>
    </PressableWithFeedBack>
  );
}

OptionItem.displayName = "OptionItem";

export default OptionItem;

const componentSizeSmall = getValueUsingPixelRatio(30, 34);
const styles = StyleSheet.create({
  selectCircle: {
    width: componentSizeSmall,
    height: componentSizeSmall,
    borderColor: themes.green_600,
    borderWidth: 2,
    borderRadius: componentSizeSmall / 2,
    justifyContent: "center",
    alignItems: "center",
  },
  borderedContentCard: {
    // borderWidth: StyleSheet.hairlineWidth + 0.8,
    // borderColor: themes.green_600,
    // borderRadius: 8,
  },
  // borderColorFocus: {
  //   borderColor: themes.green_600,
  // },
  sectionSelectCircle: {
    borderColor: themes.green_600,
  },

  alignSelfCenter: { alignSelf: "center" },

  optionSelectCircle: {
    borderRadius: componentSizeSmall / 2 + 1,
    padding: 1,
  },
});
