import { Injectable, signal } from '@angular/core';

/** Os três tons de aviso do projeto. O ícone de cada um é fixo (check /
 * exclamação / X) — ver `ToastContainerComponent`. */
export type ToastTom = 'sucesso' | 'alerta' | 'erro';

/** Link de ação dentro do toast (ex.: "Apagar as vencidas"). Fechar o toast
 * depois da ação é responsabilidade do container, não de quem abriu. */
export interface ToastAcao {
  readonly rotulo: string;
  readonly executar: () => void;
}

export interface Toast {
  readonly id: number;
  readonly tom: ToastTom;
  readonly mensagem: string;
  readonly acao: ToastAcao | null;
  /** Milissegundos até sumir sozinho. `0` = fica até fecharem — é o caso de
   * todo toast com ação: sumir sozinho tiraria o link antes de ser clicado. */
  readonly duracao: number;
}

export interface ToastOpcoes {
  readonly acao?: ToastAcao;
  readonly duracao?: number;
}

const DURACAO_PADRAO: Record<ToastTom, number> = {
  sucesso: 4000,
  alerta: 8000,
  erro: 8000,
};

/**
 * Único ponto para abrir um toast no projeto — nenhuma página desenha o
 * próprio aviso flutuante. Quem renderiza é o `ToastContainerComponent`,
 * montado uma vez na `Shell`.
 *
 * Toast é para aviso que não interrompe; o que exige decisão continua sendo
 * modal (`ModalService.confirmar`).
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private proximoId = 1;
  private readonly timers = new Map<number, ReturnType<typeof setTimeout>>();

  readonly toasts = signal<readonly Toast[]>([]);

  sucesso(mensagem: string, opcoes?: ToastOpcoes): Toast {
    return this.abrir('sucesso', mensagem, opcoes);
  }

  alerta(mensagem: string, opcoes?: ToastOpcoes): Toast {
    return this.abrir('alerta', mensagem, opcoes);
  }

  erro(mensagem: string, opcoes?: ToastOpcoes): Toast {
    return this.abrir('erro', mensagem, opcoes);
  }

  fechar(id: number): void {
    const timer = this.timers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(id);
    }
    this.toasts.update((atual) => atual.filter((toast) => toast.id !== id));
  }

  private abrir(tom: ToastTom, mensagem: string, opcoes?: ToastOpcoes): Toast {
    const toast: Toast = {
      id: this.proximoId++,
      tom,
      mensagem,
      acao: opcoes?.acao ?? null,
      // Com ação, o padrão é não fechar sozinho (o link precisa continuar lá).
      duracao: opcoes?.duracao ?? (opcoes?.acao ? 0 : DURACAO_PADRAO[tom]),
    };

    this.toasts.update((atual) => [...atual, toast]);
    if (toast.duracao > 0) {
      this.timers.set(
        toast.id,
        setTimeout(() => this.fechar(toast.id), toast.duracao),
      );
    }
    return toast;
  }
}
