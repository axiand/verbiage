const fs = require("node:fs")
const pathUtil = require("path")

const HUMAN_READABLE_TYPES_EXT = [
    "application/json",
    "application/yaml",
    "application/toml"
]

const STREAM_CACHED_CHUNK_SIZE = 65_536

class StorageManager {
    mountPoint = ""
    files = null
    mimeFunction = () => { return null }

    maxCacheSize = 15_000
    forbiddenNames = []

    isReadOnly = false

    tryPath(path) {
        let joined = pathUtil.join(this.mountPoint, path)
        let resolved = pathUtil.normalize(joined)
        if (!resolved.startsWith(this.mountPoint)) throw new Error("Illegal location")

        return true
    }

    exists(path) {
        return this.dig(path).file != null
    }

    isDirectory(path) {
        let { file } = this.dig(path)
        if (!file) throw new FileNotFoundError()

        return file.isDirectory
    }

    list(path) {
        let { file } = this.dig(path)
        if (!file) throw new FileNotFoundError()

        file.list()
        return file
    }

    read(path) {
        let { file } = this.dig(path)
        if (!file) throw new FileNotFoundError()

        file.read()
        return file
    }

    write(path, content) {
        let { file } = this.dig(path)
        if (!file) throw new FileNotFoundError()

        file.write(content)
        return file
    }

    upsert(path, name, content) {
        let { file } = this.dig(path)
        if (!file) throw new FileNotFoundError()

        let newFile = file.upsert(name, content)
        return newFile
    }

    delete(path, name) {
        let { file } = this.dig(path)
        if (!file) throw new FileNotFoundError()

        file.delete(name)
        return file
    }

    dig(path, caseSensitive = true, create = false) {
        if (path == "~") return { file: this.files, ancestry: [this.files] }
        this.tryPath(path)

        let normal = pathUtil.posix.normalize(path).replaceAll("\\", "/")
        let pathParts = normal.split("/")

        let current = this.files
        let ancestry = []
        let complete = false

        if (pathParts[0] == "~") pathParts.shift()

        while (!complete) {
            if (pathParts[0].length > 0) {
                ancestry.push(current)
                current.list()
                current = current.tryGetChild(pathParts[0], caseSensitive)
            }

            if (create && current == null && pathParts.length > 1) {
                console.log("here", pathParts[0], pathParts)
                current = ancestry[ancestry.length - 1].mkdir(pathParts[0])
            }

            pathParts.shift()

            if (pathParts.length == 0 || current == null) { complete = true; break }
        }
        if (current != null) ancestry.push(current)

        return { file: current, ancestry: ancestry }
    }

    constructor(mount, options = {}) {
        this.mountPoint = mount

        if (options.maxCacheSize != null) this.maxCacheSize = options.maxCacheSize
        if (options.forbiddenNames != null) this.forbiddenNames = options.forbiddenNames
        if (options.isReadOnly != null) this.isReadOnly = options.isReadOnly
        if (options.mimeFunction != null) this.mimeFunction = options.mimeFunction

        this.files = new File("/", this)
        this.files.isDirectory = true
        this.files.name = "/"

        return this
    }
}

class File {
    manager

    path = ""
    absolutePath = ""
    name = ""
    mimeType = null

    content
    stats = null
    isStatted = false

    isDirectory = false
    isListed = FileListState.Unlisted
    items = new Map()

    get size() {
        this.stat()

        return this.stats.size
    }

    get createdAt() {
        this.stat()

        return this.stats.birthtimeMs
    }

    get modifiedAt() {
        this.stat()

        return this.stats.mtimeMs
    }

    get pathStripped() {
        if (this.path == "/") return "~"
        return this.path.match(/^[\\\/]?(.+)$/m)[1]
    }

    get pathNormalized() {
        return this.pathStripped.replaceAll(pathUtil.sep, pathUtil.posix.sep) + "/"
    }

    get pathAncestor() {
        if (this.isRoot) return "~"

        let pathParts = this.path.split(pathUtil.sep)
        pathParts.splice(-1, 1)
        if (pathParts.length == 1 && pathParts[0].length == 0) return "~"

        pathParts.shift()
        return pathParts.join("/")
    }

    get isMediaFile() {
        if (this.mimeType == null) return false

        return !(this.mimeType.startsWith("text/") || HUMAN_READABLE_TYPES_EXT.includes(this.mimeType))
    }

    get isRoot() {
        return this == this.manager.files
    }

