// What the shop sells, and the rules about owning and wearing it. Plain CommonJS
// with no React Native and no Supabase import, so it can run cleanly everywhere.
// Everything in here is cosmetic.

const SECTIONS = [
  { key: 'BOARD', title: 'Boards', blurb: 'The table and arena you play on' },
  { key: 'DICE', title: 'Dice', blurb: 'Custom dice sets' },
  { key: 'TOKEN', title: 'Tokens', blurb: 'The coin your pieces are cut from' },
  { key: 'SYMBOL', title: 'Symbols', blurb: 'The mark stamped on your coin' }
];

const SECTION_KEYS = SECTIONS.map(s => s.key);

const DEFAULT_PRICE = '$2.99';

const BUILTIN_ITEMS = [
  // --- Boards -------------------------------------------------------------
  { id: 'ludo_board_classic', section: 'BOARD', name: 'Classic Realm', blurb: 'The timeless elemental battlefield', accent: '#3FD0C9', free: true },
  { id: 'ludo_board_anime', section: 'BOARD', name: 'Anime Dream', blurb: 'Vibrant cel-shaded manga aesthetic', accent: '#E84A5F', priceCents: 299 },
  // ludo_board_astra (Astral Cosmos) pulled from sale — a problem with this one specifically.
  // RevenueCat/Play still know the product; only the storefront stops offering it.
  { id: 'ludo_board_future', section: 'BOARD', name: 'Cyber Neon', blurb: 'High-tech cyberpunk metropolis grid', accent: '#00F0FF', priceCents: 299 },
  { id: 'ludo_board_gear', section: 'BOARD', name: 'Steampunk Clockwork', blurb: 'Intricate brass cogs and clockwork gears', accent: '#FFD426', priceCents: 299 },
  { id: 'ludo_board_spirit', section: 'BOARD', name: 'Mystic Blossom', blurb: 'Ethereal shrine bathed in cherry blossoms', accent: '#FF847C', priceCents: 299 },
  { id: 'ludo_board_sport', section: 'BOARD', name: 'Arena Champions', blurb: 'Electrifying tournament stadium turf', accent: '#46A758', priceCents: 299 },

  // --- Dice (placeholders for incoming custom dice) -----------------------
  { id: 'ludo_dice_classic', section: 'DICE', name: 'Classic Pips', blurb: 'The original elemental dice', accent: '#3FD0C9', free: true },

  // --- Tokens (placeholders for incoming custom tokens) -------------------
  { id: 'ludo_token_classic', section: 'TOKEN', name: 'Standard Bezel', blurb: 'The original metallic bezel', accent: '#3FD0C9', free: true },

  // --- Symbols (placeholders for incoming custom symbols) -----------------
  { id: 'ludo_symbol_classic', section: 'SYMBOL', name: 'Elemental Crest', blurb: 'The original elemental symbols', accent: '#3FD0C9', free: true }
];

const BUILTIN = BUILTIN_ITEMS.map(item => ({ ...item, free: Boolean(item.free) }));

let ITEMS = BUILTIN.slice();
let BY_ID = index(ITEMS);

function index(items) {
  return Object.fromEntries(items.map(item => [item.id, item]));
}

function normaliseRow(row) {
  if (!row || typeof row.id !== 'string' || !row.id) return null;
  if (!SECTION_KEYS.includes(row.section)) return null;

  return {
    id: row.id,
    section: row.section,
    name: typeof row.name === 'string' && row.name ? row.name : row.id,
    blurb: typeof row.blurb === 'string' ? row.blurb : '',
    accent: /^#[0-9A-Fa-f]{6}$/.test(row.accent || '') ? row.accent : '#8A8A99',
    free: Boolean(row.free),
    imageUrl: typeof row.image_url === 'string' && row.image_url ? row.image_url : null,
    render: row.render && typeof row.render === 'object' ? row.render : null,
    priceCents: Number.isFinite(row.price_cents) ? row.price_cents : 299,
    sort: Number.isFinite(row.sort_order) ? row.sort_order : 1000
  };
}

function mergeCatalog(rows) {
  const merged = new Map(BUILTIN.map(item => [item.id, item]));

  (Array.isArray(rows) ? rows : []).forEach(raw => {
    const row = normaliseRow(raw);
    if (!row) return;
    const builtin = merged.get(row.id);
    merged.set(row.id, builtin ? { ...row, free: Boolean(builtin.free) } : row);
  });

  const items = [...merged.values()].sort(
    (a, b) =>
      SECTION_KEYS.indexOf(a.section) - SECTION_KEYS.indexOf(b.section) ||
      (a.sort ?? 1000) - (b.sort ?? 1000) ||
      a.id.localeCompare(b.id)
  );

  return items;
}

