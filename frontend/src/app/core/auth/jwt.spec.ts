import { decodeJwtPayload } from './jwt';

function fakeJwt(payload: unknown): string {
  const base64 = btoa(JSON.stringify(payload));
  return `header.${base64}.signature`;
}

describe('decodeJwtPayload', () => {
  it('lê as claims do payload', () => {
    const token = fakeJwt({ email: 'user@licita.dev', nome: 'Fulano' });

    expect(decodeJwtPayload(token)).toEqual({ email: 'user@licita.dev', nome: 'Fulano' });
  });

  it('devolve null pra token sem payload', () => {
    expect(decodeJwtPayload('so-header')).toBeNull();
  });

  it('devolve null pra payload que não é JSON válido', () => {
    expect(decodeJwtPayload('header.não-é-base64.signature')).toBeNull();
  });
});
