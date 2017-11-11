const SwGlobalListener = require('sw-stream/lib/sw-global-listener.js')
const connectionListener = new SwGlobalListener(global)
global.addEventListener('message', console.log)

console.log('bootloader online')

connectionListener.on('remote', (portStream, messageEvent) => {
  console.log('page connection established')
})