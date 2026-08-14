# 診断: エディタ context

**バージョン:** v1
**最終更新:** 2026-08-14
**スコープ:** editor context（packages/editor/、テストは tests/editor/）
**由来:** トリアージ起点
**診断の条件:**
- acts.json（行為の登記簿）が存在しないため、挙動側の機械的突き合わせは実施できず、ブラインド復元テストは辞書のみを資料とした
- 依存グラフは `@tenjuu99/blog/...` のパッケージ名自己参照 import を解決しないため editor→lib の辺が全て欠落しており、境界の辺は import 文の実測（grep）で補完した（グラフの盲点確認として。ツールの改善は申し送りに記載）

**性格:** 現状コードの診断のスナップショット。再設計案は書かない（考察は /tdd-run 再節合の仕事）。

## 変更履歴

### v1 (2026-08-14)
- 初版

---

## 軸ごとの診断

### 理解容易性

- `packages/editor/js/editor.js`（約950行・直近300コミットで46回変更）に、確認ダイアログ・テンプレートレゾルバー・公開可否判定器・自動保存・新規作成UI・取り込む・削除する・非公開にする・サイドバータブ・画像アップローダー・ドロップレシーバー・画像ライブラリ・画像詳細表示など**17前後の語彙概念が同居**している。辞書は各概念を独立の装置として定義しているのに、実装はこの1ファイルに集積しており、辞書の粒度と実装の粒度が乖離している。「何をするか」が一言で言えない
- `onloadFunction`（editor.js 内）は約470行の単一関数で、内部クロージャ同士が相互参照する
- モジュールレベルの可変束縛（`switchSidebarTab`・`reloadCurrentArticle`・`_imageLibraryEntries`・`_currentImageDetailEntry`）を複数の関数が書き換えて連携しており、実行順を追わないと状態が読めない
- describe() の形はおおむね良好だが、「画像ライブラリ は…確認できる **ができる**」型の二重可能形が2件、`<details>` タグ・`class="active"` 等の技術語混入が数件ある

### 拡張容易性

- **fetch+フィードバック定型の5回展開**: publish / unpublish / delete / pull / リモートのみ画像除去が、「ボタン無効化→『〜中...』→POST→success/error 分岐→サイドバー更新」という同型のまま editor.js 内に別々に書かれている。「サーバーに接続できませんでした。しばらくしてから…」という文言が5箇所に散在。操作を1つ足すたびに同型を書き足す構造
- **HTTPハンドラー定型の12ファイル反復**: `parseJsonBody`→400応答→try/catch→500応答→`return true` の形式が `packages/editor/server/` の12ファイルで手書き反復されている（詳細は「発見の観察」）
- `.sidebar a[href="/editor?md=..."]` によるアクティブ状態同期のセレクタ照合が editor.js 内の5箇所に散在（アクティブ状態同期という一つの関心が散らばっている）
- `uploadImage` と `addLibraryImage`（editor.js）はほぼ同型（base64化→POST /upload-image）

### 頑健性

- editor.js はモジュール先頭で `document` を参照する（確認ダイアログの要素取得）ため DOM なしでは import 自体ができず、**witness が張れない**。テスト可能なロジックは小モジュールへ抽出する運用が確立している（tree.js・debouncer.js・publishAvailability.js 等）が、editor.js に残った配線とフロー（インプレース読み込み・popstate 再構成・リモートのみ記事の分岐・サイドバータブ）は単体テスト不能のまま
- テスト接続が張れていない語（サイドバー取得エンドポイント・サイドバータブ・確認ダイアログ）は、いずれも editor.js または薄いハンドラーにインライン実装されている概念で、上記の構造に起因する
- editor→lib の実行時依存（23ファイル・54辺）は node_modules 内の `@tenjuu99/blog` 自己参照コピー経由で、コピーの鮮度に挙動が依存する既知の問題と同じ機構の上にある

### 匿名の処理

- @vocab ゼロのファイル: `packages/editor/server/preview.js`（63行。`inlineStyles` という非自明な処理を含む）、`server/get_editor_target.js`（32行）、`server/get_publication_status.js`（29行）、`helper/sidebarTree.js`、`js/error.js`
- editor.js 内の `fetchData` / `submit` / `loadFileInPlace` / `leaveImageDetail` には @vocab が無く、**「URLが資源を特定し表示はURLから再構成される」という中核の振る舞いが辞書から指せない**（復元テストの像にもエントリーポイントとして現れなかった）

## 復元テストのギャップ

