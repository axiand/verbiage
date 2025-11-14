const { readdirSync, readFileSync, statSync, existsSync } = require('node:fs')
const { join, parse } = require('node:path')

const { Waiter } = require('../lib/waiter/WaiterServer.js')
const { Component } = require('../lib/lavender/Component.js')

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
        console.log("app > Importing routes...")
        let files = readdirSync(where)

        files.forEach((f) => {
            let routes = require(join(where, f))
            for (let routeName in routes) {
                let route = routes[routeName]
                this.server.addRoute(route)
                console.log(`app/routes > Imported ${route.path} from ${f}`)
            }
        })
    }

    loadComponentsFromDir(where) {
        console.log("app > Importing components...")
        let files = readdirSync(where, { recursive: true })

        /*
            - Get a list of all .html files in the directory.
            - Strip away their extensions, see if they have a .js counterpart.
            - Combine the HTML and JS, pack it into a new Component instance.
            - Load component into Lavender.
        */
        files.forEach((f) => {
            if (statSync(join(where, f)).isDirectory()) return
            if (!f.endsWith(".html")) return

            let basePart = parse(f).dir + "/" + parse(f).name
            let hasScript = existsSync(join(where, basePart) + ".js")
            console.log(basePart, hasScript)

            let template = readFileSync(join(where, basePart) + ".html", { encoding: "utf8" })
            let component = new Component(template)
        })
    }
}

module.exports.App = App