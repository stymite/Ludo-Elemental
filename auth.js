import { Platform, Linking } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, isSupabaseConfigured } from './supabase';

WebBrowser.maybeCompleteAuthSession();

export const redirectUri = () => {
  try {
    return AuthSession.makeRedirectUri({ scheme: 'ludo' });
  } catch (e) {
    return null;
  }
};

// --- Who is signed in ------------------------------------------------------

const externalIdentity = (user) =>
  (user?.identities || []).find(i => i.provider && i.provider !== 'anonymous') || null;

// A guest is an account with nothing behind it but an anonymous session.
// `is_anonymous` alone does not answer that: the flag is a claim inside the
// access token, so a token minted before the Google identity was attached goes
// on saying "yes" until it is refreshed — which is exactly the window in which
// the app decides what to draw. An attached external identity is the fact.
export function isGuestUser(user) {
  if (!user) return false;
  return Boolean(user.is_anonymous) && !externalIdentity(user);
}

// Which login this account belongs to — "Google", "Facebook" — or null for a
// guest. For the settings screen, which used to say Google whatever you used.
export function accountProvider(user) {
  const id = externalIdentity(user)?.provider;
  return id ? id.charAt(0).toUpperCase() + id.slice(1) : null;
}

const displayName = (user) =>
  user?.user_metadata?.full_name
  || user?.user_metadata?.name
  || user?.email?.split('@')[0]
  || null;

// --- The OAuth round trip --------------------------------------------------

// Supabase hands tokens back on the redirect URL — in the fragment for the
// implicit flow, in the query string for PKCE. Take whichever turned up.
async function completeSessionFromUrl(url) {
  if (!url) throw new Error('No redirect URL received.');

  const queryPart = url.includes('?') ? url.split('?')[1].split('#')[0] : '';
  const hashPart = url.includes('#') ? url.split('#')[1] : '';
  const queryParams = new URLSearchParams(queryPart);
  const hashParams = new URLSearchParams(hashPart);

  const errorDesc = queryParams.get('error_description')
    || hashParams.get('error_description')
    || queryParams.get('error')
    || hashParams.get('error');
  if (errorDesc) throw new Error(errorDesc);

  // 1. PKCE flow: Supabase sends code in query params
  const code = queryParams.get('code') || hashParams.get('code');
  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
    return data?.session;
  }

  // 2. Implicit flow: access_token & refresh_token
  const access_token = hashParams.get('access_token') || queryParams.get('access_token');
  const refresh_token = hashParams.get('refresh_token') || queryParams.get('refresh_token');
  if (access_token && refresh_token) {
    const { data, error } = await supabase.auth.setSession({ access_token, refresh_token });
    if (error) throw error;
    return data?.session;
  }

  throw new Error('Sign-in did not complete.');
}

// The one refusal we act on rather than report: that Google account is already
// somebody's game account, so it cannot be folded into this guest.
const isAlreadyLinked = (error) => {
  const message = String(error?.message || error || '').toLowerCase();
  return message.includes('identity is already linked')
    || message.includes('already been taken')
    || message.includes('already exists')
    || message.includes('already registered');
};

// Signing in and linking are the same trip through the same browser with the
// same answer coming back; only the call that mints the URL differs. One
// function is what stops the two drifting apart — which is how the web build
// came to complete one of them and quietly drop the other.
async function runOAuth(provider, mode) {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured in .env');

  const redirectTo = redirectUri();
  const start = (options) => (mode === 'link'
    ? supabase.auth.linkIdentity({ provider, options })
    : supabase.auth.signInWithOAuth({ provider, options }));

  if (Platform.OS === 'web') {
    // The answer arrives on a fresh page load, so nothing in this call stack
    // will be alive to catch it. Leave a note for completeAuthRedirect.
    await AsyncStorage.setItem(PENDING_KEY, provider + ':' + mode);
    const { error } = await start({ redirectTo });
    if (error) {
      await AsyncStorage.removeItem(PENDING_KEY);
      throw error;
    }
    // Execution stops here on web: the page tears down to navigate away.
    // The promise never resolves before the unload.
    await new Promise(() => {});
  } else {
    const { data, error } = await start({ redirectTo, skipBrowserRedirect: true });
    if (error) throw error;
    if (!data?.url) throw new Error('No sign-in URL was returned.');

    // Android has no native auth session: expo-web-browser races "the app came
    // back to the foreground" against "the redirect URL arrived". The redirect
    // is what brings the app back, so the foreground event often wins and a
    // finished Google sign-in is reported as 'dismiss' — the sign-in loop. So
    // the redirect is caught here too, and a dismiss waits briefly for it.
    // Matched on the scheme alone, not the whole redirect URL: Supabase rebuilds
    // the address when it redirects with an error, and `ludo://` comes back as
    // `ludo:?error=...` — which a startsWith('ludo://') check never recognised,
    // so a refused sign-in looked exactly like backing out of the browser.
    let redirected = null;
    const scheme = redirectTo ? redirectTo.slice(0, redirectTo.indexOf(':') + 1) : null;
    const subscription = Linking.addEventListener('url', ({ url }) => {
      if (scheme && url.startsWith(scheme)) redirected = url;
    });
    try {
      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (result.type === 'success' && result.url) redirected = result.url;
      for (let waited = 0; !redirected && result.type === 'dismiss' && waited < 2000; waited += 100) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      if (!redirected) throw new Error('cancelled');
      await completeSessionFromUrl(redirected);
    } finally {
      subscription.remove();
    }
  }
}

