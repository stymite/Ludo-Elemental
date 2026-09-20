// RevenueCat: the only part of the app that takes money. Google Play bills,
// RevenueCat checks the receipt and remembers who owns what (and caches that
// for offline launches), and this is the thin wrapper App.js talks to.
// shop.js's purchasedIds turns the CustomerInfo that comes back into item ids.
//
// The Galaxy Store build (EXPO_PUBLIC_STORE=galaxy) bills through Samsung IAP
// instead, with its own RevenueCat key.
//
// A `test_` key talks to RevenueCat's Test Store, which works in any build —
// the sideloaded preview APK and the web build included. A `goog_` key talks to
// Google Play Billing, which only answers a build installed from Play. No usable
// key and the store stays off: the shop still opens and Buy explains itself.

import { Platform } from 'react-native';
import Purchases, { PRODUCT_CATEGORY, PURCHASES_ERROR_CODE } from 'react-native-purchases';
import { GALAXY_BILLING_MODE } from 'react-native-purchases-store-galaxy';
import { allProductIds } from './shop';

const API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY || '';

// Which till this build sells through. Samsung phones cannot use Play Billing
// for a Galaxy Store install, and Play cannot bill a Galaxy one, so the store is
// chosen at build time by the profile in eas.json rather than sniffed at runtime.
const GALAXY = process.env.EXPO_PUBLIC_STORE === 'galaxy';
const STORE_NAME = GALAXY ? 'the Galaxy Store' : 'Google Play';

// A Play key on web, or an unfilled placeholder, would fail every call, so only
// a key that can work on this platform turns the store on.
export const isStoreConfigured =
  (process.env.EXPO_PUBLIC_ALLOW_TEST_STORE === 'true' && /^test_/.test(API_KEY)) ||
  (Platform.OS === 'android' && (GALAXY
    ? /^[a-z]+_[A-Za-z0-9]{10,}$/.test(API_KEY)
    : /^goog_/.test(API_KEY)));

const STORE_UNAVAILABLE = 'STORE_UNAVAILABLE';
let started = false;
const products = new Map();
let identityWork = Promise.resolve();
let desiredUser = null;
let identityReady = false;
let purchasing = false;

function start() {
  if (started || !isStoreConfigured) return started;
  try {
    Purchases.configure({
      apiKey: API_KEY,
      entitlementVerificationMode: Purchases.ENTITLEMENT_VERIFICATION_MODE.INFORMATIONAL,
      // Samsung's own billing. PRODUCTION is required for anything distributed,
      // beta tracks included; TEST would make every purchase free and fake.
      ...(GALAXY ? { store: 'GALAXY', galaxyBillingMode: GALAXY_BILLING_MODE.PRODUCTION } : {})
    });
    started = true;
  } catch {
    // A bad key must never take the app down with it; the shop reports it.
  }
  return started;
}

function unavailable() {
  return Object.assign(new Error('Store unavailable'), { code: STORE_UNAVAILABLE });
}

// Refunds, pending payments clearing, purchases made on another device.
export function watchCustomerInfo(listener) {
  if (!start()) return () => {};
  const guarded = info => { if (identityReady) listener(info); };
  Purchases.addCustomerInfoUpdateListener(guarded);
  return () => Purchases.removeCustomerInfoUpdateListener(guarded);
}

export async function getCustomerInfo() {
  if (!start()) return null;
  await identityWork;
  if (!identityReady) return null;
  return Purchases.getCustomerInfo();
}

// Localised prices from Play, so a player in Karachi sees rupees, not "$2.99".
export async function loadPrices() {
  if (!start()) return {};
  const found = await Purchases.getProducts(allProductIds(), PRODUCT_CATEGORY.NON_SUBSCRIPTION);
  const prices = {};
  found.forEach(product => {
    const id = product.identifier.split(':')[0];
    products.set(id, product);
    prices[id] = product.priceString;
  });
  return prices;
}

// Resolves with the new CustomerInfo, or null when the player backed out of the
// Play sheet — a choice, not an error.
export async function buy(itemId) {
  if (!start()) throw unavailable();
  await identityWork;
  if (!identityReady || purchasing) throw unavailable();
  purchasing = true;
  try {
  if (!products.has(itemId)) await loadPrices();
  const product = products.get(itemId);
  if (!product) {
    throw Object.assign(new Error('Not for sale'), {
      code: PURCHASES_ERROR_CODE.PRODUCT_NOT_AVAILABLE_FOR_PURCHASE_ERROR
    });
  }
  try {
    const { customerInfo } = await Purchases.purchaseStoreProduct(product);
    return customerInfo;
  } catch (e) {
    if (e && e.userCancelled) return null;
    // Owned already, just not on this install: hand it back instead of an error.
    if (e && e.code === PURCHASES_ERROR_CODE.PRODUCT_ALREADY_PURCHASED_ERROR) {
      return Purchases.restorePurchases();
    }
    throw e;
  }
  } finally { purchasing = false; }
}

export async function restore() {
  if (!start()) throw unavailable();
  await identityWork;
  if (!identityReady || purchasing) throw unavailable();
  purchasing = true;
  try { return await Purchases.restorePurchases(); }
  finally { purchasing = false; }
}

// Ties purchases to the Supabase account, so a board bought on one phone is
// there on the next. Anything bought before signing in carries over.
export function identify(userId) {
  desiredUser = userId || null;
  identityReady = false;
  const target = desiredUser;
  identityWork = identityWork.catch(() => {}).then(async () => {
    if (!start()) return null;
    let info;
    if (target) {
      info = (await Purchases.logIn(target)).customerInfo;
    } else {
      info = await Purchases.isAnonymous()
        ? await Purchases.getCustomerInfo() : await Purchases.logOut();
    }
    if (desiredUser !== target) return null;
    identityReady = true;
    return info;
  });
  return identityWork;
}

export function purchaseErrorMessage(e) {
  switch (e && e.code) {
    case STORE_UNAVAILABLE:
      return 'The store is not available in this build.';
    case PURCHASES_ERROR_CODE.NETWORK_ERROR:
      return 'Could not reach the store. Check your connection and try again.';
    case PURCHASES_ERROR_CODE.PAYMENT_PENDING_ERROR:
      return `Payment pending. The item unlocks as soon as ${STORE_NAME} confirms it.`;
    case PURCHASES_ERROR_CODE.PURCHASE_NOT_ALLOWED_ERROR:
      return `Purchases are turned off for this device or ${STORE_NAME} account.`;
    case PURCHASES_ERROR_CODE.PRODUCT_NOT_AVAILABLE_FOR_PURCHASE_ERROR:
      return 'This item is not for sale right now.';
    default:
      return 'The purchase did not go through. Please try again.';
  }
}