- **【想像と違う → 辞書の陳腐化】プレビュー**: 辞書「プレビュー」は「開発サーバーが生成した HTML が `<iframe>` 内に埋め込まれる」と定義するが、実装は専用 `/preview` エンドポイント（`server/preview.js`）が `lib/render` を直接呼んで未保存内容を描画し、CSS をインライン化して返す。像は「保存 → dev-server の再ビルド → iframe 更新」の連鎖を仮定して外した
- **【コードにあって想像に無い → 辞書 src の記載不足】**: 「取り込む」「非公開にする」「削除する」は辞書の src が null のため、像は「可否判定だけ先行実装の可能性が高い」と推定した。実際は `server/pull.js` / `unpublish.js` / `delete.js` / `deleteArticle.js` と editor.js の UI 配線が実在し、@vocab 注釈もある。「ツリービルダー」も src: null だが `buildTree` は `js/tree.js` に実在
- **【記述の不足】エンドポイントの URL パス**: 辞書に明記されているのは `/save` と `/get_sidebar` のみ。実際は `/upload-image`（像の推定は `/image_upload` 相当）・`/publication-status`（同 `/get_publication_status`）など、推定と食い違うパスが多数
- **【一致】外部依存の仮定**: config・dir・parseRequestBody・publishing の公開手段/リモート状態・pageData・render への依存は実測54辺とほぼ一致。`lib/distribute.js` →「コンバーターファクトリー」の逆向き依存も辞書（「ビルド画像配布器」の relations）に記録済みで、像・実測とも一致した。語彙の連結の質は高い
- **【ギャップではないが記録】**: in_scope の「AIへの相談」は対応語彙ゼロ・実装ゼロ（plans/editor-claude-integration が未着手）。in_scope の宣言が実装に先行している

## 発見の観察

1. **HTTPハンドラー定型の反復**: `parseJsonBody` → 400応答 → try/catch → 500応答 → `return true` の同じ形式が `packages/editor/server/` の12ファイル（publish.js・unpublish.js・delete.js・delete_image.js・move_image.js・image_upload.js・image_declaration.js・remove_remote_image.js・get_publication_status.js・get_image_references.js・preview.js・save.js）に独立して書かれている。server context の「サーバーハンドラー」規約の上に、各ハンドラーが同じやり取りの形を手書きしている
2. **fetch+フィードバック定型の反復**: editor.js 内の publishWithFeedback / unpublishWithFeedback / deleteWithFeedback / pullWithFeedback / wireRemoteOnlyImageRemoval の5箇所が、「ボタン無効化 → 進行中表示 → POST → success/error 分岐 → 完了表示 → サイドバー更新」という同じ形をしている。エラーメッセージ文言も同一のものが5箇所にある
3. **base64アップロードの2実装**: editor.js の `uploadImage` と `addLibraryImage` が、ArrayBuffer→base64→POST /upload-image という同じ形の処理を別々に持っている
4. **アクティブ状態同期のセレクタ照合**: `.sidebar a[href="/editor?md=..."]`（または `?image=`）による DOM 照合が editor.js 内の5箇所（公開ステータス描画・インプレース読み込み・ツリー初期化・画像詳細を離れる・画像詳細を開く）に同じ形で現れる

## /tdd-run への申し送り

- **語彙の種**: editor.js 内で @vocab の付いていない中核の振る舞い——「インプレース読み込み」「URL と表示の同期（fetchData / submit / loadFileInPlace / leaveImageDetail）」——は、既存の「表示対象」「表示対象解決器」と連結する語彙候補。preview.js の `inlineStyles`（プレビューの CSS 自己完結化）も名前を持たない
- **辞書の更新候補（/tdd-vocab 経由。stable のため承認が要る）**:
  - 「プレビュー」の定義が実装（専用 `/preview` エンドポイントによる未保存内容の描画）と乖離している
  - src: null のエントリへの追記——「取り込む」→ server/pull.js、「非公開にする」→ server/unpublish.js、「削除する」→ server/delete.js・deleteArticle.js、「ツリービルダー」→ js/tree.js ほか
  - エンドポイントの URL パス（/upload-image・/publication-status 等）が辞書からほぼ導けない
- **describe の形の是正候補**（ツリーと対応するため単独では触らなかった）: 「〜できる ができる」型の二重可能形が2件（画像ライブラリ系）、`<details>`・`class="active"` 等の技術語混入が数件
- **witness の張り方が未確立の3語**: サイドバー取得エンドポイント・サイドバータブ・確認ダイアログ。editor.js の構造改善と不可分
- **診断ツールの盲点**: `.claude/tdd/depgraph-regen.sh` が生成する依存グラフはパッケージ名自己参照 import（`@tenjuu99/blog/...`）を解決しない。今後の境界の辺の診断の精度に関わる
- **スコープ外として観察した徴候**（別の診断セッションの候補）: server / dev-server / native-shell は stable context だが対応する tests/ ディレクトリが無い。check-vocab の src 未注釈警告（lib/watcher.js・AppDelegate.swift・バンドルマニフェスト）も未対応
