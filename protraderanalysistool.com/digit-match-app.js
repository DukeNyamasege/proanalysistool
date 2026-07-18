(function () {
  'use strict';

  // Deriv's public market-data compatibility endpoint; no account token is used.
  var PUBLIC_WS = 'wss://ws.derivws.com/websockets/v3?app_id=1089';
  var SAMPLE_SIZE = 1000;
  var SIGNAL_TTL = 30;
  var WATCHLIST = ['R_10','R_25','R_50','R_75','R_100','1HZ10V','1HZ25V','1HZ50V','1HZ75V','1HZ100V'];
  var state = {
    ws: null, markets: [], data: {}, req: {}, reqId: 10, connected: false,
    scanned: 0, signal: null, signalTimer: null, outcomes: [], reconnect: null, displayReady: false,
    lastSignalSymbol: null, consecutiveSignals: 0, totalWins: 0, totalLosses: 0
  };

  function el(id) { return document.getElementById(id); }
  function esc(value) { return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) { return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]; }); }
  function pct(value) { return Number(value || 0).toFixed(1) + '%'; }
  function nowTime(epoch) { return new Date((epoch || Date.now() / 1000) * 1000).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit', second:'2-digit'}); }
  function marketName(m) { return m && (m.display_name || m.symbol) || '—'; }
  function send(payload, meta) {
    if (!state.ws || state.ws.readyState !== 1) return;
    payload.req_id = ++state.reqId;
    if (meta) state.req[payload.req_id] = meta;
    state.ws.send(JSON.stringify(payload));
  }

  function template() {
    return '<div class="dm-shell">' +
      '<header class="dm-topbar"><div class="dm-brand"><span class="dm-logo">M</span><div><strong>MATCHESTOOL.PRO</strong><small>Digit Match Strategy Engine</small></div></div>' +
      '<div class="dm-top-actions"><button id="dm-logout">Log out</button></div></header>' +
      '<main class="dm-main">' +
        '<section class="dm-strategy-strip"><div><span class="dm-kicker">Live watchlist</span><strong>10 Volatility markets</strong><small>V10 · V25 · V50 · V75 · V100 · Standard + 1s</small></div><div class="dm-strip-rule"><span>Signal rule</span><strong>1 tick</strong><small>30-second entry window</small></div></section>' +
        '<section class="dm-grid dm-signal-only">' +
          '<article class="dm-panel dm-signal-panel"><div class="dm-panel-heading"><div><span class="dm-kicker">Top-ranked opportunity</span><h2>Live strategy signal</h2></div><span class="dm-badge" id="dm-signal-state">SCANNING</span></div>' +
            '<div class="dm-signal-empty" id="dm-signal-empty"><div class="dm-radar"><i></i><i></i><span>0–9</span></div><strong id="dm-analysis-title">Connecting to market data</strong><p id="dm-analysis-status">Opening a secure public data stream…</p><div class="dm-analysis-progress"><i id="dm-analysis-bar"></i></div><div class="dm-analysis-steps"><span id="dm-step-connect">Connect</span><span id="dm-step-history">Load ticks</span><span id="dm-step-compare">Compare</span><span id="dm-step-lock">Lock signal</span></div></div>' +
            '<div class="dm-signal" id="dm-signal" hidden><div class="dm-signal-market"><span>Market</span><strong id="dm-signal-market">—</strong><small id="dm-signal-symbol">—</small></div>' +
              '<div class="dm-digit-call"><span>MATCH DIGIT</span><strong id="dm-signal-digit">—</strong></div>' +
              '<div class="dm-signal-metrics"><div><span>Historical frequency</span><strong id="dm-signal-frequency">—</strong></div><div><span>Occurrences</span><strong id="dm-signal-occurrences">—</strong></div><div><span>Sample</span><strong id="dm-signal-sample">—</strong></div></div>' +
              '<div class="dm-confidence"><div><span>Observed edge over 10% baseline</span><strong id="dm-edge">—</strong></div><div class="dm-progress"><i id="dm-edge-bar"></i></div></div>' +
              '<button class="dm-activate" id="dm-activate">Start signal <span>30-second observation</span></button>' +
              '<div class="dm-active-trade" id="dm-active-trade" hidden><div class="dm-countdown-row"><span>Signal closes in</span><strong id="dm-countdown">30</strong></div><p>Target <b id="dm-active-digit">—</b> on <b id="dm-active-market">—</b></p><div class="dm-live-title"><span>Live appearing digits</span><strong id="dm-match-status">WAITING FOR MATCH</strong></div><div class="dm-live-digits" id="dm-live-digits"><span>Waiting for live ticks…</span></div></div>' +
            '</div>' +
          '</article>' +
        '</section>' +
        '<section class="dm-results" id="dm-results"><div class="dm-result-totals"><article><span>Total wins</span><strong id="dm-total-wins">0</strong><small>Match found</small></article><article><span>Total losses</span><strong id="dm-total-losses">0</strong><small>Digit not found</small></article><article><span>Settled signals</span><strong id="dm-total-signals">0</strong><small id="dm-result-rate">Waiting for first result</small></article></div><div class="dm-result-list" id="dm-outcomes"><div class="dm-empty-results">Settled signal results will appear here.</div></div></section>' +
      '</main></div>';
  }

  function mount() {
    if (location.pathname !== '/app' || document.getElementById('dm-app-root')) return;
    document.documentElement.classList.add('dm-strategy-page');
    document.body.classList.add('dm-strategy-app');
    var root = document.createElement('div'); root.id = 'dm-app-root'; root.innerHTML = template(); document.body.appendChild(root);
    el('dm-logout').onclick = function () { if (window.matchestoolLogout) window.matchestoolLogout(); location.href = '/auth'; };
    el('dm-activate').onclick = activateSignal;
    connect();
  }

  function setConnection(text, ok) {
    var node = el('dm-connection'); if (!node) return;
    node.classList.toggle('is-live', !!ok); node.querySelector('span').textContent = text;
  }

  function analysisStage(title, status, progress, step) {
    var titleEl=el('dm-analysis-title'),statusEl=el('dm-analysis-status'),bar=el('dm-analysis-bar');
    if(titleEl)titleEl.textContent=title;if(statusEl)statusEl.textContent=status;if(bar)bar.style.width=progress+'%';
    ['connect','history','compare','lock'].forEach(function(name,index){var node=el('dm-step-'+name);if(node)node.classList.toggle('is-active',index<=step);});
  }

  function connect() {
    clearTimeout(state.reconnect); setConnection('Connecting to Deriv', false);
    try { state.ws = new WebSocket(PUBLIC_WS); } catch (e) { setConnection('Connection unavailable', false); return; }
    state.ws.onopen = function () { state.connected = true; setConnection('Live', true); analysisStage('Connected to Deriv APIs','Discovering the ten strategy markets…',18,0); send({active_symbols:'brief'}, {type:'symbols'}); };
    state.ws.onmessage = onMessage;
    state.ws.onerror = function () { setConnection('Market data error', false); };
    state.ws.onclose = function () { state.connected = false; setConnection('Reconnecting…', false); state.reconnect = setTimeout(connect, 3500); };
  }

  function onMessage(event) {
    var msg; try { msg = JSON.parse(event.data); } catch (e) { return; }
    if (msg.error) { console.warn('Deriv:', msg.error.message); return; }
    var meta = state.req[msg.req_id];
    if (msg.msg_type === 'active_symbols') discover(msg.active_symbols || []);
    if (msg.msg_type === 'history' && meta) receiveHistory(meta.symbol, msg);
    if (msg.msg_type === 'tick' && msg.tick) receiveTick(msg.tick);
  }

  function discover(symbols) {
    state.markets = WATCHLIST.map(function (symbol) { return symbols.find(function (m) { return m.symbol === symbol; }); }).filter(Boolean);
    analysisStage('Markets discovered','Preparing 1,000 historical ticks for each market…',30,1);
    scanHistories();
  }

  function scanHistories() {
    if (!state.connected || !state.markets.length) return;
    state.scanned = 0; state.data = {}; state.req = {}; state.signal = null; state.displayReady = false;
    analysisStage('Loading tick intelligence','Analysing 0 of '+state.markets.length+' markets…',32,1);
    showSignal(null);
    state.markets.forEach(function (m, index) {
      setTimeout(function () { send({ticks_history:m.symbol, end:'latest', count:SAMPLE_SIZE, style:'ticks'}, {type:'history', symbol:m.symbol}); }, Math.floor(index / 6) * 220);
    });
  }

  function receiveHistory(symbol, msg) {
    var m = state.markets.find(function (x) { return x.symbol === symbol; });
    var prices = msg.history && msg.history.prices || []; var pip = Number(msg.pip_size);
    state.data[symbol] = { market:m, prices:prices.slice(-SAMPLE_SIZE), pip:isFinite(pip) ? pip : inferPip(prices), latest:null };
    state.scanned++;
    analysisStage('Loading tick intelligence','Analysing '+state.scanned+' of '+state.markets.length+' markets…',32+Math.round((state.scanned/state.markets.length)*43),1);
    rank();
    if (state.scanned === state.markets.length) {
      subscribeAll(); analysisStage('Comparing digit strength','Ranking 10,000 observations across all markets…',84,2);
      setTimeout(function(){analysisStage('Locking the signal','Freezing the market, target digit, and 30-second window…',96,3);},700);
      setTimeout(function(){analysisStage('Signal ready','The selected setup is now locked for 30 seconds.',100,3);state.displayReady=true;showSignal(state.signal);activateSignal();},1600);
    }
  }

  function inferPip(prices) { var max = 2; (prices || []).slice(-20).forEach(function (p) { var s=String(p); max=Math.max(max,(s.split('.')[1]||'').length); }); return max; }
  function lastDigit(price, pip) { var s = Number(price).toFixed(Math.max(0, Number(pip) || 0)); return Number(s.charAt(s.length - 1)); }
  function analyse(entry) {
    var counts = [0,0,0,0,0,0,0,0,0,0]; entry.prices.forEach(function (p) { counts[lastDigit(p, entry.pip)]++; });
    var best = 0; for (var i=1;i<10;i++) if (counts[i] > counts[best]) best=i;
    var n=entry.prices.length, frequency=n ? counts[best]/n*100 : 0;
    return {entry:entry, counts:counts, digit:best, count:counts[best], sample:n, frequency:frequency, edge:frequency-10};
  }

  function ranked() { return Object.keys(state.data).map(function (k) { return analyse(state.data[k]); }).filter(function (x) { return x.sample >= 100; }).sort(function (a,b) { return b.frequency-a.frequency || b.sample-a.sample; }); }
  function rank() {
    if (state.active) return;
    var rows = ranked(), selected = rows[0] || null;
    if (selected && selected.entry.market.symbol===state.lastSignalSymbol && state.consecutiveSignals>=3) {
      selected = rows.find(function(row){return row.entry.market.symbol!==state.lastSignalSymbol;}) || rows[1] || selected;
    }
    state.signal = selected; if(state.displayReady)showSignal(state.signal);
  }

  function showSignal(signal) {
    if (!el('dm-signal')) return;
    el('dm-signal-empty').hidden=!!signal; el('dm-signal').hidden=!signal; el('dm-signal-state').textContent=state.active?'ACTIVE':(signal?'READY':'SCANNING');
    if (!signal) return;
    el('dm-signal-market').textContent=marketName(signal.entry.market); el('dm-signal-symbol').textContent=signal.entry.market.symbol;
    el('dm-signal-digit').textContent=signal.digit; el('dm-signal-frequency').textContent=pct(signal.frequency);
    el('dm-signal-occurrences').textContent=signal.count+' times'; el('dm-signal-sample').textContent=signal.sample.toLocaleString()+' ticks'; el('dm-edge').textContent='+'+pct(signal.edge);
    el('dm-edge-bar').style.width=Math.min(100,Math.max(4,signal.edge*18))+'%';
  }

  function subscribeAll() { var symbols=state.markets.map(function (m) { return m.symbol; }); if (symbols.length) send({ticks:symbols,subscribe:1},{type:'ticks'}); }
  function receiveTick(tick) {
    var entry=state.data[tick.symbol]; if (!entry) return; var digit=lastDigit(tick.quote,tick.pip_size == null ? entry.pip : tick.pip_size);
    entry.latest=Number(tick.quote).toFixed(tick.pip_size == null ? entry.pip : tick.pip_size); entry.prices.push(tick.quote); if(entry.prices.length>SAMPLE_SIZE) entry.prices.shift();
    if (state.active && state.active.symbol===tick.symbol) observeDigit(digit,tick.epoch);
    rank();
  }

  function observeDigit(digit, epoch) {
    if (!state.active) return;
    state.active.digits.push({digit:digit,epoch:epoch});
    if (digit === state.active.digit) state.active.matched = true;
    var stream = el('dm-live-digits');
    if (stream) stream.innerHTML = state.active.digits.slice(-16).map(function (item) { return '<b class="'+(item.digit===state.active.digit?'is-match':'')+'">'+item.digit+'</b>'; }).join('');
    var status = el('dm-match-status');
    if (status && state.active.matched) { status.textContent='MATCH FOUND'; status.classList.add('is-win'); }
  }

  function activateSignal() {
    if (!state.signal || state.active) return; var s=state.signal;
    if (s.entry.market.symbol===state.lastSignalSymbol) state.consecutiveSignals++;
    else { state.lastSignalSymbol=s.entry.market.symbol; state.consecutiveSignals=1; }
    state.active={symbol:s.entry.market.symbol,market:marketName(s.entry.market),digit:s.digit,frequency:s.frequency,started:Date.now(),expires:Date.now()+SIGNAL_TTL*1000,digits:[],matched:false};
    el('dm-activate').disabled=true; el('dm-active-trade').hidden=false; el('dm-active-digit').textContent=s.digit; el('dm-active-market').textContent=marketName(s.entry.market); el('dm-signal-state').textContent='LOCKED · 30S';
    el('dm-live-digits').innerHTML='<span>Waiting for live ticks…</span>'; el('dm-match-status').textContent='WAITING FOR MATCH'; el('dm-match-status').classList.remove('is-win');
    clearInterval(state.signalTimer); state.signalTimer=setInterval(function(){ var left=Math.max(0,Math.ceil((state.active.expires-Date.now())/1000)); el('dm-countdown').textContent=left; if(left<=0) finishSignal(state.active.matched?'WIN':'LOSS',state.active.digits.length?state.active.digits[state.active.digits.length-1].digit:null,Date.now()/1000); },250);
  }

  function finishSignal(result, actual, epoch) {
    if(!state.active)return; var a=state.active; clearInterval(state.signalTimer);
    state.outcomes.unshift({result:result,market:a.market,symbol:a.symbol,target:a.digit,actual:actual,time:nowTime(epoch),frequency:a.frequency}); state.outcomes=state.outcomes.slice(0,20); state.active=null;
    if(result==='WIN')state.totalWins++;else if(result==='LOSS')state.totalLosses++;
    el('dm-activate').disabled=false; el('dm-signal-state').textContent=result; renderOutcomes();
    el('dm-active-trade').classList.add(result==='WIN'?'is-settled-win':'is-settled-loss');
    setTimeout(function(){ if(el('dm-active-trade')){el('dm-active-trade').hidden=true;el('dm-active-trade').classList.remove('is-settled-win','is-settled-loss');} if(el('dm-signal-state'))el('dm-signal-state').textContent='ANALYSING'; state.displayReady=false; showSignal(null); analysisStage('Refreshing market analysis','Reviewing the latest rolling tick samples…',55,2); setTimeout(function(){rank();analysisStage('Locking the next signal','Freezing the strongest current setup…',96,3);setTimeout(function(){state.displayReady=true;showSignal(state.signal);activateSignal();},700);},900); },2200);
  }

  function renderOutcomes() {
    var wins=state.totalWins, losses=state.totalLosses;
    var totalWins=el('dm-total-wins'),totalLosses=el('dm-total-losses'),totalSignals=el('dm-total-signals'),resultRate=el('dm-result-rate');
    if(totalWins)totalWins.textContent=wins;if(totalLosses)totalLosses.textContent=losses;if(totalSignals)totalSignals.textContent=wins+losses;
    if(resultRate)resultRate.textContent=(wins+losses)?Math.round(wins/(wins+losses)*100)+'% win rate':'Waiting for first result';
    var record=el('dm-record'),rate=el('dm-win-rate'); if(record)record.textContent=wins+'W · '+losses+'L'; if(rate)rate.textContent=(wins+losses)?Math.round(wins/(wins+losses)*100)+'% match rate':'No settled outcomes yet';
    var list=el('dm-outcomes'); if(list) list.innerHTML=state.outcomes.length?state.outcomes.map(function(o){return '<div class="dm-result-item"><span class="dm-result-icon '+o.result.toLowerCase()+'">'+(o.result==='WIN'?'✓':'×')+'</span><div><strong>'+esc(o.market)+'</strong><small>Match digit '+o.target+' · '+o.time+'</small></div><b class="'+o.result.toLowerCase()+'">'+(o.result==='WIN'?'MATCH FOUND':'NOT FOUND')+'</b></div>';}).join(''):'<div class="dm-empty-results">Settled signal results will appear here.</div>';
  }

  window.addEventListener('load', function () { setTimeout(mount, 120); });
})();
