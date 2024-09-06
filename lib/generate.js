"use strict"
import distribute from './distribute.js'
import { indexing, allData } from './indexer.js'
import { srcDir, distDir } from './dir.js'
import { styleText } from 'node:util'

const generate = async () => {
  let start = performance.now()
  await indexing()
  let end = performance.now()
  console.log(styleText('blue', '[indexing: ' + (end - start) + "ms]"))

  start = performance.now()
  await distribute(allData, srcDir, distDir)
  end = performance.now()
  console.log(styleText('blue', '[distribute: ' + (end - start) + "ms]"))
}

export default generate
