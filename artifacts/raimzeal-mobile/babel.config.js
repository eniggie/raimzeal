module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      [
        "babel-preset-expo",
        {
          unstable_transformImportMeta: true,
          worklets: false,
        },
      ],
    ],
    plugins: ["react-native-reanimated/plugin"],
  };
};
