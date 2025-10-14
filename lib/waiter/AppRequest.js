class AppRequest {
    request
    response
    args

    headers
    status

    isStreamed
    body

    constructor(req, res, args) {
        this.request = req
        this.response = res
        this.args = args

        this.headers = {}
        this.status = 200

        this.isStreamed = false
        this.body = ""

        return this
    }

    set(data) {
        if (this.isStreamed) throw "Attempt to set body when the request is using streamed mode"
        this.body = data
    }

    write(data) {
        if (!this.response.headersSent) throw "Attempt to write body before headers"

        this.response.write(data)
    }

    writeHead() {
        this.isStreamed = true

        this.response.writeHead(this.status, this.headers)
    }

    end() {
        if (!this.isStreamed) throw "Attempt to end response in non-streamed mode"

        this.response.end()
    }
}

module.exports.AppRequest = AppRequest;