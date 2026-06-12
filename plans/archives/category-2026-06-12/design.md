# 設計: カテゴリーページのページネーション

**バージョン:** v1
**最終更新:** 2026-06-12
**問題定義:** plans/category/problem.md
**実装対象:** packages/category/helper/categoryIndexer.js, packages/category/helper/pagination.js, packages/category/template/_pagination.html, packages/category/template/category.html

## 変更履歴
### v1 (2026-06-12)
- 初版

## アプローチ

`generateCategoryPages()` を拡張して、`per_page` が設定されているカテゴリーシステムでは1カテゴリーにつき複数の仮想ページを生成する。各仮想ページには現在ページの記事スライスとページナビゲーション情報を格納する。ヘルパー関数（`pagination.js`）と UI パーシャル（`_pagination.html`）を新設してテンプレートに提供する。`per_page` が未設定のカテゴリーシステムは従来通り全件1ページで動作し、後方互換性を維持する。

## 問題の分解

- 小問題1: 記事スライスの計算 — カテゴリーの全記事リストを `per_page` 件ずつ区切り、各ページが表示すべき記事名のサブセットを決定する
- 小問題2: 仮想ページの複数生成 — 各スライスに対応した仮想ページを `allData` に追加する。1ページ目は既存URLを維持し、2ページ目以降は `/2/`, `/3/` サフィックスのURLで生成する
- 小問題3: 設定の拡張 — カテゴリーシステム単位（`categories[]` エントリ）で `per_page` を指定できるようにし、未設定時は従来動作にフォールバックする
- 小問題4: ページナビゲーション情報の仮想ページへの格納 — `current_page`, `total_pages`, `per_page`, `pagination_base` 等を各仮想ページのフィールドとして持たせる
- 小問題5: `category_children` の型変更 — `string[]`（URLのみ）から `{url, title}[]`（オブジェクト配列）に変更する
- 小問題6: ページネーションヘルパー関数の提供 — URL生成とウィンドウ付きページ番号リスト生成のヘルパー関数を提供する
- 小問題7: ページネーションUIパーシャルの提供 — 前後ページナビゲーションを描画するパーシャルを提供する

## 設計（概念と道具立て）

### 記事スライス関数 `sliceIntoPages`
- 役割: 記事名の配列を、指定件数ごとのページ単位に分割する
- 解く小問題: 小問題1（記事スライスの計算）
- 実装上の対応: `categoryIndexer.js` 内のローカル純粋関数
- インターフェース:
  ```
  sliceIntoPages(items: string[], perPage: number): string[][]
  ```
  空の場合は `[[]]`（ページ数ゼロを避けるため）を返す

### 仮想ページビルダー `buildVirtualPage`
- 役割: 1ページ分の仮想ページオブジェクトを生成する。ページ番号、記事スライス、ナビゲーション情報を含む
- 解く小問題: 小問題2（仮想ページの複数生成）、小問題4（ページナビゲーション情報の格納）
- 実装上の対応: `categoryIndexer.js` 内のローカル関数
- 追加フィールド（ページネーション有効時）:
  - `current_page`: 現在のページ番号（1始まり）
  - `total_pages`: 総ページ数
  - `per_page`: 1ページあたりの件数
  - `pagination_base`: カテゴリーの1ページ目URL（末尾スラッシュあり。例: `/art/painting/`）。`getPaginationUrl` に渡して各ページURLを生成するために使う
  - `category_slug`: カテゴリーパスをハイフン区切りでスラッシュ結合した文字列（例: `art/oil-painting`）
  - `category_pages`: 当該ページの記事名スライス（全件ではなく当該ページ分のみ）
- `category_children` フィールドは常に `{url: string, title: string}[]` 型で生成する

### `generateCategoryPages` の拡張
- 役割: `per_page` の有無で分岐し、設定があれば複数仮想ページを、なければ従来の1仮想ページを生成する
- 解く小問題: 小問題2（仮想ページの複数生成）、小問題3（設定の拡張）、小問題5（`category_children` の型変更）
- 実装上の対応: 既存 `generateCategoryPages()` 関数を更新
- `category_children` の型変更は `per_page` の有無にかかわらず適用する（常に `{url, title}[]`）
- ページネーション有効時のURL・ページ名:
  - ページ1: `{categoryUrl}/index`（キー）、URL は既存通り
  - ページ2+: `{categoryUrl}/2/index`（キー）、URL は `{categoryUrl}/2`

### ページネーションヘルパー `pagination.js`（新規）
- 役割: テンプレートからページURLとページ番号ウィンドウを生成する手段を提供する
- 解く小問題: 小問題6（ページネーションヘルパー関数の提供）
- 実装上の対応: `packages/category/helper/pagination.js` として新規作成し、エクスポート
- 提供する関数:
  - `getPaginationUrl(basePath, page)`: ページ番号からURLを生成する。`page === 1` なら `basePath`、それ以外なら `basePath + page + '/'`
  - `buildWindowedPages(totalPages, currentPage, windowSize = 2)`: 1から `totalPages` までのページ番号を、前後 `windowSize` 件のウィンドウと省略記号（`{num: null, isEllipsis: true}`）付きで返す。各要素は `{num: number, isCurrent: boolean}` または `{num: null, isEllipsis: true}`
- ユーザーが独自の `pagination.js` を実装する際の参考実装としても機能する

### ページネーション UI パーシャル `_pagination.html`（新規）
- 役割: 前ページ・次ページへのリンクとページ番号ナビゲーションをHTMLとして描画する
- 解く小問題: 小問題7（ページネーションUIパーシャルの提供）
- 実装上の対応: `packages/category/template/_pagination.html` として新規作成
- `{script}` ブロックで `total_pages`, `current_page`, `pagination_base` を参照し、`buildWindowedPages()` と `getPaginationUrl()` を呼び出してナビゲーションを生成する
- `total_pages <= 1` のときは何も出力しない
- ユーザーが独自のスタイルに合わせてカスタマイズする際の出発点として機能する

