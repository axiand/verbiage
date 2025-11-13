class RouteTree {
    leaves

    dig(parts, shouldCreate) {
        let where = this.leaves
        let found = null
        let index = 0
        let args = []
        let middlewares = []

        /* If no specific path is provided, just return the top level. */
        if (parts.length == 0) return where

        /* 
            Trailing slashes will cause an empty last item in the array, making us dig one step too far,
            which can cause a false negative. Let's check for and fix that.
         */
        if (parts[parts.length - 1] == "") parts = parts.slice(0, parts.length - 1)

        while (found == null) {
            middlewares = [...middlewares, ...where.middlewares]

            let candidate = where.children[parts[index]]
            if (parts[index] == '*' || parts[index] == '+') candidate = null

            if (candidate == null) {
                if (shouldCreate) {
                    /* 
                        If this route part is a generic param, let's insert a wildcard.
                    */

                    candidate = null

                    switch (parts[index][0]) {
                        case ':': // Generic wildcard param
                            candidate = where.add('*')
                            break;
                        case '+': // Generic path param
                            candidate = where.add('+')
                            break;
                        default:
                            candidate = where.add(parts[index])
                            break;
                    }
                } else {
                    /*
                        If we hit a wildcard, continue digging and note down
                        our current path item so we can return values for
                        generic params.
                    */
                    candidate = where.children["*"] || where.children["+"]

                    if (candidate == null) break

                    if (candidate == where.children["+"]) {
                        args[index] = parts.slice(index).join("/")
                        found = candidate
                        break
                    } else {
                        args[index] = parts[index]
                    }
                }
            }

            if (index == parts.length - 1) {
                found = candidate
                middlewares = [...middlewares, ...found.middlewares]
                break
            }

            where = candidate
            index++
        }

        /*
            Assume we have a path that looks like /a/:foo/b/:bar.
            Our digging process will have picked up an args array
            that has two nonempty slots, 1 and 3, each containing
            a single param's respective value. By looking at the 
            path of the found route, which has the param names
            intact, we can map the positions of our values in the 
            args array back to the positions at which the params 
            appear in the route's blueprint path, constructing a 
            neat object where the key names match the param names.
        */
        let finalArgs = {}
        if (!shouldCreate && found?.path != null) {
            let fpath = found.path.split('/')
            for (let arg in args) {
                finalArgs[fpath[arg].slice(1)] = args[arg]
            }
        }

        return { found: found, args: finalArgs, middlewares: middlewares }
    }

    addRoute(path, route) {
        let split = path.split('/')

        let { found } = this.dig(split, true)
        found.path = path
        found.handlers = route.handlers
        found.middlewares = route.middlewares

        return found
    }

    findRoute(path) {
        let split = path.split('/')

        return this.dig(split, false)
    }

    constructor() {
        this.leaves = new RouteLeaf()
        return this
    }
}

class RouteLeaf {
    children
    handlers
    path
    middlewares

    add(name) {
        this.children[name] = new RouteLeaf()

        return this.children[name]
    }

    use(fn) {
        this.middlewares.push(fn)

        return this
    }

    constructor(path = null, handlers = {}) {
        this.children = {}
        this.path = path
        this.handlers = handlers
        this.middlewares = []

        return this
    }
}

module.exports.RouteTree = RouteTree
module.exports.RouteLeaf = RouteLeaf