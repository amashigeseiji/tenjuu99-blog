# Findings: publish-abstraction

**日時:** 2026-07-10
**対象:** plans/publish-abstraction/

## 操作の事実

- `~/dev/private/blog`（実プロジェクト）で公開済み記事を編集し、Publish 操作を実行。実際にサイトへ反映されたことを確認した（git 手段）
- blog.json に `"publish": {"means": "ftp"}` を追記し、tenjuu99-blog.app を再起動。エディタ画面は表示されるがサイドバーに何も表示されない状態になった
  - ブラウザのネットワークタブ上、`/get_sidebar` が 404
  - `publish.means` を `git` にする、または項目自体を削除するとサイドバーが復帰。`ftp` にすると再現する
  - エディタで直接ファイルを指名するとファイル内容の textarea 表示・プレビュー描画は機能する（壊れているのはサイドバー系エンドポイントのみ）
  - サーバーログには `Error: 未知の公開手段です: ftp` が出力されている

## 利用仮説の照合

- US-01（手段を意識せずに記事を公開できる）: 期待どおり。git 手段での公開・更新は従来どおり動作した
- test-tree.md の利用仮説（「外れ側」）は「公開手段を差し替えるために既存コードの変更が必要になる」「git の言葉が語彙に再侵入する」「既存の git 運用が壊れる」の3点を想定していたが、いずれにも該当しない
- 一方、「構成に未対応の公開手段が指定されたときにどう振る舞うか」は利用仮説・test-tree のどちらにも記述がなく、想定外の経路として今回のインタビューで見つかった

## 印象（ユーザーの言葉）

- 「means ftp の場合、publish が実行できないということを期待していました。もしくは、もっと手前でエラーとなるか、です」
- 実際に手前でエラーにはなっている（`resolvePublicationMeans` が `未知の公開手段です: ftp` を送出）が、それが `/get_sidebar` 経由では利用者に一切見えず、無関係に見えるサイドバー空白・404という形でしか観測できなかった

## 発見（解釈・原因の仮説、戻し先つき）

### F-01: `/get_sidebar` と `/publication-status` が解決器の例外を握りつぶす

**戻し先:** /tdd-run（同一 plan、次サイクル）
**出どころ:** 利用インタビュー + 成果物レビュー（コード確認）
**解釈・原因の仮説:**
`resolvePublicationMeans` 自体は意図どおり「未知の手段は構成の誤りとして拒否する」ように実装・テスト済み
（`tests/publishing/publicationMeans.test.js`）。`packages/editor/server/publish.js` はこの例外を
try/catch し 500 + エラーメッセージとして返しているが、`get_sidebar.js` と
`get_publication_status.js` は同じ呼び出しを裸で行っており、例外が
`lib/tryServer.js` の汎用 catch（`console.log(e)` のみでレスポンスを返さない）に飲まれ、
結果として利用者には素の404としか見えない。3エンドポイントとも本 plan で
`resolvePublicationMeans` への依存を新設した箇所であり、エラー処理の対称性が
テストツリーでカバーされていなかった。
**推奨される対応:** 「公開手段が解決できないときの `/get_sidebar` ・ `/publication-status` の振る舞い」を
test-tree に追加し、`/publish` と同様に構成エラーを利用者が知覚できる形（エラーレスポンス等）に揃える。

## 保留・再検証で無効になった観察

- 「`npm run server` で ftp 設定時に git として処理された」という当初の報告は、`~/dev/private/blog`
  にライブラリの最新反映がない環境での実行だったため無効。再検証の結果、tenjuu99-blog 側の
  最新コードでは想定どおり `未知の公開手段です: ftp` のエラーが発生することを確認した
  （F-01 に統合）

## F-01 対応（2026-07-10、/tdd-run 次サイクル）

**採用した設計:** fail-fast（起動時検証）ではなく、「エディター全体は動作を継続し、公開操作だけが
行えない」方針をユーザーと対話の上で採用した。理由: `publish.means` は editor パッケージのみが
使う値であり、他機能を止める理由がない。

**実装:**
- 新規 `lib/publishing/publishedStateResolver.js`（`公開済み状態解決器`）: `resolvePublicationMeans`
  が失敗したら、常に例外を投げる（= 既存の `unknown` ステータス判定にそのまま乗る）公開済み状態を
  代わりに返し、失敗をログに出力する
- `get_sidebar.js` / `get_publication_status.js` はこれを介して取得するよう変更。個別の try/catch は
  書かず、両エンドポイントとも落ちずに動作を継続する
