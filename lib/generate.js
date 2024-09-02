"use strict"
import distribute from './distribute.js'
import { indexing, allData, deleted } from './indexer.js'
import { srcDir, distDir } from './dir.js'
import { styleText } from 'node:util'

const generate = async () => {
  const start = performance.now()
  await indexing()

  await distribute(allData, deleted, srcDir, distDir)
  const end = performance.now()
  console.log(styleText('blue', '[build: ' + (end - start) + "ms]"))
}

export default generate