    get sizeString() {
        this.stat()

        if (this.size >= 1_000_000_000) return `${(this.size / 1_000_000_000).toPrecision(3)} GB`
        if (this.size >= 1_000_000) return `${(this.size / 1_000_000).toPrecision(3)} MB`
        if (this.size >= 1_000) return `${(this.size / 1_000).toPrecision(3)} KB`
        return `${this.size} B`
    }

    get extension() {
        let split = this.name.split(".")
        return split.length == 1 ? "" : split[split.length - 1]
    }

    get sizeExtensionString() {
        return `${this.sizeString} .${this.extension}`
    }

    get modifiedRelative() {
        this.stat()

        let rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" })
        let delta = (Date.now() - this.modifiedAt) / 1_000 / 60

        if (delta > 60 * 24 * 30 * 12) return rtf.format(-(Math.round(delta / 12 / 30 / 24 / 60)), "year")
        if (delta > 60 * 24 * 30) return rtf.format(-(Math.round(delta / 30 / 24 / 60)), "month")
        if (delta > 60 * 24) return rtf.format(-(Math.round(delta / 24 / 60)), "day")
        if (delta > 60) return rtf.format(-(Math.round(delta / 60)), "hour")
        if (delta > 1) return rtf.format(-(Math.round(delta)), "minute")
        return "just now"
    }

    get modifiedStamp() {
        this.stat()

        return new Date(this.modifiedAt).toUTCString()
    }

    get createdRelative() {
        this.stat()

        let rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" })
        let delta = (Date.now() - this.createdAt) / 1_000 / 60

        if (delta > 60 * 24 * 30 * 12) return rtf.format(-(Math.round(delta / 12 / 30 / 24 / 60)), "year")
        if (delta > 60 * 24 * 30) return rtf.format(-(Math.round(delta / 30 / 24 / 60)), "month")
        if (delta > 60 * 24) return rtf.format(-(Math.round(delta / 24 / 60)), "day")
        if (delta > 60) return rtf.format(-(Math.round(delta / 60)), "hour")
        if (delta > 1) return rtf.format(-(Math.round(delta)), "minute")
        return "just now"
    }

    get createdStamp() {
        this.stat()

        return new Date(this.createdAt).toUTCString()
    }

    get itemCount() {
        if (!this.isDirectory) return 0

        return this.list().items.size
    }

    get itemsIterable() {
        return this.items.entries()
    }

    read() {
        if (this.isDirectory) throw new Error("Attempt to call read on a directory")
        if (this.content != null) return this

        let content = fs.readFileSync(this.absolutePath)
        console.log(`fs > read ${this.absolutePath}`)
        if (content.length < this.manager.maxCacheSize) this.content = content

        return { file: this, content: content }
    }

    readStream(cb) {
        let { promise, resolve, reject } = Promise.withResolvers()

        try {
            if (!this.content) {
                this.stat()
                let shouldCache = this.size <= this.manager.maxCacheSize
                let cacheBuf = shouldCache ? Buffer.alloc(this.size) : null
                let cacheOffset = 0

                let stream = fs.createReadStream(this.absolutePath)
                console.log(`fs > readStream ${this.absolutePath}`)

                stream.on('data', (data) => {
                    cb(data)
                    if (shouldCache) {
                        data.copy(cacheBuf, cacheOffset)
                        cacheOffset += data.length
                    }
                })

                stream.on('end', () => {
                    if (shouldCache) this.content = cacheBuf
                    resolve(this)
                })

                stream.on('error', (e) => { reject(e) })
            } else {
                let offset = 0

                while (offset < this.content.length) {
                    let chunk = this.content.subarray(offset, offset + STREAM_CACHED_CHUNK_SIZE)
                    cb(chunk)
                    offset += chunk.length
                }

                resolve(this)
            }
        } catch (e) {
            reject(e)
        }

        return promise
    }

    write(content) {
        if (this.isDirectory) throw new Error("Attempt to call write on a directory")
        if (!content instanceof Buffer) throw new Error("Expected a Buffer")

        fs.writeFileSync(this.absolutePath, content)
        console.log(`fs > write ${this.absolutePath}`)
        if (content.length < this.manager.maxCacheSize) { this.content = content } else { this.content = null }

        this.isStatted = false
        this.stat()

        return this
    }

