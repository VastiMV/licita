import { ConnectedPosition, OverlayModule, createCloseScrollStrategy } from '@angular/cdk/overlay';
import { Component, Injector, inject, input, signal } from '@angular/core';

import { IconComponent, IconName } from '../icon/icon.component';

/** Uma opção do menu. `executar` é o que a página faz — o menu não conhece
 * ação nenhuma, só desenha e chama. */
export interface ItemMenu {
  readonly rotulo: string;
  readonly icone?: IconName;
  /** `perigo` pinta a opção destrutiva (excluir) de vermelho no hover. */
  readonly tom?: 'normal' | 'perigo';
  readonly desabilitado?: boolean;
  readonly executar: () => void;
}

/** Abre para baixo alinhado à direita do gatilho; se não couber embaixo
 * (última linha da tabela, perto do rodapé), abre para cima. */
const POSICOES: ConnectedPosition[] = [
  { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 4 },
  { originX: 'end', originY: 'top', overlayX: 'end', overlayY: 'bottom', offsetY: -4 },
];

/**
 * Botão que abre um menu de opções — usado para não gastar largura com uma
 * fileira de botões (é o que mantém a tabela de oportunidades salvas dentro
 * da tela num monitor médio, sem rolagem horizontal).
 *
 * O painel é montado num overlay do CDK, não em `position: absolute` como o
 * `ProfileMenuComponent`: dentro de uma tabela com rolagem horizontal, um
 * painel absoluto seria recortado pelo container. O overlay também reposiciona
 * sozinho quando não há espaço embaixo e fecha ao rolar a página.
 *
 * As opções vêm por `[itens]` em vez de conteúdo projetado porque o visual
 * de uma opção é do menu, não de quem o usa — assim todo menu do projeto se
 * parece.
 */
@Component({
  selector: 'app-menu',
  imports: [OverlayModule, IconComponent],
  templateUrl: './menu.component.html',
  styleUrl: './menu.component.scss',
})
export class MenuComponent {
  readonly rotulo = input('Ações');
  readonly itens = input.required<readonly ItemMenu[]>();
  /** Diferencia um menu do outro para leitor de tela (numa tabela há um por
   * linha) — ex.: "Ações de Prefeitura de Campinas". */
  readonly descricao = input('');

  protected readonly aberto = signal(false);
  protected readonly posicoes = POSICOES;
  protected readonly scrollStrategy = createCloseScrollStrategy(inject(Injector));

  protected alternar(): void {
    this.aberto.update((valor) => !valor);
  }

  protected fechar(): void {
    this.aberto.set(false);
  }

  protected executar(item: ItemMenu): void {
    if (item.desabilitado) return;
    this.fechar();
    item.executar();
  }

  protected aoTeclar(evento: KeyboardEvent): void {
    if (evento.key === 'Escape') this.fechar();
  }
}
