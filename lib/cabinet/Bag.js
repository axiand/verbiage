class Bag {
    items = new Map()
    primaryKey = "id"
    readOnly = false

    get(id) {
        return this.items.get(id)
    }

    set(data) {
        if (this.readOnly) throw new Error(`Attempt to set on a read-only Bag`)
        if (data[this.primaryKey] == null) throw new Error(`Object to be added does not have the primary key attribute (${this.primaryKey})`)

        this.items.set(data[this.primaryKey], data)
        return this
    }

    delete(id) {
        if (this.readOnly) throw new Error(`Attempt to set on a read-only Bag`)
        return this.items.delete(id)
    }

    query() {
        return new BagQuery(this)
    }

    constructor(options = {}) {
        this.primaryKey = options.primaryKey || "id"
        this.readOnly = options.readOnly || false

        return this
    }

    static wrap(map, options = {}) {
        if (!map instanceof Map) throw new Error("Cannot construct Bag from a non-Map")

        let bag = new Bag(options)
        bag.items = map
        bag.readOnly = true

        return bag
    }

    static from(map, options = {}) {
        if (!map instanceof Map) throw new Error("Cannot construct Bag from a non-Map")

        let bag = new Bag(options)

        for (let [_, value] of map.entries()) {
            bag.set(value)
        }

        return bag
    }
}

class BagQuery {
    bag = null

    constraints = []
    orderKey = null
    orderAscending = false
    itemLimit = -1
    itemStart = 0

    joins = new Map()

    order(name, ascending = false) {
        this.orderKey = name
        this.orderAscending = ascending
        return this
    }

    limit(num) {
        this.itemLimit = num
        return this
    }

    range(start, offset) {
        this.itemLimit = offset + start
        this.itemStart = start
        return this
    }

    greaterThan(key, value) {
        this.constraints.push(new GreaterThanConstraint(key, value).for(this))

        return this
    }

    lesserThan(key, value) {
        this.constraints.push(new LesserThanConstraint(key, value).for(this))

        return this
    }

    equals(key, value, strict = false) {
        this.constraints.push(new EqualsConstraint(key, value, strict).for(this))

        return this
    }

    includes(key, value) {
        this.constraints.push(new IncludesConstraint(key, value).for(this))

        return this
    }

    passes(func) {
        this.constraints.push(new FunctionConstraint(func).for(this))

        return this
    }

    join(key, bag) {
        if (!bag instanceof Bag) throw new Error("Join target must be a Bag")

        this.joins.set(key, bag)
        return this
    }

    getMany() {
        /*
            Pre-sort constraints by complexity so that
            less computationally expensive ones are
            checked first, hopefully saving us time.
        */
        let constrtsSorted = this.constraints.toSorted((a, b) => { return a.complexity - b.complexity })
        //console.log(constrtsSorted)

        let bagMap = this.bag.items

        let collator = new Intl.Collator()
        let useStringSort = null

        let results = []
        let resultBound = null

        /*
            Main loop
        */
        for (let value of bagMap.values()) {
            let match = true
            let sortProp

            if (this.orderKey != null) {
                sortProp = QueryConstraint.digProp(this.orderKey, value, this)

                // This will be frequently used, cache it for quick access.
                if (useStringSort == null) {
                    useStringSort = (typeof sortProp == "string")
                }

                /*
                    Early bound return: if a limit is set,
                    track the value at the end of the results
                    array. If the sort order of the upcoming 
                    item is past that bound, throw it away.
                */
                if (
                    this.itemLimit > 0 &&
                    resultBound != null &&
                    (useStringSort ?
                        (this.orderAscending ? collator.compare(sortProp, resultBound) < 0 : collator.compare(sortProp, resultBound) > 0)
                        :
                        (this.orderAscending ? sortProp > resultBound : sortProp < resultBound)
                    )
                ) continue
            }

            for (let constraint of constrtsSorted) {
                match = constraint.test(value)
                if (!match) break // If any constraint doesn't match...
            }

            if (!match) continue // ...Then throw away the item

            if (this.orderKey == null) {
                /*
                    If no ordering is specified, just
                    append to the array in whatever order
                    the bag returns.
                */
                results.push(value)
                if (this.itemLimit > 0 && results.length >= this.itemLimit) break
            } else {
                if (results.length == 0) {
                    results.push(value)
                    continue
                }

                /*
                    Search for where to insert the item
                */
                let rangeMin = 0
                let rangeMax = results.length
                let mid = 0
                let prec = results.length

                while (prec > 0.5) {
                    mid = Math.floor((rangeMin + rangeMax) / 2)

                    let nextProp = QueryConstraint.digProp(this.orderKey, results[mid], this)

                    let sort = useStringSort ?
                        (this.orderAscending ? collator.compare(sortProp, nextProp) > 0 : collator.compare(sortProp, nextProp) < 0)
                        :
                        (this.orderAscending ? sortProp < nextProp : sortProp > nextProp)

                    if (sort) {
                        rangeMax = mid
                    } else {
                        rangeMin = mid
                    }

                    prec /= 2
                }

                results.splice(rangeMax, 0, value)

                if (this.itemLimit > 0 && results.length > this.itemLimit) {
                    results.pop()
                    if (rangeMax == results.length) {
                        resultBound = QueryConstraint.digProp(this.orderKey, results[results.length - 1], this)
                    }
                }
            }
        }

        if (this.itemStart > 0) results = results.slice(this.itemStart)

        return this.expandJoins(results)
    }