// One door for "continue with Google", because what it means depends
// on who is already signed in, and no button should have to know that:
//
//   nobody, or a real account → a plain sign-in.
//
//   a guest → a link. The user id does not change, so the profile row, the
//     avatar, the charge history and any room this device is mid-way through
//     stay exactly where they are. There is nothing to merge because nothing
//     moved. The guest is the account now; play as guest next time and you get
//     a new one.
//
//   a guest, where that Google account is already somebody's game account →
//     Supabase refuses the link, and it is right to: an account with a history
//     cannot be swallowed by a guest session. So we sign into that account
//     instead, and set the guest aside rather than stranding it — see
//     signInAsGuest.
//
// Linking needs "Manual linking" enabled in Supabase → Authentication →
// Settings; without it every guest upgrade fails with a message saying so.
export async function connectProvider(provider) {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured in .env');

  const { data: { session } } = await supabase.auth.getSession();
  if (!isGuestUser(session?.user)) return runOAuth(provider, 'signin');

  try {
    await runOAuth(provider, 'link');
    await forgetGuestSession(); // this guest is the real account now
  } catch (e) {
    if (!isAlreadyLinked(e)) throw e;
    await keepGuestSession(session);
    await runOAuth(provider, 'signin');
  }
}

// Web only: the provider answers on a page load of its own, so the call that
// started the trip is gone by the time the tokens arrive. This is the boot
// picking them up off the URL — without it a web sign-in changed nothing at
// all, and a guest who linked Google came back still a guest. Native never
// needs it: openAuthSessionAsync hands the URL back to the code still waiting.
const PENDING_KEY = 'ludo.pendingAuth';

export async function completeAuthRedirect() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;

  const pending = await AsyncStorage.getItem(PENDING_KEY);
  const url = window.location.href;
  const answered = /access_token=|[?#&]error/.test(url);
  if (!pending && !answered) return;

  await AsyncStorage.removeItem(PENDING_KEY);
  // Off the address bar, so a reload cannot replay a spent set of tokens.
  window.history.replaceState(null, '', window.location.pathname + window.location.search);

  // Backed out of the browser without any answer at all — a cancel, same as
  // pressing back on native. Thrown rather than swallowed so the boot effect
  // in App.js knows this reload was a sign-in attempt and sends the player
  // back to the sign-in screen instead of wherever hasOnboarded() would send
  // a fresh launch.
  if (!answered) {
    if (pending) throw new Error('cancelled');
    return;
  }

  const [provider, mode] = String(pending || '').split(':');
  try {
    await completeSessionFromUrl(url);
  } catch (e) {
    // The same fork as connectProvider, half a page load later: the link was
    // refused because that account already exists, so sign into it instead.
    if (mode === 'link' && isAlreadyLinked(e)) {
      const { data: { session } } = await supabase.auth.getSession();
      await keepGuestSession(session);
      await runOAuth(provider, 'signin');
      return;
    }
    // Anything else — denied consent, a dead redirect, a provider hiccup —
    // is a failed attempt, not a configuration problem worth explaining.
    throw new Error('cancelled');
  }
}

// --- Guests ----------------------------------------------------------------

// "Play as guest" is a real anonymous auth user, not a local flag. It has to be:
// rooms.host_id references profiles(id), and every RLS policy keys off
// auth.uid(), so a guest without a session could not create or join an online
// game at all. The trade is one dashboard toggle — see supabase-schema-v2.sql.
//
// An anonymous user has no password, no email and no provider, so its session
// is the only way back into it: drop that session and the guest, its name, its
// picture and its games are gone for good. So when an existing Google account
// takes the session over, the guest's tokens are set aside here — and this is
// where they come back. Play as guest and you are the guest you were, not a
// new stranger with the same word for a name.
const GUEST_KEY = 'ludo.guestSession';

async function keepGuestSession(session) {
  if (!session || !isGuestUser(session.user)) return;
  try {
    await AsyncStorage.setItem(GUEST_KEY, JSON.stringify({
      access_token: session.access_token,
      refresh_token: session.refresh_token
    }));
  } catch (e) { /* best effort */ }
}

