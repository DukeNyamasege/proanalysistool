/* =========================================================================
   MATCHESTOOL.PRO — AUTH GATE
   Market Intelligence Terminal — Access Control Layer
   ========================================================================= */

(function () {
  'use strict';

  // ---- CONFIG ----
  var DEV_EMAIL    = 'admin@matchestool.pro';
  var DEV_USERNAME = 'matchestool';
  var DEV_PASSWORD = 'MatchesPro2024';
  var CONTACT_URL   = 'https://wa.me/254722713111';
  var CONTACT_LABEL = '0722 713 111';
  var SESSION_KEY   = 'matchestool_session';

  // ---- HTML TEMPLATE ----
  var GATE_HTML = [
    '<div class="mt-auth-container">',

    '  <div class="mt-brand">',
    '    <div class="mt-brand-mark">',
    '      <span class="mt-brand-arrow">▶</span>',
    '      MATCHESTOOL.PRO',
    '    </div>',
    '    <div class="mt-brand-tagline">Professional Market Intelligence</div>',
    '    <div class="mt-brand-status">',
    '      <span class="mt-status-dot"></span>',
    '      <span>Feeds Active</span>',
    '      <span class="mt-sep">|</span>',
    '      <span class="mt-ticker-live">LIVE</span>',
    '    </div>',
    '  </div>',

    '  <div class="mt-auth-card">',
    '    <div class="mt-card-accent"></div>',
    '    <span class="mt-corner tl"></span>',
    '    <span class="mt-corner tr"></span>',
    '    <span class="mt-corner bl"></span>',
    '    <span class="mt-corner br"></span>',

    '    <div class="mt-card-header">',
    '      <div class="mt-card-eyebrow">Secure client portal</div>',
    '      <div class="mt-card-title">Welcome back</div>',
    '      <div class="mt-card-subtitle">Sign in to continue to your analytics workspace.</div>',
    '    </div>',

    '    <div class="mt-alert" id="mt-alert">',
    '      <span>&#9888;</span>',
    '      <span id="mt-alert-text">Invalid credentials</span>',
    '    </div>',

    '    <form class="mt-form" id="mt-login-form" autocomplete="on">',
    '      <div class="mt-field">',
    '        <label class="mt-label" for="mt-email">Username</label>',
    '        <div class="mt-input-wrap">',
    '          <input class="mt-input" type="text" id="mt-email" name="username" placeholder="" autocomplete="username" autocapitalize="none" autocorrect="off" inputmode="text" spellcheck="false" />',
    '          <span class="mt-input-icon">@</span>',
    '        </div>',
    '      </div>',

    '      <div class="mt-field">',
    '        <label class="mt-label" for="mt-password">Access Key</label>',
    '        <div class="mt-input-wrap">',
    '          <input class="mt-input" type="password" id="mt-password" name="password" placeholder="" autocomplete="current-password" spellcheck="false" />',
    '          <span class="mt-input-icon">&#8918;</span>',
    '        </div>',
    '      </div>',

    '      <button type="submit" class="mt-btn" id="mt-submit-btn">',
    '        <span id="mt-btn-text">Sign in securely &#8594;</span>',
    '      </button>',
    '    </form>',

    '    <div class="mt-pricing">',
    '      <div class="mt-pricing-label">Lifetime Access License</div>',
    '      <div class="mt-pricing-amount"><span class="mt-currency">$</span>100<span class="mt-currency"> USD</span></div>',
    '      <div class="mt-pricing-note">One-time payment &middot; Full terminal access</div>',
    '    </div>',

    '    <div class="mt-contact">',
    '      <span>Need access or assistance?</span>',
    '      <a href="' + CONTACT_URL + '" target="_blank" rel="noopener noreferrer" aria-label="Contact us on WhatsApp">',
    '        <svg viewBox="0 0 32 32" aria-hidden="true"><path fill="currentColor" d="M16 3A12.8 12.8 0 0 0 5.1 22.5L3.4 29l6.7-1.7A12.9 12.9 0 1 0 16 3Zm0 23.4c-2 0-3.9-.5-5.5-1.5l-.4-.2-4 .9 1-3.8-.3-.4A10.3 10.3 0 1 1 16 26.4Zm5.7-7.7c-.3-.2-1.9-.9-2.2-1-.3-.1-.5-.2-.7.2l-1 1.2c-.2.2-.4.2-.7.1-2-.9-3.4-2.5-4.3-4.4-.2-.4.2-.6.5-1 .1-.2.3-.4.4-.6.1-.2.1-.4 0-.6l-1-2.4c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.6.1-.9.4-.3.4-1.2 1.2-1.2 2.9 0 1.7 1.3 3.4 1.4 3.6.2.2 2.5 3.8 6 5.3 3.6 1.6 3.6 1.1 4.2 1 .7 0 2.1-.9 2.4-1.7.3-.9.3-1.6.2-1.7-.2-.1-.5-.2-.8-.4Z"/></svg>',
    '        <span><strong>Contact us on WhatsApp</strong><small>' + CONTACT_LABEL + '</small></span>',
    '      </a>',
    '    </div>',

    '  </div>',
    '</div>'
  ].join('\n');

  // ---- BOOT SEQUENCE ----
  var BOOT_LINES = [
    { text: '<span class="mt-prompt">matchestool@terminal</span>:~$ connect --secure', delay: 150 },
    { text: 'Initializing market data feeds... <span class="mt-ok">[OK]</span>',       delay: 350 },
    { text: 'Loading analytics engine... <span class="mt-ok">[OK]</span>',              delay: 550 },
    { text: 'Syncing tick streams... <span class="mt-info">[ACTIVE]</span>',            delay: 750 },
    { text: 'Awaiting authentication...',                                                delay: 950 }
  ];

  // ---- MATRIX RAIN (gold tones) ----
  function initMatrixRain() {
    var canvas = document.getElementById('mt-matrix-canvas');
    if (!canvas) return;
    var ctx    = canvas.getContext('2d');
    var chars  = '01MATCHESTOOL0123456789ABCDEF▲▼◆●○';
    var fontSize = 13;
    var columns = 0;
    var drops   = [];

    function resize() {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
      columns = Math.floor(canvas.width / fontSize);
      drops   = new Array(columns).fill(1).map(function () { return Math.random() * -120; });
    }
    resize();
    window.addEventListener('resize', resize);

    function draw() {
      ctx.fillStyle = 'rgba(2,4,10,0.055)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.font = fontSize + 'px monospace';
      for (var i = 0; i < drops.length; i++) {
        var char = chars[Math.floor(Math.random() * chars.length)];
        // Lead character brighter gold, trail dimmer
        if (drops[i] * fontSize > 0 && drops[i] * fontSize < canvas.height) {
          ctx.fillStyle = (Math.random() > 0.92) ? '#FCD34D' : '#92600A';
          ctx.fillText(char, i * fontSize, drops[i] * fontSize);
        }
        if (drops[i] * fontSize > canvas.height && Math.random() > 0.972) drops[i] = 0;
        drops[i]++;
      }
    }
    setInterval(draw, 55);
  }

  // ---- BOOT ANIMATION ----
  function playBootSequence() {
    var bootEl = document.getElementById('mt-boot');
    if (!bootEl) return;
    bootEl.innerHTML = '';
    BOOT_LINES.forEach(function (line) {
      var div = document.createElement('div');
      div.className = 'mt-boot-line';
      div.innerHTML = line.text;
      div.style.animationDelay = line.delay + 'ms';
      bootEl.appendChild(div);
    });
  }

  // ---- SESSION ----
  function isAuthenticated() {
    try {
      var raw  = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return false;
      var data = JSON.parse(raw);
      return data && data.token && data.expiresAt && Date.now() < data.expiresAt;
    } catch (e) { return false; }
  }

  function createSession(user) {
    var token = 'mtx-' + Date.now() + '-' + Math.random().toString(36).slice(2);
    var session = {
      token:     token,
      user:      user,
      expiresAt: Date.now() + (24 * 60 * 60 * 1000)
    };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));

    // Supabase v2 reads from localStorage key: sb-{project-ref}-auth-token
    var expiresAt = Math.floor(Date.now() / 1000) + 3600;
    var supaSession = {
      access_token:  token,
      refresh_token: 'refresh-' + Date.now(),
      expires_in:    3600,
      expires_at:    expiresAt,
      token_type:    'bearer',
      user: {
        id:             'matchestool-user-001',
        email:          user.email,
        app_metadata:   {},
        user_metadata:  { username: user.username },
        role:           'authenticated',
        aud:            'authenticated'
      }
    };
    try {
      // v2 key (project ref: xrfpqifzmsgsvrqyxygb)
      localStorage.setItem('sb-xrfpqifzmsgsvrqyxygb-auth-token', JSON.stringify(supaSession));
      // v1 key as fallback
      localStorage.setItem('supabase.auth.token', JSON.stringify(supaSession));
    } catch (e) {}
    return session;
  }

  function clearSession() {
    sessionStorage.removeItem(SESSION_KEY);
    try { localStorage.removeItem('supabase.auth.token'); } catch (e) {}
  }

  // ---- VALIDATE ----
  function validateCredentials(id, pw) {
    var uid = (id || '').trim().toLowerCase();
    return (uid === DEV_EMAIL || uid === DEV_USERNAME) && pw === DEV_PASSWORD;
  }

  // ---- SHOW / HIDE ----
  function showGate() {
    if (document.getElementById('mt-auth-gate')) return;
    document.documentElement.classList.remove('mt-auth-pending');
    document.documentElement.classList.add('mt-auth-locked');
    var gate = document.createElement('div');
    gate.id  = 'mt-auth-gate';
    gate.innerHTML = GATE_HTML;
    document.body.appendChild(gate);
    gate.addEventListener('click', function (e) { e.stopPropagation(); });
    attachFormHandlers();
    attachFocusGuard(gate);
    setTimeout(function () {
      var el = document.getElementById('mt-email');
      // Do not steal focus if a fast mobile user has already selected a field.
      if (el && !gate.contains(document.activeElement)) el.focus();
    }, 280);
  }

  function hideGate() {
    var gate = document.getElementById('mt-auth-gate');
    if (!gate) return;
    if (gate._focusGuardCleanup) gate._focusGuardCleanup();
    gate.classList.add('mt-hidden');
    setTimeout(function () { if (gate.parentNode) gate.parentNode.removeChild(gate); }, 250);
  }

  // Keep the visible login fields usable even if the application mounted below
  // the gate tries to focus one of its own controls after a delayed render.
  function attachFocusGuard(gate) {
    var email = document.getElementById('mt-email');
    var password = document.getElementById('mt-password');
    var lastField = email;
    var userEngaged = false;

    function remember(e) {
      lastField = e.currentTarget;
      userEngaged = true;
      lastField.disabled = false;
      lastField.readOnly = false;
    }
    if (email) email.addEventListener('focus', remember);
    if (password) password.addEventListener('focus', remember);

    function reclaimFocus(e) {
      if (!gate.isConnected || gate.contains(e.target) || !userEngaged) return;
      setTimeout(function () {
        if (gate.isConnected && lastField && document.activeElement !== lastField) {
          lastField.disabled = false;
          lastField.readOnly = false;
          lastField.focus({ preventScroll: true });
        }
      }, 0);
    }
    document.addEventListener('focusin', reclaimFocus, true);

    var guard = setInterval(function () {
      if (!gate.isConnected) return;
      [email, password].forEach(function (field) {
        if (!field) return;
        field.disabled = false;
        field.readOnly = false;
        field.removeAttribute('aria-disabled');
      });
      if (userEngaged && (document.activeElement === document.body || document.activeElement === document.documentElement)) {
        lastField.focus({ preventScroll: true });
      }
    }, 400);

    gate._focusGuardCleanup = function () {
      clearInterval(guard);
      document.removeEventListener('focusin', reclaimFocus, true);
    };
  }

  // ---- FORM HANDLERS ----
  function attachFormHandlers() {
    var form      = document.getElementById('mt-login-form');
    var alertEl   = document.getElementById('mt-alert');
    var alertText = document.getElementById('mt-alert-text');
    var btn       = document.getElementById('mt-submit-btn');
    var btnText   = document.getElementById('mt-btn-text');
    var emailEl   = document.getElementById('mt-email');
    var passEl    = document.getElementById('mt-password');
    if (!form) return;

    function showAlert(msg) {
      if (alertText) alertText.textContent = msg;
      if (alertEl) {
        alertEl.classList.remove('show');
        void alertEl.offsetWidth;
        alertEl.classList.add('show');
      }
    }
    function hideAlert() { if (alertEl) alertEl.classList.remove('show'); }
    function setLoading(on) {
      btn.disabled = on;
      if (on) {
        btnText.innerHTML = '<span class="mt-btn-loading"><span class="mt-spinner"></span> Authenticating...</span>';
      } else {
        btnText.innerHTML = 'Sign in securely &#8594;';
      }
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      hideAlert();
      var id = emailEl ? emailEl.value : '';
      var pw = passEl  ? passEl.value  : '';
      if (!id || !pw) { showAlert('All fields required'); return; }
      setLoading(true);
      setTimeout(function () {
        if (validateCredentials(id, pw)) {
          createSession({ email: DEV_EMAIL, username: DEV_USERNAME });
          btnText.innerHTML = '<span class="mt-btn-loading"><span class="mt-spinner"></span> Access Granted</span>';
          setTimeout(function () {
            hideGate();
            // Full reload so the Supabase client re-initialises and reads the
            // session we just wrote to localStorage (pushState won't trigger
            // a re-init of the already-running client).
            window.location.href = '/app';
          }, 700);
        } else {
          setLoading(false);
          showAlert('Access denied — invalid credentials');
          if (passEl) { passEl.value = ''; passEl.focus(); }
        }
      }, 800);
    });

    if (emailEl) emailEl.addEventListener('input', hideAlert);
    if (passEl)  passEl.addEventListener('input',  hideAlert);
    // Native form submission handles Enter reliably across desktop keyboards,
    // mobile IMEs, accessibility keyboards, and password managers.
  }

  // ---- LOGOUT ----
  window.matchestoolLogout = function () { clearSession(); showGate(); };

  // ---- INIT ----
  function init() {
    if (isAuthenticated()) {
      document.documentElement.classList.remove('mt-auth-pending', 'mt-auth-locked');
      // Refresh the Supabase mock session so the app doesn't think it's expired
      var raw = sessionStorage.getItem(SESSION_KEY);
      if (raw) {
        try { var d = JSON.parse(raw); if (d.user) createSession(d.user); } catch (e) {}
      }
      return;
    }
    showGate();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Guard against internal /auth redirects after login
  window.addEventListener('popstate', function () {
    if (window.location.pathname === '/auth' && !isAuthenticated()) showGate();
  });

})();
