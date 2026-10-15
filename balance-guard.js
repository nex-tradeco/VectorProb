/*
 * balance-guard.js — minimum available balance for bets, trades and copy-follows.
 *
 * Reads the balance fresh from Firestore (server) at the moment of the action, so a
 * stale page or a cached value can never let someone through (or wrongly block them).
 *
 * Load AFTER firebase-config.js:
 *   <script src="firebase-config.js"></script>
 *   <script src="balance-guard.js"></script>
 *
 * Usage:
 *   var bg = await BalanceGuard.check(currentUser.uid);
 *   if (!bg.ok) { BalanceGuard.showBlock(bg); return; }
 */
var BalanceGuard = (function () {
  var MIN = 10;   // minimum available balance (USD)

  function fmt(n) {
    return '$' + (parseFloat(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  async function freshBalance(uid) {
    var ref = db.collection('users').doc(uid);
    var snap;
    try { snap = await ref.get({ source: 'server' }); }
    catch (e) { snap = await ref.get(); }          // offline fallback (may be cached)
    return snap.exists ? (snap.data().balance || 0) : 0;
  }

  // -> { ok, balance, min, error? }   Fails closed if the balance can't be read.
  async function check(uid) {
    if (!uid) return { ok: false, balance: 0, min: MIN, error: true };
    try {
      var bal = await freshBalance(uid);
      return { ok: bal >= MIN, balance: bal, min: MIN };
    } catch (e) {
      console.warn('BalanceGuard: could not read balance', e);
      return { ok: false, balance: 0, min: MIN, error: true };
    }
  }

  function ensureModal() {
    var el = document.getElementById('bgBlockOverlay');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'bgBlockOverlay';
    el.style.cssText = 'display:none;position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.6);align-items:center;justify-content:center;padding:16px;';
    el.innerHTML =
      '<div style="max-width:360px;width:100%;background:var(--surface,#14161c);border:1px solid var(--border,#2a2d36);border-radius:16px;padding:22px;box-sizing:border-box;">' +
        '<div id="bgTitle" style="font-size:17px;font-weight:800;color:var(--text,#fff);margin-bottom:8px;"></div>' +
        '<p id="bgBody" style="font-size:14px;line-height:1.6;color:var(--text-dim,#9498a4);margin:0 0 18px;"></p>' +
        '<div style="display:flex;gap:10px;">' +
          '<a id="bgDeposit" href="portfolio.html#deposit-modal" style="flex:1;display:flex;align-items:center;justify-content:center;height:44px;border-radius:99px;background:var(--accent,#7c5cff);color:#fff;font-size:14px;font-weight:700;text-decoration:none;">Deposit</a>' +
          '<button id="bgClose" type="button" style="flex:1;height:44px;border-radius:99px;background:none;border:1px solid var(--border,#2a2d36);color:var(--text,#fff);font-size:14px;font-weight:600;font-family:inherit;cursor:pointer;">Close</button>' +
        '</div>' +
      '</div>';
    el.addEventListener('click', function (e) { if (e.target === el) el.style.display = 'none'; });
    document.body.appendChild(el);
    el.querySelector('#bgClose').addEventListener('click', function () { el.style.display = 'none'; });
    return el;
  }

  function showBlock(result) {
    var el = ensureModal();
    var title = el.querySelector('#bgTitle');
    var body  = el.querySelector('#bgBody');
    var dep   = el.querySelector('#bgDeposit');
    if (result && result.error) {
      title.textContent = 'Could not check your balance';
      body.textContent  = 'Please check your connection and try again.';
      dep.style.display = 'none';
    } else {
      title.textContent = 'Minimum balance required';
      body.textContent  = 'You need at least ' + fmt(MIN) + ' available to bet, trade or follow a copy expert. ' +
                          'Your available balance is ' + fmt(result ? result.balance : 0) + '. Make a deposit to continue.';
      dep.style.display = 'flex';
    }
    el.style.display = 'flex';
  }

  return { MIN: MIN, check: check, showBlock: showBlock };
})();
