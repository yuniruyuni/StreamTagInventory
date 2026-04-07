// CallbackClient はリポジトリ層から presentation → usecase を
// 再帰的に呼び出すためのインターフェース。
// リポジトリが外部イベント（プロセス完了、Webhook 受信など）を
// 検知した際、usecase を直接参照せずにこのインターフェース経由で
// ビジネスロジックを起動する。
//
// 新しいコールバックが必要になったらここにメソッドを追加し、
// CallbackClientImpl と対応する router で実装する。
export interface CallbackClient {
  ping(): Promise<void>;
}
