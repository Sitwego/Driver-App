import { Canvas, Rect } from "@shopify/react-native-skia";
import { useEffect } from "react";
import {
  useSharedValue,
  withTiming,
  interpolateColor,
  useDerivedValue,
  runOnJS,
} from "react-native-reanimated";

import { width } from "~/utils/metrics/dimm";

const DEFAULT_BAR_WIDTH = width * 0.95;
const BAR_HEIGHT = 10;
const BORDER_WIDTH = 3;

const ProgressBarTimer = ({
  duration = 20,
  close,
  barWidth = DEFAULT_BAR_WIDTH,
}: {
  duration: number;
  close: () => void;
  /** Track width in px. Defaults to the original 95%-of-screen bar. */
  barWidth?: number;
}) => {
  const progress = useSharedValue(1);
  const animatedWidth = useSharedValue(barWidth - 3);

  // Derive color from animatedColor
  const color = useDerivedValue(() =>
    interpolateColor(progress.value, [1, 0], ["#0a85ff", "#0f1e24"]),
  );

  useEffect(() => {
    progress.value = withTiming(
      0,
      { duration: duration * 1000 },
      (finished) => {
        if (finished) {
          runOnJS(close)();
        }
      },
    );
    animatedWidth.value = withTiming(0, { duration: duration * 1000 });

    return () => {
      progress.value = 0;
      animatedWidth.value = 0;
    };
  }, [duration, close, progress, animatedWidth]);

  return (
    <Canvas
      style={{ width: barWidth, height: BAR_HEIGHT, alignSelf: "center" }}
    >
      <Rect
        x={2}
        y={2}
        width={animatedWidth}
        height={BORDER_WIDTH}
        color={color}
      />
    </Canvas>
  );
};

export default ProgressBarTimer;
