"use strict"
import distribute from './distribute.js'
import { indexing } from './indexer.js'
import { srcDir, distDir } from './dir.js'

const generate = async () => {
  const start = performance.now()
  const data = await indexing(srcDir + '/pages/')

  await distribute(data, srcDir, distDir)
  const end = performance.now()
  console.log('build: ' + (end - start) + "ms")
}

export default generate
