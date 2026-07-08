import Foundation

/// @vocab バンドルレイアウト解決器 (plans/native-shell-distribution/dictionary.json)
/// @test native/Tests/NativeShellCoreTests/BundleLayoutResolverTests.swift
///
/// `.app` に同梱された、読み取り専用リソースの絶対パス。
/// 配置先は scripts/app-bundle/manifest.json の dest と対応している（同じ契約を2箇所に書いている点に注意）。
public struct BundleLayout: Equatable {
  public let nodeExecutableURL: URL
  public let serverEntryURL: URL
  /// 同梱モジュール解決器の登録スクリプト。Node 起動時に `--import` で渡すことで、
  /// コンテンツルートのコードからの `@tenjuu99/blog` への参照を同梱コードへ解決する。
  /// コンテンツルートには一切書き込まない（既存物保護）。
  public let moduleResolverRegistrationURL: URL
}

public enum BundleLayoutResolver {
  /// - Parameter bundleURL: 実行中の `.app` 自体の場所（`Bundle.main.bundleURL`）
  /// - Returns: 同梱されたNode実行ファイル・アプリコードエントリー・解決器登録スクリプトの絶対パス
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
    let moduleResolverRegistrationURL = appURL
      .appendingPathComponent("scripts")
      .appendingPathComponent("app-bundle")
      .appendingPathComponent("registerBundledModuleResolver.js")
    return BundleLayout(
      nodeExecutableURL: nodeExecutableURL,
      serverEntryURL: serverEntryURL,
      moduleResolverRegistrationURL: moduleResolverRegistrationURL
    )
  }
}
