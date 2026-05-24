import { ActivityIndicator, FlatList, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { format, isSameDay, isSameMonth, isSameWeek, isToday } from "date-fns";
import { PressableScale } from "pressto";
import { useAppTheme } from "~/ui/theme/ThemeProvider";
import { RnView } from "../RnView";
import RnText from "../RnText";
import { useState, useMemo, useCallback, useRef, memo } from "react";
import type { ViewToken } from "react-native";
import { height, width } from "~/utils/metrics/dimm";
import {
  generateDateRanges,
  getWeeksForYear,
} from "~/utils/dates/generateDateRanges";
import { s } from "~/styles/Common-Styles";
import { atoms } from "~/ui/theme/atoms";
import { themes } from "~/ui/theme/theme_utils";
import { IncomeSevenDaysChart } from "./Charts";
import Icon from "../Icons";
import {
  useDriverDailyEarnings,
  useDriverWeeklyEarnings,
  type DailyEarningsRide,
} from "~/hooks/apis";
import { useNavigation } from "@react-navigation/native";
import type { RatingScreenNavigationProp } from "~/navigation/types";
import { LegendList } from "@legendapp/list";
import { formatTime } from "~/utils/dates/utils";
import { roundToOneDecimal } from "~/utils/metrics/numbers";

export type Timeframe = "daily" | "weekly";

const SCREEN_WIDTH = width;

const keyExtractor = (item: Date[]) => item[0].toISOString();

const getItemLayout = (_data: unknown, index: number) => ({
  length: SCREEN_WIDTH,
  offset: SCREEN_WIDTH * index,
  index,
});

const weeksOfYear = getWeeksForYear(new Date().getFullYear()).filter(
  ([start]) => start <= new Date(),
);

const weeks = generateDateRanges();

export default function EarningsHistory() {
  const { colors } = useAppTheme();
  useSafeAreaInsets();
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const { data, isLoading } = useDriverDailyEarnings(selectedDate);

  const totalRides: number = data?.summary?.total_rides ?? 0;
  const totalEarnings: number = data?.summary?.total_earnings ?? 0;
  const rides = data?.rides ?? [];

  // Compute today's week index once
  const todayWeekIndex = useMemo(
    () => weeks.findIndex((week) => week.some((day) => isToday(day))),
    [],
  );

  const [currentMonth, setCurrentMonth] = useState<string>(() => {
    const week = weeks[todayWeekIndex];
    return week?.[0] ? format(week[0], "MMMM ") : "";
  });

  // Handle scroll to update the month title
  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].item) {
        const visibleWeek = viewableItems[0].item as Date[];
        if (visibleWeek && visibleWeek[0]) {
          setCurrentMonth(format(visibleWeek[0], "MMMM "));
        }
      }
    },
    [],
  );

  const renderDay = useCallback(
    (day: Date) => {
      const isSelected = selectedDate && isSameDay(day, selectedDate);
      const isCurrentDay = isToday(day);

      return (
        <PressableScale
          key={day.toISOString()}
          style={[
            styles.dayContainer,
            isSelected && { backgroundColor: colors.primary },
            isCurrentDay &&
              !isSelected && {
                borderColor: colors.primary,
                borderWidth: 1,
              },
          ]}
          onPress={() => setSelectedDate(day)}
        >
          <RnText
            style={[
              styles.dayName,
              { color: isSelected ? colors.background : colors.text },
            ]}
          >
            {format(day, "EEE")}
          </RnText>
          <RnText
            style={[
              styles.dayNumber,
              { color: isSelected ? colors.background : colors.text },
            ]}
          >
            {format(day, "d")}
          </RnText>
        </PressableScale>
      );
    },
    [colors.background, colors.primary, colors.text, selectedDate],
  );

  const renderWeek = useCallback(
    ({ item: week }: { item: Date[] }) => {
      return (
        <RnView style={[styles.weekContainer, { width: SCREEN_WIDTH }]}>
          {week.map((day) => renderDay(day))}
        </RnView>
      );
    },
    [renderDay],
  );

  return (
    <RnView>
      <RnView style={[styles.header]}>
        <RnText style={[s.textCenter, atoms.text_sm]}>
          {currentMonth || "Earning History"}
        </RnText>
      </RnView>
      <FlatList
        data={weeks}
        renderItem={renderWeek}
        keyExtractor={keyExtractor}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        removeClippedSubviews
        snapToInterval={SCREEN_WIDTH}
        decelerationRate="fast"
        getItemLayout={getItemLayout}
        initialScrollIndex={todayWeekIndex !== -1 ? todayWeekIndex : undefined}
        initialNumToRender={1}
        windowSize={3}
        maxToRenderPerBatch={2}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
      />
      {isLoading ? (
        <ActivityIndicator
          size="small"
          color={colors.primary}
          style={{ marginVertical: 20 }}
        />
      ) : (
        <>
          <TotalFareLabel rides={totalRides} amount={totalEarnings} />
          <RnView
            style={{
              marginVertical: 20,
              width: "100%",
              borderTopColor: themes.bg_800,
              borderTopWidth: 1,
            }}
          />
          <RideHistoryList rides={rides} />
        </>
      )}
    </RnView>
  );
}

