import React from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "~/ui/theme/ThemeProvider";
import { themes } from "~/ui/theme/theme_utils";
import { atoms } from "~/ui/theme/atoms";
import { s } from "~/styles/Common-Styles";
import RnText from "./RnText";
import { ReviewCard } from "./ReviewCard";
import { PressableScale } from "pressto";
import Icon from "./Icons";

export type DriverReview = {
  id: string;
  riderName: string;
  rating: 1 | 2 | 3 | 4 | 5;
  comment: string;
  date: string;
};

export type RatingSummaryData = {
  average: number;
  totalReviews: number;
  recommendPercent: number;
  breakdown: {
    stars: 1 | 2 | 3 | 4 | 5;
    percent: number;
  }[];
  recentReviews: DriverReview[];
};

type Props = {
  data: RatingSummaryData;
  onShowMore?: () => void;
};

function StarIcon({ filled, size = 18 }: { filled: boolean; size?: number }) {
  const { colors } = useAppTheme();
  return (
    <RnText
      style={{
        fontSize: size,
        color: filled ? colors.primary : themes.gray_200,
      }}
    >
      ★
    </RnText>
  );
}

function StarRow({ count, rating }: { count: number; rating: number }) {
  return (
    <View style={[s.flexDirectionRow, { gap: 2 }]}>
      {Array.from({ length: 5 }).map((_, i) => (
        <StarIcon key={i} filled={i < rating} size={count} />
      ))}
    </View>
  );
}

function RatingBar({
  stars,
  percent,
}: {
  stars: 1 | 2 | 3 | 4 | 5;
  percent: number;
}) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.barRow}>
      <View style={[s.flexDirectionRow, { gap: 3, width: 36 }]}>
        <RnText style={[atoms.text_sm, { color: themes.gray_500 }]}>
          {stars}
        </RnText>
        <StarIcon filled size={14} />
      </View>
      <View style={styles.trackContainer}>
        <View style={[styles.track, { backgroundColor: themes.gray_100 }]}>
          <View
            style={[
              styles.fill,
              {
                width: `${percent}%`,
                backgroundColor: colors.primary,
              },
            ]}
          />
        </View>
      </View>
      <RnText
        style={[atoms.text_sm, styles.percentLabel, { color: themes.gray_500 }]}
      >
        {percent}%
      </RnText>
    </View>
  );
}

export function RatingSummary({ data, onShowMore }: Props) {
  const { colors, fonts } = useAppTheme();
  const insets = useSafeAreaInsets();
  const sortedBreakdown = [...data.breakdown].sort((a, b) => b.stars - a.stars);

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={[s.px16, { paddingBottom: insets.bottom + 120 }]}
    >
      <RnText
        style={[
          atoms.text_xl,
          s.textCenter,
          s.mb20,
          { fontFamily: fonts.heavy.fontFamily, color: colors.text },
        ]}
      >
        Customer Ratings
      </RnText>

      <View
        style={[
          styles.card,
          { backgroundColor: themes.bg_950, borderColor: themes.bg_800 },
        ]}
      >
        {/* Average score */}
        <View style={[s.alignCenter, s.gap8, s.mb20]}>
          <RnText
            style={{
              fontSize: 64,
              fontFamily: fonts.heavy.fontFamily,
              color: colors.text,
              lineHeight: 72,
            }}
          >
            {data.average.toFixed(1)}
          </RnText>
          <StarRow count={22} rating={Math.round(data.average)} />
          <RnText style={[atoms.text_sm, { color: themes.gray_500 }]}>
            {data.totalReviews.toLocaleString()} reviews
          </RnText>
        </View>

        {/* Breakdown bars */}
        <View style={s.gap12}>
          {sortedBreakdown.map((item) => (
            <RatingBar
              key={item.stars}
              stars={item.stars}
              percent={item.percent}
            />
          ))}
        </View>

        {/* Footer stats */}
        <View style={[styles.footer, { borderTopColor: themes.gray_100 }]}>
          <View style={[s.flexDirectionRow, s.gap8]}>
            <Icon
              name="ThumbsUp"
              size={20}
              strokeWidth={2}
              color={colors.primary}
            />
            <View>
              <RnText
                style={[
                  atoms.text_md,
                  { fontFamily: fonts.heavy.fontFamily, color: colors.text },
                ]}
              >
                {data.recommendPercent}%
              </RnText>
              <RnText style={[atoms.text_xs, { color: themes.gray_500 }]}>
                Recommend
              </RnText>
            </View>
          </View>

          <View style={[s.flexDirectionRow, s.gap8]}>
            <Icon
              name="Users"
              size={20}
              strokeWidth={2}
              color={colors.lightGray}
            />
            <View>
              <RnText
                style={[
                  atoms.text_md,
                  { fontFamily: fonts.heavy.fontFamily, color: colors.text },
                ]}
              >
                {data.totalReviews.toLocaleString()}
              </RnText>
              <RnText style={[atoms.text_xs, { color: themes.gray_500 }]}>
                Reviewers
              </RnText>
            </View>
          </View>
        </View>
      </View>

      {/* Recent reviews */}
      {data.recentReviews.length > 0 && (
        <View style={s.mt20}>
          <View style={[s.flexDirectionRow, s.justifyBetween, s.mb10]}>
            <RnText
              style={[
                atoms.text_md,
                { fontFamily: fonts.heavy.fontFamily, color: colors.text },
              ]}
            >
              Recent Reviews
            </RnText>
          </View>

          <View style={s.gap12}>
            {data.recentReviews.map((review) => (
              <ReviewCard key={review.id} review={review} />
            ))}
          </View>

          {onShowMore && (
            <PressableScale onPress={onShowMore} style={[styles.showMoreBtn]}>
              <RnText
                style={[
                  atoms.text_md,
                  {
                    color: colors.primary,
                    fontFamily: fonts.heavy.fontFamily,
                  },
                ]}
              >
                Show all reviews
              </RnText>
            </PressableScale>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
  },
  barRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  trackContainer: {
    flex: 1,
  },
  track: {
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: 4,
  },
  percentLabel: {
    width: 36,
    textAlign: "right",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 24,
    paddingTop: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  showMoreBtn: {
    marginTop: 12,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
  },
});
