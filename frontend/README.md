# Frontend

Angular 22 (standalone, zoneless), consumidor da API Django/DRF em
`docs/ARQUITETURA.md` (raiz do repositório). Ver [`docs/ARQUITETURA.md`](../docs/ARQUITETURA.md)
para o desenho geral e [`docs/DOMINIO.md`](../docs/DOMINIO.md) para o domínio
de negócio.

## Rodando localmente

```bash
npm install
npm start        # ng serve — http://localhost:4200, com proxy de /api para o backend local (proxy.conf.json)
npm test         # ng test — Vitest, roda uma vez (sem watch em CI; watch é o padrão local)
npm run build    # ng build — build de produção em dist/frontend
```

`proxy.conf.json` encaminha `/api` para `http://localhost:8000` (backend
Django local). Ajuste o `target` se o backend rodar em outra porta.

## Estrutura

```
src/
  styles/               tokens de design (cor, tipografia, espaçamento) e mixins SCSS
  app/
    core/
      api/               ApiClient (wrapper único do HttpClient) e ENDPOINTS (rotas centralizadas)
      auth/               AuthService, authInterceptor, authGuard — ver "Autenticação" em docs/ARQUITETURA.md
    contracts/            interfaces *Request/*Response por domínio — o formato exato da API
    services/             um serviço por domínio, só fala com a API via ApiClient + contracts
    shared/
      ui/                 átomos reutilizáveis: input-text, select, checkbox, button, badge
      overlay/             modal-shell + aviso-modal + question-modal, abertos via ModalService
    layout/shell/          topbar + router-outlet + rodapé (identidade Inside Solutions)
    pages/                 uma pasta por tela, monta átomos/modais/serviços — não redeclara nada deles
```

**Regra de organização:** um único componente por tipo de controle/modal —
nenhuma página escreve seu próprio `<input>`, `<select>` ou diálogo. Estilo
segue a mesma lógica: tokens em `src/styles/`, cada átomo consome os tokens
via CSS custom properties/mixins, nunca redeclara uma cor ou espaçamento.

## Testes

Todo componente/serviço reutilizável tem `*.spec.ts` ao lado do arquivo
(Vitest, builder nativo do Angular CLI — `unit-test`/`ng test`). Ver
"Estratégia de testes" em `docs/ARQUITETURA.md`: teste vem antes do código.

**Nota para quem escrever novos testes:** o app é zoneless (sem `zone.js`).
Mutar um campo comum de um componente de teste (`host.valor = 'x'`) **não**
notifica o Angular para re-renderizar — use `signal()` para qualquer estado
de teste que precise refletir no DOM após um `fixture.detectChanges()`
subsequente. E quando o valor passa por `NgModel` (`[ngModel]`/`[(ngModel)]`),
o `writeValue` do `ControlValueAccessor` é aplicado num microtask — depois de
mudar o signal e chamar `detectChanges()`, dê `await fixture.whenStable()`
antes de checar o DOM. Exemplos: `shared/ui/input-text/input-text.component.spec.ts`,
`shared/ui/select/select.component.spec.ts`.