async function forgetGuestSession() {
  try { await AsyncStorage.removeItem(GUEST_KEY); } catch (e) { /* best effort */ }
}

async function resumeGuestSession() {
  let kept = null;
  try { kept = JSON.parse((await AsyncStorage.getItem(GUEST_KEY)) || 'null'); } catch (e) { kept = null; }
  if (!kept?.refresh_token) return null;
  await forgetGuestSession(); // one shot: a refresh token spends itself

  const { data, error } = await supabase.auth.setSession(kept);
  // A token too old to refresh, or a guest that has since been linked into a
  // real account: either way this device wants a fresh guest, not that one.
  if (error || !isGuestUser(data?.user)) return null;
  return data.user;
}

export async function signInAsGuest() {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured in .env');

  // Already holding this device's guest — a guest who pressed "switch account"
  // and then changed their mind, most often. Signing in again would mint a
  // second anonymous user and strand the first with all its games in it.
  const { data: { session } } = await supabase.auth.getSession();
  if (isGuestUser(session?.user)) return session.user;

  const kept = await resumeGuestSession();
  if (kept) return kept;

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  return data?.user ?? null;
}

// There is no such thing as signing out of a guest, and pretending otherwise is
// what kept handing people a new one. Supabase's logout revokes the session at
// the server, and for an anonymous user the session IS the account: no password,
// no email, nothing else to get back in with. So a guest is not signed out. It
// stays on the device that made it and this walks back to the sign-in screen —
// which is all anyone wanted from the button anyway, a way to reach Google.
//
// The guest changes on exactly the two occasions it should: linking it to
// Google or Facebook promotes it and the next one is new, and uninstalling the
// app takes the storage with it.
export async function signOut() {
  const { data: { session } } = await supabase.auth.getSession();
  if (isGuestUser(session?.user)) {
    await keepGuestSession(session);
  }
  await supabase.auth.signOut();
}

// Deletes the signed-in account for good — guest or Google — on the server
// (delete_my_account in supabase-schema-v2.sql), then forgets it on this device.
// Purchases are not touched: they belong to the Google Play account, and
// Restore in the shop brings them back under whatever account comes next.
export async function deleteAccount() {
  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id;
  if (!userId) throw new Error('Not signed in');

  const { error } = await supabase.rpc('delete_my_account');
  if (error) throw error;

  try { await AsyncStorage.removeItem(PROFILE_KEY(userId)); } catch (e) { /* best effort */ }
  // The server session died with the user; this only clears the local copy.
  await supabase.auth.signOut({ scope: 'local' });
}

// Whether this device has been past the sign-in screen at all — by signing in,
// or by choosing to play offline. Once answered, the app opens on the home
// screen instead of asking again every single launch; signing in is still one
// tap away from settings.
const ONBOARDED_KEY = 'ludo.onboarded';

export async function markOnboarded() {
  try { await AsyncStorage.setItem(ONBOARDED_KEY, '1'); } catch (e) { /* best effort */ }
}

export async function hasOnboarded() {
  try { return (await AsyncStorage.getItem(ONBOARDED_KEY)) === '1'; } catch (e) { return false; }
}

export async function forgetOnboarded() {
  try { await AsyncStorage.removeItem(ONBOARDED_KEY); } catch (e) { /* best effort */ }
}

// Every signed-in user needs a profile row, guests included. Returns the profile data
// to show. Kept idempotent so it is safe to call on every auth state change.
// The name and picture, remembered on this device. ensureProfile has to go to
// the server, and until it comes back the home screen has nothing to draw — so
// the avatar arrived a network round trip late on every single launch. This is
// what it paints in the meantime.
const PROFILE_KEY = (id) => 'ludo.profile.' + id;

