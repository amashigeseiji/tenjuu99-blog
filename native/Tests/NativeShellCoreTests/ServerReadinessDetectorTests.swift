import NativeShellCore

// サーバー起動完了検知は サーバーが接続受付可能になったことを検知できる
func testServerReadinessDetector(_ t: TestCase) {
  let unusedPort: UInt16 = 39812
  t.expect(
    ServerReadinessDetector.isReady(port: Int(unusedPort)) == false,
    "誰も listen していないポートには false を返す"
  )

  let listeningPort: UInt16 = 39813
  let listener = TestTCPListener(port: listeningPort)
  defer { listener.close() }
  t.expect(
    ServerReadinessDetector.isReady(port: Int(listeningPort)) == true,
    "listen 中のポートには true を返す"
  )

  t.expect(
    ServerReadinessDetector.isReady(port: -1) == false,
    "負のポート番号にはクラッシュせず false を返す"
  )
  t.expect(
    ServerReadinessDetector.isReady(port: 65536) == false,
    "65535 を超えるポート番号にはクラッシュせず false を返す"
  )
}
