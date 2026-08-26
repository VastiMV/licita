import { Component, ElementRef, HostListener, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';
import { IconComponent } from '../../shared/ui/icon/icon.component';

/**
 * Substitui os links horizontais de conta na topbar por um único gatilho
 * (ícone de usuário) que abre um dropdown com nome/e-mail e as ações de
 * conta — hoje só "Sair"; "Editar perfil" ainda não tem rota (não existe
 * endpoint de perfil no backend, ver `docs/ARQUITETURA.md`), então fica
 * visível mas desabilitado.
 *
 * Fecha sozinho ao clicar fora ou apertar Esc — não usa o `ModalService`/
 * `@angular/cdk/dialog` de propósito: aquilo é pra diálogo modal centrado
 * com backdrop bloqueante; isso aqui é um dropdown ancorado no próprio
 * botão, não trava a página.
 */
@Component({
  selector: 'app-profile-menu',
  imports: [IconComponent],
  templateUrl: './profile-menu.component.html',
  styleUrl: './profile-menu.component.scss',
})
export class ProfileMenuComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly elementRef = inject(ElementRef<HTMLElement>);

  protected readonly aberto = signal(false);
  protected readonly usuario = this.auth.usuario;

  @HostListener('document:click', ['$event'])
  protected fecharAoClicarFora(evento: MouseEvent): void {
    if (this.aberto() && !this.elementRef.nativeElement.contains(evento.target as Node)) {
      this.aberto.set(false);
    }
  }

  @HostListener('document:keydown.escape')
  protected fecharComEsc(): void {
    this.aberto.set(false);
  }

  protected alternar(): void {
    this.aberto.update((valor) => !valor);
  }

  protected sair(): void {
    this.aberto.set(false);
    this.auth.logout().subscribe(() => this.router.navigateByUrl('/login'));
  }
}
