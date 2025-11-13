const { Server } = require('node:http')
const pathModule = require('node:path')
const path = pathModule.posix

const { RouteTree, RouteLeaf } = require('./RouteTree.js')
const { AppRequest } = require('./AppRequest.js')

class Waiter {
    server
    routes
    isStarted

    constructor() {
        this.server = new Server()
        this.routes = new RouteTree()

        this.server.on('request', async (req, res) => {
            let t = Date.now()
            let pa = path.normalize(req.url)

            //console.log(`--> ${req.method} ${pa}`)

            let route = this.routes.findRoute(pa)

            let handler = route.found?.handlers[req.method]
            if (!handler) { // Not implemented
                res.writeHead(501)
                res.end()
                return this.logFinal(req.method, res.statusCode, pa, t)
            }

            try {
                let appreq = new AppRequest(req, res, route.args)

                for (let middle of route.middlewares) {
                    try {
                        middle(appreq)
                    } catch (middleErr) {
                        console.log(`waiter > /!\\ Error in middleware dependency of ${route.found.path}: ${middleErr}`)
                        throw middleErr
                    }
                }

                let handled = await handler(appreq)
                if (!handled instanceof AppRequest) throw "Route returned something that isn't an AppRequest?"

                if (!handled.isStreamed) {
                    res.writeHead(handled.response.statusCode, handled.headersToList())
                    res.write(handled.body)

                    res.end()
                }
            } catch (err) {
                console.log(`waiter > /!\\ Error in ${req.method} ${route.found.path}:`, err)
                if (!res.headersSent) res.writeHead(500)
                res.end()
                return this.logFinal(req.method, res.statusCode, pa, t)
            }

            this.logFinal(req.method, res.statusCode, pa, t)
            this.counter++
        })

        return this
    }

    logFinal(method, status, where, epoch) {
        console.log(`<-- ${method} ${status} ${where} in ${Date.now() - epoch}ms`)
    }

    listen(port) {
        this.server.listen(port)
        this.isStarted = true

        return this
    }

    addRoute(route) {
        if (!route instanceof RouteLeaf) throw "Expected routeleaf, got something else"

        let pathNormal = path.normalize(route.path)
        if (pathNormal.endsWith("/")) pathNormal = pathNormal.slice(0, pathNormal.length - 1) // cut trailing slash
        return this.routes.addRoute(pathNormal, route)
    }
}

module.exports.Waiter = Waiter