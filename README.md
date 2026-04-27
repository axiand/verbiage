# Verbiage
### Simplistic wheel-reinventing wiki engine in plain Node.JS

Verbiage is a wiki/knowledge base engine with one simple twist: everything is written purely from scratch, no dependencies other than the Node.js standard library. This monorepo contains the application itself, as well as all the custom-made libraries it depends on for various utilities.

*Why?* While I wish I could say it's some kind of commentary on the nature of dependencies in modern programming, it's really primarily for recreational purposes, and to have something neat to host on my personal site in the future.

*How?* By writing everything myself. We'll be doing things sort of the old fashioned way - simple server-side rendering, because the only thing I dislike more than using frontend frameworks would be trying to write one. The most modern thing frontend-wise here will probably be the CSS features.

*When?* On and off, whenever I feel motivated.

*Should I use it?* I can't stop you. It's probably not going to be production-ready for quite a while, and while I'll generally try to stick to best practices and keep things reasonably optimized, I'm not gonna make any promises about scaling.

You may notice that there's nothing one could call an "app" here right now. That's because to write a wiki engine from scratch, I must first invent the universe. Please excuse the dust while I write all the prerequisite libraries needed to get this working. For those interested, the gist of the plan is:

1. Get a router working
2. Write an HTML templating engine, enabling ✨ interactivity ✨ using forms 
3. Write a caching/driver layer on top of the file system, enabling ✨ permanent storage ✨ ( <-- you are here now )
4. Once routing, interactivity, and permanent storage are all available to me, I can then start working on the application code.

In the meantime, feel free to take a look at and play around with what's already here!

## Features

Verbiage is an ambitious project. Here's the full run-down on what you can come to expect:

- [x] **Waiter**
- - [x] Basic routing
- - [x] Generic parameters
- - [x] Streamed responses
- - [x] Cookies
- - [x] Middleware (defined in route, cascades to child routes, i.e. `requiresAuth` on `/secrets` applies to `/secrets/shh` and `/secrets/shush`)
- - [x] Multipart form data parser (todo: document!)
- [ ] **Lavender**
- - [X] Basic HTML parsing/substitution (be able to insert a string into the page)
- - [X] Object traversal - `{object.property}`
- - [X] If/else statement - `{if some_prop}<p>True</p>{else}<p>Not true</p>{end}`
- - [X] For statement - `{for item of list}{end}`
- - [X] Components: HTML templates, hydration using JS
- - [X] Fallback components
- - [X] Use a layout to wrap around content
- - [X] HTML Sanitization
- - [ ] Cleanup templates (remove whitespace between html tags)
- - [X] Better error reporting (give approximate position of a faulty expression)
- [ ] **Markdawn**
- - [X] Paragraph
- - [X] Bold
- - [X] Italics
- - [X] Underline
- - [X] Strikethrough
- - [X] Highlight
- - [X] Header
- - [X] Unordered list
- - [X] Ordered list
- - [X] Inline code block
- - [X] Code block
- - [X] Table
- - [X] Footnote
- - [X] Links
- - [X] Masked links
- - [X] Embedded image
- - [X] Extract facets from markdown (eg. TOC, document title, excerpt...)
- - - [ ] Table of contents
- [ ] **Cabinet**
- - [X] Cache file tree
- - [X] Cache file contents
- - [ ] Watch for new files and add to tree
- - [ ] File ops
- - - [X] Check if exists
- - - [X] Stat file
- - - [X] Write file
- - - [X] Read file
- - - [X] Delete file
- - - [X] isDirectory
- - - [X] Upsert file
- - - [ ] Append file
- - - [ ] Move/rename file
- - - [ ] Test permissions
- - - [X] Open read stream
- - - [ ] Open write stream
- - - [X] Check if directory has a child filename (from directory object)
- - - [X] Stat file (from file object)
- - - [X] Get ancestry (return array of /home, /home/foo, /home/foo/bar.bin)
- - - [ ] Get entire file tree
- - [ ] Bag - queryable map of objects serialized to JSON lines
- - - [ ] Deserialize
- - - [ ] Serialize
- - - [ ] Append/Upsert
- - - [ ] Update
- - - [ ] Delete
- - - [X] Limit result count
- - - [X] Order results by given property
- - - [X] Query based on greater-than/less-than
- - - [X] Query based on property equality
- - - [X] Query based on arbitrary function
- - - [ ] Join queries
- [ ] **Verbiage**
- - [X] CRUD wiki pages
- - [X] Arbitrary file upload
- - [ ] File listing view
- - [ ] Media gallery view
- - [ ] Search
- - [ ] Custom sidebar
- - [ ] Custom CSS/favicon
- - [ ] Multi-user
- - - [ ] Login/auth
- - - [ ] Permission system
- - [ ] Multi-wiki
- - [ ] Audit logs / activity tab
- - [ ] Discussions
- - [ ] Custom markdown features
- - - [ ] Emotes
- - - [ ] Wiki links - [[(?namespace:)(path|$alias)]]
- - [ ] Aliases - set up permanent links to files, for example `my_blog_post -> /blog/2026/post.md`

## Install / Setup
1. Clone the repo.
2. Navigate to the cloned directory, run `node index.js`.

## Sub-Libraries

### Waiter - HTTP Server & Router
`./lib/waiter`

Waiter is an HTTP server and routing library. It is responsible for routing requests to their respective methods and provides some utilities to make handling requests easier and more graceful.

More documentation for Waiter is available at `./doc/Waiter.md`

### Lavender - HTML Templating Engine
`./lib/lavender`

Waiter is a component-based server-side rendering framework and templating engine. It is responsible for crafting the HTML responses to send to clients.

More documentation for Lavender is available at `./doc/Lavender.md`

### MarkDawn - Markdown renderer
`./lib/markdawn`

Renders markdown to HTML.

### Cabinet - Storage provider
`./lib/cabinet`

Cabinet implements utilities for file storage, writing, and retrieval.

The first component is the StorageManager class, which can be mounted to any given directory and provides a cached view of the file tree as well as optionally the contents of certain files, with some helper functions.

The second component is the Bag class, which provides a mechanism for serializing, deserializing, and querying JSONL files.