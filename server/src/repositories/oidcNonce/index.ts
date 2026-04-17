import { OidcNonceRepository as PgOidcNonceRepository } from "./postgres";
import type { OidcNonceRepository } from "./repository";

export type { OidcNonceRepository };

export function createDefault(): OidcNonceRepository {
  return new PgOidcNonceRepository();
}
