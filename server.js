const express = require('express')
const { serveBundle, createBundle } = require('./bundleUtil')
const app = express()

app.get('/', (req, res) => {
  res.set('Service-Worker-Max-Age', '3153600000000')
  // res.set('content-type', 'text/html; charset=UTF-8')
  res.send('<script src="./initialize.js"></script>')
})

serveBundle(app, '/initialize.js', createBundle(require.resolve('./initialize.js')))
serveBundle(app, '/bootloader.js', createBundle(require.resolve('./bootloader.js')))


app.listen(3000, () => {
  console.log('listening on 3000')
})