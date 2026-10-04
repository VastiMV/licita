/* Licita — modal do processo encerrado, numa tela só: fases clicáveis + linha do tempo em zigue-zague. */
(function () {
  var ETAPAS = [
    { id: 'oportunidade', nome: 'Oportunidade' }, { id: 'cotacao', nome: 'Cotação' }, { id: 'proposta', nome: 'Proposta' },
    { id: 'disputa', nome: 'Disputa' }, { id: 'empenho', nome: 'Empenho' }
  ];
  var DESF = {
    descartado:        { fam: 'neutral', nome: 'Descartado', curto: 'Descartado', ico: 'trash' },
    prazo_sem_cotacao: { fam: 'warn', nome: 'Prazo perdido sem cotação', curto: 'Prazo perdido', ico: 'clock' },
    prazo_cotacao:     { fam: 'warn', nome: 'Prazo perdido na cotação', curto: 'Prazo perdido', ico: 'clock' },
    desclassificada:   { fam: 'danger', nome: 'Proposta desclassificada', curto: 'Desclassificada', ico: 'x' },
    perdido_disputa:   { fam: 'danger', nome: 'Não venceu na disputa', curto: 'Não venceu', ico: 'x' },
    falhou_empenho:    { fam: 'danger', nome: 'Falhou no empenho', curto: 'Empenho falhou', ico: 'x' },
    concluido:         { fam: 'success', nome: 'Concluído', curto: 'Concluído', ico: 'check' }
  };
  var P = {
    x: 'M6 6l12 12M18 6L6 18', check: 'M5 12.5l4.5 4.5L19 7', clock: 'M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z',
    trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13', ext: 'M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
    close: 'M6 6l12 12M18 6L6 18', down: 'M12 4v11M7 10l5 5 5-5M5 20h14', doc: 'M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6',
    lock: 'M7 11V8a5 5 0 0 1 10 0v3M5 11h14v10H5z', redo: 'M4 12a8 8 0 1 0 2.3-5.6M4 4v4h4',
    gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1',
    left: 'M15 6l-6 6 6 6', right: 'M9 6l6 6-6 6', stack: 'M4 8l8-4 8 4-8 4zM4 12l8 4 8-4M4 16l8 4 8-4'
  };
  function ico(n, s) { s = s || 16; return '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + P[n] + '"/></svg>'; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function brl(v) { return 'R$ ' + v.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
  function d(i) { return i.slice(8, 10) + '/' + i.slice(5, 7); }
  function dA(i) { return d(i) + '/' + i.slice(0, 4); }
  function h(i) { return i.slice(11, 16); }
  function dh(i) { return d(i) + ', ' + h(i); }
  function dias(a, b) { return Math.round((new Date(b.slice(0, 10)) - new Date(a.slice(0, 10))) / 864e5); }
  function ini(n) { return n.split(' ').map(function (x) { return x[0]; }).slice(0, 2).join(''); }
  function idx(id) { for (var i = 0; i < ETAPAS.length; i++) if (ETAPAS[i].id === id) return i; return -1; }
  function de(p, e) { return p.eventos.filter(function (x) { return x.etapa === e; }); }
  function pct(a, b) { return Math.round(a / b * 100) + '%'; }
  function uniq(a) { var o = []; a.forEach(function (x) { if (x && o.indexOf(x) < 0) o.push(x); }); return o; }
  function dd(n) { return n + (n === 1 ? ' dia' : ' dias'); }
  function lista(a) { return a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' e ' + a[a.length - 1]; }

  /* ---------- estado de cada fase ---------- */
  function estado(p, i) {
    var at = idx(p.etapa), x = p.desfecho, D = DESF[x.tipo], evs = de(p, ETAPAS[i].id);
    if (i < at) return evs.length ? { c: 'done', sub: d(evs[0].data), rot: 'Concluída' } : { c: 'skip', sub: 'sem registro', rot: 'Sem registro' };
    if (i === at) return x.tipo === 'concluido' ? { c: 'done end-ok', sub: 'Concluído · ' + d(x.data), rot: 'Concluída', fam: 'success' }
      : { c: 'stop', sub: D.curto + ' · ' + d(x.data), rot: 'Parou aqui', fam: D.fam };
    return { c: 'after', sub: 'não alcançada', rot: 'Não alcançada' };
  }

  /* ---------- cabeçalho ---------- */
  function cabecalho(p) {
    var cots = p.eventos.filter(function (e) { return /^cotacao_/.test(e.tipo); }), c = cots[cots.length - 1];
    function f(l, v, s) { return '<div class="lz-fact"><dt>' + l + '</dt><dd>' + v + (s ? '<small>' + s + '</small>' : '') + '</dd></div>'; }
    return '<header class="lz-head"><div class="lz-head-l"><div class="lz-chips">' +
      '<span class="lz-chip"><b>' + esc(p.modalidade) + '</b> ' + esc(p.numero) + '</span><span class="lz-chip">UASG <b>' + esc(p.uasg) + '</b></span>' +
      '<span class="lz-chip">' + esc(p.cidade) + '/' + esc(p.uf) + '</span>' +
      '<a class="lz-link" href="#">' + ico('ext', 13) + 'PNCP</a><a class="lz-link" href="#">' + ico('ext', 13) + esc(p.plataforma) + '</a></div>' +
      '<h2 class="lz-title" title="' + esc(p.objeto) + '">' + esc(p.objeto) + '</h2><div class="lz-orgao">' + esc(p.orgao) + '</div></div>' +
      '<dl class="lz-facts">' + f('Prazo da proposta', dA(p.prazo) + ' · ' + h(p.prazo)) +
      f('Valor estimado', '<span class="num">' + brl(p.valorEstimado) + '</span>') +
      f('Valor cotado', c ? '<span class="num">' + brl(c.valor) + '</span>' : '—') +
      f('Responsável', esc(p.responsavel)) + '</dl>' +
      '<button class="lz-x" aria-label="Fechar">' + ico('close', 18) + '</button></header>';
  }

  /* ---------- faixa ---------- */
  function faixa(p) {
    var x = p.desfecho, D = DESF[x.tipo], n = dias(x.data, p.hoje);
    var tag = x.tipo === 'concluido' ? '' : 'Encerrada em ' + ETAPAS[idx(p.etapa)].nome;
    return '<section class="lz-faixa f-' + D.fam + '" role="status"><span class="lz-faixa-ico">' + ico(D.ico, 16) + '</span>' +
      '<div class="lz-faixa-txt"><b>' + (x.tipo === 'concluido' ? 'Concluído — empenhado e entregue' : D.nome) + '</b>' + (tag ? '<span class="lz-faixa-tag">' + tag + '</span>' : '') +
      '<p>' + esc(x.porque) + '</p></div><div class="lz-faixa-when"><b>' + dA(x.data) + '</b>' + (n === 0 ? 'hoje' : 'há ' + n + (n === 1 ? ' dia' : ' dias')) + '</div></section>';
  }

  /* ---------- linha de fases (clicável) ---------- */
  function fases(p, sel) {
    return '<div class="lz-fases" role="tablist" aria-label="Fases do ciclo">' + ETAPAS.map(function (E, i) {
      var s = estado(p, i), D = s.fam ? ' f-' + s.fam : '';
      var dot = s.c.indexOf('done') === 0 ? ico('check', 13) : s.c === 'stop' ? ico(DESF[p.desfecho.tipo].ico, 13) : '';
      return '<button class="lz-fase is-' + s.c.split(' ')[0] + (s.c.indexOf('end-ok') > 0 ? ' is-endok' : '') + D + (i === sel ? ' is-sel' : '') + '" role="tab" aria-selected="' + (i === sel) + '" data-i="' + i + '">' +
        '<span class="lz-fase-dot">' + dot + '</span><span class="lz-fase-n"><span class="lz-fase-i">' + (i + 1) + '. </span>' + E.nome + '</span><span class="lz-fase-s">' + s.sub + '</span></button>';
    }).join('') + '</div>';
  }

  /* ---------- nós da linha do tempo (salvamentos agrupados) ---------- */
  function nos(p) {
    var out = [], ev = p.eventos, i = 0;
    while (i < ev.length) {
      if (ev[i].tipo === 'cotacao_atualizada') {
        var j = i; while (j < ev.length && ev[j].tipo === 'cotacao_atualizada') j++;
        var run = ev.slice(i, j);
        if (run.length >= 3) {
          var last = run.pop();
          out.push({ k: 'grp', etapa: 'cotacao', n: run.length, a: run[0], b: run[run.length - 1], autores: uniq(run.map(function (e) { return e.autor; })) });
          out.push({ k: 'ev', etapa: last.etapa, e: Object.assign({}, last, { texto: 'Última atualização' }) });
        } else run.forEach(function (e) { out.push({ k: 'ev', etapa: e.etapa, e: e }); });
        i = j;
      } else { out.push({ k: 'ev', etapa: ev[i].etapa, e: ev[i] }); i++; }
    }
    out.push({ k: 'end', etapa: p.etapa });
    return out;
  }

  function serpentina(p, sel, W, H) {
    var N = nos(p), n = N.length;
    var RMIN = 128, avail = W - 2 * 96;
    var rows = Math.max(1, Math.ceil(n / 5)), maxRows = Math.max(1, Math.floor((H - 110) / RMIN) + 1);
    var maxPer = Math.max(2, Math.floor(avail / 126) + 1);
    if (rows > maxRows) rows = maxRows;
    var per = Math.ceil(n / rows);
    if (per > maxPer) { per = maxPer; rows = Math.ceil(n / per); }
    var step = per > 1 ? Math.min(280, avail / (per - 1)) : 0;
    var padX = (W - (per - 1) * step) / 2;
    var rowH = rows > 1 ? Math.max(RMIN, Math.min(160, (H - 120) / (rows - 1))) : RMIN;
    var contentH = (rows - 1) * rowH + 110, top = Math.max(44, (H - contentH) / 2 + 30);
    var pos = N.map(function (_, k) {
      var r = Math.floor(k / per), c = k % per;
      return { x: r % 2 === 0 ? padX + c * step : W - padX - c * step, y: top + r * rowH, r: r };
    });
    var selId = ETAPAS[sel].id, D = DESF[p.desfecho.tipo];
    var svg = '';
    for (var k = 1; k < n; k++) {
      var a = pos[k - 1], b = pos[k], et = N[k].k === 'end' ? N[k - 1].etapa : N[k].etapa;
      var cls = 'lz-seg' + (et === selId ? ' is-sel' : '') + (N[k].k === 'end' ? ' is-end f-' + D.fam : '');
      var dpath = a.r === b.r ? 'M' + a.x + ' ' + a.y + 'L' + b.x + ' ' + b.y
        : 'M' + a.x + ' ' + a.y + 'A' + rowH / 2 + ' ' + rowH / 2 + ' 0 0 ' + (a.r % 2 === 0 ? 1 : 0) + ' ' + b.x + ' ' + b.y;
      svg += '<path class="' + cls + '" d="' + dpath + '"/>';
    }
    var lastEt = null, html = '';
    N.forEach(function (o, k) {
      var q = pos[k], on = o.etapa === selId || o.k === 'end' && p.etapa === selId, cls = 'lz-node' + (on ? ' is-on' : ' is-off');
      var chip = '';
      if (o.k !== 'end' && o.etapa !== lastEt) { chip = '<span class="lz-node-et">' + ETAPAS[idx(o.etapa)].nome + '</span>'; lastEt = o.etapa; }
      var mark, t1, t2, t3 = '';
      if (o.k === 'ev') {
        var e = o.e, sys = !e.autor;
        mark = sys ? '<span class="lz-m lz-m--sys">' + ico('gear', 14) + '</span>' : '<span class="lz-m">' + ini(e.autor) + '</span>';
        t1 = esc(e.texto); t2 = d(e.data) + ' · ' + (sys ? 'sistema' : esc(e.autor.split(' ')[0]));
        if (e.valor != null) t3 = '<span class="num">' + brl(e.valor) + '</span>';
        if (sys) cls += ' is-sys';
      } else if (o.k === 'grp') {
        mark = '<span class="lz-m lz-m--grp">' + o.n + '×</span>';
        t1 = o.n + ' atualizações'; t2 = d(o.a.data) + '–' + d(o.b.data) + ' · ' + o.autores.map(function (a) { return a.split(' ')[0]; }).join(', ');
        t3 = '<span class="num">→ ' + brl(o.b.valor) + '</span>';
      } else {
        mark = '<span class="lz-m lz-m--end f-' + D.fam + '">' + ico(D.ico, 16) + '</span>';
        t1 = '<b>' + (p.desfecho.tipo === 'concluido' ? 'Concluído' : D.nome) + '</b>'; t2 = dA(p.desfecho.data); cls += ' is-end';
      }
      html += '<div class="' + cls + '" style="left:' + q.x + 'px;top:' + q.y + 'px" data-et="' + idx(o.etapa) + '">' + chip + mark +
        '<span class="lz-node-t">' + t1 + '</span><span class="lz-node-m">' + t2 + '</span>' + (t3 ? '<span class="lz-node-v">' + t3 + '</span>' : '') + '</div>';
    });
    var hgt = top + (rows - 1) * rowH + 100;
    return { html: '<svg class="lz-svg" width="' + W + '" height="' + hgt + '" aria-hidden="true">' + svg + '</svg>' + html, h: hgt };
  }

  /* ---------- narração da fase selecionada ---------- */
  function pontos(p, i) {
    var E = ETAPAS[i], evs = de(p, E.id), s = estado(p, i), x = p.desfecho, out = [];
    function find(t) { for (var k = 0; k < evs.length; k++) if (evs[k].tipo === t) return evs[k]; }
    if (s.c === 'after') return { pts: ['Etapa não alcançada.', 'O processo encerrou em <b>' + ETAPAS[idx(p.etapa)].nome + '</b> — ' + DESF[x.tipo].nome.toLowerCase() + ', em ' + dA(x.data) + '.'] };
    if (s.c === 'skip') return { pts: ['Nenhum registro nesta etapa.', 'O processo seguiu direto para a etapa seguinte — o sistema avisa, mas não trava.'] };
    var nx = ETAPAS[i + 1] && de(p, ETAPAS[i + 1].id)[0];
    if (E.id === 'oportunidade') {
      var sv = find('oportunidade_salva'), rm = find('removida'), pz = find('prazo_encerrado');
      out.push('Edital salvo por <b>' + esc(sv.autor) + '</b> em ' + dh(sv.data) + '.');
      out.push('Prazo da proposta: <b>' + dA(p.prazo) + ', ' + h(p.prazo) + '</b> — ' + dias(sv.data, p.prazo) + ' dias depois de salvo.');
      if (rm) out.push('Removido da lista por <b>' + esc(rm.autor) + '</b> em ' + dh(rm.data) + ', ' + dd(dias(sv.data, rm.data)) + ' depois. Motivo não informado.');
      if (pz) out.push('Ficou ' + dd(dias(sv.data, pz.data)) + ' sem cotação até o prazo vencer.');
      if (nx) out.push('Seguiu para Cotação em ' + d(nx.data) + (dias(sv.data, nx.data) ? ', ' + dd(dias(sv.data, nx.data)) + ' depois.' : ', no mesmo dia.'));
    }
    if (E.id === 'cotacao') {
      var cs = evs.filter(function (e) { return /^cotacao_/.test(e.tipo); }), c0 = cs[0], cf = cs[cs.length - 1], pz2 = find('prazo_encerrado');
      out.push('Cotação criada por <b>' + esc(c0.autor) + '</b> em ' + dh(c0.data) + ' com <span class="num">' + brl(c0.valor) + '</span>.');
      out.push('<b>' + cs.length + ' salvamentos</b> em ' + (dias(c0.data, cf.data) + 1) + ' dias, por ' + lista(uniq(cs.map(function (e) { return e.autor; }))) + '.');
      out.push('Valor final <b class="num">' + brl(cf.valor) + '</b> — ' + pct(cf.valor, p.valorEstimado) + ' do estimado, em ' + dh(cf.data) + '.');
      if (pz2) out.push('Prazo venceu ' + dd(dias(cf.data, pz2.data)) + ' após a última edição, sem proposta.');
      if (nx) out.push('Virou proposta em ' + d(nx.data) + '.');
    }
    if (E.id === 'proposta') {
      var pr = find('proposta_enviada');
      out.push('Proposta enviada por <b>' + esc(pr.autor) + '</b> em ' + dh(pr.data) + ': <span class="num">' + brl(pr.valor) + '</span> (' + pct(pr.valor, p.valorEstimado) + ' do estimado).');
      out.push('Dentro do prazo — ' + dd(dias(pr.data, p.prazo)) + ' antes de ' + dA(p.prazo) + ', ' + h(p.prazo) + '.');
      var dc = find('desclassificada'); if (dc) out.push('<b>Desclassificada</b> pelo pregoeiro em ' + dh(dc.data) + (dc.nota ? ' — ' + esc(dc.nota) : '') + '.');
    }
    if (E.id === 'disputa') {
      var se = find('sessao_aberta'), la = find('lance'), r = p.disputa;
      if (se) out.push('Sessão pública aberta em ' + dh(se.data) + '.');
      if (la) out.push('Lance final de <b class="num">' + brl(la.valor) + '</b> por ' + esc(la.autor) + (la.valorNota ? ' (' + la.valorNota + ')' : '') + '.');
      if (r && r.posicao === 1) out.push('<b>Vencemos</b> entre ' + r.participantes + ' participantes. 2º colocado: ' + esc(r.segundo) + ' com <span class="num">' + brl(r.precoSegundo) + '</span>.');
      else if (r) out.push('Vencedor: <b>' + esc(r.vencedor) + '</b> com <span class="num">' + brl(r.precoVencedor) + '</span> — ' + brl(r.nossoLance - r.precoVencedor) + ' (' + ((r.nossoLance / r.precoVencedor - 1) * 100).toFixed(1).replace('.', ',') + '%) abaixo do nosso lance. Ficamos em ' + r.posicao + 'º de ' + r.participantes + '.');
    }
    if (E.id === 'empenho') {
      evs.forEach(function (e) { out.push(esc(e.texto) + ' em ' + dh(e.data) + (e.autor ? ' por <b>' + esc(e.autor) + '</b>' : ' (sistema)') + (e.nota ? ' — ' + esc(e.nota) : '') + (e.valor ? ': <span class="num">' + brl(e.valor) + '</span>' : '') + '.'); });
    }
    return { pts: out, porque: s.c === 'stop' || s.c.indexOf('end-ok') > 0 ? x.porque : null, fam: s.fam };
  }
  function narracao(p, i) {
    var E = ETAPAS[i], s = estado(p, i), evs = de(p, E.id), r = pontos(p, i);
    var per = evs.length ? d(evs[0].data) + (d(evs[0].data) !== d(evs[evs.length - 1].data) ? ' – ' + d(evs[evs.length - 1].data) : '') + ' · ' + evs.length + (evs.length === 1 ? ' evento' : ' eventos') : '';
    return '<div class="lz-narr-head"><span class="lz-narr-k">Fase ' + (i + 1) + ' de 5</span><h3>' + E.nome + '</h3>' +
      '<span class="lz-pill is-' + s.c.split(' ')[0] + (s.fam ? ' f-' + s.fam : '') + '">' + s.rot + '</span>' + (per ? '<span class="lz-narr-per">' + per + '</span>' : '') + '</div>' +
      '<ol class="lz-pts">' + r.pts.map(function (t) { return '<li>' + t + '</li>'; }).join('') + '</ol>' +
      (r.porque ? '<div class="lz-porque f-' + r.fam + '"><b>' + (p.desfecho.tipo === 'concluido' ? 'Como terminou' : 'Por que parou aqui') + '</b>' + esc(r.porque) + '</div>' : '') +
      '<div class="lz-narr-nav"><button class="lz-nav" data-go="-1"' + (i === 0 ? ' disabled' : '') + '>' + ico('left', 16) + ' Anterior</button>' +
      '<button class="lz-nav" data-go="1"' + (i === 4 ? ' disabled' : '') + '>Próxima ' + ico('right', 16) + '</button></div>';
  }

  function rodape(p) {
    var temCot = p.eventos.some(function (e) { return /^cotacao_/.test(e.tipo); }), fim = p.desfecho.tipo === 'concluido';
    return '<footer class="lz-foot"><span class="lz-foot-note">' + ico('lock', 14) + ' Somente consulta' + (temCot ? ' · a cotação abre só para leitura' : '') + '<span class="lz-kbd">← → navegam pelas fases</span></span>' +
      (fim ? '' : '<button class="lz-btn lz-btn--ghost" disabled title="Disponível em breve">' + ico('redo', 16) + ' Reabrir processo <span class="lz-soon">em breve</span></button>') +
      (temCot ? '<button class="lz-btn">' + ico('down', 16) + ' Exportar planilha</button><button class="lz-btn lz-btn--primary">' + ico('doc', 16) + ' Ver cotação</button>'
        : '<button class="lz-btn lz-btn--primary">' + ico('ext', 16) + ' Abrir edital no PNCP</button>') + '</footer>';
  }

  function montar(root, p) {
    var sel = idx(p.etapa);
    root.innerHTML = '<div class="lc lz lz--v" role="dialog" aria-modal="true" aria-label="' + esc(p.objeto) + '" tabindex="-1">' + cabecalho(p) +
      '<div class="lz-scroll">' + faixa(p) + '<div class="lz-fases-wrap"></div>' +
      '<div class="lz-vbody"><div class="lz-vtl"><div class="lc-sec-title">Linha do tempo</div>' + LC.linhaDoTempo(p) + '</div>' +
      '<aside class="lz-narr" aria-live="polite"></aside></div></div>' + rodape(p) + '</div>';
    var M = root.firstChild, sc = M.querySelector('.lz-scroll'), fw = M.querySelector('.lz-fases-wrap');
    var secs = [].slice.call(M.querySelectorAll('.lc-tl-stage'));
    secs.forEach(function (el) {
      var nome = el.querySelector('h4').textContent;
      for (var i = 0; i < ETAPAS.length; i++) if (ETAPAS[i].nome === nome) el.dataset.et = i;
      el.querySelector('.lc-tl-stage-head').insertAdjacentHTML('beforeend', '<span class="lz-v-status"></span>');
    });
    function draw(rolar) {
      fw.innerHTML = fases(p, sel);
      M.querySelector('.lz-narr').innerHTML = narracao(p, sel);
      var alvo = null;
      secs.forEach(function (el) {
        var on = +el.dataset.et === sel; el.classList.toggle('is-sel', on); el.classList.toggle('is-dim', !on);
        var st = estado(p, +el.dataset.et); el.querySelector('.lz-v-status').innerHTML = '<span class="lz-pill is-' + st.c.split(' ')[0] + (st.fam ? ' f-' + st.fam : '') + '">' + st.rot + '</span>';
        if (on) alvo = el;
      });
      var end = M.querySelector('.lc-tl-end'); if (end) end.classList.toggle('is-dim', sel !== idx(p.etapa));
      if (rolar) {
        var y = alvo ? alvo.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop - fw.offsetHeight - 16
          : M.querySelector('.lz-vbody').offsetTop - fw.offsetHeight - 8;
        sc.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
      }
    }
    function go(i) { sel = Math.max(0, Math.min(4, i)); draw(true); }
    M.addEventListener('click', function (ev) {
      if (ev.target.closest('summary')) return;
      var b = ev.target.closest('[data-i]'); if (b) return go(+b.dataset.i);
      var g = ev.target.closest('[data-go]'); if (g) return go(sel + +g.dataset.go);
      var s2 = ev.target.closest('.lc-tl-stage[data-et]'); if (s2 && +s2.dataset.et !== sel) { sel = +s2.dataset.et; draw(false); }
    });
    M.addEventListener('keydown', function (ev) { if (ev.key === 'ArrowRight') go(sel + 1); if (ev.key === 'ArrowLeft') go(sel - 1); });
    draw(false);
    M.focus({ preventScroll: true });
    return M;
  }

  window.LZ = { montar: montar };
})();
