const { withGradleProperties } = require('expo/config-plugins');

// Android build switches that make the APK smaller without changing anything
// the game does. Four gradle.properties lines, so a plugin of our own rather
// than another dependency.
//
//   reactNativeArchitectures     the two ARM ABIs real phones use (32-bit kept
//                                for older and Android Go handsets)
//   expo.useLegacyPackaging      store the .so libraries compressed in the APK.
//                                They were stored raw, which was 31 MB of 51.
//   enableMinifyInReleaseBuilds  OFF, on purpose. R8 cut the dex from 28 MB to 8,
//                                but it strips or renames classes that native
//                                code and Kotlin reflection look up by name, and
//                                every APK built with it closed on launch. Expo's
//                                default is off; only turn it on again with a
//                                phone at hand to prove the build still opens.
//   expo.gif / expo.webp         ON, Expo's default. Every board, backdrop and
//                                face image is a WebP, and the pair cost ~85 KB
//                                together — not worth a doubt about the decoder.
const PROPS = {
  reactNativeArchitectures: 'armeabi-v7a,arm64-v8a',
  'expo.useLegacyPackaging': 'true',
  'android.enableMinifyInReleaseBuilds': 'false',
  'expo.gif.enabled': 'true',
  'expo.webp.enabled': 'true',
};

module.exports = function withAndroidSize(config) {
  return withGradleProperties(config, (config) => {
    config.modResults = config.modResults.filter((item) => !(item.key in PROPS));
    for (const [key, value] of Object.entries(PROPS)) {
      config.modResults.push({ type: 'property', key, value });
    }
    return config;
  });
};
