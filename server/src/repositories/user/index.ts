import { UserRepository as PgUserRepository } from "./postgres";
import type { UserRepository } from "./repository";

export type { UserRepository };

export function createDefault(): UserRepository {
  return new PgUserRepository();
}
