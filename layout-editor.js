/* ============================================================================
 * layout-editor.js — a tiny reusable, Figma-style in-page layout editor.
 *
 * PURPOSE: let the site owner art-direct the position/size of absolutely-
 * positioned items inside a container by eye, per breakpoint, then copy the
 * exact CSS to commit into source. Author guesses nothing; the human places.
 *
 * HOW TO ENABLE on any page:
 *   1. <script src="layout-editor.js" defer></script>
 *   2. Mark the container:   <div class="devices" data-layout-editor="devices"
 *                                 data-layout-items=".dev"> ... </div>
 *      - data-layout-editor : a unique name (storage key). Defaults to the
 *        element id, else "editorN".
 *      - data-layout-items  : CSS selector for the draggable children
 *        (default ".dev"). Each item must be position:absolute with left/top
 *        in % and width in % (height:auto).
 *   3. Give each item a stable key so the exported CSS can target it:
 *        - a class like `d-review`  → exports `.devices .d-review{...}`, OR
 *        - `data-le-key="review"`   → exports `.devices [data-le-key="review"]`
 *        - (fallback) nth-child index.
 *   The container itself is targeted by its #id if present, else its 1st class.
 *
 * ACTIVATION: the editor only runs when the URL has `?edit` (e.g.
 *   localhost:8095/zip.html?edit). It is completely invisible/inert otherwise,
 *   so it is safe to leave the <script> include on production pages.
 *
 * It injects its own CSS, so no per-page styles are needed.
 * Multiple editable containers per page are supported.
 * Edits persist to localStorage['layout-editor-v1'] and re-apply on reload
 * WHILE in ?edit mode only — they never affect normal visitors.
 * ========================================================================== */
