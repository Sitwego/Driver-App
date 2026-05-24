import { Image } from "expo-image";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { DeviceEventEmitter, StyleSheet, View } from "react-native";
import MapView, {
  Camera,
  Marker,
  UserLocationChangeEvent,
} from "react-native-maps";
import { useAnimatedReaction, runOnJS } from "react-native-reanimated";

import { useSheetAnimation } from "~/components/RnBottomSheet/BottomSheetProvider";
import EtaBadge from "~/components/RnMaps/EtaBadge";
import MapCarIcon from "~/components/RnMaps/MapMarker/MapCarIcon";
import { RnMapPolyline } from "~/components/RnMaps/MapPolyline/Polyline";
import MapToolbar from "~/components/RnMaps/MapToolbar";
import RnMapView from "~/components/RnMaps/RnMapView";
import { useDriverLocation } from "~/lib/Providers/DriverLocationProvider";
import { useRideRequest } from "~/lib/Providers/UseRideRequestProvider";
import { RideNotificationType } from "~/types/rideRequstTypes";
import HomeMenuBar from "~/ui/Views/HomeMenuBar";
import { themes } from "~/ui/theme/theme_utils";
import { GpsData, calcDynamicPitch } from "~/utils/geo";
import { height as screenHeight } from "~/utils/metrics/dimm";

const TARGET_SCREEN_PERCENTAGE = 0.951;
const LATITUDE_DELTA = 0.159999; // Adjust for desired zoom level (city-level zoom)
const DEFAULT_ZOOM = 16;

// Module-level camera cache — survives component remounts
// let _cachedCamera: Camera | null = null;

