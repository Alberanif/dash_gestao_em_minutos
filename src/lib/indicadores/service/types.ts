/**
 * A camada de serviço recebe o cliente Supabase por injeção: os route handlers
 * passam o cliente de serviço, e os testes passam um fake que registra os
 * parâmetros que chegariam no banco.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SupabaseLike = any;
