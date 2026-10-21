/*!
 * Casa Futura Cards for Home Assistant
 * Liquid glass cards for wall tablets and dashboards:
 *   casa-futura-gauge-card   a big needle gauge for any sensor
 *   casa-futura-alerts-card  a floating bell with a side panel of alerts
 *   casa-futura-action-card  a button with optional confirmation, PIN and several choices
 *
 * https://github.com/ironblaster/casa-futura-cards
 * Released under the MIT License.
 */
(function () {
  'use strict';

  var VERSION = '1.0.0';
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
      '</style><div class="scrim" id="scrim"><div class="glass dlg" id="dlg"></div></div>';
    lookVars(r.getElementById('scrim'), c);
    document.body.appendChild(p);
    var api = {
      root: r, el: r.getElementById('dlg'),
      close: function () { if (p.parentNode) p.parentNode.removeChild(p); document.removeEventListener('keydown', onKey); }
    };
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
      alerts_h: 'Each alert shows up in the panel while its condition is true. The first one gives its color to the bell.',
      choices_h: 'With more than one choice a window lets you pick what to do. Without choices the tap action is used.'
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
      alerts_h: 'Ogni avviso compare nel pannello finché la sua condizione è vera. Il primo dà il colore alla campanella.',
      choices_h: 'Con più di una scelta si apre una finestra per decidere cosa fare. Senza scelte si usa l’azione al tocco.'
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
    set hass(h) { this._hass = h; if (this._form) { this._form.hass = h; (this._rows || []).forEach(function (r) { r.hass = h; }); } else this._draw(); }
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
      if (this._listKey) this._drawList();
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
    // list of items (alerts or choices)
    _drawList() {
      var self = this, L = this._L.bind(this), host = this._root.getElementById('list'), key = this._listKey;
      var items = Array.isArray(this._config[key]) ? this._config[key] : [];
      if (!this._panel) {
        var p = document.createElement('ha-expansion-panel');
        p.outlined = true; p.setAttribute('outlined', ''); p.header = L(this._listTitle); p.expanded = true;
        p.innerHTML = '<div class="list"><p class="help">' + esc(L(this._listHelp)) + '</p><div id="rows"></div>' +
          '<button class="b" id="add"><ha-icon icon="mdi:plus"></ha-icon>' + esc(L(this._listAdd)) + '</button></div>';
        host.appendChild(p);
        this._panel = p;
        p.querySelector('#add').addEventListener('click', function () {
          var list = (self._config[key] || []).slice(); list.push(self._newItem());
          var cfg = Object.assign({}, self._config); cfg[key] = list; self._emit(cfg);
        });
      }
      var rowsEl = this._panel.querySelector('#rows');
      if (this._rowsKey !== items.length) {
        this._rowsKey = items.length; rowsEl.innerHTML = ''; this._rows = [];
        items.forEach(function (it, i) {
          var row = document.createElement('div'); row.className = 'row';
          var f = document.createElement('ha-form');
          f.hass = self._hass;
          f.computeLabel = function (s) { return L(s.name); };
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
              var cfg = Object.assign({}, self._config); cfg[key] = list; self._rowsKey = null; self._emit(cfg);
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
          self._rows.push(f);
        });
      }
      items.forEach(function (it, i) {
        var f = self._rows[i]; if (!f) return;
        f.hass = self._hass; f.schema = self._itemSchema(it); f.data = self._itemData(it);
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

  /* ================================================================ registration */

  [
    ['casa-futura-gauge-card', CasaFuturaGaugeCard, 'Casa Futura · Gauge', 'A big needle gauge for any sensor, with colored zones.'],
    ['casa-futura-alerts-card', CasaFuturaAlertsCard, 'Casa Futura · Alerts bell', 'A floating bell that appears when something needs attention, with a side panel listing the alerts.'],
    ['casa-futura-action-card', CasaFuturaActionCard, 'Casa Futura · Action button', 'A button with optional confirmation, PIN and several choices (e.g. unlock, open, lock).']
  ].forEach(function (d) {
    if (!customElements.get(d[0])) customElements.define(d[0], d[1]);
    window.customCards = window.customCards || [];
    window.customCards.push({ type: d[0], name: d[2], description: d[3], preview: true, documentationURL: REPO });
  });
  [['casa-futura-gauge-card-editor', CasaFuturaGaugeCardEditor], ['casa-futura-alerts-card-editor', CasaFuturaAlertsCardEditor],
    ['casa-futura-action-card-editor', CasaFuturaActionCardEditor]].forEach(function (d) { if (!customElements.get(d[0])) customElements.define(d[0], d[1]); });
  console.info('%c CASA FUTURA CARDS %c ' + VERSION + ' ', 'color:#0b0f1a;background:#5ff3ff;font-weight:700;border-radius:4px 0 0 4px', 'color:#5ff3ff;background:#0b0f1a;border-radius:0 4px 4px 0');
})();
