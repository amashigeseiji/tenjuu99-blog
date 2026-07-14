# 問題定義: frontmatter で参照された画像が公開されない

**バージョン:** v1
**最終更新:** 2026-07-14
**コンテキスト:** エディタ
**関連設計資料:** packages/editor/server/publishTargetCollector.js, packages/editor/js/imageReferenceExtractor.js
**性格:** 現時点の問題理解のスナップショット。design/run/feedback を経て改版されることが正常な軌道。

## 変更履歴

### v1 (2026-07-14)
- 初版（plans/editor-image-library の問題定義の議論中に発見された既存の欠陥を切り出し）

---

## 問題

記事が画像を参照する経路は本文の `![](...)` に限らない。frontmatter に画像パスを書き（例: `og_image`）、テンプレートがそれを描画する（`{{OG_IMAGE}}` → `<meta property="og:image">` 等）形の参照が既に存在する。

しかし、記事を公開・更新するときの公開対象の収集は本文の Markdown 画像記法しか参照とみなさないため、frontmatter で参照された画像は公開対象に含まれず、リモートに送られない。結果として、公開されたページで OGP 画像などが欠ける。

### やりたいこと

- 記事を公開・更新したとき、その記事が参照しているすべての画像（本文・frontmatter）が記事と共に公開されてほしい

### 障害・制約

- 公開対象の収集が、本文の `![](...)` のみを参照とみなしている
- frontmatter のどのフィールドが画像参照かは、フィールド名からは自明でない（値の形から判別する必要がある）

### 観察された症状

- コード調査により発見（2026-07-14、plans/editor-image-library の問題定義中）。`og_image` に画像パスを指定した記事を公開しても、その画像はリモートに送られない。公開ページの OGP 画像が表示されない形で現れる

## 範囲外

- テンプレート自体に直接書かれた画像参照（記事の公開フローの対象外。plans/editor-image-library 側で宣言により扱う）
- 画像ライブラリ機能そのもの（一覧・削除・改名等）

## 解決したと言える状態（問題領域の言葉で）

- frontmatter で画像を参照する記事を公開・更新すると、その画像も記事と共に公開される
- 本文の `![](...)` 参照に対する既存の公開挙動が保たれる

## 他の問題との関係

- `前提とされる`: plans/editor-image-library/problem.md — 画像ライブラリの「参照」の定義は frontmatter 参照を含むため、本問題の解決（frontmatter 参照の抽出）が先に必要

## 技術的背景（調査結果）

- `packages/editor/server/publishTargetCollector.js` は `imageReferenceExtractor`（本文の `![](...)` 正規表現のみ）で参照を収集する
- テンプレート（src-sample/template/default.html 等）は `{if og_image}` 内で `{{OG_IMAGE}}` を描画し、値は記事の frontmatter から来る
- frontmatter は独自パーサー（lib/pageData.js）で解析され、値は文字列として取得できる

## /tdd-run への申し送り

- frontmatter 値のうち何を画像参照とみなすか（画像パスらしい値のパターン判定）は設計フェーズで定める
- ここで拡張する参照抽出は、plans/editor-image-library の参照追跡（design-notes.md の台帳構想）と共用される想定
- 既存語彙「画像参照抽出器」「公開対象」は本文参照のみを前提に定義されている → 定義の更新（「記事由来の参照」への拡張）が必要

## 参考資料

- `plans/editor-image-library/problem.md` — この問題を前提とする画像ライブラリの問題定義
- `plans/editor-image-library/design-notes.md` — 参照追跡の設計スケッチ
