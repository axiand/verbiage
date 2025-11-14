const { join } = require('node:path')

const { App } = require('./src/App.js')

app = new App()

app.loadRoutesFromDir(join(__dirname, '/src/routes'))

app.start()