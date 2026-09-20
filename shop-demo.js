// What a RevenueCat CustomerInfo unlocks, and what that lets a player wear.
// This is the line between paid and free, so it is the part worth pinning.
//
//   node shop-demo.js       (or: npm run check)

const assert = require('assert');
const { purchasedIds, ownedSet, resolveEquipped, allProductIds } = require('./shop.js');

assert.deepStrictEqual(purchasedIds(null), [], 'no store answer owns nothing');

const info = {
  allPurchasedProductIdentifiers: ['ludo_board_anime', 'ludo_board_future:lifetime', 'another_apps_product'],
  entitlements: { active: {
    ludo_board_gear: { identifier: 'ludo_board_gear' },
    ludo_board_anime: { identifier: 'ludo_board_anime' },
    ludo_board_future: { identifier: 'ludo_board_future', productIdentifier: 'ludo_board_future:lifetime' }
  } }
};
assert.deepStrictEqual(
  purchasedIds(info).sort(),
  ['ludo_board_anime', 'ludo_board_future', 'ludo_board_gear']
);

const owned = ownedSet(purchasedIds(info));
assert(owned.has('ludo_board_classic'), 'free items are always owned');
assert(owned.has('ludo_board_anime'), 'bought product');
assert(owned.has('ludo_board_future'), 'bought product with a Play option suffix');
assert(owned.has('ludo_board_gear'), 'granted by entitlement');
assert(!owned.has('ludo_board_sport'), 'not bought');
assert(!owned.has('another_apps_product'), 'ids the catalog does not know are ignored');
assert.deepStrictEqual(purchasedIds({ allPurchasedProductIdentifiers: ['ludo_board_anime'], entitlements: { active: {} } }), [], 'refunded history cannot unlock a board');
assert.deepStrictEqual(purchasedIds({ entitlements: { ...info.entitlements, verification: 'FAILED' } }), [], 'failed signature cannot unlock a board');

// Nothing free is ever sent to the store, and every paid item is.
assert(!allProductIds().includes('ludo_board_classic'));
assert(allProductIds().includes('ludo_board_sport'));

// Wearing what is not owned (a refund, or an old save) falls back to nothing,
// which the board reads as Classic.
assert.strictEqual(resolveEquipped(ownedSet([]), { BOARD: 'ludo_board_anime' }).BOARD, null);
assert.strictEqual(resolveEquipped(owned, { BOARD: 'ludo_board_anime' }).BOARD, 'ludo_board_anime');

console.log('Shop ownership checks passed.');
