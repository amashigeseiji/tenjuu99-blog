import AppKit
import Dispatch

let app = NSApplication.shared
app.setActivationPolicy(.regular)
let delegate = AppDelegate()
app.delegate = delegate

// SIGTERM/SIGINT（kill コマンドや強制終了）でも `node bin/server` を残さないためのハンドラ。
// デフォルトの signal ハンドリングを無効化してから DispatchSource で受け取る（GCDの定番パターン）。
signal(SIGTERM, SIG_IGN)
signal(SIGINT, SIG_IGN)
let signalSources = [SIGTERM, SIGINT].map { sig -> DispatchSourceSignal in
  let source = DispatchSource.makeSignalSource(signal: sig, queue: .main)
  source.setEventHandler {
    delegate.stopServer()
    exit(0)
  }
  source.resume()
  return source
}

app.run()
