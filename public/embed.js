(function () {
  'use strict';
  var script = document.currentScript;
  if (!script || !script.src) return;
  var key = script.getAttribute('data-key');
  if (!key || !/^[0-9a-f]{32,64}$/i.test(key)) return;
  if (window.__realchatLoaded) return;
  window.__realchatLoaded = true;

  var appOrigin = new URL(script.src).origin;

  var params = new URLSearchParams();
  params.set('key', key);
  params.set('page', location.origin + location.pathname);
  var q = new URLSearchParams(location.search);
  ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'].forEach(function (k) {
    var v = q.get(k);
    if (v) params.set(k, v.slice(0, 100));
  });
  var lang = script.getAttribute('data-lang');
  if (lang === 'en' || lang === 'ar') params.set('lang', lang);

  var iframe = document.createElement('iframe');
  iframe.src = appOrigin + '/chatbot?' + params.toString();
  iframe.title = 'Chat';
  iframe.setAttribute('allow', 'clipboard-write');
  var st = iframe.style;
  st.position = 'fixed';
  st.border = '0';
  st.background = 'transparent';
  st.colorScheme = 'normal';
  st.zIndex = '2147483000';
  st.width = '0';
  st.height = '0';

  var last = { open: false, position: 'BOTTOM_RIGHT', hasLabel: false };

  function place(pos) {
    st.top = 'auto'; st.left = 'auto'; st.right = 'auto';
    st[pos === 'BOTTOM_LEFT' ? 'left' : 'right'] = '12px';
    st.bottom = 'calc(12px + env(safe-area-inset-bottom, 0px))';
  }

  function apply(m) {
    var narrow = window.innerWidth <= 480;
    if (m.open && narrow) {
      st.top = '0'; st.left = '0'; st.right = '0'; st.bottom = '0';
      st.width = '100%'; st.height = '100dvh';
    } else if (m.open) {
      st.width = Math.min(400, window.innerWidth - 24) + 'px';
      st.height = Math.min(640, window.innerHeight - 24) + 'px';
      place(m.position);
    } else {
      st.width = (m.hasLabel ? 220 : 76) + 'px';
      st.height = '76px';
      place(m.position);
    }
  }

  window.addEventListener('message', function (e) {
    if (e.origin !== appOrigin || e.source !== iframe.contentWindow) return;
    var d = e.data;
    if (!d || d.type !== 'widget:state') return;
    last = {
      open: !!d.open,
      position: d.position === 'BOTTOM_LEFT' ? 'BOTTOM_LEFT' : 'BOTTOM_RIGHT',
      hasLabel: !!d.hasLabel
    };
    apply(last);
  });
  window.addEventListener('resize', function () { apply(last); });

  function mount() { document.body.appendChild(iframe); }
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);
})();
