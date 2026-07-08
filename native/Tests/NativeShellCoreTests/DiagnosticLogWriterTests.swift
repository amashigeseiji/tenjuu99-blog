import Foundation
import NativeShellCore

// 診断ログ書き出しは サーバー出力を直近数回の起動分だけ残せる
func testDiagnosticLogWriter(_ t: TestCase) {
  let dir = FileManager.default.temporaryDirectory
    .appendingPathComponent("diagnostic-log-\(UUID().uuidString)")
  defer { try? FileManager.default.removeItem(at: dir) }

  // セッションを開始すると新しいログファイルに書ける
  let writer = DiagnosticLogWriter(directory: dir, maxSessions: 3)
  do {
    try writer.startSession()
  } catch {
    t.expect(false, "startSession() が失敗した: \(error)")
    return
  }
  t.expect(writer.currentLogURL != nil, "セッション開始でログファイルが決まる")

  writer.append("hello ")
  writer.append("world\n")
  let text = writer.currentLogURL.flatMap { try? String(contentsOf: $0, encoding: .utf8) } ?? ""
  t.expect(text == "hello world\n", "追記した出力がログに残る（実際: \(text)）")

  // 起動を繰り返しても直近 maxSessions 回分だけ残る
  for i in 0..<5 {
    let w = DiagnosticLogWriter(directory: dir, maxSessions: 3)
    do {
      try w.startSession(now: Date(timeIntervalSince1970: TimeInterval(1_700_000_000 + i * 60)))
    } catch {
      t.expect(false, "\(i)回目の startSession() が失敗した: \(error)")
      return
    }
    w.append("session \(i)\n")
  }
  let files = (try? FileManager.default.contentsOfDirectory(atPath: dir.path)) ?? []
  t.expect(files.count == 3, "直近3回分だけ残る（実際: \(files.count)件 \(files)）")

  // maxSessions に負の値を渡してもクラッシュせず 0 に丸められる
  let negative = DiagnosticLogWriter(directory: dir, maxSessions: -1)
  t.expect(negative.maxSessions == 0, "負の maxSessions は 0 に丸められる（実際: \(negative.maxSessions)）")
  do {
    try negative.startSession(now: Date(timeIntervalSince1970: 1_700_001_000))
  } catch {
    t.expect(false, "負の maxSessions でも startSession() が失敗しない: \(error)")
    return
  }
}
