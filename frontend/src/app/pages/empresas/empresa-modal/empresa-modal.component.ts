import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';

import {
  EmpresaRequest,
  EmpresaResponse,
  PORTES_EMPRESA,
} from '../../../contracts/empresas/empresa.contracts';
import { UFS } from '../../../contracts/localidades/uf';
import { EmpresasService } from '../../../services/empresas/empresas.service';
import { ModalShellComponent } from '../../../shared/overlay/modal-shell/modal-shell.component';
import {
  cnpjValido,
  mascararCep,
  mascararDocumento,
  mascararTelefone,
  somenteDigitos,
} from '../../../shared/documento/documento';
import { ButtonComponent } from '../../../shared/ui/button/button.component';
import { InputTextComponent } from '../../../shared/ui/input-text/input-text.component';
import { SelectComponent } from '../../../shared/ui/select/select.component';

/** Campo que o backend pode recusar, mapeado para a mensagem da tela. Só
 * estes viram erro embaixo do campo; o resto cai no aviso do rodapé. */
const CAMPOS = [
  'nome',
  'fantasia',
  'cnpj',
  'porte',
  'inscricao_estadual',
  'inscricao_municipal',
  'cnae_principal',
  'cep',
  'logradouro',
  'numero',
  'complemento',
  'bairro',
  'cidade',
  'uf',
  'responsavel_legal',
  'email',
  'telefone',
  'observacoes',
  'ativa',
] as const;

/** Só CNPJ, sem a alternativa de CPF que o fornecedor aceita: quem disputa
 * licitação é pessoa jurídica — inclusive o MEI, que tem CNPJ. Campo vazio
 * fica para o `required` reclamar. */
function validarCnpj(controle: AbstractControl): ValidationErrors | null {
  const valor = String(controle.value ?? '');
  return !valor || cnpjValido(valor) ? null : { cnpj: true };
}

/**
 * O modal que cadastra **e** edita uma empresa — um só, porque o formulário
 * é idêntico nos dois casos: o que muda é o título, o rótulo do botão e se
 * há um id para atualizar.
 *
 * Fecha devolvendo a empresa salva (ou `undefined` se cancelaram), e é a
 * página que avisa e recarrega a lista — o modal não conhece a tabela.
 *
 * Os documentos da empresa não entram aqui: têm modal próprio
 * (`DocumentosModalComponent`), aberto pela ação "Documentos" da lista.
 * Editar o endereço e cuidar da papelada são tarefas diferentes, feitas em
 * momentos diferentes — e a papelada é a que acontece toda semana.
 */
@Component({
  selector: 'app-empresa-modal',
  imports: [
    ReactiveFormsModule,
    ModalShellComponent,
    ButtonComponent,
    InputTextComponent,
    SelectComponent,
  ],
  templateUrl: './empresa-modal.component.html',
  styleUrl: './empresa-modal.component.scss',
})
export class EmpresaModalComponent {
  private readonly dialogRef = inject(DialogRef<EmpresaResponse>);
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(EmpresasService);

  /** `null` = cadastrar; um registro = editar. */
  protected readonly empresa = inject<EmpresaResponse | null>(DIALOG_DATA);

  protected readonly portes = PORTES_EMPRESA;
  protected readonly ufs = UFS;

  protected readonly salvando = signal(false);
  protected readonly erroGeral = signal<string | null>(null);
  /** Erros que o backend devolveu por campo, para a mensagem aparecer
   * embaixo do campo certo em vez de num aviso genérico no rodapé. */
  protected readonly errosDoServidor = signal<Record<string, string>>({});

  protected readonly form = this.fb.nonNullable.group({
    nome: [this.empresa?.nome ?? '', Validators.required],
    fantasia: [this.empresa?.fantasia ?? ''],
    cnpj: [
      this.empresa ? mascararDocumento(this.empresa.cnpj) : '',
      [Validators.required, validarCnpj],
    ],
    porte: [this.empresa?.porte ?? 'demais', Validators.required],
    inscricao_estadual: [this.empresa?.inscricao_estadual ?? ''],
    inscricao_municipal: [this.empresa?.inscricao_municipal ?? ''],
    cnae_principal: [this.empresa?.cnae_principal ?? ''],

    cep: [this.empresa ? mascararCep(this.empresa.cep) : ''],
    logradouro: [this.empresa?.logradouro ?? ''],
    numero: [this.empresa?.numero ?? ''],
    complemento: [this.empresa?.complemento ?? ''],
    bairro: [this.empresa?.bairro ?? ''],
    uf: [this.empresa?.uf ?? 'SP'],
    cidade: [this.empresa?.cidade ?? ''],

    responsavel_legal: [this.empresa?.responsavel_legal ?? ''],
    email: [this.empresa?.email ?? '', Validators.email],
    telefone: [this.empresa ? mascararTelefone(this.empresa.telefone) : ''],

    observacoes: [this.empresa?.observacoes ?? ''],
  });

