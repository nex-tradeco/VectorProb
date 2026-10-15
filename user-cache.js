/*
 * user-cache.js — instant-paint cache for the signed-in user's header + balance.
 *
 * DISPLAY ONLY. Firebase stays the source of truth. Pages paint whatever is in
 * here immediately, then overwrite it as soon as fresh data arrives from
 * Firestore. Never use these values for validation (bets, trades, withdrawals).
 *
 * Load AFTER firebase-config.js so `auth` exists:
 *   <script src="firebase-config.js"></script>
 *   <script src="user-cache.js"></script>
 */
var UserCache = (function () {
  var LAST = 'piq_last_uid';
  var PFX  = 'piq_user_';

  function lastUid() {
    try { return localStorage.getItem(LAST); } catch (e) { return null; }
  }

  function read(uid) {
    if (!uid) return null;
    try {
      var raw = localStorage.getItem(PFX + uid);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  // Cached data for whoever was last signed in on this browser (or null).
  function readLast() {
    var uid = lastUid();
    var d = read(uid);
    return d ? { uid: uid, profile: d.profile || null, summary: d.summary || null } : null;
  }

  // Merge new fields into the cache. Only pass the fields you want stored:
  //   save(uid, { profile: {fullName, accountId, kycStatus} })
  //   save(uid, { summary: {balance, portfolio, pnl, pnlPct} })
  function save(uid, part) {
    if (!uid || !part) return;
    try {
      var cur = read(uid) || {};
      if (part.profile) cur.profile = part.profile;
      if (part.summary) cur.summary = part.summary;
      cur.ts = Date.now();
      localStorage.setItem(PFX + uid, JSON.stringify(cur));
      localStorage.setItem(LAST, uid);
    } catch (e) { /* storage full or blocked: just skip caching */ }
  }

  function clear() {
    try {
      var uid = lastUid();
      if (uid) localStorage.removeItem(PFX + uid);
      localStorage.removeItem(LAST);
    } catch (e) {}
  }

  // Self-maintaining on every page that loads this file:
  // signed out, or a different account signed in -> drop the old cache.
  if (typeof auth !== 'undefined' && auth.onAuthStateChanged) {
    auth.onAuthStateChanged(function (u) {
      if (!u) { clear(); return; }
      var prev = lastUid();
      if (prev && prev !== u.uid) clear();
    });
  }

  // ── Instant paint on every page ───────────────────────────────────────────
  // Pages already call populateHeader / populateMobileDrawer / populateDesktopDrawer once
  // Firebase returns the user doc. We (1) wrap those so each fresh call refreshes the cache,
  // and (2) call them straight away from the cache, so a signed-in user never sees the
  // logged-out header/drawer while Firebase restores the session.
  var painting = false;

  function wrapDrawerFn(name) {
    var orig = window[name];
    if (typeof orig !== 'function' || orig.__piqWrapped) return;
    var wrapped = function (ud) {
      try {
        // only real user docs (they carry accountId); skip fallbacks built from the auth profile
        if (!painting && ud && ud.accountId && typeof auth !== 'undefined' && auth.currentUser) {
          save(auth.currentUser.uid, { profile: {
            fullName: ud.fullName || '', accountId: ud.accountId || '', kycStatus: ud.kycStatus || ''
          }});
        }
      } catch (e) {}
      return orig.apply(this, arguments);
    };
    wrapped.__piqWrapped = true;
    window[name] = wrapped;
  }

  function paintFromCache() {
    var c = readLast();
    if (!c || !c.profile) return;
    painting = true;
    try {
      if (typeof window.populateHeader === 'function') {
        window.populateHeader(c.profile);            // also fills both drawers
      } else {
        if (typeof window.populateMobileDrawer  === 'function') window.populateMobileDrawer(c.profile);
        if (typeof window.populateDesktopDrawer === 'function') window.populateDesktopDrawer(c.profile);
      }
    } catch (e) { console.warn('UserCache paint error:', e); }
    painting = false;
  }

  function init() {
    wrapDrawerFn('populateHeader');
    wrapDrawerFn('populateMobileDrawer');
    wrapDrawerFn('populateDesktopDrawer');
    paintFromCache();
  }
  // DOMContentLoaded fires after every inline script has run, so the page's own
  // populate functions exist by then.
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  return { readLast: readLast, read: read, save: save, clear: clear };
})();
