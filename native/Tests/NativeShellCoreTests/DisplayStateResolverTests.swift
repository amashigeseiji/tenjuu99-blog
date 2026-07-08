import NativeShellCore

// 表示状態判定器は 検知結果から次に表示すべき画面を決定できる
func testDisplayStateResolver(_ t: TestCase) {
  t.expect(
    DisplayStateResolver.resolve(serverReady: false) == .startupWaiting,
    "サーバー未起動なら起動待ち表示を返す"
  )
  t.expect(
    DisplayStateResolver.resolve(serverReady: true) == .editor,
    "サーバー起動完了なら編集画面を返す"
  )
}

// 表示状態判定器は サーバーの生死と起動完了の観測から失敗段階を含む表示状態を判定できる
func testDisplayStateResolverFailureStage(_ t: TestCase) {
  t.expect(
    DisplayStateResolver.resolve(current: .startupWaiting, serverReady: false, serverAlive: true)
      == .startupWaiting,
    "起動待ち中でプロセスが生きていれば起動待ちのまま"
  )
  t.expect(
    DisplayStateResolver.resolve(current: .startupWaiting, serverReady: true, serverAlive: true)
      == .editor,
    "起動完了したら編集画面"
  )
  t.expect(
    DisplayStateResolver.resolve(current: .startupWaiting, serverReady: false, serverAlive: false)
      == .failed(.beforeStartup),
    "起動前にプロセスが死んだら起動失敗"
  )
  t.expect(
    DisplayStateResolver.resolve(current: .editor, serverReady: false, serverAlive: false)
      == .failed(.afterStartup),
    "編集画面の表示後にプロセスが死んだら起動後障害"
  )
  t.expect(
    DisplayStateResolver.resolve(current: .editor, serverReady: true, serverAlive: true)
      == .editor,
    "正常稼働中は編集画面のまま"
  )
  t.expect(
    DisplayStateResolver.resolve(current: .failed(.beforeStartup), serverReady: false, serverAlive: false)
      == .failed(.beforeStartup),
    "一度失敗と判定したら維持する"
  )
}
