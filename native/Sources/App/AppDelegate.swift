import AppKit
import NativeShellCore
import WebKit

/// @vocab アプリウィンドウ (plans/native-mac-shell/dictionary.json)
/// AppKit/WKWebView に直結するため単体テストは行わず、実アプリの起動で手動検証する（test-tree.md 参照）
final class AppDelegate: NSObject, NSApplicationDelegate {
  private static let serverPort = 8000

  /// native/Sources/App/AppDelegate.swift からリポジトリルートへ遡る（このリポジトリ自体をコンテンツディレクトリとして使う）
  private static let repoRootURL = URL(fileURLWithPath: #filePath)
    .deletingLastPathComponent() // App/
    .deletingLastPathComponent() // Sources/
    .deletingLastPathComponent() // native/
    .deletingLastPathComponent() // repo root

  private var window: NSWindow!
  private var webView: WKWebView!
  private var startupLabel: NSTextField!
  private var readinessTimer: Timer?
  private let serverLifecycle = ServerLifecycleBinding(
    executableURL: URL(fileURLWithPath: "/usr/bin/env"),
    arguments: ["node", "bin/server"],
    currentDirectoryURL: repoRootURL
  )

  func applicationDidFinishLaunching(_ notification: Notification) {
    setUpWindow()
    startServerAndWait()
    // `swift run` はターミナルから起動するため、明示的に前面へ出さないとTerminalの裏に隠れる
    NSApp.activate(ignoringOtherApps: true)
  }

  func applicationWillTerminate(_ notification: Notification) {
    stopServer()
  }

  /// 通常の終了フロー（ウィンドウを閉じる/Cmd+Q）だけでなく、シグナルによる強制終了時にも
  /// サーバープロセスを残さないよう、main.swift のシグナルハンドラからも呼び出す。
  func stopServer() {
    readinessTimer?.invalidate()
    serverLifecycle.stop()
  }

  func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
    true
  }

  private func setUpWindow() {
    let contentRect = NSRect(x: 0, y: 0, width: 1200, height: 800)
    window = NSWindow(
      contentRect: contentRect,
      styleMask: [.titled, .closable, .miniaturizable, .resizable],
      backing: .buffered,
      defer: false
    )
    window.title = "tenjuu99-blog"
    window.center()

    startupLabel = NSTextField(labelWithString: "サーバーを起動しています…")
    startupLabel.alignment = .center
    startupLabel.frame = contentRect
    startupLabel.autoresizingMask = [.width, .height]

    let configuration = WKWebViewConfiguration()
    webView = WKWebView(frame: contentRect, configuration: configuration)
    webView.autoresizingMask = [.width, .height]

    window.contentView = startupLabel
    window.makeKeyAndOrderFront(nil)
  }

  private func startServerAndWait() {
    do {
      try serverLifecycle.start()
    } catch {
      startupLabel.stringValue = "サーバーの起動に失敗しました: \(error)"
      return
    }

    readinessTimer = Timer.scheduledTimer(withTimeInterval: 0.2, repeats: true) { [weak self] timer in
      guard let self else { return }
      let ready = ServerReadinessDetector.isReady(port: Self.serverPort)
      if DisplayStateResolver.resolve(serverReady: ready) == .editor {
        timer.invalidate()
        self.showEditor()
      }
    }
  }

  private func showEditor() {
    window.contentView = webView
    webView.load(URLRequest(url: URL(string: "http://127.0.0.1:\(Self.serverPort)/editor.html")!))
  }
}
