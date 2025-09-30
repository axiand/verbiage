const { RouteLeaf } = require("../../lib/waiter/RouteTree");

module.exports.HomePageRoute = new RouteLeaf(
    "/",
    {
        "GET": (data) => {
            data.body = "Hi!"
            return data
        }
    },
)

module.exports.PageTestRoute = new RouteLeaf(
    "/w/:user/pages/+path",
    {
        "GET": (data) => {
            data.body = JSON.stringify(data.args)
            return data
        }
    },
)