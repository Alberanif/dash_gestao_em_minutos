/** URL http(s) sem espaços, que o `URL` do navegador aceita. */
export function urlValida(s: string): boolean {
  if (!/^https?:\/\/\S+$/i.test(s)) return false;
  try {
    new URL(s);
    return true;
  } catch {
    return false;
  }
}
