import { useEvent, useHandler } from "react-native-reanimated";
import type { DragChangeEvent } from "@lodev09/react-native-true-sheet";

type DragChangeHandler = (sizeInfo: any, context: unknown) => void;

export const useDragChangeHandler = (
  handler: DragChangeHandler,
  dependencies: [],
) => {
  const handlers = {
    onDragChange: handler,
  };

  const { context, doDependenciesDiffer } = useHandler(handlers, dependencies);

  return useEvent<DragChangeEvent>(
    (event) => {
      "worklet";
      const { onDragChange } = handlers;
      if (onDragChange && event.eventName.endsWith("onDragChange")) {
        onDragChange(event, context);
      }
    },
    ["onDragChange"],
    doDependenciesDiffer,
  );
};
