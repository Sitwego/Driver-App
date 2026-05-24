import { useEffect } from "react";
import {
  useSharedValue,
  withTiming,
  interpolateColor,
  useDerivedValue,
  runOnJS,
} from "react-native-reanimated";
import { Canvas, Rect } from "@shopify/react-native-skia";
import { width } from "~/utils/metrics/dimm";

const BAR_WIDTH = width * 0.95;
const BAR_HEIGHT = 10;
const BORDER_WIDTH = 3;

const ProgressBarTimer = ({
  duration = 20,
  close,
}: {
  duration: number;
  close: () => void;
}) => {
  const progress = useSharedValue(1);
  const animatedWidth = useSharedValue(BAR_WIDTH - 3);

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
      style={{ width: BAR_WIDTH, height: BAR_HEIGHT, alignSelf: "center" }}
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
