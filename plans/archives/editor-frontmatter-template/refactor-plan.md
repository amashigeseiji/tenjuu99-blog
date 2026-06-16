# リファクタリング計画: editor-frontmatter-template

**作成:** 2026-06-16
**スコープ:** `plans/editor-frontmatter-template/` （特定プランの整理）

---

## 発見した問題

### [A] 意味的な整合（1件）

**A-1: `フロントマターテンプレートローダー` のルートテストが「ローダー」の振る舞いをテストしていない**

テストファイル L6 のルートテスト (`フロントマターテンプレートローダー は ディレクトリに対応するフロントマターテンプレートをエディタに挿入できる`) の内容は、`matchTemplate()` と `buildFrontmatterString()` を直接組み合わせて結果文字列を検証しているだけ。辞書の「フロントマターテンプレートローダー」はツリーのルートノード（`initFrontmatterTemplate()` が担う「サーバーから設定を取得してエディタに挿入する一連の流れ」）を指すが、テストはその流れを検証していない。

テストが意図するのは「テンプレートマッチャーとテンプレートインジェクターを組み合わせると正しいフロントマター文字列が生成できる」という統合確認であり、ルートノードの振る舞いではない。

---

### [B] 構造的な正確さ（3件）

**B-1: `editor.js` の `テンプレートレゾルバー` @vocab に `@test` アノテーションがない**

`packages/editor/js/editor.js` L27 の `@vocab: テンプレートレゾルバー` には `@test` アノテーションが付いていない。同ファイルの `テンプレートマッチャー`（L3-4）と `テンプレートインジェクター`（L18-19）には `@test` が付いているのと対照的。`get_frontmatter_templates.js` には `@test: tests/editor/editor-frontmatter-template.test.js` があるが、ブラウザ側（`initFrontmatterTemplate`）は `@test` なし。

**B-2: `テンプレートレゾルバー` のテストが TODO のまま**

`tests/editor/editor-frontmatter-template.test.js` L124 の `it('TODO', () => {})` は実装が空のまま。コメントには「サーバーエンドポイントの単体テストは `get_frontmatter_templates.js` で行う」とあるが、その `get_frontmatter_templates.js` というテストファイルは存在しない（`tests/editor/` にない）。

`@test: tests/editor/editor-frontmatter-template.test.js` という参照は `get_frontmatter_templates.js` に付いているが、テストファイル内でサーバー側エンドポイントのテストは行われていない。`get_frontmatter_templates.js` を対象とする独立したテストファイルへの参照が宙に浮いている。

**B-3: `editor.js` 内の `matchTemplate` / `buildFrontmatterString` が `frontmatter_template.js` のコピーで、辞書に「ブラウザ側コピー」と記載されているが @vocab の重複登録になっている**

辞書の `テンプレートマッチャー` と `テンプレートインジェクター` の `src:` フィールドに `packages/editor/js/editor.js` も列挙され、「ブラウザ側コピー」と説明されている。しかし `editor.js` はブラウザ専用スクリプト（`<script>` タグで直接読み込む）であり、ESモジュールの `import` ができない環境前提でのコピーという設計判断がある。

この状態では `editor.js` 内の `matchTemplate`・`buildFrontmatterString` が `frontmatter_template.js` と実装的に同一でありながら、`@vocab` アノテーションが両ファイルに付く二重帰属になっている。辞書への反映も「コピーが正規実装と同一か」の確認手段がない。

---

### [C] 理解可能性（2件）

**C-1: テストの `describe` 文字列に技術名が入っている**

`tests/editor/editor-frontmatter-template.test.js` L121:

```
describe('/get_frontmatter_templates エンドポイントからJSON設定を取得できる', () => {
```

`/get_frontmatter_templates` という URL パス（技術名）と「エンドポイント」（ソリューションドメイン寄りの実装用語）が describe 文字列に含まれている。`tdd-refactor` の視点 (c) の指摘対象（「技術名・APIが describe に入っている」）に該当する。

問題領域の言葉で書くなら `テンプレートレゾルバー は テンプレート設定をサーバーから取得できる` がすでに親 describe にあり、その子は「ブログ設定から frontmatter_templates を読み取れる」のような形が望ましい。

**C-2: ルートテスト describe（`フロントマターテンプレートローダー`）に対応する `@vocab` を持つ実装がない**

テストツリーのルートノード `フロントマターテンプレートローダー` は `auto-decisions.md` で「`editor.js` 内の `initFrontmatterTemplate()`」と定義されているが、実装の `initFrontmatterTemplate()` が持つ `@vocab` は `テンプレートレゾルバー` であり `フロントマターテンプレートローダー` ではない。辞書にも「フロントマターテンプレートローダー」というエントリは存在しない。

