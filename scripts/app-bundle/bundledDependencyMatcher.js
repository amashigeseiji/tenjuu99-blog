import { readFileSync } from 'node:fs'

/**
 * @vocab 依存パッケージ名判定器
 * @test tests/app-bundle/bundledDependencyMatcher.test.js
 *
 * 参照（import 指定子）が、同梱コード自身が持つ依存パッケージ名（またはそのサブパス）
 * への参照かどうかを判定する。対象パッケージは個別列挙せず、依存パッケージ名の一覧を
 * 引数として受け取る（一覧の取得自体は dependencyNames() の責務）。
 */

// このファイルは同梱バンドル内では Contents/Resources/app/scripts/app-bundle/ に、
// リポジトリ内では scripts/app-bundle/ に置かれる。どちらでも ../../ がアプリコードのルート。
const appRootURL = new URL('../../', import.meta.url)

/**
 * @param {string} specifier - import 指定子
 * @param {string[]} dependencyNames - 同梱コード自身の依存パッケージ名一覧
 * @returns {boolean}
 */
export function matches(specifier, dependencyNames) {
  return dependencyNames.some(
    (name) => specifier === name || specifier.startsWith(`${name}/`)
  )
}

/**
 * @param {URL} [rootURL] - 同梱コードのルート（テスト用に注入可能）
 * @returns {string[]}
 */
export function dependencyNames(rootURL = appRootURL) {
  const packageJson = JSON.parse(readFileSync(new URL('package.json', rootURL), 'utf8'))
  return Object.keys(packageJson.dependencies ?? {})
}
