import Foundation
import NativeShellCore

// コンテンツルート解決器は blog.jsonを含むフォルダの場所を、記憶済みでなければユーザーに選択させて確定できる
func testContentRootResolver(_ t: TestCase) {
  let rememberedURL = URL(fileURLWithPath: "/Users/someone/tenjuu99-blog-content")
  let pickedURL = URL(fileURLWithPath: "/Users/someone/picked-folder")

  // 記憶済みパスにblog.jsonが存在する場合、そのまま確定しユーザーに選択させない
  do {
    var pickFolderCalled = false
    let result = ContentRootResolver.resolve(
      rememberedURL: rememberedURL,
      blogJsonExists: { $0 == rememberedURL },
      pickFolder: {
        pickFolderCalled = true
        return pickedURL
      }
    )
    t.expect(result == .success(rememberedURL), "記憶済みパスがそのまま確定される")
    t.expect(!pickFolderCalled, "記憶済みパスが有効ならフォルダ選択は呼ばれない")
  }

  // 記憶済みパスが無い場合、選択されたフォルダにblog.jsonがあれば確定する
  do {
    let result = ContentRootResolver.resolve(
      rememberedURL: nil,
      blogJsonExists: { $0 == pickedURL },
      pickFolder: { pickedURL }
    )
    t.expect(result == .success(pickedURL), "記憶済みが無ければ選択結果が確定される")
  }

  // 記憶済みパスにblog.jsonが無い場合、選択ダイアログにフォールバックする
  do {
    let result = ContentRootResolver.resolve(
      rememberedURL: rememberedURL,
      blogJsonExists: { $0 == pickedURL },
      pickFolder: { pickedURL }
    )
    t.expect(result == .success(pickedURL), "記憶済みパスが無効なら選択ダイアログにフォールバックする")
  }

  // 選択されたフォルダにblog.jsonが無い場合、エラーになる
  do {
    let result = ContentRootResolver.resolve(
      rememberedURL: nil,
      blogJsonExists: { _ in false },
      pickFolder: { pickedURL }
    )
    t.expect(
      result == .failure(.blogJsonNotFound(pickedURL)),
      "blog.jsonが無いフォルダを選ぶとエラーになる"
    )
  }

  // ユーザーが選択をキャンセルした場合、エラーになる
  do {
    let result = ContentRootResolver.resolve(
      rememberedURL: nil,
      blogJsonExists: { _ in true },
      pickFolder: { nil }
    )
    t.expect(result == .failure(.userCancelled), "選択をキャンセルするとエラーになる")
  }
}

// コンテンツルート解決器は 記憶済みのコンテンツルートがあっても、利用者の選びなおしに応じて切り替え結果を確定できる
func testContentRootReselect(_ t: TestCase) {
  let pickedURL = URL(fileURLWithPath: "/Users/someone/another-project")

  // blog.json を持つフォルダが選ばれたら新しいコンテンツルートへの切り替えを確定する
  do {
    let outcome = ContentRootResolver.reselect(
      blogJsonExists: { $0 == pickedURL },
      pickFolder: { pickedURL }
    )
    t.expect(outcome == .switched(pickedURL), "選ばれたフォルダへの切り替えが確定される")
  }

  // 選択が取りやめられたら現在のコンテンツルートの継続を確定する
  do {
    let outcome = ContentRootResolver.reselect(
      blogJsonExists: { _ in true },
      pickFolder: { nil }
    )
    t.expect(outcome == .cancelled, "取りやめは現状維持（エラーではない）として確定される")
  }

  // blog.json の無いフォルダが選ばれたら切り替えを退けて現在のコンテンツルートの継続を確定する
  do {
    let outcome = ContentRootResolver.reselect(
      blogJsonExists: { _ in false },
      pickFolder: { pickedURL }
    )
    t.expect(outcome == .rejected(pickedURL), "blog.json の無いフォルダは退けられ現状維持となる")
  }
}
