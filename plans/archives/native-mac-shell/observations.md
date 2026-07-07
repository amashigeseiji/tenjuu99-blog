# Observations: native-mac-shell

**日時:** 2026-07-03

## 実装中の気づき

- **開発環境の制約**: このMacにはフル版Xcode.appが未導入（Command Line Toolsのみ）。`swift build` は動くが `swift test`（XCTest / Swift Testing どちらも）は `Testing.framework` の実行時リンクに失敗し動作しなかった（`Library not loaded: @rpath/Testing.framework`）。DYLD_FRAMEWORK_PATHを明示指定しても、署名済みの `swiftpm-testing-helper` 実行時にSIPで環境変数が無視される挙動を確認。フルXcode未導入環境では解決不可と判断し、`native/Tests/NativeShellCoreTests/` に自作の検証ハーネス（`TestHarness.swift`、`swift run CoreTests` で実行）を作って代用した。
- **ツリーの組み換えは起きていない**: 当初のツリー（サーバーライフサイクル連動／起動待ち表示／アプリウィンドウ）はほぼそのまま実装まで到達した。ただし分解の過程で「サーバー起動完了検知」「表示状態判定器」の2つをソリューションドメイン語彙として追加した（起動待ち表示の判定ロジックをAppKit非依存に切り出すため）。
- **手動検証で見つかったバグ**: `kill <pid>`（SIGTERM）でアプリを終了させると、AppKitの`applicationWillTerminate`が呼ばれず`node bin/server`が孤児プロセスとして残ることを実機検証で発見。`main.swift`に`DispatchSource.makeSignalSource`によるSIGTERM/SIGINTハンドラを追加して解消した。TDDの単体テスト（`ServerLifecycleBinding`のstart/stop）だけでは検出できなかった不具合で、ステップ8の「実際にアプリを起動して確認する」が無ければ見逃していた。
- **`swift run`特有の問題**: ターミナルから`swift run App`で起動すると、ウィンドウがTerminalの裏に隠れて表示されないことがあった。`NSApp.activate(ignoringOtherApps: true)`を追加して解消。`.app`バンドル化されていない実行ファイルゆえの挙動。
- **スキルの使い方で想定と違ったこと**: `.claude/tdd/scaffold.sh`と依存グラフツール（`depgraph-regen.js`）はNode/JS専用で、Swiftコードには使えなかった（scaffold.shは手動でSwiftファイルを作成する形で代用、depgraphは7.5でスキップとして記録）。TDDスキル自体は言語非依存の考え方（できるツリー、ロード可能性チェックなど）だが、付属ツール群はこのリポジトリのJS前提で作られているため、他言語コードを含むプロジェクトでは都度代替手段が必要になる。
- ユーザーストーリーテスト（`/tdd-userstory run`）もPlaywright（ブラウザ自動化）前提のため、AppKitネイティブウィンドウの検証には使えず、全シナリオ`test.skip`で手動検証結果を記録する形になった（詳細は`findings.md`）。
