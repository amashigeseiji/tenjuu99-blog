import Darwin
import Foundation

/// @vocab サーバー起動完了検知 (plans/native-mac-shell/dictionary.json)
/// @test native/Tests/NativeShellCoreTests/ServerReadinessDetectorTests.swift
public enum ServerReadinessDetector {
  /// - Returns: `127.0.0.1:port` へ接続できれば true
  public static func isReady(port: Int, timeout: TimeInterval = 0.2) -> Bool {
    let fd = socket(AF_INET, SOCK_STREAM, 0)
    guard fd >= 0 else { return false }
    defer { Darwin.close(fd) }

    let flags = fcntl(fd, F_GETFL, 0)
    _ = fcntl(fd, F_SETFL, flags | O_NONBLOCK)

    var addr = sockaddr_in()
    addr.sin_family = sa_family_t(AF_INET)
    addr.sin_port = UInt16(port).bigEndian
    addr.sin_addr.s_addr = inet_addr("127.0.0.1")

    let connectResult = withUnsafePointer(to: &addr) { pointer -> Int32 in
      pointer.withMemoryRebound(to: sockaddr.self, capacity: 1) { sockaddrPointer in
        connect(fd, sockaddrPointer, socklen_t(MemoryLayout<sockaddr_in>.size))
      }
    }

    if connectResult == 0 {
      return true
    }
    guard errno == EINPROGRESS else {
      return false
    }

    var pfd = pollfd(fd: fd, events: Int16(POLLOUT), revents: 0)
    let pollResult = poll(&pfd, 1, Int32(timeout * 1000))
    guard pollResult > 0, pfd.revents & Int16(POLLOUT) != 0 else { return false }

    var socketError: Int32 = 0
    var length = socklen_t(MemoryLayout<Int32>.size)
    getsockopt(fd, SOL_SOCKET, SO_ERROR, &socketError, &length)
    return socketError == 0
  }
}
