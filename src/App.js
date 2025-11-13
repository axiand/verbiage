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

        return this
    }

    /* 
        Attaches a middleware to the root node of the RouteTree.
        This essentially means the middleware will be found on every search,
        making a global middleware.
    */
    use(fn) {
        this.server.routes.leaves.use(fn)

        return this
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