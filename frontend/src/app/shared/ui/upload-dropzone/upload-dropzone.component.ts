import { Component, ElementRef, input, output, signal, viewChild } from '@angular/core';

import { IconComponent } from '../icon/icon.component';

/**
 * Área de envio de arquivo: arrastar ou clicar.
 *
 * Era a única peça de UI que o projeto ainda não tinha, e nasce em `shared/`
 * porque serve os dois módulos de documento — o dossiê da empresa agora e a
 * pasta do processo depois.
 *
 * Mostra **progresso real** quando quem usa passa `progresso` (o
 * `HttpClient` emite isso a cada pedaço que sobe). Não existe barra animada
 * de mentira aqui: num balanço de 20 MB, inventar a porcentagem é pior do
 * que não mostrar nenhuma.
 */
@Component({
  selector: 'app-upload-dropzone',
  imports: [IconComponent],
  templateUrl: './upload-dropzone.component.html',
  styleUrl: './upload-dropzone.component.scss',
})
export class UploadDropzoneComponent {
  /** Lista de extensões aceitas, para o seletor do sistema já filtrar. */
  readonly aceita = input('.pdf,.png,.jpg,.jpeg,.xlsx,.xls,.docx,.doc,.zip,.p7s');
  readonly titulo = input('Arraste o arquivo ou clique para enviar');
  readonly ajuda = input('PDF, imagem, planilha ou ZIP até 50 MB');
  readonly desabilitado = input(false);
  /** `null` = parado. 0–100 enquanto sobe. */
  readonly progresso = input<number | null>(null);
  /** Nome do arquivo em envio, para a barra dizer o que está subindo. */
  readonly enviando = input('');

  readonly escolhido = output<File>();

  private readonly campo = viewChild.required<ElementRef<HTMLInputElement>>('campo');
  protected readonly arrastando = signal(false);

  protected abrirSeletor(): void {
    if (this.desabilitado()) return;
    this.campo().nativeElement.click();
  }

  /** Espaço e Enter abrem o seletor: a área é `role="button"`, e um botão
   * que só responde a mouse não é um botão. */
  protected aoTeclar(evento: KeyboardEvent): void {
    if (evento.key !== 'Enter' && evento.key !== ' ') return;
    evento.preventDefault();
    this.abrirSeletor();
  }

  protected aoSelecionar(evento: Event): void {
    const campo = evento.target as HTMLInputElement;
    const arquivo = campo.files?.[0];
    if (arquivo) this.escolhido.emit(arquivo);
    // Zera para o mesmo arquivo poder ser escolhido de novo depois de um
    // erro — sem isso o `change` não dispara na segunda vez.
    campo.value = '';
  }

  protected aoArrastar(evento: DragEvent, dentro: boolean): void {
    evento.preventDefault();
    if (!this.desabilitado()) this.arrastando.set(dentro);
  }

  protected aoSoltar(evento: DragEvent): void {
    evento.preventDefault();
    this.arrastando.set(false);
    if (this.desabilitado()) return;

    const arquivo = evento.dataTransfer?.files?.[0];
    if (arquivo) this.escolhido.emit(arquivo);
  }
}
