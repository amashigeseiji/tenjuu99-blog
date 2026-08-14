# Observations: editor-diagnosis

**日時:** 2026-08-14

## 工程の入口で確定した事実

- 再節合型（入口文書: diagnosis.md）。再設計案は案B（クライアント側の装置分割＋基盤くくり出し、およびサーバーハンドラー基盤の導入）を軸に進めることをユーザーが承認（正式決定は手順5）
- 本工程で触らないと確定した診断・申し送り項目（ユーザー承認済み）:
  - editor→lib の node_modules 自己参照コピー経由の実行時依存（既知の別問題）
  - in_scope「AIへの相談」の実装先行宣言（別プラン editor-claude-integration の仕事）
  - depgraph がパッケージ名自己参照 import を解決しない件（診断ツールの改善）
  - スコープ外の徴候（server / dev-server / native-shell の tests 不在、check-vocab の src 未注釈警告）

## 被覆確認・挙動保存で確定した事実

- 回帰面: 台帳の行為18件（作成者）＋間接2件（アプリ利用者: パッケージ解決系）。witness 全緑を確認（78 passed。恒常スキップは手動確認と記録されたシナリオのみ）
- **未登記挙動2件**（コードと witness にあるが台帳に act が無い。feedback の拍で登記判定へ）:
  - リモートの内容を手元に取り込める（pull）— witness: tests/acceptance/sync-operations.spec.ts US-03（5シナリオ・緑）
  - 検出できない参照の宣言 — witness: tests/acceptance/editor-image-library-publication-state.spec.ts US-06（緑）
- 公開ステータスは現在ブランチの upstream（`@{u}`）から導出されるため、upstream の無いブランチでは editor-sidebar-status シナリオ4が落ちる。`git push -u` で解消（ユーザー承認済み）。**受け入れテストの前提として upstream が必要**という事実は今後のセッションでも効く
- 外から入ってくる依存は lib/distribute.js → server/createConverter.js の1辺のみ（grep 実測）。createConverter のインターフェースを変えない限りビルドへの影響なし

## 実装中の気づき

- editor.js のドロップ処理（738行付近）は、既存の Markdown挿入器（js/image_upload.js の insertImageMarkdown）を使わずに挿入をインラインで再実装している。診断の「同型の重複」一覧に未掲載の断片
  →合成で解消: ドロップレシーバーを dropReceiver.js へ移設する際に insertImageMarkdown の利用へ置換した

## 合成（2026-08-14）で確定した事実

- 挙動保存: 移設完了後、ユニットテスト 509 件全緑（基線 458 から 51 件増）、受け入れテスト 81 passed / 0 failed / 22 skipped（基線 78 passed 以上・失敗ゼロ）
- editor.js は composition root になった（956行 → 398行。装置の生成・接続・イベント配線のみ）。DOM なしで import 可能（node での import を実測確認）
- witness 未確立だった3語すべてにユニットテストが張れた: 確認ダイアログ（confirmDialog.test.js）・サイドバータブ（sidebarTabs.test.js）・サイドバー取得エンドポイント（sidebarEndpoint.test.js）。加えて新規作成UIの「手動確認のみ」スキップ5件のうち4件を実テスト化した

## 残余に無かった断片の帰属（実装者判断）

- initSidebarTabs（タブ切り替え）は残余の列挙に無かったが、editor.js を配線のみにする方針と衝突するため sidebarTabs.js へ移設した。帰属先は既存語彙「サイドバータブ」（新語彙なし）。タブごとの副作用（画像一覧取得・画像詳細からの離脱・新規作成フォーム初期化）はコールバックで composition root に残した

## 定型統一に伴う文言・挙動の微差（操作実行器への一本化）

- リモートのみ画像の除去: ネットワーク例外時の文言が「取り除けませんでした: <例外メッセージ>」から操作実行器の共通文言「サーバーに接続できませんでした。…」に変わった。また成功時にボタンの disabled が解除されるようになった（一覧が描き直されるため実害なし）
- 公開の失敗文言は res.ok の真偽で従来の2種のフォールバック（「サーバーに接続できませんでした」/「不明なエラー」）を使い分ける形で保存した
- サーバー側: image_declaration / move_image / delete_image は従来 業務処理部に try/catch が無く例外がそのまま伝播していたが、ハンドラー基盤の導入で 500 応答に変換されるようになった（挙動改善方向の変化）

## ブラインドレビューの清算（2026-08-15・review.md 参照）

- 総合: 理解容易性・拡張容易性・匿名処理の解消は向上。頑健性はサーバー側で向上、クライアント側で一点後退が指摘された
- **利用仮説と食い違った観測**: 記事読み込みのネットワーク失敗時フォールバックが移設で失われていた（旧 fetchData は catch、新 loadArticle は throw のまま放置）。頑健性向上の仮説に対する反例 → 即時対応で showArticleInPlace に catch を復元し、bootstrap の初期読み込みも showArticleInPlace（syncActive: false）に統一して「記事を開く手順」の重複を解消した
- 即時対応（ユーザー承認済み）: 上記2件＋sidebar.js（展開状態・ツリー初期化）の実テスト追加。対応後もユニット513全緑・受け入れ 81 passed / 0 failed
- 持ち越し（差し戻し判断は tdd-feedback）:
  - サーバー応答方式の3系統併存（ハンドラー基盤 / `{status, contentType, body}` 返却の get_editor_target・get_frontmatter_templates・get_image_library / 手書き pull.js）。承認済みツリーの移設元12＋get_sidebar の範囲外
  - サイドバークリック委譲ハンドラー約50行（remote-only 選択フロー含む）が最大の無名・未検査ロジック。装置化はツリーに無い新ノードを要する
  - パス逸脱ガードが publish / unpublish / delete に三重残存（本質的重複。共通化先の語彙が未定）
- 対応不要: テストの makeFakeRes 2ファイル重複（局所的便宜。3箇所目が出たら共通化）

## 辞書・ツーリング関連の観察（feedback の拍で扱う）

- docs 層（安定層）の src が移設前の editor.js を指したままの概念が6件: テンプレートレゾルバー・ドロップレシーバー・ドロップレシーバー拡張・画像アップローダー・新規作成UI・確認ダイアログ。docs/dictionary.json は /tdd-vocab promote 経由でのみ更新するため、このセッションでは触っていない（check-vocab の [src不一致] 警告として観測される）
- wip 10概念（プラン辞書）の src・@vocab・@test は check-vocab エラーなし
- 依存グラフの孤立ノード検査: クライアント16モジュールはすべて editor.js（エントリ）から到達可能。packages/editor/server/*.js は lib/server の動的登録（ディレクトリスキャン）経由のため静的グラフでは依存元ゼロに見える — 既知の検査上の限界で、偽陰性ではない
- scaffold.sh は docs/dictionary.json のみを逆引きするため、plans 層にしか無い新概念の @vocab が英語名にフォールバックした（生成後に手で日本語名へ修正した）
