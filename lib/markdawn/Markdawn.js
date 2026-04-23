const LINK_REGEX = /(?<!(?:href|src)=.?)(?<!<a.+>)(https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}(\.[a-zA-Z0-9()]{1,6})?(\:[0-9]{1-5})?\b([-a-zA-Z0-9()@:%_\+~#?&//=.]*))/gi
const BACKWARD_SLASH = String.fromCharCode(92)

class BlockFeature {
    match
    replacer
    transform
    claim
}

class HeaderFeature extends BlockFeature {
    static match = /^#{1,6} (.+)/
    static replacer = "*"
    static claim = false
    static rawLines = false

    static getSlug = (match, level) => {
        let slug = match[1]
            .toLowerCase()
            .replaceAll(" ", "-")

        return `toc-h${level}-${slug}`
    }

    static getLevel = (match) => {
        let hCount = 0
        for (let char of match[0]) {
            if (char != "#" || hCount == 6) break
            hCount++
        }

        return hCount
    }

    static transform = (match, dawn) => {
        let level = HeaderFeature.getLevel(match)

        return `<h${level} id="${HeaderFeature.getSlug(match, level)}">`
            + `${dawn.renderInlineFeatures(match[1])}`
            + `<span class="header-permalink"><a href="#${HeaderFeature.getSlug(match, level)}">#</a></span>`
            + `</h${level}>`
    }

    static describe = (match) => {
        let level = HeaderFeature.getLevel(match)

        return {
            level: level,
            title: match[1],
            slug: HeaderFeature.getSlug(match, level)
        }
    }
}

class QuoteFeature extends BlockFeature {
    static match = /^> (.+)/
    static replacer = `<blockquote>*</blockquote>`
    static claim = true
    static rawLines = false

    static transform = (match, dawn) => {
        return dawn.render(match.join("\n"), false).content
    }
}

class UnorderedListFeature extends BlockFeature {
    static match = /^(?:<li>)?- (.+)/
    static replacer = `<ul>*</ul>`
    static claim = true
    static rawLines = false

    static transform = (match, dawn) => {
        return dawn.render(match.map(line => `<li>${line}</li>`).join("\n"), false).content
    }
}

class OrderedListFeature extends BlockFeature {
    static match = /^(?:<li>)?\* (.+)/
    static replacer = `<ol>*</ol>`
    static claim = true
    static rawLines = false

    static transform = (match, dawn) => {
        return dawn.render(match.map(line => `<li>${line}</li>`).join("\n"), false).content
    }
}

class CodeBlockFeature extends BlockFeature {
    static match = /^``(.*)/
    static replacer = `<samp>*</samp>`
    static claim = true
    static rawLines = false

    static transform = (match, dawn) => {
        return match.map(line => dawn.escaperFunction(line).replaceAll(" ", "&nbsp;")).join("<br>")
    }
}

class HorizontalRuleFeature extends BlockFeature {
    static match = /^---$/
    static replacer = `<hr>`
    static claim = false
    static rawLines = false

    static transform = () => {
        return ""
    }
}

class TableFeature extends BlockFeature {
    static match = /^(\|[^|]+)+\|$/
    static replacer = `<table>*</table>`
    static claim = true
    static rawLines = true

    static getTableRow = (cells, alignments, isHead, dawn) => {
        let tag = isHead ? "th" : "td"
        let row = ""

        for (let i in cells) {
            row +=
                `<${tag}${alignments && alignments[i] ? ` style="text-align: ${alignments[i]};"` : ``}>`
                + dawn.renderInlineFeatures(cells[i])
                + `</${tag}>`
        }

        return row
    }

    static getTableHead = (lines, dawn) => {
        let columnAlignments = []

        let headerSplitter = lines[1]
        if (headerSplitter && headerSplitter.every(cell => cell.match(/:?-+:?/))) {
            for (let cell of headerSplitter) {
                if (cell.startsWith(":") && cell.endsWith(":")) { columnAlignments.push("center"); continue }
                if (cell.startsWith(":")) { columnAlignments.push("left"); continue }
                if (cell.endsWith(":")) { columnAlignments.push("right"); continue }
                columnAlignments.push("")
            }
        }

        let row = TableFeature.getTableRow(lines[0], columnAlignments, true, dawn)

        return { row: row, alignments: columnAlignments }
    }

    static transform = (match, dawn) => {
        let rows = match.map(line => line.split("|").slice(1, -1).map(cell => cell.trim()))
        let final = ""

        let header = TableFeature.getTableHead(rows.slice(0, 2), dawn)

        final += "<thead><tr>" + header.row + "</tr></thead>"

        rows.shift()
        if (header.alignments.length > 0) rows.shift()

        if (rows.length == 0) return final

        let bodyRows = ""

        for (let i in rows) {
            bodyRows += "<tr>" + TableFeature.getTableRow(rows[i], header.alignments, false, dawn) + "</tr>"
        }

        final += "<tbody>" + bodyRows + "</tbody>"

        return final
    }
}

class FootnoteFeature extends BlockFeature {
    static match = /\[\^([^\s]+)\]:[\s]?(.+)/
    static replacer = ``
    static claim = false
    static rawLines = false

    static describe = (match) => {
        return {
            id: match[1],
            caption: match[2]
        }
    }

    /*
        Footnotes are only here to be collected for now.
        We'll attach them to the bottom of the document
        later.
    */
    static transform = () => { return `` }
}

class MediaGalleryFeature extends BlockFeature {
    static match = /^!\[([^\]]*)\]\(([^)]*)\)(?::\s*(.*))?$/
    static replacer = `<div class="media-gallery">*</div>`
    static claim = true
    static rawLines = true

    static transform = (match, dawn) => {
        let items = match.map(line => line.match(MediaGalleryFeature.match))
        let final = ""

        for (let itemMatch of items) {
            let [_, title, link, caption] = itemMatch
            let mediaInfo = dawn.mediaFunction(link)

            final +=
                `<div class="media-gallery-item">`
                + `<a class="media-gallery-container" href="${mediaInfo.link}">`
                + MediaEmbedFeature.getMediaContainer(mediaInfo.type, mediaInfo.href, title)
                + `</a>`
                + (caption != null ? `<p class="media-gallery-caption">${dawn.renderInlineFeatures(caption)}</p>` : ``)
                + `</div>`
        }

        return final
    }
}

