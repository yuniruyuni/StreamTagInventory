import type { Comp, Cursor, Page } from "@/models/common";
import type { OidcNonce } from "@/models/oidcNonce";
import type { DbReadCtx, DbWriteCtx } from "../common";

export interface OidcNonceRepository {
  get(ctx: DbReadCtx, spec: Comp<OidcNonce.Spec>): Promise<OidcNonce | null>;
  list(
    ctx: DbReadCtx,
    spec: Comp<OidcNonce.Spec>,
    cursor: Cursor<OidcNonce.SortKey>,
  ): Promise<Page<OidcNonce>>;
  count(ctx: DbReadCtx, spec: Comp<OidcNonce.Spec>): Promise<number>;
  upsert(ctx: DbWriteCtx, nonce: OidcNonce): Promise<void>;
  delete(ctx: DbWriteCtx, spec: Comp<OidcNonce.Spec>): Promise<number>;
}
