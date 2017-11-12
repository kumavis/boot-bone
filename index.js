const pipe = require('pump')
const SwController = require('sw-controller')
const createSwStream = require('sw-stream')
// const dnode = require('dnode-p')
const dnode = require('dnode')

module.exports = createBootBone

function createBootBone () {
  const intervalDelay = Math.floor(Math.random() * (30000 - 1000)) + 1000
  const background = new SwController({
    fileName: '/bootloader.js',
    keepAlive: false,
    wakeUpInterval: 30000,
    intervalDelay
  })

  // establish connection
  background.once('ready', () => {
    console.log('client: background ready')
    const swStream = createSwStream({
      serviceWorker: background.getWorker(),
      context: 'master'
    })

    const guest = createDnode()

    pipe(
      swStream,
      guest,
      swStream,
      console.error
    )
  })
  background.on('updatefound', () => console.log('client: update found'))
  // background.on('updatefound', () => window.location.reload())
  background.on('error', console.error)

  background.startWorker()

  return {
    background
  }
}

function createDnode () {
  const guest = dnode({
    hello: () => console.log('client: host says hello')
  })
  guest.once('remote', (remoteHost) => {
    global.remoteHost = remoteHost
    console.log('client: dnode connected')
  })
  global.guest = guest
  return guest
}
