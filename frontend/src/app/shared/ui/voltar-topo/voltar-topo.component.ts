import { Component, signal } from '@angular/core';

import { IconComponent } from '../icon/icon.component';

/** Quanto a janela precisa ter rolado (px) pro botão aparecer. Abaixo disso
 * o topo ainda está a um gesto de distância e o botão só ocuparia tela. */
const LIMITE_PX = 300;

/**
 * Botão flutuante que devolve a página ao topo. Fica em `shared/ui` e não
 * dentro de uma página porque quem rola é o documento (o shell usa
 * `min-height: 100vh`, ver `shell.component.scss`) — então qualquer tela
 * longa ganha o comportamento só colocando `<app-voltar-topo />` no fim do
 * template, sem container de scroll próprio.
 */
@Component({
  selector: 'app-voltar-topo',
  imports: [IconComponent],
  host: { '(window:scroll)': 'aoRolar()' },
  templateUrl: './voltar-topo.component.html',
  styleUrl: './voltar-topo.component.scss',
})
export class VoltarTopoComponent {
  readonly visivel = signal(false);

  constructor() {
    // O router não restaura scroll (nenhum `withInMemoryScrolling` em
    // `app.config.ts`), então dá pra entrar numa página já rolado — sem isso
    // o botão só apareceria no primeiro scroll depois de chegar.
    this.aoRolar();
  }

  aoRolar(): void {
    this.visivel.set(window.scrollY > LIMITE_PX);
  }

  subir(): void {
    // Rolagem animada incomoda quem tem sensibilidade a movimento; o sistema
    // operacional já declara isso, aqui só se obedece.
    const reduzMovimento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduzMovimento ? 'auto' : 'smooth' });
  }
}
