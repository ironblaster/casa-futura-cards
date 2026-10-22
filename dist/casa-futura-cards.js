/*!
 * Casa Futura Cards for Home Assistant
 * Liquid glass cards for wall tablets and dashboards:
 *   casa-futura-gauge-card   a big needle gauge for any sensor
 *   casa-futura-alerts-card  a floating bell with a side panel of alerts
 *   casa-futura-action-card  a button with optional confirmation, PIN and several choices
 *   casa-futura-climate-card a thermostat dial with modes, fan speed, presets and swing
 *   casa-futura-light-card   a brightness slider with white temperature, colors and group members
 *   casa-futura-vacuum-card  a robot vacuum with map, battery, controls, quick cleanings and station
 *   casa-futura-camera-card  camera snapshots in a strip or a grid, live video on tap
 *
 * https://github.com/ironblaster/casa-futura-cards
 * Released under the MIT License.
 */
(function () {
  'use strict';

  var VERSION = '1.3.1';
  var REPO = 'https://github.com/ironblaster/casa-futura-cards';
  if (window.__casaFuturaCards) return;
  window.__casaFuturaCards = VERSION;

  /* ================================================================ helpers */

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function num(v) { var n = parseFloat(v); return isNaN(n) ? null : n; }
  function st(hass, id) { return hass && hass.states && id ? hass.states[id] : undefined; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function fire(node, type, detail) { node.dispatchEvent(new CustomEvent(type, { detail: detail, bubbles: true, composed: true })); }
  function langOf(hass) { return String((hass && ((hass.locale && hass.locale.language) || hass.language)) || navigator.language || 'en'); }
  function baseLang(l) { return String(l || 'en').toLowerCase().split(/[-_]/)[0]; }
  function fmt(v, d, l) {
    if (v == null || isNaN(v)) return '—';
    try { return Number(v).toLocaleString(l, { minimumFractionDigits: d, maximumFractionDigits: d }); } catch (e) { return Number(v).toFixed(d); }
  }
  function rgb(v, fb) {
    if (Array.isArray(v) && v.length >= 3) return v.slice(0, 3).map(function (x) { return clamp(Math.round(+x || 0), 0, 255); }).join(',');
    if (typeof v === 'string') {
      var s = v.trim(), m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(s);
      if (m) {
        var h = m[1].length === 3 ? m[1].replace(/(.)/g, '$1$1') : m[1];
        return [0, 2, 4].map(function (i) { return parseInt(h.substr(i, 2), 16); }).join(',');
      }
      m = /^(?:rgba?\()?\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*[, ]\s*(\d{1,3})/i.exec(s);
      if (m) return [m[1], m[2], m[3]].map(function (x) { return clamp(+x, 0, 255); }).join(',');
    }
    return fb;
  }
  function rgbArr(s) { return String(s).split(',').map(Number); }
  function same(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
  function haptic(node, kind) { fire(node, 'haptic', kind || 'light'); }
  // the PIN is never stored: only this fingerprint is (a convenience lock, not real security)
  function pinHash(s) {
    var h = 0x811c9dc5, str = 'casa-futura:' + s;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return ('00000000' + h.toString(16)).slice(-8);
  }
  function stateText(hass, s) {
    if (!s) return '';
    if (hass && hass.formatEntityState) { try { return hass.formatEntityState(s); } catch (e) { /* ignore */ } }
    return s.state + (s.attributes.unit_of_measurement ? ' ' + s.attributes.unit_of_measurement : '');
  }
  var IDLE = ['off', 'locked', 'closed', 'unavailable', 'unknown', 'idle', 'standby', 'docked', 'paused', 'disarmed', 'not_home', 'none', ''];
  function isActive(s) { return !!s && IDLE.indexOf(String(s.state)) < 0 && isNaN(parseFloat(s.state)); }
  // run a standard Home Assistant action (tap action of a virtual card)
  function runAction(node, action, entity) {
    if (!action || !action.action || action.action === 'none') return;
    fire(node, 'hass-action', { config: { entity: entity, tap_action: action }, action: 'tap' });
  }
  // a track you drag on: live feedback while dragging, onChange when the finger lifts
  // vertical can be a function, read at every move (the light card turns its slider when the card is narrow)
  function slider(node, track, vertical, onInput, onChange) {
    var dragging = false;
    track.style.touchAction = 'none';
    function val(e) {
      var r = track.getBoundingClientRect(), v = typeof vertical === 'function' ? vertical() : vertical;
      return clamp(v ? 1 - (e.clientY - r.top) / r.height : (e.clientX - r.left) / r.width, 0, 1);
    }
    track.addEventListener('pointerdown', function (e) {
      if (e.button) return;
      dragging = true;
      try { track.setPointerCapture(e.pointerId); } catch (x) { /* ignore */ }
      onInput(val(e)); e.preventDefault();
    });
    track.addEventListener('pointermove', function (e) { if (dragging) onInput(val(e)); });
    track.addEventListener('pointerup', function (e) {
      if (!dragging) return;
      dragging = false;
      try { track.releasePointerCapture(e.pointerId); } catch (x) { /* ignore */ }
      haptic(node); onChange(val(e));
    });
    track.addEventListener('pointercancel', function () { dragging = false; });
    return { busy: function () { return dragging; } };
  }
  function hsToRgb(h, s) {
    s /= 100; var c = s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = 1 - c, r = 0, g = 0, b = 0;
    if (h < 60) { r = c; g = x; } else if (h < 120) { r = x; g = c; } else if (h < 180) { g = c; b = x; }
    else if (h < 240) { g = x; b = c; } else if (h < 300) { r = x; b = c; } else { r = c; b = x; }
    return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
  }
  // approximate color of a white light at this temperature in kelvin
  function kToRgb(k) {
    var t = k / 100, r, g, b;
    if (t <= 66) { r = 255; g = 99.47 * Math.log(t) - 161.12; b = t <= 19 ? 0 : 138.52 * Math.log(t - 10) - 305.04; }
    else { r = 329.7 * Math.pow(t - 60, -0.1332); g = 288.12 * Math.pow(t - 60, -0.0755); b = 255; }
    return [r, g, b].map(function (v) { return clamp(Math.round(v), 0, 255); });
  }
  // switch a card between its wide and narrow layout by its own width (works in every view type)
  function watchWidth(card, el, limit) {
    if (card._ro) card._ro.disconnect();
    if (!window.ResizeObserver) return;
    card._ro = new ResizeObserver(function (en) {
      var n = en[0].contentRect.width < limit;
      if (el.classList.contains('narrow') === n) return;
      el.classList.toggle('narrow', n);
      if (card._hass) card._update();
    });
    card._ro.observe(el);
  }

  var ACC = { cyan: '95,243,255', violet: '185,139,255', amber: '255,198,92', red: '255,107,125', green: '92,242,166', blue: '106,168,255', orange: '255,154,82' };
  var FONT_URL = 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&display=swap';
  function loadFont() {
    if (document.querySelector('link[data-cf-font]') || document.querySelector('link[href*="family=Space+Grotesk"]')) return;
    var l = document.createElement('link'); l.rel = 'stylesheet'; l.href = FONT_URL; l.setAttribute('data-cf-font', '');
    document.head.appendChild(l);
  }
  function fontOf(c) {
    if (c.font === 'theme') return 'var(--ha-font-family-body, Roboto, sans-serif)';
    if (c.font === 'custom' && c.font_family) return c.font_family + ', system-ui, sans-serif';
    loadFont();
    return "'Space Grotesk', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
  }

  /* ================================================================ translations */

  var T = {
    en: {
      cancel: 'Cancel', confirm: 'Confirm', done: 'Done', close: 'Close', pin_for: 'Enter the PIN for', pin: 'Enter the PIN',
      wrong: 'Wrong PIN', locked_out: 'Too many attempts: try again in 30 seconds', alerts: 'Alerts', active_1: '1 active alert',
      active_n: '{n} active alerts', choose: 'What do you want to do?', sure: 'Are you sure?', alerts_card: 'Alerts card',
      alerts_hint: 'This card is invisible on the dashboard: a bell appears at the top right when an alert is active.', configured: 'configured', active: 'active'
    },
    it: {
      cancel: 'Annulla', confirm: 'Conferma', done: 'Fatto', close: 'Chiudi', pin_for: 'Inserisci il PIN per', pin: 'Inserisci il PIN',
      wrong: 'PIN errato', locked_out: 'Troppi tentativi: riprova tra 30 secondi', alerts: 'Avvisi', active_1: '1 avviso attivo',
      active_n: '{n} avvisi attivi', choose: 'Cosa vuoi fare?', sure: 'Confermi?', alerts_card: 'Card degli avvisi',
      alerts_hint: 'Questa card non si vede sulla dashboard: in alto a destra compare una campanella quando c’è un avviso attivo.', configured: 'configurati', active: 'attivi'
    },
    de: { cancel: 'Abbrechen', confirm: 'Bestätigen', done: 'Erledigt', close: 'Schließen', pin_for: 'PIN eingeben für', pin: 'PIN eingeben', wrong: 'Falsche PIN', alerts: 'Hinweise', choose: 'Was möchtest du tun?', sure: 'Bist du sicher?' },
    fr: { cancel: 'Annuler', confirm: 'Confirmer', done: 'Terminé', close: 'Fermer', pin_for: 'Saisis le code pour', pin: 'Saisis le code', wrong: 'Code erroné', alerts: 'Alertes', choose: 'Que veux-tu faire ?', sure: 'Tu confirmes ?' },
    es: { cancel: 'Cancelar', confirm: 'Confirmar', done: 'Hecho', close: 'Cerrar', pin_for: 'Introduce el PIN para', pin: 'Introduce el PIN', wrong: 'PIN incorrecto', alerts: 'Avisos', choose: '¿Qué quieres hacer?', sure: '¿Estás seguro?' }
  };
  // texts of the light and vacuum cards
  var PT = {
    en: { state: 'State', white: 'White temperature', colors: 'Colors', members: 'Lights in the group', missing: 'Entity not found',
      start: 'Start', pause: 'Pause', stop: 'Stop', dock: 'Dock', locate: 'Locate', quick: 'Quick cleaning', station: 'Station',
      room: 'Room', area: 'Cleaned', time: 'Time', no_map: 'Map not available' },
    it: { state: 'Stato', white: 'Temperatura del bianco', colors: 'Colori', members: 'Luci del gruppo', missing: 'Entità non trovata',
      start: 'Avvia', pause: 'Pausa', stop: 'Stop', dock: 'Base', locate: 'Trova', quick: 'Pulizie rapide', station: 'Stazione',
      room: 'Stanza', area: 'Pulito', time: 'Tempo', no_map: 'Mappa non disponibile' },
    de: { state: 'Status', white: 'Weißton', colors: 'Farben', members: 'Lampen der Gruppe', missing: 'Entität nicht gefunden',
      start: 'Start', pause: 'Pause', stop: 'Stopp', dock: 'Station', locate: 'Finden', quick: 'Schnellreinigung', station: 'Station',
      room: 'Raum', area: 'Gereinigt', time: 'Zeit', no_map: 'Keine Karte verfügbar' },
    fr: { state: 'État', white: 'Température du blanc', colors: 'Couleurs', members: 'Lampes du groupe', missing: 'Entité introuvable',
      start: 'Démarrer', pause: 'Pause', stop: 'Arrêt', dock: 'Base', locate: 'Localiser', quick: 'Nettoyages rapides', station: 'Station',
      room: 'Pièce', area: 'Nettoyé', time: 'Durée', no_map: 'Carte non disponible' },
    es: { state: 'Estado', white: 'Temperatura del blanco', colors: 'Colores', members: 'Luces del grupo', missing: 'Entidad no encontrada',
      start: 'Iniciar', pause: 'Pausa', stop: 'Parar', dock: 'Base', locate: 'Localizar', quick: 'Limpiezas rápidas', station: 'Estación',
      room: 'Habitación', area: 'Limpiado', time: 'Tiempo', no_map: 'Mapa no disponible' }
  };
  // texts of the camera card
  var CAMT = {
    en: { person: 'Person', offline: 'Not available', cameras: 'Cameras', prev: 'Previous camera', next: 'Next camera' },
    it: { person: 'Persona', offline: 'Non disponibile', cameras: 'Telecamere', prev: 'Telecamera precedente', next: 'Telecamera successiva' },
    de: { person: 'Person', offline: 'Nicht verfügbar', cameras: 'Kameras', prev: 'Vorherige Kamera', next: 'Nächste Kamera' },
    fr: { person: 'Personne', offline: 'Indisponible', cameras: 'Caméras', prev: 'Caméra précédente', next: 'Caméra suivante' },
    es: { person: 'Persona', offline: 'No disponible', cameras: 'Cámaras', prev: 'Cámara anterior', next: 'Cámara siguiente' }
  };
  function camt(hass, k) { var t = CAMT[baseLang(langOf(hass))] || CAMT.en; return t[k] || CAMT.en[k]; }
  function ptr(hass, k) { var t = PT[baseLang(langOf(hass))] || PT.en; return t[k] || PT.en[k]; }
  function tr(hass, k, n) {
    var t = T[baseLang(langOf(hass))] || T.en, s = t[k] != null ? t[k] : T.en[k];
    return n != null ? String(s).replace('{n}', n) : s;
  }

  /* ================================================================ shared style */

  var BASE =
    ':host{display:block}*{box-sizing:border-box}' +
    'button{font:inherit;color:inherit;border:0;background:none;padding:0;margin:0;cursor:pointer;outline:none;-webkit-tap-highlight-color:transparent}' +
    'ha-icon{display:inline-flex;align-items:center;justify-content:center;--mdc-icon-size:var(--ic,24px);width:var(--ic,24px);height:var(--ic,24px);flex:none}' +
    '.glass{position:relative;isolation:isolate;border-radius:var(--cf-radius,28px);color:rgb(var(--cf-text,238,244,255));font-family:var(--cf-font);' +
    '  background:linear-gradient(155deg,rgba(255,255,255,.13) 0%,rgba(255,255,255,.05) 34%,rgba(255,255,255,.02) 60%,rgba(255,255,255,.085) 100%);' +
    '  -webkit-backdrop-filter:blur(30px) saturate(180%);backdrop-filter:blur(30px) saturate(180%);border:1px solid rgba(255,255,255,.15);' +
    '  box-shadow:inset 0 1px 0 rgba(255,255,255,.32),inset 0 -1px 0 rgba(255,255,255,.05),0 24px 64px rgba(0,0,0,.45);-webkit-tap-highlight-color:transparent;' +
    '  -webkit-user-select:none;user-select:none}' +
    '.glass::before{content:"";position:absolute;top:0;left:0;right:0;bottom:0;border-radius:inherit;pointer-events:none;z-index:-1;' +
    '  background:radial-gradient(130% 75% at 0% -15%,rgba(255,255,255,.18),transparent 42%)}' +
    '.glass.plain{background:var(--ha-card-background,var(--card-background-color));-webkit-backdrop-filter:none;backdrop-filter:none;' +
    '  border:1px solid var(--divider-color,rgba(255,255,255,.12));box-shadow:var(--ha-card-box-shadow,none);color:var(--primary-text-color)}' +
    '.glass.plain::before{display:none}' +
    '@keyframes cfshake{10%,90%{transform:translateX(-2px)}20%,80%{transform:translateX(4px)}30%,50%,70%{transform:translateX(-8px)}40%,60%{transform:translateX(8px)}}' +
    '@keyframes cfrise{from{opacity:0;transform:translateY(14px) scale(.98)}to{opacity:1;transform:none}}';

  function lookVars(el, c) {
    el.style.setProperty('--cf-font', fontOf(c));
    el.style.setProperty('--cf-radius', clamp(num(c.border_radius) == null ? 28 : num(c.border_radius), 0, 64) + 'px');
    el.style.setProperty('--cf-text', rgb(c.text_color, '238,244,255'));
    el.style.setProperty('--cf-acc', rgb(c.color, ACC.cyan));
  }

  /* ================================================================ dialog drawn by the cards (no browser_mod needed) */

  // windows drawn by the cards; the 'casa-futura-close' event (sent e.g. by Casa Futura Kiosk) closes them all
  var DIALOGS = [];
  window.addEventListener('casa-futura-close', function () { DIALOGS.slice().forEach(function (d) { d.close(); }); });

  function openDialog(owner, c, build) {
    var p = document.createElement('div');
    p.setAttribute('data-casa-futura-dialog', '');
    var r = p.attachShadow({ mode: 'open' });
    r.innerHTML = '<style>' + BASE +
      '.scrim{position:fixed;top:0;left:0;right:0;bottom:0;z-index:9;background:rgba(3,5,10,.55);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);' +
      '  display:flex;align-items:center;justify-content:center;padding:16px;animation:cffade .2s}' +
      '@keyframes cffade{from{opacity:0}to{opacity:1}}' +
      '.dlg{width:100%;max-width:460px;max-height:calc(100vh - 32px);overflow-y:auto;padding:26px 24px 22px;text-align:center;animation:cfrise .3s cubic-bezier(.2,.9,.3,1);' +
      '  background:linear-gradient(160deg,rgba(26,32,54,.9),rgba(9,12,22,.95));scrollbar-width:none}' +
      '.orb{--ic:40px;width:80px;height:80px;margin:0 auto 12px;border-radius:32px;display:flex;align-items:center;justify-content:center;color:rgb(var(--a));' +
      '  background:radial-gradient(circle at 50% 30%,rgba(var(--a),.42),rgba(var(--a),.1) 72%);border:1px solid rgba(var(--a),.55);box-shadow:0 0 40px rgba(var(--a),.38)}' +
      '.q{font-size:24px;font-weight:600;line-height:1.2}.s{font-size:15px;opacity:.6;margin-top:6px;min-height:4px}' +
      '.chs{display:flex;flex-direction:column;gap:10px;margin-top:20px}' +
      '.pill{--a:var(--cf-acc);display:flex;align-items:center;justify-content:center;gap:10px;--ic:24px;min-height:60px;padding:0 18px;border-radius:20px;font-size:17px;font-weight:500;' +
      '  background:linear-gradient(160deg,rgba(255,255,255,.12),rgba(255,255,255,.035));border:1px solid rgba(255,255,255,.14);transition:transform .1s}' +
      '.pill:active{transform:scale(.96)}' +
      '.pill.on{background:linear-gradient(160deg,rgba(var(--a),.48),rgba(var(--a),.16));border-color:rgba(var(--a),.75);box-shadow:0 0 26px rgba(var(--a),.36)}' +
      '.chs .pill{justify-content:flex-start}' +
      '.chs.row{flex-direction:row;flex-wrap:wrap}.chs.row .pill{flex:1 1 30%;justify-content:center;min-height:52px;padding:0 10px;font-size:15px;--ic:20px}' +
      '.btns{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:20px}.btns.one{grid-template-columns:1fr}' +
      '.dots{display:flex;justify-content:center;gap:18px;margin:22px 0 8px}' +
      '.dots i{width:18px;height:18px;border-radius:50%;border:2px solid rgba(238,244,255,.45);transition:all .2s}' +
      '.dots i.f{background:#eef4ff;border-color:#eef4ff;box-shadow:0 0 14px rgba(var(--cf-acc),.8)}' +
      '.dots.ok i{background:rgb(' + ACC.green + ');border-color:rgb(' + ACC.green + ')}.dots.ko i{background:rgb(' + ACC.red + ');border-color:rgb(' + ACC.red + ')}' +
      '.dots.ko{animation:cfshake .5s}' +
      '.msg{font-size:15px;min-height:22px;opacity:.75;margin-bottom:14px}.msg.ko{color:rgb(' + ACC.red + ');opacity:1}.msg.ok{color:rgb(' + ACC.green + ');opacity:1}' +
      '.pad{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;justify-items:center}' +
      '.key{width:70px;height:70px;border-radius:50%;font-size:28px;font-weight:300;display:flex;align-items:center;justify-content:center;--ic:28px;' +
      '  background:radial-gradient(circle at 50% 25%,rgba(255,255,255,.16),rgba(255,255,255,.04) 70%);border:1px solid rgba(255,255,255,.16);transition:transform .1s}' +
      '.key.fn{background:none;border-color:transparent;opacity:.75}.key.pressed{transform:scale(.9);background:rgba(var(--cf-acc),.35)}' +
      '.pad.off{opacity:.35;pointer-events:none}' +
      '.dlg.wide{max-width:1100px;padding:18px 18px 16px;text-align:left}' +
      '</style><div class="scrim" id="scrim"><div class="glass dlg" id="dlg"></div></div>';
    lookVars(r.getElementById('scrim'), c);
    document.body.appendChild(p);
    var api = {
      root: r, el: r.getElementById('dlg'),
      close: function () {
        if (p.parentNode) p.parentNode.removeChild(p); document.removeEventListener('keydown', onKey);
        var i = DIALOGS.indexOf(api); if (i >= 0) DIALOGS.splice(i, 1);
      }
    };
    DIALOGS.push(api);
    function onKey(e) { if (e.key === 'Escape') api.close(); }
    document.addEventListener('keydown', onKey);
    r.getElementById('scrim').addEventListener('click', function (e) { if (e.target.id === 'scrim') api.close(); });
    build(api);
    return api;
  }

  /* ================================================================ editor support (Home Assistant forms) */

  var FORM = null;
  function ensureForm() {
    if (customElements.get('ha-form')) return Promise.resolve();
    if (FORM) return FORM;
    FORM = new Promise(function (resolve) {
      try {
        if (window.loadCardHelpers) {
          window.loadCardHelpers().then(function (h) { return h.createCardElement({ type: 'entities', entities: [] }); })
            .then(function (c) { return c && c.constructor.getConfigElement ? c.constructor.getConfigElement() : null; })
            .catch(function () { /* ignore */ });
        }
      } catch (e) { /* ignore */ }
      customElements.whenDefined('ha-form').then(function () { resolve(); });
      setTimeout(resolve, 5000);
    });
    return FORM;
  }

  var ET = {
    en: {
      s_main: 'Main', s_scale: 'Scale and colors', s_look: 'Appearance', s_actions: 'Interactions', s_bell: 'Bell', s_choices: 'Choices', s_alerts: 'Alerts', s_security: 'Confirmation and PIN',
      entity: 'Entity', name: 'Name', icon: 'Icon', show_name: 'Show the name', unit: 'Unit (optional)', decimals: 'Decimals', min: 'Minimum', max: 'Maximum',
      yellow_from: 'Yellow from', red_from: 'Red from', low_color: 'Low color', mid_color: 'Middle color', high_color: 'High color', needle: 'Show the needle',
      min_height: 'Minimum height', font: 'Font', f_space: 'Space Grotesk (from Google Fonts)', f_theme: 'Theme font', f_custom: 'Custom font', font_family: 'Custom font family',
      glass: 'Glass effect', border_radius: 'Corner radius', text_color: 'Text color', color: 'Color', label: 'Text under the name (optional)',
      tap_action: 'Tap action', hold_action: 'Hold action', double_tap_action: 'Double tap action',
      title: 'Panel title', bell_top: 'Distance from the top', bell_right: 'Distance from the right', bell_size: 'Bell size',
      condition: 'Show when', c_on: 'it is on / open / active', c_equals: 'the state is…', c_not_equals: 'the state is not…', c_above: 'the value is above…', c_below: 'the value is below…',
      value: 'Value', text: 'Alert text', attribute: 'Attribute to show (optional)', suffix: 'After the value (e.g. °)', alert_action: 'Action when tapped',
      add_alert: 'Add an alert', add_choice: 'Add a choice', remove: 'Remove', up: 'Move up',
      confirm: 'Ask for confirmation', confirm_text: 'Question', pin: 'PIN (digits)', pin_h: 'Only a fingerprint of the PIN is saved. It keeps curious hands away, it is not real security.',
      pin_set: 'A PIN is set: type a new one to change it, or clear it to remove it.', when: 'Highlight when the state is (comma separated)', action: 'Action',
      s_sections: 'Sections', temperature_entity: 'Room temperature sensor (optional)', humidity_entity: 'Room humidity sensor (optional)',
      show_modes: 'Modes', show_fan: 'Fan speed', show_presets: 'Presets', show_swing: 'Swing',
      alerts_h: 'Each alert shows up in the panel while its condition is true. The first one gives its color to the bell.',
      choices_h: 'With more than one choice a window lets you pick what to do. Without choices the tap action is used.',
      show_temperature: 'White temperature', show_colors: 'Colors', show_members: 'Lights in the group', exclude: 'Lights to hide from the group',
      s_sensors: 'Sensors (optional)', map: 'Map (camera or image entity)', battery: 'Battery', status: 'Detailed status', room: 'Current room',
      area: 'Cleaned area', time: 'Cleaning time', error: 'Error', show_controls: 'Start, stop, dock and locate buttons',
      s_quick: 'Quick cleaning', quick_h: 'Buttons for the cleanings you start often: a script, a room, a whole floor.', add_quick: 'Add a quick cleaning',
      s_station: 'Station', station_h: 'Water tanks, dust bag and other sensors of the dock, shown as a list.', add_station: 'Add a station sensor',
      q_label: 'Button text', st_label: 'Text',
      layout: 'Layout', l_strip: 'Strip (scrolls sideways)', l_grid: 'Grid', columns: 'Columns of the grid', tile_width: 'Width of each camera in the strip',
      refresh: 'Refresh the snapshots every', snapshot_width: 'Snapshot width', show_names: 'Show the names', show_title: 'Show the title', card_title: 'Title (optional)',
      s_cameras: 'Cameras', cameras_h: 'Snapshots refresh only while the card is on screen. Tap a camera to watch it live.', add_camera: 'Add a camera',
      occupancy: 'Badge sensor, e.g. person detected (optional)', badge: 'Badge text (optional)', cam_action: 'Tap action (empty: live video)'
    },
    it: {
      s_main: 'Principale', s_scale: 'Scala e colori', s_look: 'Aspetto', s_actions: 'Interazioni', s_bell: 'Campanella', s_choices: 'Scelte', s_alerts: 'Avvisi', s_security: 'Conferma e PIN',
      entity: 'Entità', name: 'Nome', icon: 'Icona', show_name: 'Mostra il nome', unit: 'Unità (facoltativa)', decimals: 'Decimali', min: 'Minimo', max: 'Massimo',
      yellow_from: 'Giallo da', red_from: 'Rosso da', low_color: 'Colore basso', mid_color: 'Colore medio', high_color: 'Colore alto', needle: 'Mostra la lancetta',
      min_height: 'Altezza minima', font: 'Carattere', f_space: 'Space Grotesk (da Google Fonts)', f_theme: 'Carattere del tema', f_custom: 'Carattere personalizzato', font_family: 'Nome del carattere',
      glass: 'Effetto vetro', border_radius: 'Raggio degli angoli', text_color: 'Colore dei testi', color: 'Colore', label: 'Testo sotto il nome (facoltativo)',
      tap_action: 'Azione al tocco', hold_action: 'Azione tenendo premuto', double_tap_action: 'Azione al doppio tocco',
      title: 'Titolo del pannello', bell_top: 'Distanza dall’alto', bell_right: 'Distanza da destra', bell_size: 'Grandezza della campanella',
      condition: 'Mostra quando', c_on: 'è acceso / aperto / attivo', c_equals: 'lo stato è…', c_not_equals: 'lo stato non è…', c_above: 'il valore è sopra…', c_below: 'il valore è sotto…',
      value: 'Valore', text: 'Testo dell’avviso', attribute: 'Attributo da mostrare (facoltativo)', suffix: 'Dopo il valore (es. °)', alert_action: 'Azione al tocco',
      add_alert: 'Aggiungi un avviso', add_choice: 'Aggiungi una scelta', remove: 'Rimuovi', up: 'Sposta su',
      confirm: 'Chiedi conferma', confirm_text: 'Domanda', pin: 'PIN (cifre)', pin_h: 'Del PIN si salva solo un’impronta. Tiene lontani i curiosi, non è una vera sicurezza.',
      pin_set: 'C’è un PIN impostato: scrivine uno nuovo per cambiarlo, oppure cancellalo per toglierlo.', when: 'Evidenzia quando lo stato è (separati da virgola)', action: 'Azione',
      s_sections: 'Sezioni', temperature_entity: 'Sensore temperatura della stanza (facoltativo)', humidity_entity: 'Sensore umidità della stanza (facoltativo)',
      show_modes: 'Modalità', show_fan: 'Velocità ventola', show_presets: 'Preset', show_swing: 'Oscillazione',
      alerts_h: 'Ogni avviso compare nel pannello finché la sua condizione è vera. Il primo dà il colore alla campanella.',
      choices_h: 'Con più di una scelta si apre una finestra per decidere cosa fare. Senza scelte si usa l’azione al tocco.',
      show_temperature: 'Temperatura del bianco', show_colors: 'Colori', show_members: 'Luci del gruppo', exclude: 'Luci da nascondere dal gruppo',
      s_sensors: 'Sensori (facoltativi)', map: 'Mappa (entità camera o immagine)', battery: 'Batteria', status: 'Stato dettagliato', room: 'Stanza attuale',
      area: 'Superficie pulita', time: 'Tempo di pulizia', error: 'Errore', show_controls: 'Pulsanti avvia, stop, base e trova',
      s_quick: 'Pulizie rapide', quick_h: 'Pulsanti per le pulizie che avvii spesso: uno script, una stanza, un piano intero.', add_quick: 'Aggiungi una pulizia rapida',
      s_station: 'Stazione', station_h: 'Serbatoi dell’acqua, sacchetto della polvere e altri sensori della base, mostrati in elenco.', add_station: 'Aggiungi un sensore della stazione',
      q_label: 'Testo del pulsante', st_label: 'Testo',
      layout: 'Disposizione', l_strip: 'Striscia (scorre di lato)', l_grid: 'Griglia', columns: 'Colonne della griglia', tile_width: 'Larghezza di ogni telecamera nella striscia',
      refresh: 'Aggiorna le immagini ogni', snapshot_width: 'Larghezza delle immagini', show_names: 'Mostra i nomi', show_title: 'Mostra il titolo', card_title: 'Titolo (facoltativo)',
      s_cameras: 'Telecamere', cameras_h: 'Le immagini si aggiornano solo mentre la card è sullo schermo. Tocca una telecamera per vederla dal vivo.', add_camera: 'Aggiungi una telecamera',
      occupancy: 'Sensore per il badge, es. persona rilevata (facoltativo)', badge: 'Testo del badge (facoltativo)', cam_action: 'Azione al tocco (vuota: video dal vivo)'
    }
  };

  var LOOK_DEF = { font: 'space_grotesk', font_family: '', glass: true, border_radius: 28, text_color: null };
  var EDITOR_CSS = ':host{display:block}.box{display:flex;flex-direction:column;gap:12px}' +
    '.list{display:flex;flex-direction:column;gap:12px;padding:4px 0 8px}.help{color:var(--secondary-text-color);font-size:13px;line-height:1.4;margin:0}' +
    '.row{border:1px solid var(--divider-color);border-radius:12px;padding:10px 10px 4px;position:relative}' +
    '.row .tools{position:absolute;top:4px;right:4px;display:flex}' +
    'button.b{display:inline-flex;align-items:center;gap:6px;font:inherit;font-size:14px;cursor:pointer;border-radius:18px;padding:7px 14px;' +
    '  border:1px solid var(--divider-color);background:var(--card-background-color);color:var(--primary-text-color);align-self:flex-start}' +
    'button.b ha-icon{--mdc-icon-size:18px}' +
    'button.i{border:0;background:none;cursor:pointer;color:var(--secondary-text-color);padding:6px;border-radius:50%}' +
    'button.i:hover{background:var(--secondary-background-color);color:var(--primary-text-color)}' +
    '.foot{font-size:12px;color:var(--secondary-text-color);text-align:right}.foot a{color:inherit}';

  // a base for the three editors: one ha-form plus optional lists of items, each edited with its own small ha-form
  class CFEditor extends HTMLElement {
    setConfig(c) { this._config = Object.assign({}, c || {}); this._draw(); }
    set hass(h) {
      var ls = this._ls || {};
      this._hass = h;
      if (this._form) { this._form.hass = h; Object.keys(ls).forEach(function (k) { (ls[k].rows || []).forEach(function (r) { r.hass = h; }); }); } else this._draw();
    }
    connectedCallback() { this._draw(); }
    _L(k) { var t = ET[baseLang(langOf(this._hass))] || ET.en; return t[k] != null ? t[k] : (ET.en[k] != null ? ET.en[k] : k); }
    _emit(cfg) { this._config = cfg; fire(this, 'config-changed', { config: cfg }); this._draw(); }
    _clean(v, defs) {
      var out = {};
      Object.keys(v).forEach(function (k) {
        var x = v[k];
        if (x === undefined || x === null || x === '') return;
        if (k in defs && same(x, defs[k])) return;
        out[k] = x;
      });
      return out;
    }
    _draw() {
      var self = this;
      if (!this._hass || !this._config || !this.isConnected) return;
      ensureForm().then(function () { self._drawNow(); });
    }
    _drawNow() {
      var self = this, L = this._L.bind(this);
      if (!this._root) {
        this._root = this.attachShadow({ mode: 'open' });
        this._root.innerHTML = '<style>' + EDITOR_CSS + '</style><div class="box"><div id="form"></div><div id="list"></div>' +
          '<div class="foot">Casa Futura Cards ' + VERSION + ' · <a href="' + REPO + '" target="_blank" rel="noreferrer">GitHub</a></div></div>';
        this._form = document.createElement('ha-form');
        this._form.computeLabel = function (s) { return s.title || L(s.name); };
        this._form.computeHelper = function (s) { var k = s.name + '_h', v = L(k); return v === k ? '' : v; };
        this._form.addEventListener('value-changed', function (ev) {
          ev.stopPropagation();
          self._emit(self._fromForm(Object.assign({}, self._config, ev.detail.value)));
        });
        this._root.getElementById('form').appendChild(this._form);
      }
      this._form.hass = this._hass;
      this._form.schema = this._schema();
      this._form.data = this._data();
      this._lists().forEach(function (d) { self._drawList(d); });
    }
    // the lists of items this editor shows under the form; one by default, the vacuum editor has two
    _lists() {
      if (!this._listKey) return [];
      return [{ key: this._listKey, title: this._listTitle, help: this._listHelp, add: this._listAdd,
        newItem: this._newItem.bind(this), schema: this._itemSchema.bind(this), data: this._itemData.bind(this) }];
    }
    _fromForm(v) { return this._clean(v, this._defaults()); }
    _section(title, icon, schema, expanded) { return { type: 'expandable', name: '', title: this._L(title), icon: icon, flatten: true, expanded: !!expanded, schema: schema }; }
    _lookSchema() {
      var L = this._L.bind(this), c = this._config;
      var s = [{ name: 'font', selector: { select: { mode: 'dropdown', options: [{ value: 'space_grotesk', label: L('f_space') }, { value: 'theme', label: L('f_theme') }, { value: 'custom', label: L('f_custom') }] } } }];
      if (c.font === 'custom') s.push({ name: 'font_family', selector: { text: {} } });
      s.push({ type: 'grid', name: '', schema: [{ name: 'glass', selector: { boolean: {} } }, { name: 'text_color', selector: { color_rgb: {} } }] });
      s.push({ name: 'border_radius', selector: { number: { min: 0, max: 64, step: 1, mode: 'slider', unit_of_measurement: 'px' } } });
      return s;
    }
    // list of items (alerts, choices, quick cleanings…)
    _drawList(d) {
      var self = this, L = this._L.bind(this), host = this._root.getElementById('list'), key = d.key;
      var items = Array.isArray(this._config[key]) ? this._config[key] : [];
      this._ls = this._ls || {};
      var ls = this._ls[key] || (this._ls[key] = {});
      if (!ls.panel) {
        var p = document.createElement('ha-expansion-panel');
        p.outlined = true; p.setAttribute('outlined', ''); p.header = L(d.title); p.expanded = d.expanded !== false;
        if (host.children.length) p.style.marginTop = '12px';
        p.innerHTML = '<div class="list"><p class="help">' + esc(L(d.help)) + '</p><div class="rows"></div>' +
          '<button class="b add"><ha-icon icon="mdi:plus"></ha-icon>' + esc(L(d.add)) + '</button></div>';
        host.appendChild(p);
        ls.panel = p;
        p.querySelector('.add').addEventListener('click', function () {
          var list = (self._config[key] || []).slice(); list.push(d.newItem());
          var cfg = Object.assign({}, self._config); cfg[key] = list; self._emit(cfg);
        });
      }
      var rowsEl = ls.panel.querySelector('.rows');
      if (ls.rowsKey !== items.length) {
        ls.rowsKey = items.length; rowsEl.innerHTML = ''; ls.rows = [];
        items.forEach(function (it, i) {
          var row = document.createElement('div'); row.className = 'row';
          var f = document.createElement('ha-form');
          f.hass = self._hass;
          f.computeLabel = function (s) { return L((d.labels && d.labels[s.name]) || s.name); };
          f.addEventListener('value-changed', function (ev) {
            ev.stopPropagation();
            var list = (self._config[key] || []).slice();
            list[i] = self._cleanItem(Object.assign({}, list[i], ev.detail.value));
            var cfg = Object.assign({}, self._config); cfg[key] = list; self._emit(cfg);
          });
          var tools = document.createElement('div'); tools.className = 'tools';
          if (i > 0) {
            var up = document.createElement('button'); up.className = 'i'; up.title = L('up'); up.innerHTML = '<ha-icon icon="mdi:arrow-up"></ha-icon>';
            up.addEventListener('click', function () {
              var list = (self._config[key] || []).slice(); var t = list[i - 1]; list[i - 1] = list[i]; list[i] = t;
              var cfg = Object.assign({}, self._config); cfg[key] = list; ls.rowsKey = null; self._emit(cfg);
            });
            tools.appendChild(up);
          }
          var del = document.createElement('button'); del.className = 'i'; del.title = L('remove'); del.innerHTML = '<ha-icon icon="mdi:delete-outline"></ha-icon>';
          del.addEventListener('click', function () {
            var list = (self._config[key] || []).slice(); list.splice(i, 1);
            var cfg = Object.assign({}, self._config); if (list.length) cfg[key] = list; else delete cfg[key]; self._emit(cfg);
          });
          tools.appendChild(del);
          row.appendChild(f); row.appendChild(tools); rowsEl.appendChild(row);
          ls.rows.push(f);
        });
      }
      items.forEach(function (it, i) {
        var f = ls.rows[i]; if (!f) return;
        f.hass = self._hass; f.schema = d.schema(it); f.data = d.data(it);
      });
    }
    _cleanItem(it) {
      var out = {};
      Object.keys(it).forEach(function (k) { if (it[k] !== undefined && it[k] !== null && it[k] !== '') out[k] = it[k]; });
      return out;
    }
  }

  /* ================================================================ 1. gauge */

  var GAUGE_DEF = Object.assign({ entity: null, name: '', show_name: true, icon: '', unit: '', decimals: 0, min: 0, max: 100, yellow_from: null, red_from: null,
    low_color: [92, 242, 166], mid_color: [255, 198, 92], high_color: [255, 107, 125], needle: true, min_height: 200,
    tap_action: null, hold_action: null, double_tap_action: null }, LOOK_DEF);

  class CasaFuturaGaugeCard extends HTMLElement {
    static getConfigElement() { return document.createElement('casa-futura-gauge-card-editor'); }
    static getStubConfig(hass) {
      var ids = Object.keys((hass && hass.states) || {});
      var p = ids.filter(function (e) { var s = hass.states[e]; return e.indexOf('sensor.') === 0 && s.attributes.device_class === 'power'; })[0];
      return p ? { entity: p, min: 0, max: 3000 } : { entity: ids.filter(function (e) { return e.indexOf('sensor.') === 0 && num(hass.states[e].state) != null; })[0] || '' };
    }
    constructor() { super(); this.attachShadow({ mode: 'open' }); }
    setConfig(c) {
      if (!c || !c.entity) throw new Error('entity is required');
      this._config = Object.assign({}, GAUGE_DEF, c);
      this._built = false;
      if (this._hass) this._build();
    }
    set hass(h) {
      var old = this._hass; this._hass = h;
      if (!this._config) return;
      if (!this._built) { this._build(); return; }
      if (!old || old.states[this._config.entity] !== h.states[this._config.entity]) this._update();
    }
    set layout(v) { this._layout = v; if (this._built) this._$('g').style.minHeight = v === 'grid' ? '0' : (num(this._config.min_height) || 200) + 'px'; }
    getCardSize() { return 4; }
    getGridOptions() { return { columns: 6, rows: 4, min_columns: 3, min_rows: 2 }; }
    _$(id) { return this.shadowRoot.getElementById(id); }
    _range() {
      var c = this._config, min = num(c.min), max = num(c.max);
      if (min == null) min = 0; if (max == null || max <= min) max = min + 100;
      var y = num(c.yellow_from), r = num(c.red_from);
      if (y == null) y = min + (max - min) * 0.6; if (r == null) r = min + (max - min) * 0.85;
      return { min: min, max: max, y: clamp(y, min, max), r: clamp(r, min, max) };
    }
    _build() {
      var c = this._config, self = this, R0 = this._range(), title = c.show_name !== false;
      var cx = 118, cy = 108, R = 100;
      function pt(v, r) {
        var a = (180 + 180 * (clamp(v, R0.min, R0.max) - R0.min) / (R0.max - R0.min)) * Math.PI / 180;
        return [cx + (r || R) * Math.cos(a), cy + (r || R) * Math.sin(a)];
      }
      function arc(v0, v1, r) {
        var p0 = pt(v0, r), p1 = pt(v1, r);
        return 'M' + p0[0].toFixed(1) + ' ' + p0[1].toFixed(1) + ' A' + (r || R) + ' ' + (r || R) + ' 0 0 1 ' + p1[0].toFixed(1) + ' ' + p1[1].toFixed(1);
      }
      this._arc = arc;
      var low = rgb(c.low_color, ACC.green), mid = rgb(c.mid_color, ACC.amber), high = rgb(c.high_color, ACC.red);
      this._cols = [low, mid, high];
      var zones = [[R0.min, R0.y, low], [R0.y, R0.r, mid], [R0.r, R0.max, high]].filter(function (z) { return z[1] > z[0]; });
      var step = Math.pow(10, Math.floor(Math.log10((R0.max - R0.min) / 4 || 1)));
      while ((R0.max - R0.min) / step > 8) step *= 2;
      var ticks = '';
      for (var v = Math.ceil(R0.min / step) * step; v <= R0.max + 1e-9; v += step) {
        var a1 = pt(v, R - 17), a2 = pt(v, R - 25);
        ticks += '<line x1="' + a1[0].toFixed(1) + '" y1="' + a1[1].toFixed(1) + '" x2="' + a2[0].toFixed(1) + '" y2="' + a2[1].toFixed(1) + '" stroke="rgba(255,255,255,.35)" stroke-width="1.8" stroke-linecap="round"/>';
      }
      var s = st(this._hass, c.entity), unit = c.unit || (s && s.attributes.unit_of_measurement) || '';
      var l = langOf(this._hass), lab = function (v) {
        if (Math.abs(v) >= 1000 && /^(W|Wh)$/.test(unit)) return fmt(v / 1000, v % 1000 ? 1 : 0, l) + ' k' + unit;
        return fmt(v, Math.round(v) === v ? 0 : 1, l) + (unit ? ' ' + unit : '');
      };
      this.shadowRoot.innerHTML = '<style>' + BASE + ':host{height:100%}' +
        '.g{height:100%;min-height:' + (this._layout === 'grid' ? 0 : num(c.min_height) || 200) + 'px;padding:' + (title ? '14px 16px 10px' : '10px 12px 8px') + ';display:flex;flex-direction:column;transition:transform .15s}' +
        '.g.act{cursor:pointer}.g.pressed{transform:scale(.97)}' +
        '.nm{display:flex;align-items:center;gap:8px;font-size:12px;letter-spacing:.16em;text-transform:uppercase;opacity:.62;--ic:18px}' +
        '.nm ha-icon{color:rgb(var(--cf-acc));opacity:1}' +
        '.sv{position:relative;flex:1;min-height:60px}.sv svg{position:absolute;top:0;left:0;width:100%;height:100%;overflow:visible}' +
        '.ndl{transition:transform 1.1s cubic-bezier(.3,1.35,.5,1)}' +
        '</style><ha-card class="glass g' + (c.glass === false ? ' plain' : '') + '" id="g">' +
        (title ? '<div class="nm">' + (c.icon ? '<ha-icon icon="' + esc(c.icon) + '"></ha-icon>' : '') + '<span id="nm"></span></div>' : '') +
        '<div class="sv"><svg viewBox="0 0 236 156" preserveAspectRatio="xMidYMid meet">' +
        '<defs><filter id="gl" filterUnits="userSpaceOnUse" x="-30" y="-30" width="296" height="218"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>' +
        '<path d="' + arc(R0.min, R0.max) + '" fill="none" stroke="rgba(255,255,255,.07)" stroke-width="17" stroke-linecap="round"/>' +
        zones.map(function (z) { return '<path d="' + arc(z[0], z[1]) + '" fill="none" stroke="rgba(' + z[2] + ',.28)" stroke-width="17"/>'; }).join('') +
        '<path id="va" d="" fill="none" stroke-width="17" stroke-linecap="round" filter="url(#gl)"/>' + ticks +
        (c.needle !== false ? '<g class="ndl" id="ndl" style="transform-origin:' + cx + 'px ' + cy + 'px;transform:rotate(180deg)">' +
          '<line x1="' + cx + '" y1="' + cy + '" x2="' + (cx + R - 26) + '" y2="' + cy + '" stroke="currentColor" stroke-width="5" stroke-linecap="round" filter="url(#gl)"/></g>' +
          '<circle cx="' + cx + '" cy="' + cy + '" r="8" fill="#0b0f1a" stroke="currentColor" stroke-width="3"/>' : '') +
        '<text x="' + (cx - R) + '" y="' + (cy + 22) + '" text-anchor="middle" font-size="13" fill="currentColor" opacity=".45">' + esc(lab(R0.min)) + '</text>' +
        '<text x="' + (cx + R) + '" y="' + (cy + 22) + '" text-anchor="middle" font-size="13" fill="currentColor" opacity=".45">' + esc(lab(R0.max)) + '</text>' +
        '<text id="val" x="' + cx + '" y="' + (cy + (c.needle !== false ? 46 : 18)) + '" text-anchor="middle" font-size="44" font-weight="300" fill="currentColor"></text>' +
        '</svg></div></ha-card>';
      lookVars(this._$('g'), c);
      this._built = true;
      bindActions(this, this._$('g'), function () { return self._config; }, function () { return self._config.entity; }, null, { tap: 'more-info' });
      this._update();
    }
    _update() {
      var c = this._config, s = st(this._hass, c.entity), R0 = this._range(), l = langOf(this._hass);
      var nm = this._$('nm'); if (nm) nm.textContent = c.name || (s && s.attributes.friendly_name) || c.entity;
      var v = s ? num(s.state) : null;
      if (v == null) { this._$('val').textContent = s ? stateText(this._hass, s) : '—'; return; }
      var col = v >= R0.r ? this._cols[2] : v >= R0.y ? this._cols[1] : this._cols[0];
      var vc = clamp(v, R0.min, R0.max), va = this._$('va');
      va.setAttribute('d', vc > R0.min ? this._arc(R0.min, vc) : '');
      va.setAttribute('stroke', 'rgb(' + col + ')');
      var ndl = this._$('ndl'); if (ndl) ndl.style.transform = 'rotate(' + (180 + 180 * (vc - R0.min) / (R0.max - R0.min)).toFixed(1) + 'deg)';
      var u = c.unit || s.attributes.unit_of_measurement || '', d = parseInt(c.decimals, 10); if (isNaN(d)) d = 0;
      this._$('val').innerHTML = esc(fmt(v, clamp(d, 0, 3), l)) + (u ? '<tspan font-size="20" opacity=".6"> ' + esc(u) + '</tspan>' : '');
    }
  }

  // tap / hold / double tap with the standard Home Assistant actions
  function bindActions(card, el, cfgFn, entityFn, onTap, defs) {
    defs = defs || {};
    var timer = null, held = false, down = false, sx = 0, sy = 0, lastTap = 0, tapT = null;
    function act(k) {
      var c = cfgFn(), a = c[k + '_action'];
      if (k === 'tap' && onTap) a = { action: 'cf-internal' };
      if (!a && defs[k] && entityFn()) a = { action: defs[k] };
      return a && a.action && a.action !== 'none' ? a : null;
    }
    function run(k) {
      var a = act(k); if (!a) return;
      haptic(card);
      if (a.action === 'cf-internal') { onTap(); return; }
      var c = cfgFn();
      fire(card, 'hass-action', { config: { entity: entityFn(), tap_action: act('tap') || { action: 'none' }, hold_action: act('hold') || { action: 'none' }, double_tap_action: act('double_tap') || { action: 'none' } }, action: k });
      return c;
    }
    function clear() { clearTimeout(timer); el.classList.remove('pressed'); }
    el.classList.toggle('act', !!(act('tap') || act('hold')));
    el.addEventListener('pointerdown', function (e) {
      if (e.button) return;
      down = true; held = false; sx = e.clientX; sy = e.clientY;
      if (act('tap') || act('hold')) el.classList.add('pressed');
      if (act('hold')) timer = setTimeout(function () { if (!down) return; held = true; clear(); run('hold'); }, 500);
    });
    el.addEventListener('pointermove', function (e) { if (down && (Math.abs(e.clientX - sx) > 12 || Math.abs(e.clientY - sy) > 12)) { down = false; clear(); } });
    el.addEventListener('pointerup', function () {
      if (!down) return;
      down = false; clear();
      if (held) return;
      if (act('double_tap')) {
        var now = Date.now();
        if (now - lastTap < 280) { clearTimeout(tapT); lastTap = 0; run('double_tap'); return; }
        lastTap = now; tapT = setTimeout(function () { run('tap'); }, 280);
      } else run('tap');
    });
    el.addEventListener('pointercancel', function () { down = false; clear(); });
    el.addEventListener('pointerleave', function () { if (down) { down = false; clear(); } });
  }

  class CasaFuturaGaugeCardEditor extends CFEditor {
    _defaults() { return GAUGE_DEF; }
    _data() { return Object.assign({}, GAUGE_DEF, { yellow_from: undefined, red_from: undefined }, this._config); }
    _schema() {
      return [
        this._section('s_main', 'mdi:gauge', [
          { name: 'entity', selector: { entity: { filter: { domain: ['sensor', 'number', 'input_number'] } } } },
          { type: 'grid', name: '', schema: [{ name: 'name', selector: { text: {} } }, { name: 'icon', selector: { icon: {} } }] },
          { type: 'grid', name: '', schema: [{ name: 'show_name', selector: { boolean: {} } }, { name: 'needle', selector: { boolean: {} } }] },
          { type: 'grid', name: '', schema: [{ name: 'unit', selector: { text: {} } }, { name: 'decimals', selector: { number: { min: 0, max: 3, mode: 'box' } } }] }
        ], true),
        this._section('s_scale', 'mdi:palette-swatch-outline', [
          { type: 'grid', name: '', schema: [{ name: 'min', selector: { number: { mode: 'box', step: 'any' } } }, { name: 'max', selector: { number: { mode: 'box', step: 'any' } } }] },
          { type: 'grid', name: '', schema: [{ name: 'yellow_from', selector: { number: { mode: 'box', step: 'any' } } }, { name: 'red_from', selector: { number: { mode: 'box', step: 'any' } } }] },
          { type: 'grid', name: '', schema: [{ name: 'low_color', selector: { color_rgb: {} } }, { name: 'mid_color', selector: { color_rgb: {} } }, { name: 'high_color', selector: { color_rgb: {} } }] }
        ]),
        this._section('s_look', 'mdi:format-paint', this._lookSchema().concat([
          { name: 'min_height', selector: { number: { min: 80, max: 800, step: 10, mode: 'slider', unit_of_measurement: 'px' } } }
        ])),
        this._section('s_actions', 'mdi:gesture-tap', [
          { name: 'tap_action', selector: { ui_action: { default_action: 'more-info' } } },
          { name: 'hold_action', selector: { ui_action: { default_action: 'none' } } },
          { name: 'double_tap_action', selector: { ui_action: { default_action: 'none' } } }
        ])
      ];
    }
  }

  /* ================================================================ 2. alerts: floating bell + side panel */

  var ALERTS_DEF = Object.assign({ title: '', alerts: [], bell_top: 14, bell_right: 16, bell_size: 52 }, LOOK_DEF);

  function alertOn(hass, a) {
    var s = st(hass, a.entity); if (!s) return false;
    var stt = String(s.state), cond = a.condition || 'on', vals = String(a.value == null ? '' : a.value).split(',').map(function (x) { return x.trim(); });
    if (cond === 'equals') return vals.indexOf(stt) >= 0;
    if (cond === 'not_equals') return stt !== 'unavailable' && stt !== 'unknown' && vals.indexOf(stt) < 0;
    if (cond === 'above') return num(stt) != null && num(stt) > num(a.value);
    if (cond === 'below') return num(stt) != null && num(stt) < num(a.value);
    return isActive(s) || stt === 'on' || stt === 'open' || stt === 'unlocked' || stt === 'triggered';
  }

  class CasaFuturaAlertsCard extends HTMLElement {
    static getConfigElement() { return document.createElement('casa-futura-alerts-card-editor'); }
    static getStubConfig() { return { alerts: [] }; }
    constructor() { super(); this.attachShadow({ mode: 'open' }); }
    setConfig(c) {
      this._config = Object.assign({}, ALERTS_DEF, c || {});
      this._key = null;
      if (this._portal) { this._portal.remove(); this._portal = null; }
      if (this.isConnected) this._mount();
      this._render();
    }
    set hass(h) { this._hass = h; this._render(); }
    // visible only while editing the dashboard or in the card picker
    set preview(v) { this._preview = !!v; this._render(); }
    set editMode(v) { this._edit = !!v; this._render(); }
    connectedCallback() { this._mount(); this._key = null; this._render(); }
    disconnectedCallback() {
      if (this._portal) { this._portal.remove(); this._portal = null; }
      if (this._onKey) { document.removeEventListener('keydown', this._onKey); this._onKey = null; }
      if (this._onClose) { window.removeEventListener('casa-futura-close', this._onClose); this._onClose = null; }
      this._open = false;
    }
    getCardSize() { return this._preview || this._edit ? 1 : 0; }
    getGridOptions() { return { columns: 12, rows: 1, min_rows: 1 }; }
    _mount() {
      if (this._portal || !this._config) return;
      var self = this, c = this._config, size = clamp(num(c.bell_size) || 52, 32, 96);
      var p = document.createElement('div'); p.setAttribute('data-casa-futura-alerts', '');
      var r = p.attachShadow({ mode: 'open' });
      r.innerHTML = '<style>' + BASE +
        '.bell{--a:' + ACC.amber + ';position:fixed;z-index:7;top:calc(var(--safe-area-inset-top,0px) + ' + (num(c.bell_top) || 0) + 'px);right:calc(var(--safe-area-inset-right,0px) + ' + (num(c.bell_right) || 0) + 'px);' +
        '  width:' + size + 'px;height:' + size + 'px;border-radius:50%;display:flex;align-items:center;justify-content:center;--ic:' + Math.round(size * 0.46) + 'px;color:rgb(var(--a));' +
        '  background:radial-gradient(circle at 50% 30%,rgba(var(--a),.40),rgba(12,16,28,.84) 72%);-webkit-backdrop-filter:blur(20px);backdrop-filter:blur(20px);' +
        '  border:1px solid rgba(var(--a),.7);box-shadow:0 0 22px rgba(var(--a),.5),0 8px 22px rgba(0,0,0,.5),inset 0 1px 0 rgba(255,255,255,.35);' +
        '  opacity:0;transform:scale(.4);pointer-events:none;transition:opacity .3s,transform .45s cubic-bezier(.2,1.4,.4,1)}' +
        '.bell.on{opacity:1;transform:none;pointer-events:auto}.bell.on:active{transform:scale(.9)}' +
        '.bell.nuova ha-icon{animation:ring 1s ease-in-out}' +
        '.halo{position:absolute;top:-1px;left:-1px;right:-1px;bottom:-1px;border-radius:50%;border:2px solid rgba(var(--a),.6);animation:halo 2.4s ease-out infinite;pointer-events:none}' +
        '.cnt{position:absolute;top:-5px;right:-5px;min-width:22px;height:22px;padding:0 6px;border-radius:11px;display:flex;align-items:center;justify-content:center;' +
        '  font:700 12px/1 var(--cf-font);color:#0b0f1a;background:rgb(var(--a));box-shadow:0 0 12px rgba(var(--a),.8);border:2px solid rgba(8,11,20,.9)}' +
        '.scrim{position:fixed;top:0;left:0;right:0;bottom:0;z-index:7;background:rgba(3,5,10,.45);opacity:0;pointer-events:none;transition:opacity .3s}' +
        '.w.open .scrim{opacity:1;pointer-events:auto}' +
        '.pan{position:fixed;z-index:7;top:calc(var(--safe-area-inset-top,0px) + 10px);right:calc(var(--safe-area-inset-right,0px) + 10px);bottom:calc(var(--safe-area-inset-bottom,0px) + 10px);' +
        '  width:min(400px,calc(100vw - 20px));display:flex;flex-direction:column;overflow:hidden;touch-action:pan-y;' +
        '  background:linear-gradient(160deg,rgba(26,32,54,.88),rgba(9,12,22,.94));transform:translateX(calc(100% + 30px));transition:transform .4s cubic-bezier(.2,.9,.25,1)}' +
        '.w.open .pan{transform:none}' +
        '.hd{display:flex;align-items:center;gap:12px;padding:20px 16px 12px 22px;flex:none}' +
        '.ht{flex:1;min-width:0}.tt{font-size:22px;font-weight:600}.st{font-size:14px;opacity:.6;margin-top:2px}' +
        '.x{--ic:22px;width:46px;height:46px;border-radius:16px;display:flex;align-items:center;justify-content:center;flex:none;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.13)}' +
        '.lst{flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;touch-action:pan-y;padding:4px 14px 18px;display:flex;flex-direction:column;gap:10px;scrollbar-width:none}' +
        '.it{--a:' + ACC.cyan + ';display:flex;align-items:center;gap:14px;padding:14px 12px;border-radius:22px;cursor:pointer;flex:none;touch-action:pan-y;' +
        '  background:linear-gradient(150deg,rgba(var(--a),.2),rgba(255,255,255,.03) 70%);border:1px solid rgba(var(--a),.45);box-shadow:0 0 18px rgba(var(--a),.14);transition:transform .12s}' +
        '.lst.anim .it{animation:entra .42s cubic-bezier(.2,.9,.3,1) backwards}.it:active{transform:scale(.97)}' +
        '.it .ic{--ic:24px;width:46px;height:46px;border-radius:50%;flex:none;display:flex;align-items:center;justify-content:center;color:rgb(var(--a));background:rgba(var(--a),.22);box-shadow:0 0 14px rgba(var(--a),.45)}' +
        '.it .tx{flex:1;min-width:0}.it .t1{font-size:16px;font-weight:600;line-height:1.25}.it .t2{font-size:13px;opacity:.6;margin-top:3px}' +
        '@keyframes entra{from{opacity:0;transform:translateX(34px)}to{opacity:1;transform:none}}' +
        '@keyframes halo{0%{transform:scale(1);opacity:.85}100%{transform:scale(1.6);opacity:0}}' +
        '@keyframes ring{0%,100%{transform:rotate(0)}15%{transform:rotate(16deg)}30%{transform:rotate(-14deg)}45%{transform:rotate(10deg)}60%{transform:rotate(-6deg)}}' +
        '</style><div class="w" id="w"><button class="bell" id="bell" aria-label="Alerts"><span class="halo"></span><ha-icon icon="mdi:bell-ring"></ha-icon><span class="cnt" id="cnt"></span></button>' +
        '<div class="scrim" id="scrim"></div><aside class="glass pan" id="pan"><div class="hd"><div class="ht"><div class="tt" id="tt"></div><div class="st" id="st"></div></div>' +
        '<button class="x" id="x" aria-label="Close"><ha-icon icon="mdi:close"></ha-icon></button></div><div class="lst" id="lst"></div></aside></div>';
      lookVars(r.getElementById('w'), c);
      document.body.appendChild(p);
      this._portal = p;
      r.getElementById('bell').addEventListener('click', function () { haptic(self); self._toggle(!self._open); });
      r.getElementById('x').addEventListener('click', function () { self._toggle(false); });
      r.getElementById('scrim').addEventListener('click', function () { self._toggle(false); });
      this._swipe(r.getElementById('pan'));
      if (!this._onKey) { this._onKey = function (e) { if (e.key === 'Escape') self._toggle(false); }; document.addEventListener('keydown', this._onKey); }
      if (!this._onClose) { this._onClose = function () { self._toggle(false); }; window.addEventListener('casa-futura-close', this._onClose); }
    }
    _toggle(v) {
      if (!this._portal) return;
      var r = this._portal.shadowRoot, lst = r.getElementById('lst');
      if (v) { this._key = null; this._render(); if (!this._n) v = false; }
      if (v && !this._open) { lst.scrollTop = 0; lst.classList.add('anim'); setTimeout(function () { lst.classList.remove('anim'); }, 900); }
      this._open = !!v;
      r.getElementById('w').classList.toggle('open', this._open);
    }
    _swipe(pan) {
      var self = this, down = false, drag = false, sx = 0, sy = 0, dx = 0, t0 = 0;
      pan.addEventListener('pointerdown', function (e) { if (e.button) return; down = true; drag = false; sx = e.clientX; sy = e.clientY; dx = 0; t0 = Date.now(); });
      pan.addEventListener('pointermove', function (e) {
        if (!down) return;
        var mx = e.clientX - sx, my = e.clientY - sy;
        if (!drag) {
          if (Math.abs(my) > 10 && Math.abs(my) > Math.abs(mx)) { down = false; return; }
          if (mx < 10) return;
          drag = true; pan.style.transition = 'none';
          try { pan.setPointerCapture(e.pointerId); } catch (x) { /* ignore */ }
        }
        dx = Math.max(0, mx); pan.style.transform = 'translateX(' + dx + 'px)';
      });
      pan.addEventListener('pointerup', function () {
        if (!down) return; down = false;
        if (!drag) return; drag = false;
        pan.style.transition = ''; pan.style.transform = '';
        if (dx > 90 || (dx > 30 && dx / Math.max(1, Date.now() - t0) > 0.5)) self._toggle(false);
        self._dragged = true; setTimeout(function () { self._dragged = false; }, 80);
      });
      pan.addEventListener('pointercancel', function () { if (drag) { pan.style.transition = ''; pan.style.transform = ''; } down = false; drag = false; });
    }
    _render() {
      var c = this._config, h = this._hass; if (!c || !h) return;
      var self = this, l = langOf(h), list = (c.alerts || []).filter(function (a) { return a && a.entity; });
      var act = list.filter(function (a) { return alertOn(h, a); }).map(function (a) {
        var s = st(h, a.entity), extra = '';
        if (a.attribute && s.attributes[a.attribute] != null) {
          var v = s.attributes[a.attribute];
          extra = (typeof v === 'number' ? fmt(v, Math.round(v) === v ? 0 : 1, l) : String(v)) + (a.suffix || '');
        }
        return { a: a, s: s, extra: extra };
      });
      // placeholder while editing, otherwise the card takes no space
      var show = this._preview || this._edit || /[?&]edit=1/.test(location.search);
      if (show !== this._shown) {
        this._shown = show;
        this.style.display = show ? '' : 'none';
        this.shadowRoot.innerHTML = show ? '<style>' + BASE + '.ph{display:flex;align-items:center;gap:12px;padding:14px 16px;--ic:26px;font-family:var(--paper-font-body1_-_font-family,sans-serif)}' +
          '.ph b{display:block}.ph span{opacity:.65;font-size:13px}</style><ha-card class="glass ph" id="ph"><ha-icon icon="mdi:bell-ring-outline"></ha-icon><div><b id="phT"></b><span id="phS"></span></div></ha-card>' : '';
        if (show) lookVars(this.shadowRoot.getElementById('ph'), c);
      }
      if (show) {
        this.shadowRoot.getElementById('phT').textContent = c.title || tr(h, 'alerts_card');
        this.shadowRoot.getElementById('phS').textContent = list.length + ' ' + tr(h, 'configured') + ' · ' + act.length + ' ' + tr(h, 'active') + ' — ' + tr(h, 'alerts_hint');
      }
      if (!this._portal) return;
      var key = JSON.stringify(act.map(function (x) { return [x.a.entity, x.a.text, x.extra, x.s.state]; }));
      if (key === this._key) return;
      var prev = this._n || 0;
      this._key = key; this._n = act.length;
      var r = this._portal.shadowRoot, bell = r.getElementById('bell');
      bell.classList.toggle('on', act.length > 0);
      if (act.length) {
        bell.style.setProperty('--a', rgb(act[0].a.color, ACC.amber));
        r.getElementById('cnt').textContent = act.length;
        if (act.length > prev) { bell.classList.remove('nuova'); void bell.offsetWidth; bell.classList.add('nuova'); }
      }
      r.getElementById('tt').textContent = c.title || tr(h, 'alerts');
      r.getElementById('st').textContent = act.length === 1 ? tr(h, 'active_1') : tr(h, 'active_n', act.length);
      var lst = r.getElementById('lst');
      lst.innerHTML = act.map(function (x, i) {
        var name = x.a.text || (x.s.attributes.friendly_name || x.a.entity);
        var sub = [x.extra || stateText(h, x.s)].filter(Boolean).join(' · ');
        return '<div class="it" data-i="' + i + '" style="--a:' + rgb(x.a.color, ACC.cyan) + ';animation-delay:' + (i * 45) + 'ms">' +
          '<span class="ic"><ha-icon icon="' + esc(x.a.icon || x.s.attributes.icon || 'mdi:alert-circle-outline') + '"></ha-icon></span>' +
          '<span class="tx"><div class="t1">' + esc(name) + '</div>' + (sub ? '<div class="t2">' + esc(sub) + '</div>' : '') + '</span>' +
          '<ha-icon icon="mdi:chevron-right" style="opacity:.4;--ic:20px"></ha-icon></div>';
      }).join('');
      Array.prototype.forEach.call(lst.querySelectorAll('.it'), function (el) {
        var x = act[+el.getAttribute('data-i')];
        el.addEventListener('click', function () {
          if (self._dragged) return;
          haptic(self);
          self._toggle(false);
          var a = x.a.tap_action && x.a.tap_action.action ? x.a.tap_action : { action: 'more-info' };
          setTimeout(function () { runAction(self, a, x.a.entity); }, 160);
        });
      });
      if (!act.length && this._open) this._toggle(false);
    }
  }

  class CasaFuturaAlertsCardEditor extends CFEditor {
    constructor() { super(); this._listKey = 'alerts'; this._listTitle = 's_alerts'; this._listHelp = 'alerts_h'; this._listAdd = 'add_alert'; }
    _defaults() { return ALERTS_DEF; }
    _data() { return Object.assign({}, ALERTS_DEF, this._config); }
    _fromForm(v) { var out = this._clean(v, this._defaults()); if (v.alerts && v.alerts.length) out.alerts = v.alerts; return out; }
    _schema() {
      return [
        this._section('s_bell', 'mdi:bell-cog-outline', [
          { name: 'title', selector: { text: {} } },
          { type: 'grid', name: '', schema: [
            { name: 'bell_top', selector: { number: { min: 0, max: 400, mode: 'box', unit_of_measurement: 'px' } } },
            { name: 'bell_right', selector: { number: { min: 0, max: 400, mode: 'box', unit_of_measurement: 'px' } } },
            { name: 'bell_size', selector: { number: { min: 32, max: 96, mode: 'box', unit_of_measurement: 'px' } } }
          ] }
        ], true),
        this._section('s_look', 'mdi:format-paint', this._lookSchema())
      ];
    }
    _newItem() { return { entity: '', condition: 'on', icon: 'mdi:alert-circle-outline', color: [255, 198, 92] }; }
    _itemSchema(it) {
      var L = this._L.bind(this), cond = it.condition || 'on';
      var s = [
        { name: 'entity', selector: { entity: {} } },
        { type: 'grid', name: '', schema: [
          { name: 'condition', selector: { select: { mode: 'dropdown', options: ['on', 'equals', 'not_equals', 'above', 'below'].map(function (v) { return { value: v, label: L('c_' + v) }; }) } } }
        ].concat(cond !== 'on' ? [{ name: 'value', selector: { text: {} } }] : []) },
        { name: 'text', selector: { text: {} } },
        { type: 'grid', name: '', schema: [{ name: 'icon', selector: { icon: {} } }, { name: 'color', selector: { color_rgb: {} } }] },
        { type: 'grid', name: '', schema: [{ name: 'attribute', selector: { attribute: { entity_id: it.entity || '' } } }, { name: 'suffix', selector: { text: {} } }] },
        { name: 'tap_action', selector: { ui_action: { default_action: 'more-info' } } }
      ];
      return s;
    }
    _itemData(it) { return Object.assign({ condition: 'on', color: [255, 198, 92] }, it, { color: rgbArr(rgb(it.color, '255,198,92')) }); }
  }

  /* ================================================================ 3. action button: confirmation, PIN, several choices */

  var ACTION_DEF = Object.assign({ entity: null, name: '', icon: '', label: '', color: null, min_height: 120, show_state: true,
    confirm: false, confirm_text: '', pin_hash: '', pin_length: 4, choices: [], tap_action: null, hold_action: null, double_tap_action: null }, LOOK_DEF);

  function iconFor(c, s) {
    return c.icon || (s && s.attributes.icon) || (s && s.entity_id.indexOf('lock.') === 0 ? (s.state === 'locked' ? 'mdi:lock' : 'mdi:lock-open-variant') : 'mdi:gesture-tap-button');
  }

  class CasaFuturaActionCard extends HTMLElement {
    static getConfigElement() { return document.createElement('casa-futura-action-card-editor'); }
    static getStubConfig(hass) {
      var lock = Object.keys((hass && hass.states) || {}).filter(function (e) { return e.indexOf('lock.') === 0; })[0];
      return lock ? { entity: lock, confirm: true, choices: [
        { label: 'Unlock', icon: 'mdi:lock-open-variant', color: [255, 198, 92], when: 'locked', action: { action: 'perform-action', perform_action: 'lock.unlock', target: { entity_id: lock } } },
        { label: 'Lock', icon: 'mdi:lock', color: [92, 242, 166], when: 'unlocked', action: { action: 'perform-action', perform_action: 'lock.lock', target: { entity_id: lock } } }
      ] } : { name: 'Button', icon: 'mdi:gesture-tap-button', confirm: true };
    }
    constructor() { super(); this.attachShadow({ mode: 'open' }); }
    setConfig(c) {
      if (!c) throw new Error('Invalid configuration');
      this._config = Object.assign({}, ACTION_DEF, c);
      if (c.pin && !c.pin_hash) this._config.pin_hash = pinHash(String(c.pin));
      this._built = false;
      if (this._hass) this._build();
    }
    set hass(h) {
      var old = this._hass; this._hass = h;
      if (!this._config) return;
      if (!this._built) { this._build(); return; }
      if (!old || old.states[this._config.entity] !== h.states[this._config.entity]) this._update();
    }
    set layout(v) { this._layout = v; if (this._built) this._$('b').style.minHeight = v === 'grid' ? '0' : (num(this._config.min_height) || 120) + 'px'; }
    getCardSize() { return 2; }
    getGridOptions() { return { columns: 3, rows: 2, min_columns: 2, min_rows: 1 }; }
    _$(id) { return this.shadowRoot.getElementById(id); }
    _needsDialog() { var c = this._config; return !!(c.confirm || c.pin_hash || (c.choices && c.choices.length)); }
    _build() {
      var c = this._config, self = this;
      this.shadowRoot.innerHTML = '<style>' + BASE + ':host{height:100%}' +
        '.b{height:100%;min-height:' + (this._layout === 'grid' ? 0 : num(c.min_height) || 120) + 'px;padding:16px 18px;display:flex;flex-direction:column;justify-content:space-between;gap:8px;transition:transform .12s,box-shadow .3s,background .3s}' +
        '.b.act{cursor:pointer}.b.pressed{transform:scale(.96)}' +
        '.b ha-icon{--ic:40px;color:rgba(var(--cf-text),.6);transition:color .3s,filter .3s}' +
        '.b.on{background:linear-gradient(150deg,rgba(var(--cf-acc),.32),rgba(var(--cf-acc),.08));border-color:rgba(var(--cf-acc),.6);box-shadow:0 0 30px rgba(var(--cf-acc),.28),inset 0 1px 0 rgba(255,255,255,.35)}' +
        '.b.on ha-icon{color:rgb(var(--cf-acc));filter:drop-shadow(0 0 8px rgba(var(--cf-acc),.9))}' +
        '.n{font-size:20px;font-weight:600;line-height:1.2;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
        '.l{font-size:15px;opacity:.75;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
        '</style><ha-card class="glass b' + (c.glass === false ? ' plain' : '') + '" id="b"><ha-icon id="ic"></ha-icon><div><div class="n" id="n"></div><div class="l" id="l"></div></div></ha-card>';
      lookVars(this._$('b'), c);
      this._built = true;
      bindActions(this, this._$('b'), function () { return self._config; }, function () { return self._config.entity; },
        this._needsDialog() ? function () { self._dialog(); } : null, { tap: 'toggle', hold: 'more-info' });
      this._update();
    }
    _update() {
      var c = this._config, h = this._hass, s = st(h, c.entity);
      var on = s ? isActive(s) : false;
      var hit = (c.choices || []).filter(function (x) { return s && x.when && String(x.when).split(',').map(function (w) { return w.trim(); }).indexOf(s.state) >= 0; })[0];
      var b = this._$('b');
      b.classList.toggle('on', on);
      b.style.setProperty('--cf-acc', rgb(c.color, ACC.cyan));
      this._$('ic').setAttribute('icon', iconFor(c, s));
      this._$('n').textContent = c.name || (s && s.attributes.friendly_name) || '';
      this._$('l').textContent = c.label || (c.show_state !== false && s ? stateText(h, s) : (hit ? '' : ''));
    }
    _dialog() {
      var self = this, c = this._config, h = this._hass, s = st(h, c.entity);
      var choices = (c.choices || []).filter(function (x) { return x && (x.action || x.label); });
      var single = !choices.length ? { label: tr(h, 'confirm'), icon: 'mdi:check', action: c.tap_action || (c.entity ? { action: 'toggle' } : null) } : null;
      // preselect the choice that matches the current state ("when"), otherwise the first
      var sel = -1;
      choices.forEach(function (x, i) { if (sel < 0 && s && x.when && String(x.when).split(',').map(function (w) { return w.trim(); }).indexOf(s.state) >= 0) sel = i; });
      if (sel < 0) sel = 0;
      openDialog(this, c, function (d) {
        var code = '', fails = 0, done = false, len = clamp(parseInt(c.pin_length, 10) || 4, 3, 8);
        var cur = function () { return choices.length ? choices[sel] : single; };
        var acc = function () { return rgb((cur() && cur().color) || c.color, ACC.cyan); };
        d.el.innerHTML = '<div class="orb" id="orb" style="--a:' + acc() + '"><ha-icon id="oic" icon="' + esc(iconFor(c, s)) + '"></ha-icon></div>' +
          '<div class="q">' + esc(c.confirm_text || c.name || (s && s.attributes.friendly_name) || tr(h, 'sure')) + '</div>' +
          '<div class="s" id="sub">' + esc(s ? stateText(h, s) : '') + '</div>' +
          (choices.length > 1 ? '<div class="chs' + (c.pin_hash ? ' row' : '') + '" id="chs">' + choices.map(function (x, i) {
            return '<button class="pill" data-i="' + i + '" style="--a:' + rgb(x.color, ACC.cyan) + '"><ha-icon icon="' + esc(x.icon || 'mdi:check') + '"></ha-icon>' + esc(x.label || '') + '</button>';
          }).join('') + '</div>' : '') +
          (c.pin_hash ? '<div class="dots" id="dots">' + new Array(len + 1).join('<i></i>') + '</div><div class="msg" id="msg"></div>' +
            '<div class="pad" id="pad">' + ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', 'B'].map(function (k) {
              return '<button class="key' + (k === 'C' || k === 'B' ? ' fn' : '') + '" data-k="' + k + '">' +
                (k === 'B' ? '<ha-icon icon="mdi:backspace-outline"></ha-icon>' : k === 'C' ? '<ha-icon icon="mdi:close-circle-outline"></ha-icon>' : k) + '</button>';
            }).join('') + '</div><div class="btns one"><button class="pill" id="no"><ha-icon icon="mdi:close"></ha-icon>' + esc(tr(h, 'cancel')) + '</button></div>'
            : '<div class="btns' + (choices.length > 1 ? ' one' : '') + '"><button class="pill" id="no"><ha-icon icon="mdi:close"></ha-icon>' + esc(tr(h, 'cancel')) + '</button>' +
              (choices.length > 1 ? '' : '<button class="pill on" id="yes" style="--a:' + acc() + '"><ha-icon icon="' + esc((cur() && cur().icon) || 'mdi:check') + '"></ha-icon>' + esc((cur() && cur().label) || tr(h, 'confirm')) + '</button>') + '</div>');
        var $ = function (id) { return d.root.getElementById(id); };
        function refresh() {
          Array.prototype.forEach.call(d.root.querySelectorAll('#chs .pill'), function (b) { b.classList.toggle('on', +b.getAttribute('data-i') === sel); });
          $('orb').style.setProperty('--a', acc());
          var m = $('msg'); if (m && !fails && !code) { m.className = 'msg'; m.textContent = cur() && choices.length > 1 ? tr(h, 'pin_for') + ': ' + String(cur().label || '').toLowerCase() : tr(h, 'pin'); }
        }
        function finish() {
          if (done) return; done = true;
          haptic(self, 'success');
          var a = cur() && cur().action;
          if (a) runAction(self, a, c.entity);
          $('oic').setAttribute('icon', 'mdi:check-bold'); $('orb').style.setProperty('--a', ACC.green);
          var m = $('msg'); if (m) { m.className = 'msg ok'; m.textContent = tr(h, 'done'); }
          setTimeout(d.close, 800);
        }
        Array.prototype.forEach.call(d.root.querySelectorAll('#chs .pill'), function (b) {
          b.addEventListener('click', function () {
            haptic(self); sel = +b.getAttribute('data-i'); refresh();
            if (!c.pin_hash) finish();
          });
        });
        $('no').addEventListener('click', function () { d.close(); });
        if ($('yes')) $('yes').addEventListener('click', finish);
        if (c.pin_hash) {
          var lockUntil = 0;
          var dots = function (cls) {
            var el = $('dots'); el.className = 'dots' + (cls ? ' ' + cls : '');
            Array.prototype.forEach.call(el.children, function (i, idx) { i.classList.toggle('f', idx < code.length); });
          };
          var check = function () {
            if (pinHash(code) === c.pin_hash) { dots('ok'); finish(); return; }
            fails++; haptic(self, 'failure'); dots('ko');
            var m = $('msg'); m.className = 'msg ko';
            if (fails >= 5) {
              lockUntil = Date.now() + 30000; m.textContent = tr(h, 'locked_out'); $('pad').classList.add('off');
              setTimeout(function () { fails = 0; $('pad').classList.remove('off'); refresh(); }, 30000);
            } else m.textContent = tr(h, 'wrong');
            setTimeout(function () { code = ''; dots(); }, 650);
          };
          Array.prototype.forEach.call(d.root.querySelectorAll('.key'), function (b) {
            b.addEventListener('pointerdown', function (e) {
              e.preventDefault(); if (done || Date.now() < lockUntil) return;
              b.classList.add('pressed'); haptic(self);
              var k = b.getAttribute('data-k');
              if (k === 'C') code = ''; else if (k === 'B') code = code.slice(0, -1); else if (code.length < len) code += k;
              dots();
              if (code.length === len) setTimeout(check, 120);
            });
            ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (ev) { b.addEventListener(ev, function () { b.classList.remove('pressed'); }); });
          });
        }
        refresh();
      });
    }
  }

  class CasaFuturaActionCardEditor extends CFEditor {
    constructor() { super(); this._listKey = 'choices'; this._listTitle = 's_choices'; this._listHelp = 'choices_h'; this._listAdd = 'add_choice'; }
    _defaults() { return ACTION_DEF; }
    _data() { var d = Object.assign({}, ACTION_DEF, this._config); d.pin = this._pinDraft || ''; d.color = rgbArr(rgb(this._config.color, ACC.cyan)); return d; }
    _fromForm(v) {
      // the typed PIN stays only in the editor; the configuration gets its fingerprint
      var pin = v.pin; delete v.pin;
      if (pin !== undefined && pin !== this._pinDraft) {
        var had = !!this._pinDraft; this._pinDraft = pin;
        var dg = String(pin || '').replace(/\D/g, '');
        if (dg.length >= 3) { v.pin_hash = pinHash(dg); v.pin_length = dg.length; }
        else if (!dg && had) v.pin_hash = '';
      }
      var out = this._clean(v, this._defaults());
      if (v.choices && v.choices.length) out.choices = v.choices;
      if (out.color && same(out.color, rgbArr(ACC.cyan))) delete out.color;
      return out;
    }
    _schema() {
      var c = this._config;
      var sec = [{ name: 'confirm', selector: { boolean: {} } }];
      if (c.confirm || c.pin_hash) sec.push({ name: 'confirm_text', selector: { text: {} } });
      sec.push({ name: 'pin', selector: { text: { type: 'password' } } });
      return [
        this._section('s_main', 'mdi:gesture-tap-button', [
          { name: 'entity', selector: { entity: {} } },
          { type: 'grid', name: '', schema: [{ name: 'name', selector: { text: {} } }, { name: 'icon', selector: { icon: {} } }] },
          { type: 'grid', name: '', schema: [{ name: 'label', selector: { text: {} } }, { name: 'color', selector: { color_rgb: {} } }] }
        ], true),
        this._section('s_security', 'mdi:shield-key-outline', sec),
        this._section('s_actions', 'mdi:gesture-tap', [
          { name: 'tap_action', selector: { ui_action: { default_action: 'toggle' } } },
          { name: 'hold_action', selector: { ui_action: { default_action: 'more-info' } } }
        ]),
        this._section('s_look', 'mdi:format-paint', this._lookSchema().concat([
          { name: 'min_height', selector: { number: { min: 60, max: 400, step: 5, mode: 'slider', unit_of_measurement: 'px' } } }
        ]))
      ];
    }
    _drawNow() {
      super._drawNow();
      var L = this._L.bind(this);
      this._form.computeHelper = function (s) {
        if (s.name === 'pin') return L(this._pinSet ? 'pin_set' : 'pin_h');
        var k = s.name + '_h', v = L(k); return v === k ? '' : v;
      }.bind({ _pinSet: !!this._config.pin_hash });
    }
    _newItem() { return { label: '', icon: 'mdi:check', color: [95, 243, 255], action: { action: 'toggle' } }; }
    _itemSchema() {
      return [
        { type: 'grid', name: '', schema: [{ name: 'label', selector: { text: {} } }, { name: 'icon', selector: { icon: {} } }, { name: 'color', selector: { color_rgb: {} } }] },
        { name: 'when', selector: { text: {} } },
        { name: 'action', selector: { ui_action: {} } }
      ];
    }
    _itemData(it) { return Object.assign({}, it, { color: rgbArr(rgb(it.color, ACC.cyan)) }); }
  }

  /* ================================================================ 4. climate: dial, modes, fan, presets, swing */

  var CLIMATE_DEF = Object.assign({ entity: null, name: '', icon: '', temperature_entity: null, humidity_entity: null,
    show_modes: true, show_fan: true, show_presets: true, show_swing: true, min_height: 0 }, LOOK_DEF);
  var MODE_ACC = { off: '170,182,200', heat: ACC.orange, cool: ACC.blue, auto: ACC.green, heat_cool: ACC.green, dry: ACC.cyan, fan_only: ACC.violet };
  var MODE_ICON = { off: 'mdi:power', heat: 'mdi:fire', cool: 'mdi:snowflake', auto: 'mdi:thermostat-auto', heat_cool: 'mdi:sun-snowflake-variant', dry: 'mdi:water-percent', fan_only: 'mdi:fan' };
  var CT = {
    en: { modes: 'Mode', fan: 'Fan speed', presets: 'Preset', swing: 'Swing', now: 'Now', off: 'Off', missing: 'Entity not found' },
    it: { modes: 'Modalità', fan: 'Velocità ventola', presets: 'Preset', swing: 'Oscillazione', now: 'Ora', off: 'Spento', missing: 'Entità non trovata' }
  };
  function ct(hass, k) { var t = CT[baseLang(langOf(hass))] || CT.en; return t[k] || CT.en[k]; }
  // Home Assistant translates climate values in every language; the raw value is the last resort
  function climateLabel(hass, kind, v) {
    var keys = kind === 'mode' ? ['component.climate.entity_component._.state.' + v]
      : ['component.climate.entity_component._.state_attributes.' + kind + '.state.' + v];
    for (var i = 0; i < keys.length; i++) { var s = hass && hass.localize ? hass.localize(keys[i]) : ''; if (s && s !== keys[i]) return s; }
    var t = String(v).replace(/_/g, ' '); return t.charAt(0).toUpperCase() + t.slice(1);
  }

  class CasaFuturaClimateCard extends HTMLElement {
    static getConfigElement() { return document.createElement('casa-futura-climate-card-editor'); }
    static getStubConfig(hass) { return { entity: Object.keys((hass && hass.states) || {}).filter(function (e) { return e.indexOf('climate.') === 0; })[0] || '' }; }
    constructor() { super(); this.attachShadow({ mode: 'open' }); }
    setConfig(c) {
      if (!c || !c.entity) throw new Error('entity is required');
      this._config = Object.assign({}, CLIMATE_DEF, c); this._built = false; this._key = null;
      if (this._hass) this._build();
    }
    set hass(h) {
      var old = this._hass, c = this._config; this._hass = h;
      if (!c) return;
      var s = st(h, c.entity), key = s ? JSON.stringify([s.attributes.hvac_modes, s.attributes.fan_modes, s.attributes.preset_modes, s.attributes.swing_modes]) : '';
      if (!this._built || key !== this._key) { this._key = key; this._build(); return; }
      var ids = [c.entity, c.temperature_entity, c.humidity_entity];
      for (var i = 0; i < ids.length; i++) if (ids[i] && (!old || old.states[ids[i]] !== h.states[ids[i]])) { this._update(); return; }
    }
    getCardSize() { return 7; }
    getGridOptions() { return { columns: 12, rows: 6, min_columns: 6, min_rows: 5 }; }
    _$(id) { return this.shadowRoot.getElementById(id); }
    _call(service, data) { var p = service.split('.'); this._hass.callService(p[0], p[1], Object.assign({ entity_id: this._config.entity }, data)); }
    _build() {
      var c = this._config, h = this._hass, self = this, s = st(h, c.entity), a = (s && s.attributes) || {};
      this._min = a.min_temp != null ? a.min_temp : 7; this._max = a.max_temp != null ? a.max_temp : 35;
      if (this._max <= this._min) this._max = this._min + 1;
      this._step = a.target_temp_step || (/F/.test(a.temperature_unit || '') ? 1 : 0.5);
      var order = ['off', 'heat', 'cool', 'auto', 'heat_cool', 'dry', 'fan_only'], modes = a.hvac_modes || [];
      modes = order.filter(function (m) { return modes.indexOf(m) >= 0; }).concat(modes.filter(function (m) { return order.indexOf(m) < 0; }));
      var chips = function (id, kind, list) {
        return list.length ? '<div class="lbl">' + esc(ct(h, id)) + '</div><div class="chips" id="' + id + '">' + list.map(function (v) {
          return '<button class="chip" data-v="' + esc(v) + '">' + esc(climateLabel(h, kind, v)) + '</button>'; }).join('') + '</div>' : '';
      };
      this.shadowRoot.innerHTML = '<style>' + BASE + ':host{height:100%}' +
        '.cc{display:block;height:100%;padding:20px 22px 22px;' + (num(c.min_height) ? 'min-height:' + num(c.min_height) + 'px;' : '') + '}' +
        '.hd{display:flex;align-items:center;gap:12px;margin-bottom:12px}.hd ha-icon{--ic:26px;color:rgb(var(--a))}' +
        '.hd .t{font-size:20px;font-weight:600;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.hd .s{font-size:14px;opacity:.6}' +
        '.body{display:flex;flex-wrap:wrap;gap:22px;align-items:flex-start}' +
        '.left{flex:1 1 260px;max-width:340px;margin:0 auto}.right{flex:1 1 240px;min-width:0}' +
        '.dial{position:relative;width:100%;aspect-ratio:1/1;touch-action:none;--a:170,182,200}' +
        '.dial>svg{position:absolute;top:0;left:0;width:100%;height:100%;overflow:visible}' +
        '.ctr{position:absolute;top:0;left:0;right:0;bottom:0;display:flex;flex-direction:column;align-items:center;justify-content:center;pointer-events:none}' +
        '.tg{font-size:64px;font-weight:300;letter-spacing:-.04em;line-height:1}.tg small{font-size:.35em;vertical-align:top;margin-left:2px;opacity:.7}' +
        '.cur{font-size:15px;opacity:.6;margin-top:8px}' +
        '.act{font-size:13px;letter-spacing:.16em;text-transform:uppercase;margin-bottom:6px;color:rgb(var(--a));min-height:16px}' +
        '.pm{display:flex;justify-content:center;gap:26px;margin-top:4px}' +
        '.pm button{width:72px;height:72px;border-radius:50%;--ic:30px;display:flex;align-items:center;justify-content:center;' +
        '  background:linear-gradient(160deg,rgba(255,255,255,.12),rgba(255,255,255,.035));border:1px solid rgba(255,255,255,.14);transition:transform .1s}' +
        '.pm button:active{transform:scale(.9)}' +
        '.lbl{font-size:12px;letter-spacing:.2em;text-transform:uppercase;opacity:.5;margin:14px 2px 8px}.lbl:first-child{margin-top:0}' +
        '.modes{display:grid;grid-template-columns:repeat(auto-fill,minmax(92px,1fr));gap:10px}' +
        '.md{--m:170,182,200;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;--ic:24px;min-height:66px;border-radius:20px;font-size:14px;' +
        '  background:linear-gradient(160deg,rgba(255,255,255,.12),rgba(255,255,255,.035));border:1px solid rgba(255,255,255,.14);transition:transform .1s,background .25s}' +
        '.md:active{transform:scale(.95)}.md.on{background:linear-gradient(160deg,rgba(var(--m),.48),rgba(var(--m),.16));border-color:rgba(var(--m),.75);box-shadow:0 0 24px rgba(var(--m),.36)}' +
        '.chips{display:flex;flex-wrap:wrap;gap:8px}' +
        '.chip{min-height:40px;padding:0 15px;border-radius:999px;font-size:14px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);transition:all .2s}' +
        '.chip.on{background:linear-gradient(160deg,rgba(var(--a),.42),rgba(var(--a),.14));border-color:rgba(var(--a),.7);box-shadow:0 0 18px rgba(var(--a),.3)}' +
        '.off .arcv{opacity:.35}' +
        '</style><ha-card class="glass cc' + (c.glass === false ? ' plain' : '') + '" id="root">' +
        '<div class="hd"><ha-icon id="hic" icon="' + esc(c.icon || 'mdi:thermostat') + '"></ha-icon><div class="t" id="nm"></div><div class="s" id="st"></div></div>' +
        (!s ? '<div class="s">' + esc(ct(h, 'missing')) + ': ' + esc(c.entity) + '</div>' :
        '<div class="body"><div class="left"><div class="dial" id="dial"><svg viewBox="0 0 320 320" id="svg"></svg>' +
        '<div class="ctr"><div class="act" id="act"></div><div class="tg" id="tgt">—</div><div class="cur" id="cur"></div></div></div>' +
        '<div class="pm"><button id="minus" aria-label="-"><ha-icon icon="mdi:minus"></ha-icon></button><button id="plus" aria-label="+"><ha-icon icon="mdi:plus"></ha-icon></button></div></div>' +
        '<div class="right">' +
        (c.show_modes !== false && modes.length ? '<div class="lbl">' + esc(ct(h, 'modes')) + '</div><div class="modes" id="modes">' + modes.map(function (m) {
          return '<button class="md" data-m="' + esc(m) + '" style="--m:' + (MODE_ACC[m] || ACC.cyan) + '"><ha-icon icon="' + (MODE_ICON[m] || 'mdi:thermostat') + '"></ha-icon>' + esc(climateLabel(h, 'mode', m)) + '</button>';
        }).join('') + '</div>' : '') +
        (c.show_fan !== false ? chips('fan', 'fan_mode', a.fan_modes || []) : '') +
        (c.show_presets !== false ? chips('presets', 'preset_mode', a.preset_modes || []) : '') +
        (c.show_swing !== false ? chips('swing', 'swing_mode', a.swing_modes || []) : '') +
        '</div></div>') + '</ha-card>';
      lookVars(this._$('root'), c);
      this._built = true;
      if (!s) return;
      this._$('minus').addEventListener('click', function () { haptic(self); self._nudge(-1); });
      this._$('plus').addEventListener('click', function () { haptic(self); self._nudge(1); });
      Array.prototype.forEach.call(this.shadowRoot.querySelectorAll('#modes .md'), function (b) {
        b.addEventListener('click', function () { haptic(self, 'medium'); self._call('climate.set_hvac_mode', { hvac_mode: b.getAttribute('data-m') }); });
      });
      [['fan', 'climate.set_fan_mode', 'fan_mode'], ['presets', 'climate.set_preset_mode', 'preset_mode'], ['swing', 'climate.set_swing_mode', 'swing_mode']].forEach(function (g) {
        Array.prototype.forEach.call(self.shadowRoot.querySelectorAll('#' + g[0] + ' .chip'), function (b) {
          b.addEventListener('click', function () { haptic(self); var d = {}; d[g[2]] = b.getAttribute('data-v'); self._call(g[1], d); });
        });
      });
      // drag on the ring to choose the temperature
      var dial = this._$('dial'), drag = false;
      function fromEvent(e) {
        var r = dial.getBoundingClientRect(), x = e.clientX - r.left - r.width / 2, y = e.clientY - r.top - r.height / 2;
        var ang = Math.atan2(y, x) * 180 / Math.PI; if (ang < 90) ang += 360;
        ang = clamp(ang, 135, 405);
        return self._min + (ang - 135) / 270 * (self._max - self._min);
      }
      dial.addEventListener('pointerdown', function (e) {
        var r = dial.getBoundingClientRect(), x = e.clientX - r.left - r.width / 2, y = e.clientY - r.top - r.height / 2;
        if (Math.sqrt(x * x + y * y) < r.width * 0.3) return;
        drag = true; try { dial.setPointerCapture(e.pointerId); } catch (z) { /* ignore */ }
        self._set(fromEvent(e), false);
      });
      dial.addEventListener('pointermove', function (e) { if (drag) self._set(fromEvent(e), false); });
      dial.addEventListener('pointerup', function (e) { if (!drag) return; drag = false; haptic(self); self._set(fromEvent(e), true); });
      dial.addEventListener('pointercancel', function () { drag = false; });
      this._update();
    }
    _target() { var s = st(this._hass, this._config.entity); return this._pending != null ? this._pending : s ? num(s.attributes.temperature) : null; }
    _nudge(dir) { var t = this._target(); if (t == null) t = (this._min + this._max) / 2; this._set(t + dir * this._step, true); }
    _set(v, commit) {
      var self = this;
      v = Math.round(v / this._step) * this._step; v = clamp(v, this._min, this._max); v = Math.round(v * 10) / 10;
      this._pending = v; this._draw();
      clearTimeout(this._deb);
      if (commit) this._deb = setTimeout(function () {
        self._call('climate.set_temperature', { temperature: v });
        setTimeout(function () { self._pending = null; self._draw(); }, 4000);
      }, 700);
    }
    _draw() {
      var c = this._config, h = this._hass, s = st(h, c.entity); if (!s || !this._$('svg')) return;
      var a = s.attributes, mode = s.state, acc = MODE_ACC[mode] || ACC.cyan, l = langOf(h);
      var min = this._min, max = this._max, t = this._target(), on = mode !== 'off', tv = t == null ? min : t;
      var cx = 160, cy = 160, R = 132;
      function pt(v, r) { var g = (135 + 270 * (clamp(v, min, max) - min) / (max - min)) * Math.PI / 180; return [cx + (r || R) * Math.cos(g), cy + (r || R) * Math.sin(g)]; }
      function arc(v0, v1) {
        var p0 = pt(v0), p1 = pt(v1), sw = 270 * (v1 - v0) / (max - min);
        return 'M' + p0[0].toFixed(1) + ' ' + p0[1].toFixed(1) + ' A' + R + ' ' + R + ' 0 ' + (sw > 180 ? 1 : 0) + ' 1 ' + p1[0].toFixed(1) + ' ' + p1[1].toFixed(1);
      }
      var ticks = '';
      for (var i = 0; i <= 54; i++) {
        var v = min + (max - min) * i / 54, p1 = pt(v, R - 22), p2 = pt(v, R - (i % 9 === 0 ? 32 : 27));
        ticks += '<line x1="' + p1[0].toFixed(1) + '" y1="' + p1[1].toFixed(1) + '" x2="' + p2[0].toFixed(1) + '" y2="' + p2[1].toFixed(1) +
          '" stroke="rgba(255,255,255,' + (v <= tv && on ? '.55' : '.14') + ')" stroke-width="2" stroke-linecap="round"/>';
      }
      var cur = num(a.current_temperature), k = pt(tv), cp = cur != null ? pt(cur, R) : null;
      this._$('svg').innerHTML =
        '<defs><linearGradient id="ga" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="rgba(' + acc + ',.35)"/><stop offset="1" stop-color="rgb(' + acc + ')"/></linearGradient></defs>' +
        '<path d="' + arc(min, max) + '" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="22" stroke-linecap="round"/>' +
        (on ? '<path class="arcv" d="' + arc(min, tv) + '" fill="none" stroke="url(#ga)" stroke-width="22" stroke-linecap="round" style="filter:drop-shadow(0 0 10px rgba(' + acc + ',.6))"/>' : '') +
        ticks + (cp ? '<circle cx="' + cp[0].toFixed(1) + '" cy="' + cp[1].toFixed(1) + '" r="5" fill="#fff" opacity=".85"/>' : '') +
        '<circle cx="' + k[0].toFixed(1) + '" cy="' + k[1].toFixed(1) + '" r="17" fill="' + (on ? 'rgb(' + acc + ')' : 'rgba(255,255,255,.35)') + '" stroke="#fff" stroke-width="4" style="filter:drop-shadow(0 0 10px rgba(' + acc + ',.8))"/>';
      var dw = this._$('dial').clientWidth; if (dw) this._$('tgt').style.fontSize = Math.round(dw * 0.23) + 'px';
      this._$('tgt').innerHTML = t == null ? '—' : esc(fmt(t, this._step < 1 ? 1 : 0, l)) + '<small>°</small>';
      var ts = st(h, c.temperature_entity), hs = st(h, c.humidity_entity);
      var tc = ts && num(ts.state) != null ? num(ts.state) : cur, hu = hs && num(hs.state) != null ? num(hs.state) : num(a.current_humidity);
      this._$('cur').textContent = (tc != null ? ct(h, 'now') + ' ' + fmt(tc, 1, l) + '°' : '') + (hu != null ? '  ·  ' + fmt(hu, 0, l) + '%' : '');
      var act = this._$('act'), dial = this._$('dial');
      dial.style.setProperty('--a', acc);
      act.textContent = a.hvac_action ? climateLabel(h, 'hvac_action', a.hvac_action) : on ? climateLabel(h, 'mode', mode) : ct(h, 'off');
      this._$('root').classList.toggle('off', !on);
    }
    _update() {
      var c = this._config, h = this._hass, s = st(h, c.entity), self = this; if (!s) return;
      var a = s.attributes, acc = MODE_ACC[s.state] || ACC.cyan;
      var root = this._$('root'); root.style.setProperty('--a', acc);
      this._$('nm').textContent = c.name || a.friendly_name || c.entity;
      this._$('st').textContent = stateText(h, s);
      if (!c.icon) this._$('hic').setAttribute('icon', MODE_ICON[s.state] || 'mdi:thermostat');
      Array.prototype.forEach.call(this.shadowRoot.querySelectorAll('#modes .md'), function (b) { b.classList.toggle('on', b.getAttribute('data-m') === s.state); });
      [['fan', a.fan_mode], ['presets', a.preset_mode], ['swing', a.swing_mode]].forEach(function (g) {
        Array.prototype.forEach.call(self.shadowRoot.querySelectorAll('#' + g[0] + ' .chip'), function (b) { b.classList.toggle('on', b.getAttribute('data-v') === g[1]); });
      });
      if (this._pending != null && num(a.temperature) === this._pending) this._pending = null;
      this._draw();
    }
  }

  class CasaFuturaClimateCardEditor extends CFEditor {
    _defaults() { return CLIMATE_DEF; }
    _data() { return Object.assign({}, CLIMATE_DEF, this._config); }
    _schema() {
      return [
        this._section('s_main', 'mdi:thermostat', [
          { name: 'entity', selector: { entity: { filter: { domain: 'climate' } } } },
          { type: 'grid', name: '', schema: [{ name: 'name', selector: { text: {} } }, { name: 'icon', selector: { icon: {} } }] },
          { name: 'temperature_entity', selector: { entity: { filter: { domain: 'sensor', device_class: 'temperature' } } } },
          { name: 'humidity_entity', selector: { entity: { filter: { domain: 'sensor', device_class: 'humidity' } } } }
        ], true),
        this._section('s_sections', 'mdi:view-list-outline', [
          { type: 'grid', name: '', schema: [
            { name: 'show_modes', selector: { boolean: {} } }, { name: 'show_fan', selector: { boolean: {} } },
            { name: 'show_presets', selector: { boolean: {} } }, { name: 'show_swing', selector: { boolean: {} } }
          ] }
        ]),
        this._section('s_look', 'mdi:format-paint', this._lookSchema())
      ];
    }
  }

  /* ================================================================ shared style of the light and vacuum cards */

  var PANEL_CSS = ':host{height:100%}' +
    '.pc{display:block;height:100%;padding:20px 22px 22px}' +
    '.hd{display:flex;align-items:center;gap:14px;margin-bottom:16px}' +
    '.orb{--ic:26px;width:52px;height:52px;border-radius:18px;flex:none;display:flex;align-items:center;justify-content:center;color:rgba(var(--cf-text),.7);' +
    '  background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.13);transition:all .35s}' +
    '.orb.on{color:rgb(var(--a));background:radial-gradient(circle at 50% 30%,rgba(var(--a),.42),rgba(var(--a),.1) 72%);border-color:rgba(var(--a),.55);box-shadow:0 0 30px rgba(var(--a),.35)}' +
    '.hd .tx{flex:1;min-width:0}.hd .t{font-size:20px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
    '.hd .s{font-size:14px;opacity:.6;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
    '.lbl{font-size:12px;letter-spacing:.2em;text-transform:uppercase;opacity:.5;margin:18px 2px 10px}' +
    '.row{display:flex;align-items:center;gap:14px;padding:12px 16px;border-radius:20px;background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.08);margin-bottom:8px}' +
    '.row .k{flex:1;opacity:.75;font-size:15px;display:flex;align-items:center;gap:10px;--ic:20px;min-width:0}' +
    '.row .k span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.row .v{font-size:16px;font-weight:500;text-align:right}' +
    '.pill{--a:' + ACC.cyan + ';display:flex;align-items:center;justify-content:center;gap:10px;--ic:24px;min-height:60px;padding:0 16px;border-radius:20px;font-size:16px;font-weight:500;' +
    '  background:linear-gradient(160deg,rgba(255,255,255,.12),rgba(255,255,255,.035));border:1px solid rgba(255,255,255,.14);transition:transform .12s,background .25s,box-shadow .25s}' +
    '.pill.on{background:linear-gradient(160deg,rgba(var(--a),.48),rgba(var(--a),.16));border-color:rgba(var(--a),.75);box-shadow:0 0 26px rgba(var(--a),.36)}' +
    '.pill:active{transform:scale(.95)}' +
    '.tg{--a:' + ACC.amber + ';position:relative;width:88px;height:50px;border-radius:999px;flex:none;background:rgba(255,255,255,.10);border:1px solid rgba(255,255,255,.16);' +
    '  box-shadow:inset 0 2px 8px rgba(0,0,0,.4);transition:all .3s}' +
    '.tg::after{content:"";position:absolute;top:4px;left:4px;width:40px;height:40px;border-radius:50%;background:linear-gradient(180deg,#fff,#cdd7e6);' +
    '  box-shadow:0 4px 12px rgba(0,0,0,.45);transition:transform .35s cubic-bezier(.3,1.5,.5,1)}' +
    '.tg.on{background:linear-gradient(90deg,rgba(var(--a),.85),rgba(var(--a),.5));border-color:rgba(var(--a),.85);box-shadow:0 0 24px rgba(var(--a),.45)}' +
    '.tg.on::after{transform:translateX(38px)}' +
    '.tg.sm{transform:scale(.8);margin:-6px -8px}' +
    '.body{display:flex;gap:24px;align-items:flex-start}.narrow .body{flex-direction:column;align-items:stretch}' +
    '.miss{opacity:.6}' +
    '@keyframes spin{to{transform:rotate(360deg)}}';

  function headHTML(icon) {
    return '<div class="hd"><div class="orb" id="orb"><ha-icon id="hic" icon="' + esc(icon) + '"></ha-icon></div>' +
      '<div class="tx"><div class="t" id="nm"></div><div class="s" id="st"></div></div></div>';
  }

  /* ================================================================ 5. light: brightness, white temperature, colors, group members */

  var LIGHT_DEF = Object.assign({ entity: null, name: '', icon: '', show_temperature: true, show_colors: true, show_members: true, exclude: [], min_height: 0 }, LOOK_DEF);
  var SWATCH = [[0, 90], [22, 95], [42, 90], [60, 85], [120, 70], [175, 80], [205, 85], [240, 75], [275, 70], [315, 70]];

  class CasaFuturaLightCard extends HTMLElement {
    static getConfigElement() { return document.createElement('casa-futura-light-card-editor'); }
    static getStubConfig(hass) { return { entity: Object.keys((hass && hass.states) || {}).filter(function (e) { return e.indexOf('light.') === 0; })[0] || '' }; }
    constructor() { super(); this.attachShadow({ mode: 'open' }); }
    setConfig(c) {
      if (!c || !c.entity) throw new Error('entity is required');
      this._config = Object.assign({}, LIGHT_DEF, c); this._built = false; this._key = null;
      if (this._hass) this._build();
    }
    set hass(h) {
      var old = this._hass, c = this._config; this._hass = h;
      if (!c) return;
      var s = st(h, c.entity), a = (s && s.attributes) || {};
      var key = s ? JSON.stringify([a.supported_color_modes, a.min_color_temp_kelvin, a.max_color_temp_kelvin, this._members(s)]) : '';
      if (!this._built || key !== this._key) { this._key = key; this._build(); return; }
      var ids = [c.entity].concat(this._members(s));
      for (var i = 0; i < ids.length; i++) if (!old || old.states[ids[i]] !== h.states[ids[i]]) { this._update(); return; }
    }
    connectedCallback() { if (this._built) watchWidth(this, this._$('root'), 520); }
    disconnectedCallback() { if (this._ro) { this._ro.disconnect(); this._ro = null; } }
    getCardSize() { return 7; }
    getGridOptions() { return { columns: 12, rows: 6, min_columns: 6, min_rows: 4 }; }
    _$(id) { return this.shadowRoot.getElementById(id); }
    _call(service, data, entity) { var p = service.split('.'); this._hass.callService(p[0], p[1], Object.assign({ entity_id: entity || this._config.entity }, data)); }
    // the lights of a group, without the ones listed in exclude (a list of entities, or a regular expression in YAML)
    _members(s) {
      var c = this._config, ex = c.exclude, re = null;
      if (c.show_members === false || !s || !Array.isArray(s.attributes.entity_id)) return [];
      if (typeof ex === 'string' && ex) { try { re = new RegExp(ex); } catch (e) { re = null; } }
      var list = Array.isArray(ex) ? ex : [];
      return s.attributes.entity_id.filter(function (e) { return e !== c.entity && list.indexOf(e) < 0 && !(re && re.test(e)); });
    }
    _build() {
      var c = this._config, h = this._hass, self = this, s = st(h, c.entity), a = (s && s.attributes) || {};
      var modes = a.supported_color_modes || ['onoff'];
      this._dim = modes.some(function (m) { return m !== 'onoff'; });
      this._ct = c.show_temperature !== false && modes.indexOf('color_temp') >= 0;
      this._col = c.show_colors !== false && modes.some(function (m) { return ['hs', 'rgb', 'rgbw', 'rgbww', 'xy'].indexOf(m) >= 0; });
      var minK = a.min_color_temp_kelvin || 2000, maxK = a.max_color_temp_kelvin || 6500;
      this._k = [minK, Math.max(maxK, minK + 1)];
      var ctGrad = 'linear-gradient(90deg,' + [minK, (minK + maxK) / 2, maxK].map(function (k) { return 'rgb(' + kToRgb(k).join(',') + ')'; }).join(',') + ')';
      // custom colors from YAML, otherwise two whites (when supported) and ten colors
      var sw = Array.isArray(c.colors) && c.colors.length ? c.colors.map(function (x) { return { rgb: rgb(x, null) }; }).filter(function (x) { return x.rgb; })
        : (modes.indexOf('color_temp') >= 0 ? [{ k: 2700 }, { k: 4000 }] : []).concat(SWATCH.map(function (x) { return { hs: x }; }));
      var mem = this._members(s);
      this.shadowRoot.innerHTML = '<style>' + BASE + PANEL_CSS +
        '.left{flex:none;display:flex;justify-content:center}.right{flex:1;min-width:0}' +
        '.vs{--a:' + ACC.amber + ';position:relative;width:140px;height:320px;border-radius:42px;overflow:hidden;cursor:ns-resize;' +
        '  background:rgba(0,0,0,.28);border:1px solid rgba(255,255,255,.14);box-shadow:inset 0 3px 14px rgba(0,0,0,.5),0 0 0 6px rgba(255,255,255,.03)}' +
        '.narrow .vs{width:100%;height:84px;border-radius:28px;cursor:ew-resize}' +
        '.fill{position:absolute;left:0;right:0;bottom:0;height:0;transition:height .25s ease,width .25s ease;' +
        '  background:linear-gradient(180deg,rgba(255,255,255,.85),rgba(var(--a),.95) 38%,rgba(var(--a),.75));box-shadow:0 0 40px rgba(var(--a),.6)}' +
        '.narrow .fill{top:0;right:auto;height:auto!important;background:linear-gradient(270deg,rgba(255,255,255,.85),rgba(var(--a),.95) 38%,rgba(var(--a),.75))}' +
        '.pct{position:absolute;top:20px;left:0;right:0;text-align:center;font-size:28px;font-weight:300;mix-blend-mode:difference;color:#fff;pointer-events:none}' +
        '.narrow .pct{top:50%;transform:translateY(-50%)}' +
        '.vsi{position:absolute;bottom:20px;left:50%;margin-left:-14px;--ic:28px;color:rgba(0,0,0,.55);pointer-events:none}.narrow .vsi{display:none}' +
        '.power{--a:' + ACC.amber + ';width:200px;height:200px;border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;--ic:64px;' +
        '  background:radial-gradient(circle at 50% 30%,rgba(255,255,255,.14),rgba(255,255,255,.03) 70%);border:1px solid rgba(255,255,255,.16);' +
        '  box-shadow:inset 0 1px 0 rgba(255,255,255,.3),0 20px 50px rgba(0,0,0,.45);transition:all .35s;color:rgba(var(--cf-text),.6);font-size:17px}' +
        '.power.on{color:#fff;background:radial-gradient(circle at 50% 30%,rgba(var(--a),.75),rgba(var(--a),.25) 72%);border-color:rgba(var(--a),.8);box-shadow:0 0 60px rgba(var(--a),.55)}' +
        '.power:active{transform:scale(.96)}.narrow .power{width:150px;height:150px;--ic:48px}' +
        '.top{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:14px 16px;border-radius:22px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.09)}' +
        '.top .k{font-size:12px;letter-spacing:.18em;text-transform:uppercase;opacity:.55}.top .v{font-size:20px;font-weight:500;margin-top:2px}' +
        '.trk{position:relative;height:54px;border-radius:18px;border:1px solid rgba(255,255,255,.16);box-shadow:inset 0 2px 8px rgba(0,0,0,.35);cursor:ew-resize}' +
        '.thumb{position:absolute;top:3px;width:46px;height:46px;margin-left:-23px;border-radius:15px;background:rgba(255,255,255,.9);' +
        '  box-shadow:0 4px 14px rgba(0,0,0,.45),0 0 0 3px rgba(255,255,255,.35);transition:left .2s;pointer-events:none}' +
        '.sw{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px}' +
        '.sw button{height:50px;border-radius:16px;border:2px solid rgba(255,255,255,.18);box-shadow:inset 0 1px 0 rgba(255,255,255,.4),0 8px 18px rgba(0,0,0,.3);transition:transform .1s}' +
        '.sw button:active{transform:scale(.92)}' +
        '</style><ha-card class="glass pc' + (c.glass === false ? ' plain' : '') + '" id="root"' + (num(c.min_height) ? ' style="min-height:' + num(c.min_height) + 'px"' : '') + '>' +
        headHTML(c.icon || 'mdi:lightbulb') +
        (!s ? '<div class="miss">' + esc(ptr(h, 'missing')) + ': ' + esc(c.entity) + '</div>' :
        '<div class="body"><div class="left">' +
        (this._dim ? '<div class="vs" id="vs"><div class="fill" id="fill"></div><div class="pct" id="pct"></div><ha-icon class="vsi" icon="mdi:brightness-6"></ha-icon></div>'
          : '<button class="power" id="pwr"><ha-icon icon="mdi:power"></ha-icon><span id="pwrl"></span></button>') +
        '</div><div class="right">' +
        '<div class="top"><div><div class="k">' + esc(ptr(h, 'state')) + '</div><div class="v" id="sv"></div></div><button class="tg" id="tg" aria-label="toggle"></button></div>' +
        (this._ct ? '<div class="lbl">' + esc(ptr(h, 'white')) + '</div><div class="trk" id="ct" style="background:' + ctGrad + '"><div class="thumb" id="ctth"></div></div>' : '') +
        (this._col ? '<div class="lbl">' + esc(ptr(h, 'colors')) + '</div><div class="sw" id="sw">' + sw.map(function (x, i) {
          var col = x.k ? kToRgb(x.k).join(',') : x.hs ? hsToRgb(x.hs[0], x.hs[1]).join(',') : x.rgb;
          return '<button data-i="' + i + '" style="background:rgb(' + col + ')"></button>';
        }).join('') + '</div>' : '') +
        (mem.length ? '<div class="lbl">' + esc(ptr(h, 'members')) + '</div><div id="mem">' + mem.map(function (e) {
          return '<div class="row" data-e="' + esc(e) + '"><div class="k"><ha-icon icon="mdi:lightbulb-outline"></ha-icon><span>' + esc(((st(h, e) || {}).attributes || {}).friendly_name || e) + '</span></div>' +
            '<div class="v" style="font-size:14px;opacity:.6"></div><button class="tg sm" aria-label="toggle"></button></div>';
        }).join('') + '</div>' : '') +
        '</div></div>') + '</ha-card>';
      var root = this._$('root');
      lookVars(root, c);
      this._built = true;
      if (this.isConnected) watchWidth(this, root, 520);
      if (!s) { this._$('nm').textContent = c.name || c.entity; return; }
      this._$('tg').addEventListener('click', function () { haptic(self); self._call('light.toggle', {}); });
      if (this._dim) {
        // vertical on wide cards, horizontal on narrow ones
        this._drag = slider(this, this._$('vs'), function () { return !root.classList.contains('narrow'); }, function (p) { self._fill(p); }, function (p) {
          var pc = Math.round(p * 100);
          if (pc <= 1) self._call('light.turn_off', {}); else self._call('light.turn_on', { brightness_pct: pc });
        });
      } else {
        this._$('pwr').addEventListener('click', function () { haptic(self, 'medium'); self._call('light.toggle', {}); });
      }
      if (this._ct) {
        this._ctDrag = slider(this, this._$('ct'), false, function (p) { self._$('ctth').style.left = (p * 100) + '%'; }, function (p) {
          self._call('light.turn_on', { color_temp_kelvin: Math.round(self._k[0] + p * (self._k[1] - self._k[0])) });
        });
      }
      Array.prototype.forEach.call(this.shadowRoot.querySelectorAll('#sw button'), function (b) {
        b.addEventListener('click', function () {
          var x = sw[+b.getAttribute('data-i')]; haptic(self);
          if (x.k) self._call('light.turn_on', { color_temp_kelvin: x.k });
          else if (x.hs) self._call('light.turn_on', { hs_color: x.hs });
          else self._call('light.turn_on', { rgb_color: rgbArr(x.rgb) });
        });
      });
      Array.prototype.forEach.call(this.shadowRoot.querySelectorAll('#mem .row'), function (r) {
        r.querySelector('.tg').addEventListener('click', function () { haptic(self); self._call('light.toggle', {}, r.getAttribute('data-e')); });
      });
      this._update();
    }
    _fill(p) {
      var f = this._$('fill'), pc = this._$('pct'), narrow = this._$('root').classList.contains('narrow');
      if (f) { f.style.height = narrow ? '' : (p * 100) + '%'; f.style.width = narrow ? (p * 100) + '%' : ''; }
      if (pc) pc.textContent = Math.round(p * 100) + '%';
    }
    _update() {
      var c = this._config, h = this._hass, s = st(h, c.entity), self = this; if (!s) return;
      var on = s.state === 'on', a = s.attributes;
      var acc = on && a.rgb_color && a.color_mode !== 'color_temp' ? rgb(a.rgb_color, ACC.amber) : ACC.amber;
      var root = this._$('root'); root.style.setProperty('--a', acc);
      this._$('nm').textContent = c.name || a.friendly_name || c.entity;
      this._$('st').textContent = stateText(h, s) + (on && a.brightness ? ' · ' + Math.round(a.brightness / 2.55) + '%' : '');
      this._$('sv').textContent = stateText(h, s);
      this._$('orb').classList.toggle('on', on);
      this._$('hic').setAttribute('icon', c.icon || a.icon || (on ? 'mdi:lightbulb-on' : 'mdi:lightbulb-outline'));
      this._$('tg').classList.toggle('on', on);
      if (this._dim) { if (!this._drag.busy()) this._fill(on ? (a.brightness || 255) / 255 : 0); }
      else { this._$('pwr').classList.toggle('on', on); this._$('pwrl').textContent = stateText(h, s); }
      if (this._ct && !this._ctDrag.busy()) {
        var k = a.color_temp_kelvin || (this._k[0] + this._k[1]) / 2;
        this._$('ctth').style.left = clamp((k - this._k[0]) / (this._k[1] - this._k[0]) * 100, 0, 100) + '%';
      }
      Array.prototype.forEach.call(this.shadowRoot.querySelectorAll('#mem .row'), function (r) {
        var m = st(h, r.getAttribute('data-e'));
        r.querySelector('.tg').classList.toggle('on', !!m && m.state === 'on');
        r.querySelector('.v').textContent = m ? stateText(h, m) : '—';
      });
    }
  }

  class CasaFuturaLightCardEditor extends CFEditor {
    _defaults() { return LIGHT_DEF; }
    _data() { var d = Object.assign({}, LIGHT_DEF, this._config); if (!Array.isArray(d.exclude)) d.exclude = []; return d; }
    _schema() {
      var c = this._config;
      var sec = [{ type: 'grid', name: '', schema: [
        { name: 'show_temperature', selector: { boolean: {} } }, { name: 'show_colors', selector: { boolean: {} } }, { name: 'show_members', selector: { boolean: {} } }
      ] }];
      if (c.show_members !== false && typeof c.exclude !== 'string') sec.push({ name: 'exclude', selector: { entity: { multiple: true, filter: { domain: 'light' } } } });
      return [
        this._section('s_main', 'mdi:lightbulb', [
          { name: 'entity', selector: { entity: { filter: { domain: 'light' } } } },
          { type: 'grid', name: '', schema: [{ name: 'name', selector: { text: {} } }, { name: 'icon', selector: { icon: {} } }] }
        ], true),
        this._section('s_sections', 'mdi:view-list-outline', sec),
        this._section('s_look', 'mdi:format-paint', this._lookSchema().concat([
          { name: 'min_height', selector: { number: { min: 0, max: 900, step: 10, mode: 'slider', unit_of_measurement: 'px' } } }
        ]))
      ];
    }
  }

  /* ================================================================ 6. vacuum: map, battery, controls, quick cleanings, station */

  var VACUUM_DEF = Object.assign({ entity: null, name: '', icon: '', map: null, battery: null, status: null, room: null, area: null, time: null, error: null,
    show_controls: true, quick: [], station: [], min_height: 0 }, LOOK_DEF);
  // VacuumEntityFeature bits
  var VF = { pause: 4, stop: 8, dock: 16, locate: 512, start: 8192 };

  class CasaFuturaVacuumCard extends HTMLElement {
    static getConfigElement() { return document.createElement('casa-futura-vacuum-card-editor'); }
    static getStubConfig(hass) {
      var ids = Object.keys((hass && hass.states) || {}), v = ids.filter(function (e) { return e.indexOf('vacuum.') === 0; })[0] || '';
      var base = v.split('.')[1] || '#';
      var map = ids.filter(function (e) { return /^(camera|image)\./.test(e) && e.indexOf(base) > 0; })[0];
      return map ? { entity: v, map: map } : { entity: v };
    }
    constructor() { super(); this.attachShadow({ mode: 'open' }); }
    setConfig(c) {
      if (!c || !c.entity) throw new Error('entity is required');
      this._config = Object.assign({}, VACUUM_DEF, c);
      if (!c.station && Array.isArray(c.tanks)) this._config.station = c.tanks;
      this._built = false; this._lastMap = 0;
      if (this._hass) this._build();
    }
    set hass(h) {
      var old = this._hass, c = this._config; this._hass = h;
      if (!c) return;
      var s = st(h, c.entity), key = s ? String(s.attributes.supported_features) : '';
      if (!this._built || key !== this._key) { this._key = key; this._build(); return; }
      var ids = this._watch();
      for (var i = 0; i < ids.length; i++) if (!old || old.states[ids[i]] !== h.states[ids[i]]) { this._update(); return; }
    }
    connectedCallback() {
      var self = this;
      if (this._built) watchWidth(this, this._$('root'), 620);
      if (!this._iv) this._iv = setInterval(function () { self._map(); }, 5000);
      this._map(true);
    }
    disconnectedCallback() { clearInterval(this._iv); this._iv = null; if (this._ro) { this._ro.disconnect(); this._ro = null; } }
    getCardSize() { return 8; }
    getGridOptions() { return { columns: 12, rows: 7, min_columns: 6, min_rows: 5 }; }
    _$(id) { return this.shadowRoot.getElementById(id); }
    _watch() {
      var c = this._config;
      return [c.entity, c.map, c.battery, c.status, c.room, c.area, c.time, c.error].concat((c.station || []).map(function (t) { return t && t.entity; })).filter(Boolean);
    }
    _can(f) { var s = st(this._hass, this._config.entity), sf = s && s.attributes.supported_features; return sf == null || !!(sf & f); }
    _call(service) { var p = service.split('.'); this._hass.callService(p[0], p[1], { entity_id: this._config.entity }); }
    _build() {
      var c = this._config, h = this._hass, self = this, s = st(h, c.entity);
      var quick = (c.quick || []).filter(function (q) { return q && (q.label || q.icon); }), station = (c.station || []).filter(function (t) { return t && t.entity; });
      var btn = function (id, icon, label, a, f) { return self._can(f) ? '<button class="pill" id="' + id + '" style="--a:' + a + '"><ha-icon id="' + id + 'ic" icon="' + icon + '"></ha-icon><span id="' + id + 'l">' + esc(label) + '</span></button>' : ''; };
      this.shadowRoot.innerHTML = '<style>' + BASE + PANEL_CSS +
        '.map{flex:1 1 0;min-width:0;position:relative;border-radius:24px;overflow:hidden;min-height:300px;display:flex;align-items:center;justify-content:center;' +
        '  background:rgba(0,0,0,.25);border:1px solid rgba(255,255,255,.08);box-shadow:inset 0 2px 10px rgba(0,0,0,.35)}' +
        '.map img{width:100%;height:100%;object-fit:contain;max-height:440px}.map .none{opacity:.4;padding:20px;text-align:center}' +
        '.narrow .map{min-height:200px;flex:none}' +
        '.right{flex:1 1 0;min-width:0}.narrow .right{flex:none}' +
        '.stat{display:flex;align-items:center;gap:18px}' +
        '.ring{position:relative;width:104px;height:104px;flex:none}.ring>svg{width:100%;height:100%;transform:rotate(-90deg)}' +
        '.ring b{position:absolute;top:0;left:0;right:0;bottom:0;display:flex;align-items:center;justify-content:center;font-size:26px;font-weight:400}' +
        '.ring b small{font-size:.5em;opacity:.6}' +
        '.big{font-size:28px;font-weight:400;line-height:1.15}.det{opacity:.6;font-size:14px;margin-top:6px;line-height:1.4}' +
        '.err{color:rgb(' + ACC.red + ');font-size:15px;margin-top:6px}' +
        '.ctrl{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(0,1fr);gap:10px;margin-top:16px}' +
        '.ctrl .pill{flex-direction:column;min-height:74px;font-size:13px;gap:4px;padding:0 4px}.narrow .ctrl{gap:8px}' +
        '.quick{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:10px}' +
        '.quick .pill{min-height:60px;justify-content:flex-start;padding:0 16px;text-align:left}' +
        '.spin{animation:spin 3s linear infinite}' +
        '</style><ha-card class="glass pc' + (c.glass === false ? ' plain' : '') + '" id="root"' + (num(c.min_height) ? ' style="min-height:' + num(c.min_height) + 'px"' : '') + '>' +
        headHTML(c.icon || 'mdi:robot-vacuum') +
        (!s ? '<div class="miss">' + esc(ptr(h, 'missing')) + ': ' + esc(c.entity) + '</div>' :
        '<div class="body">' + (c.map ? '<div class="map" id="mapbox"><img id="map" alt=""><div class="none" id="nomap" style="display:none">' + esc(ptr(h, 'no_map')) + '</div></div>' : '') +
        '<div class="right"><div class="stat"><div class="ring" id="ring"><svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="50" fill="none" stroke="rgba(255,255,255,.1)" stroke-width="10"/>' +
        '<circle id="bat" cx="60" cy="60" r="50" fill="none" stroke="rgb(' + ACC.green + ')" stroke-width="10" stroke-linecap="round" stroke-dasharray="314" stroke-dashoffset="314" style="transition:stroke-dashoffset .6s"/></svg>' +
        '<b id="batt">—</b></div><div style="min-width:0"><div class="big" id="big"></div><div class="det" id="det"></div><div class="err" id="err"></div></div></div>' +
        (c.show_controls !== false ? '<div class="ctrl">' +
          btn('go', 'mdi:play', ptr(h, 'start'), ACC.green, VF.start) + btn('stop', 'mdi:stop', ptr(h, 'stop'), ACC.red, VF.stop) +
          btn('home', 'mdi:home-import-outline', ptr(h, 'dock'), ACC.cyan, VF.dock) + btn('find', 'mdi:map-marker-radius', ptr(h, 'locate'), ACC.amber, VF.locate) + '</div>' : '') +
        (quick.length ? '<div class="lbl">' + esc(ptr(h, 'quick')) + '</div><div class="quick" id="quick">' + quick.map(function (q, i) {
          return '<button class="pill" data-i="' + i + '" style="--a:' + rgb(q.color, ACC.violet) + '"><ha-icon icon="' + esc(q.icon || 'mdi:broom') + '"></ha-icon><span>' + esc(q.label || '') + '</span></button>';
        }).join('') + '</div>' : '') +
        (station.length ? '<div class="lbl">' + esc(ptr(h, 'station')) + '</div><div id="station"></div>' : '') +
        '</div></div>') + '</ha-card>';
      var root = this._$('root');
      lookVars(root, c);
      this._built = true;
      if (this.isConnected) watchWidth(this, root, 620);
      if (!s) { this._$('nm').textContent = c.name || c.entity; return; }
      var on = function (id, fn) { var el = self._$(id); if (el) el.addEventListener('click', function () { haptic(self, 'medium'); fn(); }); };
      on('go', function () {
        var v = st(self._hass, c.entity);
        self._call(v && v.state === 'cleaning' && self._can(VF.pause) ? 'vacuum.pause' : 'vacuum.start');
      });
      on('stop', function () { self._call('vacuum.stop'); });
      on('home', function () { self._call('vacuum.return_to_base'); });
      on('find', function () { self._call('vacuum.locate'); });
      Array.prototype.forEach.call(this.shadowRoot.querySelectorAll('#quick .pill'), function (b) {
        b.addEventListener('click', function () {
          var q = quick[+b.getAttribute('data-i')]; haptic(self, 'medium');
          b.classList.add('on'); setTimeout(function () { b.classList.remove('on'); }, 1500);
          runAction(self, q.action || q.tap_action, c.entity);
        });
      });
      var img = this._$('map');
      if (img) {
        img.addEventListener('error', function () { img.style.display = 'none'; self._$('nomap').style.display = ''; });
        img.addEventListener('load', function () { img.style.display = ''; self._$('nomap').style.display = 'none'; });
      }
      this._lastMap = 0;
      this._update();
    }
    // the map refreshes every 5 seconds while cleaning, every minute otherwise
    _map(force) {
      var c = this._config, img = this._$('map'); if (!img || !c.map || !this._hass) return;
      var s = st(this._hass, c.entity), m = st(this._hass, c.map);
      if (!m || !m.attributes.entity_picture) { img.style.display = 'none'; this._$('nomap').style.display = ''; return; }
      var busy = s && (s.state === 'cleaning' || s.state === 'returning'), now = Date.now();
      if (!force && !busy && this._lastMap && now - this._lastMap < 60000) return;
      this._lastMap = now;
      var url = m.attributes.entity_picture;
      img.src = /^(data|blob):/.test(url) ? url : url + (url.indexOf('?') >= 0 ? '&' : '?') + 't=' + now;
    }
    _update() {
      var c = this._config, h = this._hass, s = st(h, c.entity); if (!s) return;
      var a = s.attributes, cleaning = s.state === 'cleaning', err = s.state === 'error';
      var root = this._$('root'); root.style.setProperty('--a', err ? ACC.red : ACC.cyan);
      this._$('nm').textContent = c.name || a.friendly_name || c.entity;
      var stt = st(h, c.status);
      this._$('st').textContent = stateText(h, stt && stt.state !== 'unknown' && stt.state !== 'unavailable' ? stt : s);
      this._$('orb').classList.toggle('on', cleaning || s.state === 'returning' || err);
      this._$('hic').classList.toggle('spin', cleaning);
      this._$('big').textContent = stateText(h, s);
      var bs = st(h, c.battery), b = bs ? num(bs.state) : num(a.battery_level);
      this._$('ring').style.display = b == null ? 'none' : '';
      if (b != null) {
        this._$('batt').innerHTML = Math.round(b) + '<small>%</small>';
        var circ = this._$('bat'); circ.setAttribute('stroke-dashoffset', String(314 - 314 * clamp(b, 0, 100) / 100));
        circ.setAttribute('stroke', 'rgb(' + (b < 20 ? ACC.red : b < 50 ? ACC.amber : ACC.green) + ')');
      }
      var val = function (id) { var x = st(h, id); return x && x.state !== 'unknown' && x.state !== 'unavailable' ? stateText(h, x) : null; };
      this._$('det').textContent = [['room', c.room], ['area', c.area], ['time', c.time]].filter(function (d) { return d[1] && val(d[1]); })
        .map(function (d) { return ptr(h, d[0]) + ': ' + val(d[1]); }).join('  ·  ');
      var es = st(h, c.error);
      this._$('err').textContent = es && !/^(no_error|none|ok|unknown|unavailable|0|off|false)$/i.test(es.state) ? '⚠ ' + stateText(h, es) : '';
      if (this._$('go')) {
        var pause = cleaning && this._can(VF.pause);
        this._$('gol').textContent = ptr(h, pause ? 'pause' : 'start');
        this._$('goic').setAttribute('icon', pause ? 'mdi:pause' : 'mdi:play');
        this._$('go').classList.toggle('on', cleaning);
      }
      if (this._$('home')) this._$('home').classList.toggle('on', s.state === 'returning' || s.state === 'docked');
      var sta = this._$('station');
      if (sta) sta.innerHTML = (c.station || []).filter(function (t) { return t && t.entity; }).map(function (t) {
        var x = st(h, t.entity);
        return '<div class="row"><div class="k"><ha-icon icon="' + esc(t.icon || (x && x.attributes.icon) || 'mdi:water') + '"></ha-icon><span>' +
          esc(t.label || (x && x.attributes.friendly_name) || t.entity) + '</span></div><div class="v">' + esc(x ? stateText(h, x) : '—') + '</div></div>';
      }).join('');
      if (!this._lastMap) this._map(true);
    }
  }

  class CasaFuturaVacuumCardEditor extends CFEditor {
    _defaults() { return VACUUM_DEF; }
    _data() { return Object.assign({}, VACUUM_DEF, this._config); }
    _fromForm(v) {
      var out = this._clean(v, this._defaults());
      ['quick', 'station'].forEach(function (k) { if (v[k] && v[k].length) out[k] = v[k]; });
      return out;
    }
    _schema() {
      var sensor = function (name) { return { name: name, selector: { entity: { filter: { domain: ['sensor', 'binary_sensor', 'select', 'input_select'] } } } }; };
      return [
        this._section('s_main', 'mdi:robot-vacuum', [
          { name: 'entity', selector: { entity: { filter: { domain: 'vacuum' } } } },
          { type: 'grid', name: '', schema: [{ name: 'name', selector: { text: {} } }, { name: 'icon', selector: { icon: {} } }] },
          { name: 'map', selector: { entity: { filter: { domain: ['camera', 'image'] } } } },
          { name: 'show_controls', selector: { boolean: {} } }
        ], true),
        this._section('s_sensors', 'mdi:list-status', [
          { name: 'battery', selector: { entity: { filter: { domain: 'sensor', device_class: 'battery' } } } },
          sensor('status'), sensor('room'), sensor('area'), sensor('time'), sensor('error')
        ]),
        this._section('s_look', 'mdi:format-paint', this._lookSchema().concat([
          { name: 'min_height', selector: { number: { min: 0, max: 900, step: 10, mode: 'slider', unit_of_measurement: 'px' } } }
        ]))
      ];
    }
    _lists() {
      return [
        { key: 'quick', title: 's_quick', help: 'quick_h', add: 'add_quick', labels: { label: 'q_label' },
          newItem: function () { return { label: '', icon: 'mdi:broom', action: { action: 'perform-action' } }; },
          schema: function () {
            return [
              { type: 'grid', name: '', schema: [{ name: 'label', selector: { text: {} } }, { name: 'icon', selector: { icon: {} } }, { name: 'color', selector: { color_rgb: {} } }] },
              { name: 'action', selector: { ui_action: {} } }
            ];
          },
          data: function (it) { return Object.assign({}, it, { color: rgbArr(rgb(it.color, ACC.violet)) }); } },
        { key: 'station', title: 's_station', help: 'station_h', add: 'add_station', labels: { label: 'st_label' }, expanded: false,
          newItem: function () { return { entity: '', label: '', icon: 'mdi:water' }; },
          schema: function () {
            return [
              { name: 'entity', selector: { entity: {} } },
              { type: 'grid', name: '', schema: [{ name: 'label', selector: { text: {} } }, { name: 'icon', selector: { icon: {} } }] }
            ];
          },
          data: function (it) { return Object.assign({}, it); } }
      ];
    }
  }

  /* ================================================================ 7. camera: snapshots in a strip or a grid, live video on tap */

  var CAMERA_DEF = Object.assign({ title: '', show_title: true, cameras: [], layout: 'strip', columns: 3, tile_width: 240,
    refresh: 10, snapshot_width: 640, show_names: true }, LOOK_DEF);

  // the camera proxy resizes on request: smaller pictures load fast on old tablets
  function snapURL(s, w) {
    var u = s && s.attributes.entity_picture;
    if (!u) return null;
    return u + (u.indexOf('?') >= 0 ? '&' : '?') + 'width=' + w + '&height=' + Math.round(w * 9 / 16) + '&t=' + Date.now();
  }

  // a badge sensor counts when it is on, or above zero (e.g. the number of people seen)
  function badgeOn(o) { return !!o && (isActive(o) || (num(o.state) || 0) > 0); }

  class CasaFuturaCameraCard extends HTMLElement {
    static getConfigElement() { return document.createElement('casa-futura-camera-card-editor'); }
    static getStubConfig(hass) {
      var cams = Object.keys((hass && hass.states) || {}).filter(function (e) { return e.indexOf('camera.') === 0; }).slice(0, 3);
      return { cameras: cams.map(function (e) { return { entity: e }; }) };
    }
    constructor() { super(); this.attachShadow({ mode: 'open' }); }
    setConfig(c) {
      if (!c || !Array.isArray(c.cameras) || !c.cameras.length) throw new Error('cameras is required: a list of camera entities');
      var cams = c.cameras.map(function (x) { return typeof x === 'string' ? { entity: x } : x; }).filter(function (x) { return x && x.entity; });
      this._config = Object.assign({}, CAMERA_DEF, c, { cameras: cams });
      this._built = false;
      if (this._hass) this._build();
    }
    set hass(h) {
      var old = this._hass, c = this._config; this._hass = h;
      if (this._live) this._live.hass = h;
      if (!c) return;
      if (!this._built) { this._build(); return; }
      var ids = this._watch();
      for (var i = 0; i < ids.length; i++) if (!old || old.states[ids[i]] !== h.states[ids[i]]) { this._update(); return; }
    }
    connectedCallback() {
      var self = this, c = this._config;
      if (!c) return;
      clearInterval(this._iv);
      this._iv = setInterval(function () { self._snap(); }, clamp(num(c.refresh) || 10, 2, 600) * 1000);
      this._observe();
      this._snap();
    }
    disconnectedCallback() {
      clearInterval(this._iv); this._iv = null;
      if (this._io) { this._io.disconnect(); this._io = null; }
    }
    getCardSize() { var c = this._config || CAMERA_DEF; return c.layout === 'grid' ? 2 + 2 * Math.ceil(c.cameras.length / (num(c.columns) || 3)) : 4; }
    getGridOptions() { return { columns: 12, min_columns: 4 }; }
    _$(id) { return this.shadowRoot.getElementById(id); }
    _watch() {
      return this._config.cameras.reduce(function (a, x) { a.push(x.entity); if (x.occupancy) a.push(x.occupancy); return a; }, []);
    }
    // refresh only while the card is on screen
    _observe() {
      var self = this, root = this._$('root');
      if (this._io) this._io.disconnect();
      if (!root || !window.IntersectionObserver) { this._visible = true; return; }
      this._io = new IntersectionObserver(function (en) {
        var v = en[0].isIntersecting;
        if (v && !self._visible) { self._visible = true; self._snap(); } else self._visible = v;
      });
      this._io.observe(root);
    }
    _build() {
      var c = this._config, h = this._hass, self = this, grid = c.layout === 'grid';
      var cols = clamp(Math.round(num(c.columns) || 3), 1, 6), tw = clamp(Math.round(num(c.tile_width) || 240), 120, 800);
      this.shadowRoot.innerHTML = '<style>' + BASE +
        '.cc{display:block;padding:16px 0 14px}' +
        '.tt{font-size:13px;letter-spacing:.2em;text-transform:uppercase;opacity:.6;margin:0 18px 12px}' +
        '.wrap{display:flex;gap:10px;overflow-x:auto;overflow-y:hidden;padding:0 14px 4px;scrollbar-width:none;-webkit-overflow-scrolling:touch;' +
        '  overscroll-behavior-x:contain;scroll-snap-type:x mandatory;scroll-padding:0 14px}' +
        '.wrap::-webkit-scrollbar{display:none}' +
        '.wrap.grid{display:grid;grid-template-columns:repeat(' + cols + ',minmax(0,1fr));gap:12px;overflow:visible;padding:0 14px 4px}' +
        '.cm{position:relative;flex:none;width:' + tw + 'px;border-radius:20px;overflow:hidden;background:#000;scroll-snap-align:start;cursor:pointer;' +
        '  border:1px solid rgba(255,255,255,.12);box-shadow:0 10px 24px rgba(0,0,0,.35);transition:transform .12s;-webkit-tap-highlight-color:transparent}' +
        '.grid .cm{width:auto;border-radius:22px}' +
        '.cm.pressed{transform:scale(.96)}' +
        // 16:9 box that also works on browsers without aspect-ratio
        '.ar{position:relative;padding-top:56.25%}' +
        '.ar img{position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;display:block;pointer-events:none}' +
        '.nm{position:absolute;left:12px;right:12px;bottom:9px;font-size:15px;font-weight:600;text-shadow:0 1px 6px rgba(0,0,0,.85);' +
        '  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;pointer-events:none}' +
        '.grid .nm{font-size:17px;left:14px;bottom:11px}' +
        '.bd{position:absolute;top:9px;left:9px;display:none;align-items:center;gap:5px;--ic:15px;min-height:28px;padding:0 10px;border-radius:999px;' +
        '  font-size:12px;font-weight:600;color:#fff;background:rgba(' + ACC.amber + ',.85);box-shadow:0 0 18px rgba(' + ACC.amber + ',.6)}' +
        '.bd.on{display:inline-flex}' +
        '.off{position:absolute;top:0;left:0;right:0;bottom:0;display:none;align-items:center;justify-content:center;gap:8px;--ic:22px;' +
        '  font-size:14px;opacity:.7;background:rgba(10,14,24,.85)}' +
        '.off.on{display:flex}' +
        '</style><ha-card class="glass cc' + (c.glass === false ? ' plain' : '') + '" id="root">' +
        (c.show_title !== false && c.title ? '<div class="tt">' + esc(c.title) + '</div>' : '') +
        '<div class="wrap' + (grid ? ' grid' : '') + '" id="wrap">' + c.cameras.map(function (x, i) {
          return '<div class="cm" data-i="' + i + '" role="button" tabindex="0"><div class="ar"><img alt=""></div>' +
            (c.show_names !== false ? '<div class="nm"></div>' : '') +
            '<div class="bd"><ha-icon icon="mdi:account"></ha-icon><span></span></div>' +
            '<div class="off"><ha-icon icon="mdi:cctv-off"></ha-icon><span>' + esc(camt(h, 'offline')) + '</span></div></div>';
        }).join('') + '</div></ha-card>';
      lookVars(this._$('root'), c);
      this._built = true;
      var wrap = this._$('wrap');
      // no picture swaps while scrolling: they make the strip stutter on slow tablets
      wrap.addEventListener('scroll', function () { self._scrolled = Date.now(); }, { passive: true });
      if (!grid) this._mouseDrag(wrap);
      Array.prototype.forEach.call(wrap.querySelectorAll('.cm'), function (el) {
        var i = +el.getAttribute('data-i');
        el.addEventListener('pointerdown', function () { el.classList.add('pressed'); });
        ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (t) { el.addEventListener(t, function () { el.classList.remove('pressed'); }); });
        el.addEventListener('click', function () { if (!self._dragged) self._tap(i); });
        el.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); self._tap(i); } });
      });
      if (this.isConnected) this._observe();
      this._update();
      this._snap(true);
    }
    // with a mouse the strip scrolls by dragging; fingers use the native scroll
    _mouseDrag(wrap) {
      var self = this, down = null;
      wrap.addEventListener('pointerdown', function (e) {
        if (e.pointerType !== 'mouse' || e.button) return;
        down = { x: e.clientX, left: wrap.scrollLeft }; self._dragged = false;
      });
      wrap.addEventListener('pointermove', function (e) {
        if (!down) return;
        var dx = e.clientX - down.x;
        if (Math.abs(dx) > 5) { self._dragged = true; wrap.style.scrollSnapType = 'none'; }
        if (self._dragged) wrap.scrollLeft = down.left - dx;
      });
      var up = function () { if (!down) return; down = null; wrap.style.scrollSnapType = ''; setTimeout(function () { self._dragged = false; }, 0); };
      wrap.addEventListener('pointerup', up); wrap.addEventListener('pointerleave', up);
    }
    _tap(i) {
      var x = this._config.cameras[i]; haptic(this);
      var a = x.tap_action;
      if (a && a.action && a.action !== 'none') { runAction(this, a, x.entity); return; }
      if (a && a.action === 'none') return;
      this._openLive(i);
    }
    _snap(force) {
      var c = this._config, h = this._hass, self = this;
      if (!c || !h || !this._built) return;
      if (!force && (document.hidden || this._visible === false || Date.now() - (this._scrolled || 0) < 1500)) return;
      var w = clamp(Math.round(num(c.snapshot_width) || 640), 160, 1920);
      Array.prototype.forEach.call(this.shadowRoot.querySelectorAll('.cm'), function (el) {
        var s = st(h, c.cameras[+el.getAttribute('data-i')].entity), src = snapURL(s, w);
        if (!src || s.state === 'unavailable') return;
        // loaded aside, then swapped in: no flashes of black
        var img = new Image();
        img.alt = ''; img.decoding = 'async';
        img.onload = function () { var o = el.querySelector('img'); if (o && o.parentNode) o.parentNode.replaceChild(img, o); };
        img.src = src;
      });
      if (this._liveImg) this._liveImg();
    }
    _update() {
      var c = this._config, h = this._hass;
      Array.prototype.forEach.call(this.shadowRoot.querySelectorAll('.cm'), function (el) {
        var x = c.cameras[+el.getAttribute('data-i')], s = st(h, x.entity), o = x.occupancy ? st(h, x.occupancy) : null;
        var nm = el.querySelector('.nm');
        if (nm) nm.textContent = x.name || (s && s.attributes.friendly_name) || x.entity;
        el.setAttribute('aria-label', x.name || (s && s.attributes.friendly_name) || x.entity);
        var bd = el.querySelector('.bd'), on = badgeOn(o);
        bd.classList.toggle('on', on);
        bd.querySelector('span').textContent = x.badge || camt(h, 'person');
        el.querySelector('.off').classList.toggle('on', !s || s.state === 'unavailable');
      });
    }
    // live video in a dialog drawn by the card, with arrows to move between cameras
    _openLive(i) {
      var self = this, c = this._config, cams = c.cameras;
      openDialog(this, c, function (api) {
        api.el.classList.add('wide');
        var st2 = document.createElement('style');
        st2.textContent = '.lh{display:flex;align-items:center;gap:12px;margin:0 2px 12px}.lh .t{flex:1;min-width:0;font-size:20px;font-weight:600;' +
          '  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
          '.ib{--ic:24px;width:48px;height:48px;border-radius:16px;display:flex;align-items:center;justify-content:center;flex:none;' +
          '  background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.14);transition:transform .1s}.ib:active{transform:scale(.9)}' +
          '.lv{position:relative;border-radius:20px;overflow:hidden;background:#000;--ha-card-border-radius:0;--ha-card-border-width:0;--ha-card-background:#000}' +
          '.lv .ar{position:relative;padding-top:56.25%}.lv .ar>*{position:absolute;top:0;left:0;width:100%;height:100%}' +
          '.lv img{object-fit:contain;display:block}' +
          '.bd{position:absolute;top:12px;left:12px;z-index:2;display:none;align-items:center;gap:6px;--ic:16px;min-height:30px;padding:0 12px;border-radius:999px;' +
          '  font-size:13px;font-weight:600;color:#fff;background:rgba(' + ACC.amber + ',.85);box-shadow:0 0 18px rgba(' + ACC.amber + ',.6)}.bd.on{display:inline-flex}';
        api.root.appendChild(st2);
        var many = cams.length > 1;
        api.el.innerHTML = '<div class="lh">' + (many ? '<button class="ib" id="pv" aria-label="' + esc(camt(self._hass, 'prev')) + '"><ha-icon icon="mdi:chevron-left"></ha-icon></button>' : '') +
          '<div class="t" id="lt"></div>' + (many ? '<button class="ib" id="nx" aria-label="' + esc(camt(self._hass, 'next')) + '"><ha-icon icon="mdi:chevron-right"></ha-icon></button>' : '') +
          '<button class="ib" id="cl" aria-label="' + esc(tr(self._hass, 'close')) + '"><ha-icon icon="mdi:close"></ha-icon></button></div>' +
          '<div class="lv"><div class="bd" id="lb"><ha-icon icon="mdi:account"></ha-icon><span></span></div><div class="ar" id="la"></div></div>';
        var la = api.root.getElementById('la'), cur = i, token = 0;
        function show(n) {
          cur = (n + cams.length) % cams.length;
          var x = cams[cur], s = st(self._hass, x.entity), my = ++token;
          api.root.getElementById('lt').textContent = x.name || (s && s.attributes.friendly_name) || x.entity;
          var o = x.occupancy ? st(self._hass, x.occupancy) : null, lb = api.root.getElementById('lb');
          lb.classList.toggle('on', badgeOn(o)); lb.querySelector('span').textContent = x.badge || camt(self._hass, 'person');
          la.innerHTML = ''; self._live = null; self._liveImg = null;
          // a snapshot first, replaced by Home Assistant's own live player as soon as it is ready
          var img = document.createElement('img'); img.alt = ''; la.appendChild(img);
          var w = clamp(Math.round(num(c.snapshot_width) || 640), 160, 1920) * 2;
          self._liveImg = function () { var u = snapURL(st(self._hass, x.entity), w); if (u && img.isConnected) img.src = u; };
          self._liveImg();
          if (!window.loadCardHelpers) return;
          window.loadCardHelpers().then(function (hp) {
            return hp.createCardElement({ type: 'picture-entity', entity: x.entity, camera_view: 'live', show_name: false, show_state: false,
              tap_action: { action: 'none' }, hold_action: { action: 'none' } });
          }).then(function (card) {
            if (my !== token || !la.isConnected) return;
            card.hass = self._hass; la.appendChild(card); self._live = card;
            setTimeout(function () { if (my === token && img.parentNode) { img.parentNode.removeChild(img); self._liveImg = null; } }, 1500);
          }).catch(function () { /* the snapshot stays */ });
        }
        var close = api.close;
        api.close = function () { token++; self._live = null; self._liveImg = null; document.removeEventListener('keydown', keys); close(); };
        // Escape and a tap outside already close the dialog
        function keys(e) { if (!many) return; if (e.key === 'ArrowLeft') show(cur - 1); if (e.key === 'ArrowRight') show(cur + 1); }
        document.addEventListener('keydown', keys);
        api.root.getElementById('cl').addEventListener('click', function () { api.close(); });
        if (many) {
          api.root.getElementById('pv').addEventListener('click', function () { haptic(self); show(cur - 1); });
          api.root.getElementById('nx').addEventListener('click', function () { haptic(self); show(cur + 1); });
        }
        show(i);
      });
    }
  }

  class CasaFuturaCameraCardEditor extends CFEditor {
    _defaults() { return CAMERA_DEF; }
    _data() { return Object.assign({}, CAMERA_DEF, this._config); }
    _fromForm(v) {
      var out = this._clean(v, this._defaults());
      if (v.cameras && v.cameras.length) out.cameras = v.cameras;
      return out;
    }
    _schema() {
      var L = this._L.bind(this), c = this._config, grid = c.layout === 'grid';
      return [
        this._section('s_main', 'mdi:cctv', [
          { type: 'grid', name: '', schema: [{ name: 'title', title: L('card_title'), selector: { text: {} } }, { name: 'show_title', selector: { boolean: {} } }] },
          { name: 'layout', selector: { select: { mode: 'box', options: [{ value: 'strip', label: L('l_strip') }, { value: 'grid', label: L('l_grid') }] } } },
          grid ? { name: 'columns', selector: { number: { min: 1, max: 6, step: 1, mode: 'slider' } } }
            : { name: 'tile_width', selector: { number: { min: 120, max: 800, step: 10, mode: 'slider', unit_of_measurement: 'px' } } },
          { name: 'show_names', selector: { boolean: {} } },
          { type: 'grid', name: '', schema: [
            { name: 'refresh', selector: { number: { min: 2, max: 600, step: 1, mode: 'box', unit_of_measurement: 's' } } },
            { name: 'snapshot_width', selector: { number: { min: 160, max: 1920, step: 10, mode: 'box', unit_of_measurement: 'px' } } }
          ] }
        ], true),
        this._section('s_look', 'mdi:format-paint', this._lookSchema())
      ];
    }
    _lists() {
      return [{ key: 'cameras', title: 's_cameras', help: 'cameras_h', add: 'add_camera', labels: { tap_action: 'cam_action' },
        newItem: function () { return { entity: '' }; },
        schema: function () {
          return [
            { name: 'entity', selector: { entity: { filter: { domain: 'camera' } } } },
            { type: 'grid', name: '', schema: [{ name: 'name', selector: { text: {} } }, { name: 'badge', selector: { text: {} } }] },
            { name: 'occupancy', selector: { entity: { filter: { domain: ['binary_sensor', 'input_boolean', 'sensor'] } } } },
            { name: 'tap_action', selector: { ui_action: {} } }
          ];
        },
        data: function (it) { return Object.assign({}, it); } }];
    }
  }

  /* ================================================================ registration */

  [
    ['casa-futura-gauge-card', CasaFuturaGaugeCard, 'Casa Futura · Gauge', 'A big needle gauge for any sensor, with colored zones.'],
    ['casa-futura-alerts-card', CasaFuturaAlertsCard, 'Casa Futura · Alerts bell', 'A floating bell that appears when something needs attention, with a side panel listing the alerts.'],
    ['casa-futura-action-card', CasaFuturaActionCard, 'Casa Futura · Action button', 'A button with optional confirmation, PIN and several choices (e.g. unlock, open, lock).'],
    ['casa-futura-climate-card', CasaFuturaClimateCard, 'Casa Futura · Climate', 'A thermostat dial with modes, fan speed, presets and swing for any climate entity.'],
    ['casa-futura-light-card', CasaFuturaLightCard, 'Casa Futura · Light', 'A big brightness slider with white temperature, colors and the lights of a group.'],
    ['casa-futura-vacuum-card', CasaFuturaVacuumCard, 'Casa Futura · Vacuum', 'Map, battery and controls of a robot vacuum, with quick cleanings and the station sensors.'],
    ['casa-futura-camera-card', CasaFuturaCameraCard, 'Casa Futura · Cameras', 'Camera snapshots in a strip or a grid that refresh while on screen, with live video on tap.']
  ].forEach(function (d) {
    if (!customElements.get(d[0])) customElements.define(d[0], d[1]);
    window.customCards = window.customCards || [];
    window.customCards.push({ type: d[0], name: d[2], description: d[3], preview: true, documentationURL: REPO });
  });
  [['casa-futura-gauge-card-editor', CasaFuturaGaugeCardEditor], ['casa-futura-alerts-card-editor', CasaFuturaAlertsCardEditor],
    ['casa-futura-action-card-editor', CasaFuturaActionCardEditor], ['casa-futura-climate-card-editor', CasaFuturaClimateCardEditor],
    ['casa-futura-light-card-editor', CasaFuturaLightCardEditor], ['casa-futura-vacuum-card-editor', CasaFuturaVacuumCardEditor],
    ['casa-futura-camera-card-editor', CasaFuturaCameraCardEditor]].forEach(function (d) { if (!customElements.get(d[0])) customElements.define(d[0], d[1]); });
  console.info('%c CASA FUTURA CARDS %c ' + VERSION + ' ', 'color:#0b0f1a;background:#5ff3ff;font-weight:700;border-radius:4px 0 0 4px', 'color:#5ff3ff;background:#0b0f1a;border-radius:0 4px 4px 0');
})();
