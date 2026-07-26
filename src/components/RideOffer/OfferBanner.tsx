import { memo } from "react";
import { StyleSheet, View } from "react-native";

import { useAppTheme } from "~/ui/theme/ThemeProvider";
import { atoms } from "~/ui/theme/atoms";
import { themes } from "~/ui/theme/theme_utils";

import RnText from "../RnText";

type Props = {
  label?: string;
};

/**
 * Full-bleed strip across the top of the offer. Sits outside the panel's
 * horizontal padding so it spans edge to edge like the reference design.
 */
const OfferBanner = ({ label = "ZERO COMMISSION" }: Props) => {
  const { fonts } = useAppTheme();

  return (
    <View style={styles.banner}>
      <RnText
        textAlign="center"
        numberOfLines={1}
        style={[
          atoms.text_sm,
          styles.label,
          { fontFamily: fonts.heavy.fontFamily },
        ]}
      >
        {label}
      </RnText>
    </View>
  );
};

const styles = StyleSheet.create({
  banner: {
    width: "100%",
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: themes.gray_1000,
  },
  label: {
    letterSpacing: 1.5,
  },
});

export default memo(OfferBanner);
