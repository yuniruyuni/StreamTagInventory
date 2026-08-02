# License notice overrides

公開されたnpmパッケージにライセンス本文が同梱されていない場合に限り、上流リポジトリで
確認した本文をここに保持します。

- コンポーネント固有のoverrideは、生成スクリプトで`package名@version`に固定します。
- パッケージ同梱のLICENSE・COPYING・COPYRIGHT・NOTICEを常に優先します。
- 依存更新でoverrideが未使用になった場合、生成処理を失敗させて再確認を促します。
- このディレクトリは生成物ではなく、レビュー済み入力データとしてGit管理します。
