/* Licita — renderizador do modal do processo (vanilla, sem dependências). */
(function () {
  var ETAPAS = [
    { id: 'oportunidade', nome: 'Oportunidade' },
    { id: 'cotacao', nome: 'Cotação' },
    { id: 'proposta', nome: 'Proposta' },
    { id: 'disputa', nome: 'Disputa' },
    { id: 'empenho', nome: 'Empenho' }
  ];
  var DESFECHOS = {
    descartado:        { fam: 'neutral', nome: 'Descartado',               curto: 'Descartado',    ico: 'trash' },
    prazo_sem_cotacao: { fam: 'warn',    nome: 'Prazo perdido sem cotação', curto: 'Prazo perdido', ico: 'clock' },
    prazo_cotacao:     { fam: 'warn',    nome: 'Prazo perdido na cotação',  curto: 'Prazo perdido', ico: 'clock' },
    desclassificada:   { fam: 'danger',  nome: 'Proposta desclassificada',  curto: 'Desclassificada', ico: 'x' },
    perdido_disputa:   { fam: 'danger',  nome: 'Não venceu na disputa',     curto: 'Não venceu',    ico: 'x' },
    falhou_empenho:    { fam: 'danger',  nome: 'Falhou no empenho',         curto: 'Empenho falhou', ico: 'x' },
    concluido:         { fam: 'success', nome: 'Concluído',                 curto: 'Concluído',     ico: 'check' }
  };
  var P = {
    x: 'M6 6l12 12M18 6L6 18', check: 'M5 12.5l4.5 4.5L19 7', clock: 'M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z',
    trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13', alert: 'M12 9v4M12 17h.01M10.3 3.9L2.5 18a2 2 0 0 0 1.7 3h15.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
    ext: 'M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5', close: 'M6 6l12 12M18 6L6 18',
    chev: 'M9 6l6 6-6 6', down: 'M12 4v11M7 10l5 5 5-5M5 20h14', doc: 'M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6',
    lock: 'M7 11V8a5 5 0 0 1 10 0v3M5 11h14v10H5z', redo: 'M4 12a8 8 0 1 0 2.3-5.6M4 4v4h4', gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1',
    arrow: 'M5 12h14M13 6l6 6-6 6', flag: 'M5 21V4h11l-1.5 4L16 12H5'
  };
  function ico(n, s) { s = s || 16; return '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + P[n] + '"/></svg>'; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function brl(v) { return 'R$ ' + v.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
  function d(iso) { return iso.slice(8, 10) + '/' + iso.slice(5, 7); }
  function dAno(iso) { return d(iso) + '/' + iso.slice(0, 4); }
  function h(iso) { return iso.slice(11, 16); }
  function dias(a, b) { return Math.round((new Date(b.slice(0, 10)) - new Date(a.slice(0, 10))) / 864e5); }
  function ini(n) { return n.split(' ').map(function (x) { return x[0]; }).slice(0, 2).join(''); }
  function idx(id) { for (var i = 0; i < ETAPAS.length; i++) if (ETAPAS[i].id === id) return i; return -1; }
  function evsDe(p, etapa) { return p.eventos.filter(function (e) { return e.etapa === etapa; }); }

  /* ---------- cabeçalho ---------- */
  function cabecalho(p) {
    var cot = ultimoValor(p);
    var prazoTxt = dAno(p.prazo) + ' · ' + h(p.prazo);
    var prazoSub = '', prazoCls = '';
    if (!p.desfecho) { var n = dias(p.hoje, p.prazo); prazoSub = n <= 0 ? 'hoje' : 'em ' + n + (n === 1 ? ' dia' : ' dias'); if (n <= 3) prazoCls = 'is-warn'; }
    else if (p.prazo < p.hoje) prazoSub = 'encerrado';
    return '<header class="lc-head"><div class="lc-head-top">' +
      '<span class="lc-chip"><b>' + esc(p.modalidade) + '</b> ' + esc(p.numero) + '</span>' +
      '<span class="lc-chip">UASG <b>' + esc(p.uasg) + '</b></span>' +
      '<span class="lc-chip">' + esc(p.cidade) + '/' + esc(p.uf) + '</span>' +
      '<div class="lc-head-links"><a class="lc-link" href="#" title="Abrir no PNCP">' + ico('ext', 14) + ' <span>PNCP</span></a>' +
      '<a class="lc-link" href="#" title="Abrir na plataforma">' + ico('ext', 14) + ' <span>' + esc(p.plataforma) + '</span></a>' +
      '<button class="lc-icon-btn" aria-label="Fechar">' + ico('close', 18) + '</button></div></div>' +
      '<h2 class="lc-title">' + esc(p.objeto) + '</h2><div class="lc-orgao">' + esc(p.orgao) + '</div>' +
      '<dl class="lc-facts">' +
      '<div class="lc-fact"><dt>Prazo da proposta</dt><dd class="' + prazoCls + '">' + prazoTxt + '<small>' + prazoSub + '</small></dd></div>' +
      '<div class="lc-fact"><dt>Valor estimado</dt><dd class="num">' + (p.valorEstimado ? brl(p.valorEstimado) : '—') + '<small>' + (p.valorEstimado ? 'do edital' : 'sigiloso') + '</small></dd></div>' +
      '<div class="lc-fact"><dt>Valor cotado</dt><dd class="num">' + (cot ? brl(cot.valor) : '—') + '<small>' + (cot ? 'em ' + d(cot.data) + ' por ' + esc(cot.autor) : 'sem cotação') + '</small></dd></div>' +
      '<div class="lc-fact"><dt>Responsável</dt><dd>' + esc(p.responsavel || '—') + '<small>salvo em ' + d(p.eventos[0].data) + '</small></dd></div>' +
      '</dl></header>';
  }
  function ultimoValor(p) { var r = null; p.eventos.forEach(function (e) { if (/^cotacao_/.test(e.tipo)) r = e; }); return r; }

  /* ---------- faixa de situação ---------- */
  function faixa(p) {
    var x = p.desfecho, cls, tag, tit, txt, when, icon;
    if (!x) {
      var et = ETAPAS[idx(p.etapa)].nome, primeiro = evsDe(p, p.etapa)[0], u = p.eventos[p.eventos.length - 1];
      cls = 'andamento'; icon = 'arrow'; tag = 'Em andamento'; tit = et + ' em andamento';
      txt = 'Última ação: ' + esc(u.texto.toLowerCase()) + ' por ' + esc(u.autor) + ' em ' + d(u.data) + ', ' + h(u.data) + '.';
      var n = dias(p.hoje, p.prazo);
      if (n <= 3) txt += '<br><span class="lc-aviso">' + ico('alert', 14) + ' Prazo da proposta ' + (n <= 0 ? 'hoje' : 'em ' + n + ' dias') + ' — ' + dAno(p.prazo) + ', ' + h(p.prazo) + '. Ainda não há proposta.</span>';
      when = '<b>' + et + '</b>desde ' + d(primeiro.data);
    } else {
      var D = DESFECHOS[x.tipo]; cls = D.fam; icon = D.ico;
      tag = x.tipo === 'concluido' ? 'Concluído' : 'Encerrada';
      tit = x.tipo === 'concluido' ? 'Empenhado e entregue' : D.nome;
      txt = x.porque; var n2 = dias(x.data, p.hoje);
      when = '<b>' + dAno(x.data) + '</b>' + (n2 === 0 ? 'hoje' : 'há ' + n2 + (n2 === 1 ? ' dia' : ' dias'));
    }
    return '<section class="lc-faixa lc-faixa--' + cls + '" role="status"><div class="lc-faixa-ico">' + ico(icon, 18) + '</div>' +
      '<div class="lc-faixa-txt"><div class="lc-faixa-tag">' + tag + (x && x.tipo !== 'concluido' ? ' · parou em ' + ETAPAS[idx(p.etapa)].nome : '') + '</div><h3>' + tit + '</h3><p>' + txt + '</p></div>' +
      '<div class="lc-faixa-when">' + when + '</div></section>';
  }

  /* ---------- etapas do ciclo ---------- */
  function ciclo(p) {
    var at = idx(p.etapa), x = p.desfecho, D = x && DESFECHOS[x.tipo];
    return '<ol class="lc-ciclo" aria-label="Ciclo de licitação">' + ETAPAS.map(function (E, i) {
      var evs = evsDe(p, E.id), c = '', dot = '', sub = '', label = '';
      if (i < at) {
        if (evs.length) { c = 'is-done'; dot = ico('check', 14); sub = d(evs[0].data); label = 'concluída'; }
        else { c = 'is-done is-skip'; sub = 'sem registro'; label = 'pulada'; }
      } else if (i === at) {
        if (!x) { c = 'is-current'; sub = 'atual · desde ' + d(evs[0].data); label = 'atual'; }
        else { c = 'is-stop f-' + D.fam; dot = ico(D.ico, 14); sub = D.curto + ' · ' + d(x.data); label = D.nome; }
      } else {
        c = 'is-after'; label = 'não alcançada';
        if (!x && i === at + 1 && E.id === 'proposta') sub = 'prazo ' + d(p.prazo);
        else sub = x ? 'não alcançada' : '';
      }
      return '<li class="lc-step ' + c + '" aria-label="' + E.nome + ': ' + label + '"><span class="lc-dot">' + dot + '</span>' +
        '<div class="lc-step-name">' + E.nome + '</div><div class="lc-step-sub">' + (sub || '&nbsp;') + '</div></li>';
    }).join('') + '</ol>';
  }

  /* ---------- linha do tempo ---------- */
  function evento(e) {
    var sys = !e.autor;
    var val = e.valor != null ? '<div class="lc-ev-val num">' + brl(e.valor) + (e.valorNota ? '<small>' + esc(e.valorNota) + '</small>' : '') + '</div>' : '<div></div>';
    return '<div class="lc-ev' + (sys ? ' lc-ev--sys' : '') + '">' +
      (sys ? '<span class="lc-av lc-av--sys" title="Sistema">' + ico('gear', 14) + '</span>' : '<span class="lc-av" title="' + esc(e.autor) + '">' + ini(e.autor) + '</span>') +
      '<div class="lc-ev-txt"><span class="t">' + esc(e.texto) + (sys ? '<span class="lc-tag-sys">sistema</span>' : '') + '</span>' +
      '<span class="m">' + d(e.data) + ' · ' + h(e.data) + (sys ? '' : ' · ' + esc(e.autor)) + (e.nota ? ' · ' + esc(e.nota) : '') + '</span></div>' + val + '</div>';
  }
  function spark(vals) {
    var w = 96, hgt = 28, mn = Math.min.apply(0, vals), mx = Math.max.apply(0, vals), pts = vals.map(function (v, i) {
      return [(i / (vals.length - 1)) * (w - 4) + 2, hgt - 3 - ((v - mn) / (mx - mn || 1)) * (hgt - 6)];
    });
    var last = pts[pts.length - 1];
    return '<svg class="lc-spark" viewBox="0 0 ' + w + ' ' + hgt + '" aria-hidden="true"><path d="M' + pts.map(function (p) { return p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join('L') + '"/><circle cx="' + last[0] + '" cy="' + last[1] + '" r="2.5"/></svg>';
  }
  function grupo(run, aberto) {
    var autores = []; run.forEach(function (e) { if (autores.indexOf(e.autor) < 0) autores.push(e.autor); });
    var porDia = {}, ordem = [];
    run.forEach(function (e) { var k = e.data.slice(0, 10); if (!porDia[k]) { porDia[k] = []; ordem.push(k); } porDia[k].push(e); });
    var rows = ordem.map(function (k) {
      var es = porDia[k], au = []; es.forEach(function (e) { if (au.indexOf(e.autor) < 0) au.push(e.autor); });
      return '<tr><td>' + d(k) + '</td><td>' + es.length + '×</td><td>' + au.map(esc).join(', ') + '</td><td class="num">' + brl(es[es.length - 1].valor) + '</td></tr>';
    }).join('');
    return '<details class="lc-grp"' + (aberto ? ' open' : '') + '><summary><span class="lc-grp-chev">' + ico('chev', 16) + '</span>' +
      '<span class="lc-grp-txt"><b>' + run.length + ' atualizações intermediárias</b><span class="m">' + d(run[0].data) + ' – ' + d(run[run.length - 1].data) + ' · em ' + ordem.length + ' dias · ' + autores.map(esc).join(', ') + '</span></span>' +
      spark(run.map(function (e) { return e.valor; })) +
      '<span class="num" style="white-space:nowrap">' + brl(run[0].valor) + ' → ' + brl(run[run.length - 1].valor) + '</span></summary>' +
      '<table class="lc-grp-tbl"><thead><tr><th>Dia</th><th>Salvamentos</th><th>Por</th><th>Valor ao fim do dia</th></tr></thead><tbody>' + rows + '</tbody></table></details>';
  }
  function linhaDoTempo(p, opts) {
    opts = opts || {};
    var stages = [], by = {};
    p.eventos.forEach(function (e) { if (!by[e.etapa]) { by[e.etapa] = []; stages.push(e.etapa); } by[e.etapa].push(e); });
    var html = stages.map(function (s) {
      var evs = by[s], out = '', i = 0;
      while (i < evs.length) {
        if (evs[i].tipo === 'cotacao_atualizada') {
          var j = i; while (j < evs.length && evs[j].tipo === 'cotacao_atualizada') j++;
          var run = evs.slice(i, j);
          if (run.length >= 3) { var last = run.pop(); out += grupo(run, opts.abrirGrupo); last = Object.assign({}, last, { texto: 'Última atualização da cotação' }); out += evento(last); }
          else run.forEach(function (e) { out += evento(e); });
          i = j;
        } else { out += evento(evs[i]); i++; }
      }
      var a = evs[0].data, b = evs[evs.length - 1].data;
      return '<div class="lc-tl-stage"><div class="lc-tl-stage-head"><h4>' + ETAPAS[idx(s)].nome + '</h4><span>' + d(a) + (d(a) !== d(b) ? ' – ' + d(b) : '') + ' · ' + evs.length + (evs.length === 1 ? ' evento' : ' eventos') + '</span></div>' + out + '</div>';
    }).join('');
    var x = p.desfecho, end;
    if (x) { var D = DESFECHOS[x.tipo]; end = '<div class="lc-tl-end f-' + D.fam + '"><span class="lc-tl-end-dot">' + ico(D.ico, 14) + '</span><b>' + (x.tipo === 'concluido' ? 'Concluído' : 'Encerrada · ' + D.nome) + '</b><span class="sub">' + dAno(x.data) + (x.por ? ' · por ' + esc(x.por) : ' · registrado pelo sistema') + '</span></div>'; }
    else { var nx = ETAPAS[idx(p.etapa) + 1]; end = '<div class="lc-tl-end f-andamento"><span class="lc-tl-end-dot"></span><b>Próximo: ' + (nx ? nx.nome : '—') + '</b><span class="sub">' + (nx && nx.id === 'proposta' ? 'enviar até ' + dAno(p.prazo) + ', ' + h(p.prazo) : '') + '</span></div>'; }
    return '<div class="lc-tl">' + html + end + '</div>';
  }

  /* ---------- lateral ---------- */
  function lateral(p) {
    var out = '', cots = p.eventos.filter(function (e) { return /^cotacao_/.test(e.tipo); });
    if (p.disputa) {
      var r = p.disputa;
      if (r.posicao === 1) out += '<div class="lc-card"><h5>Resultado da disputa</h5><dl class="lc-kv">' +
        '<dt>Vencedor</dt><dd>Nós</dd><dt>Nosso lance final</dt><dd class="num">' + brl(r.nossoLance) + '</dd>' +
        '<dt>2º colocado</dt><dd>' + esc(r.segundo) + '</dd><dt>Lance do 2º</dt><dd class="num">' + brl(r.precoSegundo) + '</dd>' +
        '<dt>Participantes</dt><dd>' + r.participantes + '</dd></dl></div>';
      else out += '<div class="lc-card"><h5>Resultado da disputa</h5><dl class="lc-kv">' +
        '<dt>Vencedor</dt><dd>' + esc(r.vencedor) + '</dd><dt>Preço vencedor</dt><dd class="num">' + brl(r.precoVencedor) + '</dd>' +
        '<dt>Nosso lance final</dt><dd class="num">' + brl(r.nossoLance) + '</dd><dt>Diferença</dt><dd class="num">+' + brl(r.nossoLance - r.precoVencedor) + ' (' + ((r.nossoLance / r.precoVencedor - 1) * 100).toFixed(1).replace('.', ',') + '%)</dd>' +
        '<dt>Nossa posição</dt><dd>' + r.posicao + 'º de ' + r.participantes + '</dd></dl></div>';
    }
    if (p.empenho) {
      var em = p.empenho;
      out += '<div class="lc-card"><h5>Empenho</h5><dl class="lc-kv"><dt>Nota</dt><dd>' + esc(em.numero || '—') + '</dd><dt>Valor</dt><dd class="num">' + brl(em.valor) + '</dd>' +
        '<dt>Situação</dt><dd>' + esc(em.situacao) + '</dd>' + (em.obs ? '<dt>Motivo</dt><dd style="font-weight:400">' + esc(em.obs) + '</dd>' : '') + '</dl></div>';
    }
    if (cots.length) {
      var f = cots[cots.length - 1];
      out += '<div class="lc-card"><h5>Cotação</h5><dl class="lc-kv"><dt>Valor cotado</dt><dd class="num">' + brl(f.valor) + '</dd>' +
        (p.valorEstimado ? '<dt>Do estimado</dt><dd class="num">' + Math.round(f.valor / p.valorEstimado * 100) + '%</dd>' : '') +
        '<dt>Salvamentos</dt><dd>' + cots.length + '</dd><dt>Última edição</dt><dd>' + d(f.data) + ', ' + h(f.data) + '</dd></dl></div>';
    }
    if (p.desfecho && p.desfecho.tipo === 'descartado') {
      out += '<div class="lc-card"><h5>Descarte</h5><dl class="lc-kv"><dt>Por</dt><dd>' + esc(p.desfecho.por) + '</dd><dt>Quando</dt><dd>' + d(p.desfecho.data) + ', ' + h(p.desfecho.data) + '</dd>' +
        '<dt>Motivo</dt><dd style="font-weight:400;color:var(--ink-muted)">' + esc(p.desfecho.motivo || 'não informado') + '</dd></dl></div>';
    }
    var pes = {}, ord = []; p.eventos.forEach(function (e) { if (e.autor) { if (!pes[e.autor]) { pes[e.autor] = 0; ord.push(e.autor); } pes[e.autor]++; } });
    out += '<div class="lc-card"><h5>Pessoas</h5><ul class="lc-people">' + ord.map(function (n) { return '<li><span class="lc-av">' + ini(n) + '</span>' + esc(n) + '<small>' + pes[n] + (pes[n] === 1 ? ' ação' : ' ações') + '</small></li>'; }).join('') + '</ul></div>';
    return out;
  }

  /* ---------- rodapé ---------- */
  function rodape(p) {
    var x = p.desfecho, temCot = p.eventos.some(function (e) { return /^cotacao_/.test(e.tipo); });
    var reabrir = '<button class="lc-btn lc-btn--ghost" disabled title="Disponível em breve">' + ico('redo', 16) + ' Reabrir processo <span class="lc-soon">em breve</span></button>';
    var exp = '<button class="lc-btn">' + ico('down', 16) + ' Exportar planilha</button>';
    if (!x) return '<footer class="lc-foot"><button class="lc-btn lc-btn--danger">' + ico('trash', 16) + ' Descartar</button><span class="lc-foot-note"></span>' + exp +
      '<button class="lc-btn lc-btn--primary">' + ico('doc', 16) + ' Abrir cotação</button></footer>';
    var note = 'Somente consulta<span class="long"> — processo ' + (x.tipo === 'concluido' ? 'concluído' : 'encerrado') + (temCot ? '; a cotação abre só para leitura' : '') + '.</span>';
    return '<footer class="lc-foot"><span class="lc-foot-note">' + ico('lock', 14) + ' <span>' + note + '</span></span>' + (x.tipo === 'concluido' ? '' : reabrir) + (temCot ? exp + '<button class="lc-btn lc-btn--primary">' + ico('doc', 16) + ' Ver cotação</button>' : '<button class="lc-btn lc-btn--primary">' + ico('ext', 16) + ' Abrir edital no PNCP</button>') + '</footer>';
  }

  function modal(p, opts) {
    opts = opts || {};
    return '<div class="lc lc-modal' + (opts.estatico ? ' is-static' : '') + '" role="dialog" aria-modal="true" aria-label="' + esc(p.objeto) + '">' + cabecalho(p) +
      '<div class="lc-status">' + faixa(p) + ciclo(p) + '</div>' +
      '<div class="lc-body"><div class="lc-main"><div class="lc-sec-title">Linha do tempo</div>' + linhaDoTempo(p, opts) + '</div><aside class="lc-aside">' + lateral(p) + '</aside></div>' +
      rodape(p) + '</div>';
  }

  window.LC = { ETAPAS: ETAPAS, DESFECHOS: DESFECHOS, modal: modal, faixa: faixa, ciclo: ciclo, linhaDoTempo: linhaDoTempo, ico: ico };
})();
