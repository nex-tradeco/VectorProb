const firebaseConfig = {
  apiKey: "AIzaSyCOn2hqv8wnmaSWl0hNPewdKSL_iEZfBgc",
  authDomain: "vectorprob-58cac.firebaseapp.com",
  projectId: "vectorprob-58cac",
  storageBucket: "vectorprob-58cac.firebasestorage.app",
  messagingSenderId: "335032028025",
  appId: "1:335032028025:web:cf22377eef03d3c8297da8"
};

firebase.initializeApp(firebaseConfig);
const db   = firebase.firestore();
const auth = firebase.auth();

// ── Guest chat sessions ─────────────────────────────────────────────────────
// The support chat widget signs guests in anonymously so they get a real
// Firestore thread. Every page's auth logic assumes "signed in" means "real
// account", so hide anonymous sessions from auth.onAuthStateChanged (pages see
// them as signed-out, as before). The chat widget uses onAuthStateChangedRaw.
(function () {
  var raw = auth.onAuthStateChanged.bind(auth);
  auth.onAuthStateChangedRaw = raw;
  auth.onAuthStateChanged = function (next, error, completed) {
    if (typeof next !== 'function') return raw(next, error, completed);
    return raw(function (user) { next(user && user.isAnonymous ? null : user); }, error, completed);
  };
})();