ルートテストのラベルが辞書外の名前を使っており、語彙の外にある概念でテストが書かれている状態。

---

### [D] 未使用コード（0件）

確認対象のファイル（`frontmatter_template.js`, `get_frontmatter_templates.js`, `editor.js` の frontmatter 関連部分）に未使用コードは発見されなかった。

---

## 実施する変更

以下を優先順に提示する。変更は実施しない（観察・計画フェーズ）。

### 1. [A-1 / C-2] ルートテストを「テンプレートマッチャーとテンプレートインジェクターの統合確認」に改名する

**変更対象:** `tests/editor/editor-frontmatter-template.test.js` L6

**変更前:**
```js
describe('フロントマターテンプレートローダー は ディレクトリに対応するフロントマターテンプレートをエディタに挿入できる', () => {
```

**変更後（案）:**
```js
describe('テンプレートマッチャー と テンプレートインジェクター は 組み合わせてフロントマター文字列を生成できる', () => {
```

理由: テスト本体の内容（`matchTemplate()` + `buildFrontmatterString()` の組み合わせ確認）と describe 名を一致させる。辞書にない「フロントマターテンプレートローダー」という名前をテストから除去する。

---

### 2. [B-1] `editor.js` の `テンプレートレゾルバー` @vocab に `@test` を追記する

**変更対象:** `packages/editor/js/editor.js` L27-28

**変更前:**
```js
// @vocab: テンプレートレゾルバー (plans/editor-frontmatter-template/dictionary.md#テンプレートレゾルバー)
let _frontmatterTemplates = []
```

**変更後:**
```js
// @vocab: テンプレートレゾルバー (plans/editor-frontmatter-template/dictionary.md#テンプレートレゾルバー)
// @test: tests/editor/editor-frontmatter-template.test.js
let _frontmatterTemplates = []
```

---

### 3. [C-1] テストの describe 文字列から技術名を除去する

**変更対象:** `tests/editor/editor-frontmatter-template.test.js` L121

**変更前:**
```js
describe('/get_frontmatter_templates エンドポイントからJSON設定を取得できる', () => {
```

**変更後（案）:**
```js
describe('ブログ設定から frontmatter_templates を読み取れる', () => {
```

---

### 4. [B-2] `テンプレートレゾルバー` のサーバー側テスト方針を明確にする

`it('TODO', () => {})` は振る舞いの空洞。以下の2択をユーザーに判断を仰ぐ:

- **4a**: `get_frontmatter_templates.js` のサーバー側エンドポイントをテストするファイルを `tests/editor/` に追加する（`config.frontmatter_templates` をモックして `{ templates: [...] }` が返ることを確認する）
- **4b**: 「サーバー側は手動確認のみ」という既存の意図を尊重し、TODO テストを削除して describe 全体にコメントで意図を記録する

どちらを選ぶかはユーザーの判断とする。

---

### 5. [B-3] `editor.js` 内のコピー実装について辞書の `src:` 記述を整理する（辞書更新）

**変更対象:** `plans/editor-frontmatter-template/dictionary.md` の `テンプレートマッチャー` と `テンプレートインジェクター` の `src:` フィールド

現在の記述:
```
**src:** `packages/editor/js/frontmatter_template.js` `matchTemplate(filePath, templates)` / `packages/editor/js/editor.js` `matchTemplate()` （ブラウザ側コピー）
```

`editor.js` のコピーは `frontmatter_template.js` が `<script type="module">` として読み込めない環境のための回避策である。辞書の `src:` は「正規の実装場所」を指すべきであり、コピーを並列に列挙することで「どちらが正規か」が曖昧になっている。

**変更後（案）:**
```
**src:** `packages/editor/js/frontmatter_template.js` `matchTemplate(filePath, templates)`
**注記:** `packages/editor/js/editor.js` にブラウザ環境用のインライン実装が存在する（ESモジュール import 不可のため）。変更時は両方に同じ修正を適用すること。
```

---

## 変更後のチェックリスト

1. `npm test` が全テスト green のまま通ること
2. describe 文字列の変更後、辞書エントリ名との対応が取れていることを確認する
3. 変更 5 の後、`@vocab` アノテーションのパス参照が辞書エントリと一致していることを確認する

---

## 次フェーズへの申し送り

- 変更 4 の判断（サーバー側テストの追加 vs コメント化）はユーザーに問う
- `editor.js` のコピー実装は「なぜ `frontmatter_template.js` を import できないか」を解消することで将来的に除去できる可能性がある。その調査は別タスク
- `フロントマターテンプレートローダー` という概念はテストツリーのルートノードとして設計されたが、辞書に登録されていない。`テンプレートレゾルバー` に統合されているのか、独立した概念なのかを次の tdd-vocab セッションで整理することを推奨する
