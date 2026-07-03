import { Image as ExpoImage, ImageBackground } from "expo-image";
import {
  type ImagePickerOptions,
  launchImageLibraryAsync,
} from "expo-image-picker";
import React, { memo, useCallback } from "react";
import { ActivityIndicator, Pressable, StyleSheet } from "react-native";

import RnText from "~/components/RnText";
import { RnView } from "~/components/RnView";
import { useSheetWrapper } from "~/hooks/useSheetWrapper";
import { compressImgIfNeeded } from "~/lib/Image/imgResize";
import { s } from "~/styles/Common-Styles";
import { useAppTheme } from "~/ui/theme/ThemeProvider";
import { getDataUriSize } from "~/utils/media/utils";
import { width } from "~/utils/metrics/dimm";
import { isNative } from "~/utils/platform";

const SUPPORTED_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg", // non-standard, but reported by some pickers
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

type ImageControllerTypes = {
  value: string;
  onChange: (value: string) => void;
  label: string;
  isProfileImage?: boolean;
  isUploading?: boolean;
};
const ImagePickerFormController: React.FC<ImageControllerTypes> = ({
  value,
  onChange,
  label,
  isProfileImage,
  isUploading,
}) => {
  const { colors } = useAppTheme();

  const uploadingOverlay = isUploading ? (
    <RnView
      style={[
        StyleSheet.absoluteFill,
        s.alignCenter,
        s.justifyCenter,
        { backgroundColor: "rgba(0,0,0,0.45)" },
      ]}
    >
      <ActivityIndicator size="large" color={colors.primary} />
      <RnText style={{ color: "#fff", marginTop: 8 }}>Uploading…</RnText>
    </RnView>
  ) : null;

  const sheetWraper = useSheetWrapper();

  const openImagePicker = useCallback(
    async (opt: ImagePickerOptions) => {
      const resp = await sheetWraper(
        launchImageLibraryAsync({
          ...opt,
          mediaTypes: "images",
          // allowsEditing: true,
          quality: 1,
        }),
      );

      return (resp.assets ?? [])
        .slice(0, 1)
        .filter((asset) => {
          const mime = asset.mimeType?.toLowerCase();
          if (!mime || !SUPPORTED_IMAGE_MIME_TYPES.has(mime)) {
            console.log("Unsupported image format:", asset.mimeType);
            return false;
          }
          return true;
        })
        .map((image) => ({
          mime: image.mimeType ?? "image/jpeg",
          height: image.height,
          width: image.width,
          path: image.uri,
          size: getDataUriSize(image.uri),
        }));
    },
    [sheetWraper],
  );

  const openOpenLib = useCallback(
    async function () {
      const img = await openImagePicker({
        aspect: [9, 16],
      });

      let image = img[0];
      if (!image) return;

      image = await compressImgIfNeeded(image);

      if (isNative) {
        await ExpoImage.prefetch(image.path);
      }

      onChange(image.path);
    },
    [onChange, openImagePicker],
  );

  const imageSource = value ? { uri: value } : undefined;

  if (isProfileImage) {
    return (
      <Pressable
        onPress={openOpenLib}
        disabled={isUploading}
        style={[
          s.justifyCenter,
          s.alignCenter,
          {
            alignSelf: "center",
            width: width / 2,
            aspectRatio: 4 / 4,
            borderRadius: 999,
            backgroundColor: colors.lightBackground,
          },
        ]}
      >
        <ImageBackground
          source={imageSource}
          style={{
            width: "100%",
            flex: 1,
            borderRadius: 999,
            overflow: "hidden",
          }}
          responsivePolicy="static"
          contentFit="cover"
          accessibilityIgnoresInvertColors
          transition={{ duration: 300, effect: "cross-dissolve" }}
        >
          <RnView style={[s.flex1, s.alignCenter, s.justifyCenter]}>
            <RnText>{label}</RnText>
          </RnView>
          {uploadingOverlay}
        </ImageBackground>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={openOpenLib}
      disabled={isUploading}
      style={[
        s.w100pct,
        s.alignCenter,
        s.justifyCenter,
        {
          aspectRatio: 16 / 9,
          borderRadius: 16,
          backgroundColor: colors.lightBackground,
        },
      ]}
    >
      <ImageBackground
        source={imageSource}
        style={{
          width: "100%",
          flex: 1,
          borderRadius: 16,
          overflow: "hidden",
        }}
        responsivePolicy="static"
        contentFit="cover"
        accessibilityIgnoresInvertColors
        transition={{ duration: 300, effect: "cross-dissolve" }}
      >
        <RnView style={[s.flex1, s.alignCenter, s.justifyCenter]}>
          <RnText>{label}</RnText>
        </RnView>
        {uploadingOverlay}
      </ImageBackground>
    </Pressable>
  );
};

export default memo(ImagePickerFormController);
