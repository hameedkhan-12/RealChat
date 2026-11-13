(function () {
  try {
    var script = document.currentScript;
    if (!script) return;
    var key = script.getAttribute('data-key');
    if (!key) return;
    var appUrl = script.getAttribute('data-app-url') || (new URL(script.src)).origin;
    var iframe = document.createElement('iframe');
    iframe.src = appUrl.replace(/\/$/, '') + '/chatbot?key=' + encodeURIComponent(key);
    iframe.style.position = 'fixed';
    iframe.style.bottom = '20px';
    var pos = (script.getAttribute('data-position') || 'right').toLowerCase();
    if (pos === 'left') { iframe.style.left = '20px'; } else { iframe.style.right = '20px'; }
    iframe.style.width = '420px';
    iframe.style.height = '640px';
    iframe.style.border = '0';
    iframe.style.zIndex = '2147483000';
    iframe.style.background = 'transparent';
    iframe.setAttribute('allow', 'clipboard-write');
    iframe.setAttribute('title', 'Chat widget');
    window.addEventListener('message', function (e) {
      if (e.origin !== new URL(appUrl).origin) return;
      if (!e.data || typeof e.data !== 'object') return;
      if (e.data.type === 'widget:resize') {
        if (e.data.width) iframe.style.width = e.data.width + 'px';
        if (e.data.height) iframe.style.height = e.data.height + 'px';
      }
    });
    document.body.appendChild(iframe);
  } catch (e) {}
})();
