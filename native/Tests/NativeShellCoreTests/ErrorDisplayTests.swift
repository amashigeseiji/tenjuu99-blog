import Foundation
import NativeShellCore

// エラー表示は 失敗段階とエラー内容と診断ログの場所から表示内容を組み立てられる
func testErrorDisplay(_ t: TestCase) {
  let logURL = URL(fileURLWithPath: "/tmp/logs/server-20260708.log")

  let before = ErrorDisplay.compose(
    stage: .beforeStartup, errorOutput: "Error: port in use\n", logURL: logURL)
  t.expect(before.title.contains("起動"), "起動失敗であることが見出しから分かる")
  t.expect(before.detail.contains("port in use"), "エラー内容を含む")
  t.expect(before.logLocation.contains(logURL.path), "診断ログの場所を含む")

  let after = ErrorDisplay.compose(
    stage: .afterStartup, errorOutput: "crash\n", logURL: logURL)
  t.expect(after.title != before.title, "起動失敗と起動後障害は見出しで区別できる")

  // 長い出力は末尾（直近のエラー）が優先して見える
  let longOutput = (1...100).map { "line \($0)" }.joined(separator: "\n")
  let truncated = ErrorDisplay.compose(
    stage: .beforeStartup, errorOutput: longOutput, logURL: logURL)
  t.expect(truncated.detail.contains("line 100"), "末尾（直近の出力）が表示される")
  t.expect(!truncated.detail.contains("line 1\n"), "先頭からではなく末尾から表示される")

  // ログがまだない場合でも組み立てられる
  let noLog = ErrorDisplay.compose(stage: .beforeStartup, errorOutput: "", logURL: nil)
  t.expect(!noLog.title.isEmpty, "ログがなくても見出しは組み立てられる")
}
