/* =========================================================================
   MATCHESTOOL.PRO — AUTH GATE
   Cyber-hacking themed login overlay that intercepts before the React app.
   One dev login for development. Price: $100 USD.
   ========================================================================= */

(function () {
  'use strict';

  // ---- CONFIG ----
  var DEV_EMAIL = 'dev@protraders.app';
  var DEV_USERNAME = 'dev';
  var DEV_PASSWORD = 'dev123456';
  var PRICE = '$100';
  var CURRENCY = 'USD';
  var CONTACT_URL = 'https://t.me/matchestool_pro';
  var CONTACT_LABEL = '@matchestool_pro';
  var SESSION_KEY = 'matchestool_session';
  var BOOT_KEY = 'matchestool_booted';

  // ---- HTML TEMPLATE ----
  var GATE_HTML = [
    '<canvas id="cy-matrix-canvas"></canvas>',
    '<div class="cy-auth-container">',
    '  <div class="cy-brand">',
    '    <div class="cy-brand-logo">',
    '      <span class="cy-bracket">[</span>',
    '      <span class="cy-glitch" data-text="MATCHESTOOL.PRO">MATCHESTOOL.PRO</span>',
    '      <span class="cy-bracket">]</span>',
    '    </div>',
    '    <div class="cy-brand-tagline">Advanced Market Intelligence Terminal</div>',
    '    <div class="cy-brand-status">',
    '      <span class="cy-status-dot"></span>',
    '      <span>SYSTEM ONLINE</span>',
    '    </div>',
    '  </div>',
    '',
    '  <div class="cy-auth-card">',
    '    <span class="cy-corner tl"></span>',
    '    <span class="cy-corner tr"></span>',
    '    <span class="cy-corner bl"></span>',
    '    <span class="cy-corner br"></span>',
    '',
    '    <div class="cy-card-header">',
    '      <div class="cy-card-title">// ACCESS TERMINAL</div>',
    '      <div class="cy-card-subtitle">Authenticate to enter the grid</div>',
    '    </div>',
    '',
    '    <div class="cy-alert" id="cy-alert">',
    '      <span>&#9888;</span>',
    '      <span id="cy-alert-text">Invalid credentials</span>',
    '    </div>',
    '',
    '    <form class="cy-form" id="cy-login-form" autocomplete="off">',
    '      <div class="cy-field">',
    '        <label class="cy-label" for="cy-email">Email or Username</label>',
    '        <div class="cy-input-wrap">',
    '          <input class="cy-input" type="text" id="cy-email" name="email" placeholder="user@domain.com" autocomplete="off" spellcheck="false" />',
    '          <span class="cy-input-icon">&#9993;</span>',
    '        </div>',
    '      </div>',
    '',
    '      <div class="cy-field">',
    '        <label class="cy-label" for="cy-password">Access Key</label>',
    '        <div class="cy-input-wrap">',
    '          <input class="cy-input" type="password" id="cy-password" name="password" placeholder="••••••••••••" autocomplete="off" spellcheck="false" />',
    '          <span class="cy-input-icon">&#128273;</span>',
    '        </div>',
    '      </div>',
    '',
    '      <button type="submit" class="cy-btn" id="cy-submit-btn">',
    '        <span id="cy-btn-text">// INITIATE LOGIN</span>',
    '      </button>',
    '    </form>',
    '',
    '    <div class="cy-pricing">',
    '      <div class="cy-pricing-label">Lifetime Access License</div>',
    '      <div class="cy-pricing-amount"><span class="cy-currency">$</span>100<span class="cy-currency"> USD</span></div>',
    '      <div class="cy-pricing-note">One-time payment &middot; Full terminal access</div>',
    '    </div>',
    '',
    '    <div class="cy-contact">',
    '      <div>Purchase access &middot; Contact:</div>',
    '      <a href="' + CONTACT_URL + '" target="_blank" rel="noopener noreferrer">' + CONTACT_LABEL + ' &rarr;</a>',
    '    </div>',
    '',
    '    <div class="cy-dev-hint">',
    '      <strong>DEV MODE</strong> &mdash; Email: <strong>' + DEV_EMAIL + '</strong> &middot; Password: <strong>' + DEV_PASSWORD + '</strong>',
    '    </div>',
    '',
    '    <div class="cy-boot" id="cy-boot"></div>',
    '  </div>',
    '</div>'
  ].join('\n');

  // ---- BOOT SEQUENCE TEXT ----
  var BOOT_LINES = [
    { text: '<span class="cy-prompt">root@matchestool</span>:~$ init --terminal', delay: 200 },
    { text: 'Loading kernel modules... <span class="cy-ok">[OK]</span>', delay: 400 },
    { text: 'Establishing secure connection... <span class="cy-ok">[OK]</span>', delay: 600 },
    { text: 'Market data feeds... <span class="cy-ok">[ACTIVE]</span>', delay: 800 },
    { text: 'Awaiting authentication...', delay: 1000 }
  ];

  // ---- MATRIX RAIN ----
  function initMatrixRain() {
    var canvas = document.getElementById('cy-matrix-canvas');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    var chars = '01アカサタナハマヤラワ0123456789ABCDEF';
    var fontSize = 14;
    var columns = 0;
    var drops = [];

    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      columns = Math.floor(canvas.width / fontSize);
      drops = new Array(columns).fill(1).map(function () { return Math.random() * -100; });
    }
    resize();
    window.addEventListener('resize', resize);

    function draw() {
      ctx.fillStyle = 'rgba(3, 6, 13, 0.05)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#00f0ff';
      ctx.font = fontSize + 'px monospace';
      for (var i = 0; i < drops.length; i++) {
        var char = chars[Math.floor(Math.random() * chars.length)];
        ctx.fillText(char, i * fontSize, drops[i] * fontSize);
        if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) drops[i] = 0;
        drops[i]++;
      }
    }
    var interval = setInterval(draw, 50);

    return function () { clearInterval(interval); };
  }

  // ---- BOOT TEXT ANIMATION ----
  function playBootSequence() {
    var bootEl = document.getElementById('cy-boot');
    if (!bootEl) return;
    bootEl.innerHTML = '';
    BOOT_LINES.forEach(function (line, i) {
      var div = document.createElement('div');
      div.className = 'cy-boot-line';
      div.innerHTML = line.text;
      div.style.animationDelay = line.delay + 'ms';
      bootEl.appendChild(div);
    });
  }

  // ---- SESSION MANAGEMENT ----
  function isAuthenticated() {
    try {
      var raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return false;
      var data = JSON.parse(raw);
      if (!data || !data.token || !data.expiresAt) return false;
      return Date.now() < data.expiresAt;
    } catch (e) {
      return false;
    }
  }

  function createSession(user) {
    var session = {
      token: 'mtx-' + Date.now() + '-' + Math.random().toString(36).slice(2),
      user: user,
      expiresAt: Date.now() + (24 * 60 * 60 * 1000)
    };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));

    // Also seed the supabase mock session so the React app picks it up
    var supabaseSession = {
      access_token: session.token,
      refresh_token: 'refresh-' + Date.now(),
      expires_in: 3600,
      token_type: 'bearer',
      user: {
        id: 'dev-user-001',
        email: user.email,
        app_metadata: {},
        user_metadata: { username: user.username },
        role: 'authenticated',
        aud: 'authenticated'
      }
    };
    try {
      localStorage.setItem('supabase.auth.token', JSON.stringify(supabaseSession));
    } catch (e) {}

    return session;
  }

  function clearSession() {
    sessionStorage.removeItem(SESSION_KEY);
    try { localStorage.removeItem('supabase.auth.token'); } catch (e) {}
  }

  // ---- AUTH VALIDATION ----
  function validateCredentials(emailOrUser, password) {
    var id = (emailOrUser || '').trim().toLowerCase();
    var pw = password || '';
    return (
      (id === DEV_EMAIL || id === DEV_USERNAME) && pw === DEV_PASSWORD
    );
  }

  // ---- SHOW/HIDE GATE ----
  function showGate() {
    var existing = document.getElementById('cy-auth-gate');
    if (existing) return;

    var gate = document.createElement('div');
    gate.id = 'cy-auth-gate';
    gate.innerHTML = GATE_HTML;
    document.body.appendChild(gate);

    // Prevent the React app from receiving events
    gate.addEventListener('click', function (e) { e.stopPropagation(); });

    initMatrixRain();
    playBootSequence();
    attachFormHandlers();

    // Focus email field
    setTimeout(function () {
      var emailInput = document.getElementById('cy-email');
      if (emailInput) emailInput.focus();
    }, 300);
  }

  function hideGate() {
    var gate = document.getElementById('cy-auth-gate');
    if (gate) {
      gate.classList.add('cy-hidden');
      setTimeout(function () {
        if (gate.parentNode) gate.parentNode.removeChild(gate);
      }, 300);
    }
  }

  // ---- FORM HANDLERS ----
  function attachFormHandlers() {
    var form = document.getElementById('cy-login-form');
    var alertEl = document.getElementById('cy-alert');
    var alertText = document.getElementById('cy-alert-text');
    var btn = document.getElementById('cy-submit-btn');
    var btnText = document.getElementById('cy-btn-text');
    var emailInput = document.getElementById('cy-email');
    var passwordInput = document.getElementById('cy-password');

    if (!form) return;

    function showAlert(msg) {
      if (alertText) alertText.textContent = msg;
      if (alertEl) {
        alertEl.classList.remove('show');
        void alertEl.offsetWidth; // reflow to restart animation
        alertEl.classList.add('show');
      }
    }

    function hideAlert() {
      if (alertEl) alertEl.classList.remove('show');
    }

    function setLoading(loading) {
      if (loading) {
        btn.disabled = true;
        if (btnText) {
          btnText.innerHTML = '<span class="cy-btn-loading"><span class="cy-spinner"></span> AUTHENTICATING...</span>';
        }
      } else {
        btn.disabled = false;
        if (btnText) btnText.textContent = '// INITIATE LOGIN';
      }
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      hideAlert();

      var emailOrUser = emailInput ? emailInput.value : '';
      var password = passwordInput ? passwordInput.value : '';

      if (!emailOrUser || !password) {
        showAlert('All fields required');
        return;
      }

      setLoading(true);

      // Simulate network delay for terminal feel
      setTimeout(function () {
        if (validateCredentials(emailOrUser, password)) {
          var user = {
            email: DEV_EMAIL,
            username: DEV_USERNAME
          };
          createSession(user);

          // Show success state
          if (btnText) {
            btnText.innerHTML = '<span class="cy-btn-loading"><span class="cy-spinner"></span> ACCESS GRANTED</span>';
          }

          setTimeout(function () {
            hideGate();
            // Try to navigate to /app if the React router is listening
            try {
              if (window.history && window.history.pushState) {
                window.history.pushState({}, '', '/app');
                window.dispatchEvent(new PopStateEvent('popstate'));
              }
            } catch (e) {}

            // Fallback: reload to let the app pick up the session
            setTimeout(function () {
              if (window.location.pathname !== '/app') {
                window.location.href = '/app';
              }
            }, 500);
          }, 800);
        } else {
          setLoading(false);
          showAlert('Access denied — invalid credentials');
          if (passwordInput) {
            passwordInput.value = '';
            passwordInput.focus();
          }
        }
      }, 900);
    });

    // Hide alert on input
    if (emailInput) emailInput.addEventListener('input', hideAlert);
    if (passwordInput) passwordInput.addEventListener('input', hideAlert);

    // Enter key on password triggers submit (native form behavior, but ensure)
    if (passwordInput) {
      passwordInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          form.dispatchEvent(new Event('submit', { cancelable: true }));
        }
      });
    }
  }

  // ---- LOGOUT SUPPORT ----
  window.matchestoolLogout = function () {
    clearSession();
    showGate();
  };

  // ---- INIT ----
  function init() {
    if (isAuthenticated()) {
      // Already logged in — ensure supabase mock session exists
      var raw = sessionStorage.getItem(SESSION_KEY);
      if (raw) {
        try {
          var data = JSON.parse(raw);
          if (data.user) createSession(data.user);
        } catch (e) {}
      }
      return;
    }

    // Not authenticated — show the gate
    // Use a small delay to let the DOM settle
    setTimeout(showGate, 100);
  }

  // Run on DOMContentLoaded or immediately if already loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Also check on route changes (in case the React app redirects to /auth)
  var lastPath = window.location.pathname;
  window.addEventListener('popstate', function () {
    if (window.location.pathname === '/auth' && !isAuthenticated()) {
      showGate();
    }
    lastPath = window.location.pathname;
  });

})();
