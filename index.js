const SwController = require('sw-controller')
const createSwStream = require('sw-stream')

module.exports = createBootBone


function createBootBone() {
  
  const intervalDelay = Math.floor(Math.random() * (30000 - 1000)) + 1000
  const background = new SwController({
    fileName: '/bootloader.js',
    keepAlive: false,
    wakeUpInterval: 30000,
    intervalDelay,
  })

  background.once('ready', () => {
    console.log('background ready')
    const swStream = createSwStream({
      serviceWorker: background.controller,
      context: 'master',
    })
  })
  background.on('updatefound', () => window.location.reload())
  background.on('error', console.error)

  background.startWorker()

  return {
    background,
  }

}