import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { AlertaResponse } from '../../contracts/alertas/alerta.contracts';
import { AlertasService } from '../../services/alertas/alertas.service';

@Component({
  selector: 'app-alertas-page',
  imports: [DatePipe, RouterLink],
  templateUrl: './alertas.page.html',
  styleUrl: './alertas.page.scss',
})
export class AlertasPage implements OnInit {
  private readonly alertasService = inject(AlertasService);

  protected readonly alertas = signal<AlertaResponse[]>([]);
  protected readonly carregando = signal(true);

  ngOnInit(): void {
    this.alertasService.listar().subscribe({
      next: (alertas) => {
        this.alertas.set(alertas);
        this.carregando.set(false);
      },
      error: () => this.carregando.set(false),
    });
  }
}
