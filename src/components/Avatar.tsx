import React, { memo, useMemo } from "react";
import { ImageStyle, StyleSheet, type ViewStyle } from "react-native";
import { RnView } from "./RnView";
import { HDRnImage } from "~/lib/Image/HDRnImage";
import RnText from "./RnText";
import { useAppTheme } from "~/ui/theme/ThemeProvider";

type Props = {
  size: number;
  styles?: ViewStyle;
  onLoad: () => void;
  avatar?: string;
};

export function InitialsAvatar({
  name,
  size = 30,
  rounded = 15,
}: {
  name: string;
  size?: number;
  rounded?: number;
}) {
  const { colors, fonts } = useAppTheme();
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <RnView
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          backgroundColor: colors.primary,
          borderRadius: rounded,
        },
      ]}
    >
      <RnText
        style={{
          fontSize: 14,
          color: "#fff",
          fontFamily: fonts.heavy.fontFamily,
        }}
      >
        {initials}
      </RnText>
    </RnView>
  );
}

const AVATAR_PLACEHOLDER =
  "https://cdn-icons-png.flaticon.com/512/149/149071.png";

const Avatar: React.FC<Props> = memo(({ size, styles, avatar, onLoad }) => {
  const img_style: ImageStyle = useMemo(() => {
    return {
      width: size,
      height: size,
      borderRadius: Math.floor(size / 2),
    };
  }, [size]);
  const avatar_container = useMemo(
    () => ({
      height: size,
      width: size,
      ...styles,
    }),
    [size, styles],
  );
  return (
    <RnView style={[avatar_container]}>
      <HDRnImage
        accessibilityIgnoresInvertColors
        style={[img_style]}
        source={{
          uri: avatar ? avatar : AVATAR_PLACEHOLDER,
        }}
        onLoad={onLoad}
        resizeMode="cover"
        testID="avatarImageTest"
      />
    </RnView>
  );
});

Avatar.displayName = "Avatar";
export default Avatar;

const styles = StyleSheet.create({
  avatar: {
    alignItems: "center",
    justifyContent: "center",
  },
});
