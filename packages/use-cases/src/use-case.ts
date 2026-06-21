/**
 * Convenção da camada de aplicação: 1 caso de uso = 1 classe = 1 verbo (SRP).
 * Recebe ports via construtor (DIP) — nunca instancia infra diretamente.
 * Em falha lança DomainError (de @wolfkrow/domain); a presentation captura
 * na fronteira e mapeia para HTTP.
 */
export interface UseCase<Input, Output> {
  execute(input: Input): Promise<Output>;
}
