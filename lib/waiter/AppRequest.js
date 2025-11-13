class AppRequest {
    request
    response
    args

    /* 
        headers is a list of [name, value] tuples.

        Not to be confused with this.request.headers, which are the received headers.
        These ones are to be sent.
     */
    headers
    status
    _cookiesParsed = null

    isStreamed
    body

    /* Only decode cookies on-demand. Cache the result. */
    get cookies() {
        if (this._cookiesParsed != null) return this._cookiesParsed

        this._cookiesParsed = this.decodeCookies(this.request.headers["cookie"])
        return this._cookiesParsed
    }

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

    setCookie(cookie) {
        if (!cookie instanceof Cookie) throw "Must be a Cookie object."

        this.setHead("Set-Cookie", cookie.serialize(), true)
    }

    decodeCookies(header) {
        if (!header) return {}

        let decoded = {}
        let split = header.split("; ")

        split.forEach(pair => {
            let pairSplit = pair.split("=")
            let cName = pairSplit[0]
            let cValue = decodeURIComponent(pairSplit.slice(1).join())

            decoded[cName] = cValue
        })

        return decoded
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

class Cookie {
    name = null
    value = null

    domain = null
    expiresAt = null
    path = null
    sameSite = null
    isSecure = null
    isHttpOnly = null

    /* poor man's enum */
    SameSiteValue = {
        Strict: "Strict",
        Lax: "Lax",
        None: "None"
    }

    constructor(name, value) {
        this.name = name;
        this.value = value;
    }

    /* Return a properly-formatted cookie definition to be put in a Set-Cookie header */
    serialize() {
        if (!this.name || !this.value) throw "Cookie must have at least a name and a value to serialize"
        let final = ""

        final += this.name + "=" + encodeURIComponent(this.value) + ";" // <cookie name>=<cookie value>;

        let attributes = [
            this.domain && `Domain=${encodeURIComponent(this.domain)};`,
            this.expiresAt && `Expires=${new Date(this.expiresAt).toUTCString()};`,
            this.path && `Path=${this.path};`,
            this.sameSite && `SameSite=${this.sameSite};`,
            this.isSecure && `Secure;`,
            this.isHttpOnly && `HttpOnly;`,
        ]

        final += attributes.filter(a => a != null).join("")

        return final
    }
}

module.exports.AppRequest = AppRequest;
module.exports.Cookie = Cookie;