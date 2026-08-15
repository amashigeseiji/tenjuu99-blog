# editor リファクタリング レビュー

対象: 作業ツリーの未コミット変更のうち `packages/editor/` と `tests/editor/`（`git diff HEAD` の変更 18 ファイル + 未追跡 28 ファイル）。
根拠はコード・テスト・diff のみ。設計資料・計画資料は参照していない。

## 変更の概要（事実）

- クライアント: `packages/editor/js/editor.js` を 956 行 → 399 行に縮小。旧ファイルに埋め込まれていた処理を 15 の新モジュール（`operationExecutor.js`、`imageLibraryView.js`、`displayTargetNavigator.js`、`activeStateSynchronizer.js`、`publicationStatusView.js`、`previewRenderer.js`、`articleLoader.js`、`autoSave.js`、`confirmDialog.js`、`templateResolver.js`、`imageUploader.js`、`dropReceiver.js`、`newFileCreationUI.js`、`sidebar.js`、`sidebarTabs.js`）へ抽出。editor.js は「composition root（DOM 取得・配線・接続のみ）」と宣言する構成に変わった。
- サーバー: `packages/editor/server/handlerFoundation.js` を新設し、JSON エンドポイント 13 ファイル（delete / delete_image / get_image_references / get_publication_status / get_sidebar / image_declaration / image_upload / move_image / preview / publish / remove_remote_image / save / unpublish）を `createJsonPostHandler` / `createJsonGetHandler` に載せ替え。各ハンドラーは「body（または URL）を受け取り `{ status?, body }` を返す業務処理」だけになった。
- テスト: 新規 12 ファイル（約 700 行）。既存 3 ファイルでは `it('TODO')` や `{ skip: true }`（手動確認のみ）だったプレースホルダーが実テストに置き換わった。`npm test` は 505 pass / 0 fail / 4 skip。

総合判定: **理解容易性・拡張容易性・匿名の処理の解消は明確に向上。頑健性はサーバー側で向上、クライアント側で一点後退。** 以下、観点別。

---

## 1. 理解容易性 — 向上

**よくなった点**

- 旧 editor.js は、import 時に DOM を触るトップレベルコード（旧 18–20 行目の `confirmDialogEl` など）、モジュールレベルの可変状態（`_frontmatterTemplates`、`_imageLibraryEntries`、`_currentImageDetailEntry`）、後から差し替えられる関数変数（`let switchSidebarTab = () => {}`、`let reloadCurrentArticle = async () => {}`）で概念間の依存が追えなかった。新構成では各装置が factory（`createXxx`）となり、状態は closure に閉じ、装置間の依存は editor.js の `bootstrap` で明示的に配線される。「どの装置が何を知っているか」が引数リストから読める。
- 各新モジュール冒頭の JSDoc が「何を引き受け、何を委ねるか」を一文で述べており（例: `displayTargetNavigator.js`「ナビゲーターは URL と表示の一致だけを引き受ける」、`imageLibraryView.js`「操作の配線は wireDetailOperations に委ねる」）、初見でも責務境界が分かる。
- サーバー側は、旧ハンドラーごとに書かれていた parse → 400/413 → try/catch → writeHead の定型が消え、業務処理（バリデーション → 実行 → `{ status, body }`）だけが残った。`delete.js` は 79 行 → 46 行で、公開状態チェックの流れが一目で追える。

**悪くなった点・残る難所**

- editor.js の `bootstrap` 内で `imageLibrary`（71 行目で使用、168 行目で定義）、`navigator`（98 行目で使用、176 行目で定義）、`tabs`（180 行目で使用、187 行目で定義）が定義前に closure 参照される。実行順序上は正しいが、初見の読み手は循環配線を頭の中で解決する必要がある。
- ローカル変数 `navigator`（editor.js 176 行目）がグローバル `window.navigator` を隠す。bootstrap 内で `navigator.clipboard` 等を使う将来の変更が静かに壊れる命名。
- `showArticleInPlace` の `{ syncActive = true }` オプション（editor.js 70 行目）はどの呼び出しも指定しておらず死んでいる。一方で初期化ブロック（376–385 行目）は「syncActive を呼ばない article 読み込み」をインラインで重複実装している。オプションを使えば統一できたはずで、読み手に「なぜ使い分けているのか」という偽の問いを残す。

## 2. 拡張容易性 — 向上

**よくなった点**

- 新しい JSON エンドポイントの追加は「業務処理を書いて `createJsonPostHandler` に包む」だけになった。応答の定型・エラー整形・ログを再実装する必要がない。エラー応答の形の差（`{success, error}` 系と `{message}` 系）も `errorBody` / `catchBody` オプションで既存互換のまま吸収されており（`image_upload.js`、`preview.js`、`save.js`）、移行が挙動を変えていない。
- クライアントの新しい操作（公開・削除のような fetch + フィードバック + 後処理）は `operationExecutor` に operation 記述を渡すだけで足りる。実際に editor.js 内の publish / unpublish / delete / pull / remote-only 除去の 5 操作が同じ定型に乗り、旧コードで 5 回書かれていた disabled 制御・try/catch・接続失敗文言が消えた。
- 装置が fetchFn / doc / storage を注入可能なので、次の変更で「テストを書いてから触る」着手が現実的になった。

