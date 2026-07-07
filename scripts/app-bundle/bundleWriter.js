import { cp, mkdir, rm } from 'node:fs/promises'
import path from 'node:path'

/**
 * @vocab: バンドル書き出し器
 * @test: tests/app-bundle/bundleWriter.test.js
 * @param {Array<{src: string, dest: string}>} resolvedEntries
 * @returns {Promise<void>}
 */
export async function write(resolvedEntries) {
  for (const { src, dest } of resolvedEntries) {
    await mkdir(path.dirname(dest), { recursive: true })
    // 前回の書き出し結果を消してからコピーする（クリーン書き出し）。既存の dest に
    // self-reference依存（node_modules/@tenjuu99/blog → リポジトリルート）のリンクが残っていると、
    // cp のリンク解決チェックが「自分自身の内側へのコピー」とみなして EINVAL で失敗し、
    // 再ビルドできない。verbatimSymlinks はリンクを解決せずそのままコピーするため、
    // 相対リンク（node_modules/.bin 等）が絶対パスに書き換わることも防ぐ。
    await rm(dest, { recursive: true, force: true })
    await cp(src, dest, { recursive: true, verbatimSymlinks: true })
  }
}
