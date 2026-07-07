import Darwin
import Foundation

/// テスト用に指定ポートで listen だけする軽量ダブル。ServerReadinessDetector の
/// 「listen 中のポートを検知できる」ケースを、実サーバーを起動せずに検証するために使う。
final class TestTCPListener {
  private let fd: Int32

  init(port: UInt16) {
    fd = socket(AF_INET, SOCK_STREAM, 0)
    precondition(fd >= 0, "socket() failed")

    var reuse: Int32 = 1
    setsockopt(fd, SOL_SOCKET, SO_REUSEADDR, &reuse, socklen_t(MemoryLayout<Int32>.size))

    var addr = sockaddr_in()
    addr.sin_family = sa_family_t(AF_INET)
    addr.sin_port = port.bigEndian
    addr.sin_addr.s_addr = INADDR_ANY

    let bindResult = withUnsafePointer(to: &addr) { pointer -> Int32 in
      pointer.withMemoryRebound(to: sockaddr.self, capacity: 1) { sockaddrPointer in
        bind(fd, sockaddrPointer, socklen_t(MemoryLayout<sockaddr_in>.size))
      }
    }
    precondition(bindResult == 0, "bind() failed on port \(port)")
    precondition(listen(fd, 1) == 0, "listen() failed on port \(port)")
  }

  func close() {
    Darwin.close(fd)
  }
}