    upsert(name, content) {
        if (!this.isDirectory) throw new Error("Attempt to call upsert on a non-directory")
        if (!content instanceof Buffer) throw new Error("Expected a Buffer")

        let file = this.tryGetChild(name)

        if (file != null) {
            file.write(content)
        } else {
            let newPath = pathUtil.join(this.absolutePath, name)
            fs.writeFileSync(newPath, content)
            console.log(`fs > create ${newPath}`)

            file = this.tryGetChild(name)
            file.stat()
        }

        return file
    }

    delete(name) {
        if (!this.isDirectory) throw new Error("Attempt to call delete on a non-directory")

        let file = this.tryGetChild(name)
        if (file == null) throw new FileNotFoundError()

        if (file.isRoot) throw new Error("Attempt to delete root directory")

        fs.rmSync(file.absolutePath, { recursive: true })
        this.dispose(name)

        return this
    }

    list() {
        if (!this.isDirectory) throw new Error("Attempt to call list on a non-directory")
        if (this.isListed != FileListState.Unlisted) return this

        this.isListed = FileListState.Listing

        let items
        try {
            items = fs.readdirSync(this.absolutePath, { withFileTypes: true, recursive: false })
        } catch (e) {
            this.isListed = FileListState.Unlisted
            throw e
        }
        console.log(`fs > readdir ${this.absolutePath}`)

        for (let dirent of items) {
            let item = this.tryGetChild(dirent.name)
            if (!item) continue
            item.isDirectory = dirent.isDirectory()
        }
        this.isListed = FileListState.Listed

        return this
    }

    mkdir(name) {
        if (!this.isDirectory) throw new Error("Attempt to call mkdir on a non-directory")
        let newPath = pathUtil.join(this.absolutePath, name)

        fs.mkdirSync(newPath)
        console.log(`fs > mkdir ${newPath}`)
        this.isListed = FileListState.Unlisted

        return this.tryGetChild(name)
    }

    stat() {
        if (this.isStatted) return this

        let stats = fs.statSync(this.absolutePath)
        console.log(`fs > stat ${this.absolutePath}`)
        this.useStats(stats)

        return this
    }

    useStats(stats) {
        this.stats = stats
        this.isStatted = true

        this.isDirectory = stats.isDirectory()
    }

    tryGetChild(name, caseSensitive = true) {
        if (name == "/") return this
        if (!this.isDirectory) return null

        if (name.includes("/") || name.includes("\\")) {
            let joined = pathUtil.join(this.path, name)

            this.manager.tryPath(this.pathNormalized + name)
            return this.manager.dig(joined).file
        }

        let existingItem = null
        if (caseSensitive) {
            existingItem = this.items.get(name)
        } else {
            let k = this.items.keys().find(fname => fname.toLowerCase() == name.toLowerCase()) || null
            existingItem = this.items.get(k)
        }
        if (existingItem) return existingItem

        let joined = pathUtil.join(this.absolutePath, name)
        let exists = fs.existsSync(joined)
        if (!exists) return null

        /*
            Fix for case-insensitive file systems. Basically, on a case-insensitive 
            file system, fs.exists() may report that a file with our name exists
            even if the case of that file is actually not the same. This condition
            aims to detect that and redirect the get to the existing correct file.
        */
        if (!this.items.get(name) && this.hasCaseInsensitiveChild(name)) {
            return this.tryGetChild(name, false)
        }

        let newItem = new File(pathUtil.join(this.path, name), this.manager)
        /*
            StorageManager.dig() lists files and thus populates whether
            the files are directories, but if someone tries to iterate on files
            directly, they won't know whether the files are directories because
            the files don't get statted. This line counteracts that.
        */
        if (this.isListed == FileListState.Unlisted) newItem.stat()
        newItem.name = name
        newItem.mimeType = this.manager.mimeFunction(newItem.name)

        this.items.set(name, newItem)

        return this.items.get(name)
    }

    hasCaseInsensitiveChild(name) {
        let k = this.items.keys().find(fname => fname.toLowerCase() == name.toLowerCase()) || null
        return k != null
    }

    dispose(name) {
        this.items.delete(name)

        return this
    }

    constructor(path, manager) {
        this.manager = manager

        let joined = pathUtil.join(manager.mountPoint, path)
        this.path = path
        this.absolutePath = joined

        return this
    }
}

const FileListState = {
    Unlisted: 0,
    Listing: 1,
    Listed: 2
}

class FileNotFoundError extends Error {
    constructor() { super(); return this }
}

module.exports.StorageManager = StorageManager