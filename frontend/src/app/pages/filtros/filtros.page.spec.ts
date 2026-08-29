import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { of, throwError } from 'rxjs';

import { FiltroResponse } from '../../contracts/filtros/filtro.contracts';
import { FiltrosService } from '../../services/filtros/filtros.service';
import { ModalService } from '../../shared/overlay/modal.service';
import { FiltrosPage } from './filtros.page';

const FILTRO: FiltroResponse = {
  id: 1,
  nome: 'Notebooks SP',
  palavras_chave: 'notebook',
  uf: 'SP',
  modalidade: '6',
  uasg: null,
  ativo: true,
  email_notificacao: null,
  criado_em: '2026-08-20T10:00:00Z',
};

describe('FiltrosPage', () => {
  let fixture: ComponentFixture<FiltrosPage>;
  let filtrosService: {
    listar: ReturnType<typeof vi.fn>;
    criar: ReturnType<typeof vi.fn>;
    remover: ReturnType<typeof vi.fn>;
  };
  let modal: { aviso: ReturnType<typeof vi.fn>; confirmar: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    filtrosService = { listar: vi.fn(() => of([FILTRO])), criar: vi.fn(), remover: vi.fn() };
    modal = { aviso: vi.fn(() => of(undefined)), confirmar: vi.fn() };

    TestBed.configureTestingModule({
      imports: [FiltrosPage],
      providers: [
        { provide: FiltrosService, useValue: filtrosService },
        { provide: ModalService, useValue: modal },
      ],
    });
    fixture = TestBed.createComponent(FiltrosPage);
    fixture.detectChanges();
  });

  it('UF é o mesmo select de UFs da busca de oportunidades, começando em "Todas"', () => {
    const uf = fixture.debugElement
      .queryAll(By.css('app-select'))
      .find((el) => el.nativeElement.textContent.includes('UF'))!;
    const options = uf.queryAll(By.css('option'));

    expect(options).toHaveLength(28); // 27 UFs + "Todas"
    expect(options[0].nativeElement.textContent.trim()).toBe('Todas');
    expect(options.some((o) => o.nativeElement.value === 'SP')).toBe(true);
  });

  it('carrega e lista os filtros do usuário ao iniciar', () => {
    expect(filtrosService.listar).toHaveBeenCalled();
    const item = fixture.debugElement.query(By.css('.filtro-item strong'));
    expect(item.nativeElement.textContent.trim()).toBe('Notebooks SP');
  });

  it('salvar com nome preenchido cria o filtro e o adiciona à lista', () => {
    const novo: FiltroResponse = { ...FILTRO, id: 2, nome: 'Cimento RJ' };
    filtrosService.criar.mockReturnValue(of(novo));

    fixture.componentInstance['form'].controls.nome.setValue('Cimento RJ');
    fixture.debugElement.query(By.css('form')).triggerEventHandler('submit', new Event('submit'));
    fixture.detectChanges();

    expect(filtrosService.criar).toHaveBeenCalled();
    const nomes = fixture.debugElement
      .queryAll(By.css('.filtro-item strong'))
      .map((el) => el.nativeElement.textContent.trim());
    expect(nomes).toContain('Cimento RJ');
  });

  it('salvar sem nome não chama o serviço', () => {
    fixture.debugElement.query(By.css('form')).triggerEventHandler('submit', new Event('submit'));
    fixture.detectChanges();

    expect(filtrosService.criar).not.toHaveBeenCalled();
  });

  it('remover pede confirmação e só chama o serviço se confirmado', () => {
    modal.confirmar.mockReturnValue(of(true));
    filtrosService.remover.mockReturnValue(of(undefined));

    fixture.debugElement.query(By.css('.filtro-item app-button')).nativeElement.click();

    expect(modal.confirmar).toHaveBeenCalled();
    expect(filtrosService.remover).toHaveBeenCalledWith(FILTRO.id);
  });

  it('remover não chama o serviço se o usuário cancelar a confirmação', () => {
    modal.confirmar.mockReturnValue(of(false));

    fixture.debugElement.query(By.css('.filtro-item app-button')).nativeElement.click();

    expect(filtrosService.remover).not.toHaveBeenCalled();
  });
});