class InlineFeature {
    openingBrace
    closingBrace
    transform
}

class ItalicsFeature extends InlineFeature {
    static openingBrace = "*"
    static closingBrace = "*"
    static transform = (match, dawn) => {
        let matchClean = match.slice(1, match.length - 1)

        return `<i>${dawn.renderInlineFeatures(matchClean)}</i>`
    }
}

class BoldFeature extends InlineFeature {
    static openingBrace = "**"
    static closingBrace = "**"
    static transform = (match, dawn) => {
        let matchClean = match.slice(2, match.length - 2)

        return `<b>${dawn.renderInlineFeatures(matchClean)}</b>`
    }
}

class UnderlineFeature extends InlineFeature {
    static openingBrace = "__"
    static closingBrace = "__"
    static transform = (match, dawn) => {
        let matchClean = match.slice(2, match.length - 2)

        return `<u>${dawn.renderInlineFeatures(matchClean)}</u>`
    }
}

class StrikethroughFeature extends InlineFeature {
    static openingBrace = "~~"
    static closingBrace = "~~"
    static transform = (match, dawn) => {
        let matchClean = match.slice(2, match.length - 2)

        return `<s>${dawn.renderInlineFeatures(matchClean)}</s>`
    }
}

class InlineCodeBlockFeature extends InlineFeature {
    static openingBrace = "`"
    static closingBrace = "`"
    static transform = (match, dawn) => {
        let matchClean = dawn.escaperFunction(match.slice(1, match.length - 1))

        return `<code>${matchClean}</code>`
    }
}