- `POST /publish` は変更なし。既存の外側 catch が正確なエラー（`未知の公開手段です: ftp`）を
  `publishFeedback` に返せており、`unknown` 経由の git 前提の文言より良いと判断したため。
  ただしログが出ていなかったため `console.log` を追加した
- 新規 `packages/editor/js/publishAvailability.js`（`公開可否判定器`）: 公開ステータスが `unknown`
  のとき Publish ボタンを無効化し理由を表示する純粋関数。unknown の原因（means 不正 / git remote
  未設定）を問わず同一に扱う

**実機確認（ステップ8）:** `blog.json` に `"publish": {"means": "ftp"}` を設定した状態で
`node bin/server` を起動し、`/get_sidebar`（200、`data-status="unknown"` で全ファイル表示）・
`/publication-status`（`{"status":"unknown"}`）・`POST /publish`（`{"success":false,"error":"未知の公開手段です: ftp"}`、
サーバーログに `[publish] エラー: 未知の公開手段です: ftp` が出力される）を確認した

## ウォークスルー（7.5、F-01 対応分）

| 語彙（plans/dictionary） | テスト describe() | 実装（関数・モジュール名） | 型定義 |
|--------------------------|-------------------|---------------------------|--------|
| 公開済み状態解決器 | ✓ | resolvePublishedState() | なし（装置） |
| 公開可否判定器 | ✓ | publishAvailability() | なし（装置） |

- 名前の消失・変換なし
- src フィールド書き込み済み: 公開済み状態解決器 → lib/publishing/publishedStateResolver.js、
  公開可否判定器 → packages/editor/js/publishAvailability.js
- 依存グラフ（孤立ノードチェック）: `公開済み状態解決器` は静的依存元0件だったが、これは新規の孤立ではなく、
  同じ `@tenjuu99/blog/...` 自己パッケージ指定子 + `.cache/server` 動的 import を使う既存モジュール
  （`公開手段解決器`・`publish.js` 自体）と同一の既知の静的解析限界。実到達性は上記の実機確認で担保した

## 受け入れテストの更新（US-01 シナリオ3、既存挙動からの意図的な変更）

Publishボタンの事前グレーアウトを導入したことで、`tests/acceptance/publish-abstraction.spec.ts` の
US-01 シナリオ3（リモート参照不能）は**クリック後に `#publishFeedback` へエラーが表示される**という
旧アサーションが成立しなくなった（ボタンが無効化され、クリックしても `POST /publish` 自体が
発火しないため）。これは退行ではなく、案1（事前グレーアウト）を採用したことによる意図的な仕様変更。
テストを「`#publicationStatus` が `data-status=\"unknown\"`」「`#publishBtn` が disabled」を
検証する形に更新した。`playwright test` で全10件（6 passed / 4 skipped、既存の US-02 skip 分）を
リポジトリ直下の `blog.json` を一時的に有効な設定（means 未指定 = git）に戻した上で確認した
（フィクスチャは `beforeAll` でリポジトリ直下の `blog.json` をコピーするため、作業中の
`publish.means: \"ftp\"` の変更がそのまま漏れ込む）。

---

# 第2サイクル: F-01 対応へのフィードバック

**日時:** 2026-07-10
**対象:** F-01 対応（unknown 経由のグレースフルデグレード）後の利用インタビュー・成果物レビュー

## 操作の事実

- `blog.json` の `publish.means` を `ftp`（未登録の値）に設定し、エディタを起動
- サイドバー等の動作を確認。ファイル名の後ろの状態表示が「状態不明（公開不可）」となり、Publishボタンがグレーアウトすることを確認した
- サーバーログを確認:
  ```
  [publishing] 公開手段の解決に失敗したため、参照不能として扱います: 未知の公開手段です: ftp
  [error] Error: 未知の公開手段です: ftp
  ```
  内容に問題なしとの回答
- `publish.means` を `git`（正常構成）に戻し、通常時にサイドバー等が問題なく動作することを確認（実際の公開操作 = commit+push は今回は行っていない）
- git remote 未設定（参照不能のもう一つの原因）でも同様に「状態不明」表示・ボタン無効化になることを確認済み

## 利用仮説の照合

