module.exports = function (api) {
    api.cache(true);
    return {
        // babel-preset-expo adds react-native-worklets/plugin on its own when the
        // package is installed, which is what Reanimated 4 needs.
        presets: ['babel-preset-expo'],
    };
};