function setCatalog(items) {
  ITEMS = Array.isArray(items) && items.length ? items : BUILTIN.slice();
  BY_ID = index(ITEMS);
  return ITEMS;
}

function allItems() {
  return ITEMS;
}

function itemsIn(sectionKey) {
  return ITEMS.filter(item => item.section === sectionKey);
}

function getItem(id) {
  return BY_ID[id] || null;
}

function allProductIds() {
  return ITEMS.filter(item => !item.free).map(item => item.id);
}

function displayPrice(item, storePrices) {
  if (!item) return '';
  if (item.free) return 'FREE';
  const fromStore = storePrices && storePrices[item.id];
  if (fromStore) return fromStore;
  if (item.section === 'BOARD' || item.priceCents) {
    return '$2.99';
  }
  return DEFAULT_PRICE;
}

function freeItemIds() {
  return ITEMS.filter(item => item.free).map(item => item.id);
}

// Item ids a RevenueCat CustomerInfo says this player owns. Both routes count:
// the Play product itself, and an active entitlement named after an item — which
// is how one bundle product can unlock several items from the dashboard alone.
// Google can suffix an id with ":option"; the item is the part before it.
function purchasedIds(customerInfo) {
  if (!customerInfo) return [];
  // Purchase history includes refunded transactions. Only active entitlements
  // grant access. Each board has a matching entitlement in RevenueCat.
  if (customerInfo.entitlements?.verification === 'FAILED') return [];
  return Object.entries(customerInfo.entitlements?.active || {})
    .filter(([id, entitlement]) => BY_ID[id] && entitlement?.verification !== 'FAILED')
    .map(([id]) => id);
}

function ownedSet(entitlementIds) {
  const owned = new Set(freeItemIds());
  (entitlementIds || []).forEach(id => {
    if (BY_ID[id]) owned.add(id);
  });
  return owned;
}

function resolveEquipped(owned, equipped) {
  const ownedSetIn = owned instanceof Set ? owned : new Set(owned || []);
  const chosen = equipped || {};
  const out = {};

  SECTION_KEYS.forEach(key => {
    const id = chosen[key] || `ludo_${key.toLowerCase()}_classic`;
    const item = id ? BY_ID[id] : null;
    out[key] = item && item.section === key && ownedSetIn.has(id) ? id : null;
  });

  return out;
}

function toggleEquipped(equipped, item) {
  if (!item) return equipped;
  const current = equipped || {};
  const wearing = current[item.section] === item.id;
  return { ...current, [item.section]: wearing ? null : item.id };
}

function renderFor(id) {
  const item = id ? BY_ID[id] : null;
  return (item && item.render) || null;
}

function baseUrlFor(id) {
  const cfg = renderFor(id);
  return cfg && typeof cfg.base === 'string' && cfg.base ? cfg.base : '';
}

function seatSkins(section, assignments, skinsById, fallback) {
  if (Array.isArray(assignments) && assignments.length) {
    return assignments
      .map(seat => {
        const worn = (skinsById && skinsById[seat.id]) || {};
        const id = worn[section];
        const item = id ? BY_ID[id] : null;
        return item && item.section === section ? `${seat.colour}=${id}` : null;
      })
      .filter(Boolean)
      .join(',');
  }

  if (!fallback) return '';
  const item = BY_ID[fallback];
  if (!item || item.section !== section) return '';
  return (Array.isArray(skinsById) ? skinsById : [])
    .map(colour => `${colour}=${fallback}`)
    .join(',');
}

function skinForSeat(packed, colour) {
  if (!packed || !colour) return '';
  for (const pair of packed.split(',')) {
    const eq = pair.indexOf('=');
    if (eq > 0 && pair.slice(0, eq) === colour) return pair.slice(eq + 1);
  }
  return '';
}

module.exports = {
  renderFor,
  baseUrlFor,
  displayPrice,
  seatSkins,
  BUILTIN,
  skinForSeat,
  SECTIONS,
  SECTION_KEYS,
  BUILTIN_ITEMS,
  DEFAULT_PRICE,
  mergeCatalog,
  setCatalog,
  allItems,
  itemsIn,
  getItem,
  allProductIds,
  freeItemIds,
  purchasedIds,
  ownedSet,
  resolveEquipped,
  toggleEquipped
};