  constructor() {
    // As máscaras são aplicadas no próprio controle enquanto se digita —
    // `emitEvent: false` evita o laço infinito de reescrever e reagir.
    this.mascarar('cnpj', mascararDocumento);
    this.mascarar('cep', mascararCep);
    this.mascarar('telefone', mascararTelefone);
  }

  protected get editando(): boolean {
    return this.empresa !== null;
  }

  /** A empresa padrão é a que a proposta já vem preenchida com — vale dizer
   * isso na tela, já que daqui não se troca qual é (isso é ação da lista). */
  protected get ehPadrao(): boolean {
    return this.empresa?.padrao ?? false;
  }

  /** Mensagem do campo: a do servidor tem prioridade sobre a da tela — ela
   * é mais específica ("já existe uma empresa com este CNPJ: X"). */
  protected erroDe(campo: string): string | null {
    const doServidor = this.errosDoServidor()[campo];
    if (doServidor) return doServidor;

    const controle = this.form.get(campo);
    if (!controle || controle.valid || !controle.touched) return null;

    if (controle.hasError('required')) return 'Campo obrigatório.';
    if (controle.hasError('email')) return 'E-mail inválido.';
    if (controle.hasError('cnpj')) return 'CNPJ inválido — confira os dígitos.';
    return 'Valor inválido.';
  }

  protected salvar(): void {
    this.form.markAllAsTouched();
    this.errosDoServidor.set({});
    this.erroGeral.set(null);

    if (this.form.invalid || this.salvando()) return;

    this.salvando.set(true);
    const payload = this.montarPayload();
    const requisicao = this.empresa
      ? this.service.atualizar(this.empresa.id, payload)
      : this.service.criar(payload);

    requisicao.subscribe({
      next: (salva) => {
        this.salvando.set(false);
        this.dialogRef.close(salva);
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

  /** O CNPJ e o CEP vão só com dígitos (ver `EmpresaSerializer`).
   *
   * `padrao` e `ativa` não são campos do formulário: quem muda os dois é a
   * lista (definir como padrão, inativar, reativar), porque são decisões
   * sobre o **cadastro**, não sobre os dados da empresa. Aqui eles só são
   * repassados como estão para o `PUT` não apagá-los.
   */
  private montarPayload(): EmpresaRequest {
    const valores = this.form.getRawValue();

    return {
      ...valores,
      cnpj: somenteDigitos(valores.cnpj),
      cep: somenteDigitos(valores.cep),
      telefone: somenteDigitos(valores.telefone),
      padrao: this.empresa?.padrao ?? false,
      ativa: this.empresa?.ativa ?? true,
    } as EmpresaRequest;
  }

  private aplicarErrosDoServidor(erro: unknown): void {
    const corpo = (erro as { error?: Record<string, unknown> })?.error;
    if (!corpo || typeof corpo !== 'object') {
      this.erroGeral.set('Não foi possível salvar a empresa agora.');
      return;
    }

    const porCampo: Record<string, string> = {};
    for (const campo of CAMPOS) {
      const mensagem = corpo[campo];
      if (mensagem) porCampo[campo] = Array.isArray(mensagem) ? mensagem[0] : String(mensagem);
    }
    this.errosDoServidor.set(porCampo);

    // O que não casou com nenhum campo (`non_field_errors`, 500, rede) ainda
    // precisa aparecer — senão o modal só "não salva", sem dizer por quê.
    const semCampo = corpo['detail'] ?? corpo['non_field_errors'];
    if (Object.keys(porCampo).length === 0) {
      this.erroGeral.set(
        semCampo
          ? String(Array.isArray(semCampo) ? semCampo[0] : semCampo)
          : 'Não foi possível salvar a empresa agora.',
      );
    }
  }

  private mascarar(campo: string, mascara: (valor: string) => string): void {
    const controle = this.form.get(campo)!;
    controle.valueChanges.pipe(takeUntilDestroyed()).subscribe((valor) => {
      const formatado = mascara(String(valor ?? ''));
      if (formatado !== valor) controle.setValue(formatado, { emitEvent: false });
    });
  }
}
