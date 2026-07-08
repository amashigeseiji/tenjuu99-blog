# Observations: error-visibility

**日時:** 2026-07-08

## 実装中の気づき

- 設計方針の修正がユーザーフィードバックで確定した: 当初案は「ログ保存を主、画面は段階と確認先のみ」
  だったが、「エラー内容は画面に出てよい。ログの溜め込みが懸念」との指摘を受け、
  「画面表示が主（見出し＋出力末尾20行＋ログの場所）、診断ログは補助で直近数回分のみ保持」に変更した。
  problem.md 申し送りの「エラー内容の提示とログの保存のどちらを主とするか」への回答になっている
- scaffold.sh は JS コンテキスト前提（ssg-core/editor/category/app-bundle の分岐）で、
  native-shell（Swift）は対象外。既存 Swift 規約（NativeShellCore + 自作ハーネス CoreTests）に
  合わせて手動でスキャフォールドした。native 系プランが続くなら scaffold.sh への分岐追加が候補
- 依存グラフの孤立ノードチェック（7.5）は depgraph が JS 前提
  （entry_points: bin/*, lib/server/**）のため Swift ファイルを扱えずスキップした。
  代替として、ルート合成テストと AppDelegate への配線で全ノードが構成に参加していることは確認済み
- problem.md の `**作業ディレクトリ:** /Users/amashige/dev/tenjuu99-blog` は存在しないパス。
  実際の作業場所は /Users/amashige/dev/private/tenjuu99-blog（メタレポと同一）だった
- ポート衝突の境界: 他プロセスが 8000 番を専有していると ServerReadinessDetector が
  ready と誤判定し、編集画面表示→サーバー異常終了の観測で「起動後障害」と表示される
  （実際は起動失敗）。失敗段階の判定は「編集画面に到達したか」を境界にしており、
  ポートの主が誰かまでは見ていない。既存からある制約で今回のスコープ外だが、
  症状の2パターン切り分け精度に関わるため記録しておく
- 実機での画面提示の確認（.app 起動による E2E）は自動実行をユーザーが拒否したため、
  手動検証手順を受け入れテスト（tests/acceptance/error-visibility.spec.ts）の skip 理由に
  記録して委ねた。dist-app/tenjuu99-blog.app は新バイナリで再構築済み
- 5回連続失敗などの詰まりはなし。全4葉が初回実装で green
