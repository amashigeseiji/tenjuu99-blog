import Foundation
import NativeShellCore

// ネイティブアプリシェルは 正常に使えない状態になったとき何が起きたかを利用者に知らせることができる
// （ルートノード。葉の合成で green になる）
func testErrorVisibilityRoot(_ t: TestCase) {
  let tempDir = FileManager.default.temporaryDirectory
    .appendingPathComponent("error-visibility-root-\(UUID().uuidString)")
  defer { try? FileManager.default.removeItem(at: tempDir) }

  let logWriter = DiagnosticLogWriter(directory: tempDir, maxSessions: 3)
  do {
    try logWriter.startSession()
  } catch {
    t.expect(false, "startSession() が失敗した: \(error)")
    return
  }

  // 起動直後に stderr へ出力して異常終了するサーバープロセス
  let binding = ServerLifecycleBinding(
    executableURL: URL(fileURLWithPath: "/bin/sh"),
    arguments: ["-c", "echo 'boom: port already in use' >&2; exit 1"]
  )

  var collectedOutput = ""
  binding.onOutput = { output in
    collectedOutput += output
    logWriter.append(output)
  }

  let exited = DispatchSemaphore(value: 0)
  var displayState: DisplayState = .startupWaiting
  binding.onUnexpectedExit = { _ in
    displayState = DisplayStateResolver.resolve(
      current: displayState, serverReady: false, serverAlive: false)
    exited.signal()
  }

  do {
    try binding.start()
  } catch {
    t.expect(false, "start() が失敗した: \(error)")
    return
  }

  t.expect(
    exited.wait(timeout: .now() + 5) == .success,
    "予期しない終了が観測される"
  )
  t.expect(
    displayState == .failed(.beforeStartup),
    "起動前の失敗は起動失敗と判定される（真っ白のまま残らない）"
  )

  let content = ErrorDisplay.compose(
    stage: .beforeStartup,
    errorOutput: collectedOutput,
    logURL: logWriter.currentLogURL
  )
  t.expect(content.title.contains("起動"), "見出しから起動失敗であることが分かる")
  t.expect(content.detail.contains("boom"), "エラー内容が表示内容に含まれる")
  t.expect(!content.logLocation.isEmpty, "診断ログの場所が案内される")

  let logText = logWriter.currentLogURL.flatMap { try? String(contentsOf: $0, encoding: .utf8) } ?? ""
  t.expect(logText.contains("boom"), "サーバー出力が診断ログに残る")
}
