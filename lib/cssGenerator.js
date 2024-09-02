"use strict"
import fs from "node:fs/promises";
import { minifyCss } from './minify.js'
import { createHash } from 'crypto'
import path from 'path'
import { distDir as distRoot, cssDir } from './dir.js'
import { watchers } from './watcher.js'
import { styleText } from 'node:util'

let cacheBuster = {}
const cacheBusterQuery = 't'

/**
 * @param {string} src
 * @param {string} dist
 * @returns {Promise<string>}
 */
const cssGenerator = async (src, dist) => {
  const key = `${dist}${src}`
  // 生成済みの場合はそのまま返す
  for (const a in cacheBuster) {
    if (a === key) {
      return cacheBuster[key]
    }
  }
  let css = ''
  for (const cssFile of src.split(',')) {
    css += await fs.readFile(`${cssDir}/${cssFile}`)
  }
  css = minifyCss(css)
  cacheBuster[key] = createHash('md5').update(css).digest('hex')

  return await fs.mkdir(`${distRoot}${path.dirname(dist)}`, { recursive: true }).then(() => {
    fs.writeFile(`${distRoot}${dist}`, css)
    console.log(styleText('green', '[generate]'), `${src} => ${distRoot}${dist}`)
    return cacheBuster[key]
  })
}

/**
 * 次のような記述を想定している。
 * <link rel="stylesheet" href="${/css/layout.css<<base.css,page.css}">
 * href の記述は ${dist:src} の関係になっている。
 *
 * これを
 * <link rel="stylesheet" href="/css/layout.css?t=daddfiao3901239dasei12b">
 * に変換する。
 *
 * @param {string} text
 * @return {string}
 */
const applyCss = async (text) => {
  const target = [...text.matchAll(/\${([\w-_/]+\.css)<<([\w-_/,.]+\.css)}/g)].map(val => {
    return { matched: val[0], dist: val[1], src: val[2] }
  })
  for (const cssDist of target) {
    const cacheBuster = await cssGenerator(cssDist.src, cssDist.dist)
    text = text.replace(cssDist.matched, `${process.env.RELATIVE_PATH || ''}${cssDist.dist}?${cacheBusterQuery}=${cacheBuster}`)
  }
  return text
}

watchers.push({
  paths: cssDir,
  callback: () => { cacheBuster = {} }
})

export default applyCss
