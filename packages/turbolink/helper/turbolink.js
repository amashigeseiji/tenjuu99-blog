import fs from 'node:fs'
import { dir } from '@tenjuu99/blog'

export function turbolink() {
  const turbolinkScript = fs.readFileSync(dir.templateDir + '/turbolink.js', 'utf8')
  return `<script>${turbolinkScript}</script>`
}
