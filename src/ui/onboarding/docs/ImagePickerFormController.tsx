import { Image as ExpoImage, ImageBackground } from "expo-image";
import {
  type ImagePickerOptions,
  launchImageLibraryAsync,
} from "expo-image-picker";

import RnText from "~/components/RnText";
import { RnView } from "~/components/RnView";
import { s } from "~/styles/Common-Styles";
import { useAppTheme } from "~/ui/theme/ThemeProvider";
import React, { memo, useCallback } from "react";
import { ActivityIndicator, StyleSheet, TouchableHighlight } from "react-native";
import { useSheetWrapper } from "~/hooks/useSheetWrapper";
import { getDataUriSize } from "~/utils/media/utils";
import { usePhotoLibraryPermission } from "~/hooks/usePermision";
import { compressImgIfNeeded } from "~/lib/Image/imgResize";
import { isNative } from "~/utils/platform";
import { width } from "~/utils/metrics/dimm";

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

  const { requestPhotoAccessIfNeeded } = usePhotoLibraryPermission();

  const sheetWraper = useSheetWrapper();

  const openImagePicker = useCallback(
    async (opt: ImagePickerOptions) => {
      const resp = await sheetWraper(
        launchImageLibraryAsync({
          ...opt,
          exif: false,
          mediaTypes: "images",
          quality: 1,
          legacy: true,
        }),
      );

      return (resp.assets ?? [])
        .slice(0, 1)
        .filter((asset, _) => {
          if (
            !asset.mimeType?.startsWith("image/") ||
            (!asset.mimeType?.endsWith("jpeg") &&
              !asset.mimeType?.endsWith("jpg") &&
              !asset.mimeType?.endsWith("png"))
          ) {
            console.log("Only .jpg and .png files are supported");
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
      if (!(await requestPhotoAccessIfNeeded())) {
        return;
      }
      const img = await openImagePicker({
        aspect: [16, 9],
      });

      let image = img[0];
      if (!image) return;

      image = await compressImgIfNeeded(image, 1000000);

      if (isNative) {
        await ExpoImage.prefetch(image.path);
      }

      onChange(image.path);
    },
    [onChange, openImagePicker, requestPhotoAccessIfNeeded],
  );

  const imageSource = value ? { uri: value } : undefined;

  if (isProfileImage) {
    return (
      <TouchableHighlight
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
      </TouchableHighlight>
    );
  }

  return (
    <TouchableHighlight
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
    </TouchableHighlight>
  );
};

export default memo(ImagePickerFormController);
// import { Image as ExpoImage, ImageBackground } from "expo-image";
// import {
//   type ImagePickerOptions,
//   launchImageLibraryAsync,
// } from "expo-image-picker";

// import RnText from "~/components/RnText";
// import { RnView } from "~/components/RnView";
// import { s } from "~/styles/Common-Styles";
// import { useAppTheme } from "~/ui/theme/ThemeProvider";
// import React, { memo, useCallback } from "react";
// import { TouchableHighlight } from "react-native";
// import { useSheetWrapper } from "~/hooks/useSheetWrapper";
// import { getDataUriSize } from "~/utils/media/utils";
// import { usePhotoLibraryPermission } from "~/hooks/usePermision";
// import { compressImgIfNeeded } from "~/lib/Image/imgResize";
// import { isNative } from "~/utils/platform";
// import { width } from "~/utils/metrics/dimm";

// type ImageControllerTypes = {
//   value: string;
//   onChange: (value: string) => void;
//   label: string;
//   isProfileImage?: boolean;
// };
// const ImagePickerFormController: React.FC<ImageControllerTypes> = ({
//   value,
//   onChange,
//   label,
//   isProfileImage,
// }) => {
//   const { colors } = useAppTheme();

//   const { requestPhotoAccessIfNeeded } = usePhotoLibraryPermission();

//   const sheetWraper = useSheetWrapper();

//   const openImagePicker = useCallback(
//     async (opt: ImagePickerOptions) => {
//       const resp = await sheetWraper(
//         launchImageLibraryAsync({
//           ...opt,
//           exif: false,
//           mediaTypes: "images",
//           quality: 1,
//           legacy: true,
//         }),
//       );

//       return (resp.assets ?? [])
//         .slice(0, 1)
//         .filter((asset, _) => {
//           if (
//             !asset.mimeType?.startsWith("image/") ||
//             (!asset.mimeType?.endsWith("jpeg") &&
//               !asset.mimeType?.endsWith("jpg") &&
//               !asset.mimeType?.endsWith("png"))
//           ) {
//             // setError(_(msg`Only .jpg and .png files are supported`));
//             console.log("Only .jpg and .png files are supported");
//             return false;
//           }
//           return true;
//         })
//         .map((image) => ({
//           mime: image.mimeType ?? "image/jpeg",
//           height: image.height,
//           width: image.width,
//           path: image.uri,
//           size: getDataUriSize(image.uri),
//         }));
//     },
//     [sheetWraper],
//   );

//   const openOpenLib = useCallback(
//     async function () {
//       if (!(await requestPhotoAccessIfNeeded())) {
//         return;
//       }
//       const img = await openImagePicker({
//         aspect: [16, 9],
//       });

//       let image = img[0];
//       if (!image) return;

//       image = await compressImgIfNeeded(image, 1000000);

//       if (isNative) {
//         await ExpoImage.prefetch(image.path);
//       }

//       onChange(image.path);
//     },
//     [onChange, openImagePicker, requestPhotoAccessIfNeeded],
//   );

//   const tmpImg = value ?? "";

//   if (isProfileImage) {
//     return (
//       <TouchableHighlight
//         onPress={openOpenLib}
//         style={[
//           s.justifyCenter,
//           s.alignCenter,
//           {
//             alignSelf: "center",
//             width: width / 2,
//             aspectRatio: 4 / 4,
//             borderRadius: 999,
//             backgroundColor: colors.lightBackground,
//           },
//         ]}
//       >
//         <ImageBackground
//           source={tmpImg}
//           style={{
//             width: "100%",
//             flex: 1,
//             borderRadius: 999,
//             overflow: "hidden",
//           }}
//           // imageStyle={{ borderRadius: 16 }}
//           responsivePolicy="static"
//           contentFit="cover"
//           accessibilityIgnoresInvertColors
//           transition={{ duration: 300, effect: "cross-dissolve" }}
//         >
//           <RnView style={[s.flex1, s.alignCenter, s.justifyCenter]}>
//             <RnText>{label}</RnText>
//           </RnView>
//         </ImageBackground>
//       </TouchableHighlight>
//     );
//   }

//   return (
//     <TouchableHighlight
//       onPress={openOpenLib}
//       style={[
//         s.w100pct,
//         s.alignCenter,
//         s.justifyCenter,
//         {
//           aspectRatio: 16 / 9,
//           borderRadius: 16,
//           backgroundColor: colors.lightBackground,
//         },
//       ]}
//     >
//       <ImageBackground
//         source={tmpImg}
//         style={{
//           width: "100%",
//           flex: 1,
//           borderRadius: 16,
//           overflow: "hidden",
//         }}
//         // imageStyle={{ borderRadius: 16 }}
//         responsivePolicy="static"
//         contentFit="cover"
//         accessibilityIgnoresInvertColors
//         transition={{ duration: 300, effect: "cross-dissolve" }}
//       >
//         <RnView style={[s.flex1, s.alignCenter, s.justifyCenter]}>
//           <RnText>{label}</RnText>
//         </RnView>
//       </ImageBackground>
//     </TouchableHighlight>
//   );
// };

// export default memo(ImagePickerFormController);
