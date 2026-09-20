import { HttpEventType } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { ApiClient } from '../../core/api/api-client';
import { ENDPOINTS } from '../../core/api/endpoints';
import { DocumentosService } from './documentos.service';

function arquivo(): File {
  return new File([new Blob(['x'])], 'certidao.pdf', { type: 'application/pdf' });
}

describe('DocumentosService', () => {
  let service: DocumentosService;
  let api: {
    get: ReturnType<typeof vi.fn>;
    post: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    upload: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    api = {
      get: vi.fn(() => of([])),
      post: vi.fn(() => of({})),
      delete: vi.fn(() => of({})),
      upload: vi.fn(() =>
        of({ type: HttpEventType.Response, body: { versao: {}, documento: {} } }),
      ),
    };
    TestBed.configureTestingModule({ providers: [{ provide: ApiClient, useValue: api }] });
    service = TestBed.inject(DocumentosService);
  });

  it('listar() recorta pela empresa', () => {
    service.listar(7).subscribe();

    expect(api.get).toHaveBeenCalledWith(ENDPOINTS.documentos.lista, { empresa: 7 });
  });

  it('enviarVersao() manda multipart com os campos preenchidos', () => {
    service
      .enviarVersao(3, { arquivo: arquivo(), validade: '2026-10-01', numero: '123' })
      .subscribe();

    const [path, form] = api.upload.mock.calls[0];
    expect(path).toBe(ENDPOINTS.documentos.versoes(3));
    expect((form as FormData).get('validade')).toBe('2026-10-01');
    expect((form as FormData).get('numero')).toBe('123');
    expect((form as FormData).get('arquivo')).toBeInstanceOf(File);
  });

  it('campo vazio não vira string vazia no multipart', () => {
    service.enviarVersao(3, { arquivo: arquivo(), nota: '' }).subscribe();

    expect((api.upload.mock.calls[0][1] as FormData).has('nota')).toBe(false);
  });

  it('traduz o progresso do HttpClient em porcentagem', () => {
    api.upload.mockReturnValue(
      of(
        { type: HttpEventType.UploadProgress, loaded: 50, total: 200 },
        { type: HttpEventType.Response, body: { versao: { versao: 1 }, documento: {} } },
      ),
    );

    const emitidos: unknown[] = [];
    service.enviarVersao(3, { arquivo: arquivo() }).subscribe((p) => emitidos.push(p));

    expect(emitidos).toEqual([
      { pct: 25 },
      { pct: 100, resultado: { versao: { versao: 1 }, documento: {} } },
    ]);
  });

  it('sem total no evento, não inventa porcentagem', () => {
    api.upload.mockReturnValue(of({ type: HttpEventType.UploadProgress, loaded: 50 }));

    const emitidos: { pct: number }[] = [];
    service.enviarVersao(3, { arquivo: arquivo() }).subscribe((p) => emitidos.push(p));

    expect(emitidos).toEqual([{ pct: 0 }]);
  });

  it('arquivar() usa o DELETE, que no backend não apaga', () => {
    service.arquivar(9).subscribe();

    expect(api.delete).toHaveBeenCalledWith(ENDPOINTS.documentos.detalhe(9));
  });

  it('download pede a URL assinada em vez de montar link', () => {
    service.urlDeDownload(5).subscribe();

    expect(api.get).toHaveBeenCalledWith(ENDPOINTS.documentos.download(5));
  });
});
