import type * as Y from "yjs";
import {
  applyRemoteUpdate,
  encodeStateAsUpdate,
  encodeStateVector,
  fromBase64,
  REMOTE_ORIGIN,
  toBase64,
} from "./templateDoc";

const DEFAULT_DEBOUNCE_MS = 500;
const DEFAULT_POLL_MS = 30_000;

/**
 * server の `templates.sync` を呼ぶための最小契約 (実体は trpc client。test では
 * mock を渡せるよう interface 化)。
 */
export interface SyncMutator {
  mutate(input: {
    clientStateVector: string;
    clientUpdate?: string;
  }): Promise<{ serverUpdate: string; serverStateVector: string }>;
}

export interface TRpcSyncProviderOptions {
  doc: Y.Doc;
  sync: SyncMutator;
  onError?: (err: unknown) => void;
  /**
   * test 注入用フラグ。`true` (default = `typeof window !== "undefined"`) で
   * window event listener と setInterval poll を登録する。test では false にして
   * 手動 `sync()` を呼ぶ。
   */
  enableBackgroundTriggers?: boolean;
  debounceMs?: number;
  pollMs?: number;
}

/**
 * Yjs の Y.Doc を tRPC `templates.sync` 経由でサーバと双方向同期する provider
 * (ADR 0004)。
 *
 * トリガー:
 *  - 起動直後 1 回
 *  - ローカル update (origin !== REMOTE_ORIGIN) → debounce 500ms
 *  - window focus / online
 *  - 定期 poll 30s
 *
 * `origin === REMOTE_ORIGIN` のループ抑止を必ず効かせること (server から受けた
 * update を再 push すると永久ループ)。エラー時はリトライキューを持たず、次の
 * トリガーで自動再試行する。
 */
export class TRpcSyncProvider {
  private lastServerStateVector: Uint8Array | undefined;
  private pending = false;
  private debounceHandle: ReturnType<typeof setTimeout> | undefined;
  private pollHandle: ReturnType<typeof setInterval> | undefined;
  private destroyed = false;
  private readonly debounceMs: number;
  private readonly enableBackground: boolean;

  private readonly updateHandler = (_update: Uint8Array, origin: unknown) => {
    if (origin === REMOTE_ORIGIN) return;
    this.scheduleSync();
  };
  private readonly focusHandler = () => {
    void this.sync();
  };
  private readonly onlineHandler = () => {
    void this.sync();
  };

  constructor(private readonly opts: TRpcSyncProviderOptions) {
    this.debounceMs = opts.debounceMs ?? DEFAULT_DEBOUNCE_MS;
    this.enableBackground =
      opts.enableBackgroundTriggers ?? typeof window !== "undefined";

    opts.doc.on("update", this.updateHandler);
    if (this.enableBackground && typeof window !== "undefined") {
      window.addEventListener("focus", this.focusHandler);
      window.addEventListener("online", this.onlineHandler);
      this.pollHandle = setInterval(
        () => void this.sync(),
        opts.pollMs ?? DEFAULT_POLL_MS,
      );
    }
    void this.sync();
  }

  destroy(): void {
    this.destroyed = true;
    this.opts.doc.off("update", this.updateHandler);
    if (this.enableBackground && typeof window !== "undefined") {
      window.removeEventListener("focus", this.focusHandler);
      window.removeEventListener("online", this.onlineHandler);
    }
    if (this.pollHandle !== undefined) {
      clearInterval(this.pollHandle);
      this.pollHandle = undefined;
    }
    if (this.debounceHandle !== undefined) {
      clearTimeout(this.debounceHandle);
      this.debounceHandle = undefined;
    }
  }

  private scheduleSync(): void {
    if (this.destroyed) return;
    if (this.debounceHandle !== undefined) clearTimeout(this.debounceHandle);
    this.debounceHandle = setTimeout(() => {
      this.debounceHandle = undefined;
      void this.sync();
    }, this.debounceMs);
  }

  async sync(): Promise<void> {
    if (this.destroyed || this.pending) return;
    this.pending = true;
    try {
      const clientSV = encodeStateVector(this.opts.doc);
      const clientUpdate = this.lastServerStateVector
        ? encodeStateAsUpdate(this.opts.doc, this.lastServerStateVector)
        : encodeStateAsUpdate(this.opts.doc);

      const res = await this.opts.sync.mutate({
        clientStateVector: toBase64(clientSV),
        clientUpdate:
          clientUpdate.byteLength > 0 ? toBase64(clientUpdate) : undefined,
      });

      const serverUpdate = fromBase64(res.serverUpdate);
      if (serverUpdate.byteLength > 0) {
        applyRemoteUpdate(this.opts.doc, serverUpdate);
      }
      this.lastServerStateVector = fromBase64(res.serverStateVector);
    } catch (err) {
      this.opts.onError?.(err);
    } finally {
      this.pending = false;
    }
  }
}
