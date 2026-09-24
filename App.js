import React, { useState, useEffect, useMemo, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ExpoSplashScreen from 'expo-splash-screen';
import Tutorial from './components/Tutorial';
import SplashScreen from './components/SplashScreen';

// Keep the native splash screen locked until our in-app SplashScreen takes over
ExpoSplashScreen.preventAutoHideAsync().catch(() => {});

import { StatusBar } from 'expo-status-bar';
import { AppState, ScrollView, StyleSheet, View, useWindowDimensions, TouchableOpacity, Text, Image } from 'react-native';
// Deep import, not the barrel. `from '@expo/vector-icons'` pulls in all 19 icon
// families — nearly 4 MB of .ttf shipped so that 28 Ionicons could be drawn.
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSharedValue, withTiming } from 'react-native-reanimated';
import { YARD_PIXEL_POSITIONS } from './constants';
import {
  createGame,
  rollDice,
  getLegalMoves,
  getMoveValuesForPiece,
  movePiece,
  placeWall,
  canPlaceWall,
  raiseShield,
  canRaiseShield,
  summonGust,
  canSummonGust,
  hasGust,
  igniteFire,
  canIgniteFire,
  hasFire,
  canUseAbility,
  AIR_ABILITY_PLAYERS,
  skipAbilityWindow
} from './engine';
import LudoBoard from './components/LudoBoard';
import Tokens, { travelMs } from './components/Tokens';
import Dice from './components/Dice';
import { WallMarker, WallPlacementLayer, WallPlacementHint } from './components/Wall';
import { WinnerModal, MenuModal } from './components/Modals';
import { getBestBotMove } from './botEngine';
import StymiteFace from './components/StymiteFace';
import HomeScreen from './screens/homeScreen';
import SettingsScreen from './screens/settingsScreen';
import ShopScreen from './screens/shopScreen';
import { ownedSet, resolveEquipped, toggleEquipped, purchasedIds } from './shop';
import * as billing from './purchases';
import AuthScreen from './screens/authScreen';
import SetupScreen, { SEAT_OFF, SEAT_HUMAN, SEAT_BOT } from './screens/setupScreen';
import LobbyScreen from './screens/lobbyScreen';
import Backdrop from './components/Backdrop';
import { ErrorBanner } from './components/ui';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SEAT, SEAT_ORDER, TYPE, SPACE, RADIUS, TARGET } from './theme';
import * as Network from 'expo-network';
import { supabase, isSupabaseConfigured } from './supabase';
import {
  connectProvider, signInAsGuest, signOut as authSignOut, deleteAccount,
  ensureProfile, updateAvatar, completeAuthRedirect,
  isGuestUser, accountProvider,
  markOnboarded, hasOnboarded, forgetOnboarded, cachedProfile, pickAvatar
} from './auth';
import { multiplayer } from './multiplayer';
import { buildMatch, isActionAllowed, requiredPlayers, teamsFor, validSnapshot } from './online';
import {
  loadRoom, closeRoom, rememberRoom, forgetRoom,
  findResumableRoom, joinQueue, leaveQueue, pollQueue
} from './rooms';

// Shot clocks. Five seconds to roll, ten to choose a token — a roll is one tap,
// a move is a decision. Offline pass-and-play runs without a clock: there is
// nobody to keep waiting.
const ROLL_MS = 5000;
const MOVE_MS = 10000;

// How long matchmaking hunts before offering to fill the table with bots.
// How long to sit in the queue before giving up on it. Nobody watches a
// spinner for longer than this without wondering whether it is broken.
const SEARCH_TIMEOUT_MS = 120000;

// What the table looks like when you first open it: you against three
// computers, on a colour that is drawn rather than always green. Every seat is
// one tap from being a person instead, which is what makes this the same door
// for pass-and-play.
const defaultSeats = () => ({
  GREEN: SEAT_HUMAN,
  YELLOW: SEAT_HUMAN,
  BLUE: SEAT_HUMAN,
  RED: SEAT_HUMAN,
});

const havePiecesMoved = (before, after) => {
  if (!before || !after || before.length !== after.length) return false;
  return before.some((p, i) => p.relativePosition !== after[i]?.relativePosition);
};

// The online header's swatch is the seat colour from the design tokens, so the strip
// that says "you are BLUE" and the seat diagrams in the shell cannot drift apart.
const SEAT_TINTS = SEAT;

// Where each seat's four yard slots sit, averaged to a single point. Used as
// the mask's idle target: between turns it looks over at whoever is up next.
const YARD_CENTERS = Object.fromEntries(
  Object.entries(YARD_PIXEL_POSITIONS).map(([player, slots]) => [
    player,
    {
      x: slots.reduce((sum, s) => sum + s.left, 0) / slots.length + 3.3,
      y: slots.reduce((sum, s) => sum + s.top, 0) / slots.length + 3.3,
    },
  ])
);

// Warm the cache for the board texture as early as possible — before the
// player ever reaches the Play button — so by the time the game screen
// mounts the image resolves instantly instead of popping in after
// everything else (tokens, dice, buttons, which are plain JS/SVG with
// nothing to download). `resolveAssetSource` only exists on native Image;
// react-native-web's Image has no such static, so this is guarded and
// wrapped — a failed prefetch should never be able to take the app down
// with it, on any platform.
try {
  const boardAsset = require('./assets/Board.webp');
  let boardUri = null;
  if (Image.resolveAssetSource) {
    // Native: require() gives an opaque asset id, this resolves it.
    boardUri = Image.resolveAssetSource(boardAsset)?.uri;
  } else if (typeof boardAsset === 'string') {
    // Web, older/simple asset plugin: require() is already the URL.
    boardUri = boardAsset;
  } else if (boardAsset && typeof boardAsset === 'object') {
    // Web, Metro's asset registry shape: require() is {uri, width, ...}.
    boardUri = boardAsset.uri || boardAsset.default;
  }
  if (boardUri && typeof Image.prefetch === 'function') {
    Image.prefetch(boardUri);
  }
} catch (e) {
  // Best-effort warmup only — never block app startup over this.
}

// A handler whose identity never changes but whose body is always this render's.
// Every one of these is passed into a memoized component, and a fresh closure
// each render makes that memo worthless — which is how a dice roll came to
// re-render four dice, sixteen tokens and the board it all sits on.
function useStable(fn) {
  const latest = useRef(fn);
  latest.current = fn;
  const stable = useRef((...args) => latest.current(...args));
  return stable.current;
}

// One shared empty list rather than a fresh [] per render. setState bails out
// when the value is identical, so this is the difference between a roll costing
// one re-render and costing two.
const NO_PIECES = [];

// Grid, menu, undo and redo draw a few points under the 44 a fingertip needs.
// Slop rather than size: these sit in rows with room around them, so the touch
// area can grow without moving anything on screen.
const TAP_SLOP = { top: 8, bottom: 8, left: 8, right: 8 };
const NO_ROLLS = [];

