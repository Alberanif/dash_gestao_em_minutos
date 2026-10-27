/* Central de Links - rastreamento de Teste A/B. Mesmo código em todas as páginas de captura. */
(function () {
  try {
    var s = document.currentScript;
    var origem = s && (s.getAttribute('data-origem') || (s.src && new URL(s.src).origin));
    if (!origem) return;
    var url = origem.replace(/\/+$/, '') + '/api/track';
    var nome = 'ab_vid';

    function aleatorio() {
      try { if (crypto.randomUUID) return crypto.randomUUID(); } catch (e) {}
      var r = '';
      for (var i = 0; i < 32; i++) r += Math.floor(Math.random() * 16).toString(16);
      return r;
    }
    function lerCookie() {
      var m = document.cookie.match(new RegExp('(?:^|; )' + nome + '=([A-Za-z0-9_-]{8,64})'));
      return m ? m[1] : null;
    }
    function lerLocal() { try { return localStorage.getItem(nome); } catch (e) { return null; } }

    var vid = lerLocal() || lerCookie();
    var novo = !vid;
    if (!vid) vid = aleatorio();
    try { localStorage.setItem(nome, vid); } catch (e) {}
    try { document.cookie = nome + '=' + vid + '; max-age=63072000; path=/; SameSite=Lax'; } catch (e) {}

    var q = new URLSearchParams(location.search);
    var utms = {};
    ['source', 'medium', 'campaign', 'content', 'term'].forEach(function (k) {
      var v = q.get('utm_' + k);
      if (v) utms['utm_' + k] = v.slice(0, 200);
    });

    function enviar(tipo) {
      try {
        var d = { evento_id: aleatorio(), visitante_id: vid, tipo: tipo, url: location.href.slice(0, 2000), novo_visitante: novo, referrer: (document.referrer || '').slice(0, 500) };
        for (var k in utms) d[k] = utms[k];
        var corpo = JSON.stringify(d);
        if (navigator.sendBeacon && navigator.sendBeacon(url, corpo)) return;
        fetch(url, { method: 'POST', body: corpo, keepalive: true, mode: 'no-cors', headers: { 'Content-Type': 'text/plain' } }).catch(function () {});
      } catch (e) {}
    }

    function formulario(el) {
      return el && el.closest ? el.closest('form._form, form[data-ab-form]') : null;
    }

    var comecou = false;
    document.addEventListener('focusin', function (e) {
      try {
        var t = e.target;
        if (comecou || !formulario(t) || !/^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName)) return;
        if (/^(hidden|submit|button|checkbox|radio)$/.test(t.type)) return;
        comecou = true;
        enviar('form_inicio');
      } catch (x) {}
    }, true);

    // Registrado no momento do submit, depois dos tratadores da própria página, para ver se a validação cancelou.
    document.addEventListener('submit', function (e) {
      try {
        var f = formulario(e.target);
        if (!f) return;
        f.addEventListener('submit', function (ev) {
          try { if (!ev.defaultPrevented) enviar('lead'); } catch (x) {}
        }, { once: true });
      } catch (x) {}
    }, true);

    enviar('pageview');
  } catch (e) {}
})();
