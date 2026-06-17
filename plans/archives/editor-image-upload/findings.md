# Implementation Findings

**日時:** 2026-06-15
**プロジェクト:** plans/editor-image-upload/

---

## 発見（戻し先つき）

### F-01: image_converter の設計が未着手
**戻し先:** このスキルの次サイクル（ツリーの再構築）
**現象:** `blog.json` で `"image_converter": "sharp"` を設定することを想定した実装になっているが、
- コンバーターモジュール（`converters/sharp.js` 等）の仕様が未定義
- `converters/` ディレクトリがどこに置かれるか（パッケージ同梱か、ユーザー提供か）が未決定
- `module.ext` の慣習（コンバーターが出力拡張子を `export const ext = 'webp'` で宣言する）がテストに反映されていない
**推奨される対応:** `image_converter` の問題を次サイクルで `/tdd-problem` に起こし、コンバーターモジュールの仕様・配置・`ext` エクスポートの慣習をツリーとして設計する。

---

## 実装中に解消された問題（記録のみ）

### 変換ドライバー未設定時に `.webp` 拡張子が付いていた
元の拡張子のままファイルが保存されるよう `resolveImagePath` に `outputExt` 引数を追加し、
`createConverter` が `{ fn, ext }` を返す形に変更することで解消した。

### `btoa(String.fromCharCode(...new Uint8Array(buffer)))` がスタックオーバーフロー
大きな画像ファイルでスプレッド引数の上限を超えた。`reduce` に変更して解消した。

---

## 余白として残した将来ユースケース

### フロントマターへの画像URL挿入
今回は `Markdown挿入器` が `![](url)` 構文を挿入する「インライン画像挿入」に限定した。
フロントマター（例: `image: /image/...`）への URL のみ挿入は別ユースケースであり、
`画像アップローダー` と `アップロードエンドポイント` は今回の実装をそのまま再利用できる。
`Markdown挿入器` の代わりにカーソルコンテキストを判定する別の挿入器を組み合わせる形になる。
