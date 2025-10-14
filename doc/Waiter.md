# I. Intro

Waiter is a simple HTTP router with utility abstractions.

### I.I. Application structure

At the core of Waiter is the `Waiter` class, which contains the server instance as well as the routes, exposed by the `WaiterServer.js` module.

The `RouteTree.js` module exposes:

- `RouteTree`, the data structure used to retrieve and add application routes. It takes the form of a recursive tree of `RouteLeaf` instances.
- `RouteLeaf`, which represents a single route where each function (handler) maps to an HTTP request method.

There is also the `AppRequest` class, exposed by `AppRequest.js`, which is an abstraction over the request and response objects. All request handlers are expected to receive and return back `AppRequest` instances. Waiter will send the status code and headers specified in the `status` and `headers` props respectively.

Example of importing and instantiating a Waiter server:

```js
const { Waiter } = require('./WaiterServer.js')

var serv = new Waiter()
```

### I.II. Generic parameters

Generic params are accessed through the `args` property of the `AppRequest`, where each param is a key-value pair where the key is the param name and the value is the parsed contents of the param. Waiter supports two types of generic parameters:

The **Wildcard** parameter allows passing generic arguments to the application, where a single parameter is a single part of the path. They are prefixed with colon symbols in the route path.

```
Route: /users/:user_id/status/:status_id
Request: /users/2/status/1000
Parsed args:
{
    "user_id": 2,
    "status_id": 1000
}
```

The **Path** parameter allows passing arbitrarily-long paths to the application. Once a path parameter is hit, the remaining part of the request path is passed to the route handler as a param. They are prefixed with plus symbols in the route path.

```
Route: /users/:user_id/files/+file
Request: /users/2/files/Photos/2024/20240611_155512.jpg
Parsed args:
{
    "user_id": 2,
    "file": "Photos/2024/20240611_155512.jpg"
}
```

When matching against the request path, named path parts take priority over generic params. Consider this example, listed in order of which route would get the most priority:

```
/users/all/status/random
/users/:user_id/status/random
/users/:user_id/status/:status_id
```

Named path parts are case-sensitive. A request path of `/Users/1` won't match a route path of `/users/:id`.

### I.III. Headers

Setting headers is done through the AppRequest's `setHead` method. By default, headers will merge into the first existing header of the same name:

```js
    req.setHead("X-Hello", "should be replaced")
    req.setHead("X-Hello", "should be replacement")
```

However, passing `true` to the last (`forceNew`) argument will force the method to create a separate header. Useful for situations like e.g. `Set-Cookie`:

```js
    req.setHead("Set-Cookie", "Session=abcdef01234; Secure; SameSite=Strict", true)
    req.setHead("Set-Cookie", "Some-Cosmetic-Value=1;", true)
```

Headers can be obtained using the `getHead` method or the `headers` property of AppRequest. They are represented as a `[<header name>, <header value>]` tuple.

### I.IV. Setup & Lifecycle

The Waiter server does not automatically start listening when the class is instantiated. Rather, `listen` must first be called. It is strongly recommended that all necessary route handlers be loaded *before* listening.

Example of setup of a Waiter server:

```js
const { Waiter } = require('./lib/waiter/WaiterServer.js')
const { RouteLeaf } = require('./lib/waiter/RouteTree.js')

/* 
    Create a route instance with one generic param
    and a GET method handler that returns the param
    back to the user
*/
var HelloWorldRoute = new RouteLeaf(
    '/:param/',
    {
        "GET": (data) => {
            data.body = `Hello world! ${data.args["param"]}`
            return data
        }
    }
)

/* Create a server instance */
var serv = new Waiter()

/* Load our route into the server's route tree */
serv.addRoute(HelloWorldRoute)

/* Listen at http://localhost:3000/ */
serv.listen(3000)
```

### I.V. Error handling

Waiter will automatically throw and present an HTTP 500 to the user upon a server-side error with no extra input required from the programmer. It does not however make any efforts to address data loss and partially completed tasks.

Any request whose path/method combination fails to map to any existing route handler will return an HTTP 501 Not Implemented error code.


### II. Streamed Responses

By default, Waiter uses on-demand responses, meaning the headers and body supplied in the AppRequest object are sent to the client once the request logic finishes. This is good enough for most purposes, however for certain cases like transferring large files, apps may benefit from being able to stream responses chunk-by-chunk.

Example of implementing a request using streamed responses:

```js
"GET": (req) => {
            /* Set then write headers. Using writeHead() marks the request as "streamed", enabling unique behaviour. */
            req.setHead("Content-Type", "video/mp4")
            req.writeHead()

            /* Stream a file to the client. */
            let stream = createReadStream("./vid.mp4")
            stream.on('data', (chunk) => { req.write(chunk) })
            stream.on('end', () => { req.end() })

            /* 
                AppRequest objects can be returned before the logic has finished. It is the programmer's
                responsibility to call end() once the data is actually done streaming.
            */
            return req
        }
```