const renderRide = ({ item }: { item: DailyEarningsRide }) => (
  <RideHistoryItem ride={item} />
);

function RideHistoryListComponent({ rides }: { rides: DailyEarningsRide[] }) {
  return (
    <LegendList
      data={rides}
      renderItem={renderRide}
      keyExtractor={(item) => item.ride_id}
      showsVerticalScrollIndicator={false}
      estimatedItemSize={120}
      recycleItems
      maintainVisibleContentPosition
      ItemSeparatorComponent={() => <RnView style={{ height: 10 }} />}
      contentContainerStyle={{ paddingBottom: height * 0.75 }}
    />
  );
}

const RideHistoryList = memo(RideHistoryListComponent);

function RideHistoryItem({ ride }: { ride: DailyEarningsRide }) {
  const { colors, fonts } = useAppTheme();
  const navigation = useNavigation<RatingScreenNavigationProp>();

  const amount: number = ride?.amount ?? 0;
  const time = ride?.created_at
    ? format(new Date(ride.created_at), "hh:mm aa")
    : "—";
  const toLocation =
    ride?.to_ward && ride?.to_city ? `${ride.to_ward}, ${ride.to_city}` : "—";
  const distance = ride?.estimated_distance
    ? `${roundToOneDecimal(ride.estimated_distance)} Km`
    : null;
  const duration = ride?.estimated_duration
    ? formatTime(ride.estimated_duration)
    : null;
  const distanceLabel =
    [distance, duration].filter(Boolean).join(" · ") || null;

  return (
    <PressableScale
      style={[
        s.px14,
        s.py14,
        s.borderRadius_sm,
        {
          marginHorizontal: 16,
          backgroundColor: themes.bg_900,
          borderWidth: 1,
          borderColor: themes.bg_800,
        },
      ]}
    >
      {/* Top row: icon + amount + time + chevron */}
      <RnView style={[s.flexDirectionRow, s.alignCenter, s.gap12]}>
        <RnView
          style={[
            s.alignCenter,
            s.justifyCenter,
            {
              width: 44,
              height: 44,
              borderRadius: 12,
              backgroundColor: themes.primary_950,
            },
          ]}
        >
          <Icon
            name="HandCoins"
            size={22}
            strokeWidth={1.8}
            color={themes.primary_300}
          />
        </RnView>

        <RnView style={[s.flex1]}>
          <RnView style={[s.flexDirectionRow, s.justifyBetween, s.alignCenter]}>
            <RnText
              style={[atoms.text_md, { fontFamily: fonts.heavy.fontFamily }]}
            >
              KES {amount.toFixed(2)}
            </RnText>
            <RnText
              style={[
                atoms.text_2xs,
                {
                  color: colors.lightGray,
                  fontFamily: fonts.medium.fontFamily,
                },
              ]}
            >
              {time}
            </RnText>
          </RnView>
          <RnText
            style={[atoms.text_xs, { color: colors.lightGray, marginTop: 2 }]}
            numberOfLines={2}
          >
            {toLocation}
          </RnText>
        </RnView>

        <Icon
          name="ChevronRight"
          size={18}
          strokeWidth={2}
          color={colors.lightGray}
        />
      </RnView>

      {/* Divider */}
      <RnView
        style={{
          height: 1,
          backgroundColor: themes.bg_800,
          marginTop: 12,
          marginBottom: 10,
        }}
      />

      {/* Bottom row: distance info + review pill */}
      <RnView style={[s.flexDirectionRow, s.justifyBetween, s.alignCenter]}>
        <RnView style={[s.flexDirectionRow, s.alignCenter, s.gap6]}>
          <Icon
            name="MapPin"
            size={13}
            strokeWidth={2}
            color={colors.lightGray}
          />
          <RnText
            style={[
              atoms.text_2xs,
              { color: colors.lightGray, fontFamily: fonts.medium.fontFamily },
            ]}
          >
            {distanceLabel}
          </RnText>
        </RnView>

        {!ride.has_rated_customer && (
          <PressableScale
            onPress={() =>
              navigation.navigate("RatingScreen", { rideId: ride.ride_id })
            }
            style={[
              s.px10,
              s.py4,
              s.borderRadius_full,
              {
                backgroundColor: themes.green_950,
                borderWidth: 1,
                borderColor: themes.green_800,
              },
            ]}
          >
            <RnText
              style={[
                atoms.text_2xs,
                { color: themes.green_300, fontFamily: fonts.bold.fontFamily },
              ]}
            >
              Leave a Review
            </RnText>
          </PressableScale>
        )}
      </RnView>
    </PressableScale>
  );
}

const TotalFareLabel = ({
  rides,
  amount,
}: {
  rides: number;
  amount: number;
}) => {
  const { fonts } = useAppTheme();
  return (
    <RnView
      style={[
        s.alignSelf,
        s.justifyCenter,
        s.alignCenter,
        s.flexCol,
        s.gap4,
        s.mt10,
      ]}
    >
      <RnText style={[atoms.text_xs]}>Total Fare ({rides} rides)</RnText>
      <RnText style={[atoms.text_xl, { fontFamily: fonts.heavy.fontFamily }]}>
        KES {amount.toFixed(2)}
      </RnText>
    </RnView>
  );
};

