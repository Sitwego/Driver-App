import { StyleSheet, View } from "react-native";
import { BarChart } from "react-native-gifted-charts";
import { useAppTheme } from "~/ui/theme/ThemeProvider";
import { fontFamily, fontSize, space } from "~/ui/theme/tokens";
import { RnView } from "../RnView";
import { useMemo } from "react";
import { themes } from "~/ui/theme/theme_utils";

export interface ChartDataItem {
  value: number;
  label: string;
  frontColor?: string;
}

export function IncomeSevenDaysChart(props: { data: ChartDataItem[] }) {
  const { colors, fonts } = useAppTheme();

  const labelStyle = {
    color: colors.text,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
  };

  const data = props.data;
  return (
    <RnView style={{ paddingVertical: space.lg }}>
      <BarChart
        noOfSections={5}
        barBorderRadius={20}
        frontColor={themes.bg_700}
        data={data}
        width={300}
        height={200}
        barWidth={30}
        spacing={10}
        yAxisThickness={0}
        xAxisThickness={0}
        xAxisLabelTextStyle={labelStyle}
        yAxisTextStyle={labelStyle}
        showValuesAsTopLabel
        topLabelTextStyle={[labelStyle, styles.barTopLable]}
      />
    </RnView>
  );
}

const styles = StyleSheet.create({
  barTopLable: {
    color: themes.green_500,
    fontFamily: "FiraCode-SemiBold",
    lineHeight: 16,
  },
});
