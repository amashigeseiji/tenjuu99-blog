import Foundation
import NativeShellCore

// ファイル選択応答器は 編集画面からのファイル選択要求に応じて作成者にファイルを選ばせ、
// 選択結果（選んだファイル群または取りやめ）を要求の条件に整合させて要求元へ返すことができる
func testFileSelectionResponder(_ t: TestCase) {
  let imageA = URL(fileURLWithPath: "/Users/someone/Pictures/a.jpeg")
  let imageB = URL(fileURLWithPath: "/Users/someone/Pictures/b.jpeg")

  // 選んだファイルが要求元へ返る
  do {
    let result = FileSelectionResponder.respond(
      request: FileSelectionRequest(allowsMultipleSelection: false),
      pickFiles: { _ in [imageA] }
    )
    t.expect(result == [imageA], "選んだファイルが要求元へ返る")
  }

  // 取りやめが取りやめとして要求元に伝わる
  do {
    let result = FileSelectionResponder.respond(
      request: FileSelectionRequest(allowsMultipleSelection: false),
      pickFiles: { _ in nil }
    )
    t.expect(result == nil, "取りやめが取りやめ（nil）として伝わる")
  }

  // 要求の条件（複数選択の可否）が選択の場にそのまま渡る
  do {
    var receivedRequest: FileSelectionRequest?
    let request = FileSelectionRequest(allowsMultipleSelection: true)
    _ = FileSelectionResponder.respond(
      request: request,
      pickFiles: { r in
        receivedRequest = r
        return [imageA, imageB]
      }
    )
    t.expect(receivedRequest == request, "要求の条件が選択の場にそのまま渡る")
  }

  // 複数選択が許されない要求では、返る結果が1件を超えない
  do {
    let result = FileSelectionResponder.respond(
      request: FileSelectionRequest(allowsMultipleSelection: false),
      pickFiles: { _ in [imageA, imageB] }
    )
    t.expect(result == [imageA], "複数不可の要求では先頭の1件に整合される")
  }

  // 複数選択が許される要求では、選んだファイル群がそのまま返る
  do {
    let result = FileSelectionResponder.respond(
      request: FileSelectionRequest(allowsMultipleSelection: true),
      pickFiles: { _ in [imageA, imageB] }
    )
    t.expect(result == [imageA, imageB], "複数可の要求では選んだ全件が返る")
  }

  // 空の選択は取りやめとして扱う
  do {
    let result = FileSelectionResponder.respond(
      request: FileSelectionRequest(allowsMultipleSelection: true),
      pickFiles: { _ in [] }
    )
    t.expect(result == nil, "空の選択は取りやめとして扱われる")
  }
}