test-tree.md 追加分（2026-07-10、F-01対応）の3つの期待に対し、いずれも期待どおりだった:
- `publish.means` が不正でもエディター全体（サイドバー・ステータス表示）が動作を継続する → 確認
- サーバーログに不正である旨が出力される → 確認
- 原因（means 不正 / git remote 未設定）を問わず、Publishボタンが無効化され利用者に伝わる → 両方の原因で確認済み、外れなし

## 印象（ユーザーの言葉）

- 粗い印象:「『状態不明(公開不可)』は、文言はともかくとしてファイル名ともうすこし離してほしい」
- 解像度を上げた言い直し: 意味的な紛らわしさではなく、見た目上の間隔（CSS）が足りないという指摘。文言自体には異論なし

## 発見（解釈・原因の仮説、戻し先つき）

### F-02: ファイルツリーの状態表示とファイル名の視覚的な間隔が不足している

**戻し先:** /tdd-run（同一 plan、次サイクル）
**出どころ:** 利用インタビュー
**解釈・原因の仮説:** ツリーレンダラーが `data-status` 属性から状態文言を描画する際、ファイル名との間の余白（CSS）が考慮されていなかった。F-01対応で新設した「状態不明（公開不可）」表示によって初めて顕在化した可能性が高い（既存の「公開済み」「更新あり」等は短い語のため気づきにくかった）。
**推奨される対応:** ツリーレンダラーの描画CSSに間隔を追加する。軽微な修正であり、次の実装サイクルでまとめて対応可能。

### F-03: 「公開済み状態」と「公開ステータス」の名称衝突（成果物レビューで発見、本セッションで解消済み）

**戻し先:** なし（本セッション内で解決済み）
**出どころ:** 成果物レビュー
**解釈・原因の仮説:** promote 対象を精査した際、`公開済み状態`（リモート内容への読み取り専用抽象）と `公開ステータス`（未公開/更新あり/公開済みの3値の状態機械）が、名前の類似（「公開済み状態」と「公開ステータス」）から同一概念であるかのように混同されうることが判明した。加えて `公開する`・`公開済み状態`・`デプロイ` が docs 側に git 前提の旧定義のまま残り、plan 側に publishing コンテキストの新定義が並存する形になっており、そのまま promote すると同名エントリが2つ生まれる状態だった。
**対応済み:**
  - `公開する`: editor版をUI視点（Publishボタン押下）の定義に書き換え、publishing版（ドメインの反映アクション）を新規追加。両者を明示的にリンクし、2つの視点として整理
  - `公開済み状態` → `リモート状態`（RemoteState）に改名し publishing コンテキストへ統一。`公開ステータス`との直接参照を追加し、導出関係を明示
  - `デプロイ` を publishing コンテキストへ統一
  - `変更反映器` に `公開手段` への参照を追加
  - editor / native-shell / app-bundle の各コンテキスト説明文に残っていた git 前提の表現（「公開（git push）」「公開する操作（Publish/git操作）」）も合わせて書き換え
  - 新規10概念（ローカル・リモート・原稿・成果物・公開手段・公開物・git公開手段・公開手段解決器・リモート状態解決器・公開可否判定器）を docs/dictionary.json へ昇格
  - `原稿` の定義に、ローカル/リモートの同一性の基準が ssg-core の `ページ`（ファイルパス）であることを明記する関係を追加

### F-04: 実装側の識別子が語彙のリネームに追従していない

**戻し先:** /tdd-run（同一 plan、次サイクル）
**出どころ:** 成果物レビュー（F-03対応中に判明）
**解釈・原因の仮説:** F-03 で `公開済み状態` → `リモート状態`、`公開済み状態解決器` → `リモート状態解決器` に改名したが、実装側は `lib/publishing/publishedStateResolver.js`（ファイル名・関数名・`@vocab 公開済み状態解決器` アノテーション、`lib/publishing/publicationMeans.js` 内の `@vocab 公開済み状態` アノテーション）のまま。名前の一致（ウォークスルーの原則）が崩れている。
**推奨される対応:** ファイル名・関数名・`@vocab` アノテーションを `リモート状態`/`リモート状態解決器`（RemoteState/RemoteStateResolver）に合わせてリネームする。動作に影響はないため緊急ではないが、次の実装サイクルで解消しておくべき。

## 保留・無効になった観察

（なし）

---

# 第3サイクル: F-02・F-04 対応

**日時:** 2026-07-10
**対象:** findings.md 持ち越し2件（F-02, F-04）

## F-02 対応

