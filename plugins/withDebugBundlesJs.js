const { withAppBuildGradle } = require('expo/config-plugins');

// Makes the Gradle "debug" build type behave, for bundling purposes, exactly
// like release: the JS bundle and assets get embedded in the APK instead of
// the default debug behaviour of expecting a live Metro server.
//
// Why this exists: RevenueCat's native SDK refuses to run with a `test_`
// (Test Store) API key on a build it detects as non-debuggable — on purpose,
// so a test key can never ship to real users by accident. A normal signed APK
// (buildType "apk", the release Gradle variant) IS non-debuggable and gets
// force-closed with "Wrong API Key". A genuine debug-variant build satisfies
// RevenueCat's check, but by default a debug build has no embedded JS and
// needs Metro running on the same network — useless for something you can
// just hand someone as an installable file.
//
// `debuggableVariants = []` (the react/gradle plugin's own setting, commented
// out with 'debug' as its only default entry in every generated
// android/app/build.gradle) tells that plugin no variant should skip
// bundling — so a debug-signed APK gets JS baked in, same as a release one.
// Paired with `"gradleCommand": ":app:assembleDebug"` on the eas.json profile
// that needs a real Test Store purchase in an installable, standalone file.
//
// ponytail: single-purpose, one build profile. Not for anything users install.
module.exports = function withDebugBundlesJs(config) {
  return withAppBuildGradle(config, (config) => {
    const anchor = '// debuggableVariants = ["liteDebug", "prodDebug"]';
    const { contents } = config.modResults;
    if (contents.includes('debuggableVariants = []')) return config;
    if (!contents.includes(anchor)) {
      throw new Error('withDebugBundlesJs: expected react{} comment not found in app/build.gradle — Expo/RN Gradle plugin layout may have changed.');
    }
    config.modResults.contents = contents.replace(anchor, `${anchor}\n    debuggableVariants = []`);
    return config;
  });
};
