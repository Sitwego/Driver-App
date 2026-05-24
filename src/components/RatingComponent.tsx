import { useNavigation, useRoute } from "@react-navigation/native";
import { PressableScale } from "pressto";
import React, { useCallback } from "react";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import StarRating from "react-native-star-rating-widget";

// import { useSubmitDriverReview } from "~/hooks/api";
import { s } from "~/styles/Common-Styles";

import { atoms } from "~/ui/theme/atoms";
import { RnView } from "./RnView";
import RnText from "./RnText";
import { useAppTheme } from "~/ui/theme/ThemeProvider";
import { RatingScreenProps } from "~/navigation/types";
import RnTextInput from "./RnTextInput";
import { themes } from "~/ui/theme/theme_utils";
import { useRateRider } from "~/hooks/apis";
const MAX_STARS = 5;

function RatingRow({
  label,
  rating,
  onChange,
}: {
  label: string;
  rating: number;
  onChange: (rating: number) => void;
}) {
  const handleChange = useCallback(
    (r: number) => onChange(Math.min(Math.max(0, r), MAX_STARS)),
    [onChange],
  );

  return (
    <RnView style={[s.gap12, s.alignCenter, s.flexCol]}>
      <RnText style={[atoms.text_xs]}>{label}</RnText>
      <StarRating
        step="full"
        onChange={handleChange}
        enableSwiping
        rating={rating}
        maxStars={MAX_STARS}
      />
    </RnView>
  );
}

export type RatingComponentProps = RatingScreenProps;

export const RatingComponent: React.FC<RatingComponentProps> = ({
  navigation,
  route,
}) => {
  const { colors, fonts } = useAppTheme();
  const { rideId, riderName } = route.params;
  const insets = useSafeAreaInsets();
  const [punctuality, setPunctuality] = React.useState(0);
  const [respectfulness, setRiderRespectFullness] = React.useState(0);
  const [fareReadiness, setFareReadiness] = React.useState(0);
  const [comment, setComment] = React.useState("");
  const { mutateAsync: rateRider, isPending } = useRateRider();

  const onPunctualityChange = useCallback((rating: number) => {
    setPunctuality(rating);
  }, []);

  const onRespectfulnessChange = useCallback((rating: number) => {
    setRiderRespectFullness(rating);
  }, []);

  const onFareReadinessChange = useCallback((rating: number) => {
    setFareReadiness(rating);
  }, []);

  const handleReviewSubmit = useCallback(async () => {
    const reviewData = {
      rideId,
      punctuality,
      respectfulness,
      fareReadiness,
      comment,
    };
    console.log("Submitting review:", reviewData);
    try {
      await rateRider(reviewData);
      navigation.popToTop();
    } catch (error) {
      console.error("Failed to submit review:", error);
    }
  }, [
    comment,
    fareReadiness,
    navigation,
    punctuality,
    rateRider,
    respectfulness,
    rideId,
  ]);
  return (
    <KeyboardAwareScrollView
      bottomOffset={40}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[
        s.px16,
        { paddingTop: insets.top + 20, paddingBottom: insets.bottom },
      ]}
    >
      <RnText
        style={[
          atoms.text_xl,
          s.textCenter,
          { color: colors.text, fontFamily: fonts.heavy.fontFamily },
        ]}
      >
        Rate your ride with {riderName ?? "the rider"}
      </RnText>
      <RnView style={[s.gap16, s.alignCenter, s.mt20]}>
        <RatingRow
          label="Punctuality"
          rating={punctuality}
          onChange={onPunctualityChange}
        />
        <RatingRow
          label="Respectfulness"
          rating={respectfulness}
          onChange={onRespectfulnessChange}
        />
        <RatingRow
          label="Fare Readiness"
          rating={fareReadiness}
          onChange={onFareReadinessChange}
        />
        <RnView>
          <RnText style={[atoms.text_2xs, { color: themes.gray_100 }]}>
            Feal free to share any additional feedback or comments about your
            ride experience.
          </RnText>
          <RnTextInput
            value={comment}
            onChangeText={setComment}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            placeholder="Write your comments here..."
            placeholderTextColor={themes.bg_700}
            style={[
              s.input,
              s.p10,
              s.mt10,
              {
                color: colors.text,
                borderColor: themes.bg_900,
                fontFamily: fonts.regular.fontFamily,
              },
            ]}
          />
        </RnView>
      </RnView>
      <RnView
        style={[
          s.flex1,
          s.gap12,
          s.justifyFlexEnd,
          { marginTop: insets.bottom },
        ]}
      >
        <RnView
          style={[
            s.flexDirectionRow,
            s.w100pct,
            { justifyContent: "space-between" },
          ]}
        >
          <PressableScale
            style={[
              s.p16,
              s.borderRadius_sm,
              s.alignCenter,
              s.justifyCenter,
              { backgroundColor: themes.bg_900, width: "40%" },
            ]}
            onPress={() => {
              navigation.goBack();
            }}
          >
            <RnText
              style={[
                atoms.text_sm,
                s.textCenter,
                {
                  color: themes.gray_500,
                  fontFamily: fonts.medium.fontFamily,
                },
              ]}
            >
              Skip
            </RnText>
          </PressableScale>
          <PressableScale
            enabled={!isPending}
            style={[
              s.p16,
              s.borderRadius_sm,
              s.alignCenter,
              s.justifyCenter,
              {
                backgroundColor: isPending
                  ? themes.primary_900
                  : colors.primary,
                width: "40%",
              },
            ]}
            onPress={handleReviewSubmit}
          >
            <RnText
              style={[
                atoms.text_sm,
                s.textCenter,
                {
                  color: colors.text,
                  fontFamily: fonts.medium.fontFamily,
                },
              ]}
            >
              Review
            </RnText>
          </PressableScale>
        </RnView>
      </RnView>
    </KeyboardAwareScrollView>
  );
};
