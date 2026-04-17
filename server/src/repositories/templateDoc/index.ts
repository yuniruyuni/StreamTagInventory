import { TemplateDocRepository as PgTemplateDocRepository } from "./postgres";
import type { TemplateDocRepository } from "./repository";

export type { TemplateDocRepository };

export function createDefault(): TemplateDocRepository {
  return new PgTemplateDocRepository();
}
