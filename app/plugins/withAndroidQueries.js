const { withAndroidManifest } = require('@expo/config-plugins');

const UPI_PACKAGES = [
  'com.google.android.apps.nbu.paisa.user', // Google Pay
  'com.phonepe.app',                        // PhonePe
  'net.one97.paytm',                        // Paytm
  'in.org.npci.upiapp',                     // BHIM
  'com.whatsapp',                           // WhatsApp Pay
  'com.cred.club',                          // CRED
  'com.amazon.mShop.android.shopping',      // Amazon Pay
  'com.myairtelapp',                        // Airtel UPI
];

function withAndroidQueries(config) {
  return withAndroidManifest(config, async (config) => {
    const androidManifest = config.modResults.manifest;

    if (!androidManifest.queries) {
      androidManifest.queries = [];
    }

    let queriesTag = androidManifest.queries[0];
    if (!queriesTag) {
      queriesTag = {};
      androidManifest.queries.push(queriesTag);
    }

    // 1. Add packages
    if (!queriesTag.package) {
      queriesTag.package = [];
    }

    UPI_PACKAGES.forEach((pkg) => {
      const exists = queriesTag.package.some(
        (p) => p.$ && p.$['android:name'] === pkg
      );
      if (!exists) {
        queriesTag.package.push({
          $: { 'android:name': pkg },
        });
      }
    });

    // 2. Add generic UPI view intent for any other UPI apps
    if (!queriesTag.intent) {
      queriesTag.intent = [];
    }

    const hasUpiIntent = queriesTag.intent.some((item) => {
      const data = item.data;
      return data && data.some((d) => d.$ && d.$['android:scheme'] === 'upi');
    });

    if (!hasUpiIntent) {
      queriesTag.intent.push({
        action: [{ $: { 'android:name': 'android.intent.action.VIEW' } }],
        data: [{ $: { 'android:scheme': 'upi' } }],
      });
    }

    return config;
  });
}

module.exports = withAndroidQueries;