const CHIP_WIDTH = 90;
const CHIP_GAP = 8;

const weekGroupKeyExtractor = (item: Date[]) => item[0].toISOString();

const getWeekChipLayout = (_data: unknown, index: number) => ({
  length: CHIP_WIDTH + CHIP_GAP,
  offset: (CHIP_WIDTH + CHIP_GAP) * index,
  index,
});

export function WeekGroup({
  onWeekSelect,
}: {
  onWeekSelect?: (start: Date, end: Date) => void;
}) {
  const { colors, fonts } = useAppTheme();
  const flatListRef = useRef<FlatList<Date[]>>(null);

  const currentWeekIndex = useMemo(
    () =>
      weeksOfYear.findIndex(([start]) =>
        isSameWeek(new Date(), start, { weekStartsOn: 1 }),
      ),
    [],
  );

  const initialWeekStart =
    weeksOfYear[currentWeekIndex !== -1 ? currentWeekIndex : 0]?.[0] ?? null;
  const [selectedWeekStart, setSelectedWeekStart] = useState<Date | null>(
    initialWeekStart,
  );

  const { data, isLoading } = useDriverWeeklyEarnings(selectedWeekStart);

  const [selectedIndex, setSelectedIndex] = useState<number>(
    currentWeekIndex !== -1 ? currentWeekIndex : 0,
  );

  console.log("data", data, "selectedWeekStart", selectedWeekStart);

  const onFlatListLayout = useCallback(() => {
    if (currentWeekIndex !== -1) {
      flatListRef.current?.scrollToIndex({
        index: currentWeekIndex,
        animated: false,
        viewPosition: 1,
      });
    }
  }, [currentWeekIndex]);

  const handleChipPress = useCallback(
    (index: number, start: Date, end: Date) => {
      setSelectedIndex(index);
      setSelectedWeekStart(start);
      flatListRef.current?.scrollToIndex({
        index,
        animated: true,
        viewPosition: 1,
      });
      onWeekSelect?.(start, end);
    },
    [onWeekSelect],
  );

  const weekChip = useCallback(
    ({ item, index }: { item: Date[]; index: number }) => {
      const [start, end] = item;
      const isSelected = index === selectedIndex;
      const sameMonth = isSameMonth(start, end);
      const monthLabel = sameMonth
        ? format(start, "MMM")
        : `${format(start, "MMM")} ~ ${format(end, "MMM")}`;
      const dateLabel = `${format(start, "d")} - ${format(end, "d")}`;
      return (
        <PressableScale
          onPress={() => handleChipPress(index, start, end)}
          style={[
            s.py6,
            s.px14,
            s.alignCenter,
            s.justifyCenter,
            s.flexCol,
            s.borderRadius_full,
            {
              backgroundColor: isSelected ? colors.primary : themes.bg_900,
              width: CHIP_WIDTH,
            },
          ]}
        >
          <RnText
            style={[
              atoms.text_xs,
              { fontFamily: fonts.heavy.fontFamily },
              isSelected && { color: colors.background },
            ]}
          >
            {monthLabel}
          </RnText>
          <RnText
            style={[atoms.text_2xs, isSelected && { color: colors.background }]}
          >
            {dateLabel}
          </RnText>
        </PressableScale>
      );
    },
    [
      fonts.heavy.fontFamily,
      colors.primary,
      colors.background,
      selectedIndex,
      handleChipPress,
    ],
  );

  return (
    <RnView>
      <FlatList
        ref={flatListRef}
        data={weeksOfYear}
        horizontal
        renderItem={weekChip}
        keyExtractor={weekGroupKeyExtractor}
        getItemLayout={getWeekChipLayout}
        onLayout={onFlatListLayout}
        showsHorizontalScrollIndicator={false}
        removeClippedSubviews
        decelerationRate="fast"
        snapToInterval={CHIP_WIDTH + CHIP_GAP}
        snapToAlignment="start"
        contentContainerStyle={[s.px10, s.py5, s.gap8]}
        initialNumToRender={8}
        windowSize={5}
        maxToRenderPerBatch={10}
      />
      {isLoading ? (
        <ActivityIndicator
          size="small"
          color={colors.primary}
          style={{ marginVertical: 20 }}
        />
      ) : (
        <>
          <TotalFareLabel
            rides={data?.total_rides ?? 0}
            amount={data?.total_earnings ?? 0}
          />
          <IncomeSevenDaysChart data={data?.chart_data ?? []} />
        </>
      )}
    </RnView>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
  },
  weekContainer: {
    flexDirection: "row",
    justifyContent: "space-evenly",
    alignItems: "center",
    paddingRight: 8,
    paddingLeft: 0,
  },
  dayContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderRadius: 8,
    backgroundColor: "transparent",
    flex: 1,
  },
  dayName: {
    fontSize: 12,
    marginBottom: 4,
  },
  dayNumber: {
    fontSize: 16,
    fontWeight: "600",
  },
});
