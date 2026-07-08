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
    setUpMainMenu()
    setUpWindow()
    // フォルダ選択ダイアログ（モーダル）を表示する前にアプリを前面化する。
    // `swift run`/`open` はターミナルから起動するため、先に活性化しないとダイアログが裏に隠れる。
    NSApp.activate(ignoringOtherApps: true)

    guard let contentRootURL = resolveContentRootOrTerminate() else { return }

    // scripts/app-bundle/manifest.json の dest と対応する配置契約（BundleLayoutResolver参照）
    let layout = BundleLayoutResolver.resolve(bundleURL: Bundle.main.bundleURL)
    serverLifecycle = ServerLifecycleBinding(
      executableURL: layout.nodeExecutableURL,
      arguments: serverArguments(layout: layout),
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

  /// @vocab 同梱モジュール解決器 (plans/node-modules-destruction/dictionary.json)
  /// コンテンツルートのコードからの `@tenjuu99/blog` への参照は、`--import` で差し込む
  /// 同梱モジュール解決器が同梱コードへ解決する。コンテンツルートには一切書き込まない
  /// （既存物保護）。実体の node_modules を持つ開発中プロジェクトを選んでも既存物は壊れない。
  private func serverArguments(layout: BundleLayout) -> [String] {
    [
      "--import", layout.moduleResolverRegistrationURL.path,
      layout.serverEntryURL.path,
    ]
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

  /// @vocab コンテンツルート切り替えメニュー (plans/content-root-switching/dictionary.json)
  /// コンテンツルート切り替えの入口をアプリの通常操作（メニューバー）として提示する（手動検証のみ）
  private func setUpMainMenu() {
    let mainMenu = NSMenu()

    let appMenuItem = NSMenuItem()
    mainMenu.addItem(appMenuItem)
    let appMenu = NSMenu()
    appMenu.addItem(
      withTitle: "tenjuu99-blog を終了",
      action: #selector(NSApplication.terminate(_:)),
      keyEquivalent: "q"
    )
    appMenuItem.submenu = appMenu

    let fileMenuItem = NSMenuItem()
    mainMenu.addItem(fileMenuItem)
    let fileMenu = NSMenu(title: "ファイル")
    let switchItem = NSMenuItem(
      title: "コンテンツフォルダを変更…",
      action: #selector(changeContentRoot(_:)),
      keyEquivalent: "O"
    )
    switchItem.target = self
    fileMenu.addItem(switchItem)
    fileMenuItem.submenu = fileMenu

    NSApp.mainMenu = mainMenu
  }

  /// コンテンツルート切り替え: 選びなおしの切り替え結果に応じて、コンテンツルート記憶を書き換え
  /// サーバーと表示を新しいプロジェクトで入れ替える配線（手動検証のみ）。
  /// 初回解決と異なり、取りやめ・拒否はアプリ終了ではなく現在のプロジェクトの継続になる。
  @objc private func changeContentRoot(_ sender: Any?) {
    let outcome = ContentRootResolver.reselect(
      blogJsonExists: { url in
        FileManager.default.fileExists(atPath: url.appendingPathComponent("blog.json").path)
      },
      pickFolder: Self.presentContentRootPicker
    )

    switch outcome {
    case .cancelled:
      return
    case .rejected(let url):
      let alert = NSAlert()
      alert.messageText = "blog.json が見つかりません"
      alert.informativeText =
        "選択されたフォルダ（\(url.path)）に blog.json がありません。現在のプロジェクトを使い続けます。"
      alert.runModal()
    case .switched(let url):
      UserDefaults.standard.set(url.path, forKey: Self.contentRootDefaultsKey)
      switchProject(to: url)
    }
  }

  /// 確定した新しいコンテンツルートでサーバーと表示を入れ替える。
  /// 旧サーバーの停止（stop は終了を同期的に待つ）→ 新しい作業場所でのサーバー起動 →
  /// 起動待ち表示から編集画面へ、の順で initial 起動と同じ流れを辿る。
  private func switchProject(to contentRootURL: URL) {
    readinessTimer?.invalidate()
    serverLifecycle?.stop()

    let layout = BundleLayoutResolver.resolve(bundleURL: Bundle.main.bundleURL)
    serverLifecycle = ServerLifecycleBinding(
      executableURL: layout.nodeExecutableURL,
      arguments: serverArguments(layout: layout),
      currentDirectoryURL: contentRootURL
    )

    startupLabel.stringValue = "サーバーを起動しています…"
    window.contentView = startupLabel
    startServerAndWait()
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
