"use strict"
import { writeFile, readFile } from "node:fs/promises";
import { readdirSync, existsSync, mkdirSync } from "node:fs";
import { pageDir, cacheDir } from './dir.js'
import makePageData from './pageData.js'

const indexFile = `${cacheDir}/index.json`

let newIndex = []
let allData = {}
let deleted = []

const collect = (dir, files = {}, namePrefix = '') => {
  const dirents = readdirSync(dir, { withFileTypes: true })
  dirents.forEach((dirent) => {
    if (dirent.isDirectory()) {
      collect(`${dirent.path}/${dirent.name}`, files, namePrefix + dirent.name + '/')
    } else {
      if (dirent.name.match(/\.(md|html)$/)) {
        const pageData = makePageData(`${namePrefix}${dirent.name}`)
        allData[pageData.name] = pageData
        const { name, url, __output } = pageData
        newIndex.push({ name, url, __output })
      }
    }
  })
}

const indexing = async () => {
  newIndex = []
  allData = {}
  deleted = []
  if (!existsSync(cacheDir)) {
    mkdirSync(cacheDir)
  }
  const oldIndex = await readFile(indexFile, 'utf8').then(text => JSON.parse(text)).catch(error => [])

  collect(pageDir)
  writeFile(indexFile, JSON.stringify(newIndex))

  // 旧インデックスから差分を計算して削除対象をピックアップする
  deleted = oldIndex.filter(oi => !newIndex.map(ni => ni.__output).includes(oi.__output))
}

export { indexing, allData, deleted }
