class AppRequest {
    request
    response
    args
    body

    constructor(req, res, args) {
        this.request = req
        this.response = res
        this.args = args
        this.body = ""

        return this
    }
}

module.exports.AppRequest = AppRequest;