const { version } = require('./package.json');

/** @type {import('expo/config').ExpoConfig} */
module.exports = {
  expo: {
    name: 'mobility-captain',
    slug: 'mobility-captain',
    version,
    runtimeVersion: version,
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'dark',
    assets: ['./assets/images'],
    splash: {
      image: './assets/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#ffffff',
    },
    plugins: [
      'expo-build-properties',
      'expo-status-bar',
      [
        'react-native-edge-to-edge',
        {
          android: {
            parentTheme: 'Material3',
            enforceNavigationBarContrast: false,
          },
        },
      ],
      'expo-asset',
      '@react-native-firebase/app',
      '@react-native-firebase/auth',
      [
        'react-native-maps',
        {
          androidGoogleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY,
        },
      ],
      [
        'expo-location',
        {
          isAndroidBackgroundLocationEnabled: true,
          isAndroidForegroundServiceEnabled: true,
          androidForegroundService: {
            notificationTitle: 'Sitwego Captain',
            notificationBody: 'Tracking your location in the background',
          },
        },
      ],
      'expo-image',
    ],
    ios: {
      supportsTablet: true,
    },
    android: {
      package: 'com.transli.mobilitycaptain',
      googleServicesFile: './google-services.json',
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#ffffff',
      },
      permissions: [
        'android.permission.ACCESS_COARSE_LOCATION',
        'android.permission.ACCESS_FINE_LOCATION',
        'android.permission.ACCESS_BACKGROUND_LOCATION',
        'android.permission.FOREGROUND_SERVICE',
        'android.permission.FOREGROUND_SERVICE_LOCATION',
      ],
    },
    web: {
      favicon: './assets/favicon.png',
    },
    experiments: {
      reactCompiler: true,
    },
    updates: {
      url: 'https://u.expo.dev/2cd39ba1-79f2-474f-a763-42ac1c2ce7b8',
    },
    extra: {
      eas: {
        projectId: '2cd39ba1-79f2-474f-a763-42ac1c2ce7b8',
      },
    },
    owner: 'transli',
  },
};
