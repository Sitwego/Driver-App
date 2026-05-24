module.exports = {
  // presets: ["module:@react-native/babel-preset"],
  presets: ["babel-preset-expo"],
  plugins: [
    "macros",
    [
      "module-resolver",
      {
        root: ["./src"],
        extensions: [".js", ".ts", ".jsx", ".tsx", ".json"],
        alias: {
          // This needs to be mirrored in tsconfig.json
          // rm -rf node_modules && yarn/npm i && watchman watch-del-all
          "~": "./src",
          lib: "./src/lib",
        },
      },
    ],
    "react-native-reanimated/plugin",
  ],
};
