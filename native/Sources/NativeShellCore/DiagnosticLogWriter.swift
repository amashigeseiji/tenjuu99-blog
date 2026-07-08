import Foundation

/// @vocab 診断ログ書き出し (plans/error-visibility/dictionary.json)
/// @test native/Tests/NativeShellCoreTests/DiagnosticLogWriterTests.swift
/// サーバー出力を診断ログとして残す装置。起動のたびに新しいログに切り替え、
/// 直近数回の起動分だけ保持して古いものを消す（溜め込まない）。
public final class DiagnosticLogWriter {
  public let directory: URL
  public let maxSessions: Int

  /// 現在の起動セッションのログファイル。startSession() まで nil。
  public private(set) var currentLogURL: URL?

  private var handle: FileHandle?

  public init(directory: URL, maxSessions: Int = 5) {
    self.directory = directory
    self.maxSessions = maxSessions
  }

  deinit {
    try? handle?.close()
  }

  /// 新しい起動セッションのログを開始し、maxSessions を超える古い世代を削除する
  public func startSession(now: Date = Date()) throws {
    let fm = FileManager.default
    try fm.createDirectory(at: directory, withIntermediateDirectories: true)

    // ファイル名のタイムスタンプは固定幅なので、名前の辞書順が新旧順になる
    let formatter = DateFormatter()
    formatter.dateFormat = "yyyyMMdd-HHmmss"
    formatter.locale = Locale(identifier: "en_US_POSIX")

    var url = directory.appendingPathComponent("server-\(formatter.string(from: now)).log")
    var counter = 1
    while fm.fileExists(atPath: url.path) {
      url = directory.appendingPathComponent("server-\(formatter.string(from: now))-\(counter).log")
      counter += 1
    }
    fm.createFile(atPath: url.path, contents: nil)
    currentLogURL = url
    handle = try FileHandle(forWritingTo: url)

    pruneOldSessions()
  }

  /// サーバー出力を現在のセッションのログに追記する
  public func append(_ text: String) {
    guard let handle, let data = text.data(using: .utf8) else { return }
    handle.seekToEndOfFile()
    handle.write(data)
  }

  /// 名前の新しい順に maxSessions 件だけ残し、それより古い世代を削除する。
  /// 現在のセッションのログは順位にかかわらず消さない。
  private func pruneOldSessions() {
    let fm = FileManager.default
    guard let urls = try? fm.contentsOfDirectory(at: directory, includingPropertiesForKeys: nil)
    else { return }
    let logs = urls.filter {
      $0.lastPathComponent.hasPrefix("server-") && $0.pathExtension == "log"
    }
    let keep = Set(logs.map(\.lastPathComponent).sorted(by: >).prefix(maxSessions))
    for url in logs where !keep.contains(url.lastPathComponent) && url != currentLogURL {
      try? fm.removeItem(at: url)
    }
  }
}
