import React from "react";
import { StyleSheet, View } from "react-native";
import { useAppTheme } from "~/ui/theme/ThemeProvider";
import { themes } from "~/ui/theme/theme_utils";
import { atoms } from "~/ui/theme/atoms";
import RnText from "./RnText";
import type { DriverReview } from "./RatingSummary";
import { InitialsAvatar } from "./Avatar";

export function ReviewCard({ review }: { review: DriverReview }) {
  const { colors, fonts } = useAppTheme();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: themes.bg_950, borderColor: themes.bg_800 },
      ]}
    >
      {/* Header row: avatar + name + date */}
      <View style={styles.header}>
        <InitialsAvatar rounded={18} size={36} name={review.riderName} />
        <View style={styles.headerText}>
          <RnText
            style={[
              atoms.text_sm,
              { fontFamily: fonts.heavy.fontFamily, color: colors.text },
            ]}
          >
            {review.riderName}
          </RnText>
          <RnText style={[atoms.text_2xs, { color: themes.gray_500 }]}>
            {review.date}
          </RnText>
        </View>
      </View>

      {/* Rating row: stars + numeric value */}
      <View style={styles.ratingRow}>
        <View style={styles.stars}>
          {Array.from({ length: 5 }).map((_, i) => (
            <RnText
              key={i}
              style={{
                fontSize: 13,
                color: i < review.rating ? colors.primary : themes.gray_200,
              }}
            >
              ★
            </RnText>
          ))}
        </View>
        <RnText
          style={[
            atoms.text_xs,
            {
              color: themes.gray_500,
              fontFamily: fonts.heavy.fontFamily,
            },
          ]}
        >
          {review.rating}.0
        </RnText>
      </View>

      {/* Review text */}
      {!!review.comment && (
        <RnText
          style={[
            atoms.text_sm,
            { color: themes.gray_400, lineHeight: 20, marginTop: 6 },
          ]}
          numberOfLines={4}
        >
          {review.comment}
        </RnText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    gap: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  stars: {
    flexDirection: "row",
    gap: 2,
  },
});
