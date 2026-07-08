import Foundation

/// エラー表示が画面に提示する内容。組み立てまでがテスト対象で、
/// 実際の提示（AppKit 配線）は AppDelegate が行う。
public struct ErrorDisplayContent: Equatable {
  /// 失敗段階に応じた見出し（起動失敗／起動後障害の区別が利用者に伝わる文言）
  public let title: String
  /// エラー内容（サーバー出力の要点）
  public let detail: String
  /// 診断ログの場所の案内
  public let logLocation: String

  public init(title: String, detail: String, logLocation: String) {
    self.title = title
    self.detail = detail
    self.logLocation = logLocation
  }
}

/// @vocab エラー表示
/// @test native/Tests/NativeShellCoreTests/ErrorDisplayTests.swift
public enum ErrorDisplay {
  /// 表示するエラー内容の最大行数。全文は診断ログにあるため、画面には直近の出力だけ出す。
  private static let maxDetailLines = 20

  /// 失敗段階とエラー内容と診断ログの場所から表示内容を組み立てる
  public static func compose(stage: FailureStage, errorOutput: String, logURL: URL?) -> ErrorDisplayContent {
    let title: String
    switch stage {
    case .beforeStartup:
      title = "サーバーの起動に失敗しました"
    case .afterStartup:
      title = "サーバーで問題が発生しました"
    }

    let lines = errorOutput.split(separator: "\n", omittingEmptySubsequences: false)
    let detail = lines.suffix(maxDetailLines).joined(separator: "\n")

    let logLocation = logURL.map { "詳細ログ: \($0.path)" } ?? "ログはまだ作成されていません"

    return ErrorDisplayContent(title: title, detail: detail, logLocation: logLocation)
  }
}
