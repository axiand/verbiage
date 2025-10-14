const { RouteLeaf } = require("../../lib/waiter/RouteTree");

const { createReadStream } = require("node:fs")

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
            req.set(SON.stringify(req.args))
            return req
        }
    },
)