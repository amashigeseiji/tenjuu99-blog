# Observations: editor-diagnosis

**日時:** 2026-08-14

## 工程の入口で確定した事実

- 再節合型（入口文書: diagnosis.md）。再設計案は案B（クライアント側の装置分割＋基盤くくり出し、およびサーバーハンドラー基盤の導入）を軸に進めることをユーザーが承認（正式決定は手順5）
- 本工程で触らないと確定した診断・申し送り項目（ユーザー承認済み）:
  - editor→lib の node_modules 自己参照コピー経由の実行時依存（既知の別問題）
  - in_scope「AIへの相談」の実装先行宣言（別プラン editor-claude-integration の仕事）
  - depgraph がパッケージ名自己参照 import を解決しない件（診断ツールの改善）
  - スコープ外の徴候（server / dev-server / native-shell の tests 不在、check-vocab の src 未注釈警告）

## 実装中の気づき

- （随時追記）
