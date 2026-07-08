import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, mkdir, writeFile, readdir, realpath } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { pathToFileURL } from 'node:url'

import { redirect, resolve } from '../../scripts/app-bundle/bundledModuleResolver.js'

const execFileAsync = promisify(execFile)
const repoRoot = path.resolve(import.meta.dirname, '../..')
const registerScript = path.join(repoRoot, 'scripts/app-bundle/registerBundledModuleResolver.js')

// 実体の node_modules（囮の @tenjuu99/blog 入り）を持つ開発中プロジェクトのフィクスチャを作る
const createProjectFixture = async () => {
  // macOS の tmpdir は /var → /private/var の symlink。モジュール URL は realpath になるため揃えておく
  const contentRoot = await realpath(await mkdtemp(path.join(tmpdir(), 'project-under-development-')))
  const decoyDir = path.join(contentRoot, 'node_modules/@tenjuu99/blog')
  await mkdir(decoyDir, { recursive: true })
  await writeFile(path.join(decoyDir, 'package.json'), JSON.stringify({
    name: '@tenjuu99/blog', version: '0.0.1', main: 'index.js',
  }))
  await writeFile(path.join(decoyDir, 'index.js'), 'export const marker = "decoy"\n')
  // ヘルパーと同じく bare specifier でアプリ自身のパッケージ名を参照するスクリプト
  await writeFile(path.join(contentRoot, 'check.js'),
    'console.log(import.meta.resolve("@tenjuu99/blog"))\n')
  return contentRoot
}

// フォルダの中身のスナップショット（既存物が変更されていないことの確認用）
const snapshot = async (dir) => {
  const entries = await readdir(dir, { recursive: true })
  return entries.sort()
}

describe('ネイティブアプリシェルは 実体の node_modules を持つ開発中プロジェクトを、既存物に書き込まずにコンテンツルートとして使える（同居できる）', () => {
  test('解決フックを差し込んで起動すると、囮の実体 node_modules があっても参照は同梱コードへ解決され、フォルダの中身は一切変更されない', async () => {
    const contentRoot = await createProjectFixture()
    try {
      const before = await snapshot(contentRoot)

      const { stdout } = await execFileAsync(
        process.execPath,
        ['--import', registerScript, path.join(contentRoot, 'check.js')],
        { cwd: contentRoot }
      )

      const bundledIndexURL = pathToFileURL(path.join(repoRoot, 'index.js')).href
      assert.equal(stdout.trim(), bundledIndexURL, '参照は同梱コード（アプリ自身）へ解決される')

      const after = await snapshot(contentRoot)
      assert.deepEqual(after, before, 'コンテンツルートの中身は一切変更されない')
    } finally {
      await rm(contentRoot, { recursive: true, force: true })
    }
  })

  test('（対照）フックなしでは参照は実体 node_modules の囮に解決される（フィクスチャが競合実体として有効である証明）', async () => {
    const contentRoot = await createProjectFixture()
    try {
      const { stdout } = await execFileAsync(
        process.execPath,
        [path.join(contentRoot, 'check.js')],
        { cwd: contentRoot }
      )
      const decoyIndexURL = pathToFileURL(
        path.join(contentRoot, 'node_modules/@tenjuu99/blog/index.js')
      ).href
      assert.equal(stdout.trim(), decoyIndexURL)
    } finally {
      await rm(contentRoot, { recursive: true, force: true })
    }
  })

  describe('同梱モジュール解決器は アプリ自身のパッケージ名への参照を、コンテンツルートの中身に関わらず同梱コードへ解決できる', () => {
    const bundledAppRoot = new URL('file:///bundle/Contents/Resources/app/')

    test('@tenjuu99/blog への参照を同梱コードの実体へ向けられる', () => {
      assert.equal(
        redirect('@tenjuu99/blog', bundledAppRoot),
        'file:///bundle/Contents/Resources/app/index.js'
      )
    })

    test('@tenjuu99/blog のサブパスへの参照も同梱コードの対応する場所へ向けられる', () => {
      assert.equal(
        redirect('@tenjuu99/blog/lib/dir.js', bundledAppRoot),
        'file:///bundle/Contents/Resources/app/lib/dir.js'
      )
    })

    test('それ以外の参照は通常の解決に委ねられる', () => {
      assert.equal(redirect('marked', bundledAppRoot), null, '他パッケージは委ねる')
      assert.equal(redirect('./local.js', bundledAppRoot), null, '相対パスは委ねる')
      assert.equal(redirect('node:fs', bundledAppRoot), null, 'ビルトインは委ねる')
      assert.equal(redirect('@tenjuu99/other', bundledAppRoot), null, '同スコープ他パッケージは委ねる')

      let delegated = null
      const outcome = resolve('marked', { parentURL: 'file:///x.js' }, (specifier) => {
        delegated = specifier
        return { url: 'file:///resolved-by-default.js' }
      })
      assert.equal(delegated, 'marked', 'フックは nextResolve に委ねる')
      assert.equal(outcome.url, 'file:///resolved-by-default.js')
    })
  })

  describe('ネイティブアプリシェルは コンテンツルートに書き込まずにサーバーを起動できる', () => {
    // AppKit 直結の配線（起動引数の組み立て・リンク処理の削除）のため手動検証のみ。
    // 実アプリ起動での確認はステップ8で行う（test-tree.md 参照）
    test('手動検証のみ: --import フックを渡して node を起動し、リンク作成処理が存在しない', { skip: '手動検証のみ' }, () => {})
  })
})
