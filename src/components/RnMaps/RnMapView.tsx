import React from "react";
import MapView, { PROVIDER_GOOGLE } from "react-native-maps";
import { AnimatedMapView } from "react-native-maps/src/MapView";
import { map_style } from "./RnMapStyles";
import { customStyle } from "./map_custom_style";

export type RnMapViewProps = React.ComponentProps<typeof MapView> & {
  children?: React.ReactNode;
};
const RnMapView = React.forwardRef<MapView, RnMapViewProps>((props, ref) => {
  return (
    <AnimatedMapView
      provider={PROVIDER_GOOGLE}
      customMapStyle={customStyle}
      style={[map_style.map]}
      {...props}
      // @ts-ignore - react-native-maps types are outdated and don't include ref forwarding
      ref={ref}
    >
      {props.children}
    </AnimatedMapView>
  );
});
RnMapView.displayName = "RnMapView";
export default RnMapView;
