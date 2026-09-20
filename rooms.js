import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, isSupabaseConfigured } from './supabase';
import { validSnapshot } from './online';

// Everything that touches the database lives here; multiplayer.js stays pure
// realtime transport. The split matters because these two fail differently — a
// dropped channel is recoverable, a failed write is not — and because the
// snapshot path is the only reason online play needs auth at all.

const LAST_ROOM_KEY = 'ludo.lastRoom';

// A room older than this is not worth offering to rejoin; the other players are
// long gone. Matches the sweep window in supabase-schema-v2.sql.
const RESUME_WINDOW_MS = 6 * 60 * 60 * 1000;

// ------------------------------------------------------------- snapshots ---

// Called by the host after every turn. Fire-and-forget on purpose: a failed
// write must never stall the game, because the realtime broadcast has already
// delivered the move to everyone. The snapshot is for reconnects, not for play.
export async function saveSnapshot(code, { state, match }) {
  const { data, error } = await supabase.rpc('save_ludo_state', {
    p_code: code, p_state: state, p_match: match
  });
  if (error) throw error;
  return data;
}

export async function loadRoom(code) {
  if (!isSupabaseConfigured || !code) return null;
  const { data, error } = await supabase
    .from('rooms').select('*').eq('code', code).single();
  if (error) return null;
  return data;
}

export async function closeRoom(code) {
  if (!isSupabaseConfigured || !code) return;
  try { await supabase.rpc('leave_ludo_room', { p_code: code }); } catch { /* best effort */ }
}

// ---------------------------------------------------------- resume on open ---

// Which room this device was last in. Kept locally rather than queried, because
// "find the room whose match json contains my id" is an awkward query for
// something this simple to just write down.
export async function rememberRoom(code, colour) {
  try {
    await AsyncStorage.setItem(LAST_ROOM_KEY, JSON.stringify({ code, colour, at: Date.now() }));
  } catch (e) { /* storage is best-effort */ }
}

export async function forgetRoom() {
  try { await AsyncStorage.removeItem(LAST_ROOM_KEY); } catch (e) { /* ignore */ }
}

// Returns a room worth offering to rejoin, or null. Checks the server rather
// than trusting the local note, so a game somebody else already finished does
// not show up as resumable.
export async function findResumableRoom() {
  if (!isSupabaseConfigured) return null;
  try {
    const raw = await AsyncStorage.getItem(LAST_ROOM_KEY);
    if (!raw) return null;
    const note = JSON.parse(raw);
    if (!note?.code) return null;
    if (Date.now() - (note.at || 0) > RESUME_WINDOW_MS) {
      await forgetRoom();
      return null;
    }

    const room = await loadRoom(note.code);
    if (!room || room.status !== 'playing' || !validSnapshot(room.state, room.match)) {
      await forgetRoom();
      return null;
    }
    if (Date.now() - new Date(room.updated_at).getTime() > RESUME_WINDOW_MS) {
      await forgetRoom();
      return null;
    }
    const { data: { user } } = await supabase.auth.getUser();
    const seat = room.match.assignments.find(a => a.id === user?.id);
    if (!seat) return null;
    return { ...room, myColour: seat.colour };
  } catch (e) {
    return null;
  }
}

// Queue formation and assignment are atomic server operations.
export async function joinQueue(mode) {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured');
  const { data, error } = await supabase.rpc('join_ludo_queue', { p_mode: mode });
  if (error) throw error;
  return data;
}

export async function leaveQueue() {
  if (!isSupabaseConfigured) return;
  try { await supabase.rpc('leave_ludo_queue'); } catch { /* best effort */ }
}

export async function pollQueue(mode) {
  const { data, error } = await supabase.rpc('poll_ludo_queue', { p_mode: mode });
  if (error) throw error;
  return data;
}
