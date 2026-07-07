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
