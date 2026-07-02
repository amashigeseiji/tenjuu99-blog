import Foundation

/// @vocab コンテンツルート解決器 (plans/native-shell-distribution/dictionary.json)
/// @test native/Tests/NativeShellCoreTests/ContentRootResolverTests.swift
public enum ContentRootResolutionError: Error, Equatable {
  /// 選ばれたフォルダに blog.json が存在しない（新規作成はこの装置の責務に含めない）
  case blogJsonNotFound(URL)
  /// フォルダ選択ダイアログでユーザーがキャンセルした
  case userCancelled
}

public enum ContentRootResolver {
  /// - Parameters:
  ///   - rememberedURL: 永続化ストアから読み出した記憶済みパス（無ければnil）
  ///   - blogJsonExists: 指定パス直下に blog.json が存在するかを判定する関数（注入。AppKit非依存に保つため）
  ///   - pickFolder: ユーザーにフォルダ選択をさせる関数（注入）。キャンセル時はnilを返す
  /// - Returns: 確定したコンテンツルートのURL、またはエラー
  public static func resolve(
    rememberedURL: URL?,
    blogJsonExists: (URL) -> Bool,
    pickFolder: () -> URL?
  ) -> Result<URL, ContentRootResolutionError> {
    if let rememberedURL, blogJsonExists(rememberedURL) {
      return .success(rememberedURL)
    }
    guard let pickedURL = pickFolder() else {
      return .failure(.userCancelled)
    }
    guard blogJsonExists(pickedURL) else {
      return .failure(.blogJsonNotFound(pickedURL))
    }
    return .success(pickedURL)
  }
}
