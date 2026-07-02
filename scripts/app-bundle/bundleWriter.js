import { cp, mkdir } from 'node:fs/promises'
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
    await cp(src, dest, { recursive: true })
  }
}
