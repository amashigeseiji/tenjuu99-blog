import { test, expect } from '@playwright/test'

// このプロジェクト（plans/error-visibility/）の受け入れ範囲は、ネイティブアプリの異常系表示
// （サーバープロセスの失敗観測 → エラー表示）であり、AppKit ウィンドウの表示は Playwright の
// 対象外。native-mac-shell.spec.ts と同じ方針で、コアロジックの検証は
// `swift run CoreTests`（native/Tests/NativeShellCoreTests/）を正とし、画面への提示は手動検証とする。

test.describe('US-01: エラーが起きたとき何が起きたかを知る', () => {
  test('シナリオ 1: サーバーの起動に失敗した', async ({ page }) => {
    // Given: アプリを起動したが、サーバーが起動に失敗する状況である
    // When: 利用者がアプリを起動する
    // Then: 真っ白な画面だけが残る、という状態にならない
    // And: 利用者は「起動に失敗した」ことと、その内容（または内容を確認できる場所）を、
    //      アプリ外部の知識なしに知ることができる
    test.skip(
      true,
      'コア経路（異常終了の観測→起動失敗の判定→見出し・エラー内容・ログの場所の組み立て→診断ログへの残存）は ' +
      'ErrorVisibilityRootTests.swift のルート合成テストで実際に異常終了するプロセスを使って検証済み（swift run CoreTests で green）。' +
      '画面への提示（AppDelegate.showError）は手動検証: 壊れた blog.json を持つフォルダをコンテンツルートに選んで ' +
      'dist-app/tenjuu99-blog.app を起動し、起動失敗の見出し・エラー内容・「ログを表示」ボタンが出ることを確認する。'
    )
  })

  test('シナリオ 2: 起動後にエラーが発生した', async ({ page }) => {
    // Given: アプリが起動し、いったん使える状態になっている
    // When: サーバー側でエラーが発生して正常に使えない状態になる
    // Then: 利用者は「起動後に問題が起きた」ことを、起動失敗と区別して知ることができる
    // And: その内容（または内容を確認できる場所）にアプリ外部の知識なしに辿り着ける
    test.skip(
      true,
      '起動後の失敗を起動失敗と区別する判定（editor 表示後のプロセス消滅 → 起動後障害）は ' +
      'DisplayStateResolverTests.swift の testDisplayStateResolverFailureStage で単体テスト済み。' +
      '見出しが起動失敗と異なることは ErrorDisplayTests.swift で検証済み。' +
      '実機では編集画面表示後に `kill <node の pid>` してエラー表示に切り替わることを手動検証する。'
    )
  })

  test('シナリオ 3: 正常時は余計な表示がない', async ({ page }) => {
    // Given: アプリが正常に起動し、正常に動作している
    // When: 利用者がアプリを使う
    // Then: エラーに関する表示は現れず、従来どおりの利用体験が保たれる
    test.skip(
      true,
      'エラー表示は表示状態が failed のときだけ提示され、正常系の表示遷移（起動待ち→編集画面）は変更していない' +
      '（DisplayStateResolverTests.swift の既存テストが green のまま）。' +
      '編集画面の正常動作は editor 系の既存受け入れテスト（editor-*.spec.ts）が担う。'
    )
  })
})
