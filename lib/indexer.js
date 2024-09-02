"use strict"
import fs from "node:fs/promises";
import { pageDir, cacheDir } from './dir.js'
import makePageData from './pageData.js'

const indexFile = `${cacheDir}/index.json`

let allData = {}
let deleted = []

const indexing = async () => {
  const oldIndex = await fs.readFile(indexFile, 'utf8').then(text => JSON.parse(text)).catch(error => [])

  const newIndex = []
  allData = {}
  deleted = []
  await fs.readdir(pageDir).then(files => {
    files
      .filter(fileName => fileName.match('\.(md|html)$'))
      .forEach(file => {
        const metaData = makePageData(file)
        allData[metaData.name] = metaData
        const { name, url, __output } = metaData
        newIndex.push({ name, url, __output })
      })
  })
  fs.writeFile(indexFile, JSON.stringify(newIndex))

  // 旧インデックスから差分を計算して削除対象をピックアップする
  deleted = oldIndex.filter(oi => !newIndex.map(ni => ni.__output).includes(oi.__output))
}

export { indexing, allData, deleted }
