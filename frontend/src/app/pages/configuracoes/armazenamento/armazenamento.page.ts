import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import {
  CampoDriver,
  ConfigArmazenamento,
  DriverArmazenamento,
} from '../../../contracts/armazenamento/armazenamento.contracts';
import { ArmazenamentoService } from '../../../services/armazenamento/armazenamento.service';
import { ButtonComponent } from '../../../shared/ui/button/button.component';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { SelectComponent, SelectOption } from '../../../shared/ui/select/select.component';
import { ToastService } from '../../../shared/ui/toast/toast.service';

/**
 * "Configurações → Armazenamento" — onde o cliente escolhe **o plugin** e o
 * configura.
 *
 * A tela não conhece Cloudflare R2 nem S3: ela pergunta ao backend quais
 * drivers estão instalados e quais campos cada um precisa, e desenha o
 * formulário a partir dessa lista (ver
 * `contracts/armazenamento/armazenamento.contracts.ts`). Driver novo,
 * instalado como pacote no backend, aparece aqui sem uma linha de Angular —
 * que é o ponto inteiro de o armazenamento ser plugin.
 *
 * O segredo entra e não volta: o backend devolve só quais estão definidos e
 * desde quando. Campo em branco não apaga o que já está gravado.
 */
@Component({
  selector: 'app-armazenamento-page',
  imports: [DatePipe, FormsModule, ButtonComponent, IconComponent, SelectComponent],
  templateUrl: './armazenamento.page.html',
  styleUrl: './armazenamento.page.scss',
})
export class ArmazenamentoPage implements OnInit {
  private readonly service = inject(ArmazenamentoService);
  private readonly toast = inject(ToastService);

  protected readonly drivers = signal<readonly DriverArmazenamento[]>([]);
  protected readonly config = signal<ConfigArmazenamento | null>(null);
  protected readonly escolhido = signal('');
  /** O que está digitado agora, por nome de campo — some ao recarregar. */
  protected readonly valores = signal<Record<string, string>>({});

  protected readonly carregando = signal(true);
  protected readonly salvando = signal(false);
  protected readonly testando = signal(false);
  protected readonly erro = signal<string | null>(null);
  protected readonly resultadoTeste = signal<string | null>(null);

  protected readonly opcoesDriver = computed<readonly SelectOption[]>(() =>
    this.drivers().map((d) => ({ value: d.chave, label: d.rotulo })),
  );

  protected readonly campos = computed<readonly CampoDriver[]>(
    () => this.drivers().find((d) => d.chave === this.escolhido())?.campos ?? [],
  );

  /** A configuração gravada é de outro driver — os valores da tela ainda não
   * valem nada até salvar. */
  protected readonly trocouDeDriver = computed(
    () => !!this.config() && this.config()!.driver !== this.escolhido(),
  );

  ngOnInit(): void {
    this.carregar();
  }

  protected valorDe(campo: CampoDriver): string {
    return this.valores()[campo.nome] ?? '';
  }

  protected escrever(campo: CampoDriver, valor: string): void {
    this.valores.update((atuais) => ({ ...atuais, [campo.nome]: valor }));
  }

  /** Um segredo já gravado não é devolvido pela API — o campo aparece vazio
   * com esta legenda, e só é enviado se alguém digitar outro valor. */
  protected segredoJaDefinido(campo: CampoDriver): boolean {
    return campo.segredo && (this.config()?.segredos_definidos ?? []).includes(campo.nome);
  }

  protected trocarDriver(chave: string): void {
    this.escolhido.set(chave);
    this.resultadoTeste.set(null);
    // Campos de um driver não servem para outro (bucket do R2 não é raiz de
    // pasta): recomeça em branco, ou repõe o que está gravado se for a volta
    // para o driver configurado.
    this.valores.set(chave === this.config()?.driver ? { ...this.config()!.opcoes } : {});
  }

  protected salvar(): void {
    if (this.salvando()) return;

    const campos = this.campos();
    const opcoes: Record<string, string> = {};
    const segredos: Record<string, string> = {};
    for (const campo of campos) {
      const valor = (this.valores()[campo.nome] ?? '').trim();
      if (campo.segredo) {
        // Vazio não vai: mandar string vazia seria pedir para apagar a
        // credencial de quem só quis corrigir o nome do bucket.
        if (valor) segredos[campo.nome] = valor;
      } else {
        opcoes[campo.nome] = valor;
      }
    }

    const faltando = campos.filter(
      (campo) =>
        campo.obrigatorio &&
        !opcoes[campo.nome] &&
        !segredos[campo.nome] &&
        !this.segredoJaDefinido(campo),
    );
    if (faltando.length > 0) {
      this.erro.set(`Preencha: ${faltando.map((campo) => campo.rotulo).join(', ')}.`);
      return;
    }

    this.salvando.set(true);
    this.erro.set(null);
    this.service.salvar({ driver: this.escolhido(), opcoes, segredos }).subscribe({
      next: (config) => {
        this.salvando.set(false);
        this.aplicar(config);
        this.toast.sucesso('Armazenamento salvo. Teste a conexão para confirmar.');
      },
      error: (erro) => {
        this.salvando.set(false);
        this.erro.set(this.mensagemDe(erro, 'Não foi possível salvar a configuração agora.'));
      },
    });
  }

  protected testar(): void {
    if (this.testando()) return;

    this.testando.set(true);
    this.resultadoTeste.set(null);
    this.service.testar().subscribe({
      next: (resultado) => {
        this.testando.set(false);
        if (resultado.ok) {
          this.toast.sucesso('Conexão ok — gravou, leu e apagou um arquivo de teste.');
          this.carregar();
        } else {
          this.resultadoTeste.set(resultado.erro ?? 'Falhou, sem detalhe.');
        }
      },
      error: (erro) => {
        this.testando.set(false);
        this.resultadoTeste.set(
          this.mensagemDe(erro, 'Não foi possível testar a conexão agora.', 'erro'),
        );
      },
    });
  }

  private carregar(): void {
    this.carregando.set(true);
    this.service.drivers().subscribe({
      next: (drivers) => {
        this.drivers.set(drivers);
        this.service.config().subscribe({
          next: (config) => {
            this.carregando.set(false);
            if (config) this.aplicar(config);
            else this.escolhido.set(drivers[0]?.chave ?? '');
          },
          error: () => {
            this.carregando.set(false);
            this.erro.set('Não foi possível carregar a configuração atual.');
          },
        });
      },
      error: () => {
        this.carregando.set(false);
        this.erro.set('Não foi possível listar os drivers instalados no backend.');
      },
    });
  }

  private aplicar(config: ConfigArmazenamento): void {
    this.config.set(config);
    this.escolhido.set(config.driver);
    this.valores.set({ ...config.opcoes });
  }

  /** O backend explica o que recusou; jogar fora esse texto e mostrar "não
   * foi possível" seria esconder a razão. */
  private mensagemDe(erro: unknown, padrao: string, chave = 'detail'): string {
    const corpo = (erro as { error?: Record<string, unknown> })?.error;
    const valor = corpo?.[chave] ?? corpo?.['driver'] ?? corpo?.['opcoes'];
    if (!valor) return padrao;
    return String(Array.isArray(valor) ? valor[0] : valor);
  }
}
