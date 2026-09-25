const { withAppBuildGradle } = require('expo/config-plugins');

// Signs release builds with the Play upload key when one is handed to Gradle,
// and falls back to the debug key when it is not.
//
// Expo's template points the release build type at signingConfigs.debug, which
// is fine for an APK you sideload and useless for Play: an upload key has to be
// a real key you keep, because Play ties every future update of this package to
// it. The keystore itself is never in the repo — the four values arrive as
// Gradle properties on the command line:
//
//   gradlew bundleRelease \
//     -PLUDO_STORE_FILE=<abs path> -PLUDO_STORE_PASSWORD=... \
//     -PLUDO_KEY_ALIAS=... -PLUDO_KEY_PASSWORD=...
//
// Without them a plain `gradlew assembleRelease` still works and still
// self-signs, so a local test APK needs no secrets at all.
module.exports = function withUploadSigning(config) {
  return withAppBuildGradle(config, (config) => {
    let src = config.modResults.contents;
    if (src.includes('LUDO_STORE_FILE')) return config;

    const signingAnchor = `    signingConfigs {
        debug {`;
    if (!src.includes(signingAnchor)) {
      throw new Error('withUploadSigning: signingConfigs.debug block not found in app/build.gradle');
    }
    src = src.replace(signingAnchor, `    signingConfigs {
        upload {
            if (project.hasProperty('LUDO_STORE_FILE')) {
                storeFile file(project.property('LUDO_STORE_FILE'))
                storePassword project.property('LUDO_STORE_PASSWORD')
                keyAlias project.property('LUDO_KEY_ALIAS')
                keyPassword project.property('LUDO_KEY_PASSWORD')
            }
        }
        debug {`);

    const releaseAnchor = `            // Caution! In production, you need to generate your own keystore file.
            // see https://reactnative.dev/docs/signed-apk-android.
            signingConfig signingConfigs.debug`;
    if (!src.includes(releaseAnchor)) {
      throw new Error('withUploadSigning: release signingConfig line not found in app/build.gradle');
    }
    src = src.replace(releaseAnchor, `            signingConfig project.hasProperty('LUDO_STORE_FILE') ? signingConfigs.upload : signingConfigs.debug`);

    config.modResults.contents = src;
    return config;
  });
};
