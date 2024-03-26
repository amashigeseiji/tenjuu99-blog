import http from 'http'
import url from 'url'
import fs from 'node:fs/promises'
import { distDir } from './lib/dir.js'

const contentType = (ext) => {
    switch (ext) {
      case 'html':
        return 'text/html'
      case 'css':
        return 'text/css'
      case 'js':
      case 'javascript':
        return 'text/javascript'
      case 'json':
        return 'application/json'
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg'
      case 'xml':
        return 'application/xml'
      case 'rdf':
        return 'application/rdf+xml.rdf'
      default:
        return 'application/octet-stream'
    }
}

http.createServer((request, response) => {
  console.log(request.method, request.url)
  const url = new URL(`http://${request.headers.host}${request.url}`)
  let path = url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname)
  if (!path.includes('.')) {
    path += '.html'
  }
  fs.readFile(`${distDir}${path}`, 'binary').catch(error => {
    console.log(error)
    response.writeHead(404)
    response.end('404 not found')
  }).then(file => {
    const ext = path.split('.')[1]
    response.writeHead(200, { 'Content-Type': `${contentType(ext)}; charset=utf-8` })
    response.end(file, 'binary')
  })
}).listen(process.env.PORT || 8000)
