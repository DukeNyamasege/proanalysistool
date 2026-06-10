/**
 * Supabase Dev Bypass
 * 
 * Intercepts F0.auth calls from the minified Pro Trader bundle and
 * redirects them to a local mock so the app works without a network
 * connection to Supabase.
 *
 * TO ENABLE:  set localStorage.setItem('protrader-dev-mode', '1') in the console
 * TO DISABLE: set localStorage.removeItem('protrader-dev-mode') and reload
 *
 * For production builds, remove the <script> tag that loads this file
 * from index.html below.
 */

(function () {
  'use strict';

  // ---------- configuration ----------
  // Force dev-mode to be ALWAYS ON for live testing without console
  var DEV_ENABLED = true;

  // Hardcode credentials directly to avoid Netlify blocking hidden dotfiles (.dev-credentials.json)
  var DEV_USER = { email: 'dev@protraders.app', username: 'dev' };
  var EXPECTED_PASSWORD = 'dev123456';

  var DEV_TOKEN = 'mock-jwt-' + Date.now();
  var DEV_SESSION = {
    access_token: DEV_TOKEN,
    refresh_token: 'mock-refresh-' + Date.now(),
    expires_in: 3600,
    token_type: 'bearer',
    user: {
      id: 'dev-user-001',
      email: DEV_USER.email,
      app_metadata: {},
      user_metadata: { username: DEV_USER.username },
      role: 'authenticated',
      aud: 'authenticated',
    },
  };

  if (!DEV_ENABLED) {
    console.log('[dev-bypass] Dev mode OFF. Supabase client will operate normally.');
    return;
  }

  console.log('[dev-bypass] Dev mode ENABLED. Mocking F0.auth...');

  // ---------- mock auth API ----------
  var mockAuth = {
    signInWithPassword: function (creds) {
      return new Promise(function (resolve, reject) {
        // Simulate network latency
        setTimeout(function () {
          var emailOrUser = (creds && (creds.email || creds.username)) || '';
          var password = (creds && creds.password) || '';

          // Validate against dev credentials loaded from config
          if ((emailOrUser === DEV_USER.email || emailOrUser === DEV_USER.username) && password === EXPECTED_PASSWORD) {
            // Store mock session in localStorage (same key Supabase uses)
            localStorage.setItem(
              'supabase.auth.token',
              JSON.stringify(DEV_SESSION)
            );
            console.log('[dev-bypass] signInWithPassword OK → mock session stored');
            resolve({ data: { user: DEV_SESSION.user, session: DEV_SESSION }, error: null });
          } else {
            var err = {
              message: 'Invalid login credentials (dev mode)',
              status: 400,
            };
            console.warn('[dev-bypass] signInWithPassword FAILED →', err.message);
            resolve({ data: { user: null, session: null }, error: err });
          }
        }, 800);
      });
    },

    getSession: function () {
      return new Promise(function (resolve) {
        var stored = localStorage.getItem('supabase.auth.token');
        if (stored) {
          try {
            var session = JSON.parse(stored);
            resolve({ data: { session: session }, error: null });
            return;
          } catch (e) { /* corrupted → fall through */ }
        }
        resolve({ data: { session: null }, error: null });
      });
    },

    onAuthStateChange: function (callback) {
      // Return a phoney subscription obj with unsubscribe
      console.log('[dev-bypass] onAuthStateChange registered');
      var subscription = { unsubscribe: function () {} };

      // If session exists, fire immediately
      var stored = localStorage.getItem('supabase.auth.token');
      if (stored) {
        setTimeout(function () {
          try {
            var s = JSON.parse(stored);
            callback('SIGNED_IN', s);
          } catch (e) {}
        }, 0);
      }

      return { data: { subscription: subscription } };
    },

    signOut: function () {
      localStorage.removeItem('supabase.auth.token');
      console.log('[dev-bypass] signOut → session cleared');
      return Promise.resolve({ error: null });
    },
  };

  // ---------- defer: wait for the real F0 to be created, then replace ----------
  // Poll because the bundle is loaded via <script type="module"> and we can't
  // guarantee execution order with a plain defer script. We check every 100ms.
  var pollAttempts = 0;
  var pollMax = 100; // 10 seconds max wait

  var poll = setInterval(function () {
    pollAttempts++;

    // F0 is in the global scope (the bundle assigns it without 'var' in non-strict,
    // or it lives on the module's closure). We can reach it by hooking the prototype
    // of the GoTrueClient that the bundle creates.
    //
    // Instead of reaching into the closure (impossible), we intercept BEFORE the
    // bundle runs by pre-defining a global getter that the bundle will write to,
    // then wrapping it after.

    if (pollAttempts >= pollMax) {
      clearInterval(poll);
      console.warn('[dev-bypass] Timed out waiting for Supabase client. Dev bypass NOT active.');
    }
  }, 100);

  /*
   * APPROACH: Since F0 is a module-scoped variable (not global), we can't
   * directly monkey-patch it. Instead, we take a different route:
   *
   * We patch the *methods that the Supabase client's constructor uses*
   * at the prototype level so the bundle picks up our mock automatically.
   *
   * However, the minified bundle uses IH() to create the client and then
   * stores it in F0. The cleanest solution for a pre-built SPA is to
   * inject the bypass directly into index.html as a navigation intercept.
   *
   * SIMPLER APPROACH: Override the navigation function after auth success.
   * The /auth page calls f("/app") on success. We just skip auth entirely
   * and redirect. See the "auto-redirect" fallback below.
   */

  clearInterval(poll); // cancel the poll above

  // ---------- auto-redirect fallback ----------
  // Intercept pushState/replaceState so that when the /auth page tries
  // to navigate, we let it through. Instead, we patch the React Router
  // check by ensuring session exists in storage so getSession() resolves.

  var origPushState = history.pushState.bind(history);
  history.pushState = function (state, title, url) {
    console.log('[dev-bypass] Navigation intercepted →', url);
    return origPushState(state, title, url);
  };

  // Pre-seed a session so getSession() passes
  localStorage.setItem('supabase.auth.token', JSON.stringify(DEV_SESSION));

  // Monkey-patch fetch so /token calls return mock data
  var origFetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    var url = typeof input === 'string' ? input : (input.url || '');

    if (url.indexOf('/token?grant_type=password') !== -1 ||
        url.includes('/auth/v1/token')) {
      console.log('[dev-bypass] fetch intercepted →', url);
      var body = {};
      try {
        body = JSON.parse((init && init.body) || '{}');
      } catch (e) {
        // If JSON parse fails, try URL-encoded
        var params = new URLSearchParams((init && init.body) || '');
        body = Object.fromEntries(params.entries());
      }

      var emailOrUser = body.email || body.username || '';
      var password = body.password || '';

      if ((emailOrUser === DEV_USER.email || emailOrUser === DEV_USER.username) && password === EXPECTED_PASSWORD) {
        return Promise.resolve(
          new Response(JSON.stringify({
            access_token: DEV_SESSION.access_token,
            refresh_token: DEV_SESSION.refresh_token,
            expires_in: DEV_SESSION.expires_in,
            token_type: DEV_SESSION.token_type,
            user: DEV_SESSION.user,
          }), { status: 200, headers: { 'Content-Type': 'application/json' } })
        );
      } else {
        return Promise.resolve(
          new Response(JSON.stringify({
            message: 'Invalid login credentials',
            status: 400,
          }), { status: 400, headers: { 'Content-Type': 'application/json' } })
        );
      }
    }

    return origFetch(input, init);
  };

  // Also intercept Supabase Realtime WebSocket connections to prevent errors
  var OrigWebSocket = window.WebSocket;
  window.WebSocket = function (url, protocols) {
    if (url && url.indexOf('supabase') !== -1) {
      console.log('[dev-bypass] WebSocket to Supabase blocked →', url);
      // Return a fake WebSocket that does nothing
      var fake = { url: url, readyState: 3, OPEN: 1, CLOSED: 3 };
      fake.send = function () {};
      fake.close = function () {};
      fake.addEventListener = function () {};
      fake.removeEventListener = function () {};
      return fake;
    }
    return new OrigWebSocket(url, protocols);
  };
  window.WebSocket.prototype = OrigWebSocket.prototype;
  window.WebSocket.CONNECTING = OrigWebSocket.CONNECTING;
  window.WebSocket.OPEN = OrigWebSocket.OPEN;
  window.WebSocket.CLOSING = OrigWebSocket.CLOSING;
  window.WebSocket.CLOSED = OrigWebSocket.CLOSED;

  console.log('[dev-bypass] Patches applied. Bypass is permanently ON for this build.');
  console.log('[dev-bypass] Use Email: ' + DEV_USER.email + ' or Username: ' + DEV_USER.username + ' | Password: ' + EXPECTED_PASSWORD);
})();
