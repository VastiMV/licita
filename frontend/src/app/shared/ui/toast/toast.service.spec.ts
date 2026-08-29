import { TestBed } from '@angular/core/testing';

import { ToastService } from './toast.service';

describe('ToastService', () => {
  let service: ToastService;

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({});
    service = TestBed.inject(ToastService);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('empilha os toasts abertos, cada um com seu tom', () => {
    service.sucesso('Salva.');
    service.erro('Falhou.');

    expect(service.toasts().map((t) => t.tom)).toEqual(['sucesso', 'erro']);
    expect(service.toasts()[0].mensagem).toBe('Salva.');
  });

  it('some sozinho depois da duração', () => {
    service.sucesso('Salva.');

    vi.advanceTimersByTime(4000);

    expect(service.toasts()).toHaveLength(0);
  });

  it('toast com ação não some sozinho — o link precisa continuar lá', () => {
    service.alerta('3 vencidas.', { acao: { rotulo: 'Apagar', executar: () => {} } });

    vi.advanceTimersByTime(60_000);

    expect(service.toasts()).toHaveLength(1);
  });

  it('fechar tira da pilha e cancela o timer', () => {
    const toast = service.sucesso('Salva.');

    service.fechar(toast.id);
    vi.advanceTimersByTime(10_000);

    expect(service.toasts()).toHaveLength(0);
  });
});
