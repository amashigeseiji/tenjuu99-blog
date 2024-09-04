import * as helperDefault from '../helper/index.js'
import config from './config.js'
import { srcDir } from './dir.js'

let helper = {...helperDefault}

if (config['helper']) {
  const helperAdditional = await import(`${srcDir}/${config.helper}`)
  helper = Object.assign(helper, helperAdditional)
}

export default helper
