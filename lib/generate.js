"use strict"
import distribute from './distribute.js'
import { indexing, allData } from './indexer.js'
import { srcDir, distDir, cache, helperDir } from './dir.js'
import { warmUpTemplate } from './applyTemplate.js'
import { styleText } from 'node:util'
import config from './config.js'
import { existsSync } from 'node:fs'

const beforeGenerate = async () => {
  cache()
  await warmUpTemplate()
}

export const runHooks = async (hookName, customHelperDir = null, customAllData = null, customConfig = null) => {
  const targetConfig = customConfig || config
  const targetAllData = customAllData || allData
  const targetHelperDir = customHelperDir || helperDir

  if (!targetConfig.hooks || !targetConfig.hooks[hookName]) {
    return
  }

  const hookFiles = Array.isArray(targetConfig.hooks[hookName])
    ? targetConfig.hooks[hookName]
    : [targetConfig.hooks[hookName]]

  for (const hookFile of hookFiles) {
    const hookPath = `${targetHelperDir}/${hookFile}`

    if (existsSync(hookPath)) {
      try {
        const hookModule = await import(hookPath)
        if (typeof hookModule[hookName] === 'function') {
          await hookModule[hookName](targetAllData, targetConfig)
          console.log(styleText('blue', `[hook] ${hookName} executed: ${hookFile}`))
        }
      } catch (e) {
        console.error(styleText('red', `[hook error] ${hookName}:`), e)
        throw e
      }
    }
  }
}

const generate = async () => {
  let start = performance.now()
  await beforeGenerate()
  await indexing()
  let end = performance.now()
  console.log(styleText('blue', '[indexing: ' + (end - start) + "ms]"))

  // フックポイント: afterIndexing
  start = performance.now()
  await runHooks('afterIndexing')
  end = performance.now()
  if (config.hooks?.afterIndexing) {
    console.log(styleText('blue', '[afterIndexing hook: ' + (end - start) + "ms]"))
  }

  start = performance.now()
  await distribute(allData, srcDir, distDir)
  end = performance.now()
  console.log(styleText('blue', '[distribute: ' + (end - start) + "ms]"))
}

export default generate
