import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { of, throwError } from 'rxjs';

import { UsuarioResponse } from '../../../../contracts/usuarios/usuario.contracts';
import { UsuariosService } from '../../../../services/usuarios/usuarios.service';
import { UsuarioModalComponent, UsuarioModalDados } from './usuario-modal.component';

const EXISTENTE: UsuarioResponse = {
  id: 4,
  nome: 'Vasti',
  email: 'vasti@x.com',
  is_superuser: true,
  criado_em: '2026-09-01T12:00:00Z',
};

type Form = {
  get: (c: string) => { setValue: (v: unknown) => void; disabled: boolean };
};

function montar(dados: UsuarioModalDados) {
  const service = {
    criar: vi.fn(() => of({ ...EXISTENTE, id: 9 })),
    atualizar: vi.fn(() => of(EXISTENTE)),
  };
  const dialogRef = { close: vi.fn() };

  TestBed.configureTestingModule({
    imports: [UsuarioModalComponent],
    providers: [
      { provide: DIALOG_DATA, useValue: dados },
      { provide: DialogRef, useValue: dialogRef },
      { provide: UsuariosService, useValue: service },
    ],
  });
  const fixture = TestBed.createComponent(UsuarioModalComponent);
  fixture.detectChanges();
  return { fixture, service, dialogRef };
}

const form = (fixture: ComponentFixture<UsuarioModalComponent>) =>
  (fixture.componentInstance as never as { form: Form }).form;

function salvar(fixture: ComponentFixture<UsuarioModalComponent>) {
  const botoes = fixture.debugElement.queryAll(By.css('app-button button'));
  botoes[botoes.length - 1].nativeElement.click();
  fixture.detectChanges();
}

describe('UsuarioModalComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('no cadastro a senha é obrigatória', () => {
    const { fixture, service } = montar({ usuario: null, ehEu: false });
    form(fixture).get('nome').setValue('Ana');
    form(fixture).get('email').setValue('ana@x.com');

    salvar(fixture);

    expect(service.criar).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Campo obrigatório.');
  });

  it('cadastra com nome, e-mail, senha e super usuário', () => {
    const { fixture, service, dialogRef } = montar({ usuario: null, ehEu: false });
    form(fixture).get('nome').setValue('Ana');
    form(fixture).get('email').setValue('ana@x.com');
    form(fixture).get('senha').setValue('segredo-forte');
    form(fixture).get('is_superuser').setValue(true);

    salvar(fixture);

    expect(service.criar).toHaveBeenCalledWith({
      nome: 'Ana',
      email: 'ana@x.com',
      senha: 'segredo-forte',
      is_superuser: true,
    });
    expect(dialogRef.close).toHaveBeenCalled();
  });

  it('na edição a senha em branco vai vazia (mantém a atual)', () => {
    const { fixture, service } = montar({ usuario: EXISTENTE, ehEu: false });

    salvar(fixture);

    expect(service.atualizar).toHaveBeenCalledWith(4, expect.objectContaining({ senha: '' }));
  });

  it('o próprio usuário não consegue desmarcar o super usuário', () => {
    const { fixture, service } = montar({ usuario: EXISTENTE, ehEu: true });

    expect(form(fixture).get('is_superuser').disabled).toBe(true);
    salvar(fixture);
    expect(service.atualizar).toHaveBeenCalledWith(
      4,
      expect.objectContaining({ is_superuser: true }),
    );
  });

  it('erro do backend aparece embaixo do campo', () => {
    const { fixture, service } = montar({ usuario: EXISTENTE, ehEu: false });
    service.atualizar.mockReturnValue(
      throwError(() => ({ error: { email: ['Já existe um usuário com este e-mail.'] } })),
    );

    salvar(fixture);

    expect(fixture.nativeElement.textContent).toContain('Já existe um usuário com este e-mail.');
  });
});
