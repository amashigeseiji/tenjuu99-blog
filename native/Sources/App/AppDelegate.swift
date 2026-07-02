import AppKit
import NativeShellCore
import WebKit

/// @vocab アプリウィンドウ (plans/native-mac-shell/dictionary.json)
/// AppKit/WKWebView に直結するため単体テストは行わず、実アプリの起動で手動検証する（test-tree.md 参照）
final class AppDelegate: NSObject, NSApplicationDelegate {
  private static let serverPort = 8000
  private static let contentRootDefaultsKey = "ContentRootURL"

  private var window: NSWindow!
  private var webView: WKWebView!
  private var startupLabel: NSTextField!
  private var readinessTimer: Timer?
  private var serverLifecycle: ServerLifecycleBinding!

  func applicationDidFinishLaunching(_ notification: Notification) {
    setUpWindow()
    // フォルダ選択ダイアログ（モーダル）を表示する前にアプリを前面化する。
    // `swift run`/`open` はターミナルから起動するため、先に活性化しないとダイアログが裏に隠れる。
    NSApp.activate(ignoringOtherApps: true)

    guard let contentRootURL = resolveContentRootOrTerminate() else { return }

    // scripts/app-bundle/manifest.json の dest と対応する配置契約（BundleLayoutResolver参照）
    let layout = BundleLayoutResolver.resolve(bundleURL: Bundle.main.bundleURL)
    linkAppNodeModulesIntoContentRoot(contentRootURL: contentRootURL, layout: layout)
    serverLifecycle = ServerLifecycleBinding(
      executableURL: layout.nodeExecutableURL,
      arguments: [layout.serverEntryURL.path],
      currentDirectoryURL: contentRootURL
    )

    startServerAndWait()
  }

  func applicationWillTerminate(_ notification: Notification) {
    stopServer()
  }

  /// 通常の終了フロー（ウィンドウを閉じる/Cmd+Q）だけでなく、シグナルによる強制終了時にも
  /// サーバープロセスを残さないよう、main.swift のシグナルハンドラからも呼び出す。
  func stopServer() {
    readinessTimer?.invalidate()
    serverLifecycle?.stop()
  }

  /// コンテンツルート直下に、同梱アプリコードの node_modules へのシンボリックリンクを作る。
  /// Node の ESM 解決はコンテンツルートの祖先を遡っても `.app` 内の node_modules へは
  /// 辿り着けない（別系統のディレクトリツリーのため）ので、`@tenjuu99/blog` 等の
  /// bare specifier import を解決可能にするために必要な配線。
  private func linkAppNodeModulesIntoContentRoot(contentRootURL: URL, layout: BundleLayout) {
    let linkURL = contentRootURL.appendingPathComponent("node_modules")
    let fm = FileManager.default
    if let existingTarget = try? fm.destinationOfSymbolicLink(atPath: linkURL.path),
       existingTarget == layout.nodeModulesURL.path {
      return
    }
    try? fm.removeItem(at: linkURL)
    try? fm.createSymbolicLink(at: linkURL, withDestinationURL: layout.nodeModulesURL)
  }

  /// コンテンツルート解決器のコアロジックに、永続化ストア（UserDefaults）と
  /// フォルダ選択ダイアログ（NSOpenPanel）を関数として注入する配線部分。
  /// 解決に失敗した場合はエラーダイアログを表示してアプリを終了する。
  private func resolveContentRootOrTerminate() -> URL? {
    let defaults = UserDefaults.standard
    let rememberedURL = defaults.string(forKey: Self.contentRootDefaultsKey).map(URL.init(fileURLWithPath:))

    let result = ContentRootResolver.resolve(
      rememberedURL: rememberedURL,
      blogJsonExists: { url in
        FileManager.default.fileExists(atPath: url.appendingPathComponent("blog.json").path)
      },
      pickFolder: Self.presentContentRootPicker
    )

    switch result {
    case .success(let url):
      defaults.set(url.path, forKey: Self.contentRootDefaultsKey)
      return url
    case .failure(let error):
      presentContentRootErrorAndTerminate(error)
      return nil
    }
  }

  /// コンテンツルート選択ダイアログ（手動検証のみ。単体テスト対象外）
  private static func presentContentRootPicker() -> URL? {
    let panel = NSOpenPanel()
    panel.canChooseDirectories = true
    panel.canChooseFiles = false
    panel.allowsMultipleSelection = false
    panel.message = "blog.json を含むフォルダを選択してください"
    return panel.runModal() == .OK ? panel.url : nil
  }

  private func presentContentRootErrorAndTerminate(_ error: ContentRootResolutionError) {
    let alert = NSAlert()
    switch error {
    case .blogJsonNotFound(let url):
      alert.messageText = "blog.json が見つかりません"
      alert.informativeText = "選択されたフォルダ（\(url.path)）に blog.json がありません。"
    case .userCancelled:
      alert.messageText = "コンテンツフォルダが選択されませんでした"
      alert.informativeText = "起動するには blog.json を含むフォルダの選択が必要です。"
    }
    alert.runModal()
    NSApp.terminate(nil)
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
