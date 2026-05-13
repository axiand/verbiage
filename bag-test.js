const { Bag } = require('./lib/cabinet/Bag.js')
const { join } = require("path")

async function main() {

    let bag = await Bag.fromFile(join(__dirname, "/bag.dat"))

    for (i = 0; i < 8; i++) {
        bag.set({ id: i, asdf: String.fromCharCode(...new Array(16).fill(1).map(() => { return Math.round(Math.random() * 16) + 65 })) })
    }

}

main()