class HighlightFeature extends InlineFeature {
    static openingBrace = "=="
    static closingBrace = "=="
    static transform = (match, dawn) => {
        let matchClean = match.slice(2, match.length - 2)

        return `<mark>${dawn.renderInlineFeatures(matchClean)}</mark>`
    }
}

class MaskedLinkFeature extends InlineFeature {
    static openingBrace = "{{"
    static closingBrace = "}}"
    static transform = (match, dawn) => {
        let matchClean = match.slice(2, match.length - 2)
        let linkParts = matchClean.split("|")
        if (linkParts[1]) {
            let linkRewritten = dawn.linkFunction(linkParts[0])

            return `<a href="${linkRewritten}" ${linkRewritten.match(LINK_REGEX) ? `target="_blank"` : ``}>`
                + `${dawn.renderInlineFeatures(linkParts[1].replace("/", "&sol;"))}`
                + `</a>`
        } else {
            return match
        }
    }
}

class MarkdownLinkFeature extends InlineFeature {
    static openingBrace = "["
    static closingBrace = ")"
    static transform = (match, dawn) => {
        let matchClean = match.slice(1, match.length - 1)
        let linkParts = matchClean.split("](")
        linkParts = [linkParts.slice(0, -1).join("]("), linkParts[linkParts.length - 1]]

        if (linkParts[1]) {
            let linkRewritten = dawn.linkFunction(linkParts[1])

            return `<a href="${linkRewritten}"${linkRewritten.match(LINK_REGEX) ? `target="_blank"` : ``}>`
                + `${dawn.renderInlineFeatures(linkParts[0])}`
                + `</a>`
        } else {
            return match
        }
    }
}

class MediaEmbedFeature extends InlineFeature {
    static openingBrace = "!["
    static closingBrace = ")"

    static getMediaContainer(type, href, title = null) {
        let out

        switch (type) {
            case "audio":
                out = `<audio src="${href}" controls${title != null ? ` title="${title}"` : ``}></audio>`
                break
            case "video":
                out = `<video src="${href}" controls${title != null ? ` title="${title}"` : ``}></video>`
                break
            default:
                out = `<img height="300" src="${href}"${title != null ? ` title="${title}"` : ``}></img>`
                break
        }

        return out
    }

    static transform = (match, dawn) => {
        let matchClean = match.slice(2, match.length - 1)
        let linkParts = matchClean.split("](")
        if (linkParts[1]) {
            let mediaInfo = dawn.mediaFunction(linkParts[1])
            if (!mediaInfo) return dawn.renderInlineFeatures(`[${match}](${match})`)

            return MediaEmbedFeature.getMediaContainer(mediaInfo.type, mediaInfo.href, linkParts[0])
        } else {
            return match
        }
    }
}

class FootnoteLinkFeature extends InlineFeature {
    static openingBrace = "[^"
    static closingBrace = "]"

    static getFootnoteById = (id, dawn) => {
        return dawn.featureDescriptions.blocks.find(f => f.feature == FootnoteFeature && f.data.id == id)
    }

    static transform = (match, dawn) => {
        let id = dawn.escaperFunction(match).match(/\[\^([^\s]+)\]/)
        let noteFeat = FootnoteLinkFeature.getFootnoteById(id[1], dawn)

        if (
            !id[0]
            || !noteFeat
        ) return match

        return `<sup id="fn-ref-${id[1]}" class="footnote">` +
            `<a href="#fn-${id[1]}" title="${dawn.escaperFunction(noteFeat.data.caption)}">${id[1]}</a>` +
            `</sup>`
    }
}

class Markdawn {
    blockFeatures = [
        HeaderFeature,
        QuoteFeature,
        CodeBlockFeature,
        UnorderedListFeature,
        OrderedListFeature,
        HorizontalRuleFeature,
        TableFeature,
        FootnoteFeature,
        MediaGalleryFeature
    ]

