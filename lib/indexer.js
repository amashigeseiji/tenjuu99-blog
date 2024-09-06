"use strict"
import { writeFile, readFile } from "node:fs/promises";
import { readdirSync, existsSync, mkdirSync } from "node:fs";
import { pageDir, cacheDir } from './dir.js'
import makePageData from './pageData.js'

const indexFile = `${cacheDir}/index.json`

let newIndex = []
let allData = {}
let deleted = []

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
      if (dirent.name.match(/\.(md|html)$/)) {
        const name = `${namePrefix}${dirent.name}`
        promises.push(readFile(`${dir}/${dirent.name}`, 'utf8').then(f => [name, f]))
      }
    }
  })
  return promises
}

const indexing = async () => {
  newIndex = []
  allData = {}
  deleted = []
  if (!existsSync(cacheDir)) {
    mkdirSync(cacheDir)
  }

  const files = await Promise.all(collect(pageDir))
  files.forEach((file) => {
    const pageData = makePageData(file[0], file[1])
    allData[pageData.name] = pageData
    const { name, url, __output } = pageData
    newIndex.push({ name, url, __output })
  })
  readFile(indexFile, 'utf8')
    .then(text => {
      const oldIndex = JSON.parse(text)
      deleted = oldIndex.filter(oi => !newIndex.map(ni => ni.__output).includes(oi.__output))
      writeFile(indexFile, JSON.stringify(newIndex))
    })
    .catch(error => [])
}

export { indexing, allData, deleted }
