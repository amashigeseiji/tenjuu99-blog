/**
 * @vocab 同梱モジュール解決器
 * @test tests/app-bundle/bundledModuleResolver.test.js
 *
 * アプリ自身のパッケージ名（@tenjuu99/blog、サブパス含む）への参照を、
 * コンテンツルートの中身に関わらず同梱コードへ解決する。
 * コンテンツルートには一切書き込まないため、実体の node_modules を持つ
 * 開発中プロジェクトをコンテンツルートに選んでも既存物が壊れない。
 * サーバー本体と同じ実体パスへ解決するので、allData 等のモジュールレベル状態の
 * 共有（同一インスタンス性）が保たれる。
 */

const PACKAGE_NAME = '@tenjuu99/blog'

// このファイルは同梱バンドル内では Contents/Resources/app/scripts/app-bundle/ に、
// リポジトリ内では scripts/app-bundle/ に置かれる。どちらでも ../../ がアプリコードのルート。
const appRootURL = new URL('../../', import.meta.url)

/**
 * アプリ自身のパッケージ名への参照なら同梱コード内の URL を返し、対象外なら null を返す。
 * @param {string} specifier - import 指定子
 * @param {URL} [rootURL] - 同梱コードのルート（テスト用に注入可能）
 * @returns {string|null}
 */
export function redirect(specifier, rootURL = appRootURL) {
  if (specifier === PACKAGE_NAME) {
    return new URL('index.js', rootURL).href
  }
  if (specifier.startsWith(`${PACKAGE_NAME}/`)) {
    const resolved = new URL(specifier.slice(PACKAGE_NAME.length + 1), rootURL)
    // 空サブパス（同梱ルート自身を指す）や、".."・絶対パス風の指定子で同梱ルートの
    // 外へ出るものは対象外。通常の Node 解決に委ね、不正なサブパスとしてエラーにさせる
    if (resolved.href === rootURL.href || !resolved.href.startsWith(rootURL.href)) {
      return null
    }
    return resolved.href
  }
  return null
}

/**
 * Node の module customization hooks が要求する resolve フック。
 * registerBundledModuleResolver.js 経由で登録される。
 * @param {string} specifier
 * @param {object} context
 * @param {Function} nextResolve
 */
export function resolve(specifier, context, nextResolve) {
  const redirected = redirect(specifier)
  if (redirected) {
    return { url: redirected, shortCircuit: true }
  }
  return nextResolve(specifier, context)
}
