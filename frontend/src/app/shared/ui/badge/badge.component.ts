import { Component } from '@angular/core';

/**
 * Rótulo curto em pílula (UF, modalidade, situação, SRP...). Aparece várias
 * vezes por card de oportunidade — por isso é componente e não uma classe
 * `.badge` repetida em cada template.
 */
@Component({
  selector: 'app-badge',
  template: `<span class="badge"><ng-content /></span>`,
  styleUrl: './badge.component.scss',
})
export class BadgeComponent {}