**悪くなった点・残る面**

- **サーバー側の移行が不完全。** `get_editor_target.js`、`get_frontmatter_templates.js`、`get_image_library.js` は旧来の `{ status, contentType, body }` 返却方式、`pull.js` は手書き `writeHead`/`end` + try/catch のまま。`packages/editor/server/` には現在 3 つの応答方式が併存し、次にエンドポイントを触る人はどれに合わせるべきか diff を読まないと判断できない。移行するか、しない理由を残すべき。
- パス逸脱ガード（`nodePath.resolve` + `startsWith(pagesDir + sep)`）が `delete.js`・`publish.js`・`unpublish.js` に三重に残り、`get_publication_status.js` は `normalize` による別実装。今回の基盤化はここを畳む好機だったが手つかず（後述の重複参照）。
- editor.js の配線密度は高く、画像詳細まわりの一変更（例: 操作追加）は `wireDetailOperations` + `imageLibraryView` + 該当 UI モジュールの 3 箇所に触れる。委譲構造の対価として許容範囲だが、狭くはなっていない。

## 3. 頑健性 — サーバー側は向上、クライアント側に一点の後退

**よくなった点**

- 旧 `delete_image.js`・`move_image.js`・`image_declaration.js`・`save.js`・`preview.js` は業務処理を try/catch で囲っておらず、例外は `lib/tryServer.js` の catch（ログのみ・応答なし）に落ちて **リクエストが応答されないまま宙吊り**になり得た。`createJsonPostHandler` が一律に 500 応答へ変換するようになり、この穴が全ハンドラーで塞がれた。実質的な頑健性向上。
- `handlerFoundation.test.js` が 400/413/500・errorBody/catchBody 差し替え・`handled === true` を直接検証しており、定型の振る舞いが仕様として固定された。
- クライアントでも `operationExecutor` が `res.json().catch(() => ({}))`・finally での disabled 解除・接続失敗文言の一本化を保証し、旧コードで操作ごとに微妙に違った失敗処理が揃った。旧 delete 成功時の「onload 時に捕まえた古い `url` オブジェクトで pushState する」挙動も `navigator.declareTarget(null)`（現在の location 起点）に置き換わり修正されている。

**悪くなった点（後退）**

- **記事読み込みのネットワーク失敗が未処理になった。** 旧コードは `fetchData` の失敗を初期表示では `.catch`（旧 96–100 行目）、リンククリックでは `loadFileInPlace` 内 try/catch（旧 413–422 行目）で受け、`setCurrentFile(target)` にフォールバックしていた。新 `articleLoader.loadArticle` は `!res.ok` のみ扱い、fetch 自体の reject（サーバー一時停止など）はそのまま throw する。呼び出し側 `showArticleInPlace`（editor.js 70–80 行目）にも catch はないため、(a) サイドバークリック・popstate では unhandled rejection、(b) `bootstrap` の初期読み込み（378 行目）で起きると **以降の `navigator.init()`（popstate 配線）と画像詳細復元がスキップされたまま画面が動き続ける**。旧コードは初期読み込みを fire-and-forget にしていたため初期化は完走していた。明確なリグレッション。
- 軽微: `handlerFoundation.js` 37 行目 `maxSize ? { maxSize } : {}` は 0 を「指定なし」に落とす（現状 0 を渡す呼び出しはない）。`image_upload.js` は `console.error(e)` してから rethrow するため wrapper と二重ログになる。

## 4. 匿名の処理 — 大幅に減少。残りは composition root に集中

**解消されたもの（代表）**: 旧 editor.js に埋まっていた「フィードバック付き操作の定型」（publishWithFeedback ほか 5 箇所のコピー）、画像ライブラリの取得・保持・描き直し、URL 宣言と履歴操作（`history.pushState` の生操作が 6 箇所に散在していた）、アクティブ表示の href 照合（3 箇所）。いずれも名前（@vocab）と専用テストを持つ装置になった。旧テストの `it('TODO')`（ドロップレシーバー・画像アップローダー）と `{ skip: true }`（新規作成 UI の 5 項目）が実テストに置き換わったのは、匿名だった振る舞いが検査対象になったという意味で本質的な改善。

**残っている匿名の処理（量: editor.js の約 250 行 + sidebar.js 全体）**