`packages/editor/template/editor.html` の `#currentFileName` と `#publicationStatus` が隣接して
間隔がなかった問題に対し、`packages/editor/css/editor.css` に
`#publicationStatus:not(:empty){margin-left:8px;}` を追加。`:not(:empty)` としたのは、
ステータス未取得時（テキスト空）に余白だけが残る見た目を避けるため。
`node bin/server` を起動し配信される `editor.css` に反映されていることを確認した。

## F-04 対応

F-03 でのリネーム（`公開済み状態`→`リモート状態`、`公開済み状態解決器`→`リモート状態解決器`）に
実装側の識別子を追従させた:

- `lib/publishing/publishedStateResolver.js` → `lib/publishing/remoteStateResolver.js`（`git mv`）
  - `resolvePublishedState` → `resolveRemoteState`、`@vocab` アノテーション更新
- `lib/publishing/publicationMeans.js`: `@typedef PublishedState` → `RemoteState`、
  `PublicationMeans.publishedState` プロパティ → `remoteState`
- `lib/publishing/gitPublicationMeans.js`: `createGitPublishedState` → `createGitRemoteState`、
  返却プロパティ `publishedState` → `remoteState`
- `packages/editor/server/{get_sidebar.js, get_publication_status.js, publish.js,
  publicationStatus.js, sidebarStatusCollector.js}`: import・型参照・変数名・プロパティ参照を追従
- `tests/publishing/publicationMeans.test.js`: `describe()` 名、import、変数名を追従
- `tests/editor/{publish.test.js, editor-sidebar-status.test.js}`: `mockPublishedState` →
  `mockRemoteState`、`describe()` 名を追従
- `tests/acceptance/publish-abstraction.spec.ts`: skip 理由文言中の概念名参照を追従
- `plans/publish-abstraction/test-tree.md`: ツリー内の旧名記述を追従
- `docs/dictionary.json` の `リモート状態解決器` エントリの `src` を
  `lib/publishing/remoteStateResolver.js` に更新（`dict-write.js update` 経由）

**確認:** `npm test`（291 pass / 0 fail / 9 skip）、`playwright test tests/acceptance/publish-abstraction.spec.ts`
（3 passed / 3 skipped）。`node bin/server` 実機確認で `/get_sidebar`・`/publication-status` が
リネーム後も正常応答することを確認（`unknown` は upstream 未設定という別要因によるもので想定どおり）。

## ウォークスルー（7.5、F-04対応分）

| 語彙（docs/dictionary） | テスト describe() | 実装（関数・モジュール名） | 型定義 |
|--------------------------|-------------------|---------------------------|--------|
| リモート状態解決器 | ✓ | resolveRemoteState() | なし（装置） |
| リモート状態 | - | RemoteState typedef | ✓（lib/publishing/publicationMeans.js） |

- 名前の消失・変換なし。src フィールド書き込み済み（上記）
- 依存グラフ（孤立ノードチェック）: `.claude/tdd/depgraph-regen.sh` でグラフを再生成し
  `lib/publishing/remoteStateResolver.js` を検索した結果、`depended on by: 0`。
  リネーム前の `publishedStateResolver.js` と同じ静的解析限界（`@tenjuu99/blog/...` パッケージ指定子 +
  `.cache/server` 動的 import は静的解析が追えない）であることを、`publicationMeansResolver.js`
  （`depended on by: 1` — 同一パッケージ内の相対 import のみ検出可能）・`publish.js`
  （`depended on by: 0` — 同じ限界）との比較で確認した。新規の孤立ではなく、実到達性は本サイクルの
  実機確認（`/get_sidebar`・`/publication-status` の200応答）で担保済み

findings.md の持ち越し事項（F-02, F-04）はすべて解消。次サイクルへの申し送りはなし。

---

# 第4サイクル: F-02・F-04 対応後の利用インタビュー・クローズ判断

**日時:** 2026-07-10
**対象:** cycle3（F-02 間隔調整、F-04 リネーム）反映後の実利用

## 操作の事実

- `e0dece6`（間隔調整＋リネーム）適用後のエディタ画面で、ファイル名と `#publicationStatus` の間隔を確認した
- リネーム（`公開済み状態解決器`→`リモート状態解決器`等）について、動作面・コード面を確認した

## 利用仮説の照合

- F-02・F-04 とも期待どおり。間隔は「最低限あって問題ない」、リネームは「わかりやすくなった」との回答

## 印象（ユーザーの言葉）

