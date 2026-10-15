/*
 * copy-engines-boot.js — keeps copy betting / copy trading running on every page.
 *
 * The engines are browser code, so they only run while a page is open. Instead of only
 * working on copytrade.html, this loader starts them on any page where the user is
 * following an expert or a trader. Closing the browser still stops them.
 *
 * Cost for someone who follows nobody: two tiny Firestore reads per page load, and no
 * extra scripts are downloaded.
 *
 * Add to a page AFTER firebase-config.js:
 *   <script src="copy-engines-boot.js"></script>
 */
(function () {
  if (window.__piqEnginesBoot) return;
  window.__piqEnginesBoot = true;

  function loadScript(src) {
    return new Promise(function (resolve) {
      var s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = function () { console.warn('[engines] could not load', src); resolve(); };
      document.head.appendChild(s);
    });
  }

  function isActive(snap) {
    return !!(snap && snap.exists && snap.data().status === 'active');
  }

  async function boot(user) {
    var snaps;
    try {
      snaps = await Promise.all([
        db.collection('copyBetting').doc(user.uid).get(),
        db.collection('copyTrading').doc(user.uid).get()
      ]);
    } catch (e) { console.warn('[engines] follow check failed:', e.message); return; }

    // Copy betting needs vpWindow / vpProb (probability.js)
    if (isActive(snaps[0])) {
      if (typeof vpWindow === 'undefined') await loadScript('probability.js');
      if (!window.copyBettingEngine) await loadScript('copy-betting-engine.js');
      if (window.copyBettingEngine) window.copyBettingEngine.start();   // start() is safe to call twice
    }

    // Copy trading needs trading-engine.js (prices, P&L, margin helpers)
    if (isActive(snaps[1])) {
      if (typeof loadLivePrices === 'undefined') await loadScript('trading-engine.js');
      if (!window.copyTradingEngine) await loadScript('copy-trading-engine.js');
      if (window.copyTradingEngine) window.copyTradingEngine.start();
    }
  }

  var done = false;
  auth.onAuthStateChanged(function (user) {
    if (!user || user.isAnonymous || done) return;
    done = true;
    boot(user);
  });
})();
