const { readdirSync } = require('node:fs')
const { join } = require('node:path')

const { Waiter } = require('../lib/waiter/WaiterServer.js')

class App {
    server

    constructor() {
        this.server = new Waiter()

        return this
    }

    start() {
        this.server.listen(3001)
        console.log('app > listening on http://localhost:3001/')
    }

    loadRoutesFromDir(where) {
        let files = readdirSync(where)

        files.forEach((f) => {
            let routes = require(join(where, f))
            for (let routeName in routes) {
                let route = routes[routeName]
                this.server.addRoute(route)
                console.log(`Imported ${route.path} from ${f}`)
            }
        })
    }
}

module.exports.App = App