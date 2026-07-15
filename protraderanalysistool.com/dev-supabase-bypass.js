/**
 * Matchestool.pro — Supabase Auth Bypass
 *
 * Intercepts Supabase auth calls from the React bundle and returns a valid
 * mock session so the app works without a live Supabase connection.
 * Remove this script tag from index.html when wiring up real Supabase.
 */

(function () {
  'use strict';

  var DEV_USER      = { email: 'admin@matchestool.pro', username: 'matchestool' };
  var DEV_PASSWORD  = 'MatchesPro2024';
  var SESSION_KEY   = 'matchestool_session';
  // Supabase v2 localStorage key (project ref: xrfpqifzmsgsvrqyxygb)
  var SUPA_KEY      = 'sb-xrfpqifzmsgsvrqyxygb-auth-token';

  var DEV_TOKEN   = 'mock-jwt-' + Date.now();
  var DEV_USER_OBJ = {
    id:            'matchestool-user-001',
    email:         DEV_USER.email,
    app_metadata:  {},
    user_metadata: { username: DEV_USER.username },
    role:          'authenticated',
    aud:           'authenticated',
  };
  var DEV_SESSION = {
    access_token:  DEV_TOKEN,
    refresh_token: 'mock-refresh-' + Date.now(),
    expires_in:    3600,
    expires_at:    Math.floor(Date.now() / 1000) + 3600,
    token_type:    'bearer',
    user:          DEV_USER_OBJ,
  };

  // Helper: check if the outer auth gate has an active session
  function isOuterAuthenticated() {
    try {
      var raw  = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return false;
      var data = JSON.parse(raw);
      return !!(data && data.token && data.expiresAt && Date.now() < data.expiresAt);
    } catch (e) { return false; }
  }

  // If outer session is active, ensure the Supabase v2 localStorage key is seeded
  // so getSession() resolves immediately without a network call.
  function ensureSupabaseSession() {
    if (!isOuterAuthenticated()) return;
    try {
      var existing = localStorage.getItem(SUPA_KEY);
      if (!existing) {
        localStorage.setItem(SUPA_KEY, JSON.stringify(DEV_SESSION));
      }
    } catch (e) {}
  }
  ensureSupabaseSession();

  // ---- Intercept Supabase fetch calls ----
  var origFetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    var url = typeof input === 'string' ? input : (input && input.url) || '';

    // POST /auth/v1/token — sign in
    if (url.indexOf('/auth/v1/token') !== -1 || url.indexOf('/token?grant_type=password') !== -1) {
      var body = {};
      try { body = JSON.parse((init && init.body) || '{}'); } catch (e) {
        var params = new URLSearchParams((init && init.body) || '');
        body = Object.fromEntries(params.entries());
      }
      var id = body.email || body.username || '';
      var pw = body.password || '';
      if ((id === DEV_USER.email || id === DEV_USER.username) && pw === DEV_PASSWORD) {
        return Promise.resolve(new Response(JSON.stringify(DEV_SESSION),
          { status: 200, headers: { 'Content-Type': 'application/json' } }));
      }
      return Promise.resolve(new Response(JSON.stringify({ message: 'Invalid login credentials', status: 400 }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      }));
    }

    // GET /auth/v1/user — session validation (Supabase v2 calls this on getSession)
    if (url.indexOf('/auth/v1/user') !== -1 && isOuterAuthenticated()) {
      return Promise.resolve(new Response(JSON.stringify(DEV_USER_OBJ),
        { status: 200, headers: { 'Content-Type': 'application/json' } }));
    }

    // POST /auth/v1/token?grant_type=refresh_token — token refresh
    if (url.indexOf('grant_type=refresh_token') !== -1 && isOuterAuthenticated()) {
      return Promise.resolve(new Response(JSON.stringify(DEV_SESSION),
        { status: 200, headers: { 'Content-Type': 'application/json' } }));
    }

    return origFetch(input, init);
  };

  // ---- Block Supabase WebSocket connections ----
  var OrigWS = window.WebSocket;
  window.WebSocket = function (url, protocols) {
    if (url && url.indexOf('supabase') !== -1) {
      var fake = { url: url, readyState: 3, OPEN: 1, CLOSED: 3 };
      fake.send = fake.close = function () {};
      fake.addEventListener = fake.removeEventListener = function () {};
      return fake;
    }
    return new OrigWS(url, protocols);
  };
  window.WebSocket.prototype  = OrigWS.prototype;
  window.WebSocket.CONNECTING = OrigWS.CONNECTING;
  window.WebSocket.OPEN       = OrigWS.OPEN;
  window.WebSocket.CLOSING    = OrigWS.CLOSING;
  window.WebSocket.CLOSED     = OrigWS.CLOSED;

  // ---- Intercept pushState: block /auth redirect if outer session exists ----
  var origPushState    = history.pushState.bind(history);
  var origReplaceState = history.replaceState.bind(history);

  function isOuterAuthenticated() {
    try {
      var raw  = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return false;
      var data = JSON.parse(raw);
      return data && data.token && data.expiresAt && Date.now() < data.expiresAt;
    } catch (e) { return false; }
  }

  history.pushState = function (state, title, url) {
    if (url === '/auth' && isOuterAuthenticated()) {
      return origPushState(state, title, '/app');
    }
    return origPushState(state, title, url);
  };

  history.replaceState = function (state, title, url) {
    if (url === '/auth' && isOuterAuthenticated()) {
      return origReplaceState(state, title, '/app');
    }
    return origReplaceState(state, title, url);
  };

})();
