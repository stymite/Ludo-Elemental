import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import * as ExpoSplashScreen from 'expo-splash-screen';

// The last line between a bug and the app vanishing. In a release build any
// uncaught JavaScript error — a render that throws, a timer that throws, a
// worklet Reanimated reports as fatal — closes the app without a word. Here it
// becomes a screen with the message on it, and Try again remounts the whole app
// from scratch. A crash inside native code still closes the app; nothing in
// JavaScript can catch that.
//
// App is required rather than imported so an error while its modules load lands
// in this catch instead of before any of this exists.
let App = null;
let loadError = null;
let showCrash = null;
let pending = null;

// Dev keeps the red box: it has the stack trace this screen leaves out.
if (!__DEV__ && global.ErrorUtils) {
  const fallback = global.ErrorUtils.getGlobalHandler();
  global.ErrorUtils.setGlobalHandler((error, isFatal) => {
    if (!isFatal) return fallback(error, isFatal);
    console.error('[fatal]', error);
    if (showCrash) showCrash(error);
    else pending = error;
  });
}

try {
  App = require('../App').default;
} catch (e) {
  loadError = e;
}

export default class CrashGuard extends React.Component {
  state = { error: loadError || pending, attempt: 0 };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidMount() {
    showCrash = (error) => this.setState({ error });
    if (pending) this.setState({ error: pending });
    this.revealIfCrashed();
  }

  componentDidUpdate() {
    this.revealIfCrashed();
  }

  componentDidCatch(error) {
    console.error('[render]', error);
  }

  // App holds the native splash until its own intro screen takes over. An error
  // before that would sit behind the splash forever, so the message lifts it.
  revealIfCrashed() {
    if (this.state.error) ExpoSplashScreen.hideAsync().catch(() => {});
  }

  componentWillUnmount() {
    showCrash = null;
  }

  retry = () => {
    pending = null;
    this.setState(s => ({ error: null, attempt: s.attempt + 1 }));
  };

  render() {
    const { error, attempt } = this.state;
    if (!error && App) return <App key={attempt} />;

    return (
      <View style={styles.root}>
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.message} selectable>
          {String(error?.message || error || 'The game could not load.')}
        </Text>
        {App ? (
          <Pressable onPress={this.retry} style={styles.button} accessibilityRole="button">
            <Text style={styles.buttonText}>Try again</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#08080C',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 16,
  },
  title: { color: '#FFFFFF', fontSize: 20, fontWeight: '700', textAlign: 'center' },
  message: { color: '#9A9AA8', fontSize: 13, textAlign: 'center' },
  button: {
    minHeight: 48,
    paddingHorizontal: 28,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { color: '#08080C', fontSize: 16, fontWeight: '700' },
});
