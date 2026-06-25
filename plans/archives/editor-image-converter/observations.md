# Observations: editor-image-converter

**日時:** 2026-06-25

## 実装中の気づき

- `distributeImages` に渡すファイル一覧に `.gitkeep` などの非画像ファイルが含まれる。sharp が空バッファを受け取るとエラーになるため、IMAGE_EXTENSIONS フィルターが必要だった。ビルド時変換は「画像ファイルのみを変換し、他はコピーする」という振る舞いが正しい。

- `distribute_raw` は `"image,js"` のようにカンマ区切り複数ディレクトリを扱う。現状は `config.image_converter` が設定されている場合に全ディレクトリで `distributeImages` を呼ぶが、JS ファイルは変換対象外のため IMAGE_EXTENSIONS フィルターが全ディレクトリに有効に機能している。

- `lib/distribute.js` が `packages/editor/server/image_upload.js` の `createConverter` をインポートしている（lib → packages のクロスパッケージ依存）。将来的に `createConverter` を `lib/` に移動するリファクタリングが望ましいが、今回のスコープ外とした（findings に記載する価値あり）。

- 受け入れテスト（Playwright）でブラウザを使わずに関数を直接呼ぶ形にした。US-01 はブラウザ経由のドラッグ＆ドロップを想定しているが、ファイル操作レベルで十分な受け入れが取れている。

- Playwright testDir が `./e2e` のみを指していたため、`testMatch` を追加して `tests/acceptance/` も対象に含めた。
