"use strict"
import distribute from './lib/distribute.js'
import { indexing } from './lib/indexer.js'
import { srcDir, distDir } from './lib/dir.js'

const start = performance.now()
const data = await indexing(srcDir + '/pages/')

await distribute(data, srcDir, distDir)
const end = performance.now()
console.log('build: ' + (end - start) + "ms")
