import { Dialog } from '@angular/cdk/dialog';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { AvisoModalComponent } from './aviso-modal/aviso-modal.component';
import { ModalService } from './modal.service';
import { QuestionModalComponent } from './question-modal/question-modal.component';

describe('ModalService', () => {
  let service: ModalService;
  let dialogOpenSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    dialogOpenSpy = vi.fn();
    TestBed.configureTestingModule({
      providers: [{ provide: Dialog, useValue: { open: dialogOpenSpy } }],
    });
    service = TestBed.inject(ModalService);
  });

  it('aviso() abre o AvisoModalComponent com os dados recebidos e resolve ao fechar', () => {
    dialogOpenSpy.mockReturnValue({ closed: of(undefined) });

    let resolvido = false;
    service.aviso({ mensagem: 'Catálogo sincronizado.' }).subscribe(() => (resolvido = true));

    expect(dialogOpenSpy).toHaveBeenCalledWith(AvisoModalComponent, {
      data: { mensagem: 'Catálogo sincronizado.' },
    });
    expect(resolvido).toBe(true);
  });

  it('confirmar() abre o QuestionModalComponent e propaga true quando confirmado', () => {
    dialogOpenSpy.mockReturnValue({ closed: of(true) });

    let resultado: boolean | undefined;
    service.confirmar({ mensagem: 'Excluir filtro?' }).subscribe((r) => (resultado = r));

    expect(dialogOpenSpy).toHaveBeenCalledWith(QuestionModalComponent, {
      data: { mensagem: 'Excluir filtro?' },
    });
    expect(resultado).toBe(true);
  });

  it('abrir() monta o componente recebido com os dados, sem a página tocar no Dialog do CDK', () => {
    dialogOpenSpy.mockReturnValue({ closed: of('fechou') });

    let resultado: string | undefined;
    service.abrir<string, { id: number }>(AvisoModalComponent, { id: 7 }).subscribe((r) => (resultado = r));

    expect(dialogOpenSpy).toHaveBeenCalledWith(AvisoModalComponent, { data: { id: 7 } });
    expect(resultado).toBe('fechou');
  });

  it('confirmar() resolve false quando o modal fecha sem escolha (backdrop/esc)', () => {
    dialogOpenSpy.mockReturnValue({ closed: of(undefined) });

    let resultado: boolean | undefined;
    service.confirmar({ mensagem: 'Excluir filtro?' }).subscribe((r) => (resultado = r));

    expect(resultado).toBe(false);
  });
});
