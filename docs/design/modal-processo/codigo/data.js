/* Exemplos para as prévias. Fazenda Rio Grande = caso real do briefing; os demais campos/casos são ilustrativos. */
(function () {
  var ANA = 'Ana Souza', BRUNO = 'Bruno Lima';
  // 1 criação + 22 atualizações (31/08 → 13/09)
  var saves = [
    ['2026-08-31T10:58', 4923.97, ANA, 'cotacao_criada'],
    ['2026-08-31T15:20', 18410.50, ANA], ['2026-08-31T17:44', 31877.12, ANA],
    ['2026-09-01T09:31', 52300.00, ANA], ['2026-09-01T14:05', 66912.40, BRUNO],
    ['2026-09-02T10:12', 88140.75, BRUNO], ['2026-09-02T16:48', 97355.10, ANA],
    ['2026-09-03T11:03', 121480.00, ANA], ['2026-09-04T09:47', 140215.66, ANA], ['2026-09-04T18:10', 152990.31, BRUNO],
    ['2026-09-08T10:22', 171402.80, ANA], ['2026-09-08T15:37', 189733.05, ANA],
    ['2026-09-09T09:15', 214860.90, BRUNO], ['2026-09-09T17:02', 228114.47, ANA],
    ['2026-09-10T11:40', 251390.00, ANA], ['2026-09-10T16:55', 263018.25, ANA],
    ['2026-09-11T10:08', 279644.12, BRUNO], ['2026-09-11T14:30', 298114.50, ANA],
    ['2026-09-12T10:21', 309870.00, ANA],
    ['2026-09-13T09:44', 322415.38, ANA], ['2026-09-13T11:26', 334902.61, BRUNO], ['2026-09-13T16:03', 342777.90, ANA], ['2026-09-13T18:41', 351296.23, ANA]
  ];
  function cot(list) { return list.map(function (s) { return { tipo: s[3] || 'cotacao_atualizada', etapa: 'cotacao', texto: s[3] ? 'Cotação criada' : 'Cotação atualizada', autor: s[2], data: s[0], valor: s[1] }; }); }
  var base = {
    objeto: 'Registro de preços para aquisição de equipamentos médico-hospitalares para as unidades de saúde do município',
    orgao: 'Prefeitura Municipal de Fazenda Rio Grande', uasg: '987412', cidade: 'Fazenda Rio Grande', uf: 'PR',
    modalidade: 'Pregão Eletrônico', numero: 'nº 45/2026', plataforma: 'Compras.gov.br', prazo: '2026-09-14T09:00',
    valorEstimado: 389740.00, responsavel: ANA, etapa: 'cotacao'
  };
  var salva = { tipo: 'oportunidade_salva', etapa: 'oportunidade', texto: 'Oportunidade salva', autor: ANA, data: '2026-08-31T09:14' };

  var andamento = Object.assign({}, base, { hoje: '2026-09-12T11:00', desfecho: null,
    eventos: [salva].concat(cot(saves.slice(0, 19))) });

  var prazoCotacao = Object.assign({}, base, { hoje: '2026-10-04T10:00',
    eventos: [salva].concat(cot(saves), [{ tipo: 'prazo_encerrado', etapa: 'cotacao', texto: 'Prazo de proposta encerrado sem proposta', autor: null, data: '2026-09-14T09:00' }]),
    desfecho: { tipo: 'prazo_cotacao', data: '2026-09-14T09:00',
      porque: 'A cotação estava pronta (R$ 351.296,23, última edição em 13/09 por Ana Souza), mas nenhuma proposta foi registrada até o prazo de 14/09, 09:00.' } });

  var descartado = { objeto: 'Aquisição de gêneros alimentícios para a merenda escolar da rede municipal de ensino',
    orgao: 'Prefeitura Municipal de Campo Largo', uasg: '987331', cidade: 'Campo Largo', uf: 'PR', modalidade: 'Pregão Eletrônico', numero: 'nº 112/2026',
    plataforma: 'BLL Compras', prazo: '2026-09-18T09:00', valorEstimado: 612380.00, responsavel: BRUNO, etapa: 'oportunidade', hoje: '2026-10-04T10:00',
    eventos: [
      { tipo: 'oportunidade_salva', etapa: 'oportunidade', texto: 'Oportunidade salva', autor: BRUNO, data: '2026-09-02T08:51' },
      { tipo: 'removida', etapa: 'oportunidade', texto: 'Removida da lista de Salvas', autor: ANA, data: '2026-09-03T14:12' }
    ],
    desfecho: { tipo: 'descartado', data: '2026-09-03T14:12', por: ANA, motivo: null,
      porque: 'Ana Souza tirou o processo da lista em 03/09, às 14:12, ainda em Oportunidade. Nenhuma cotação foi feita.' } };

  var disputa = { objeto: 'Aquisição de material de consumo odontológico para os centros de especialidades',
    orgao: 'Consórcio Intermunicipal de Saúde do Vale do Iguaçu', uasg: '926540', cidade: 'União da Vitória', uf: 'PR', modalidade: 'Pregão Eletrônico', numero: 'nº 31/2026',
    plataforma: 'Compras.gov.br', prazo: '2026-08-18T08:00', valorEstimado: 134900.00, responsavel: BRUNO, etapa: 'disputa', hoje: '2026-10-04T10:00',
    eventos: [
      { tipo: 'oportunidade_salva', etapa: 'oportunidade', texto: 'Oportunidade salva', autor: BRUNO, data: '2026-08-03T16:20' },
      { tipo: 'cotacao_criada', etapa: 'cotacao', texto: 'Cotação criada', autor: BRUNO, data: '2026-08-04T09:02', valor: 41220.00 },
      { tipo: 'cotacao_atualizada', etapa: 'cotacao', texto: 'Cotação atualizada', autor: BRUNO, data: '2026-08-05T14:40', valor: 88310.00 },
      { tipo: 'cotacao_atualizada', etapa: 'cotacao', texto: 'Cotação atualizada', autor: ANA, data: '2026-08-06T10:15', valor: 119700.00 },
      { tipo: 'cotacao_atualizada', etapa: 'cotacao', texto: 'Cotação atualizada', autor: BRUNO, data: '2026-08-07T17:30', valor: 127950.00 },
      { tipo: 'cotacao_atualizada', etapa: 'cotacao', texto: 'Cotação atualizada', autor: BRUNO, data: '2026-08-10T11:05', valor: 128400.00 },
      { tipo: 'proposta_enviada', etapa: 'proposta', texto: 'Proposta enviada na plataforma', autor: BRUNO, data: '2026-08-11T15:22', valor: 128400.00 },
      { tipo: 'sessao_aberta', etapa: 'disputa', texto: 'Sessão pública aberta', autor: null, data: '2026-08-18T09:00' },
      { tipo: 'lance', etapa: 'disputa', texto: 'Lance final registrado', autor: BRUNO, data: '2026-08-18T09:47', valor: 119850.00, valorNota: '9 lances' },
      { tipo: 'resultado', etapa: 'disputa', texto: 'Item arrematado por Odontomed Distribuidora Ltda', autor: null, data: '2026-08-18T10:05', valor: 116230.00, valorNota: 'preço vencedor' }
    ],
    disputa: { vencedor: 'Odontomed Distribuidora Ltda', precoVencedor: 116230.00, nossoLance: 119850.00, posicao: 2, participantes: 7 },
    desfecho: { tipo: 'perdido_disputa', data: '2026-08-18T10:05',
      porque: 'Terminamos em 2º de 7. Odontomed Distribuidora Ltda venceu com R$ 116.230,00 — R$ 3.620,00 (3,1%) abaixo do nosso lance final.' } };

  var semCotacao = { objeto: 'Contratação de serviços contínuos de manutenção predial preventiva e corretiva',
    orgao: 'Prefeitura Municipal de Araucária', uasg: '987205', cidade: 'Araucária', uf: 'PR', modalidade: 'Pregão Eletrônico', numero: 'nº 78/2026',
    plataforma: 'Compras.gov.br', prazo: '2026-08-28T09:00', valorEstimado: 248600.00, responsavel: BRUNO, etapa: 'oportunidade', hoje: '2026-10-04T10:00',
    eventos: [
      { tipo: 'oportunidade_salva', etapa: 'oportunidade', texto: 'Oportunidade salva', autor: BRUNO, data: '2026-08-20T11:37' },
      { tipo: 'prazo_encerrado', etapa: 'oportunidade', texto: 'Prazo de proposta encerrado sem cotação', autor: null, data: '2026-08-28T09:00' }
    ],
    desfecho: { tipo: 'prazo_sem_cotacao', data: '2026-08-28T09:00',
      porque: 'Salva por Bruno Lima em 20/08, mas nenhuma cotação foi criada nos 8 dias até o prazo da proposta (28/08, 09:00).' } };

  function trilha(cot0, cot1, prop, lance, d) {
    return [
      { tipo: 'oportunidade_salva', etapa: 'oportunidade', texto: 'Oportunidade salva', autor: ANA, data: d[0] },
      { tipo: 'cotacao_criada', etapa: 'cotacao', texto: 'Cotação criada', autor: ANA, data: d[1], valor: cot0 },
      { tipo: 'cotacao_atualizada', etapa: 'cotacao', texto: 'Cotação atualizada', autor: BRUNO, data: d[2], valor: (cot0 + cot1) / 2 },
      { tipo: 'cotacao_atualizada', etapa: 'cotacao', texto: 'Cotação atualizada', autor: ANA, data: d[3], valor: cot1 * 0.97 },
      { tipo: 'cotacao_atualizada', etapa: 'cotacao', texto: 'Cotação atualizada', autor: ANA, data: d[4], valor: cot1 },
      { tipo: 'proposta_enviada', etapa: 'proposta', texto: 'Proposta enviada na plataforma', autor: ANA, data: d[5], valor: prop },
      { tipo: 'sessao_aberta', etapa: 'disputa', texto: 'Sessão pública aberta', autor: null, data: d[6] },
      { tipo: 'lance', etapa: 'disputa', texto: 'Lance final registrado', autor: ANA, data: d[7], valor: lance, valorNota: '6 lances' },
      { tipo: 'resultado', etapa: 'disputa', texto: 'Item arrematado pela nossa empresa', autor: null, data: d[8], valor: lance, valorNota: 'preço vencedor' }
    ];
  }
  var empenhoFalhou = { objeto: 'Aquisição de mobiliário escolar (conjuntos aluno e mesas de professor) para a rede estadual',
    orgao: 'Secretaria de Estado da Educação do Paraná', uasg: '925011', cidade: 'Curitiba', uf: 'PR', modalidade: 'Pregão Eletrônico', numero: 'nº 204/2026',
    plataforma: 'Compras.gov.br', prazo: '2026-09-08T09:00', valorEstimado: 398000.00, responsavel: ANA, etapa: 'empenho', hoje: '2026-10-04T10:00',
    eventos: trilha(96400, 352300, 352300, 342100, ['2026-08-24T10:02','2026-08-25T09:15','2026-08-27T16:40','2026-09-02T11:05','2026-09-03T17:20','2026-09-04T14:48','2026-09-08T09:00','2026-09-08T09:52','2026-09-08T10:30']).concat([
      { tipo: 'homologado', etapa: 'empenho', texto: 'Resultado homologado pelo órgão', autor: null, data: '2026-09-15T16:10' },
      { tipo: 'empenho_cancelado', etapa: 'empenho', texto: 'Nota de empenho cancelada pelo órgão', autor: null, data: '2026-09-30T16:00', nota: 'dotação orçamentária insuficiente' }
    ]),
    disputa: { posicao: 1, nossoLance: 342100, segundo: 'Escolar Sul Móveis Ltda', precoSegundo: 349800, participantes: 9 },
    empenho: { numero: '2026NE001342', valor: 342100, situacao: 'Cancelado em 30/09', obs: 'Dotação orçamentária insuficiente' },
    desfecho: { tipo: 'falhou_empenho', data: '2026-09-30T16:00',
      porque: 'Vencemos a disputa com R$ 342.100,00 e o resultado foi homologado em 15/09, mas o órgão cancelou a nota de empenho em 30/09 por dotação orçamentária insuficiente.' } };

  var concluido = { objeto: 'Aquisição de insumos e reagentes para o laboratório de análises clínicas',
    orgao: 'Hospital Municipal de São José dos Pinhais', uasg: '987560', cidade: 'São José dos Pinhais', uf: 'PR', modalidade: 'Pregão Eletrônico', numero: 'nº 52/2026',
    plataforma: 'BLL Compras', prazo: '2026-08-14T09:00', valorEstimado: 187500.00, responsavel: ANA, etapa: 'empenho', hoje: '2026-10-04T10:00',
    eventos: trilha(38200, 171900, 171900, 164750, ['2026-07-30T08:40','2026-07-31T10:10','2026-08-04T15:00','2026-08-10T11:30','2026-08-11T18:05','2026-08-12T10:20','2026-08-14T09:00','2026-08-14T09:41','2026-08-14T10:12']).concat([
      { tipo: 'empenho_emitido', etapa: 'empenho', texto: 'Nota de empenho 2026NE000871 registrada', autor: BRUNO, data: '2026-08-22T14:30', valor: 164750 },
      { tipo: 'entrega', etapa: 'empenho', texto: 'Entrega confirmada pelo órgão', autor: ANA, data: '2026-09-05T11:30', nota: 'nota fiscal 18.442' }
    ]),
    disputa: { posicao: 1, nossoLance: 164750, segundo: 'LabMais Diagnósticos Ltda', precoSegundo: 167200, participantes: 6 },
    empenho: { numero: '2026NE000871', valor: 164750, situacao: 'Entregue em 05/09' },
    desfecho: { tipo: 'concluido', data: '2026-09-05T11:30', por: ANA,
      porque: 'Vencemos a disputa com R$ 164.750,00 (5,8% abaixo da proposta), o empenho saiu em 22/08 e a entrega foi confirmada em 05/09.' } };

  var desclassificada = { objeto: 'Aquisição de notebooks e monitores para os gabinetes e setores administrativos',
    orgao: 'Câmara Municipal de Londrina', uasg: '987620', cidade: 'Londrina', uf: 'PR', modalidade: 'Pregão Eletrônico', numero: 'nº 19/2026',
    plataforma: 'Compras.gov.br', prazo: '2026-09-22T09:00', valorEstimado: 286400.00, responsavel: BRUNO, etapa: 'proposta', hoje: '2026-10-04T10:00',
    eventos: [
      { tipo: 'oportunidade_salva', etapa: 'oportunidade', texto: 'Oportunidade salva', autor: BRUNO, data: '2026-09-08T09:25' },
      { tipo: 'cotacao_criada', etapa: 'cotacao', texto: 'Cotação criada', autor: BRUNO, data: '2026-09-09T10:40', valor: 61200.00 },
      { tipo: 'cotacao_atualizada', etapa: 'cotacao', texto: 'Cotação atualizada', autor: ANA, data: '2026-09-11T15:12', valor: 189450.00 },
      { tipo: 'cotacao_atualizada', etapa: 'cotacao', texto: 'Cotação atualizada', autor: BRUNO, data: '2026-09-15T11:03', valor: 251300.00 },
      { tipo: 'cotacao_atualizada', etapa: 'cotacao', texto: 'Cotação atualizada', autor: BRUNO, data: '2026-09-17T17:48', valor: 263980.00 },
      { tipo: 'proposta_enviada', etapa: 'proposta', texto: 'Proposta enviada na plataforma', autor: BRUNO, data: '2026-09-19T14:05', valor: 263980.00 },
      { tipo: 'desclassificada', etapa: 'proposta', texto: 'Proposta desclassificada pelo pregoeiro', autor: null, data: '2026-09-22T10:40', nota: 'catálogo técnico do monitor não anexado' }
    ],
    desfecho: { tipo: 'desclassificada', data: '2026-09-22T10:40',
      porque: 'A proposta (R$ 263.980,00) foi enviada no prazo, mas o pregoeiro a desclassificou em 22/09, antes da disputa: faltou o catálogo técnico do monitor exigido no item 7.3 do edital.' } };

  window.LC_DATA = { andamento: andamento, prazoCotacao: prazoCotacao, descartado: descartado, disputa: disputa, semCotacao: semCotacao, empenhoFalhou: empenhoFalhou, concluido: concluido, desclassificada: desclassificada };
})();
