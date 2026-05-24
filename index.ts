import "react-native-url-polyfill/auto";
import messaging from "@react-native-firebase/messaging";
import { registerRootComponent } from "expo";
import React, { useRef } from "react";
import { Platform } from "react-native";
import BackgroundTimer from "react-native-background-timer";

import App from "~/App";

// import {
//   configureReanimatedLogger,
//   ReanimatedLogLevel,
// } from "react-native-reanimated";

// configureReanimatedLogger({
//   level: ReanimatedLogLevel.warn,
//   // strict: false,
// });

// Must be registered synchronously at the module root, before registerRootComponent.
// Called when a FCM notification arrives while the app is in background or killed.
// Background notifications with a `notification` payload are auto-displayed by the
// OS using the server-supplied channel_id. Add processing here only for silent
// data-only messages that need background work (e.g. pre-fetching ride data).
messaging().setBackgroundMessageHandler(async (_remoteMessage) => {});
declare const global: any;

function setUpGloabals() {
  // Let timers run while Android app is in the background.
  if (Platform.OS === "android") {
    global.clearTimeout = BackgroundTimer.clearTimeout.bind(BackgroundTimer);
    global.clearInterval = BackgroundTimer.clearInterval.bind(BackgroundTimer);
    global.setInterval = BackgroundTimer.setInterval.bind(BackgroundTimer);
    global.setTimeout = (fn: () => void, ms = 0) =>
      BackgroundTimer.setTimeout(fn, ms);
  }
}
// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
setUpGloabals();
registerRootComponent(App);
