/// @vocab 表示状態判定器 (plans/native-mac-shell/dictionary.json)
/// @test native/Tests/NativeShellCoreTests/DisplayStateResolverTests.swift
public enum DisplayState: Equatable {
  case startupWaiting
  case editor
}

public enum DisplayStateResolver {
  /// - Parameter serverReady: サーバー起動完了検知の結果
  /// - Returns: アプリウィンドウが次に表示すべき画面
  public static func resolve(serverReady: Bool) -> DisplayState {
    serverReady ? .editor : .startupWaiting
  }
}
