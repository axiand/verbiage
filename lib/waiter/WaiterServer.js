const { Server } = require('node:http')
const pathModule = require('node:path')
const path = pathModule.posix

const { RouteTree, RouteLeaf } = require('./RouteTree.js')
const { AppRequest, ClientRejection } = require('./AppRequest.js')

class Waiter {
    server
    routes
    isStarted
    meta

    constructor(meta = null) {
        this.server = new Server()
        this.routes = new RouteTree()
        this.meta = meta

        this.server.on('request', async (req, res) => {
            let pa = path.normalize(req.url)

            let contentLength = req.headers["content-length"] != null && parseInt(req.headers["content-length"])
            let body = Buffer.alloc(contentLength || 0)
            let bodyOffset = 0

            let awaitBody = new Promise((resolve) => {
                req.on('data', (data) => { data.copy(body, bodyOffset); bodyOffset += data.length })
                req.on('end', () => { resolve() })
            })
            if (contentLength) await awaitBody

            //console.log(`--> ${req.method} ${pa}`)

            let t = Date.now()

            let route = this.routes.findRoute(pa.split("?")[0])

            let handler = route.found?.handlers[req.method]
            if (!handler) { // Not implemented
                /*
                    It's more sane and in line with user expectations
                    to return a 404 on GET requests to unsupported
                    routes. As a bonus, we can also direct the request
                    to the fallback handler in case the application
                    logic handles 404s in some special way.
                */
                if (req.method == "GET") {
                    let appreq = new AppRequest(req, res, {}, body)

                    let handled = await this.codeFallback(appreq.reject(404).appreq)
                    if (!handled.body) {
                        res.writeHead(404)
                    } else {
                        res.writeHead(handled.status, handled.headersToList())
                        res.write(handled.body)
                    }
                }

                if (!res.headersSent) res.writeHead(405)
                res.end()
                return this.logFinal(req.method, res.statusCode, req.socket.remoteAddress, pa, t)
            }

            try {
                let appreq = new AppRequest(req, res, route.args, body)

                let handled = await this.runRequest(appreq, route, handler)

                if (!handled.isStreamed) {
                    res.writeHead(handled.status, handled.headersToList())
                    res.write(handled.body)

                    res.end()
                }
            } catch (err) {
                console.log(`waiter > /!\\ Error in ${req.method} ${route.found.path}:`, err)
                if (!res.headersSent) res.writeHead(500)
                res.end()
                return this.logFinal(req.method, res.statusCode, req.socket.remoteAddress, pa, t)
            }

            this.logFinal(req.method, res.statusCode, req.socket.remoteAddress, pa, t)
        })

        return this
    }

    /*
        Run all middlewares of the route and its main handler, report back with
        an apprequest returned by either the middlewares or the handler.
    */
    async runRequest(appreq, route, handler) {
        for (let middle of route.middlewares) {
            try {
                let handledMiddle = await middle(appreq, this.meta)
                if (handledMiddle instanceof AppRequest) return handledMiddle
            } catch (middleErr) {
                console.log(`waiter > /!\\ Error in middleware dependency of ${route.found.path}: ${middleErr}`)
                throw middleErr
            }
        }

        let handledMain = await handler(appreq, this.meta)
        if (
            !handledMain ||
            !handledMain instanceof AppRequest ||
            !handledMain instanceof ClientRejection
        ) throw new Error("Route returned something that isn't an AppRequest?")

        if (handledMain instanceof ClientRejection) {
            handledMain = await this.codeFallback(handledMain.appreq, handledMain.code)
        }

        return handledMain
    }


    /*
        Attempt to fallback to a status code handler for this request.
    */
    async codeFallback(appreq, code = null) {
        appreq.isFallback = true
        if (code != null) appreq.status = code

        let codeHandler = this.routes.findRoute(`/_statusCode/${appreq.status}`).found
        let codeGet = codeHandler?.handlers["GET"]

        // no code handler. we did all we could, but return back the apprequest!
        if (!codeHandler || !codeGet) return appreq

        let handled = await this.runRequest(appreq, codeHandler, codeGet)

        return handled
    }

    logFinal(method, status, ip, where, epoch) {
        console.log(`<-- ${method} ${status} ${ip} ${where} in ${Date.now() - epoch}ms`)
    }

    listen(port) {
        this.server.listen(port)
        this.isStarted = true

        return this
    }

    addRoute(route) {
        if (this.isStarted) throw "Server already started"
        if (!route instanceof RouteLeaf) throw "Expected routeleaf, got something else"

        let pathNormal = path.normalize(route.path)
        return this.routes.addRoute(pathNormal, route)
    }
}

module.exports.Waiter = Waiter