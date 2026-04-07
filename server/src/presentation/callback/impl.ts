import type { CallbackClient } from "../../infra/callback/client";
import type { Context } from "../../usecases/context";

// CallbackClientImpl は presentation 層に属し、
// コールバック発火時に Context 経由で usecase を呼び出す。
//
// 初期化順序:
//   1. new CallbackClientImpl()     — repos 構築前に作成
//   2. repos に注入                  — コールバックが必要なリポジトリに渡す
//   3. callbackClient.initialize()  — Context 構築後に遅延初期化
//
// 新しいコールバックメソッドを追加する際は:
//   1. CallbackClient インターフェースにメソッドを追加
//   2. ここに実装を追加（対応する router を呼ぶ）
//   3. presentation/callback/routers/ に router を作成
export class CallbackClientImpl implements CallbackClient {
  private ctx: Context | null = null;

  initialize(ctx: Context): void {
    this.ctx = ctx;
  }

  protected getCtx(): Context {
    if (!this.ctx) throw new Error("CallbackClient not initialized");
    return this.ctx;
  }

  async ping(): Promise<void> {
    this.getCtx();
  }
}
