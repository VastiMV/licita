import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';

import { EtapaAConstruirPage } from './etapa-a-construir.page';

describe('EtapaAConstruirPage', () => {
  it('mostra o título e a descrição que a rota passa', () => {
    TestBed.configureTestingModule({
      imports: [EtapaAConstruirPage],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: { data: of({ titulo: 'Propostas', descricao: 'As propostas em andamento.' }) },
        },
      ],
    });
    const fixture = TestBed.createComponent(EtapaAConstruirPage);
    fixture.detectChanges();

    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('Propostas');
    expect(texto).toContain('As propostas em andamento.');
    expect(texto).toContain('ainda está sendo construída');
  });
});