    inlineFeatures = [
        BoldFeature,
        ItalicsFeature,
        UnderlineFeature,
        StrikethroughFeature,
        InlineCodeBlockFeature,
        HighlightFeature,
        MaskedLinkFeature,
        MarkdownLinkFeature,
        MediaEmbedFeature,
        FootnoteLinkFeature
    ]

    featureMap = {}

    escaperFunction = null
    linkFunction = null
    context = {}
    featureDescriptions = null

    renderInlineFeatures(line) {
        let final = ""
        let cursor = 0
        let currentSyntax = null
        let currentFeatureGroup = null
        let candidateFeature = null
        let featureEscaped = false

        while (line[cursor] != null) {
            let current = line[cursor]
            //console.log("syntax", currentSyntax)
            //console.log("candidate", candidateFeature)
            cursor++

            if (currentSyntax == null && this.featureMap[current] != null) {
                if (line.charCodeAt(cursor - 2) == 92) featureEscaped = true // char code 92: backward slash
                currentFeatureGroup = this.featureMap[current]
                currentSyntax = current
                candidateFeature = currentFeatureGroup.get(currentSyntax) || null
                continue
            }

            if (currentFeatureGroup != null) {
                currentSyntax += current
                candidateFeature = currentFeatureGroup.get(currentSyntax) || candidateFeature

                // false alarm, no syntax features matching this pattern
                if (!candidateFeature && !currentFeatureGroup.values().find(feat => feat.openingBrace.startsWith(currentSyntax))) {
                    final += currentSyntax

                    currentSyntax = null
                    currentFeatureGroup = null
                    featureEscaped = false

                    continue
                }

                if (!candidateFeature) continue
                if (
                    currentSyntax.length > candidateFeature.closingBrace.length
                    && currentSyntax.endsWith(candidateFeature.closingBrace)
                ) {
                    if (candidateFeature == MarkdownLinkFeature) {
                        let nestCount = 0

                        for (let char of currentSyntax) {
                            if (char == "[") nestCount++
                            if (char == "]") nestCount--
                        }

                        if (nestCount != 0) continue
                    }

                    let currentCloser = candidateFeature.closingBrace
                    let closerCandidate = candidateFeature

                    /*
                        Lookahead for ambiguous feature closers

                        Assume a line like *italics **bold** italics*.
                        We don't want the beginning of the bold block to
                        be misinterpreted as the end of the italics block,
                        so we should scan ahead to see if we're not dealing
                        with the opening brace of a different feature.
                    */
                    if (
                        candidateFeature.closingBrace.length == 1
                        && currentFeatureGroup.get(currentSyntax.slice(-1) + line[cursor]) != null
                    ) continue

                    /*
                        Another lookahead for ambiguous syntax.

                        Assume a line like **bold *italics***.
                        The syntax gets ambiguous between where the italics
                        ends and the bold block's closing brace begins.
                        Let's scan ahead one character and see if it still
                        matches our current closing brace. If it does,
                        continue on.
                    */
                    if (
                        candidateFeature.closingBrace.length > 1
                        && (currentSyntax.slice(-1) + line[cursor]) == candidateFeature.closingBrace
                    ) continue
                } else { continue }

                if (line[cursor - (candidateFeature.closingBrace.length + 1)] == BACKWARD_SLASH) { continue }

                if (!featureEscaped) {
                    let transformed = candidateFeature.transform(currentSyntax, this)
                    final += transformed

                    candidateFeature = null
                } else {
                    final +=
                        candidateFeature.openingBrace
                        + this.renderInlineFeatures(
                            currentSyntax.slice(candidateFeature.openingBrace.length, -(candidateFeature.closingBrace.length)
                            ))
                        + candidateFeature.closingBrace
                }

                currentSyntax = null
                currentFeatureGroup = null
                featureEscaped = false
            } else {
                final += current
            }
        }

        if (currentSyntax != null) {
            final += candidateFeature == null || featureEscaped
                ? currentSyntax
                : candidateFeature.openingBrace + this.renderInlineFeatures(currentSyntax.slice(candidateFeature.openingBrace.length))
        }

        final = final.replace(LINK_REGEX, `<a href="$1" target="_blank">$1</a>`)
        final = final.replace(BACKWARD_SLASH, "")

        return final
    }

