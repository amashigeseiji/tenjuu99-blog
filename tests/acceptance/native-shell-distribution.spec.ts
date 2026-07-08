import { test, expect } from '@playwright/test'

// このプロジェクト（plans/native-shell-distribution/）の受け入れ範囲は、.appバンドル自体の
// 起動・フォルダ選択ダイアログ・プロセスライフサイクルが中心であり、Playwrightが自動操作できる
// のは「ブラウザ/WKWebViewでlocalhostのHTTPサーバーへアクセスする」ことだけ。
// .appのダブルクリック起動、AppKitのフォルダ選択ダイアログ操作、Gatekeeper警告の実際の表示は
// Playwrightでは検証できないため、plans/native-shell-distribution/test-tree.md と本ファイルの
// 手動検証記録（実施済み）を正とする。

test.describe('US-01: ノンエンジニアがNode未インストールのMacでアプリを使う', () => {
  test('シナリオ 1: 正常系 - 初回起動から編集操作まで', async ({ page }) => {
    // Given: Node.jsやsharpがインストールされていないMacに、配布された.appが置かれている
    // When: ユーザーが.appをFinderからダブルクリックする
    // Then: ネイティブアプリのウィンドウが開き、起動〜編集操作が一通り行える
    test.skip(
      true,
      '実機（本機のシステムNode/npmではなく、.app内に同梱したNode本体・sharpバイナリのみ）で手動検証済み（2026-07-03）。' +
        '`.app`を`open`で起動→初回はコンテンツルート選択ダイアログが表示→blog.jsonを含むフォルダを選択→' +
        'サーバー起動→`curl http://127.0.0.1:8000/editor.html`が200を返すことを確認。' +
        '検証中に2つの実装バグを発見し修正した: ' +
        '(1) NSApp.activateの呼び出し位置がフォルダ選択ダイアログより後になっており、ダイアログが' +
        '前面化されないバグ → activateをダイアログ表示前に移動して修正。' +
        '(2) コンテンツルート（外部フォルダ）からはNodeのESM解決が.app内のnode_modulesに' +
        '辿り着けず`@tenjuu99/blog`が解決できないバグ → コンテンツルート直下にnode_modulesへの' +
        'シンボリックリンクを作成する配線（コンテンツルートモジュール解決リンク）を追加して修正。' +
        '（このリンク配線は既存の実体node_modulesを破壊するため、後のplans/node-modules-destructionで' +
        '同梱モジュール解決器に置き換えられ廃止された）'
    )
  })

  test('シナリオ 2: 境界系 - 未署名アプリのGatekeeper警告', async ({ page }) => {
    // Given: 配布された.appが署名されていない
    // When: ユーザーが初めて.appをダブルクリックする
    // Then: macOSが「開発元が未確認のため開けません」という警告を表示するが、
    //       ユーザーが右クリック→「開く」を選ぶことで起動を継続できる
    test.skip(
      true,
      '未検証（手動確認できず）。Gatekeeperの初回警告はダウンロード等でOS付与されるquarantine' +
        '属性（com.apple.quarantine）が起点であり、本セッションではローカルビルドした.appを' +
        'そのまま実行したため quarantine 属性が付与されず、警告の実際の表示は再現できなかった。' +
        '問題定義上は許容方針（署名なし・初回警告は許容）だが、実際にダウンロード経由で配布した' +
        '場合の警告表示とその後の起動継続は次フェーズ（配布パイプライン構築時）に確認が必要。'
    )
  })
})

test.describe('US-02: 配布物が外部依存を必要とせず自己完結している', () => {
  test('シナリオ 1: 正常系 - クリーンな環境での自己完結性', async ({ page }) => {
    // Given: .appがNode未インストール・sharp未インストールのクリーンなMac環境に置かれている
    // When: .appを起動する
    // Then: Node本体・sharpのネイティブバイナリ・ソースコード（lib/, packages/等）が.app内部
    //       から解決され、外部のnodeコマンドやグローバルインストール済みパッケージに依存せず動作する
    test.skip(
      true,
      '手動検証済み（2026-07-03）。`.app`のContents/Resources/node/bin/node（システムのnodeでは' +
        'なく、実行中のNodeバイナリをそのままコピーしたもの）と、Contents/Resources/app/node_modules' +
        '（`npm ci --omit=dev`でインストールしたsharp等の darwin-arm64 ネイティブバイナリを含む）' +
        'だけでサーバーが起動しSSG生成が完走することを、システムのnode/npmを経由しない直接実行で確認。' +
        'また、配置マッピング解決器・バンドル書き出し器・配布物組み立て器はtests/app-bundle/配下で' +
        '単体・統合テスト済み（`npm test`でgreen）。' +
        'なお本セッションのCI/配布パイプライン自体（Node公式バイナリのvendoring自動化等）は' +
        '次フェーズに位置づけられており未実装 — 今回はNode本体の代わりに実行中のNodeバイナリを' +
        '流用したローカルビルド（scripts/app-bundle/build-local.js）で検証した。'
    )
  })
})