1. **editor.js のサイドバークリック委譲ハンドラー（307–355 行目、約 50 行）。** 画像リンク分岐・remote-only 記事の pull/remove 選択フロー・同一記事クリックの無視条件という実質的な分岐ロジックを含むが、名前を持つ装置ではなく、どのテストにも接続されていない。composition root は「配線のみ」を掲げるが、この部分は配線を超えた判断を持つ。→ **正当とは言い難い**。装置化（またはハンドラー関数の抽出とテスト）の余地が残る。
2. **`leaveImageDetail`・`showArticleInPlace`・`wireDetailOperations`（editor.js 70–147 行目）。** 装置間の接続そのものなので composition root に置く判断は理解できるが、`leaveImageDetail` は URL 状態の分岐を持ち、旧コードから複雑さが減っていない。→ **境界事例**。接続だけなら正当、分岐を持つ部分は次の抽出候補。
3. **`sidebar.js`。** 抽出はされたが、`@test tests/editor/editor-sidebar.test.js` の指す先は `tree.js`（buildTree/renderTreeHtml）のテストであり、`loadDirOpenState` / `initSidebarTree` / `initSidebarContent` / `initSidebarToggle` 自体を検査するテストは存在しない。**アノテーションが実態と食い違っており、名前は付いたが検査されない処理**として残る。storage 注入まで整えてあるのにテストがないのはやり残しに見える。
4. `newFileCreationUI` の画像モード分岐（60–70 行目）: 記事モード 4 ケースはテストされたが、画像追加モード（addImage 失敗時の error 表示・成功時の入力リセット）は未検査。
5. `bootstrap` の初期化順序（368–392 行目）: コメントは充実しているが順序依存（配線 → fetch → navigator.init）自体は検査されない。composition root の性質上 **正当**と判断するが、上記 3. の後退（初期化中断）と組み合わさると壊れても気づきにくい。

## 5. 範囲内の重複

1. **記事を開く一連の手順の三重化（本質的な重複）。** 「`loadArticle` → `textarea.value` → `setCurrentFile` → `updatePreview` → `statusView.refresh`」が editor.js の `showArticleInPlace`（70–80 行目）、`onArticleCreated`（208–217 行目）、bootstrap 初期化（376–385 行目）に 3 回現れる。3 者は同じ概念「記事をエディタに表示する」であり、差分は syncActive の要否と closeDetail の要否だけ。`showArticleInPlace` の未使用オプション `syncActive` はまさにこの統合用に見える。→ 統合すべき本質的重複。
2. **パス逸脱ガードの三重化 + 一亜種（本質的な重複、既存の持ち越し）。** `delete.js`・`publish.js`・`unpublish.js` が同一の resolve+startsWith を持ち、`get_publication_status.js` が normalize 版を持つ。handlerFoundation 導入時に畳めたが残った。
3. **`fetchFn = (...a) => fetch(...a)` のデフォルト引数が 9 モジュールで反復。** DI の慣用句であり、共有化すると依存が増える。→ 偶然の一致（許容）。
4. **テストフェイクの重複。** `makeFakeRes` が `handlerFoundation.test.js`（25–34 行目）と `sidebarEndpoint.test.js`（5–14 行目）に文字通り同一で存在。classList/addEventListener 風フェイクは `sidebarTabs.test.js`・`confirmDialog.test.js`・`activeStateSynchronizer.test.js`・`editor-ui-cleanup.test.js` などで各様に再実装。各テストが必要最小のフェイクを持つ方針自体は独立性の点で正当だが、`makeFakeRes` は完全一致なので共有ヘルパー化してよい本質的重複。
5. エラー応答の 2 系統（`{success:false, error}` と `{message}`）はエンドポイント互換のための意図的な非統一で、`errorBody` オプションとして名前が付いている。→ 重複ではなく互換仕様と判断。

## やり残し・新たなリスク（まとめ）

1. **[リグレッション]** 記事読み込みのネットワーク失敗が unhandled rejection になり、初期化中に起きると popstate 配線ごと中断する（`articleLoader.js` / `editor.js` 70–80・376–385 行目）。
2. **[やり残し]** サーバー側の応答方式が 3 系統併存（handlerFoundation / `{status, contentType, body}` 返却 / `pull.js` の手書き）。
3. **[やり残し]** `sidebar.js` は抽出のみでテストなし。`@test` の指す先が実態（tree.js のテスト）と食い違う。
4. **[やり残し]** 記事を開く手順の三重化と、死んだ `syncActive` オプション。
5. **[やり残し]** サイドバークリック委譲ハンドラー（remote-only フロー含む）が無名・未検査のまま composition root に残存。
6. **[リスク]** `navigator` のシャドーイング、`newFileCreationUI` 画像モードの未検査分岐、`image_upload.js` の二重ログ。

## 結論

診断的リファクタリングとして方向は正しく、旧 editor.js の「import 時 DOM 依存 + モジュールレベル可変状態 + 後から差し替える関数変数」という最も読解を阻んでいた構造は解体された。サーバー側は応答されないまま宙吊りになる例外経路が塞がれ、テストは TODO/skip の placeholder が実テストになった。差し引きで品質は上がっている。ただし記事読み込み失敗時のフォールバック喪失は旧コードにあった防御を落とした明確な後退であり、コミット前に `showArticleInPlace`（または `loadArticle`）への catch 復元を推奨する。サーバー応答方式の 3 系統併存と sidebar.js の未検査は、次の作業単位として明示的に積み残すべき。
