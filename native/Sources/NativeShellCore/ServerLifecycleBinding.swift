import Foundation

/// @vocab サーバーライフサイクル連動 (plans/native-mac-shell/dictionary.json)
/// @test native/Tests/NativeShellCoreTests/ServerLifecycleBindingTests.swift
public final class ServerLifecycleBinding {
  private let executableURL: URL
  private let arguments: [String]
  private let currentDirectoryURL: URL?
  private var process: Process?

  public init(executableURL: URL, arguments: [String] = [], currentDirectoryURL: URL? = nil) {
    self.executableURL = executableURL
    self.arguments = arguments
    self.currentDirectoryURL = currentDirectoryURL
  }

  /// サーバープロセスを起動する
  public func start() throws {
    let process = Process()
    process.executableURL = executableURL
    process.arguments = arguments
    if let currentDirectoryURL {
      process.currentDirectoryURL = currentDirectoryURL
    }
    try process.run()
    self.process = process
  }

  /// サーバープロセスが起動中かどうか
  public var isRunning: Bool {
    process?.isRunning ?? false
  }

  /// サーバープロセスを終了する
  public func stop() {
    guard let process, process.isRunning else { return }
    process.terminate()
    process.waitUntilExit()
    self.process = nil
  }
}