- 間隔について: 「最低限のスペースはあって問題ないと思います。`|` などの文字で区切っているほうがよりわかりやすいです」
  - 解像度を上げた確認: この指摘は今回の対応範囲で直したいものではなく、気づきとして記録するだけでよいとのこと
- リネームについて: 「とくに気になった点はありません。わかりやすくなったとおもいます」
- 全体（US-01〜US-02、F-01〜F-04を経て）: 「今後の改修に堪えられるように概念およびコードの整理をやったという認識で、とくに概念整備はかなり進展したと考えている」

## 発見（解釈・原因の仮説、戻し先つき）

### F-05: ファイルツリーの状態表示とファイル名の区切りに、間隔だけでなく区切り文字（例: `|`）を使う案がある

**戻し先:** 新規 plan（優先度低、記録のみ）
**出どころ:** 利用インタビュー
**解釈・原因の仮説:** F-02 で `margin-left` による間隔を追加したが、ユーザーは間隔だけよりも視覚的な区切り文字がある方がファイル名と状態表示の境界を認識しやすいと感じている。ただし現状でも問題はないとの評価であり、緊急性はない。
**推奨される対応:** 次にツリーレンダラーの表示を触る機会があれば検討する。単独では plan を起こすほどの優先度ではない。

### F-06: 「ページ」が新規作成・未公開・編集済み・公開・削除という一連の状態遷移を持つ主体である、というより高い抽象が未定義

**戻し先:** 新規 plan（`/tdd-problem`）
**出どころ:** 利用インタビュー
**解釈・原因の仮説:** 本 plan では「ローカルとリモートでページの同一性が認知されている」ことを語彙に組み込んだ（`原稿`の定義に ssg-core の `ページ`（ファイルパス）を同一性の基準として明記、[[dictionary]] 参照）。ユーザーはこの同一性を持つ「ページ」自体が、`公開ステータス`（未公開/更新あり/公開済みの3値）よりも広い、新規作成・未公開・編集済み・公開・削除という一連の状態遷移を伴う主体として捉えられるはずだと考えている。事実、既存辞書には `非公開にする`・`削除する` が `公開ステータス` に「将来実装」として関係付けられており、種は存在するが、この上位の主体（ページのライフサイクル）自体はまだ概念化されていない。
**推奨される対応:** ユーザー自身、「何ができていないか」を具体的に述べるのは現状では難しいと述べている。新規 problem として定義する価値はあるが、現時点では記録に留め、問題意識が輪郭を持ったタイミングで `/tdd-problem` を起動する。

## クローズ判断

**判定: C（クローズ + 新規プランへの移行）**

- 本 plan の「解決したと言える状態」（problem.md）は達成を確認:
  - 「公開する」「公開済み」「更新あり」が git の言葉を使わずに定義されている（publishing コンテキスト、docs/dictionary.json 昇格済み）
  - git による公開は定義の一実現として位置づけ直され、既存運用は cycle1 のインタビューで実際に動作確認済み
  - 新しい公開手段の検討は「その手段が定義をどう実現するか」だけで語れる状態（`公開手段` 抽象、F-01対応の unknown 経由の統一処理）
- findings の持ち越し（F-01〜F-04）はすべて解消済み
- F-05 は優先度が低く、単独の plan には値しない（記録のみ）
- F-06 は問題意識として価値があるが、ユーザー自身が現時点で具体化できないと明言しており、今 `/tdd-problem` を起動しても輪郭が定まらない。将来、具体化されたタイミングで新規 plan として起こす

## テストの二層化・アーカイブ

昇格した概念に対応する describe() ブロックのみ残し、それ以外は畳む対象を次のとおり判定する:

- `tests/publishing/publicationMeans.test.js`: 全 describe が docs/dictionary.json 昇格概念（公開手段、git公開手段、公開手段解決器、リモート状態解決器）に対応 → 残す
- `tests/editor/publish.test.js`: 全 describe が昇格概念（公開ハンドラー、公開対象コレクター、画像参照抽出器、変更反映器、公開ステータス判定器）に対応 → 残す
- `tests/editor/editor-sidebar-status.test.js`: 全 describe が昇格概念（ツリーレンダラー、ファイルステータスコレクター、公開ステータス判定器）に対応 → 残す
- `tests/editor/publish-availability.test.js`: 公開可否判定器（昇格済み）に対応 → 残す
- `tests/acceptance/publish-abstraction.spec.ts`: 受け入れテストとして常に残す

→ 本 plan で新設・変更したテストファイルはすべて昇格概念に索引されており、畳む対象はなし。
