# Modal do processo — inspiração

Coloque aqui os PNGs de referência para o modal do processo (linha do tempo
da licitação). O contexto enviado ao design está abaixo.

A versão provisória do modal está em
`frontend/src/app/pages/ciclo/encerradas/processo-modal/`.

## Contexto

O Licita acompanha cada edital como um processo, que passa pelas etapas do
Ciclo de Licitação: Oportunidade → Cotação → Proposta → Disputa → Empenho.
A etapa é calculada a partir do que foi feito; o sistema avisa, nunca trava.

O modal abre ao clicar num processo em qualquer lista e responde num olhar:
**onde o processo está ou onde morreu, e por quê**.

Desfechos que o desenho precisa comportar:
- Descartado (quem e quando)
- Prazo perdido sem cotação
- Prazo perdido na cotação
- Perdido na disputa (futuro: preço vencedor, concorrente)
- Falhou no empenho
- Concluído

Eventos gravados hoje: oportunidade salva; cotação criada/atualizada (com
valor; pode ter 20+ salvamentos — agrupar); prazo encerrado (sistema);
removida da lista.

Estrutura sugerida: cabeçalho do edital → faixa de situação → etapas do
ciclo marcando onde parou → linha do tempo agrupada por etapa → ações
(ver cotação, exportar planilha, futuramente reabrir).

Estados para desenhar: em andamento (Cotação), encerrado por prazo com
cotação, descartado, perdido na disputa.
