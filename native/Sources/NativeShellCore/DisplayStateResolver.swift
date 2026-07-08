/// @vocab 表示状態判定器 (plans/native-mac-shell/dictionary.json)
/// @test native/Tests/NativeShellCoreTests/DisplayStateResolverTests.swift
public enum DisplayState: Equatable {
  case startupWaiting
  case editor
  /// 異常系: 失敗段階つきのエラー表示
  case failed(FailureStage)
}

public enum DisplayStateResolver {
  /// - Parameter serverReady: サーバー起動完了検知の結果
  /// - Returns: アプリウィンドウが次に表示すべき画面
  public static func resolve(serverReady: Bool) -> DisplayState {
    serverReady ? .editor : .startupWaiting
  }

  /// サーバーの生死と起動完了の観測から、失敗段階を含む表示状態を判定する。
  /// - Parameters:
  ///   - current: 現在の表示状態（起動前か起動後かの区別の根拠）
  ///   - serverReady: サーバー起動完了検知の結果
  ///   - serverAlive: サーバープロセスが生きているか
  public static func resolve(current: DisplayState, serverReady: Bool, serverAlive: Bool) -> DisplayState {
    // 一度失敗と判定したら、その後の観測で上書きしない（エラー表示が消えて真っ白に戻るのを防ぐ）
    if case .failed = current { return current }
    if !serverAlive {
      return current == .editor ? .failed(.afterStartup) : .failed(.beforeStartup)
    }
    if serverReady { return .editor }
    return current
  }
}
