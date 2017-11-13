const pipe = require('pump')
const SwController = require('sw-controller')
const createSwStream = require('sw-stream')
const dnode = require('dnode')
const pify = require('pify')
const { dnodeGetFirstRemote, mapObject } = require('./util')

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
  background.once('ready', async () => {
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

    // get host and layer compat
    let remoteHost = await dnodeGetFirstRemote(guest)
    // add promise support
    remoteHost = mapObject(remoteHost, (key, value) => pify(value))
    global.remoteHost = remoteHost
    console.log('client: dnode connected')
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
  }, { emit: 'object' })
  return guest
}
