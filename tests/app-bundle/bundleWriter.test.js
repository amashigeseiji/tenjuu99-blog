import { test, describe, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, mkdir, writeFile, readFile, stat, symlink, lstat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { write } from '../../scripts/app-bundle/bundleWriter.js'

let workDir

beforeEach(async () => {
  workDir = await mkdtemp(path.join(tmpdir(), 'bundle-writer-test-'))
})

afterEach(async () => {
  await rm(workDir, { recursive: true, force: true })
})

describe('バンドル書き出し器は 解決済みの対応表に従って実際にファイルをコピーし.appを組み立てられる', () => {
  test('ファイル1つのコピー: destの親ディレクトリが無くても作成してコピーする', async () => {
    const srcFile = path.join(workDir, 'node-bin', 'node')
    await mkdir(path.dirname(srcFile), { recursive: true })
    await writeFile(srcFile, 'fake-node-binary')

    const destFile = path.join(workDir, 'app', 'Contents', 'Resources', 'node', 'bin', 'node')

    await write([{ src: srcFile, dest: destFile }])

    assert.equal(await readFile(destFile, 'utf8'), 'fake-node-binary')
  })

  test('ディレクトリ丸ごとのコピー: 中身も再帰的にコピーされる', async () => {
    const srcDir = path.join(workDir, 'lib')
    await mkdir(path.join(srcDir, 'nested'), { recursive: true })
    await writeFile(path.join(srcDir, 'a.js'), 'export const a = 1')
    await writeFile(path.join(srcDir, 'nested', 'b.js'), 'export const b = 2')

    const destDir = path.join(workDir, 'app', 'Contents', 'Resources', 'app', 'lib')

    await write([{ src: srcDir, dest: destDir }])

    assert.equal(await readFile(path.join(destDir, 'a.js'), 'utf8'), 'export const a = 1')
    assert.equal(await readFile(path.join(destDir, 'nested', 'b.js'), 'utf8'), 'export const b = 2')
  })

  test('複数エントリをまとめて書き出せる', async () => {
    const srcA = path.join(workDir, 'a.txt')
    const srcB = path.join(workDir, 'b.txt')
    await writeFile(srcA, 'A')
    await writeFile(srcB, 'B')

    const destA = path.join(workDir, 'out', 'a.txt')
    const destB = path.join(workDir, 'out', 'nested', 'b.txt')

    await write([
      { src: srcA, dest: destA },
      { src: srcB, dest: destB },
    ])

    assert.equal(await readFile(destA, 'utf8'), 'A')
    assert.equal(await readFile(destB, 'utf8'), 'B')
  })

  test('存在しないsrcを指定するとエラーになる', async () => {
    const missing = path.join(workDir, 'does-not-exist')
    const dest = path.join(workDir, 'out', 'x')
    await assert.rejects(() => write([{ src: missing, dest }]))
  })

  test('srcにシンボリックリンクが含まれる場合、実体化せずリンクのままコピーする（自己参照循環を避けるため）', async () => {
    // npmのself-reference（`file:./`）依存はパッケージ自身のルートを指すシンボリックリンクになり、
    // 実体化（dereference）すると自分自身を再帰的に含んでしまい無限ループになる。
    // そのため書き出し器はシンボリックリンクを解決せずそのままコピーする。
    // 配布先で意味を持つリンクへの張り替えは呼び出し側（配布物組み立て器）の責務。
    const realDir = path.join(workDir, 'real-package')
    await mkdir(realDir, { recursive: true })
    await writeFile(path.join(realDir, 'index.js'), 'export const x = 1')

    const linkedSrc = path.join(workDir, 'node_modules', '@scope', 'pkg')
    await mkdir(path.dirname(linkedSrc), { recursive: true })
    await symlink(realDir, linkedSrc, 'dir')

    const dest = path.join(workDir, 'out', 'node_modules', '@scope', 'pkg')

    await write([{ src: linkedSrc, dest }])

    const destStat = await lstat(dest)
    assert.ok(destStat.isSymbolicLink(), 'destはシンボリックリンクのままコピーされる')
  })
})