const MapScreenComponent = (props: any) => {
  const mapRef = useRef<MapView>(null);
  const [onMapReady, setOnMapReady] = useState<boolean>(false);
  const { currentDriverLocation: currentDriverLoaction, latestGeoKalman } =
    useDriverLocation();
  const initialCamera: Camera = {
    zoom: DEFAULT_ZOOM,
    center: { latitude: 0, longitude: 0 },
    heading: -10,
    pitch: 5,
  };

  const { rideState } = useRideRequest();
  const { animatedIndex } = useSheetAnimation();

  // Tracks how many latitude degrees we've shifted the camera to compensate
  // for the sheet covering the bottom portion of the map.  We store the raw
  // offset (positive = shifted south) so we can exactly reverse it when the
  // sheet dismisses without compounding drift over multiple open/close cycles.
  const sheetOffsetRef = useRef(0);

  // Called on the JS thread whenever the sheet snaps to a new detent index.
  //   detent  -1  → sheet fully dismissed → restore camera
  //   detent   0  → first snap (~45 % height) → shift camera so content stays above sheet
  //   detent   1  → fully expanded → shift camera for full-screen sheet
  const adjustCameraForDetent = useCallback(
    async (detent: number) => {
      if (!onMapReady) return;
      let cam: Camera | undefined;
      try {
        cam = await mapRef.current?.getCamera();
      } catch {}
      if (!cam) return;

      // Strip the previously applied offset to get the "true" centre latitude.
      const trueLatitude = cam.center.latitude + sheetOffsetRef.current;

      if (detent >= 0) {
        // How many degrees of latitude fit in one screen-pixel at the current zoom.
        // Standard Web-Mercator tile: 256 px × 2^zoom tiles cover 360°.
        const zoom = cam.zoom ?? DEFAULT_ZOOM;
        const latDegPerPx = 360 / (256 * Math.pow(2, zoom));

        // Fraction of screen height hidden behind the sheet.
        //   detent 0 → ~50 % (first snap = 0.45 detent value, close enough)
        //   detent 1 → ~100 % (full screen — rare but handled)
        const sheetFraction = detent === 0 ? 0.45 : 0.95;

        // Pixels obscured by the sheet.  We shift the camera up by half that
        // amount so the mid-point of the visible area stays centred on the poi.
        const obscuredPx = screenHeight * sheetFraction;

        // A negative degree offset moves the camera north (up on screen),
        // which pushes the content down into the visible window above the sheet.
        const newOffset = latDegPerPx * (obscuredPx / 2);
        sheetOffsetRef.current = newOffset;

        mapRef.current?.animateCamera(
          { center: { ...cam.center, latitude: trueLatitude - newOffset } },
          { duration: 1000 },
        );
      } else {
        // Sheet dismissed — restore the original centre latitude exactly.
        sheetOffsetRef.current = 0;
        mapRef.current?.animateCamera(
          { center: { ...cam.center, latitude: trueLatitude } },
          { duration: 1000 },
        );
      }
    },
    [onMapReady],
  );

  // Watch the sheet's detent index on the UI thread and call the camera
  // adjuster on the JS thread whenever it snaps to a new integer position.
  // Math.round() converts the continuously-animated float (e.g. 0.73) to the
  // nearest detent index so we only fire once per snap, not on every frame.
  useAnimatedReaction(
    () => Math.round(animatedIndex.value),
    (current, previous) => {
      if (current !== previous) {
        runOnJS(adjustCameraForDetent)(current);
      }
    },
  );

  const ride = useMemo(() => {
    return (rideState as { ride: RideNotificationType })?.ride;
  }, [rideState]);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener("onRideComplete", () => {
      console.log("CAN SHOW RATING MODAL?.");
    });

    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (ride?.data && ride.data.ride_line_str) {
      const latitudeOffset = calculateLatOffset(
        ride?.data?.ride_line_str[0].latitude,
      );
      mapRef.current?.animateCamera(
        {
          center: {
            latitude: latitudeOffset,
            longitude: ride?.data?.ride_line_str[0].longitude,
          },
          heading: 0,
          pitch: 0,
          zoom: 16,
        },
        { duration: 1000 },
      );
    }
  }, [ride, onMapReady]);

  const _onMapLoaded = useCallback(() => {
    console.log("Map Loaded");
    setOnMapReady(true);
  }, []);

  const _onMapReady = useCallback(() => {
    console.log("Map Ready");
  }, []);

  useEffect(() => {
    if (!latestGeoKalman) return;
    const { latitude, longitude } = latestGeoKalman;
    (async () => {
      const cam = await mapRef.current?.getCamera();
      const zoom = cam?.zoom ?? DEFAULT_ZOOM;
      mapRef.current?.animateCamera(
        {
          center: { latitude, longitude },
          zoom,
          pitch: calcDynamicPitch(zoom),
        },
        { duration: 1500 },
      );
    })();
  }, [latestGeoKalman]);

  const _onRegionChangeComplete = useCallback(async () => {
    if (!onMapReady) return;
    try {
      // if (cam) _cachedCamera = cam;
      await mapRef.current?.getCamera();
    } catch {}
  }, [onMapReady]);

  const onUserLoactionChange = useCallback(
    (e: UserLocationChangeEvent) => {
      if (ride?.data) return;
      mapRef.current?.animateCamera(
        {
          center: {
            latitude: e.nativeEvent.coordinate?.latitude ?? 0,
            longitude: e.nativeEvent.coordinate?.longitude ?? 0,
          },
          zoom: DEFAULT_ZOOM,
          pitch: 5,
        },
        { duration: 1000 },
      );
    },
    [ride?.data],
  );

  const _onProfilePress = useCallback(() => {
    props.navigation.push("AccountMenuScreen", {
      driver_id: "12345",
    });
  }, [props.navigation]);

  const polyline = useMemo(() => {
    return (
      <RnMapPolyline
        key="ride_line"
        geodesic={true}
        strokeColor={themes.primary_500}
        fillColor={themes.primary_500}
        coordinates={ride?.data?.ride_line_str || []}
        lineCap="round"
        lineJoin="round"
        strokeWidth={6}
      />
    );
  }, [ride?.data?.ride_line_str]);
  const driver_to_pickup = useMemo(() => {
    return (
      <RnMapPolyline
        key="driver_to_pickup"
        geodesic={true}
        strokeColor={themes.green_500}
        fillColor={themes.green_500}
        coordinates={ride?.data?.driver_to_pickup_line_str || []}
        lineCap="round"
        lineJoin="round"
        strokeWidth={6}
      />
    );
  }, [ride?.data?.driver_to_pickup_line_str]);

  const map_car_icon = useMemo(() => {
    if (!currentDriverLoaction) {
      return null;
    }
    return (
      <MapCarIcon
        geo_point={[currentDriverLoaction as GpsData]}
        polylinePoints={ride?.data?.ride_line_str ?? undefined}
      />
    );
  }, [currentDriverLoaction, ride?.data?.ride_line_str]);

  const ic_marker_user = useMemo(() => {
    if (!ride?.data) return null;
    return (
      <Marker
        anchor={{ x: 0.5, y: 0.5 }}
        coordinate={{ ...ride?.data?.from.geo_point }}
      >
        <Image
          style={{
            height: 32,
            width: 28,
          }}
          source={require("../../assets/images/ic_marker_user.png")}
          contentFit="contain"
        />
      </Marker>
    );
  }, [ride?.data]);

  const ic_marker_stop = useMemo(() => {
    if (!ride?.data) return null;
    return (
      <Marker
        anchor={{ x: 0.5, y: 0.5 }}
        coordinate={{ ...ride?.data?.to.geo_point }}
      >
        <Image
          style={{
            height: 36,
            width: 32,
          }}
          source={require("../../assets/images/stop.png")}
          contentFit="contain"
        />
      </Marker>
    );
  }, [ride?.data]);
  return (
    <View style={styles.container}>
      <HomeMenuBar navigation={props.navigation} onPress={_onProfilePress} />
      <RnMapView
        initialCamera={initialCamera}
        onMapReady={_onMapReady}
        onMapLoaded={_onMapLoaded}
        ref={mapRef}
        zoomEnabled
        showsUserLocation={true}
        onUserLocationChange={onUserLoactionChange}
        pitchEnabled
        userLocationPriority="high"
        showsCompass={false}
        showsMyLocationButton={false}
        onRegionChangeComplete={_onRegionChangeComplete}
      >
        {polyline}
        {driver_to_pickup}
        {map_car_icon}
        {ic_marker_user}
        {ic_marker_stop}
      </RnMapView>
      <MapToolbar
        //@ts-ignore
        mapRef={mapRef}
        currentLocation={currentDriverLoaction}
      />
      <EtaBadge />
    </View>
  );
};

export const MapScreen = React.memo(MapScreenComponent);

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

const calculateLatOffset = (latitude: number) => {
  // Offset the center latitude to position the region at the top
  // Subtract the offset to move the center upward
  const latitudeOffset = (LATITUDE_DELTA * (1 - TARGET_SCREEN_PERCENTAGE)) / 2;
  return latitude - latitudeOffset;
};
