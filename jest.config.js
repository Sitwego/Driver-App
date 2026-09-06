// Jest runs only pure-TS modules (src/tracking, the AppBottomSheet
// registry) in plain Node. The inline babel config (configFile: false)
// deliberately skips babel.config.js — babel-preset-expo and the
// reanimated plugin are bundler concerns; tested modules have zero
// react-native imports.
module.exports = {
  testEnvironment: "node",
  roots: [
    "<rootDir>/src/tracking",
    "<rootDir>/src/components/AppBottomSheet",
    "<rootDir>/src/utils",
    "<rootDir>/src/lib",
  ],
  transform: {
    "^.+\\.[jt]sx?$": [
      "babel-jest",
      {
        configFile: false,
        babelrc: false,
        presets: [
          ["@babel/preset-env", { targets: { node: "current" } }],
          "@babel/preset-typescript",
        ],
      },
    ],
  },
};