function AppInner({ onTutorial }) {
  // SPLASH -> AUTH -> HOME -> (SETUP | LOBBY) -> GAME, plus SETTINGS.
  // BOOT is the moment before the stored session has been read back. It renders
  // nothing but the app's own background: routing straight to AUTH would flash
  // a sign-in screen at somebody who is already signed in.
  const [appState, setAppState] = useState('BOOT');
  const [bootTarget, setBootTarget] = useState(null);
  useEffect(() => { console.log('[app] screen', appState); }, [appState]);
  const [gameMode, setGameMode] = useState('PASS_N_PLAY'); // 'PASS_N_PLAY' | 'VS_COMPUTER' | 'ONLINE'

  // --- Flow selection ---
  // All four modes are picked straight off the home screen; whether a mode is
  // online is a property of the mode, not a separate choice the player makes.
  const [playType, setPlayType] = useState('LOCAL');  // 'MATCH' | 'ROOM' | 'LOCAL'
  const [teamMode, setTeamMode] = useState('FFA');   // 'FFA' | 'DUEL' | 'TEAM'

  // How the offline table is laid out: who sits where, and whether the four of
  // them are paired up. Kept in state rather than passed around so a rematch
  // can deal the same table again without asking.
  const [seats, setSeats] = useState(defaultSeats);
  // Which of the three pairings the offline table is playing, or 'NONE'. Was a
  // boolean that nothing ever set: the setup screen was handed it and never
  // rendered a control for it, so pass'n'play could not form teams at all and
  // every ability treated a partner as a stranger.
  const [formation, setFormation] = useState('NONE');

  const isOnlineType = playType === 'MATCH' || playType === 'ROOM';

  // --- Identity ---
  const [session, setSession] = useState(null);
  const [username, setUsername] = useState('Guest');
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [isGuest, setIsGuest] = useState(false);
  const [authBusy, setAuthBusy] = useState(null);
  const [authError, setAuthError] = useState(null);
  const [isOnlineNetwork, setIsOnlineNetwork] = useState(true);

  // --- Online room ---
  // `match` is the result of buildMatch: who plays which colour, plus the team
  // map. It is the authority on identity for the whole game, so the host sends
  // it with every state broadcast.
  const [onlineCode, setOnlineCode] = useState(null);
  const [onlineMembers, setOnlineMembers] = useState([]);
  const [match, setMatch] = useState(null);
  const [isHost, setIsHost] = useState(false);
  const [onlineError, setOnlineError] = useState(null);
  const [onlineConnected, setOnlineConnected] = useState(true);
  const [foreground, setForeground] = useState(AppState.currentState !== 'background');
  const [lobbyBusy, setLobbyBusy] = useState(null);

  // --- Matchmaking queue ---
  const [searching, setSearching] = useState(false);
  // When the search began, in ms. Held in state rather than inside the polling
  // effect so the clock survives that effect being torn down and rebuilt — it
  // used to restart the count from zero whenever it was.
  const [searchStartedAt, setSearchStartedAt] = useState(null);
  const [waited, setWaited] = useState(0);
  // How many people are sitting in the queue for this mode, us included. Until
  // a room is actually formed there are no members to count, and "0 of 2" while
  // you are plainly one of them reads as broken.
  const [queueWaiting, setQueueWaiting] = useState(0);
  const [noMatch, setNoMatch] = useState(false);
  const [resumable, setResumable] = useState(null);

  // --- Shop & Cosmetics ---
  // What is owned comes only from RevenueCat (purchases.js), never from this
  // device: a list kept in AsyncStorage is a free unlock for anyone who edits
  // it. Only what is worn is saved locally.
  const [entitlements, setEntitlements] = useState([]);
  const [equippedRaw, setEquippedRaw] = useState({ BOARD: 'ludo_board_classic' });
  const [shopError, setShopError] = useState(null);
  const [busyItem, setBusyItem] = useState(null);
  const [storePrices, setStorePrices] = useState({});
  const [restoring, setRestoring] = useState(false);

  const owned = useMemo(() => ownedSet(entitlements), [entitlements]);
  const equipped = useMemo(() => resolveEquipped(owned, equippedRaw), [owned, equippedRaw]);

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem('ludo.equipped').then(saved => {
      if (!alive || !saved) return;
      try {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') setEquippedRaw(parsed);
      } catch (e) {}
    }).catch(() => {});

    const adopt = info => { if (alive && info) setEntitlements(purchasedIds(info)); };
    const unwatch = billing.watchCustomerInfo(adopt);
    billing.loadPrices().then(prices => { if (alive) setStorePrices(prices); }).catch(() => {});
    return () => { alive = false; unwatch(); };
  }, []);

  const accountId = session?.user?.id;
  const billingAccountRef = useRef(accountId);
  billingAccountRef.current = accountId;
  useEffect(() => {
    let alive = true;
    setEntitlements([]);
    billing.identify(accountId)
      .then(info => { if (alive && info) setEntitlements(purchasedIds(info)); })
      .catch(() => {});
    return () => { alive = false; };
  }, [accountId]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      setForeground(state === 'active');
      if (state !== 'active') return;
      const account = billingAccountRef.current;
      billing.getCustomerInfo().then(info => {
        if (account === billingAccountRef.current && info) setEntitlements(purchasedIds(info));
      }).catch(() => {});
      multiplayer.requestResync();
    });
    return () => { subscription.remove(); multiplayer.leave(); };
  }, []);

  const wear = (update) => {
    setEquippedRaw(prev => {
      const next = update(prev);
      AsyncStorage.setItem('ludo.equipped', JSON.stringify(next)).catch(() => {});
      return next;
    });
  };

  const handleEquip = (item) => wear(prev => toggleEquipped(prev, item));

  const handleBuy = async (item) => {
    if (busyItem || restoring) return;
    const account = accountId;
    setShopError(null);
    setBusyItem(item.id);
    try {
      const info = await billing.buy(item.id);
      if (!info || account !== billingAccountRef.current) return;
      const ids = purchasedIds(info);
      setEntitlements(ids);
      if (ids.includes(item.id)) wear(prev => ({ ...prev, [item.section]: item.id }));
      else setShopError('Payment received, but the board is not unlocked yet. Tap Restore. If it stays locked, contact support; do not buy again.');
    } catch (e) {
      setShopError(billing.purchaseErrorMessage(e));
    } finally {
      setBusyItem(null);
    }
  };

  const handleRestore = async () => {
    if (busyItem || restoring) return;
    const account = accountId;
    setShopError(null);
    setRestoring(true);
    try {
      const ids = purchasedIds(await billing.restore());
      if (account !== billingAccountRef.current) return;
      setEntitlements(ids);
      if (!ids.length) setShopError('No purchases found for this Google account.');
    } catch (e) {
      setShopError(billing.purchaseErrorMessage(e));
    } finally {
      setRestoring(false);
    }
  };

  // Prices that failed to load at launch (no signal) get another go here.
  const openShop = () => {
    setShopError(null);
    setAppState('SHOP');
    if (!Object.keys(storePrices).length) {
      billing.loadPrices().then(setStorePrices).catch(() => {});
    }
  };

  const [gameState, setGameState] = useState(() => createGame(4));
  const [history, setHistory] = useState(() => [JSON.parse(JSON.stringify(createGame(4)))]);
  const [reviewMoveIndex, setReviewMoveIndex] = useState(null);
  const [reviewPhase, setReviewPhase] = useState('AFTER');
  const replayTimerRef = useRef(null);

  const isViewingPast = gameMode === 'PASS_N_PLAY' && reviewMoveIndex !== null;
  const displayedState = (() => {
    if (!isViewingPast) return gameState;
    const target = reviewPhase === 'BEFORE'
      ? history[reviewMoveIndex - 1]
      : history[reviewMoveIndex];
    return target || gameState;
  })();

  useEffect(() => {
    return () => {
      if (replayTimerRef.current) clearTimeout(replayTimerRef.current);
    };
  }, []);

  const [eligiblePieces, setEligiblePieces] = useState(NO_PIECES);
  // When the board stops moving. A move lands in state all at once, but the
  // token it moved is still walking its squares for up to a second afterwards
  // (Tokens.js), and the turn used to pass straight over the top of it: the
  // board dimmed, the next seat lit up and its clock started, all while the
  // piece was mid-flight. Nothing is anybody's turn until it lands.
  const [settleUntil, setSettleUntil] = useState(0);
  const settling = settleUntil > 0;
  // The token the player tapped that can be moved by more than one banked
  // value — holds the "6 or 4?" prompt open until they pick one. null the rest
  // of the time, which is every turn that banked a single value.
  const [choicePieceId, setChoicePieceId] = useState(null);
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [wallPlacingFor, setWallPlacingFor] = useState(null);
  // Reference grid overlay on the board — off by default, toggled from the
  // header. LudoBoard is memoized on this one prop, so flipping it is the
  // only thing that ever makes the board re-render.
  const [showGrid, setShowGrid] = useState(false);

  // Animation sequence states for first time a player goals
  const [scoringAnimation, setScoringAnimation] = useState(null);
  const [activatedBases, setActivatedBases] = useState([]);

  // Always the state as of this render. The realtime callbacks are registered
  // once when a room opens, so they cannot close over `gameState` directly
  // without going stale the moment anyone moves.
  const gameStateRef = useRef(gameState);
  gameStateRef.current = gameState;
  const appStateRef = useRef(appState);
  appStateRef.current = appState;
  const matchRef = useRef(match);
  matchRef.current = match;

  const isOnline = gameMode === 'ONLINE';
  const isOfflinePaused = !isOnline && isMenuVisible;
  // Colour comes from the match the host dealt, not from seat order — the deal
  // is random, so seat 1 is not necessarily YELLOW.
  const myEntry = match?.assignments?.find(a => a.id === multiplayer.identity) || null;
  const myPlayer = isOnline ? (myEntry?.colour ?? null) : null;
  const myTurn = !isOnline || (onlineConnected && gameState.activePlayer === myPlayer);
  // Only one device runs the engine, the timers, and the bots.
  const drivesEngine = (!isOnline || (isHost && onlineConnected)) && foreground;
  // Pass-and-play has no clock: there is nobody waiting on the other end.
  const clocked = isOnline || gameMode === 'VS_COMPUTER';



  useEffect(() => {
    if (gameState.triggerFirstScoreAnimation) {
      const player = gameState.triggerFirstScoreAnimation;
      setScoringAnimation(player);
      
      setActivatedBases(prev => {
        if (!prev.includes(player)) return [...prev, player];
        return prev;
      });
      
      setGameState(prev => {
        const next = { ...prev };
        next.triggerFirstScoreAnimation = null;
        return next;
      });

      // How long the whole flash holds the game still: rays out, base lit, fades
      // done, with a beat to read it. Everything inside it is timed off this.
      setTimeout(() => {
        setScoringAnimation(null);
      }, 2500);
    }
  }, [gameState.triggerFirstScoreAnimation]);

  // Where the centre mask is looking, in board % — driven straight from the
  // moving token's own tween (see Tokens.js) so the gaze tracks it in real
  // time. Lives as shared values so the tracking runs entirely on the UI
  // thread and never costs a React re-render per frame.
  const gazeX = useSharedValue(50);
  const gazeY = useSharedValue(50);
  // How long the token that JUST moved still has left in its hop animation
  // (a JS timestamp, ms). Tokens.js sets this the instant a move starts, to
  // now + however long that hop sequence will actually take.
  const gazeBusyUntil = useSharedValue(0);
  const gaze = useMemo(() => ({ x: gazeX, y: gazeY, busyUntil: gazeBusyUntil }), []);

  // Between turns there is no token in flight, so look over at whoever is up
  // next. Slower than the tracking tween — a glance, not a snap.
  //
  // activePlayer flips to the next seat in the SAME state update as the
  // move that just happened — passTurn runs inside movePiece — so this
  // effect fires while the piece that moved is still mid-hop, animating
  // client-side in Tokens.js over the following ~150-600ms. Firing the
  // glance immediately made the eyes flick to the next player and then
  // snap back to the still-moving token, which read as a glitch. Waiting
  // out gazeBusyUntil first means the glance only starts once that
  // animation has actually finished.
  useEffect(() => {
    if (appState !== 'GAME' || gameState.gameOver) return;
    if (gameState.turnPhase !== 'WAITING_FOR_ROLL') return;
    const target = YARD_CENTERS[gameState.activePlayer];
    if (!target) return;

    const lookOver = () => {
      gazeX.value = withTiming(target.x, { duration: 650 });
      gazeY.value = withTiming(target.y, { duration: 650 });
    };

    const remaining = gazeBusyUntil.value - Date.now();
    if (remaining <= 0) {
      lookOver();
      return undefined;
    }
    const timerId = setTimeout(lookOver, remaining);
    return () => clearTimeout(timerId);
  }, [gameState.activePlayer, gameState.turnPhase, gameState.gameOver, appState]);

  const { width, height } = useWindowDimensions();
  // Android draws the app edge to edge, so the status and navigation bars come
  // out of the height the board is sized from. Both are zero on web.
  const insets = useSafeAreaInsets();
  const isLandscape = width > height;
  // Dice rows now carry the ability charge ring + power button, so they need a
  // little more vertical room than the bare dice did.
  const boardSize = Math.min(Math.max(1, width - insets.left - insets.right - 24),
    Math.max(220, height - insets.top - insets.bottom - (isLandscape ? 150 : 235)), 540);

  // Update eligible pieces whenever state changes, and play the move that isn't
  // a decision.
  useEffect(() => {
    if (gameState.turnPhase !== 'WAITING_FOR_MOVE') {
      setEligiblePieces(NO_PIECES);
      return undefined;
    }

    const moves = getLegalMoves(gameState);
    setEligiblePieces(moves.map(p => p.id));

    // One token, one value it can spend: there is nothing to choose, so tapping
    // it is ceremony.
    // If the active player has a charged ability ready, we hold off on auto-moving
    // so they have time to decide whether to use it or not before their token moves.
    // Online, only the device running the engine may fire it, or all four would submit the same move.
    if (gameState.turnPhase !== 'WAITING_FOR_MOVE') return undefined;
    if (!drivesEngine || wallPlacingFor || isOfflinePaused || scoringAnimation) return undefined;
    if (settling) return undefined; // let the last token land first
    
    const p = gameState.players[gameState.activePlayer];
    if (p?.isBot) return undefined; // the bot effect plays those
    if (p?.abilityReady) return undefined; // wait for the human to decide about their power
    
    if (moves.length !== 1) return undefined;

    const values = getMoveValuesForPiece(gameState, moves[0].id);
    if (values.length !== 1) return undefined;

    // Long enough to see which token it was, short enough not to feel stuck.
    const id = setTimeout(() => {
      applyAction({ type: 'move', pieceId: moves[0].id, value: values[0] });
    }, 450);
    return () => clearTimeout(id);
  }, [gameState, drivesEngine, wallPlacingFor, isOfflinePaused, scoringAnimation, settling]);

  // Every route into a new state passes through here — this device's own move,
  // the host's broadcast, a resync — so the hold covers all of them rather than
  // just the local path.
  const settledPiecesRef = useRef(gameState.pieces);
  useEffect(() => {
    const ms = travelMs(settledPiecesRef.current, gameState.pieces);
    settledPiecesRef.current = gameState.pieces;
    if (ms > 0) setSettleUntil(Date.now() + ms);
  }, [gameState.pieces]);

  // Deliberately its own effect keyed on the deadline: folded into the one
  // above, a state change that moved nothing (a roll) would clear the pending
  // timer on its way past and leave the board held open for good.
  useEffect(() => {
    if (!settleUntil) return undefined;
    const id = setTimeout(() => setSettleUntil(0), Math.max(0, settleUntil - Date.now()));
    return () => clearTimeout(id);
  }, [settleUntil]);

  // Never leave placement mode dangling across a turn change.
  useEffect(() => {
    setWallPlacingFor(null);
  }, [gameState.activePlayer, gameState.gameOver, appState]);

  // Same for a half-made value choice — a prompt left open would otherwise
  // point at a token whose turn (and bank) is already gone.
  useEffect(() => {
    setChoicePieceId(null);
  }, [gameState.activePlayer, gameState.turnPhase, gameState.gameOver, appState]);

  // Handle Bot Turns
  useEffect(() => {
    if (gameState.gameOver || appState !== 'GAME' || isOfflinePaused) return;
    // Bots belong to the host alone. Every guest holds the same state and would
    // otherwise roll and move for the same bot at the same moment.
    if (!drivesEngine) return;
    // A bot that rolls while the previous token is still crossing the board is
    // most of why a computer game felt like it was tripping over itself.
    if (settling) return;

    const activePlayerId = gameState.activePlayer;
    const isBot = gameState.players[activePlayerId]?.isBot;

    if (isBot) {
      if (gameState.turnPhase === 'WAITING_FOR_ROLL') {
        const timerId = setTimeout(() => {
          applyAction({ type: 'roll' });
        }, 600);
        return () => clearTimeout(timerId);
      } else if (gameState.turnPhase === 'WAITING_FOR_MOVE') {
        // The bot picks the value as well as the token, so it never needs the
        // chooser — the choice is already made by the time this fires.
        const bestMove = getBestBotMove(gameState);
        if (bestMove) {
          const timerId = setTimeout(() => {
            applyAction({ type: 'move', pieceId: bestMove.pieceId, value: bestMove.value });
          }, 600);
          return () => clearTimeout(timerId);
        }
      } else if (gameState.turnPhase === 'WAITING_FOR_ABILITY') {
        const timerId = setTimeout(() => {
          applyAction({ type: 'skipAbility' });
        }, 400);
        return () => clearTimeout(timerId);
      }
    }
  }, [gameState, appState, drivesEngine, isOfflinePaused, settling]);

  const commit = (nextState) => {
    nextState.pieces = [...nextState.pieces.map(p => ({ ...p }))];
    nextState.players = JSON.parse(JSON.stringify(nextState.players));
    const moved = havePiecesMoved(gameState.pieces, nextState.pieces);
    gameStateRef.current = nextState;
    setGameState(nextState);
    if (gameMode === 'PASS_N_PLAY' && moved) {
      const snap = JSON.parse(JSON.stringify(nextState));
      setHistory(prev => [...prev, snap]);
      setReviewMoveIndex(null);
      setReviewPhase('AFTER');
    }
  };

  // The one place the game is allowed to change. Offline — and on the host —
  // an action goes straight into the engine. Passing an `actor` asserts whose
  // move it is meant to be, which is what stops a guest from acting out of turn
  // or on somebody else's colour. Bots and forced auto-plays pass no actor:
  // they are the host acting as referee, not as a seat.
  const applyAction = (action, actor = null) => {
    const state = gameStateRef.current;
    // Offline there is nobody to guard against, so the seat check is skipped;
    // the phase checks inside isActionAllowed still apply either way.
    if (!isActionAllowed(state, action, isOnline ? actor : null)) return;

    switch (action.type) {
      case 'roll':
        commit(rollDice({ ...state }));
        return;

      case 'move': {
        const usable = getMoveValuesForPiece(state, action.pieceId);
        if (usable.indexOf(action.value) === -1) return;
        setChoicePieceId(null);
        commit(movePiece({ ...state }, action.pieceId, action.value));
        return;
      }

      case 'shield':
        if (!canRaiseShield(state, action.player)) return;
        commit(raiseShield({ ...state }));
        return;

      case 'gust':
        if (!canSummonGust(state, action.player)) return;
        commit(summonGust({ ...state }));
        return;

      case 'fire':
        if (!canIgniteFire(state, action.player)) return;
        commit(igniteFire({ ...state }));
        return;

      case 'wall':
        if (!canPlaceWall(state, action.player)) return;
        commit(placeWall({ ...state }, action.cell));
        return;

      case 'skipAbility':
        commit(skipAbilityWindow({ ...state }));
        return;

      default:
        return;
    }
  };

  // A guest never runs the engine. It posts the action to the host and waits to
  // be told what the game looks like afterwards.
  const dispatch = (action) => {
    if (isViewingPast) return;
    if (isOnline && !isHost) {
      multiplayer.sendIntent(action);
      return;
    }
    applyAction(action, isOnline ? myPlayer : null);
  };

  const handleRollDice = useStable(() => {
    if (isViewingPast || !myTurn || isOfflinePaused) return;
    dispatch({ type: 'roll' });
  });

  // Tapping a token either moves it outright or, when the bank holds more than
  // one value it could spend, opens the chooser instead of guessing for them.
  const handlePiecePress = useStable((pieceId, forcedValue = null) => {
    if (isViewingPast || gameState.turnPhase !== 'WAITING_FOR_MOVE' || gameState.gameOver || isOfflinePaused) return;
    if (!myTurn) return;

    // Guests hold the same state as the host, so which values are spendable can
    // be worked out locally — only the chosen one needs to travel.
    const usable = getMoveValuesForPiece(gameState, pieceId);
    if (usable.length === 0) return;

    if (forcedValue === null && usable.length > 1) {
      setChoicePieceId(pieceId);
      return;
    }

    const value = forcedValue === null ? usable[0] : forcedValue;
    if (usable.indexOf(value) === -1) return;

    setChoicePieceId(null);
    dispatch({ type: 'move', pieceId, value });
  });

  // Whether this seat's button would actually do something right now. The
  // shared window (canUseAbility) is not quite the whole story: the gust is
  // refused when arming it would leave nothing playable. A button that looks
  // live and does nothing is worse than one that is plainly out.
  const canPressPower = (player) => (
    canPlaceWall(displayedState, player) ||
    canRaiseShield(displayedState, player) ||
    canIgniteFire(displayedState, player) ||
    canSummonGust(displayedState, player)
  );

  // Earth targets a tile; Water, Fire and Air go off instantly.
  const handleUsePower = useStable((player) => {
    if (isViewingPast || isOfflinePaused) return;
    // Online you may only fire your own colour's power.
    if (isOnline && player !== myPlayer) return;
    if (!canUseAbility(gameState, player)) return;

    // Earth arms a targeting mode first; nothing is dispatched until a cell is
    // picked, so this stays purely local.
    if (canPlaceWall(gameState, player)) {
      setWallPlacingFor(prev => (prev === player ? null : player));
      return;
    }

    if (canRaiseShield(gameState, player)) {
      dispatch({ type: 'shield', player });
      return;
    }

    // Fire rides the next move made, so it can be armed either side of the roll.
    if (canIgniteFire(gameState, player)) {
      dispatch({ type: 'fire', player });
      return;
    }

    if (canSummonGust(gameState, player)) {
      dispatch({ type: 'gust', player });
    }
  });

  const handleSkipAbilityWindow = useStable(() => {
    if (isViewingPast || !myTurn || isOfflinePaused) return;
    dispatch({ type: 'skipAbility' });
  });

  // Absolute, not a step: the panel already knows which kind the tap lands on,
  // and a "next" that reads the current value would fire twice on a double tap.
  const handleSetSeat = useStable((colour, kind) => {
    setSeats(prev => ({ ...prev, [colour]: kind }));
  });

  const handleWallCellSelect = useStable((cell) => {
    if (isViewingPast || !wallPlacingFor || isOfflinePaused) return;

    const player = wallPlacingFor;
    setWallPlacingFor(null);
    dispatch({ type: 'wall', player, cell });
  });

  const canUndo = history.length > 1 && (reviewMoveIndex === null || reviewMoveIndex > 1);
  const canRedo = reviewMoveIndex !== null && reviewMoveIndex < history.length - 1;

  const handleUndo = () => {
    if (history.length <= 1) return;

    if (replayTimerRef.current) {
      clearTimeout(replayTimerRef.current);
      replayTimerRef.current = null;
    }

    const targetMove = reviewMoveIndex !== null
      ? Math.max(1, reviewMoveIndex - 1)
      : history.length - 1;

    setChoicePieceId(null);
    setWallPlacingFor(null);
    setReviewMoveIndex(targetMove);
    setReviewPhase('BEFORE');

    replayTimerRef.current = setTimeout(() => {
      setReviewPhase('AFTER');
      if (targetMove === history.length - 1) {
        const ms = travelMs(history[targetMove - 1]?.pieces, history[targetMove]?.pieces) || 600;
        replayTimerRef.current = setTimeout(() => {
          setReviewMoveIndex(null);
          replayTimerRef.current = null;
        }, ms + 250);
      }
    }, 1000);
  };

  const handleRedo = () => {
    if (reviewMoveIndex === null || reviewMoveIndex >= history.length - 1) return;

    if (replayTimerRef.current) {
      clearTimeout(replayTimerRef.current);
      replayTimerRef.current = null;
    }

    const targetMove = reviewMoveIndex + 1;
    setChoicePieceId(null);
    setWallPlacingFor(null);
    setReviewMoveIndex(targetMove);
    setReviewPhase('BEFORE');

    replayTimerRef.current = setTimeout(() => {
      setReviewPhase('AFTER');
      if (targetMove === history.length - 1) {
        const ms = travelMs(history[targetMove - 1]?.pieces, history[targetMove]?.pieces) || 600;
        replayTimerRef.current = setTimeout(() => {
          setReviewMoveIndex(null);
          replayTimerRef.current = null;
        }, ms + 250);
      }
    }, 1000);
  };

  // --- Shot clock ----------------------------------------------------------

  // How long the active seat has, and therefore what the dice ring is sweeping.
  // null means no clock at all: pass-and-play (except ability window), a bot's turn (it plays instantly
  // anyway), or a phase where there is nothing to decide.
  const clockMs = (() => {
    if (gameState.gameOver || appState !== 'GAME' || isOfflinePaused) return null;
    if (gameState.players[gameState.activePlayer]?.isBot) return null;
    if (scoringAnimation) return null;
    // Your five seconds start when the board is yours, not while somebody
    // else's token is still walking across it.
    if (settling) return null;
    if (gameState.turnPhase === 'WAITING_FOR_ABILITY') return 4000;
    if (!clocked) return null;
    if (gameState.turnPhase === 'WAITING_FOR_ROLL') return ROLL_MS;
    if (gameState.turnPhase === 'WAITING_FOR_MOVE') return MOVE_MS;
    return null;
  })();

  // A new countdown starts whenever the seat or the phase changes — plus
  // pendingRolls.length, because a six re-enters WAITING_FOR_ROLL without
  // actually changing that string. Without it the ring (and the real timeout,
  // which shares this key) would keep counting down from the *first* roll of
  // the turn, so a six banked near the end left almost no time to roll again.
  //
  // Read off the state rather than bumped by an effect: the effect was a second
  // full re-render of the whole board on every phase change, for a number that
  // was already derivable. gameId covers a rematch, where nothing else does.
  const timerKey = [
    gameState.gameId, gameState.activePlayer, gameState.turnPhase,
    gameState.pendingRolls.length, isOfflinePaused, settling
  ].join(':');

  // When it runs out, the bot plays that seat's turn. Only the device driving
  // the engine runs this — otherwise four clients would each fire the timeout
  // and submit four moves.
  useEffect(() => {
    if (!clockMs || !drivesEngine || isOfflinePaused) return;

    const id = setTimeout(() => {
      const state = gameStateRef.current;
      if (state.gameOver) return;

      if (state.turnPhase === 'WAITING_FOR_ROLL') {
        applyAction({ type: 'roll' });
        return;
      }
      if (state.turnPhase === 'WAITING_FOR_MOVE') {
        // Same chooser the computer players use, so an abandoned seat plays
        // sensibly rather than randomly.
        const best = getBestBotMove(state);
        if (best) {
          applyAction({ type: 'move', pieceId: best.pieceId, value: best.value });
          return;
        }
        const moves = getLegalMoves(state);
        if (moves.length) {
          const values = getMoveValuesForPiece(state, moves[0].id);
          if (values.length) {
            applyAction({ type: 'move', pieceId: moves[0].id, value: values[0] });
            return;
          }
        }
      }
      if (state.turnPhase === 'WAITING_FOR_ABILITY') {
        applyAction({ type: 'skipAbility' });
        return;
      }
    }, clockMs);

    return () => clearTimeout(id);
  }, [clockMs, drivesEngine, timerKey, isOfflinePaused]);

  // --- Online rooms --------------------------------------------------------

  // Rebuilt per call rather than memoised: every callback reads the live game
  // through gameStateRef, so there is nothing here to go stale.
  const roomHandlers = () => ({
    onConnection: connected => {
      setOnlineConnected(connected);
      setOnlineError(connected ? null : 'Waiting for the connection or host to return...');
    },
    onMembers: (members) => setOnlineMembers(members),
    onState: (state, payload) => {
      if (!validSnapshot(state, payload)) return;
      setMatch(payload);
      matchRef.current = payload;
      gameStateRef.current = state;
      setGameState(state);
      setTeamMode(payload.mode);
      setIsHost(false);
      setOnlineCode(multiplayer.code);
      setSearching(false);
      setOnlineError(null);
      const seat = payload.assignments.find(a => a.id === multiplayer.identity);
      rememberRoom(multiplayer.code, seat?.colour);
      setAppState('GAME');
    },
    // Host side: a guest asked for something. The match decides which colour
    // they are allowed to be, and applyAction refuses anything else.
    onIntent: (intent) => {
      const dealt = matchRef.current?.assignments?.find(a => a.id === intent.from);
      if (!dealt || gameStateRef.current.activePlayer !== dealt.colour) return;
      if (intent.player && intent.player !== dealt.colour) return;
      const before = gameStateRef.current;
      applyAction(intent, dealt.colour);
      return gameStateRef.current !== before;
    },
    // Host side: somebody new turned up. They have no game yet, and the host
    // only broadcasts on a state change — which might not come for a long time
    // if it is somebody's turn to think. Push the current game at them now.
    onMemberJoined: () => {
      if (appStateRef.current === 'GAME' && matchRef.current) {
        multiplayer.publishState(gameStateRef.current, matchRef.current);
      }
    },
    // Same thing, but asked for explicitly — covers a guest whose subscription
    // was not quite live when the push above went out.
    onResyncRequest: () => {
      if (appStateRef.current !== 'GAME' || !matchRef.current) return;
      multiplayer.publishState(gameStateRef.current, matchRef.current);
    },
    // Guest side: without this you sit tapping at a game nobody is running.
    onHostLeft: () => {
      leaveOnline();
      setOnlineError('The host left, so that game has ended.');
      setAppState('LOBBY');
    },
    onError: (message) => {
      setOnlineError(message);
      setLobbyBusy(null);
    }
  });

  // The host's state is the game. Every change goes out to the room, and is
  // written to the database so a dropped player can pick the game back up.
  useEffect(() => {
    if (!isOnline || !isHost || appState !== 'GAME' || !match) return;
    multiplayer.publishState(gameState, match);

  }, [gameState, isOnline, isHost, appState, match, onlineCode, teamMode, playType]);

  const leaveOnline = () => {
    closeRoom(multiplayer.code);
    multiplayer.leave();
    leaveQueue();
    setOnlineCode(null);
    setOnlineMembers([]);
    setMatch(null);
    setIsHost(false);
    setOnlineConnected(true);
    setLobbyBusy(null);
    setSearching(false);
    setSearchStartedAt(null);
    setWaited(0);
    setQueueWaiting(0);
    setNoMatch(false);
  };

  const handleCreateRoom = async () => {
    setOnlineError(null);
    setLobbyBusy('create');
    multiplayer.displayName = username;
    const code = await multiplayer.createRoom(roomHandlers(), null, teamMode);
    setLobbyBusy(null);
    // Only claim host once the channel is actually up, or a failed create
    // leaves this device believing it is running a game that does not exist.
    setIsHost(Boolean(code));
    if (code) setOnlineCode(code);
  };

  const handleJoinRoom = async (code) => {
    setOnlineError(null);
    setLobbyBusy('join');
    multiplayer.displayName = username;
    const ok = await multiplayer.joinRoom(code, roomHandlers());
    setLobbyBusy(null);
    if (!ok) return;
    setTeamMode(multiplayer.mode);
    setIsHost(multiplayer.isHost);
    setOnlineCode(String(code).trim().toUpperCase());
    multiplayer.requestResync();
  };

  // Deals colours and starts the game. Called by the host, and by matchmaking
  // once a table is full. Empty seats become bots, which is also what makes
  // "start anyway" work in a half-empty room.
  const beginOnlineGame = (code, members) => {
    const dealt = buildMatch(members, teamMode);
    const fresh = createGame(dealt.players.length, dealt.bots, {
      players: dealt.players,
      teams: dealt.teams,
      mode: dealt.mode
    });

    setMatch(dealt);
    matchRef.current = dealt;
    gameStateRef.current = fresh;
    resetBoardChrome();
    setGameState(fresh);
    setAppState('GAME');

    const mine = dealt.assignments.find(a => a.id === multiplayer.identity);
    rememberRoom(code, mine?.colour ?? null);

  };

  const handleStartOnline = () => {
    setLobbyBusy('start');
    beginOnlineGame(onlineCode, multiplayer.members);
    setLobbyBusy(null);
  };

  // --- Matchmaking -----------------------------------------------------------

  // The elapsed count is its own second-by-second clock. It used to be a side
  // effect of the poll below, which is why it climbed 2, 4, 6.
  //
  // Gated on LOBBY exactly like the poll below it. A guest never clears
  // `searching` — the host is the one that ends the search, by starting the
  // game — so without this guard the countdown kept running underneath a
  // matchmade game and fired leaveOnline() mid-play, silently cutting the
  // guest's channel at the two-minute mark of every match it joined.
  useEffect(() => {
    if (!searching || !searchStartedAt || appState !== 'LOBBY') return;

    const tick = () => {
      const elapsed = Date.now() - searchStartedAt;
      setWaited(Math.floor(elapsed / 1000));
      if (elapsed >= SEARCH_TIMEOUT_MS) {
        // Nobody came. Drop the queue row AND any half-filled room that formed
        // along the way — leaving either behind would keep this device
        // advertised as available while it sits on a dead-end screen.
        leaveOnline();
        setNoMatch(true);
      }
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [searching, searchStartedAt, appState]);

  // The queue is polled rather than subscribed: a matchmaking row changes once,
  // and a 2s poll is far less machinery than a channel per waiting player.
  useEffect(() => {
    if (!searching || appState !== 'LOBBY') return;

    let alive = true;
    let joined = false;
    let polling = false;
    // The code this device wrote onto everyone's queue row. See below.
    let formed = null;

    const tick = async () => {
      if (!alive || polling || joined) return;
      polling = true;
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const result = await pollQueue(teamMode);
        if (!alive || joined) return;

        // Only a room we are actually in ends the search. A failed open used
        // to drop us out of the queue anyway, which left the screen spinning
        // on a room that was never joined; now the next tick simply tries
        // again, and our row still carries the code to try.
        // Forming again for a code we already formed is a retry, not a
        // second match: the room_code is already committed to every queue row,
        // so pollQueue hands it back as 'matched' from here on. Joining it as a
        // guest would leave the room with no host at all, and all of us would
        // sit there until the search timed out.
        if (result.status === 'forming' || result.code === formed) {
          formed = result.code;
          multiplayer.displayName = username;
          const code = await multiplayer.createRoom(roomHandlers(), result.code);
          if (!alive) { if (appStateRef.current !== 'GAME') multiplayer.leave(); return; }
          if (code) {
            joined = true;
            setIsHost(true);
            setOnlineCode(code);
            await leaveQueue();
          }
        } else if (result.status === 'matched') {
          multiplayer.displayName = username;
          const ok = await multiplayer.joinRoom(result.code, roomHandlers(), { announce: false });
          if (!alive) { if (appStateRef.current !== 'GAME') multiplayer.leave(); return; }
          if (ok) {
            joined = true;
            setOnlineCode(result.code);
            multiplayer.requestResync();
            await leaveQueue();
          }
        } else {
          setQueueWaiting(result.waiting || 0);
        }
      } catch (e) {
        if (alive) setOnlineError('Could not reach matchmaking. Retrying...');
      } finally { polling = false; }
    };

    tick();
    const id = setInterval(tick, 2000);
    return () => { alive = false; clearInterval(id); };
  }, [searching, appState, teamMode, username]);

  // Host of a matchmade room starts as soon as the table is full.
  useEffect(() => {
    if (!searching || !isHost || !onlineCode || appState !== 'LOBBY') return;
    if (onlineMembers.length < requiredPlayers(teamMode)) return;
    setSearching(false);
    beginOnlineGame(onlineCode, onlineMembers);
  }, [searching, isHost, onlineCode, onlineMembers, teamMode, appState]);

  // Takes the mode explicitly rather than reading teamMode, because the caller
  // sets both in the same tick and state would not have landed yet.
  const handleStartQueue = async (mode) => {
    setOnlineError(null);
    setNoMatch(false);
    setQueueWaiting(0);
    try {
      await joinQueue(mode);
      setWaited(0);
      setSearchStartedAt(Date.now());
      setSearching(true);
    } catch (e) {
      setOnlineError(e.message || 'Could not join the queue.');
    }
  };

  // --- Resume --------------------------------------------------------------

  const handleResume = async () => {
    if (!resumable) return;
    setOnlineError(null);
    setResumable(null);
    setGameMode('ONLINE');
    setPlayType('ROOM');
    setTeamMode(resumable.mode || 'FFA');

    const room = await loadRoom(resumable.code);
    if (!room || room.status !== 'playing' || !validSnapshot(room.state, room.match)) {
      await forgetRoom();
      setOnlineError('That game has already finished.');
      return;
    }

    multiplayer.displayName = username;
    const seat = room.match.assignments.find(a => a.id === multiplayer.identity);
    if (!seat) { setOnlineError('This account has no seat in that game.'); return; }
    const ok = room.host_id === multiplayer.identity
      ? await multiplayer.createRoom(roomHandlers(), resumable.code, room.mode)
      : await multiplayer.joinRoom(resumable.code, roomHandlers());
    if (!ok) return;
    setOnlineCode(resumable.code);
    setIsHost(multiplayer.isHost);
    matchRef.current = room.match;
    gameStateRef.current = room.state;
    setMatch(room.match);
    setGameState(room.state);
    setAppState('GAME');
    // Ask whoever is hosting for the live state; the snapshot may be a turn old.
    multiplayer.requestResync();
  };

  const handleDismissResume = async () => {
    setResumable(null);
    await forgetRoom();
  };

  const renderDice = (player) => {
    const diceState = isViewingPast ? gameState : displayedState;
    const playerState = diceState.players[player];
    
    // If player is not in the game (e.g. only 2 players selected in Pass N Play)
    // return an empty transparent View to maintain the flex layout without showing anything.
    if (!playerState) {
      return <View key={player} style={{ flex: 1 }} />;
    }

    const isTurn = diceState.activePlayer === player;
    // Whose turn it is, and whether that turn has actually started, are two
    // different questions while a token is still travelling. isTurn answers the
    // first — what the die should be showing — and isActive the second, which
    // is what lights it up and lets it be pressed.
    const isActive = isTurn && !settling && !isViewingPast;
    // Online, the other humans' seats are theirs to play, not this device's.
    const isMine = !isOnline || player === myPlayer;
    const isHuman = !!playerState && !playerState.isBot && isMine;

    // Air's main button is always the +6; the sweep is a second button that
    // only appears when the roll actually allows it.
    const boostIcon = !!AIR_ABILITY_PLAYERS[player];
    // What is already armed over this seat's next move, if anything.
    const badgeMode =
      hasGust(diceState, player) ? 'GUST' :
      hasFire(diceState, player) ? 'BLAZE' : null;

    // Blank only when this seat genuinely has no roll yet. A six leaves the
    // phase on WAITING_FOR_ROLL with the six banked, and the die should keep
    // showing it while the extra roll is owed rather than reverting to "?".
    const isWaitingToRoll =
      isTurn &&
      diceState.turnPhase === 'WAITING_FOR_ROLL' &&
      !diceState.gameOver &&
      diceState.pendingRolls.length === 0;
    const displayedDiceValue = isWaitingToRoll ? null : (playerState?.lastRoll ?? null);

    // Online only: each seat's power button carries its own player's picture
    // — or their name, when they have none — while it charges, and swaps it
    // for the element and READY once full. Pass N Play never shows either:
    // the seats on a shared phone are not the signed-in player's.
    const assignment = match?.assignments?.find(a => a.colour === player);
    const currentAvatarUrl = isOnline ? assignment?.avatar : null;
    const currentName = isOnline ? assignment?.name : null;

    return (
      <Dice
        player={player}
        value={displayedDiceValue}
        // This seat's own counter, not the game-wide one: only the die that
        // rolled sees it move, so the other three keep identical props and skip
        // the render entirely. Deliberately NOT gated on whose turn it is — a
        // roll with nothing playable passes the turn in the same breath, and
        // gating it meant that roll never animated at all.
        rollSeq={playerState.rollSeq ?? 0}
        isActive={isActive}
        // The charge counter, the READY state and the shot clock. Without these
        // every real game sat at 0/40, a power could never be pressed, and the
        // turn timer never appeared — only the tutorial passed them itself.
        points={playerState.points ?? 0}
        threshold={playerState.abilityThreshold ?? 40}
        abilityReady={!!playerState.abilityReady}
        timerDuration={isTurn ? clockMs : null}
        awaitingRoll={!isViewingPast && isActive && diceState.turnPhase === 'WAITING_FOR_ROLL' && !diceState.gameOver && !scoringAnimation}
        pendingRolls={!isViewingPast && isTurn ? diceState.pendingRolls : NO_ROLLS}
        // A banked six with the dice still owed: nothing on the board will
        // answer a tap until another number lands, so say so.
        mustRollAgain={
          !isViewingPast &&
          isTurn &&
          diceState.turnPhase === 'WAITING_FOR_ROLL' &&
          diceState.pendingRolls.length > 0 &&
          !diceState.gameOver
        }
        onRoll={handleRollDice}
        disabled={
          isViewingPast ||
          diceState.turnPhase !== 'WAITING_FOR_ROLL' ||
          diceState.gameOver ||
          !isActive ||
          scoringAnimation !== null ||
          settling ||
          !isHuman ||
          isOfflinePaused
        }
        timerKey={isTurn ? timerKey : ''}
        canUsePower={!isViewingPast && isHuman && canPressPower(player) && !scoringAnimation && !isOfflinePaused}
        armed={!isViewingPast && wallPlacingFor === player}
        boostIcon={boostIcon}
        badgeMode={badgeMode}
        onUsePower={handleUsePower}
        avatarUrl={currentAvatarUrl}
        playerName={currentName}
        isBurned={displayedState.burnedBy === player}
      />
    );
  };

  // --- Identity ------------------------------------------------------------

  // Where the app opens. Decided once, from whatever session came back off the
  // device, and never again — every later transition is somebody pressing
  // something.
  const openOn = async (next) => {
    // Having answered the sign-in screen before is what opens the app on the
    // home screen — asking again every launch pesters somebody who already told
    // us they wanted to play offline. Deliberately not "or there is a session":
    // a guest keeps its session across a sign-out (see auth.js), so a live
    // session no longer means the question has been answered.
    const settled = await hasOnboarded();
    setBootTarget(settled ? 'HOME' : 'AUTH');
  };

  useEffect(() => {
    const BOOT_WAIT_MS = 2500;

    // No Supabase, no session to wait for: straight to the screen that offers
    // offline play.
    if (!isSupabaseConfigured) {
      openOn(null);
      return;
    }

    const adopt = async (next) => {
      setSession(next);
      if (next?.user) {
        setIsGuest(isGuestUser(next.user));

        // Paint what this device already knows before asking the server, so the
        // name and picture are on screen at once rather than a round trip later.
        const known = await cachedProfile(next.user.id);
        if (known) {
          setUsername(known.username);
          setAvatarUrl(known.avatarUrl);
          multiplayer.init(next.user.id, known.avatarUrl);
        }

        const profile = await ensureProfile(next.user);
        setUsername(profile.username);
        setAvatarUrl(profile.avatarUrl);
        multiplayer.init(next.user.id, profile.avatarUrl);
      } else {
        multiplayer.init(null, null);
        setIsGuest(false);
        setUsername('');
        setAvatarUrl(null);
      }
    };

    // On web the provider answers on a page load of its own, so the promise
    // that started the sign-in died with the old page — the boot is what picks
    // the tokens up off the URL. It resolves to nothing on native.
    //
    // A rejection here means the reload WAS a sign-in attempt that did not
    // succeed — cancelled, denied, or failed. That is never shown as an error;
    // it sends the player straight back to the sign-in screen instead of
    // wherever a fresh launch would otherwise land (Home, if they had already
    // been onboarded before this attempt).
    completeAuthRedirect()
      .then(() => false)
      .catch(() => true)
      .then(async (cancelled) => {
        // Offline, a saved session due for refresh makes getSession() retry the
        // network for ~25s — or hang outright on Wi-Fi with no internet. The
        // first screen never waits on that: past BOOT_WAIT_MS it opens without
        // the session, and onAuthStateChange adopts it once the refresh settles.
        const late = { data: { session: null }, late: true };
        const result = await Promise.race([
          supabase.auth.getSession(),
          new Promise(resolve => setTimeout(() => resolve(late), BOOT_WAIT_MS))
        ]);
        if (!result.late) adopt(result.data.session);
        if (cancelled) setBootTarget('AUTH');
        else openOn(result.data.session);
      })
      // A session that cannot be read must not strand the player on the
      // splash: the sign-in screen, with its offline option, is always a way on.
      .catch(() => setBootTarget('AUTH'));
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, next) => { adopt(next); }
    );
    return () => subscription.unsubscribe();
  }, []);

  // Live connectivity, so PLAY ONLINE dims the moment the signal drops rather
  // than only at launch. Polled rather than subscribed because expo-network's
  // listener is not available on every platform this runs on.
  // Only home and settings ever show this, and only home gates a tap on it, so
  // that is where it is polled. It used to poll for the life of the process:
  // during a game that was a native-module round trip every four seconds, and a
  // setState that re-ran this whole component, to refresh a value no on-screen
  // pixel could depend on. Navigating back re-runs the effect, whose first act
  // is an immediate read, so the flag is never stale where it is read.
  useEffect(() => {
    if (appState !== 'HOME' && appState !== 'SETTINGS') return;
    let alive = true;
    const read = async () => {
      try {
        const state = await Network.getNetworkStateAsync();
        if (alive) setIsOnlineNetwork(Boolean(state.isInternetReachable ?? state.isConnected));
      } catch (e) {
        if (alive) setIsOnlineNetwork(true); // never lock someone out on a probe failure
      }
    };
    read();
    const id = setInterval(read, 4000);
    return () => { alive = false; clearInterval(id); };
  }, [appState]);

  // Offer to rejoin whatever game this device dropped out of.
  useEffect(() => {
    if (!session?.user) return;
    findResumableRoom().then(room => { if (room) setResumable(room); });
  }, [session]);

  // A picture picked from home or from settings. Shown at once, then saved to
  // the profile row; a failed save still keeps it on this device (updateAvatar
  // writes the local copy first) rather than throwing the pick away.
  const handlePickAvatar = async () => {
    const picture = await pickAvatar().catch(() => null);
    if (!picture) return;
    setAvatarUrl(picture);
    if (session?.user) {
      multiplayer.avatarUrl = picture;
      await updateAvatar(session.user.id, picture).catch(() => {});
    }
  };

  const runAuth = async (kind, fn) => {
    setAuthBusy(kind);
    setAuthError(null);
    try {
      await fn();
      await markOnboarded();
      setAppState('HOME');
    } catch (e) {
      // Never on screen, but in the device log (adb logcat, or the Metro
      // terminal on a development build) — the only way to tell a cancel from a
      // refusal when a sign-in quietly lands back here.
      console.warn('[auth] sign-in did not complete:', e?.message || e);
      // Cancelled, denied, or failed — the player is already looking at the
      // sign-in screen (or the settings screen a guest linked from) and
      // pressing the button again is the obvious next move, so nothing here
      // scolds them with a red banner for backing out of a browser tab.
    } finally {
      setAuthBusy(null);
    }
  };

  // --- Game lifecycle ------------------------------------------------------

  // Every entry point into a fresh game resets the same four things, so they
  // live here rather than being copy-pasted at each call site.
  // Per-game UI that must not survive into the next one.
  const resetBoardChrome = () => {
    setActivatedBases([]);
    setScoringAnimation(null);
    setChoicePieceId(null);
    setWallPlacingFor(null);
  };

  // Offline start. The table laid out on the setup screen IS the setup — which
  // colours are in, who owns them, and whether the four of them are paired.
  // Nothing is dealt here: the player already said.
  const startOfflineGame = (table = seats, paired = formation) => {
    const players = SEAT_ORDER.filter(colour => table[colour] !== SEAT_OFF);
    const bots = players.filter(colour => table[colour] === SEAT_BOT);
    if (players.length < 2 || bots.length === players.length) return;

    // Pairing is only a question with four seats: three players cannot split
    // into two sides, so a formation left over from a full table is ignored
    // rather than half-applied.
    const teams = players.length === 4 ? teamsFor(paired) : null;

    const mode = teams ? 'TEAM' : players.length === 2 ? 'DUEL' : 'FFA';
    setTeamMode(mode);
    setGameMode(bots.length === players.length - 1 ? 'VS_COMPUTER' : 'PASS_N_PLAY');
    setMatch(null);
    resetBoardChrome();
    const fresh = createGame(players.length, bots, { players, teams, mode });
    if (replayTimerRef.current) {
      clearTimeout(replayTimerRef.current);
      replayTimerRef.current = null;
    }
    setGameState(fresh);
    setHistory([JSON.parse(JSON.stringify(fresh))]);
    setReviewMoveIndex(null);
    setReviewPhase('AFTER');
    setAppState('GAME');
  };

  const handleNewGame = () => {
    // Online, a rematch is the host's call — it reshuffles the board for
    // everyone, so a guest pressing it would yank the game out from under them.
    if (isOnline) {
      if (!isHost) return;
      setIsMenuVisible(false);
      handleStartOnline();
      return;
    }

    // Straight back through the same door the game came in by, so a rematch
    // deals a fresh colour and keeps the mode. Rebuilding the state by hand
    // here is what pinned every rematch to a four-player FFA with you on GREEN,
    // whatever you had actually been playing.
    startOfflineGame();
    setIsMenuVisible(false);
  };

  const handleExitToHome = () => {
    setIsMenuVisible(false);
    if (isOnline) {
      leaveOnline();
      closeRoom(onlineCode);
      forgetRoom();
      setGameMode('PASS_N_PLAY');
    }
    setAppState('HOME');
  };

  // Animated in-app splash screen with floating avatar and mini rolling dice
  if (appState === 'BOOT') {
    return (
      <SplashScreen
        isReady={Boolean(bootTarget)}
        onFinish={() => {
          setAppState(bootTarget || 'AUTH');
        }}
      />
    );
  }

  if (appState === 'AUTH') {
    return (
      <AuthScreen
        onTutorial={onTutorial}
        busy={authBusy}
        error={authError}
        onDismissError={() => setAuthError(null)}
        // connectProvider, not a plain sign-in: if a guest is signed in on
        // this device, pressing Google upgrades that guest rather than walking
        // away from it. See auth.js.
        onGoogle={() => runAuth('google', () => connectProvider('google'))}
        onGuest={() => runAuth('guest', signInAsGuest)}
        // The escape hatch: no account, no signal, still playable. Lands on the
        // usual home screen rather than jumping straight into one mode — the
        // two modes that need an account are simply shown locked there, so what
        // signing in would buy you stays visible.
        // Never waits on the network: signing out asks the server, which with no
        // signal means ~25s of retries or a hang — on the one button that exists
        // for having no signal. Home opens now; the sign-out lands when it can.
        onPlayOffline={() => {
          markOnboarded();
          if (session) authSignOut().catch(() => {});
          setAppState('HOME');
        }}
      />
    );
  }

  if (appState === 'HOME') {
    return (
      <HomeScreen
        onTutorial={onTutorial}
        username={username}
        avatarUrl={avatarUrl}
        isGuest={isGuest}
        online={isOnlineNetwork}
        signedIn={Boolean(session)}
        resumable={resumable}
        onResume={handleResume}
        onDismissResume={handleDismissResume}
        onPickAvatar={handlePickAvatar}
        // Bought items only: the free starters made every new player's shop
        // wear a red "4" that read as unread notifications.
        ownedCount={owned.size - ownedSet([]).size}
        onStore={openShop}
        onPick={async (type) => {
          if (type === 'MATCH' || type === 'ROOM') {
            if (!isOnlineNetwork) {
              setOnlineError('You are offline. Reconnect to play online.');
              return;
            }
            if (!session) {
              setAppState('AUTH');
              return;
            }
          }
          setPlayType(type);
          if (type === 'MATCH' || type === 'ROOM') {
            // Online is Free for All, full stop. There is no mode screen to
            // stop at, so Play Online goes straight to the queue and a party
            // code goes straight to the lobby that hands one out.
            setTeamMode('FFA');
            setGameMode('ONLINE');
            setOnlineError(null);
            setAppState('LOBBY');
            if (type === 'MATCH') handleStartQueue('FFA');
            return;
          }
          // Offline: open the table with a sensible default for what was asked
          // for — a full house of people to pass around
          setSeats(defaultSeats());
          setFormation('NONE');
          setAppState('SETUP');
        }}
        onSettings={() => setAppState('SETTINGS')}
      />
    );
  }

  if (appState === 'SHOP') {
    return (
      <ShopScreen
        owned={owned}
        equipped={equipped}
        prices={storePrices}
        busyItem={busyItem}
        error={shopError}
        storeReady={billing.isStoreConfigured}
        restoring={restoring}
        onBuy={handleBuy}
        onRestore={handleRestore}
        onEquip={handleEquip}
        onDismissError={() => setShopError(null)}
        onBack={() => setAppState('HOME')}
      />
    );
  }

  // Offline setup: the board, four seats, and nothing running.
  if (appState === 'SETUP') {
    return (
      <SetupScreen
        seats={seats}
        formation={formation}
        onSetSeat={handleSetSeat}
        onFormation={setFormation}
        onStart={() => startOfflineGame()}
        onBack={() => setAppState('HOME')}
      />
    );
  }

  if (appState === 'LOBBY') {
    return (
      <LobbyScreen
        kind={playType === 'MATCH' ? 'MATCH' : 'ROOM'}
        mode={teamMode}
        code={onlineCode}
        members={onlineMembers.map(m => ({ ...m, isYou: m.id === multiplayer.identity }))}
        required={requiredPlayers(teamMode)}
        isHost={isHost}
        searching={searching}
        waited={waited}
        found={Math.max(onlineMembers.length, queueWaiting)}
        noMatch={noMatch}
        onSearchAgain={() => handleStartQueue(teamMode)}
        error={onlineError}
        busy={lobbyBusy}
        onDismissError={() => setOnlineError(null)}
        onCreate={handleCreateRoom}
        onJoin={handleJoinRoom}
        onStart={handleStartOnline}
        onBack={() => {
          // Home, not a mode screen — there is no longer one to go back to.
          leaveOnline();
          setGameMode('PASS_N_PLAY');
          setAppState('HOME');
        }}
      />
    );
  }

  if (appState === 'SETTINGS') {
    return (
      <SettingsScreen
        username={username}
        session={session}
        isGuest={isGuest}
        online={isOnlineNetwork}
        provider={accountProvider(session?.user)}
        avatarUrl={avatarUrl}
        onPickAvatar={handlePickAvatar}
        busy={authBusy}
        error={authError}
        onBack={() => setAppState('HOME')}
        // Playing offline is a state you can leave: this is the way back to the
        // screen that offers Google and guest.
        onSignInScreen={() => setAppState('AUTH')}
        // Linking keeps the account you already have — see connectProvider.
        onLink={(provider) => runAuth(provider, () => connectProvider(provider))}
        onLogout={async () => {
          setAuthBusy('logout');
          setAuthError(null);
          try {
            await authSignOut();
            await forgetRoom();
          // Signing out is the one deliberate way back to a first launch, so
          // the sign-in screen is owed again.
          await forgetOnboarded();
            setAppState('AUTH');
          } catch { setAuthError('Could not sign out. Please try again.'); }
          finally { setAuthBusy(null); }
        }}
        // Not through runAuth: that lands on HOME and keeps failures quiet, and
        // a deletion that did not happen has to say so.
        onDeleteAccount={async () => {
          setAuthBusy('delete');
          setAuthError(null);
          try {
            await deleteAccount();
            await forgetRoom();
            await forgetOnboarded();
            setAppState('AUTH');
          } catch (e) {
            setAuthError('Could not delete the account. Check your connection and try again.');
          } finally {
            setAuthBusy(null);
          }
        }}
      />
    );
  }

  return (
    <View style={styles.root}>
      {/* Same prism ground as the menus. Dice off — the board is busy enough
          without decorations drifting behind it. */}
      <Backdrop />
      <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
      {isOnline && onlineError ? <ErrorBanner>{onlineError}</ErrorBanner> : null}

      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Image 
            source={require('./assets/top-left.png')} 
            style={styles.topLeftImage}
            resizeMode="contain"
          />
        </View>
        <View style={styles.headerButtons}>
          <TouchableOpacity
            hitSlop={TAP_SLOP}
            style={[styles.iconHeaderBtn, showGrid && styles.iconHeaderBtnActive]}
            onPress={() => setShowGrid(prev => !prev)}
            accessibilityRole="button"
            accessibilityLabel={showGrid ? "Hide Grid" : "Show Grid"}
          >
            <Ionicons
              name={showGrid ? "grid" : "grid-outline"}
              size={20}
              color={showGrid ? COLORS.accent : COLORS.textMid}
            />
          </TouchableOpacity>
          <TouchableOpacity
            hitSlop={TAP_SLOP}
            style={styles.iconHeaderBtn}
            onPress={() => setIsMenuVisible(true)}
            accessibilityRole="button"
            accessibilityLabel="Open Menu"
          >
            <Ionicons name="menu-outline" size={24} color={COLORS.textHi} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.gameArea}>
        {/* Top Row Dice */}
        <View style={[styles.diceRow, { width: boardSize }]}>
          {renderDice('GREEN')}
          {renderDice('YELLOW')}
        </View>

        <View style={[styles.boardContainer, { width: boardSize, height: boardSize }]}>
          {/* Null while a token is still travelling: no dimming, no "waiting
              for a roll" shade over a board that is plainly still moving. The
              new turn's chrome lands when the token does. */}
          <LudoBoard
            showGrid={showGrid}
            activatedBases={activatedBases}
            activePlayer={settling || isViewingPast ? null : displayedState.activePlayer}
            turnPhase={settling || isViewingPast ? null : displayedState.turnPhase}
            fireTrail={displayedState.fireTrail}
            gustTrail={displayedState.gustTrail}
            skin={equipped.BOARD || 'ludo_board_classic'}
          />
          {/* Sits between the board and the tokens: over the centre X, but
              under any piece that reaches the goal. */}
          <StymiteFace gaze={gaze} boardSize={boardSize} scoringAnimation={scoringAnimation} />
          <Tokens
            pieces={displayedState.pieces}
            activePlayer={settling || isViewingPast ? null : displayedState.activePlayer}
            turnPhase={settling || isViewingPast ? null : displayedState.turnPhase}
            eligiblePieces={
              isViewingPast ||
              displayedState.players[displayedState.activePlayer]?.isBot || wallPlacingFor
                || scoringAnimation !== null || isOfflinePaused || settling
                ? NO_PIECES
                : eligiblePieces
            }
            onPiecePress={handlePiecePress}
            boardSize={boardSize}
            shieldOwner={displayedState.shield?.owner ?? null}
            gustOwner={displayedState.gust?.owner ?? null}
            fireTrail={displayedState.fireTrail}
            gustTrail={displayedState.gustTrail}
            gaze={gaze}
            choicePiece={
              !isViewingPast && choicePieceId
                ? displayedState.pieces.find(p => p.id === choicePieceId) ?? null
                : null
            }
            choiceValues={
              !isViewingPast && choicePieceId ? getMoveValuesForPiece(displayedState, choicePieceId) : []
            }
            onChooseValue={(value) => handlePiecePress(choicePieceId, value)}
            onCancelChoice={() => setChoicePieceId(null)}
          />

          <WallMarker wall={displayedState.wall} />

          {wallPlacingFor && !isViewingPast && (
            <>
              <WallPlacementLayer
                players={displayedState.turnOrder}
                onSelect={handleWallCellSelect}
                onCancel={() => setWallPlacingFor(null)}
              />
              <WallPlacementHint owner={wallPlacingFor} />
            </>
          )}

        </View>

        {/* Bottom Row Dice */}
        <View style={[styles.diceRow, { width: boardSize }]}>
          {renderDice('RED')}
          {renderDice('BLUE')}
        </View>

      </View>

      {/* Undo / Redo Footer at the bottom of the game screen (Pass 'n' Play only) */}
      {gameMode === 'PASS_N_PLAY' && (
        <View style={styles.bottomBar}>
          <TouchableOpacity
            hitSlop={TAP_SLOP}
            style={[styles.bottomHistoryBtn, !canUndo && styles.bottomHistoryBtnDisabled]}
            disabled={!canUndo}
            onPress={handleUndo}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Undo move"
          >
            <Ionicons
              name="arrow-undo"
              size={16}
              color={!canUndo ? COLORS.textDim : COLORS.textHi}
            />
            <Text
              style={[
                styles.bottomHistoryBtnText,
                !canUndo && styles.bottomHistoryBtnTextDisabled,
              ]}
            >
              Undo
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            hitSlop={TAP_SLOP}
            style={[styles.bottomHistoryBtn, !canRedo && styles.bottomHistoryBtnDisabled]}
            disabled={!canRedo}
            onPress={handleRedo}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Redo move"
          >
            <Text
              style={[
                styles.bottomHistoryBtnText,
                !canRedo && styles.bottomHistoryBtnTextDisabled,
              ]}
            >
              Redo
            </Text>
            <Ionicons
              name="arrow-redo"
              size={16}
              color={!canRedo ? COLORS.textDim : COLORS.textHi}
            />
          </TouchableOpacity>
        </View>
      )}

      <WinnerModal 
        visible={!isViewingPast && gameState.gameOver} 
        ranks={
          Object.fromEntries(
            Object.entries(gameState.players).map(([player, data]) => [player, data.rank])
          )
        }
        onNewGame={handleNewGame}
      />

      <MenuModal 
        visible={isMenuVisible}
        onResume={() => setIsMenuVisible(false)}
        onNewGame={handleNewGame}
        onExitToHome={handleExitToHome}
      />
      </ScrollView>

      {isOnline && Boolean(onlineCode) && (
        <View style={[styles.onlineRoomCodeBottom, { bottom: Math.max(insets.bottom, 8) + 4 }]} pointerEvents="none">
          <Text style={styles.onlineRoomCodeText}>Room {onlineCode}</Text>
        </View>
      )}
      </SafeAreaView>
    </View>
  );
}