### `category.html` の更新
- 役割: `category_children` の型変更に対応し、ページネーション UI パーシャルを include する
- 解く小問題: 小問題5の後処理、小問題7の統合
- 実装上の対応: 既存テンプレートを2か所更新
  - `category_children` のループ処理を `string` → `{url, title}` オブジェクトに対応
  - ページリストの前または後に `{include('template/_pagination.html')}` を追加

## 全体の組み立て

```
blog.json の categories[] に per_page を設定
        ↓
afterIndexing() → generateCategoryPages()
        ↓
  per_page 未設定              per_page 設定あり
  ├ 従来通り1仮想ページ生成        ├ sliceIntoPages() で全記事を分割
  └ category_pages = 全件        ├ 各スライスに buildVirtualPage()
    category_children = {url,title}[]  │  ページ1: {url}/index
                                 │  ページ2+: {url}/2/index ...
                                 └ 各ページに current_page, total_pages,
                                     per_page, pagination_base,
                                     category_pages(スライス),
                                     category_children({url,title}[])

レンダリング時（category.html）:
  category_pages ループ → 当該ページの記事一覧表示
  _pagination.html include:
    total_pages > 1 のときのみ出力
    buildWindowedPages(total_pages, current_page) → ページ番号列
    getPaginationUrl(pagination_base, n) → 各ページのURL
    前ページ・次ページリンク
```

**変更しない部分（対象外）:**
- `buildCategoryTree()` — カテゴリーツリーの構築ロジックは変更しない
- `afterIndexing()` の呼び出し構造 — 既存の Hook 機構はそのまま

## 満たすべき性質（受け入れ条件）

- P-01: `per_page` を設定したカテゴリーシステムで、`ceil(記事数 / per_page)` 個の仮想ページが `allData` に追加される
- P-02: 1ページ目の仮想ページ名・URLは既存と同じ（`{category_path}/index`）であり後方互換を維持する
- P-03: 2ページ目以降のページ名は `{category_path}/2/index`, `{category_path}/3/index` の形になる
- P-04: 各仮想ページの `category_pages` にはそのページ番号に対応する記事スライスのみが入り、他のページの記事は含まない
- P-05: `per_page` 未設定のカテゴリーシステムは従来通り1つの仮想ページが生成され、`category_pages` に全記事が入る
- P-06: `category_children` は全ての仮想ページで `{url: string, title: string}[]` 型になる（`per_page` 有無にかかわらず）
- P-07: `getPaginationUrl(basePath, 1)` は `basePath` を返し、`getPaginationUrl(basePath, 2)` は `basePath + '2/'` を返す
- P-08: `buildWindowedPages(10, 5, 2)` はページ番号 1〜10 について前後2件のウィンドウと省略記号を含む配列を返す
- P-09: `_pagination.html` は `total_pages <= 1` のとき空文字列を出力する

## 利用仮説（使ったらこうなるはず）

- 試してほしい操作: `per_page: 3` を設定し、4記事以上あるカテゴリーでビルドを実行する
- 期待: `dist/{category}/index.html` と `dist/{category}/2/index.html` が両方生成され、それぞれ最初の3件・残りの記事が表示され、ページナビゲーションが表示される
- 外れ: ページ2以降が生成されない、または1ページに全記事が入ったまま → `sliceIntoPages` または `generateCategoryPages` の分岐ロジックを確認

- 試してほしい操作: `per_page` を設定しない既存のカテゴリー設定でビルドする
- 期待: ビルド結果が変わらない（仮想ページ数・`category_pages` の内容が従来と同じ）
- 外れ: 記事数が変わる、ページが増える → フォールバック分岐のバグ

## 暫定値・未確定の判断

| 項目 | 暫定値／選択肢 | 根拠 | 確度 |
|---|---|---|---|
| ウィンドウサイズ（前後ページ数） | 2 | 先行実装に合わせる | 高 |
| `sliceIntoPages` の空入力時の戻り値 | `[[]]`（空スライスを1件含む配列） | ページ数ゼロを避けて仮想ページを1件生成するため | 中（テストで検証してほしい） |

## 技術的背景（調査結果）

- `packages/category/helper/categoryIndexer.js` — 現在の1カテゴリー1ページ生成実装。`generateCategoryPages()` の内部を拡張する差し込み位置
- `packages/category/helper/category.js` — `buildCategoryTree()` を提供。変更しない
- `packages/category/template/category.html` — サブカテゴリーループが `category_children` を `string` として扱っている。型変更に合わせて更新が必要
- 現在の `url` フィールド: 末尾スラッシュなし（例: `/art/painting`）。先行実装は末尾スラッシュありだが、後方互換のため変更しない。`pagination_base` を別フィールドとして追加して対応する

## /tdd-run への申し送り

- 検証してほしい性質: P-01〜P-09 すべて
- 特に重点的に検証してほしいもの: P-01（ページ数計算）, P-04（スライスの境界），P-05（フォールバック動作）
- 暫定値の妥当性確認: `sliceIntoPages` の空入力時戻り値（`[[]]` か `[]` か）
- `category.html` の `category_children` ループ変更は、既存ユーザーへの破壊的変更になる。リリースノートへの記載も申し送り

## 参考資料
- plans/category/problem.md
- packages/category/helper/categoryIndexer.js（現行実装）
- packages/category/helper/category.js（変更なし）
- packages/category/template/category.html（更新対象）
