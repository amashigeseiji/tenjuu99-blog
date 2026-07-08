import Foundation
import NativeShellCore

// サーバーライフサイクル連動は サーバープロセスの起動・終了をアプリのライフサイクルに合わせることができる
func testServerLifecycleBinding(_ t: TestCase) {
  let binding = ServerLifecycleBinding(
    executableURL: URL(fileURLWithPath: "/bin/sleep"),
    arguments: ["5"]
  )

  t.expect(binding.isRunning == false, "start() 前は isRunning が false")

  do {
    try binding.start()
  } catch {
    t.expect(false, "start() が失敗した: \(error)")
    return
  }
  t.expect(binding.isRunning == true, "start() 後は isRunning が true")

  binding.stop()
  t.expect(binding.isRunning == false, "stop() 後は isRunning が false")
}

// サーバーライフサイクル連動は サーバープロセスの出力と予期しない終了を観測できる
func testServerLifecycleObservation(_ t: TestCase) {
  let binding = ServerLifecycleBinding(
    executableURL: URL(fileURLWithPath: "/bin/sh"),
    arguments: ["-c", "echo out1; echo err1 >&2; exit 3"]
  )
  var output = ""
  var exitCode: Int32 = -1
  let exited = DispatchSemaphore(value: 0)
  binding.onOutput = { output += $0 }
  binding.onUnexpectedExit = { code in
    exitCode = code
    exited.signal()
  }
  do {
    try binding.start()
  } catch {
    t.expect(false, "start() が失敗した: \(error)")
    return
  }
  t.expect(exited.wait(timeout: .now() + 5) == .success, "予期しない終了が観測される")
  t.expect(exitCode == 3, "終了コードを受け取る")
  t.expect(output.contains("out1"), "stdout を観測できる")
  t.expect(output.contains("err1"), "stderr を観測できる")

  // stop() による終了は「予期しない終了」として観測されない
  let binding2 = ServerLifecycleBinding(
    executableURL: URL(fileURLWithPath: "/bin/sleep"),
    arguments: ["5"]
  )
  var unexpectedlyExited = false
  binding2.onUnexpectedExit = { _ in unexpectedlyExited = true }
  do {
    try binding2.start()
  } catch {
    t.expect(false, "start() が失敗した: \(error)")
    return
  }
  binding2.stop()
  Thread.sleep(forTimeInterval: 0.3)
  t.expect(unexpectedlyExited == false, "stop() による終了は予期しない終了として観測されない")
}
