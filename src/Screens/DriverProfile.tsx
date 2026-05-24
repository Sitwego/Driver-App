import React from "react";
import { StyleSheet } from "react-native";
import { PressableScale as Pressable } from "pressto";
import { ScrollView } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Avatar from "~/components/Avatar";
import Icon from "~/components/Icons";
import RnText from "~/components/RnText";
import { RnView } from "~/components/RnView";
import { useImageLoader } from "~/hooks/useImageLoader";
import { s } from "~/styles/Common-Styles";
import { atoms } from "~/ui/theme/atoms";
import { themes } from "~/ui/theme/theme_utils";
import { useAppTheme } from "~/ui/theme/ThemeProvider";

export function DriverProfile({ navigation }: any) {
  const { colors, fonts } = useAppTheme();
  const insets = useSafeAreaInsets();
  const scrollview = React.useRef<ScrollView>(null);
  const { isLoading, uri, onLoad } = useImageLoader();
  return (
    <ScrollView
      contentContainerStyle={{ borderWidth: 0 }}
      ref={scrollview}
      style={[s.h100pct, s.w100pct, s.flex1]}
    >
      <RnView
        style={[s.flex1, s.px16, s.gap16, { paddingTop: insets.top - 15 }]}
      >
        <RnView style={[s.flexCol, s.gap8]}>
          <RnView style={[s.flexDirectionRow, s.gap6]}>
            <Avatar size={80} onLoad={onLoad} avatar={uri} />
            <RnView style={[s.alignCenter]}>
              <RnText
                style={[atoms.text_md, { fontFamily: fonts.heavy.fontFamily }]}
              >
                John Doe
              </RnText>
              <RnText
                style={[
                  atoms.text_sm,
                  {
                    fontFamily: fonts.heavy.fontFamily,
                    color: colors.lightGray,
                  },
                ]}
              >
                40 y/o
              </RnText>
            </RnView>
          </RnView>
          <RnText
            style={[
              atoms.text_sm,
              { color: colors.lightGray, fontFamily: fonts.medium.fontFamily },
            ]}
          >
            Experience level: Newcomer
          </RnText>
        </RnView>
        <RnView
          style={[
            {
              borderBlockColor: themes.bg_800,
              borderBottomWidth: StyleSheet.hairlineWidth,
              paddingBottom: 12,
              marginTop: 8,
            },
          ]}
        >
          <Pressable style={[s.flexDirectionRow, s.justifyBetween]}>
            <RnView style={[s.flexDirectionRow, s.gap8, s.justifyCenter]}>
              <Icon
                name="Star"
                size={25}
                color={themes.green_600}
                strokeWidth={2.5}
              />
              <RnText
                style={[
                  atoms.text_sm,
                  {
                    fontFamily: fonts.medium.fontFamily,
                    color: colors.text,
                  },
                ]}
              >
                4.9 (1200+)
              </RnText>
            </RnView>
            <Icon
              name="ChevronRight"
              size={28}
              color={colors.text}
              strokeWidth={2.5}
            />
          </Pressable>
        </RnView>
      </RnView>
    </ScrollView>
  );
}
