import http from 'http'
import url from 'url'
import fs from 'node:fs/promises'
import { distDir } from './dir.js'

const contentType = (ext) => {
    switch (ext) {
      case 'html':
      case 'css':
        return `text/${ext}`
      case 'js':
        return 'text/javascript'
      case 'jpeg':
      case 'png':
      case 'webp':
      case 'avif':
        return `image/${ext}`
      case 'jpg':
        return 'image/jpeg'
      case 'svg':
        return 'image/svg+xml'
      case 'xml':
      case 'json':
        return `application/${ext}`
      case 'rdf':
        return 'application/rdf+xml.rdf'
      default:
        return 'application/octet-stream'
    }
}

const server = () => {
  return http.createServer((request, response) => {
    console.log(request.method, request.url)
    const url = new URL(`http://${request.headers.host}${request.url}`)
    let path = url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname)
    if (!path.includes('.')) {
      path += '.html'
    }
    fs.readFile(`${distDir}${path}`, 'binary').catch(async (error) => {
      const errorContent = await fs.readFile(`${distDir}/404.html`)
      console.log(error)
      response.writeHead(404)
      response.end(errorContent)
    }).then(file => {
      const ext = path.split('.')[1]
      response.writeHead(200, { 'Content-Type': `${contentType(ext)}; charset=utf-8` })
      response.end(file, 'binary')
    })
  })
}

export default server
