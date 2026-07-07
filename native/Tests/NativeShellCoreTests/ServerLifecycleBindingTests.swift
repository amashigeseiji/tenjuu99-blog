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
