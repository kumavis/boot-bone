const SwController = require('client-sw-ready-event/lib/sw-client.js')
const SwStream = require('sw-stream/lib/sw-stream.js')

const intervalDelay = Math.floor(Math.random() * (30000 - 1000)) + 1000
const background = new SwController({
  fileName: '/bootloader.js',
  letBeIdle: false,
  wakeUpInterval: 30000,
  intervalDelay,
})

background.on('ready', () => {
  console.log('background ready')
  const swStream = SwStream({
    serviceWorker: background.controller,
    context: 'master',
  })
})
background.on('updatefound', () => window.location.reload())
background.on('error', console.error)

background.startWorker()