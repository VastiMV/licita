import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { of, throwError } from 'rxjs';

import {
  ConfigArmazenamento,
  DriverArmazenamento,
} from '../../../contracts/armazenamento/armazenamento.contracts';
import { ArmazenamentoService } from '../../../services/armazenamento/armazenamento.service';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { ArmazenamentoPage } from './armazenamento.page';

const R2: DriverArmazenamento = {
  chave: 'r2',
  rotulo: 'Cloudflare R2',
  campos: [
    {
      nome: 'endpoint_url',
      rotulo: 'Endpoint da conta',
      obrigatorio: true,
      segredo: false,
      ajuda: '',
      placeholder: '',
    },
    {
      nome: 'bucket',
      rotulo: 'Bucket',
      obrigatorio: true,
      segredo: false,
      ajuda: '',
      placeholder: '',
    },
    {
      nome: 'access_key',
      rotulo: 'Access key ID',
      obrigatorio: true,
      segredo: false,
      ajuda: '',
      placeholder: '',
    },
    {
      nome: 'secret_key',
      rotulo: 'Secret access key',
      obrigatorio: true,
      segredo: true,
      ajuda: '',
      placeholder: '',
    },
    {
      nome: 'prefixo',
      rotulo: 'Prefixo',
      obrigatorio: false,
      segredo: false,
      ajuda: '',
      placeholder: '',
    },
  ],
};

const LOCAL: DriverArmazenamento = {
  chave: 'local',
  rotulo: 'Disco local (desenvolvimento)',
  campos: [
    {
      nome: 'raiz',
      rotulo: 'Pasta',
      obrigatorio: false,
      segredo: false,
      ajuda: '',
      placeholder: '',
    },
  ],
};

const CONFIG: ConfigArmazenamento = {
  driver: 'r2',
  opcoes: {
    endpoint_url: 'https://conta.r2.cloudflarestorage.com',
    bucket: 'licita-documentos',
    access_key: 'chave',
    prefixo: '',
  },
  segredos_definidos: ['secret_key'],
  segredos_definidos_em: '2026-09-20T12:00:00Z',
  completa: true,
  testado_em: null,
  atualizado_em: '2026-09-20T12:00:00Z',
};

describe('ArmazenamentoPage', () => {
  let fixture: ComponentFixture<ArmazenamentoPage>;
  let service: {
    drivers: ReturnType<typeof vi.fn>;
    config: ReturnType<typeof vi.fn>;
    salvar: ReturnType<typeof vi.fn>;
    testar: ReturnType<typeof vi.fn>;
  };
  let toast: {
    sucesso: ReturnType<typeof vi.fn>;
    erro: ReturnType<typeof vi.fn>;
    alerta: ReturnType<typeof vi.fn>;
  };

  function montar(config: ConfigArmazenamento | null = CONFIG) {
    service = {
      drivers: vi.fn(() => of([R2, LOCAL])),
      config: vi.fn(() => of(config)),
      salvar: vi.fn(() => of(CONFIG)),
      testar: vi.fn(() => of({ ok: true })),
    };
    toast = { sucesso: vi.fn(), erro: vi.fn(), alerta: vi.fn() };

    TestBed.configureTestingModule({
      imports: [ArmazenamentoPage],
      providers: [
        { provide: ArmazenamentoService, useValue: service },
        { provide: ToastService, useValue: toast },
      ],
    });
    fixture = TestBed.createComponent(ArmazenamentoPage);
    fixture.detectChanges();
  }

  const campos = () => fixture.debugElement.queryAll(By.css('.campo'));
  /** O `*` de obrigatório é um `<em>` separado no template, então o texto
   * vem com a quebra de linha do HTML no meio. */
  const rotulos = () =>
    campos().map((campo) =>
      campo.query(By.css('.campo-rotulo')).nativeElement.textContent.replace(/\s+/g, ' ').trim(),
    );

  it('desenha o formulário a partir dos campos que o backend declarou', () => {
    // A tela não conhece R2: se o backend ganhar um driver novo, ele aparece
    // aqui sem uma linha de Angular.
    montar();

    expect(rotulos()).toEqual([
      'Endpoint da conta *',
      'Bucket *',
      'Access key ID *',
      'Secret access key *',
      'Prefixo',
    ]);
  });

  it('o segredo já gravado aparece vazio, dizendo que continua valendo', () => {
    montar();
    const secret = campos()[3];

    expect(secret.query(By.css('input')).nativeElement.value).toBe('');
    expect(secret.query(By.css('input')).nativeElement.type).toBe('password');
    expect(secret.nativeElement.textContent).toContain('Deixe em branco para manter');
  });

  it('trocar de driver troca os campos e avisa que só vale ao salvar', () => {
    montar();
    fixture.componentInstance['trocarDriver']('local');
    fixture.detectChanges();

    expect(rotulos()).toEqual(['Pasta']);
    expect(fixture.nativeElement.textContent).toContain('O serviço em uso é outro');
  });

  it('salvar manda o segredo só quando ele foi digitado', () => {
    montar();
    fixture.componentInstance['salvar']();

    expect(service.salvar.mock.calls[0][0].segredos).toEqual({});
  });

  it('segredo digitado vai no envio, separado das opções', () => {
    montar();
    const campo = R2.campos[3];
    fixture.componentInstance['escrever'](campo, 'novo-segredo');
    fixture.componentInstance['salvar']();

    const payload = service.salvar.mock.calls[0][0];
    expect(payload.segredos).toEqual({ secret_key: 'novo-segredo' });
    expect(payload.opcoes).not.toHaveProperty('secret_key');
  });

  it('campo obrigatório vazio trava antes de ir ao servidor', () => {
    montar(null);
    fixture.componentInstance['trocarDriver']('r2');
    fixture.componentInstance['salvar']();
    fixture.detectChanges();

    expect(service.salvar).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Preencha:');
  });

  it('teste de conexão que falha mostra a explicação do provedor', () => {
    montar();
    service.testar.mockReturnValue(
      of({ ok: false, erro: 'Credencial recusada pelo provedor — confira access key.' }),
    );
    fixture.componentInstance['testar']();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Credencial recusada');
    expect(toast.sucesso).not.toHaveBeenCalled();
  });

  it('teste de conexão que passa recarrega para atualizar a data', () => {
    montar();
    fixture.componentInstance['testar']();

    expect(toast.sucesso).toHaveBeenCalled();
    expect(service.config).toHaveBeenCalledTimes(2);
  });

  it('sem configuração, abre no primeiro driver e não oferece testar', () => {
    montar(null);

    expect(fixture.componentInstance['escolhido']()).toBe('r2');
    const testar = fixture.debugElement
      .queryAll(By.css('app-button button'))
      .find((b) => b.nativeElement.textContent.includes('Testar'));
    expect(testar!.nativeElement.disabled).toBe(true);
  });

  it('erro ao listar drivers vira mensagem, não tela em branco', () => {
    service = {
      drivers: vi.fn(() => throwError(() => new Error('falhou'))),
      config: vi.fn(() => of(null)),
      salvar: vi.fn(),
      testar: vi.fn(),
    };
    toast = { sucesso: vi.fn(), erro: vi.fn(), alerta: vi.fn() };
    TestBed.configureTestingModule({
      imports: [ArmazenamentoPage],
      providers: [
        { provide: ArmazenamentoService, useValue: service },
        { provide: ToastService, useValue: toast },
      ],
    });
    fixture = TestBed.createComponent(ArmazenamentoPage);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('drivers instalados');
  });
});
