import Foundation

/// ファイル選択要求の条件（要求元が提示する制約）
public struct FileSelectionRequest: Equatable {
  /// 複数ファイルの選択を許すか
  public let allowsMultipleSelection: Bool

  public init(allowsMultipleSelection: Bool) {
    self.allowsMultipleSelection = allowsMultipleSelection
  }
}

/// @vocab ファイル選択応答器
/// @test native/Tests/NativeShellCoreTests/FileSelectionResponderTests.swift
public enum FileSelectionResponder {
  /// 編集画面からのファイル選択要求に応じて作成者にファイルを選ばせ、
  /// 選択結果を要求の条件に整合させて要求元へ返す。
  /// - Parameters:
  ///   - request: 要求の条件（複数選択の可否）
  ///   - pickFiles: 作成者にファイルを選ばせる関数（注入。AppKit非依存に保つため）。取りやめ時はnilを返す
  /// - Returns: 選択されたファイル群。取りやめ（および空の選択）はnil
  public static func respond(
    request: FileSelectionRequest,
    pickFiles: (FileSelectionRequest) -> [URL]?
  ) -> [URL]? {
    guard let picked = pickFiles(request), !picked.isEmpty else {
      return nil
    }
    return request.allowsMultipleSelection ? picked : [picked[0]]
  }
}
