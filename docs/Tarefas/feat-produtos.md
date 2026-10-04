# feat/produtos — Fabricante › Marca › Modelo

Decisões (04/10/2026):
- **O produto é o modelo.** Não há entidade "produto" acima de Fabricante › Marca › Modelo.
- **Afinidade é por fabricante:** quem vende o fabricante vende todas as marcas e modelos dele.
- **Tabela de preços por fornecedor + modelo**, com histórico; a sugestão é a mais recente.
- **Não duplicar:** fabricante único no cadastro; marca única no fabricante; modelo único na marca
  (nome comparado sem acento/caixa). Criar com nome existente devolve o existente.

- [x] App `apps/produtos`: models, API idempotente, opções para os dropdowns, preço sugerido
- [x] Cotador: oferta grava fabricante/marca/modelo (+ snapshot do nome); salvar grava afinidade e preço
- [x] Dropdown com busca e "criar" (`shared/ui/combobox`) para fornecedor, fabricante, marca e modelo
- [x] Tela Cadastros › Produtos (tabela por fabricante + modal com afinidade, marcas e modelos)
- [x] Menu raiz "Cadastros" com Empresas, Fornecedores e Produtos
- [ ] Criar fornecedor pelo dropdown já abre o cadastro com o nome digitado preenchido
