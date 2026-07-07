import { test, expect } from '@playwright/test'

// このプロジェクト（plans/native-mac-shell/）の受け入れ範囲は、AppKit のネイティブウィンドウ
// （NSWindow・WKWebView・プロセスライフサイクル）が中心であり、Playwright が自動操作できる
// のは「ブラウザで localhost の HTTP サーバーへアクセスする」ことだけ。
// ネイティブアプリの起動・ウィンドウ表示・終了時のプロセス停止は Playwright では検証できないため、
// plans/native-mac-shell/test-tree.md に記録した手動検証結果（実施済み）を正とする。

test.describe('US-01: アプリを起動すると編集画面が表示される', () => {
  test('シナリオ 1: 通常起動', async ({ page }) => {
    // Given: ネイティブMacアプリがインストール済みで、コンテンツディレクトリが用意されている
    // When: アプリのアイコンをダブルクリックして起動する
    // Then: アプリのウィンドウが開き、その中に編集画面（サイドバーやファイルツリーなど）が表示される
    test.skip(
      true,
      'AppKitウィンドウの起動・表示はPlaywrightの対象外（ブラウザ自動化ではないため）。' +
      '手動検証済み: swift run App でウィンドウが開き、/editor.html が表示されることを確認した（2026-07-03）。'
    )
  })

  test('シナリオ 2: 起動直後（サーバー起動待ち）', async ({ page }) => {
    // Given: アプリを起動した直後で、サーバーの起動処理がまだ完了していない
    // When: アプリのウィンドウが表示される
    // Then: エラー表示やクラッシュにはならず、サーバーの起動が完了し次第、編集画面に切り替わる
    test.skip(
      true,
      '起動待ち表示→編集画面の切り替え判定ロジック（表示状態判定器/DisplayStateResolver）は ' +
      'native/Tests/NativeShellCoreTests/DisplayStateResolverTests.swift で単体テスト済み（swift run CoreTests で green）。' +
      '実際の画面切り替わりはAppKit側の手動検証で確認済み。'
    )
  })
})

test.describe('US-02: アプリ内で記事の編集操作が一通り行える', () => {
  // native-shell コンテキストの out_of_scope に「編集操作の中身（editorコンテキストの実装）」と
  // 明記している通り、保存・プレビュー・ツリー操作そのものの検証は editor コンテキストの既存の
  // 受け入れテストが担う: editor-realtime-preview.spec.ts（プレビュー）、
  // editor-sidebar-status.spec.ts（ツリー・保存後のステータス反映）。
  // native-shell の受け入れ観点は「それらが外部ブラウザへの切り替えなしにアプリ内で完結すること」
  // だが、これは native-shell 側（WKWebViewでの表示）の話であり、editorコンテキストの
  // ブラウザ経由テストでは区別できないため手動検証とする。

  test('シナリオ 1: 記事を編集して保存する', async ({ page }) => {
    // Given: アプリが起動しており、編集画面が表示されている
    // When: 記事の本文を編集して保存操作を行う
    // Then: 変更が保存され、サイドバーの状態表示に反映される
    test.skip(
      true,
      '保存・ステータス反映のロジック自体は editor-sidebar-status.spec.ts でブラウザ経由検証済み。' +
      '「WKWebView内で外部切り替えなしに完結する」点は手動検証済み（2026-07-03、保存・プレビュー・ツリー操作を確認）。'
    )
  })

  test('シナリオ 2: プレビューを確認する', async ({ page }) => {
    // Given: 記事を編集中である
    // When: プレビュー操作を行う
    // Then: アプリのウィンドウ内でプレビューが表示される（別ウィンドウや外部ブラウザに切り替わらない）
    test.skip(
      true,
      'プレビュー自体のロジックは editor-realtime-preview.spec.ts でブラウザ経由検証済み。' +
      '「別ウィンドウ/外部ブラウザに切り替わらない」点はWKWebView内で完結する設計であり、手動検証済み。'
    )
  })

  test('シナリオ 3: ファイルツリーの操作（境界）', async ({ page }) => {
    // Given: 複数の記事ファイルが存在する
    // When: サイドバーのファイルツリーで開閉・選択操作を行う
    // Then: 選択したファイルの内容がエディタ領域に表示される
    test.skip(
      true,
      'ツリー操作自体は editor-sidebar-status.spec.ts でブラウザ経由検証済み。手動検証済み。'
    )
  })
})

test.describe('US-03: アプリを終了するとサーバーも終了する', () => {
  test('シナリオ 1: 通常終了', async ({ page }) => {
    // Given: アプリが起動しサーバーが稼働中である
    // When: ウィンドウを閉じる、またはアプリを終了する
    // Then: バックグラウンドで動いていたサーバープロセスも終了する
    test.skip(
      true,
      'プロセスライフサイクル管理（サーバーライフサイクル連動/ServerLifecycleBinding）は ' +
      'native/Tests/NativeShellCoreTests/ServerLifecycleBindingTests.swift で単体テスト済み（swift run CoreTests で green）。' +
      'SIGTERMでの強制終了時に `node bin/server` が孤児化する不具合を発見し、シグナルハンドラ追加で修正、' +
      '`kill <pid>` 後に `ps`/`lsof` で子プロセスが残らないことを実機で確認済み（2026-07-03）。'
    )
  })
})
