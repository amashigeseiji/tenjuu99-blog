import { createHash } from 'node:crypto'

/**
 * @vocab フィンガープリント
 * ファイル内容（テキスト・バイナリ）から計算される、同じ内容なら同じ値になる識別子。
 * リモート（git リポジトリ）が同じ内容の blob に与える識別と一致するように計算する。
 * @typedef {string} Fingerprint
 */

/**
 * @vocab フィンガープリント
 * @test tests/publishing/gitHubPublicationMeans.test.js
 * 内容の指紋を計算する。リモート側の同じ内容の識別（git の blob ID）と一致するため、
 * 内容を取り寄せずに手元とリモートの同異を判定できる。
 * @param {Buffer|Uint8Array} content
 * @returns {Fingerprint}
 */
export function compute(content) {
  const bytes = Buffer.isBuffer(content) ? content : Buffer.from(content)
  return createHash('sha1')
    .update(`blob ${bytes.length}\0`)
    .update(bytes)
    .digest('hex')
}
