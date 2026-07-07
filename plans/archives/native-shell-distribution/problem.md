# 問題定義: ネイティブアプリの配布パッケージング

**バージョン:** v1
**最終更新:** 2026-07-03
**作業ディレクトリ:** /Users/amashige/dev/tenjuu99-blog
**コンテキスト:** ネイティブアプリの配布パッケージング
**関連設計資料:** node-sea.md（配布方式の技術的検討経緯）, plans/archives/native-mac-shell/problem.md, docs/dictionary.json（`native-shell` コンテキスト）
**性格:** 現時点の問題理解のスナップショット。design/run/feedback を経て改版されることが正常な軌道。

## 変更履歴

### v1 (2026-07-03)
- 初版

---

## 問題

### やりたいこと

- `@tenjuu99/blog` を、Node.jsが入っていないMacを使うノンエンジニアの知人に、`.app`としてFinderからダブルクリックで起動できる配布物として渡したい
- その配布物には Node本体・sharp（画像処理のネイティブ依存）・ソースコード一式（`lib/`, `packages/` 等）が同梱されており、相手のMacに何もインストールしなくても動作する状態にしたい
- 配布の入り口はネイティブアプリ（`.app`）に一本化する（`.command` + ターミナル方式は採用しない）

### 障害・制約

- 現状の `native/`（ネイティブシェルのプロトタイプ）は、開発者自身のインストール済みNodeバイナリ（`/usr/bin/env node`）を呼び出す作りになっており、Node未インストール環境では動作しない
- sharpのネイティブアドオンも同様に、配布先環境向けに用意されていない
- ソースコード本体（`lib/`, `packages/` 等）もリポジトリ依存で、`native/` は開発者自身のリポジトリをコンテンツディレクトリとして使っている
- `.app` バンドル化自体が未着手（現状は Swift Package Manager 経由のコマンドライン実行のみ）

### 観察された症状

特になし。既存の不具合の是正ではなく、新規に構築する対象である。

## 範囲外

- 記事の編集操作自体の実装（`native-mac-shell` で解決済みの範囲）
- 「公開する」（Publish/git操作）フロー
- コード署名・notarization（署名なし・Gatekeeperの初回警告は許容する方針を維持。年$99のApple Developer Program登録は今回の配布規模には見合わないという既存判断を踏襲）
- ビルド・配布パイプライン（GitHub Actionsでのビルド、zip化、GitHub Releasesへの公開など）— 存在は認識しているが、次フェーズに回す

## 解決したと言える状態（問題領域の言葉で）

- Node未インストールのMacで、`.app` をFinderからダブルクリックするだけで `@tenjuu99/blog` のネイティブアプリが起動し、起動〜編集操作（`native-mac-shell` で解決済みの範囲）が一通り行える
- その `.app` は Node本体・sharp・ソースコード一式を内包しており、動作に外部インストールを必要としない
- 未署名であることに起因するGatekeeperの初回警告は発生してよい（回避策は求めない）

## 他の問題との関係

- `前提とする`: plans/archives/native-mac-shell/problem.md — ネイティブアプリでの起動〜編集操作自体が先に成立している必要がある（解決済み）

## 技術的背景（調査結果）

- `native/` プロトタイプ（`plans/archives/native-mac-shell/` で構築）は `ServerLifecycleBinding` を `/usr/bin/env node bin/server` に固定しており、`currentDirectoryURL` はこのリポジトリ自身のルート（`#filePath` から解決）になっている。開発者自身のNodeとリポジトリを前提にした作り
- `node-sea.md` にて、Node未インストール環境への配布方式として「Node本体同梱（vendored node binary）」が既に検討・決定されている：`node/bin/node` を素の実行ファイルとしてコピーし、`lib/`・`packages/`・`node_modules`（sharp含む）一式をその隣に生ファイルとして配置する構成。SEA/postjectは、`lib/generate.js` の `runHooks` が動的 `import()` でフックファイルをファイルシステムから読む設計のため不採用と判明済み
- sharpは `optionalDependencies` によりプラットフォームごとのネイティブバイナリを分離配布しており、macOS arm64環境で `npm ci --omit=dev` すれば `darwin-arm64` 用バイナリのみが自動選択されることが判明済み（node-sea.mdの検証結果）
- `docs/dictionary.json` の `native-shell` コンテキストは「コード署名・配布パッケージング」を明示的に out_of_scope としており、本問題はその境界の外側（＝配布パッケージング領域）を扱う
- `node-sea.md` の既存決定はいずれも `.command` 方式向けに検討されたものだが、「Node本体・sharpのネイティブバイナリ・ソースコード一式をどこかに同梱する」という技術的要請自体は、配布の入り口が `.app` に変わっても共通して残ると考えられる

## /tdd-run への申し送り

- 「`.app` バンドル」「配布パッケージング」に相当する語彙は `docs/dictionary.json` の `native-shell` コンテキストの `out_of_scope` に触れられているのみで、正式な語彙エントリはない → 新規語彙の候補
- `native/`（Swift Package）側にNode本体・sharp・ソースコードをどう同梱するか（`.app` の `Contents/Resources/` 配下に置く等）は設計フェーズの論点
- 対応OS/アーキテクチャ（Apple Silicon (arm64) のみ、という `node-sea.md` の既存決定を踏襲するか）は、この問題定義の中では確認していない未確定点
- 配布方式を `.app` に一本化する決定は、対話の中でユーザーに確認して確定した（`.command` 方式は採用しない）

## 参考資料

- node-sea.md
- plans/archives/native-mac-shell/problem.md
- plans/archives/native-mac-shell/findings.md
- docs/dictionary.json
- docs/spec.md
