# Verbiage
### Simplistic wheel-reinventing wiki engine in plain Node.JS

Verbiage is a wiki/knowledge base engine with one simple twist: everything is written purely from scratch, no dependencies other than the Node.js standard library. This monorepo contains the application itself, as well as all the custom-made libraries it depends on for various utilities.

*Why?* While I wish I could say it's some kind of commentary on the nature of dependencies in modern programming, it's really primarily for recreational purposes, and to have something neat to host on my personal site in the future.

*How?* By writing everything myself. We'll be doing things sort of the old fashioned way - simple server-side rendering, because the only thing I dislike more than using frontend frameworks would be trying to write one. The most modern thing frontend-wise here will probably be the CSS features.

*When?* On and off, whenever I feel motivated.

*Should I use it?* I can't stop you. It's probably not going to be production-ready for quite a while, and while I'll generally try to stick to best practices and keep things reasonably optimized, I'm not gonna make any promises about scaling.

You may notice that there's nothing one could call an "app" here right now. That's because to write a wiki engine from scratch, I must first invent the universe. Please excuse the dust while I write all the prerequisite libraries needed to get this working. For those interested, the gist of the plan is:

1. Get a router working ( <-- you are here now )
2. Write an HTML templating engine, enabling ✨ interactivity ✨ using forms
3. Write a caching/driver layer on top of the file system, enabling ✨ permanent storage ✨
4. Once routing, interactivity, and permanent storage are all available to me, I can then start working on the application code.

In the meantime, feel free to take a look at and play around with what's already here!

## Features

Verbiage is an ambitious project. Here's the full run-down on what you can come to expect:

- [ ] **Waiter**
- - [x] Basic routing
- - [x] Generic parameters
- - [ ] Streamed responses
- - [ ] Cookies
- - [ ] Middleware (defined in route, cascades to child routes, i.e. `requiresAuth` on `/secrets` applies to `/secrets/shh` and `/secrets/shush`)
- [ ] **Lavender**
- - [ ] Basic HTML parsing/substitution (be able to insert a string into the page)
- - [ ] Object traversal - `{object.property}`
- - [ ] If/else statement - `{if some_prop}<p>True</p>{else}<p>Not true</p>{end}`
- - [ ] For statement - `{for item of list}{end}`
- - [ ] Components: HTML templates, hydration using JS
- [ ] **Database/file driver - name TBD**
- - [ ] --TBD--
- [ ] **Verbiage**
- - [ ] CRUD wiki pages
- - [ ] Arbitrary file upload
- - [ ] File listing view
- - [ ] Media gallery view
- - [ ] Multi-user
- - - [ ] Login/auth
- - - [ ] Permission system
- - [ ] Multi-wiki

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

\* WIP \*