    expandJoins(items) {
        if (this.joins.size == 0) return items

        let joins = [...this.joins.entries()]

        for (let row in items) {
            let rowO = items[row]
            let delta = {}

            for (let [key, bag] of joins) {
                delta[key] = bag.get(rowO[key])
            }

            items[row] = Object.assign({}, rowO, delta)
        }

        return items
    }

    constructor(bag) {
        if (!bag instanceof Bag) throw new Error("Cannot construct Bag from a non-Map")

        this.bag = bag

        return this
    }
}

class QueryConstraint {
    query

    get complexity() {
        let c = 1

        switch (this.constructor) {
            case GreaterThanConstraint:
                c += QueryConstraint.propQueryComplexity(this.key)
                break
            case LesserThanConstraint:
                c += QueryConstraint.propQueryComplexity(this.key)
                break
            case EqualsConstraint:
                c += 0.1
                c += QueryConstraint.propQueryComplexity(this.key)
                break
            case IncludesConstraint:
                c += 0.2
                c += QueryConstraint.propQueryComplexity(this.key)
                break
            case FunctionConstraint:
                c += 1
                break
            default:
                throw new Error(`Cannot compute complexity value for ${this.constructor.name}`)
        }

        return c
    }

    static propQueryComplexity(q) {
        let comp = 0

        comp += ((q.split(".").length) / 10) - 0.1

        return comp
    }

    static digProp(name, data, query) {
        if (!name.includes(".")) {
            let join = query.joins.get(name)
            if (join != null) return join.get(data[name])

            return data[name]
        }

        let nameParts = name.split(".")
        let part = 0
        let current = data

        while (nameParts[part] != null && current != null) {
            // reconsider in the future: do we want to support joins on subproperties?
            let join = part == 0 ? query.joins.get(nameParts[part]) : null
            if (join != null) {
                current = join.get(data[nameParts[part]])
            } else {
                current = current[nameParts[part]]
            }

            part++
        }

        return current
    }

    for(query) {
        this.query = query
        return this
    }

    constructor() {
        return this
    }
}

class GreaterThanConstraint extends QueryConstraint {
    key
    value

    test(data) {
        let p = QueryConstraint.digProp(this.key, data, this.query)
        if (p == null) return false

        return p > this.value
    }

    constructor(key, value) {
        super()
        if (!["string", "number"].includes(typeof value)) throw new Error("Invalid type for constraint (expected number or string)")
        this.key = key
        this.value = value
    }
}

class LesserThanConstraint extends QueryConstraint {
    key
    value

    test(data) {
        let p = QueryConstraint.digProp(this.key, data, this.query)
        if (p == null) return false

        return p < this.value
    }

    constructor(key, value) {
        super()
        if (!["string", "number"].includes(typeof value)) throw new Error("Invalid type for constraint (expected number or string)")
        this.key = key
        this.value = value
    }
}

class EqualsConstraint extends QueryConstraint {
    key
    value
    strict

    test(data) {
        let p = QueryConstraint.digProp(this.key, data, this.query)
        if (p == null) return false

        return this.strict ? p === this.value : p == this.value
    }

    constructor(key, value, strict = false) {
        super()
        this.key = key
        this.value = value
        this.strict = strict
    }
}

class IncludesConstraint extends QueryConstraint {
    key
    value

    test(data) {
        let p = QueryConstraint.digProp(this.key, data, this.query)
        if (typeof p?.includes != "function") return false

        return p.includes(this.value)
    }

    constructor(key, value) {
        super()
        this.key = key
        this.value = value
    }
}

class FunctionConstraint extends QueryConstraint {
    func

    test(data) {
        return this.func(data) === true
    }

    constructor(func) {
        super()
        if (!func instanceof Function) throw new Error("Cannot use function constraint with a non-Function")
        this.func = func
    }
}

module.exports.Bag = Bag;