    renderFootnotes(features) {
        let notes = new Map()
        let out = ``

        features.blocks.forEach((item) => {
            if (item.feature != FootnoteFeature) return

            notes.set(item.data.id, item.data)
        })

        if (notes.size == 0) return ``

        out += `<div class="footnotes"><ul>`

        notes.values().forEach((note) => {
            out +=
                `<li id="fn-${note.id}" class="footnote">` +
                `<p><a href="#fn-ref-${note.id}">${note.id}</a>` +
                `. ${this.renderInlineFeatures(note.caption)}</p>` +
                `</li>`
        })

        out += `</ul></div>`

        return out
    }

    render(text, getFeatures = true, fileName = "markdown.md") {
        let final = ""

        let textLines = text.split("\n").map(l => l.replaceAll("\r", ""))
        textLines = this.rewriteFencedCodeBlocks(textLines)
        textLines = textLines.map(l => l.trim())
        textLines.push("") // trailing newline to force release any current block features

        let features = getFeatures ? this.getFeatures(textLines, fileName) : null
        /*
            Ideally this would be passed around between rendering
            functions, but at this point that would require a lot 
            of tedious refactoring, and markdawn instances aren't 
            being recycled anywhere in a way where this would cause 
            problems. Maybe someday...
        */
        if (features != null) this.featureDescriptions = features
        let cursor = features != null && features.frontmatter != null ? features.frontmatter.lineCount + 1 : 0

        let currentClaimant = null
        let claimedLines = []

        while (textLines[cursor] != null) {
            let line = textLines[cursor]
            cursor++

            let hasBlockFeature = false

            if (currentClaimant) {
                let match = line.match(currentClaimant.match)
                if (!match) {
                    let textTransformed = currentClaimant.transform(claimedLines, this)
                    final += currentClaimant.replacer.replace("*", textTransformed)
                    final += `<p>${this.renderInlineFeatures(line)}</p>`

                    currentClaimant = null
                    continue
                }

                claimedLines.push(currentClaimant.rawLines ? line : match[1])
                continue
            }

            if (line.length == 0) continue

            for (let blockFeat of this.blockFeatures) {
                let match = line.match(blockFeat.match)
                if (!match) continue

                if (blockFeat.claim) {
                    currentClaimant = blockFeat
                    claimedLines = []
                    claimedLines.push(blockFeat.rawLines ? line : match[1])
                } else {
                    let textTransformed = blockFeat.transform(match, this)
                    final += blockFeat.replacer.replace("*", textTransformed)
                }

                hasBlockFeature = true
                break
            }

            if (hasBlockFeature) continue

            final += `<p>${this.renderInlineFeatures(line)}</p>`
        }

        if (features != null) final += this.renderFootnotes(features)

        return { content: final, features: features }
    }

    renderPlainText(text, fileName = "text.txt") {
        let final = ""

        let lines = text.split("\n")
        let features = this.getFeatures(lines, fileName, false)

        for (let line of lines) {
            final += (`<p>${this.escaperFunction(line).replaceAll(" ", "&nbsp;")}</p>`)
        }

        return { content: final, features: features }
    }

