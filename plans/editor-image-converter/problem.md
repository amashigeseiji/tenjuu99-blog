# 問題定義: 画像のWeb最適化（アップロード時・ビルド時）

**バージョン:** v2
**最終更新:** 2026-06-18
**関連設計資料:** packages/editor/server/image_upload.js, lib/distribute.js
**性格:** 現時点の問題理解のスナップショット。design/run/feedback を経て改版されることが正常な軌道。

## 変更履歴

### v2 (2026-06-18)
- スコープをエディタ単体からビルド時（generate）まで拡張
- PR #31 による実装状況を反映（converters/sharp.js は実装済み、sharp 本体は未インストール）
- 見送り判断（v1）を撤回。sharp を @tenjuu99/blog の依存として同梱する方針に変更

### v1 (2026-06-15)
- 初版（plans/editor-image-upload/findings.md F-01 を起点として作成）
- 見送りにより plans/archives/editor-image-converter/ にアーカイブ

---

## 問題

画像を利用するたびに、手動でWebに適したサイズ・フォーマットに変換する作業が発生する。
エディタからアップロードする場面でも、`generate` でビルドする場面でも、
画像はそのままのサイズ・フォーマットで保存・出力されるため、Web表示が重くなる。

### やりたいこと

- **アップロード時**: 画像をエディタからアップロードした時点で、Webに適したサイズ・フォーマットに変換されて保存される（手動変換が不要になる）
- **ビルド時**: `generate` を実行すると、ソースディレクトリの画像がWebに適した状態に変換されて dist に出力される（手動変換が不要になる）

### 障害・制約

- `@tenjuu99/blog` の依存関係に sharp が含まれておらず、ビルトインコンバーター（`"sharp"`）を設定しても変換が実行されない
- `distribute.js` の画像配布は `cpSync` によるコピーのみで、ビルド時の変換の仕組みが存在しない
- 過去に「本体の依存を増やしたくない」という判断で見送られたが、この制約を撤回する

### 観察された症状

- 現在運用しているブログで、アップロード前に画像を手動変換している
- `blog.json` に `image_converter: "sharp"` を設定しても変換されない（sharp 未インストールによるサイレントフォールバック）
- `generate` 後の `dist/` に、元のサイズのままの画像が配置される

## 範囲外

- 既存画像の再変換（アップロード・ビルド時のみ対象）
- 変換パラメータ（品質・リサイズ比率など）をUIから設定すること
- 画像の一覧管理・削除・リネーム
- アップロード機能自体の変更

## 解決したと言える状態（問題領域の言葉で）

- エディタから画像をアップロードすると、変換された状態で保存され、手動変換が不要になる
- `generate` を実行すると `dist/` にWebに適したサイズ・フォーマットの画像が出力され、手動変換が不要になる
- sharp が `@tenjuu99/blog` の依存として同梱されており、ユーザーが別途インストールしなくても変換が動作する

## 技術的背景（調査結果）

- **エディタ側の現状**: `packages/editor/server/converters/sharp.js` は実装済み（PR #31）。`createConverter` はビルトイン名 `"sharp"` を受け付けるが、sharp 未インストールのため import 失敗 → パススルーにフォールバックする
- **ビルド時の現状**: `lib/distribute.js` の `distributeRaw` は `cpSync` で画像ディレクトリをそのままコピーする。変換処理のフックはない
- **依存管理**: ルートの `package.json` に sharp がなく、`packages/editor` 固有の `package.json` も存在しない

## /tdd-run への申し送り

- **エディタ側**: `blog.json` で `image_converter: "sharp"` を設定した場合に変換が実際に動作するか、sharp インストール後に確認が必要
- **ビルド側**: `distribute.js` の画像コピー処理をどの粒度で変換に置き換えるか（全画像か、設定で制御するか）は設計で決める
- **語彙の種**: 「ビルトインコンバーター」が `plans/editor-image-converter/dictionary.md` に未定義（findings F-01 より）。promote 時に追加する
- **未確定点**: アップロード時とビルド時で「変換設定」は同じ `blog.json` の `image_converter` を共有するのか、それとも別設定にするのかは設計フェーズで判断する

## 参考資料

- `packages/editor/server/image_upload.js` — `createConverter`・`handleImageUpload` の実装
- `packages/editor/server/converters/sharp.js` — ビルトイン sharp コンバーター（実装済み・未接続）
- `lib/distribute.js` — `distributeRaw`（画像コピー処理。変換なし）
- `plans/editor-image-converter/dictionary.md` — ユーザー提供コンバーターモジュールの語彙
- `plans/archives/editor-image-converter/` — v1 アーカイブ（見送り判断の経緯）
