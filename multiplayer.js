import { supabase, isSupabaseConfigured } from './supabase';
import { assignSeats, validSnapshot } from './online';
import { saveSnapshot, loadRoom } from './rooms';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function makeCode() {
  return Array.from({ length: 5 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('');
}

// Clients receive private broadcasts. Only database functions may send them;
// the database stamps each intent with the authenticated sender's identity.
class MultiplayerManager {
  constructor() {
    this.channel = null;
    this.members = [];
    this.handlers = {};
    this.displayName = 'Guest';
    this.generation = 0;
    this.revision = 0;
  }
  init(userId, avatarUrl) {
    if (this.userId !== userId) this.leave();
    this.userId = userId;
    this.avatarUrl = avatarUrl;
  }
  get identity() { return this.userId; }
  get mySeat() { return this.members.find(m => m.id === this.identity)?.seat ?? null; }
  get wireAvatar() {
    return typeof this.avatarUrl === 'string' && this.avatarUrl.length <= 40000 ? this.avatarUrl : null;
  }
  async createRoom(handlers, existingCode = null, mode = 'FFA') {
    const code = existingCode || makeCode();
    return await this._open(code, handlers, true, mode) ? code : null;
  }
  async joinRoom(rawCode, handlers, { announce = true } = {}) {
    return this._open(String(rawCode || '').trim().toUpperCase(), handlers, false, 'FFA', announce);
  }
  async _open(code, handlers, create, mode, announce = true) {
    this.leave();
    const generation = this.generation;
    const current = () => generation === this.generation;
    this.handlers = handlers || {};
    try {
      if (!isSupabaseConfigured || !this.userId) throw new Error('Sign in to play online.');
      if (!/^[A-HJ-NP-Z2-9]{5}$/.test(code)) throw new Error('Enter the five-character room code.');
      const { data: room, error } = await supabase.rpc('open_ludo_room', {
        p_code: code, p_mode: mode, p_create: create
      });
      if (error) throw error;
      if (!current()) return false;
      this.code = code;
      this.hostId = room.host_id;
      this.mode = room.mode;
      this.isHost = this.hostId === this.identity;
      this.revision = Number(room.revision) || 0;
      this.deliveredRevision = -1;
      await supabase.realtime.setAuth();
      if (!current()) return false;
      const channel = supabase.channel(`ludo-room:${code}`, {
        config: { private: true, presence: { key: this.identity } }
      });
      this.channel = channel;
      channel.on('presence', { event: 'sync' }, () => { if (current()) this._onPresence(); })
        .on('broadcast', { event: 'state' }, ({ payload }) => { if (current()) this._adopt(payload); })
        .on('broadcast', { event: 'intent' }, ({ payload }) => {
          if (current() && this.isHost && payload && payload.revision === this.revision &&
              !this.pendingState && !this.saving && this.intentRevision !== payload.revision) {
            if (this.handlers.onIntent?.(payload)) this.intentRevision = payload.revision;
          }
        })
        .on('broadcast', { event: 'ended' }, () => { if (current()) this.handlers.onHostLeft?.(); });
      const ok = await new Promise(resolve => {
        let settled = false;
        const finish = value => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          this.cancelOpen = null;
          resolve(value);
        };
        const timer = setTimeout(() => finish(false), 10000);
        this.cancelOpen = () => finish(false);
        channel.subscribe(async status => {
          if (!current()) return finish(false);
          if (status === 'SUBSCRIBED') {
            try {
              const tracked = await channel.track({ id: this.identity, name: this.displayName, avatar: this.wireAvatar });
              finish(tracked === 'ok');
              if (current()) this.handlers.onConnection?.(tracked === 'ok');
              if (current()) this.requestResync();
            } catch { finish(false); }
          } else if (['CHANNEL_ERROR','TIMED_OUT','CLOSED'].includes(status)) {
            this.handlers.onConnection?.(false);
            if (announce) this.handlers.onError?.('Connection interrupted. Reconnecting...');
            finish(false);
          }
        });
      });
      if (!current()) return false;
      if (!ok) throw new Error('Could not reach the room. Check your connection.');
      this.resyncTimer = setInterval(() => { this.requestResync(); this._onPresence(); }, 5000);
      return true;
    } catch (error) {
      if (current()) {
        if (announce) this.handlers.onError?.(error.message || 'Could not open the room.');
        this.leave();
      }
      return false;
    }
  }
  async _onPresence() {
    const channel = this.channel;
    if (!channel || this.presenceBusy) return;
    this.presenceBusy = true;
    try {
      const { data: room } = await supabase.from('rooms').select('id').eq('code', this.code).single();
      if (!room) return;
      const { data: allowed } = await supabase.from('room_members').select('user_id,joined_at').eq('room_id', room.id);
      if (this.channel !== channel || !allowed) return;
      const raw = channel.presenceState();
      if (!this.isHost) this.handlers.onConnection?.(Boolean(raw[this.hostId]?.length));
      this.members = assignSeats(allowed.filter(m => raw[m.user_id]?.length).map(m => {
        const info = raw[m.user_id][0];
        return { id: m.user_id, name: typeof info.name === 'string' ? info.name.slice(0,40) : 'Player',
          avatar: typeof info.avatar === 'string' && info.avatar.length <= 40000 ? info.avatar : null,
          joinedAt: m.user_id === this.hostId ? 0 : Date.parse(m.joined_at) };
      }));
      this.handlers.onMembers?.(this.members);
    } catch { /* next tick retries */ }
    finally { if (this.channel === channel) this.presenceBusy = false; }
  }
  _adopt(payload) {
    const revision = Number(payload?.revision);
    if (this.isHost || !payload || !Number.isFinite(revision) || revision <= this.deliveredRevision) return;
    if (!validSnapshot(payload.state, payload.seats) || !payload.seats.assignments.some(a => a.id === this.identity)) return;
    this.revision = revision;
    this.deliveredRevision = revision;
    this.handlers.onState?.(payload.state, payload.seats);
  }
  publishState(state, seats) {
    if (!this.channel || !this.isHost) return;
    this.pendingState = JSON.parse(JSON.stringify({ state, match: seats }));
    this._flush();
  }
  async _flush() {
    if (this.saving || !this.pendingState) return;
    const generation = this.generation;
    this.saving = true;
    const snapshot = this.pendingState;
    this.pendingState = null;
    let saved = false;
    try {
      const revision = await saveSnapshot(this.code, snapshot);
      if (generation === this.generation) { this.revision = Number(revision); saved = true; }
      if (generation === this.generation) this.handlers.onConnection?.(true);
    } catch {
      if (generation === this.generation) {
        this.pendingState ||= snapshot;
        this.handlers.onConnection?.(false);
        this.handlers.onError?.('Connection interrupted. The game will sync when the connection returns.');
      }
    } finally {
      if (generation === this.generation) {
        this.saving = false;
        if (saved && this.pendingState) this._flush();
      }
    }
  }
  async sendIntent(intent) {
    if (!this.channel || this.isHost) return;
    try {
      const { error } = await supabase.rpc('send_ludo_intent', {
        p_code: this.code, p_intent: intent, p_revision: this.revision
      });
      if (error) throw error;
    } catch { this.handlers.onError?.('Move could not be sent. Check your connection and try again.'); }
  }
  async requestResync() {
    if (!this.channel || this.resyncing) return;
    if (this.isHost) { this._flush(); return; }
    const channel = this.channel;
    this.resyncing = true;
    try {
      const room = await loadRoom(this.code);
      if (this.channel !== channel || !room) return;
      if (room.status === 'finished' && !room.state?.gameOver) this.handlers.onHostLeft?.();
      else this._adopt({ state: room.state, seats: room.match, revision: room.revision });
    } catch { /* next tick retries */ }
    finally { if (this.channel === channel) this.resyncing = false; }
  }
  leave() {
    this.generation++;
    this.cancelOpen?.();
    clearInterval(this.resyncTimer);
    const channel = this.channel;
    this.channel = null;
    this.code = null;
    this.isHost = false;
    this.members = [];
    this.handlers = {};
    this.pendingState = null;
    this.saving = false;
    this.resyncing = false;
    this.presenceBusy = false;
    this.intentRevision = null;
    this.revision = 0;
    if (channel) Promise.resolve(supabase.removeChannel(channel)).catch(() => {});
  }
}
export const multiplayer = new MultiplayerManager();
