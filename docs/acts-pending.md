# 行為の登記保留

witness（受け入れテスト）が無いため登記しなかった行為。
受け入れテストが書かれたときに、通常の登記（feedback の毎周登記）へ回す。

| actor | claim | 源泉 | 保留理由 |
|-------|-------|------|---------|
| アプリ利用者 | アプリの通常操作でコンテンツフォルダを別プロジェクトへ切り替えられる | plans/archives/content-root-switching | 受け入れテストが全シナリオ skip（実機手動検証 2026-07-08） |
| アプリ利用者 | エラーが起きたとき、何が起きたかと確認先をアプリ外部の知識なしに知ることができる | plans/archives/error-visibility | 受け入れテストが全シナリオ skip（Swift ルート合成テスト＋手動検証 2026-07-09） |
| アプリ利用者 | アイコンのダブルクリックで起動し、編集画面が表示される | plans/archives/native-mac-shell | 受け入れテストが全シナリオ skip（AppKit は Playwright 対象外、手動検証 2026-07-03） |
| アプリ利用者 | 記事の保存・プレビュー・ファイルツリー操作をアプリ内で一通り行える | plans/archives/native-mac-shell | 同上 |
| アプリ利用者 | アプリを終了するとサーバーも終了する | plans/archives/native-mac-shell | 同上 |
| 開発者 | 公開に関わる概念を、特定の手段の言葉なしで語れる | plans/archives/publish-abstraction | 受け入れテスト（US-02）が全シナリオ skip（設計レビュー・構造で担保） |
