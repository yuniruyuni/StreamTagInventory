import { SessionRepository as PgSessionRepository } from "./postgres";
import type { SessionRepository } from "./repository";

export type { SessionRepository };

export function createDefault(): SessionRepository {
  return new PgSessionRepository();
}
