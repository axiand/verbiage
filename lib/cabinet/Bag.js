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
        this.constraints.push(new GreaterThanConstraint(key, value))

        return this
    }

    lesserThan(key, value) {
        this.constraints.push(new LesserThanConstraint(key, value))

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
                sortProp = QueryConstraint.digProp(this.orderKey, value)

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
                if (results.length >= this.limit) break
            } else {
                let sortPos = 0

                /*
                    Walk up the results array, and:
                    - If the next item is null, append to the array.
                    - Find the index where the item belongs according
                      to sort order.
                    - Insert the item, constrain the array according
                      to the result limit if specified.
                */
                while (true) {
                    let nextObj = results[sortPos]

                    if (nextObj == null) {
                        results.splice(sortPos, 0, value)
                        if (this.itemLimit > 0 && results.length > this.itemLimit) results.pop()
                        break
                    }

                    let nextProp = QueryConstraint.digProp(this.orderKey, nextObj)

                    let sort = useStringSort ?
                        (this.orderAscending ? collator.compare(sortProp, nextProp) > 0 : collator.compare(sortProp, nextProp) < 0)
                        :
                        (this.orderAscending ? sortProp < nextProp : sortProp > nextProp)

                    if (sort) {
                        results.splice(sortPos, 0, value)
                        if (this.itemLimit > 0 && results.length > this.itemLimit) {
                            results.pop()
                            resultBound = QueryConstraint.digProp(this.orderKey, results[results.length - 1])
                        }
                        break
                    }

                    sortPos++
                }
            }
        }

        if (this.itemStart > 0) results = results.slice(this.itemStart)
        return results
    }

    constructor(bag) {
        if (!bag instanceof Bag) throw new Error("Cannot construct Bag from a non-Map")

        this.bag = bag

        return this
    }
}

class QueryConstraint {
    get complexity() {
        let c = 1

        switch (this.constructor) {
            case GreaterThanConstraint:
                return 1
            case LesserThanConstraint:
                return 2
            default:
                throw new Error(`Cannot compute complexity value for ${this.constructor.name}`)
        }
    }

    static digProp(name, data) {
        if (!name.includes(".")) return data[name]
        let nameParts = name.split(".")
        let current = data

        while (nameParts.length > 0 && current != null) {
            current = current[nameParts[0]]
            nameParts.shift()
        }

        return current
    }

    constructor() {
        return this
    }
}

class GreaterThanConstraint extends QueryConstraint {
    key
    value

    test(data) {
        let p = QueryConstraint.digProp(this.key, data)
        if (p == null) return false

        return p > this.value
    }

    constructor(key, value) {
        super()
        this.key = key
        this.value = value
    }
}

class LesserThanConstraint extends QueryConstraint {
    key
    value

    test(data) {
        let p = QueryConstraint.digProp(this.key, data)
        if (p == null) return false

        return p < this.value
    }

    constructor(key, value) {
        super()
        this.key = key
        this.value = value
    }
}

module.exports.Bag = Bag;