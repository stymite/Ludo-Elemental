import { registerRootComponent } from 'expo';

import CrashGuard from './components/CrashGuard';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately. CrashGuard loads App itself, so an
// error anywhere in it shows a message instead of closing the app.
registerRootComponent(CrashGuard);
