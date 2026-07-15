# Findings: editor-image-library（F-01・F-02 修正サイクル）

**日時:** 2026-07-15
**対象:** plans/editor-image-library/（前回セッションの利用インタビューで見つかった F-01・F-02 の解消）

## 操作の事実

- ブラウザで実際に以下を操作した:
  - 記事編集中に画像をアップロードし、そのまま画像タブを開いて反映を確認した（F-01）
  - 画像詳細を開いた状態でサイドバーのタブ（Files 等）に切り替え、記事編集画面への復帰を確認した（F-02）

## 利用仮説の照合

- 利用仮説（test-tree.md フェーズ2）: 「画像タブを開くとリロードなしで新しい画像が反映される」「画像タブを離れると画像詳細が自動的に閉じ、記事編集ヘッダーに戻る」の2点
- 実際: 両方とも期待どおり。F-01・F-02 とも再現しなかった

## 印象（ユーザーの言葉）

- 「特になし（期待どおり）」— 動作面・配色変更（サイドバー項目の配色をFilesタブに揃えた変更）を含め、違和感の申告なし

## 成果物レビュー

語彙（plans/editor-image-library/dictionary.json）:
- 「画像一覧表示」「画像詳細表示」の再定義内容自体（振る舞い・関係）に問題はない
- **懸念点（新規）**: 成果物レビュー中にユーザーから、「画像一覧表示」という名称そのものへの疑問が出た。「一覧」は既に「表示されている状態」を含意するため、「一覧」+「表示」は「頭痛が痛い」型の冗語ではないか、という指摘。実際、test-tree.md フェーズ2のツリーと対応する `describe()` は既に短縮形「画像一覧」を使っており、辞書登録名「画像一覧表示」と表記が割れている（意図した略称ではなく、命名の揺れ）
- ユーザーからの具体的な代替案: 既存語彙「ファイルリスト」（FileList、ディレクトリ構造を無視したフラットな配列を指す `application` 語彙）に倣い、「画像一覧」→「画像リスト」への言い換え。ただし「ファイルリスト」はデータ構造を指す語彙であり、「画像一覧表示」は表示コンポーネントを指す語彙なので、単純な語の置き換えでは概念のドメイン（表示 vs データ）がずれる可能性があり、命名の再設計は次回に持ち越す
- 影響範囲: 「画像一覧表示」を参照している「画像詳細表示」「画像ライブラリエントリ」の relations、`@vocab` コメント（editor.js, imageListDisplay.js, imageDetailDisplay.js）、`describe()` 名（tests/editor/image-library.test.js, tests/acceptance/editor-image-library.spec.ts）、ファイル名（`imageListDisplay.js`）まで連鎖する可能性があり、単一エントリの書き換えでは済まない

ソリューション構造（test-tree.md と現在の describe() 構造の比較）:
- 差分なし。フェーズ2ツリーの2ノード（画像一覧／画像詳細表示）と `describe()` 構造は一致している。3ノードから2ノードへの組み換え経緯は test-tree.md に記録済みで、実装（editor-options 共有・タブ離脱で自動クローズ）とも整合している

観察メモ（observations.md）:
- 「再取得トリガー」ではなく「タブを開くたびに再取得」という単純化された設計を採用したことで、次フェーズ（US-02 削除・US-03 改名）でも同じ仕組みが使い回せる、という見立てが記録されている。今回のレビューでも実装（`initSidebarTabs` 内の分岐）はこの見立てと一致していることを確認した
- 辞書エントリの言葉選びで3段階の指摘・手戻りがあった点、`wip.status` を `add` → `update` で訂正する手戻りが発生した点が記録されている。今回の命名懸念（画像一覧表示の冗語性）はこれらの手戻りとは別種の指摘で、実装後の設計レビューではなく成果物レビューの場で出た

**promote判断:** 実施済み。命名の懸念（F-03）はこのセッション内で解決し、確定した新名称で `docs/dictionary.json` へ直接 promote した（経緯は F-03 参照）。

## 発見（解釈・原因の仮説、戻し先つき）

### F-03: 「画像一覧表示」の名称が冗語的で、test-tree.md/describe() の実態（「画像一覧」）と割れていた（解消済み）

**戻し先:** なし（このセッション内で解消）
**出どころ:** 成果物レビュー（ユーザー指摘）
**解釈・原因の仮説:** 「一覧」は「表示されている状態」を含意するため「一覧表示」は冗語。test-tree.md フェーズ2のツリーノード名・`describe()` は既に「画像一覧」という短縮形で書かれており、辞書登録名「画像一覧表示」と表記が一致していなかった。
**実際の対応:** 当初は次サイクル送りと判断したが、ユーザーから「語彙を確定させたうえでこのセッション内で promote すべきでは」という指摘を受け、その場で命名を確定して実施した。
- 「対象名+リスト」がデータ構造を表す（既存語彙「ファイルリスト」と同型）という命名パターンをユーザーが提示し、「画像一覧表示」→「画像リスト表示」、および同じ理由で「画像一覧コレクター」→「画像リストコレクター」（en: ImageListCollector）に改名
- ファイル名（`imageLibraryCollector.js`、関数名 `collectImageLibrary` 等）は import 修正のリスクを避けるため現状維持とし、語彙名・`@vocab`/`#概念名` コメント・`describe()` 名・test-tree.md のみを更新する方針で合意
- 影響範囲（`docs/dictionary.json` の該当2エントリ＋周辺5エントリの relations、`packages/editor/js/{imageListDisplay,imageDetailDisplay,editor}.js`、`packages/editor/server/{imageLibraryCollector,get_image_library}.js`、`tests/editor/image-library.test.js`、`tests/acceptance/editor-image-library.spec.ts`、`plans/editor-image-library/test-tree.md`）をすべて更新し、`dict-write.js check`・`npm test`（359件 pass）・`playwright test`（5 pass, 1 skip）で整合性を確認した
- 「画像一覧表示」「画像詳細表示」の F-01/F-02 再定義内容も、新名称で `docs/dictionary.json` へ promote 済み。`plans/editor-image-library/dictionary.json` は空に戻った
