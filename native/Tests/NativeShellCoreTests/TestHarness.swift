import Foundation

/// XCTest/Swift Testing の代わりに使う自作の検証ハーネス。
/// `swift run CoreTests` で実行する。1テスト内の失敗はクラッシュさせず記録し、他のテストを続行する。
final class TestCase {
  let name: String
  private(set) var failures: [String] = []

  init(_ name: String) {
    self.name = name
  }

  func expect(_ condition: @autoclosure () -> Bool, _ message: String, file: String = #file, line: Int = #line) {
    if !condition() {
      failures.append("\(message) (\(URL(fileURLWithPath: file).lastPathComponent):\(line))")
    }
  }
}

func runTests(_ tests: [(String, (TestCase) -> Void)]) -> Never {
  setvbuf(stdout, nil, _IONBF, 0)
  var totalFailures = 0
  for (name, body) in tests {
    let testCase = TestCase(name)
    body(testCase)
    if testCase.failures.isEmpty {
      print("PASS: \(name)")
    } else {
      print("FAIL: \(name)")
      for failure in testCase.failures {
        print("  - \(failure)")
      }
      totalFailures += testCase.failures.count
    }
  }
  if totalFailures == 0 {
    print("\nAll \(tests.count) test(s) passed")
    exit(0)
  } else {
    print("\n\(totalFailures) failure(s) across \(tests.count) test(s)")
    exit(1)
  }
}
