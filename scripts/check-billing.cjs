const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict');
const { transformSync } = require('@babel/core');
const shop = require('../shop');
const code = transformSync(fs.readFileSync('purchases.js','utf8'), { configFile:false, babelrc:false, plugins:['@babel/plugin-transform-modules-commonjs'] }).code;
function setup(key='goog_test', allow='false') {
  let id='anonymous', failLogin=false, active=0, maxActive=0;
  const calls=[];
  const info=()=>({entitlements:{active:id==='A'?{ludo_board_anime:{}}:{}}});
  const sdk={
    ENTITLEMENT_VERIFICATION_MODE:{INFORMATIONAL:'INFORMATIONAL'},
    configure: opts=>calls.push(['configure',opts]),
    isAnonymous:async()=>id==='anonymous',
    getCustomerInfo:async()=>info(),
    logIn:async user=>{ calls.push(['login',user]); if(failLogin)throw Error('offline'); id=user; return {customerInfo:info()}; },
    logOut:async()=>{calls.push(['logout']);id='anonymous';return info();},
    getProducts:async()=>[{identifier:'ludo_board_anime:buy',priceString:'Rs 850'}],
    purchaseStoreProduct:async()=>{active++;maxActive=Math.max(maxActive,active);await new Promise(r=>setTimeout(r,10));active--;return {customerInfo:info()};},
    restorePurchases:async()=>info(),
    addCustomerInfoUpdateListener:()=>{},removeCustomerInfoUpdateListener:()=>{}
  };
  const exports={};
  vm.runInNewContext(code,{exports,process:{env:{EXPO_PUBLIC_REVENUECAT_API_KEY:key,EXPO_PUBLIC_ALLOW_TEST_STORE:allow}},require:name=>({
    'react-native':{Platform:{OS:'android'}},
    'react-native-purchases':{__esModule:true,default:sdk,PRODUCT_CATEGORY:{NON_SUBSCRIPTION:'NON_SUBSCRIPTION'},PURCHASES_ERROR_CODE:{}},
    './shop':shop
  })[name]});
  return {billing:exports,calls,fail:()=>{failLogin=true;},max:()=>maxActive};
}
(async()=>{
  const {billing,calls,fail,max}=setup();
  assert.equal(billing.isStoreConfigured,true);
  assert.equal(setup('test_example').billing.isStoreConfigured,false,'production cannot use Test Store');
  assert.equal(setup('test_example','true').billing.isStoreConfigured,true);
  await billing.identify('A');
  assert.deepEqual(shop.purchasedIds(await billing.getCustomerInfo()),['ludo_board_anime']);
  assert.equal((await billing.loadPrices()).ludo_board_anime,'Rs 850');
  await Promise.allSettled([billing.buy('ludo_board_anime'),billing.buy('ludo_board_anime')]);
  assert.equal(max(),1,'only one native purchase at a time');
  await billing.identify(null);
  assert(calls.some(c=>c[0]==='logout'));
  assert.deepEqual(shop.purchasedIds(await billing.getCustomerInfo()),[],'signed out user does not keep prior ownership');
  await billing.identify('B');
  assert.deepEqual(shop.purchasedIds(await billing.getCustomerInfo()),[]);
  fail();
  await assert.rejects(billing.identify('C'));
  await assert.rejects(billing.buy('ludo_board_anime'),'failed identity must block purchases');
  assert.equal(calls[0][1].entitlementVerificationMode,'INFORMATIONAL');
  console.log('Billing checks passed: Test Store gate, signed responses enabled, localized prices, purchase lock, logout isolation, account switch, failed identity.');
})().catch(e=>{console.error(e);process.exitCode=1;});
