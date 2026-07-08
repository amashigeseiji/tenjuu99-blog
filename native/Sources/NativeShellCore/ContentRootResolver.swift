import Foundation

/// @vocab コンテンツルート解決器
/// @test native/Tests/NativeShellCoreTests/ContentRootResolverTests.swift
public enum ContentRootResolutionError: Error, Equatable {
  /// 選ばれたフォルダに blog.json が存在しない（新規作成はこの装置の責務に含めない）
  case blogJsonNotFound(URL)
  /// フォルダ選択ダイアログでユーザーがキャンセルした
  case userCancelled
}

/// @vocab 切り替え結果
/// 選びなおしの帰結。取りやめ（silent）と拒否（利用者への通知が必要）を区別する
public enum SwitchOutcome: Equatable {
  /// blog.json を持つフォルダが選ばれ、新しいコンテンツルートへの切り替えが確定した
  case switched(URL)
  /// 選択が取りやめられた。現在のコンテンツルートを継続する
  case cancelled
  /// 選ばれたフォルダに blog.json が無く、切り替えを退けた。現在のコンテンツルートを継続する
  case rejected(URL)
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

  /// 記憶済みのコンテンツルートがあっても、利用者の選びなおしに応じて切り替え結果を確定する。
  /// 初回解決（resolve）と異なり、キャンセルや blog.json 不在は「現在のコンテンツルートの継続」であり
  /// エラー（起動不能）ではない。
  /// - Parameters:
  ///   - blogJsonExists: 指定パス直下に blog.json が存在するかを判定する関数（注入。AppKit非依存に保つため）
  ///   - pickFolder: ユーザーにフォルダ選択をさせる関数（注入）。キャンセル時はnilを返す
  /// - Returns: 切り替え結果
  public static func reselect(
    blogJsonExists: (URL) -> Bool,
    pickFolder: () -> URL?
  ) -> SwitchOutcome {
    guard let pickedURL = pickFolder() else {
      return .cancelled
    }
    guard blogJsonExists(pickedURL) else {
      return .rejected(pickedURL)
    }
    return .switched(pickedURL)
  }
}