(function () {
  if (!/[?&]edit(?:=|&|$)/.test(location.search)) return;

  var ACCENT = '#6d4aff';
  var STOREKEY = 'layout-editor-v1';
  // breakpoints: width <= px → name. First match wins; else "desktop".
  var BPS = [['mobile', 600], ['tablet', 980]];
  function bp() { var w = innerWidth; for (var i = 0; i < BPS.length; i++) if (w <= BPS[i][1]) return BPS[i][0]; return 'desktop'; }
  function bpMax(name) { for (var i = 0; i < BPS.length; i++) if (BPS[i][0] === name) return BPS[i][1]; return null; }

  function inject() {
    var s = document.createElement('style');
    s.textContent = [
      'body.le-on [data-layout-editor]{outline:1px dashed rgba(109,74,255,.45);outline-offset:6px}',
      'body.le-on .le-item{cursor:grab;touch-action:none}',
      'body.le-on .le-item:active{cursor:grabbing}',
      'body.le-on .le-item img{pointer-events:none;user-select:none}',
      'body.le-on .le-item:hover img,body.le-on .le-item:hover>*{transform:none!important}',
      'body.le-on .le-item.le-sel{outline:2px solid ' + ACCENT + ';outline-offset:2px}',
      'body.le-on .le-rsz{position:absolute;right:-8px;bottom:-8px;width:17px;height:17px;background:#fff;border:2px solid ' + ACCENT + ';border-radius:50%;cursor:nwse-resize;display:none;z-index:6}',
      'body.le-on .le-item.le-sel .le-rsz{display:block}',
      '#leHUD{position:fixed;left:14px;bottom:14px;z-index:99999;width:380px;max-width:48vw;background:#16121f;color:#eee;border-radius:13px;padding:14px 16px;font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:12px;line-height:1.45;box-shadow:0 16px 50px rgba(0,0,0,.45)}',
      '#leHUD h5{margin:0 0 6px;font-size:12px;letter-spacing:.04em;color:#fff;font-weight:700}',
      '#leHUD .le-bp{padding:2px 9px;border-radius:20px;background:' + ACCENT + ';color:#fff;font-weight:700;text-transform:uppercase;font-size:11px}',
      '#leHUD .le-hint{color:#9a93b4;margin-top:8px;font-size:11px}',
      '#leHUD #leLC{color:#cbb8ff;margin-top:8px}',
      '#leHUD .le-row{display:flex;gap:7px;margin-top:10px;flex-wrap:wrap}',
      '#leHUD button{font:inherit;background:#2a2440;color:#fff;border:1px solid #3a3358;border-radius:7px;padding:6px 10px;cursor:pointer}',
      '#leHUD button.le-primary{background:' + ACCENT + ';border-color:' + ACCENT + '}',
      '#leHUD textarea{width:100%;height:120px;margin-top:10px;background:#0e0b16;color:#bdb4d8;border:1px solid #2a2440;border-radius:7px;padding:8px;font:11px/1.4 "IBM Plex Mono",monospace;resize:vertical}'
    ].join('');
    document.head.appendChild(s);
  }

  function start() {
    var containers = [].slice.call(document.querySelectorAll('[data-layout-editor]'));
    if (!containers.length) return;
    inject();
    document.body.classList.add('le-on');

    var store = {};
    try { store = JSON.parse(localStorage.getItem(STOREKEY) || '{}') || {}; } catch (e) {}

    // Build a registry of editable containers + their keyed items.
    var reg = [];
    containers.forEach(function (cont, ci) {
      var name = cont.getAttribute('data-layout-editor') || cont.id || ('editor' + ci);
      var itemSel = cont.getAttribute('data-layout-items') || '.dev';
      var contSel = cont.id ? '#' + cont.id : (cont.classList[0] ? '.' + cont.classList[0] : '[data-layout-editor="' + name + '"]');
      var items = {}, keymeta = {};
      [].slice.call(cont.querySelectorAll(itemSel)).forEach(function (it, ii) {
        it.classList.add('le-item');
        var key = it.getAttribute('data-le-key'), viaClass = null;
        if (!key) { for (var c = 0; c < it.classList.length; c++) { if (/^d-/.test(it.classList[c])) { viaClass = it.classList[c].slice(2); break; } } }
        if (!key) key = viaClass || ('i' + ii);
        items[key] = it;
        keymeta[key] = viaClass ? '.d-' + key
          : (it.getAttribute('data-le-key') ? '[data-le-key="' + key + '"]' : itemSel + ':nth-of-type(' + (ii + 1) + ')');
        var h = document.createElement('div'); h.className = 'le-rsz'; it.appendChild(h);
      });
      reg.push({ name: name, el: cont, contSel: contSel, items: items, keymeta: keymeta });
    });

    function findReg(it) { for (var i = 0; i < reg.length; i++) if (reg[i].el.contains(it)) return reg[i]; return null; }
    function rect(el) { return el.getBoundingClientRect(); }

    function readLayout(R) {
      var cr = rect(R.el);
      var o = { aspect: R.el.style.aspectRatio || (Math.round(cr.width) + ' / ' + Math.round(cr.height)), items: {} };
      Object.keys(R.items).forEach(function (k) {
        var r = R.items[k].getBoundingClientRect();
        o.items[k] = {
          l: +((r.left - cr.left) / cr.width * 100).toFixed(3),
          t: +((r.top - cr.top) / cr.height * 100).toFixed(3),
          w: +(r.width / cr.width * 100).toFixed(3)
        };
      });
      return o;
    }
    function applyBP() {
      var b = bp();
      reg.forEach(function (R) {
        var L = store[R.name] && store[R.name][b]; if (!L) return;
        if (L.aspect) R.el.style.aspectRatio = L.aspect;
        Object.keys(L.items || {}).forEach(function (k) {
          var p = L.items[k]; if (R.items[k]) { R.items[k].style.left = p.l + '%'; R.items[k].style.top = p.t + '%'; R.items[k].style.width = p.w + '%'; }
        });
      });
    }
    function save(R) { var b = bp(); store[R.name] = store[R.name] || {}; store[R.name][b] = readLayout(R); localStorage.setItem(STOREKEY, JSON.stringify(store)); refresh(); }

    // ---- selection + drag/resize ----
    var sel = null; // {R, key}
    function select(R, key) {
      sel = { R: R, key: key };
      reg.forEach(function (Rr) { Object.keys(Rr.items).forEach(function (k) { Rr.items[k].classList.toggle('le-sel', Rr === R && k === key); }); });
      liveCoord();
    }
    var drag = null;
    document.addEventListener('pointerdown', function (e) {
      var it = e.target.closest && e.target.closest('.le-item'); if (!it) return;
      var R = findReg(it); if (!R) return;
      var key = Object.keys(R.items).filter(function (k) { return R.items[k] === it; })[0];
      select(R, key);
      var cr = rect(R.el), r = it.getBoundingClientRect();
      drag = { R: R, it: it, mode: e.target.classList.contains('le-rsz') ? 'resize' : 'move', cr: cr, offX: e.clientX - r.left, offY: e.clientY - r.top, startW: r.width, startX: e.clientX };
      try { it.setPointerCapture(e.pointerId); } catch (_) {}
      e.preventDefault();
    });
    document.addEventListener('pointermove', function (e) {
      if (!drag) return; var cr = drag.cr;
      if (drag.mode === 'move') {
        drag.it.style.left = Math.max(-10, Math.min(110, (e.clientX - cr.left - drag.offX) / cr.width * 100)) + '%';
        drag.it.style.top = Math.max(-10, Math.min(110, (e.clientY - cr.top - drag.offY) / cr.height * 100)) + '%';
      } else {
        drag.it.style.width = Math.max(3, Math.min(100, (drag.startW + (e.clientX - drag.startX)) / cr.width * 100)) + '%';
      }
      liveCoord();
    });
    document.addEventListener('pointerup', function () { if (drag) { var R = drag.R; drag = null; save(R); } });
    window.addEventListener('keydown', function (e) {
      if (!sel || !sel.R.items[sel.key]) return;
      var it = sel.R.items[sel.key], s = e.shiftKey ? 1 : 0.15;
      var l = parseFloat(it.style.left) || 0, t = parseFloat(it.style.top) || 0, w = parseFloat(it.style.width) || 0;
      if (e.key === 'ArrowLeft') it.style.left = (l - s) + '%';
      else if (e.key === 'ArrowRight') it.style.left = (l + s) + '%';
      else if (e.key === 'ArrowUp') it.style.top = (t - s) + '%';
      else if (e.key === 'ArrowDown') it.style.top = (t + s) + '%';
      else if (e.key === '+' || e.key === '=') it.style.width = (w + s) + '%';
      else if (e.key === '-' || e.key === '_') it.style.width = Math.max(3, w - s) + '%';
      else return;
      e.preventDefault(); save(sel.R);
    });
    function setBox(R, dh) { var cr = rect(R.el); R.el.style.aspectRatio = cr.width.toFixed(1) + ' / ' + Math.max(120, cr.height + dh).toFixed(1); save(R); }

    // ---- CSS export ----
    function exportCSS() {
      var out = '';
      reg.forEach(function (R) {
        var s = store[R.name]; if (!s) return;
        function blk(L, ind) {
          var t = '';
          Object.keys(L.items).forEach(function (k) {
            var p = L.items[k];
            t += ind + R.contSel + ' ' + R.keymeta[k] + '{left:' + p.l + '%;top:' + p.t + '%;width:' + p.w + '%}\n';
          });
          return t;
        }
        if (s.desktop) out += '/* ' + R.name + ' */\n' + R.contSel + '{aspect-ratio:' + s.desktop.aspect + '}\n' + blk(s.desktop, '');
        ['tablet', 'mobile'].forEach(function (b) {
          if (s[b]) out += '@media(max-width:' + bpMax(b) + 'px){\n  ' + R.contSel + '{aspect-ratio:' + s[b].aspect + '}\n' + blk(s[b], '  ') + '}\n';
        });
      });
      return out || '/* move or resize an item to generate code */';
    }

    // ---- HUD ----
    var hud = document.createElement('div'); hud.id = 'leHUD'; document.body.appendChild(hud);
    function refresh() {
      var saved = [];
      Object.keys(store).forEach(function (n) { Object.keys(store[n]).forEach(function (b) { saved.push(n + ':' + b); }); });
      hud.innerHTML =
        '<h5>Layout editor &middot; <span class="le-bp">' + bp() + '</span></h5>' +
        '<div class="le-hint">Drag to move &middot; drag the dot to resize &middot; arrows nudge (Shift = bigger) &middot; +/&minus; resize. Resize the browser window to edit tablet/mobile separately.</div>' +
        '<div id="leLC">(select an item)</div>' +
        '<div class="le-row"><button id="leBT">Box taller</button><button id="leBS">Box shorter</button></div>' +
        '<div class="le-row"><button class="le-primary" id="leCopy">Copy CSS</button><button id="leReset">Reset screen</button><button id="leClear">Clear all</button></div>' +
        '<textarea id="leTA" readonly>' + exportCSS() + '</textarea>' +
        '<div class="le-hint">Saved: ' + (saved.length ? saved.join(', ') : 'nothing yet') + '</div>';
      function tgt() { return (sel && sel.R) || reg[0]; }
      hud.querySelector('#leBT').onclick = function () { setBox(tgt(), 40); };
      hud.querySelector('#leBS').onclick = function () { setBox(tgt(), -40); };
      hud.querySelector('#leCopy').onclick = function () {
        var ta = hud.querySelector('#leTA'); ta.select();
        try { navigator.clipboard.writeText(ta.value); } catch (_) {}
        var me = this; me.textContent = 'Copied!'; setTimeout(function () { me.textContent = 'Copy CSS'; }, 1200);
      };
      hud.querySelector('#leReset').onclick = function () { var b = bp(); reg.forEach(function (R) { if (store[R.name]) delete store[R.name][b]; }); localStorage.setItem(STOREKEY, JSON.stringify(store)); location.reload(); };
      hud.querySelector('#leClear').onclick = function () { localStorage.removeItem(STOREKEY); location.reload(); };
      liveCoord();
    }
    function liveCoord() {
      var el = hud && hud.querySelector('#leLC'); if (!el) return;
      if (sel && sel.R.items[sel.key]) {
        var it = sel.R.items[sel.key];
        el.textContent = sel.R.name + ' / ' + sel.key + '  ·  left ' + (parseFloat(it.style.left) || 0).toFixed(2) + '%  ·  top ' + (parseFloat(it.style.top) || 0).toFixed(2) + '%  ·  width ' + (parseFloat(it.style.width) || 0).toFixed(2) + '%';
      } else el.textContent = '(select an item)';
    }

    applyBP(); refresh();
    var rt; window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { applyBP(); refresh(); }, 200); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
