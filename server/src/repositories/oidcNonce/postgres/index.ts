import type { Comp, Cursor, Page } from "@/models/common";
import type { OidcNonce } from "@/models/oidcNonce";
import type { DbReadCtx, DbWriteCtx } from "@/repositories/common";
import type { OidcNonceRepository as IOidcNonceRepository } from "../repository";
import { count } from "./count";
import { del } from "./delete";
import { get } from "./get";
import { list } from "./list";
import { upsert } from "./upsert";

export class OidcNonceRepository implements IOidcNonceRepository {
  async get(
    ctx: DbReadCtx,
    spec: Comp<OidcNonce.Spec>,
  ): Promise<OidcNonce | null> {
    return get(ctx.db, spec);
  }
  async list(
    ctx: DbReadCtx,
    spec: Comp<OidcNonce.Spec>,
    cursor: Cursor<OidcNonce.SortKey>,
  ): Promise<Page<OidcNonce>> {
    return list(ctx.db, spec, cursor);
  }
  async count(ctx: DbReadCtx, spec: Comp<OidcNonce.Spec>): Promise<number> {
    return count(ctx.db, spec);
  }
  async upsert(ctx: DbWriteCtx, nonce: OidcNonce): Promise<void> {
    return upsert(ctx.db, nonce);
  }
  async delete(ctx: DbWriteCtx, spec: Comp<OidcNonce.Spec>): Promise<number> {
    return del(ctx.db, spec);
  }
}
