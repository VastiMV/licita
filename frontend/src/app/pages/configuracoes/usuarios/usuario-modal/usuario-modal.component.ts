import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { UsuarioRequest, UsuarioResponse } from '../../../../contracts/usuarios/usuario.contracts';
import { UsuariosService } from '../../../../services/usuarios/usuarios.service';
import { ModalShellComponent } from '../../../../shared/overlay/modal-shell/modal-shell.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { CheckboxComponent } from '../../../../shared/ui/checkbox/checkbox.component';
import { InputTextComponent } from '../../../../shared/ui/input-text/input-text.component';

/** Campos que o backend pode recusar — viram erro embaixo do campo. */
const CAMPOS = ['nome', 'email', 'senha', 'is_superuser'] as const;

export interface UsuarioModalDados {
  /** `null` = cadastrar; um registro = editar. */
  readonly usuario: UsuarioResponse | null;
  /** O próprio usuário logado: não pode tirar de si o super usuário. */
  readonly ehEu: boolean;
}

/**
 * Cadastra **e** edita um usuário: nome, e-mail, senha e super usuário ou
 * não. Senha obrigatória só ao cadastrar — ao editar, em branco mantém a
 * atual.
 */
@Component({
  selector: 'app-usuario-modal',
  imports: [
    ReactiveFormsModule,
    ModalShellComponent,
    ButtonComponent,
    InputTextComponent,
    CheckboxComponent,
  ],
  templateUrl: './usuario-modal.component.html',
  styleUrl: './usuario-modal.component.scss',
})
export class UsuarioModalComponent {
  private readonly dialogRef = inject(DialogRef<UsuarioResponse>);
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(UsuariosService);

  private readonly dados = inject<UsuarioModalDados>(DIALOG_DATA);
  protected readonly usuario = this.dados.usuario;
  protected readonly ehEu = this.dados.ehEu;

  protected readonly salvando = signal(false);
  protected readonly erroGeral = signal<string | null>(null);
  protected readonly errosDoServidor = signal<Record<string, string>>({});

  protected readonly form = this.fb.nonNullable.group({
    nome: [this.usuario?.nome ?? '', Validators.required],
    email: [this.usuario?.email ?? '', [Validators.required, Validators.email]],
    senha: ['', this.usuario ? [] : [Validators.required]],
    is_superuser: [{ value: this.usuario?.is_superuser ?? false, disabled: this.ehEu }],
  });

  protected get editando(): boolean {
    return this.usuario !== null;
  }

  protected erroDe(campo: string): string | null {
    const doServidor = this.errosDoServidor()[campo];
    if (doServidor) return doServidor;

    const controle = this.form.get(campo);
    if (!controle || controle.valid || !controle.touched) return null;

    if (controle.hasError('required')) return 'Campo obrigatório.';
    if (controle.hasError('email')) return 'E-mail inválido.';
    return 'Valor inválido.';
  }

  protected salvar(): void {
    this.form.markAllAsTouched();
    this.errosDoServidor.set({});
    this.erroGeral.set(null);

    if (this.form.invalid || this.salvando()) return;

    this.salvando.set(true);
    // `getRawValue`: o super usuário desabilitado (a própria linha) ainda
    // precisa ir — o `PUT` manda o registro inteiro.
    const payload: UsuarioRequest = this.form.getRawValue();
    const requisicao = this.usuario
      ? this.service.atualizar(this.usuario.id, payload)
      : this.service.criar(payload);

    requisicao.subscribe({
      next: (salvo) => {
        this.salvando.set(false);
        this.dialogRef.close(salvo);
      },
      error: (erro) => {
        this.salvando.set(false);
        this.aplicarErrosDoServidor(erro);
      },
    });
  }

  protected fechar(): void {
    this.dialogRef.close();
  }

  private aplicarErrosDoServidor(erro: unknown): void {
    const corpo = (erro as { error?: Record<string, unknown> })?.error;
    if (!corpo || typeof corpo !== 'object') {
      this.erroGeral.set('Não foi possível salvar o usuário agora.');
      return;
    }

    const porCampo: Record<string, string> = {};
    for (const campo of CAMPOS) {
      const mensagem = corpo[campo];
      if (mensagem) porCampo[campo] = Array.isArray(mensagem) ? mensagem[0] : String(mensagem);
    }
    this.errosDoServidor.set(porCampo);

    const semCampo = corpo['detail'] ?? corpo['non_field_errors'];
    if (Object.keys(porCampo).length === 0) {
      this.erroGeral.set(
        semCampo
          ? String(Array.isArray(semCampo) ? semCampo[0] : semCampo)
          : 'Não foi possível salvar o usuário agora.',
      );
    }
  }
}
