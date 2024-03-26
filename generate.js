"use strict"
import distribute from './lib/distribute.js'
import { indexing } from './lib/indexer.js'
import { srcDir, distDir } from './lib/dir.js'

const data = await indexing(srcDir)

distribute(data, srcDir, distDir)
