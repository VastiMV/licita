# feat/usuario — quem acessa o produto

Configurações → Usuários, no mesmo formato dos outros cadastros: tabela com
busca e "Adicionar usuário" no topo, um modal que cadastra e edita.

O cadastro é só **nome** (o nome visual, que aparece no histórico), **e-mail**,
**senha** e **super usuário ou não**. Super usuário é o único papel: é quem vê
Configurações (o armazenamento e esta tela). Quem já era `is_staff` virou super
usuário na migração, para ninguém perder o acesso que tinha.

**Decidido:** excluir é exclusão de verdade, e o histórico não depende do
usuário existir. Todo campo que aponta para o usuário (`salva_por`, `autor`,
`criado_por`…) ganhou um irmão `<campo>_nome`, preenchido sozinho a cada
gravação (`apps/accounts/autoria.py`). Excluído o usuário, a FK vira nulo e o
nome fica.

## Tarefas

- [x] **1. Super usuário como a permissão de Configurações**
  `EhSuperusuario` em `apps/accounts/permissions.py`, no lugar do
  `IsAdminUser` do armazenamento. A claim do token passa de `is_staff` para
  `is_superuser`, e o menu lê dela.
  *Teste:* quem não é super usuário (inclusive `is_staff` sem super) recebe 403.

- [x] **2. API de usuários**
  `GET/POST /api/usuarios/`, `GET/PUT/DELETE /api/usuarios/<id>/`. Senha
  obrigatória só ao cadastrar (em branco na edição mantém a atual), passa
  pelos validadores de senha do Django e nunca volta na resposta. E-mail único
  sem diferenciar maiúscula. Ninguém tira de si o super usuário nem exclui a si
  mesmo.
  *Teste:* `apps/accounts/test_usuarios.py`.

- [x] **3. O nome de quem fez fica no registro**
  Campos `_nome` em documentos, oportunidades salvas e eventos, cotações,
  empresas, fornecedores e configuração de armazenamento, preenchidos para os
  registros antigos na migração. As telas de histórico leem o nome gravado.
  *Teste:* excluir o autor de um fornecedor mantém `criado_por_nome`.

- [x] **4. Tela de Usuários**
  `pages/configuracoes/usuarios`, com o modal. Na própria linha não há
  "Excluir", e o super usuário vem travado no modal.
