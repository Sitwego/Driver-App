import React, { useRef } from "react";
import { PressableScale as Pressable } from "pressto";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import RnText from "~/components/RnText";
import RnTextInput, {
  type AnimatedTextInputRef,
} from "~/components/RnTextInput";
import { RnView } from "~/components/RnView";
import { useUpdateBio } from "~/hooks/apis";
import {
  DEFAULT_TRAVEL_PREFERENCES,
  travelPreferencesStore,
} from "~/lib/store";
import { s } from "~/styles/Common-Styles";
import { atoms } from "~/ui/theme/atoms";
import { themes } from "~/ui/theme/theme_utils";
import { useAppTheme } from "~/ui/theme/ThemeProvider";

export function AddBioScreen({ navigation }: any) {
  const { colors, fonts } = useAppTheme();
  const insets = useSafeAreaInsets();
  const inputRef = useRef<AnimatedTextInputRef>(null);
  const { mutate: saveBio } = useUpdateBio();
  const [value, setValue] = React.useState(
    () => travelPreferencesStore.get(["preferences"])?.bio ?? "",
  );

  const sanitize = (text: string) =>
    // Strip control characters except newline (\x0A) and tab (\x09)
    text.replace(/[\x00-\x08\x0B-\x1F\x7F]/g, "");
  const onSave = () => {
    const current = travelPreferencesStore.get(["preferences"]);
    travelPreferencesStore.set(["preferences"], {
      ...DEFAULT_TRAVEL_PREFERENCES,
      ...current,
      bio: value,
    });
    saveBio({ bio: value });
    if (navigation.canGoBack()) navigation.goBack();
  };
  return (
    <KeyboardAwareScrollView
      bottomOffset={100}
      disableScrollOnKeyboardHide
      contentContainerStyle={[
        s.px16,
        s.py16,
        { paddingTop: insets.top, flexGrow: 1 },
      ]}
    >
      <RnView
        style={[s.flexBox, { marginBottom: insets.bottom + 80, flexGrow: 1 }]}
      >
        <RnText
          numberOfLines={2}
          style={[atoms.text_md, { fontFamily: fonts.heavy.fontFamily }]}
        >
          What woul you like to share about yourself?
        </RnText>
        <RnView style={[s.mt20, s.w100pct, s.px6, s.mb20, { flexGrow: 1 }]}>
          <RnTextInput
            style={[
              // s.input,
              s.f16,
              s.w100pct,
              {
                fontFamily: fonts.regular.fontFamily,
                color: colors.text,
                borderColor: colors.lightBackground,
              },
            ]}
            autoCorrect={true}
            underlineColorAndroid={themes.bg_900}
            cursorColor={colors.lightBackground}
            inputMode="text"
            multiline
            numberOfLines={10}
            maxLength={300}
            textAlignVertical="top"
            ref={inputRef}
            onChangeText={(text) => setValue(sanitize(text))}
            placeholder="e.g. I love hiking, outdoor activities and music"
            placeholderTextColor={colors.lightGray}
            value={value}
          />
        </RnView>
        <Pressable
          onPress={onSave}
          style={[
            s.p16,
            s.w100pct,
            s.alignCenter,
            s.alignSelf,
            s.borderRadius_sm,
            { backgroundColor: colors.primary },
          ]}
        >
          <RnText
            style={[
              atoms.text_xl,
              s.textCenter,
              { fontFamily: fonts.heavy.fontFamily },
            ]}
          >
            Save
          </RnText>
        </Pressable>
      </RnView>
    </KeyboardAwareScrollView>
  );
}