export async function cachedProfile(userId) {
  if (!userId) return null;
  try {
    const raw = await AsyncStorage.getItem(PROFILE_KEY(userId));
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

async function rememberProfile(userId, profile) {
  try {
    await AsyncStorage.setItem(PROFILE_KEY(userId), JSON.stringify(profile));
  } catch (e) { /* best effort */ }
}

export async function ensureProfile(user) {
  if (!user) return { username: 'Guest', avatarUrl: null };
  const isGuest = isGuestUser(user);

  const { data } = await supabase
    .from('profiles').select('username, avatar_url, is_guest').eq('id', user.id).maybeSingle();

  if (data?.username) {
    // Linking keeps the user id, so this is still the guest's row: same
    // Guest_1234, same is_guest flag, and nothing on screen would change.
    // Promote it once — the name is the only visible sign the upgrade worked.
    const named = (!isGuest && displayName(user)) || data.username;
    // A picture the player picked is stored as a data: URI and is theirs to
    // keep. Any other picture came from Google or Facebook and is refreshed on
    // every sign-in: Facebook's picture links expire, so a stored copy of one
    // goes blank after a few weeks.
    const picked = typeof data.avatar_url === 'string' && data.avatar_url.startsWith('data:');
    const avatarUrl = picked ? data.avatar_url : (user.user_metadata?.avatar_url ?? data.avatar_url ?? null);
    if (!isGuest && (data.is_guest !== false || named !== data.username || avatarUrl !== data.avatar_url)) {
      await supabase.from('profiles')
        .update({ username: named, is_guest: false, avatar_url: avatarUrl })
        .eq('id', user.id);
      const promoted = { username: named, avatarUrl };
      rememberProfile(user.id, promoted);
      return promoted;
    }

    const profile = { username: data.username, avatarUrl: data.avatar_url };
    rememberProfile(user.id, profile);
    return profile;
  }

  const fallback = isGuest
    ? 'Guest_' + Math.floor(1000 + Math.random() * 9000)
    : (displayName(user) || 'Player_' + Math.floor(1000 + Math.random() * 9000));

  // A picture picked in the first moments after signing up can land before this
  // row exists, and its save then updates nothing. updateAvatar writes this
  // device's copy first, so the new row starts from that instead of empty.
  const avatarUrl = (await cachedProfile(user.id))?.avatarUrl
    ?? user.user_metadata?.avatar_url
    ?? null;

  // ignoreDuplicates matters: a plain upsert on the primary key OVERWRITES the
  // row, so every call minted a fresh Guest_1234 and renamed the player. This
  // runs on every auth event — a token refresh included — so that rename landed
  // mid-session, and anything keyed on the name (the matchmaking poll) restarted
  // with it. Claim the name once; never clobber one that is already there.
  await supabase.from('profiles').upsert({
    id: user.id,
    username: fallback,
    is_guest: isGuest,
    avatar_url: avatarUrl
  }, { onConflict: 'id', ignoreDuplicates: true });

  // Re-read rather than assume we won: whoever got there first owns the name.
  const { data: settled } = await supabase
    .from('profiles').select('username, avatar_url').eq('id', user.id).maybeSingle();

  const profile = settled?.username
    ? { username: settled.username, avatarUrl: settled.avatar_url }
    : { username: fallback, avatarUrl };
  rememberProfile(user.id, profile);
  return profile;
}

// A picture is drawn at 44px, but it is also written to the profile row and
// sent to everyone in an online room with every move. On web a canvas squares
// it off at 128px first: a few kilobytes. Resolves to a data: URI, or null when
// the pick is cancelled. Google and Facebook accounts never come through here;
// their picture comes from the provider.
//
// ponytail: no resize on a phone. expo-image-manipulator did it, but every Expo
// native module is built at app start, it was the only native change in the
// APK that closed on launch, and it has an open crash on Android 8.0 and older
// (expo/expo#34690). The picker's crop and quality are the knobs left; a phone
// picture still too big for an online room stays out of it (see wireAvatar in
// multiplayer.js) and the player's name shows there instead.
const AVATAR_PX = 128;

const shrinkOnWeb = (dataUri) => new Promise((resolve) => {
  const img = new window.Image();
  img.onload = () => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = AVATAR_PX;
      canvas.height = AVATAR_PX;
      // Cover: crop the long side rather than squashing the picture.
      const side = Math.min(img.width, img.height);
      canvas.getContext('2d').drawImage(
        img,
        (img.width - side) / 2, (img.height - side) / 2, side, side,
        0, 0, AVATAR_PX, AVATAR_PX
      );
      resolve(canvas.toDataURL('image/jpeg', 0.8));
    } catch (e) {
      resolve(dataUri); // a tainted or oversized canvas is not worth failing the pick over
    }
  };
  img.onerror = () => resolve(dataUri);
  img.src = dataUri;
});

export async function pickAvatar() {
  const web = Platform.OS === 'web';
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: web ? 1 : 0.2,
    base64: true
  });
  const asset = !result.canceled && result.assets?.[0];
  if (!asset?.base64) return null;

  const picked = `data:${asset.mimeType || 'image/jpeg'};base64,${asset.base64}`;
  return web ? shrinkOnWeb(picked) : picked;
}

export async function updateAvatar(userId, base64Str) {
  // Written locally first so the new picture survives a restart even if the
  // server write below fails.
  const known = await cachedProfile(userId);
  await rememberProfile(userId, { ...(known || {}), avatarUrl: base64Str });

  if (!isSupabaseConfigured || !userId) return;
  const { error } = await supabase
    .from('profiles')
    .update({ avatar_url: base64Str })
    .eq('id', userId);
  if (error) throw error;
}
