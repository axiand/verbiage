const { RouteLeaf } = require("../../lib/waiter/RouteTree")
const { Cookie } = require("../../lib/waiter/AppRequest")

module.exports.HomePageRoute = new RouteLeaf(
    "/",
    {
        "GET": (req) => {
            req.setHead("X-Hello", "Hello, World!")

            req.set("Hello, World!")

            return req
        }
    },
)

module.exports.PageTestRoute = new RouteLeaf(
    "/w/:user/pages/+path",
    {
        "GET": (req) => {
            req.set(JSON.stringify(req.args))
            return req
        }
    },
)

module.exports.CookieTestRoute = new RouteLeaf(
    "/cookie/:foo",
    {
        "GET": (req) => {
            //console.log(req.cookies)

            let cookie = new Cookie("sample", decodeURIComponent(req.args.foo))
            cookie.sameSite = cookie.SameSiteValue.Lax
            cookie.expiresAt = Date.now() + 120_000
            cookie.isSecure = true

            req.setCookie(cookie)
            return req
        }
    }
)