// useSafeAreaInsets needs this provider above it. The shell owns its own safe areas
// because there is no native navigator here to own them.
export default function App() {
  const [tutorialVisible, setTutorialVisible] = useState(false);

  const closeTutorial = () => {
    setTutorialVisible(false);
    AsyncStorage.setItem('ludo.tutorial.seen', '1').catch(() => {
      console.warn('Tutorial preference could not be saved; it may appear on the next launch.');
    });
  };

  return (
    <SafeAreaProvider style={{ flex: 1, backgroundColor: '#08080C' }}>
      <AppInner onTutorial={() => setTutorialVisible(true)} />
      {tutorialVisible ? <Tutorial onClose={closeTutorial} /> : null}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  boot: { flex: 1, backgroundColor: COLORS.bg },
  // The game sits on the same ground as the menus rather than a white sheet, so
  // the board reads as part of the app instead of pasted onto it.
  root: {
    flex: 1,
    backgroundColor: COLORS.bg,
    overflow: 'hidden',
  },
  container: {
    flex: 1,
    backgroundColor: 'transparent',
    paddingTop: SPACE.md,
    paddingBottom: SPACE.lg,
  },
  onlineRoomCodeBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  onlineRoomCodeText: {
    fontFamily: 'Nunito-Bold',
    fontSize: 15,
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  // Game chrome only. The board, tokens and power UI below are untouched.
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACE.lg,
    paddingVertical: SPACE.sm,
    gap: SPACE.sm,
  },
  title: {
    ...TYPE.title,
    letterSpacing: 3,
    color: COLORS.textHi,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.md,
    flexShrink: 1,
  },
  topLeftImage: {
    width: 130,
    height: 65,
  },
  onlineBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.sm,
    flexShrink: 1,
  },
  onlineDot: {
    width: 12,
    height: 12,
    borderRadius: RADIUS.pill,
  },
  onlineWho: {
    ...TYPE.label,
    fontSize: 14,
    color: COLORS.textHi,
  },
  onlineTurn: {
    ...TYPE.body,
    fontSize: 11,
    color: COLORS.textMid,
    marginTop: 1,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.sm,
  },
  iconHeaderBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceHi,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  iconHeaderBtnActive: {
    backgroundColor: COLORS.accentDim,
    borderColor: COLORS.accent,
  },
  gameArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: SPACE.md,
  },
  diceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 6,
  },
  burnBanner: {
    position: 'absolute',
    top: 10,
    alignSelf: 'center',
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#FF7043',
    backgroundColor: 'rgba(0,0,0,0.85)',
    zIndex: 45,
  },
  burnBannerText: {
    color: '#FFCCBC',
    fontSize: 11,
    fontWeight: '900',
  },
  boardContainer: {
    alignSelf: 'center',
    position: 'relative',
    borderRadius: 12,
    overflow: 'visible',
    // Safety net under the board image/prefetch above — if the browser is
    // ever slow enough that the image isn't painted yet, this fills the
    // gap so tokens/dice never appear to float over blank white instead.
    backgroundColor: '#4E342E',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
    zIndex: 30,
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingVertical: 10,
    paddingHorizontal: 20,
    marginTop: 'auto',
  },
  bottomHistoryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 18,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  bottomHistoryBtnDisabled: {
    opacity: 0.25,
    backgroundColor: 'transparent',
    borderColor: 'rgba(255, 255, 255, 0.04)',
  },
  bottomHistoryBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textHi,
    letterSpacing: 0.3,
  },
  bottomHistoryBtnTextDisabled: {
    color: COLORS.textDim,
  },
});
