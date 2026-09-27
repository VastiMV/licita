import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { ENDPOINTS } from '../../core/api/endpoints';
import { AuthService } from '../../core/auth/auth.service';
import { UsuarioModalComponent } from '../../pages/configuracoes/usuarios/usuario-modal/usuario-modal.component';
import { ModalService } from '../../shared/overlay/modal.service';
import { ProfileMenuComponent } from './profile-menu.component';

describe('ProfileMenuComponent', () => {
  let fixture: ComponentFixture<ProfileMenuComponent>;
  let httpMock: HttpTestingController;
  let auth: AuthService;
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ProfileMenuComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });

    fixture = TestBed.createComponent(ProfileMenuComponent);
    httpMock = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
    router = TestBed.inject(Router);
    fixture.detectChanges();
  });

  afterEach(() => httpMock.verify());

  function logar(claims: { email: string; nome: string }): void {
    const token = `header.${btoa(JSON.stringify(claims))}.signature`;
    auth.login({ email: claims.email, password: 'segredo' }).subscribe();
    httpMock.expectOne(`/api/${ENDPOINTS.auth.login}`).flush({ access: token });
    fixture.detectChanges();
  }

  it('começa fechado e abre ao clicar no gatilho', () => {
    expect(fixture.debugElement.query(By.css('.dropdown'))).toBeNull();

    fixture.debugElement.query(By.css('.trigger')).nativeElement.click();
    fixture.detectChanges();

    expect(fixture.debugElement.query(By.css('.dropdown'))).toBeTruthy();
  });

  it('mostra nome e e-mail do usuário logado', () => {
    logar({ email: 'user@licita.dev', nome: 'Fulano' });

    fixture.debugElement.query(By.css('.trigger')).nativeElement.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Fulano');
    expect(fixture.nativeElement.textContent).toContain('user@licita.dev');
  });

  it('sair desloga e navega pro login', () => {
    logar({ email: 'user@licita.dev', nome: 'Fulano' });
    const navigateSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    fixture.debugElement.query(By.css('.trigger')).nativeElement.click();
    fixture.detectChanges();

    fixture.debugElement.query(By.css('.dropdown-item.danger')).nativeElement.click();
    httpMock.expectOne(`/api/${ENDPOINTS.auth.logout}`).flush(null);

    expect(auth.isAuthenticated()).toBe(false);
    expect(navigateSpy).toHaveBeenCalledWith('/login');
  });

  it('editar perfil busca o próprio cadastro e abre o modal sem o super usuário', () => {
    const modal = TestBed.inject(ModalService);
    const abrir = vi.spyOn(modal, 'abrir').mockReturnValue(of(undefined));
    fixture.debugElement.query(By.css('.trigger')).nativeElement.click();
    fixture.detectChanges();

    fixture.debugElement.query(By.css('.dropdown-item:not(.danger)')).nativeElement.click();
    const eu = { id: 3, nome: 'Fulano', email: 'f@x.com', is_superuser: false, criado_em: '' };
    httpMock.expectOne(`/api/${ENDPOINTS.usuarios.perfil}`).flush(eu);

    expect(abrir).toHaveBeenCalledWith(UsuarioModalComponent, {
      usuario: eu,
      ehEu: true,
      perfil: true,
    });
  });
});
