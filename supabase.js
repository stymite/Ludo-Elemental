import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// Whether we have enough config to talk to Supabase at all. Everything
// auth- or online-flavoured checks this first; the offline game modes never
// touch it, so a missing .env degrades to "logged out forever" rather than a
// crash on the very first import.
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// createClient() throws outright on an undefined url, which would take the whole
// app down before a single screen renders. When the config is absent we hand back
// a stub with the same shape as the parts of the client we actually call, so every
// call site can stay blissfully unaware.
function createOfflineStub() {
  const noSession = { data: { session: null }, error: null };
  const noRows = { data: null, error: new Error('Supabase is not configured') };

  const query = {
    select: () => query,
    insert: () => query,
    upsert: () => Promise.resolve(noRows),
    update: () => query,
    delete: () => query,
    eq: () => query,
    single: () => Promise.resolve(noRows),
    then: (resolve) => Promise.resolve(noRows).then(resolve)
  };

  return {
    auth: {
      getSession: () => Promise.resolve(noSession),
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe: () => {} } }
      }),
      signInWithOAuth: () => Promise.resolve(noRows),
      signInAnonymously: () => Promise.resolve({
        data: { user: null, session: null },
        error: new Error('Supabase is not configured')
      }),
      setSession: () => Promise.resolve(noSession),
      signOut: () => Promise.resolve({ error: null }),
      startAutoRefresh: () => {},
      stopAutoRefresh: () => {}
    },
    from: () => query,
    channel: () => ({
      on() { return this; },
      subscribe() { return this; },
      send: () => {},
      track: () => Promise.resolve(),
      presenceState: () => ({})
    }),
    removeChannel: () => {}
  };
}

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        // We complete the OAuth redirect by hand in App.js, because on native
        // there is no window.location for the client to inspect.
        detectSessionInUrl: false
      }
    })
  : createOfflineStub();

// Tells Supabase Auth to continuously refresh the session automatically
// if the app is in the foreground. When this is added, you will continue
// to receive `onAuthStateChange` events with the `TOKEN_REFRESHED` or
// `SIGNED_OUT` event if the user's session is terminated. This should
// only be registered once.
if (isSupabaseConfigured) {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}
