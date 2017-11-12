// const leveljs = require('level-js')
const memdown = require('memdown')
const levelup = require('levelup')

module.exports = createFs

function createFs () {
  // const db = new levelup(leveljs('root-disk'))
  const db = new levelup(new memdown())

  return db
}
