import { RnView } from "~/components/RnView";
import { useAppTheme } from "../theme/ThemeProvider";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { s } from "~/styles/Common-Styles";
import EarningsHistory from "~/components/JobHistory";
import { useMemo, useState } from "react";
import { generateDateRanges } from "~/utils/dates/generateDateRanges";
import { Timeframe, WeekGroup } from "~/components/JobHistory/EarningsHistory";
import { themes } from "../theme/theme_utils";
import RnText from "~/components/RnText";
import SegmentedControl from "@react-native-segmented-control/segmented-control";
import { atoms } from "../theme/atoms";

export function JobHistory() {
  const { colors, fonts } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [timeFrameState, setTimeFrameState] = useState<Timeframe>("daily");
  return (
    <RnView style={[s.flexBox, { top: insets.top }]}>
      <RnView style={[s.mb20, s.py10, s.px10]}>
        <RnView style={[s.mb20, s.ml20]}>
          <RnText
            style={[atoms.text_xl, { fontFamily: fonts.heavy.fontFamily }]}
          >
            Earnings History
          </RnText>
        </RnView>
        <SegmentedControl
          values={["Daily", "Weekly"]}
          tintColor={themes.green_500}
          fontStyle={{
            fontFamily: fonts.heavy.fontFamily,
            color: colors.text,
            fontSize: 16,
          }}
          activeFontStyle={{
            fontFamily: fonts.heavy.fontFamily,
            color: colors.text,
            fontWeight: "900",
            fontSize: 20,
          }}
          style={[
            { height: 40, borderWidth: 1, borderColor: themes.bg_900 },
            s.borderRadius_full,
          ]}
          //@ts-ignore
          sliderStyle={[s.borderRadius_full]}
          backgroundColor={colors.background}
          selectedIndex={["daily", "weekly"].indexOf(timeFrameState)}
          onChange={(event) => {
            const index = event.nativeEvent.selectedSegmentIndex;
            setTimeFrameState(["daily", "weekly"][index] as Timeframe);
          }}
        />
      </RnView>
      {timeFrameState === "daily" && <EarningsHistory />}
      {timeFrameState === "weekly" && <WeekGroup />}
    </RnView>
  );
}
