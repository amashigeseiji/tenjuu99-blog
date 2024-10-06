import { readFileSync, existsSync } from 'node:fs'

const rootDir = process.cwd()
const config = {
  "site_name": "default",
  "url_base": "http://localhost:8000",
  "src_dir": "src",
  "dist_dir": "dist",
  "distribute_raw": "image",
  "relative_path": "",
  "helper": "",
  "packages": "",
  "allowedSrcExt": "md|html|txt"
}
try {
  const file = rootDir + '/blog.json'
  if (existsSync(file)) {
    const configOverride = JSON.parse(readFileSync(file, 'utf8'))
    for (const item in configOverride) {
      config[item] = configOverride[item]
    }
  }
} catch (e) {
  console.log(e)
}

export default config