    getFeatures(lines, fileName = null, getBlocks = true) {
        lines = lines.map(ln => ln.replaceAll("\r", ""))
        let frontmatter = getBlocks ? this.getFrontmatter(lines) : null

        let title = null
        let description = null
        let excerpt = null
        let blocks = []

        if (getBlocks) {
            let cursor = 0
            while (lines[cursor] != null) {
                let current = lines[cursor]
                cursor++

                let hasFeature = false
                for (let blockFeat of this.blockFeatures) {
                    let match = current.match(blockFeat.match)
                    if (!match) continue

                    if (!blockFeat.describe) break

                    blocks.push({ feature: blockFeat, data: blockFeat.describe(match), line: cursor })
                    hasFeature = true
                    break
                }

                if (!hasFeature && !excerpt && current.length > 0) {
                    excerpt = current
                }
            }
        } else {
            excerpt = lines[0]
        }

        // grab title and description from frontmatter
        title = frontmatter?.fields.title || null
        description = frontmatter?.fields.description || ""

        // ...or fallback to extracting from block features
        if (title == null) {
            let firstHeader = blocks.find(b => b.feature.constructor == HeaderFeature.constructor)
            if (firstHeader && firstHeader.line == 1) {
                title = firstHeader.data.title
            } else {
                title = fileName // ...or fallback to the provided file name
            }
        }

        return { frontmatter: frontmatter, title: title, description: description, excerpt: excerpt, blocks: blocks }
    }

    getFrontmatter(lines) {
        if (lines[0] != "---") return null

        let fields = {}
        let currentField = null

        lines.shift()
        let endIndex = lines.findIndex(l => l == "---")
        if (!endIndex) return null

        let cursor = 0
        let complete = false
        while (!complete) {
            let current = lines[cursor]
            cursor++
            if (current == null || current == "---") { complete = true; continue }

            let fieldMatch = current.match(/^([a-z0-9]+):\s?(.*)$/)
            if (fieldMatch) {
                if (currentField != null) {
                    fields[currentField.name] = currentField.isList ? currentField.items : currentField.items.join("\n")
                }

                let fieldName = fieldMatch[1]
                let fieldContent = fieldMatch[2]

                if (fieldContent.startsWith("[") && fieldContent.endsWith("]")) {
                    try {
                        fields[fieldName] = JSON.parse(fieldContent)
                    } catch (e) {
                        fields[fieldName] = fieldContent
                    }

                    continue
                }

                if (fieldContent && fieldContent != "|") {
                    fields[fieldName] = fieldContent
                } else {
                    currentField = { name: fieldName, items: [], isList: fieldContent != "|" }
                }
            } else {
                if (!currentField) continue

                let itemMatch = current.match(/^-\s?(.+)/)
                currentField.items.push(itemMatch != null ? itemMatch[1] : current)
            }
        }

        lines.splice(0, endIndex + 1)

        let lineCount = endIndex

        while (lines[0].length == 0) { lines.shift(); lineCount++ }

        return { fields: fields, lineCount: lineCount }
    }

    /*
        Rewrite Markdown-style fenced code blocks to fit seamlessly 
        into our parsing system.
    */
    rewriteFencedCodeBlocks(lines) {
        let finalLines = []
        let currentFenced = []
        let isFenced = false

        let cursor = 0
        let complete = false

        while (!complete) {
            let current = lines[cursor]
            if (current == null) {
                if (isFenced) finalLines.push("```", ...currentFenced)

                complete = true
                continue
            }
            cursor++

            if (isFenced) {
                if (current.trim() == '```') {
                    isFenced = false
                    finalLines.push(...currentFenced.map(line => "``" + line))

                    currentFenced = []
                    continue
                }

                currentFenced.push(current)
            } else {
                if (current.startsWith('```')) {
                    isFenced = true
                    continue
                }

                finalLines.push(current)
            }
        }

        return finalLines
    }

    constructor(options = {}) {
        this.escaperFunction = options.escaperFunction || ((text) => { return text })
        this.linkFunction = options.linkFunction || ((href) => { return href })
        this.mediaFunction = options.mediaFunction || ((href) => { return { type: null, href: href } })
        this.context = options.context || {}

        for (let inlineFeat of this.inlineFeatures) {
            let firstChar = this.featureMap[inlineFeat.openingBrace[0]]
            if (firstChar) {
                firstChar.set(inlineFeat.openingBrace, inlineFeat)
            } else {
                let featGroup = new Map()
                featGroup.set(inlineFeat.openingBrace, inlineFeat)
                this.featureMap[inlineFeat.openingBrace[0]] = featGroup
            }
        }

        return this
    }
}

module.exports.Markdawn = Markdawn