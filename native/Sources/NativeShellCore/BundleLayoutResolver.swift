import Foundation

/// @vocab バンドルレイアウト解決器 (plans/native-shell-distribution/dictionary.json)
/// @test native/Tests/NativeShellCoreTests/BundleLayoutResolverTests.swift
///
/// `.app` に同梱された、読み取り専用リソースの絶対パス。
/// 配置先は scripts/app-bundle/manifest.json の dest と対応している（同じ契約を2箇所に書いている点に注意）。
public struct BundleLayout: Equatable {
  public let nodeExecutableURL: URL
  public let serverEntryURL: URL
  /// 同梱アプリコード自身の node_modules。コンテンツルートから `@tenjuu99/blog` 等の
  /// bare specifier importを解決可能にするため、起動時にこの場所へのシンボリックリンクを
  /// コンテンツルート直下に作る必要がある（Node のESM解決はコンテンツルートの祖先を遡っても
  /// ここへは辿り着けないため）。
  public let nodeModulesURL: URL
}

public enum BundleLayoutResolver {
  /// - Parameter bundleURL: 実行中の `.app` 自体の場所（`Bundle.main.bundleURL`）
  /// - Returns: 同梱されたNode実行ファイル・アプリコードエントリー・node_modulesの絶対パス
  public static func resolve(bundleURL: URL) -> BundleLayout {
    let resourcesURL = bundleURL
      .appendingPathComponent("Contents")
      .appendingPathComponent("Resources")
    let nodeExecutableURL = resourcesURL
      .appendingPathComponent("node")
      .appendingPathComponent("bin")
      .appendingPathComponent("node")
    let appURL = resourcesURL.appendingPathComponent("app")
    let serverEntryURL = appURL
      .appendingPathComponent("bin")
      .appendingPathComponent("server")
    let nodeModulesURL = appURL.appendingPathComponent("node_modules")
    return BundleLayout(
      nodeExecutableURL: nodeExecutableURL,
      serverEntryURL: serverEntryURL,
      nodeModulesURL: nodeModulesURL
    )
  }
}
