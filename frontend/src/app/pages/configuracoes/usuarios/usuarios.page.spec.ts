import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { of } from 'rxjs';

import { UsuarioResponse } from '../../../contracts/usuarios/usuario.contracts';
import { AuthService } from '../../../core/auth/auth.service';
import { UsuariosService } from '../../../services/usuarios/usuarios.service';
import { ModalService } from '../../../shared/overlay/modal.service';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { UsuarioModalComponent } from './usuario-modal/usuario-modal.component';
import { UsuariosPage } from './usuarios.page';

const EU: UsuarioResponse = {
  id: 1,
  nome: 'Gustavo',
  email: 'gustavo@x.com',
  is_superuser: true,
  criado_em: '2026-09-01T12:00:00Z',
};
const OUTRA: UsuarioResponse = {
  ...EU,
  id: 2,
  nome: 'Vasti',
  email: 'vasti@x.com',
  is_superuser: false,
};

describe('UsuariosPage', () => {
  let fixture: ComponentFixture<UsuariosPage>;
  let service: { listar: ReturnType<typeof vi.fn>; remover: ReturnType<typeof vi.fn> };
  let modal: { confirmar: ReturnType<typeof vi.fn>; abrir: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    service = {
      listar: vi.fn(() => of({ count: 2, next: null, previous: null, results: [EU, OUTRA] })),
      remover: vi.fn(() => of(undefined)),
    };
    modal = { confirmar: vi.fn(() => of(true)), abrir: vi.fn(() => of(undefined)) };

    TestBed.configureTestingModule({
      imports: [UsuariosPage],
      providers: [
        { provide: UsuariosService, useValue: service },
        { provide: ModalService, useValue: modal },
        { provide: ToastService, useValue: { sucesso: vi.fn(), erro: vi.fn(), alerta: vi.fn() } },
        { provide: AuthService, useValue: { usuario: signal({ user_id: 1 }) } },
      ],
    });
    fixture = TestBed.createComponent(UsuariosPage);
    fixture.detectChanges();
  });

  const linhas = () => fixture.debugElement.queryAll(By.css('tbody tr'));

  function acoesDaLinha(indice: number): HTMLButtonElement[] {
    linhas()[indice].query(By.css('app-menu .gatilho')).nativeElement.click();
    fixture.detectChanges();
    return Array.from(document.querySelectorAll<HTMLButtonElement>('.menu-item'));
  }

  it('carrega ordenado por nome e mostra quem é super usuário', () => {
    expect(service.listar).toHaveBeenCalledWith(expect.objectContaining({ ordering: 'nome' }));
    expect(linhas()).toHaveLength(2);
    expect(linhas()[0].queryAll(By.css('td'))[2].nativeElement.textContent).toContain('Sim');
    expect(linhas()[1].queryAll(By.css('td'))[2].nativeElement.textContent).toContain('Não');
  });

  it('na própria linha não oferece excluir', () => {
    const rotulos = acoesDaLinha(0).map((b) => b.textContent?.trim());

    expect(rotulos).toEqual(['Editar']);
  });

  it('exclui outro usuário depois de confirmar', () => {
    acoesDaLinha(1)
      .find((b) => b.textContent?.includes('Excluir'))!
      .click();

    expect(service.remover).toHaveBeenCalledWith(2);
  });

  it('"Adicionar usuário" abre o modal em branco', () => {
    fixture.debugElement.query(By.css('.pagina-topo app-button button')).nativeElement.click();

    expect(modal.abrir).toHaveBeenCalledWith(UsuarioModalComponent, { usuario: null, ehEu: false });
  });
});
