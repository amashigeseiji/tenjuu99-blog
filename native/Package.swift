// swift-tools-version: 5.9
import PackageDescription

let package = Package(
  name: "NativeShell",
  platforms: [.macOS(.v13)],
  targets: [
    .executableTarget(
      name: "App",
      dependencies: ["NativeShellCore"]
    ),
    .target(
      name: "NativeShellCore"
    ),
    // XCTest/Swift Testing はこの環境（フルXcode未導入）では実行時リンクに失敗するため、
    // `swift run CoreTests` で動く自作の検証ハーネスを使う。plans/native-mac-shell/test-tree.md 参照。
    .executableTarget(
      name: "CoreTests",
      dependencies: ["NativeShellCore"],
      path: "Tests/NativeShellCoreTests"
    ),
  ]
)
