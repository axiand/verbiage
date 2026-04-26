const { Bag } = require('./lib/cabinet/Bag.js')

let bag = new Bag()

for (i = 0; i < 1_000_000; i++) {
    //bag.set({ id: i, asdf: String.fromCharCode(...new Array(16).fill(1).map(() => { return Math.round(Math.random() * 16) + 65 })) })
    bag.set({ id: i, asdf: Math.random() })
}

//console.log(bag)

console.time("query")

let rs = bag
    .query()
    .order("asdf", false)
    .limit(8)
    .lesserThan("asdf", 0.6)
    .greaterThan("asdf", 0.34)
    .getMany()

console.timeLog("query")
console.log(rs)