"use strict"
import { readFile } from "node:fs/promises";
import { readdirSync } from "node:fs";
import { pageDir, cacheDir } from './dir.js'
import makePageData from './pageData.js'
import config from './config.js'

let allData = {}

/**
 * @param {string} dir
 * @param {string} namePrefix
 * @param {Array<Promise>} promises
 * @return {Promise<string[]>[]}
 */
const collect = (dir, namePrefix = '', promises = []) => {
  const dirents = readdirSync(dir, { withFileTypes: true })
  dirents.forEach((dirent) => {
    if (dirent.isDirectory()) {
      collect(`${dirent.path}/${dirent.name}`, namePrefix + dirent.name + '/', promises)
    } else {
      const regexp = `\\.(${config.allowedSrcExt})$`
      if (dirent.name.match(regexp)) {
        const name = `${namePrefix}${dirent.name}`
        promises.push(readFile(`${dir}/${dirent.name}`, 'utf8').then(f => [name, f]))
      }
    }
  })
  return promises
}

const indexing = async () => {
  allData = {}

  const files = await Promise.all(collect(pageDir))
  files.forEach((file) => {
    const pageData = makePageData(file[0], file[1])
    if (pageData.distribute) {
      allData[pageData.name] = pageData
    }
  })
}

export { indexing, allData }
