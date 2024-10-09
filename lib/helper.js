import config from './config.js'
import { existsSync } from 'node:fs'
import { helperDir } from './dir.js'

let helper = {}

if (config.helper) {
  const files = config.helper.split(',')
  files.forEach(async file => {
    if (existsSync(`${helperDir}/${file}`)) {
      const helperAdditional = await import(`${helperDir}/${file}`)
      helper = Object.assign(helper, helperAdditional)
    }
  })
}

export default helper
