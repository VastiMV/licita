import { BreakpointObserver } from '@angular/cdk/layout';
import { TestBed } from '@angular/core/testing';
import { BehaviorSubject } from 'rxjs';

import { SidebarStateService } from './sidebar-state.service';

/** Fake controlável — evita depender do `matchMedia` real do jsdom pra simular resize. */
class FakeBreakpointObserver {
  private readonly estado = new BehaviorSubject({ matches: false, breakpoints: {} });

  observe() {
    return this.estado.asObservable();
  }

  isMatched(): boolean {
    return this.estado.value.matches;
  }

  simularMobile(matches: boolean): void {
    this.estado.next({ matches, breakpoints: {} });
  }
}

describe('SidebarStateService', () => {
  let service: SidebarStateService;
  let breakpoint: FakeBreakpointObserver;

  beforeEach(() => {
    breakpoint = new FakeBreakpointObserver();

    TestBed.configureTestingModule({
      providers: [{ provide: BreakpointObserver, useValue: breakpoint }],
    });
    service = TestBed.inject(SidebarStateService);
  });

  it('iconOnly acompanha collapsed em desktop', () => {
    expect(service.iconOnly()).toBe(false);

    service.toggleCollapsed();
    expect(service.iconOnly()).toBe(true);
  });

  it('iconOnly volta a false ao entrar em viewport mobile, mesmo com collapsed ligado', () => {
    // Reproduz o bug relatado: recolher em desktop e depois abrir o painel
    // em mobile não pode continuar em modo ícone — tem que abrir o menu
    // completo.
    service.toggleCollapsed();
    expect(service.iconOnly()).toBe(true);

    breakpoint.simularMobile(true);
    expect(service.iconOnly()).toBe(false);

    breakpoint.simularMobile(false);
    expect(service.iconOnly()).toBe(true);
  });
});
