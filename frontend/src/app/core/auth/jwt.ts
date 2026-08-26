/**
 * Decodifica o payload de um JWT sem validar assinatura — a validação real
 * é feita pelo backend, isso aqui só lê claims (`email`, `nome`, ...) pra
 * exibir na UI (ver `AuthService.usuario`). Devolve `null` em qualquer
 * token malformado em vez de lançar: um payload ilegível não pode derrubar
 * a página, só faz o nome/e-mail sumir do menu.
 */
export function decodeJwtPayload<T>(token: string): T | null {
  const parte = token.split('.')[1];
  if (!parte) return null;

  try {
    const base64 = parte.replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(base64);
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}
