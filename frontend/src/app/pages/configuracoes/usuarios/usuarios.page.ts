import { Component, OnInit, inject, signal } from '@angular/core';

import { UsuarioResponse } from '../../../contracts/usuarios/usuario.contracts';
import { AuthService } from '../../../core/auth/auth.service';
import { UsuariosService } from '../../../services/usuarios/usuarios.service';
import { ModalService } from '../../../shared/overlay/modal.service';
import { ButtonComponent } from '../../../shared/ui/button/button.component';
import { DataTableComponent } from '../../../shared/ui/data-table/data-table.component';
import {
  ColunaTabela,
  EstadoTabela,
  estadoInicialTabela,
  parametroOrdenacao,
} from '../../../shared/ui/data-table/data-table.model';
import { TabelaAcoesDirective } from '../../../shared/ui/data-table/tabela-acoes.directive';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { ItemMenu, MenuComponent } from '../../../shared/ui/menu/menu.component';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { UsuarioModalComponent } from './usuario-modal/usuario-modal.component';

/** As chaves das colunas são contrato com o backend (`ORDENACOES` em
 * `apps/accounts/views_usuarios.py`). */
const COLUNAS: readonly ColunaTabela<UsuarioResponse>[] = [
  { chave: 'nome', titulo: 'Nome', valor: (u) => u.nome || '—' },
  { chave: 'email', titulo: 'E-mail', valor: (u) => u.email, umaLinha: true },
  {
    chave: 'is_superuser',
    titulo: 'Super usuário',
    valor: (u) => (u.is_superuser ? 'Sim' : 'Não'),
    umaLinha: true,
    tom: (u) => (u.is_superuser ? 'sucesso' : null),
  },
];

/**
 * "Usuários" (Configurações) — quem acessa o produto. Mesma tabela e os
 * mesmos gestos de Fornecedores: busca, ordenação e paginação no endpoint,
 * ações da linha num menu, um modal que cadastra e edita.
 */
@Component({
  selector: 'app-usuarios-page',
  imports: [
    DataTableComponent,
    TabelaAcoesDirective,
    MenuComponent,
    ButtonComponent,
    IconComponent,
  ],
  templateUrl: './usuarios.page.html',
  styleUrl: './usuarios.page.scss',
})
export class UsuariosPage implements OnInit {
  private readonly service = inject(UsuariosService);
  private readonly auth = inject(AuthService);
  private readonly modal = inject(ModalService);
  private readonly toast = inject(ToastService);

  protected readonly colunas = COLUNAS;

  protected readonly estado = signal<EstadoTabela>(
    estadoInicialTabela({ ordenarPor: 'nome', direcao: 'asc' }),
  );
  protected readonly linhas = signal<readonly UsuarioResponse[]>([]);
  protected readonly total = signal(0);
  protected readonly carregando = signal(false);
  protected readonly erro = signal(false);

  protected readonly chaveDe = (u: UsuarioResponse) => u.id;

  ngOnInit(): void {
    this.carregar();
  }

  protected aoMudarEstado(estado: EstadoTabela): void {
    this.estado.set(estado);
    this.carregar();
  }

  protected acoesDe(usuario: UsuarioResponse): readonly ItemMenu[] {
    const editar: ItemMenu = {
      rotulo: 'Editar',
      icone: 'edit',
      executar: () => this.abrirModal(usuario),
    };
    // Excluir a si mesmo derrubaria a própria sessão — o backend recusa, e
    // a tela nem oferece.
    if (this.ehEu(usuario)) return [editar];
    return [
      editar,
      { rotulo: 'Excluir', icone: 'trash', tom: 'perigo', executar: () => this.excluir(usuario) },
    ];
  }

  protected adicionar(): void {
    this.abrirModal(null);
  }

  protected excluir(usuario: UsuarioResponse): void {
    this.modal
      .confirmar({
        titulo: 'Excluir usuário',
        mensagem:
          `"${usuario.nome || usuario.email}" perde o acesso ao produto. O que ele já fez ` +
          'continua no histórico com o nome dele. Esta ação não poderá ser desfeita. ' +
          'Deseja continuar?',
        confirmarLabel: 'Excluir',
        variantConfirmar: 'danger',
      })
      .subscribe((confirmou) => {
        if (!confirmou) return;

        this.service.remover(usuario.id).subscribe({
          next: () => {
            this.toast.sucesso('Usuário excluído.');
            this.voltarPaginaSeEsvaziou();
            this.carregar();
          },
          error: () => this.toast.erro('Não foi possível excluir o usuário agora.'),
        });
      });
  }

  private ehEu(usuario: UsuarioResponse): boolean {
    return this.auth.usuario()?.user_id === usuario.id;
  }

  private abrirModal(usuario: UsuarioResponse | null): void {
    const dados = { usuario, ehEu: usuario ? this.ehEu(usuario) : false };
    this.modal
      .abrir<UsuarioResponse, typeof dados>(UsuarioModalComponent, dados)
      .subscribe((salvo) => {
        if (!salvo) return;
        this.toast.sucesso(usuario ? 'Usuário atualizado.' : `"${salvo.nome}" pode entrar.`);
        this.carregar();
      });
  }

  private carregar(): void {
    const estado = this.estado();
    this.carregando.set(true);
    this.erro.set(false);

    this.service
      .listar({
        page: estado.pagina,
        page_size: estado.tamanhoPagina,
        ordering: parametroOrdenacao(estado),
        busca: estado.busca,
      })
      .subscribe({
        next: (pagina) => {
          this.linhas.set(pagina.results);
          this.total.set(pagina.count);
          this.carregando.set(false);
        },
        error: () => {
          this.carregando.set(false);
          this.erro.set(true);
          this.linhas.set([]);
          this.total.set(0);
        },
      });
  }

  /** Excluir o último item de uma página deixaria a tabela vazia com um
   * paginador dizendo que há mais — volta uma página antes de recarregar. */
  private voltarPaginaSeEsvaziou(): void {
    const estado = this.estado();
    if (this.linhas().length === 1 && estado.pagina > 1) {
      this.estado.set({ ...estado, pagina: estado.pagina - 1 });
    }
  }
}
