import { useNavigation } from "@react-navigation/native";
import { PressableScale } from "pressto";
import React, { memo, useCallback, useMemo } from "react";
import { Pressable, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Avatar from "~/components/Avatar";
import Icon from "~/components/Icons";
import RnText from "~/components/RnText";
import { RnAnimatedView, RnView } from "~/components/RnView";
import { useUserState } from "~/lib/state/userState";
import { s } from "~/styles/Common-Styles";
import { formatPrice } from "~/utils/metrics/numbers";
import { createProfileImageUrl } from "~/utils/url";

import { useAppTheme } from "../theme/ThemeProvider";
import { atoms } from "../theme/atoms";

import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackNavigationType } from "~/navigation/types";

type HomeMenuBarNavProp = NativeStackNavigationProp<RootStackNavigationType>;

interface Props {
  navigation?: any;
  onPress?: () => void;
}

const HomeMenuBar: React.FC<Props> = ({ onPress }) => {
  const state = useUserState();
  console.log("HomeMenuBar: user state", state);
  const { colors, fonts } = useAppTheme();
  const { top } = useSafeAreaInsets();
  const onLoad = useCallback(() => {}, []);
  const navigation = useNavigation<HomeMenuBarNavProp>();

  const profileImageUrl = useMemo(
    () =>
      createProfileImageUrl(
        state.profile_id,
        state.photo_id || "",
        "get-profile-image",
      ),
    [state.photo_id, state.profile_id],
  );
  const total_earnings = state?.total_earnings;

  const rating = useMemo(() => state?.rating, [state?.rating]);

  const _name = useMemo(
    () => `${state.first_name} ${state.last_name ?? " "}`,
    [state.first_name, state.last_name],
  );
  return (
    <React.Fragment key={state.activated ? "activated" : "not-activated"}>
      {state.activated ? (
        <RnAnimatedView
          style={[
            HMB_styles.HMB_container_view,
            { backgroundColor: colors.lightBackground, top: top + 10 },
          ]}
        >
          <RnView
            style={[
              atoms.flex_1,
              atoms.gap_sm,
              { flexDirection: "row", alignItems: "center" },
            ]}
          >
            {state.photo_id && (
              <Pressable style={{ padding: 2 }} onPress={onPress}>
                <Avatar size={50} avatar={profileImageUrl} onLoad={onLoad} />
              </Pressable>
            )}
            <RnView style={[atoms.gap_xs]}>
              <RnText style={[atoms.text_xs, { color: colors.lightGray }]}>
                {_name}
              </RnText>
              <RnText
                style={[atoms.text_xl, { fontFamily: fonts.heavy.fontFamily }]}
              >
                {formatPrice(total_earnings as number)}Ksh
              </RnText>
            </RnView>
          </RnView>
          <PressableScale
            style={[
              atoms.gap_xs,
              atoms.gap_sm,
              s.p5,
              s.borderRadius_full,
              s.px10,
              {
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "row",
              },
            ]}
            onPress={() =>
              navigation.navigate("RatingOverview", {
                driverId: state.driver_id,
              })
            }
          >
            <Icon
              name="Star"
              size={20}
              strokeWidth={2.5}
              color={colors.lightGray}
            />
            <RnText
              style={[
                atoms.text_sm,
                { fontFamily: fonts.heavy.fontFamily, textAlign: "center" },
              ]}
            >
              {rating}
            </RnText>
          </PressableScale>
        </RnAnimatedView>
      ) : (
        <RnAnimatedView
          style={[
            HMB_styles.HMB_container_view,
            { backgroundColor: colors.lightBackground, top: top + 10 },
          ]}
        >
          <RnText style={[atoms.text_sm, { color: colors.lightGray }]}>
            <Icon
              name="ClockFading"
              size={28}
              color="#CCFF00"
              strokeWidth={2.5}
            />
          </RnText>
          <Pressable onPress={onPress}>
            <RnText
              style={[
                atoms.text_sm,
                { color: "#FFD700", fontFamily: fonts.bold.fontFamily },
              ]}
            >
              Review in progress — we’ll notify you soon.
            </RnText>
          </Pressable>
        </RnAnimatedView>
      )}
    </React.Fragment>
  );
};

export default memo(HomeMenuBar);

const HMB_styles = StyleSheet.create({
  HMB_container_view: {
    position: "absolute",
    flexDirection: "row",
    zIndex: 999,
    width: "95%",
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 4,
    borderRadius: 16,
    height: 60,
    paddingHorizontal: 8,
  },
});
