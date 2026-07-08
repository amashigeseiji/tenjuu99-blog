import Foundation

/// @vocab サーバーライフサイクル連動
/// @test native/Tests/NativeShellCoreTests/ServerLifecycleBindingTests.swift
public final class ServerLifecycleBinding {
  private let executableURL: URL
  private let arguments: [String]
  private let currentDirectoryURL: URL?
  private var process: Process?
  private var isStopping = false

  /// サーバープロセスの出力（stdout/stderr 合流）の観測ハンドラ。start() 前に設定する。
  /// 読み取り専用スレッドから呼ばれるため、UI 更新はメインスレッドへ移すこと。
  public var onOutput: ((String) -> Void)?

  /// 予期しない終了（stop() によらない終了）の観測ハンドラ。終了コードを受け取る。
  /// 呼び出し時点で、終了までの出力はすべて onOutput へ配信済みであることを保証する。
  public var onUnexpectedExit: ((Int32) -> Void)?

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

    let pipe = Pipe()
    process.standardOutput = pipe
    process.standardError = pipe

    try process.run()
    self.process = process
    isStopping = false

    let handle = pipe.fileHandleForReading
    Thread.detachNewThread { [weak self] in
      while true {
        let data = handle.availableData
        if data.isEmpty { break }  // EOF = プロセス終了
        if let text = String(data: data, encoding: .utf8) {
          self?.onOutput?(text)
        }
      }
      process.waitUntilExit()
      guard let self, !self.isStopping else { return }
      self.onUnexpectedExit?(process.terminationStatus)
    }
  }

  /// サーバープロセスが起動中かどうか
  public var isRunning: Bool {
    process?.isRunning ?? false
  }

  /// サーバープロセスを終了する
  public func stop() {
    guard let process, process.isRunning else { return }
    isStopping = true
    process.terminate()
    process.waitUntilExit()
    self.process = nil
  }
}
