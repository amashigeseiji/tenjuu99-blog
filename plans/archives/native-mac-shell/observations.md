# Observations: native-mac-shell

**日時:** 2026-07-03

## 実装中の気づき

- **開発環境の制約**: このMacにはフル版Xcode.appが未導入（Command Line Toolsのみ）。`swift build` は動くが `swift test`（XCTest / Swift Testing どちらも）は `Testing.framework` の実行時リンクに失敗し動作しなかった（`Library not loaded: @rpath/Testing.framework`）。DYLD_FRAMEWORK_PATHを明示指定しても、署名済みの `swiftpm-testing-helper` 実行時にSIPで環境変数が無視される挙動を確認。フルXcode未導入環境では解決不可と判断し、`native/Tests/NativeShellCoreTests/` に自作の検証ハーネス（`TestHarness.swift`、`swift run CoreTests` で実行）を作って代用した。
- **ツリーの組み換えは起きていない**: 当初のツリー（サーバーライフサイクル連動／起動待ち表示／アプリウィンドウ）はほぼそのまま実装まで到達した。ただし分解の過程で「サーバー起動完了検知」「表示状態判定器」の2つをソリューションドメイン語彙として追加した（起動待ち表示の判定ロジックをAppKit非依存に切り出すため）。
- **手動検証で見つかったバグ**: `kill <pid>`（SIGTERM）でアプリを終了させると、AppKitの`applicationWillTerminate`が呼ばれず`node bin/server`が孤児プロセスとして残ることを実機検証で発見。`main.swift`に`DispatchSource.makeSignalSource`によるSIGTERM/SIGINTハンドラを追加して解消した。TDDの単体テスト（`ServerLifecycleBinding`のstart/stop）だけでは検出できなかった不具合で、ステップ8の「実際にアプリを起動して確認する」が無ければ見逃していた。
- **`swift run`特有の問題**: ターミナルから`swift run App`で起動すると、ウィンドウがTerminalの裏に隠れて表示されないことがあった。`NSApp.activate(ignoringOtherApps: true)`を追加して解消。`.app`バンドル化されていない実行ファイルゆえの挙動。
- **スキルの使い方で想定と違ったこと**: `.claude/tdd/scaffold.sh`と依存グラフツール（`depgraph-regen.js`）はNode/JS専用で、Swiftコードには使えなかった（scaffold.shは手動でSwiftファイルを作成する形で代用、depgraphは7.5でスキップとして記録）。TDDスキル自体は言語非依存の考え方（できるツリー、ロード可能性チェックなど）だが、付属ツール群はこのリポジトリのJS前提で作られているため、他言語コードを含むプロジェクトでは都度代替手段が必要になる。
- ユーザーストーリーテスト（`/tdd-userstory run`）もPlaywright（ブラウザ自動化）前提のため、AppKitネイティブウィンドウの検証には使えず、全シナリオ`test.skip`で手動検証結果を記録する形になった（詳細は`findings.md`）。

## 実装中の気づき（2026-07-17 F-05: ファイル選択応答器）

- editor-image-library の利用フィードバック F-05（mac app で新規画像投稿のファイル選択モーダルが表示されない）への対応で、このプランをアーカイブから再開した。原因は診断どおり、アプリウィンドウが編集画面からのファイル選択要求への応答（uiDelegate）を欠いていたこと
- ツリーは既存の「アプリウィンドウ」に子ノード「ファイル選択応答器」を1つ追加する差分で収まり、組み換えは起きていない。コンテンツルート解決器と同じ「選択の場の注入」パターンで純粋ロジックを NativeShellCore に切り出し、red→green は1イテレーションで通過
- scaffold.sh は native-shell（Swift）対応済みになっていたが、`@vocab` の日本語名逆引きは docs/dictionary.json のみを参照するため、plans 側 dictionary にしかない新規語彙は英語名にフォールバックした（手動で日本語名に修正）。scaffold.sh が plans/<project>/dictionary.json も逆引き対象にできると手修正が不要になる
- 依存グラフチェック（7.5）は depgraph が JS 前提のため native/ 配下の Swift には適用外としてスキップ（2026-07-03 の気づきと同種）。ユーザーストーリーテストも同様に手動検証で代替
- **手動検証（2026-07-17）**: 組み立て済み .app 上で、新規作成タブからのファイル選択パネル表示→画像選択→追加を作成者が確認し、期待どおり動作した（F-05 解消）
- **手動検証の手順で2回つまずいた（教訓）**: (1) バンドルレイアウト解決器の導入後は `swift run App` 単体では同梱 node が存在せず、コンテンツルート選択直後のサーバー起動が必ず失敗する。手動検証は release ビルド → `node scripts/app-bundle/build-local.js` → `dist-app/tenjuu99-blog.app` の起動で行う。(2) .app を組み立て直しても旧インスタンスが起動中だと `open` は旧インスタンスを前面化するだけなので、旧プロセスの終了を確認してから起動する。どちらも「エラーに見えるが修正対象の不具合ではない」誤診を誘発した
