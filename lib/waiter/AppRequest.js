class AppRequest {
    request
    response
    args

    /* Headers is a list of [name, value] tuples. */
    headers
    status

    isStreamed
    body

    constructor(req, res, args) {
        this.request = req
        this.response = res
        this.args = args

        this.headers = []
        this.status = 200

        this.isStreamed = false
        this.body = ""

        return this
    }

    setHead(name, value, forceNew = false) {
        if (forceNew) {
            this.headers.push([name, value])
            return this
        }

        let existing = this.headers.findIndex((item) => { return item[0] == name })

        existing > -1 ? this.headers[existing][1] = value : this.headers.push([name, value])

        return this
    }

    getHead(name) {
        let existing = this.headers.findIndex((item) => { return item[0] == name })

        if (existing == -1) return null

        return this.headers[existing]
    }

    headersToList() {
        let final = []

        this.headers.forEach((item) => {
            final = final.concat([item[0], item[1]])
        })

        return final
    }

    set(data) {
        if (this.isStreamed) throw "Attempt to set body when the request is using streamed mode"
        this.body = data

        return this
    }

    write(data) {
        if (!this.response.headersSent) throw "Attempt to write body before headers"

        this.response.write(data)

        return this
    }

    writeHead() {
        this.isStreamed = true

        this.response.writeHead(this.status, this.headersToList())

        return this
    }

    end() {
        if (!this.isStreamed) throw "Attempt to end response in non-streamed mode"

        this.response.end()

        return this
    }
}

module.exports.AppRequest = AppRequest;