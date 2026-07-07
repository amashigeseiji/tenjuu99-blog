import Foundation
import NativeShellCore

// バンドルレイアウト解決器は .app内のNode実行ファイルとアプリコードエントリーの場所を導出できる
func testBundleLayoutResolver(_ t: TestCase) {
  let bundleURL = URL(fileURLWithPath: "/Applications/tenjuu99-blog.app")
  let layout = BundleLayoutResolver.resolve(bundleURL: bundleURL)

  t.expect(
    layout.nodeExecutableURL.path == "/Applications/tenjuu99-blog.app/Contents/Resources/node/bin/node",
    "Node実行ファイルパスは Contents/Resources/node/bin/node を指す"
  )
  t.expect(
    layout.serverEntryURL.path == "/Applications/tenjuu99-blog.app/Contents/Resources/app/bin/server",
    "アプリコードエントリーパスは Contents/Resources/app/bin/server を指す"
  )
  t.expect(
    layout.nodeModulesURL.path == "/Applications/tenjuu99-blog.app/Contents/Resources/app/node_modules",
    "node_modulesパスは Contents/Resources/app/node_modules を指す"
  )
}
