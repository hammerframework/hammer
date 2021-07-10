# Redwood Router

<!-- toc -->
  - [Purpose and Vision](#purpose-and-vision)
  - [Package Lead](#package-lead)
  - [Roadmap](#roadmap)
    - [Coming Soon](#coming-soon)
    - [Coming Later](#coming-later)
  - [Contributing](#contributing)
    - [How Client-side Routing Works (Briefly)](#how-client-side-routing-works-briefly)
      - [Location](#location)
      - [History](#history)
    - [Putting it Together](#putting-it-together)

## Purpose and Vision

@todo

Redwood Router (RR from now on) is designed to list all routes in a single file, without any nesting. We prefer this design, as it makes it very easy to track which routes map to which pages.

## Package Lead

@todo

- [@mojombo](https://github.com/mojombo)

## Roadmap

@todo

<!-- @todo Rename files to camelCase for consistency -->
<!-- @todo Rollback internal.js importing -->

### Coming Soon

- Type / convert to TypeScript (in progress at [#791](https://github.com/redwoodjs/redwood/issues/791))
- Fix layout rerendering ([#267](https://github.com/redwoodjs/redwood/issues/267))
- Add prerendering (in discussion at https://community.redwoodjs.com/t/prerender-proposal/849)
- Make named-routes function at build time

### Coming Later

- Use tree-based route-matching algorithm

## Contributing

@todo

### How Client-side Routing Works (Briefly)

@todo

This isn't meant to be authoritative in any way, but as far as contributing goes, this is kind of how RR works, and what you'll want to be familiar with.

The way history works (or, perhaps, the way _we_ work with it) is the thing that has changed the most. Today, we load new content dynamically, without loading a new document. But we still want navigation to be intuitive&mdash;back should send you back, forward should send you forward. So the question becomes: if we're doing it all dynamically, how does the browser know what to do when we navigate?

The TLDR is basically now we have to do it all ourselves. But that doesn't mean we don't have APIs to work with. Client-side routing uses the `location` and `history` Web APIs, along with the `popstate` window event. Let's go over each.

> In the we-have-to-do-it-all-ourselves sense, you can kind of think of client-side routing like GraphQL: you write the schema, you write the resolvers. There's no part of it that is done for you (aside from whatever auto-generating library you or your framework uses). Same with client-side routing: you `pushState` the new `state`, `title`, and `url` (~schema), and then have to get there somehow (~resolvers).

#### Location

[Location](https://developer.mozilla.org/en-US/docs/Web/API/Location) represents the location (i.e. url) of the document in the window. It's pretty straightforward. The properties we use the most are `pathname`, `hash`, and `search`. Using a url as an example:

```javascript
// https://redwoodjs.com/?search=cells

{
  pathname: '/',
  hash: '',
  search: '?search=cells',
}
```

One more:

```javascript
// https://redwoodjs.com/tutorial/cells.html#summary

{
  pathname: '/tutorial/cells.html',
  hash: '#summary',
  search: '',
}
```

#### History

@todo (need to explain how `popstate` fits in)

The history Web API (as far as client-side routing is concerned) comprises two things: the `pushState` function and how it plays with the window's `popstate` event.

> By history, we mean session history&mdash;"the pages visited in the tab or frame that the current page is loaded in" ([source](https://developer.mozilla.org/en-US/docs/Web/API/History)).

`pushState` gives us a way to add entries to the history stack. Here's an [MDN-inspired](https://developer.mozilla.org/en-US/docs/Web/API/History_API/Working_with_the_History_API#Adding_and_modifying_history_entries) example:

```javascript
// https://redwoodjs.com

const stateObj = {
    foo: "bar",
}

history.pushState(stateObj, "page 2", "bar.html")
```

Assuming you're on https://redwoodjs.com, if you run the example in the console, you should see the url change. It should now be http://redwoodjs.com/bar.html. But notice that the browser didn't actually do anything&mdash;it didn't load `bar.html`, or even check that it exists. What gives?

Although the `location` updates (and that's important to remember), `pushState` doesn't actually do anything to the document per se. It's just an API for adding entries to the history stack. The three parameters it takes are: a state object (which you won't really see us using), a title (which you also won't really see us using), and a URL (we use this!).

So even if we use `pushState` to change the url's pathname to `/bar.html`, we still have to programatically get there somehow. 

<!-- More on how Redwood does that in a second. -->

<!-- I said `pushState` works in conjunction with `popstate`, so where does that bit come in?

`popstate` is how we get the backward and forward buttons to work. Note that just calling pushState won't proc fire off a `popstate` event. Instead, it's all about the browser actions. -->

### Putting it Together

In a Redwood app, the way we navigate is by using use the 
`<Link>` component. [In the source](https://github.com/redwoodjs/redwood/blob/main/packages/router/src/links.js#L35), you'll see that `<Link>` has a call to [`navigate`](https://github.com/redwoodjs/redwood/blob/1e3cfcbf67b6cdca2e0dfbba000bcb67a7204f50/packages/router/src/history.js#L11-L14), which uses `pushState`:

```javascript
// packages/router/src/history.js

// ...

navigate: (to) => {
  window.history.pushState({}, null, to)
  listeners.forEach((listener) => listener())
},

// ...

```

So when we navigate, location will change from the call to `pushState` (the `<Link>` component's `to` prop gets passed as the argument for the `pushState` function's `url`). Then each listener gets called. This is where the "resolver" part of our router starts. The question now is what is in our `listeners` array? 

[In `location.js`](https://github.com/redwoodjs/redwood/blob/1e3cfcbf67b6cdca2e0dfbba000bcb67a7204f50/packages/router/src/location.js#L19-L23), we set up a listener that updates the `<LocationProvider>` component's state:

```javascript
// packages/router/src/location.js

// ...

getContext() {
  const { pathname, search, hash } = this.props.location
  return { pathname, search, hash }
}

// ...

componentDidMount() {
  gHistory.listen(() => {
    this.setState(() => ({ context: this.getContext() }))
  })
}

// ...

```

So every time we navigate, the `<LocationProvider>` gets the updated location. As the name would suggest, the `<LocationProvider>` is providing context, so anything that subscribes to it will be notified. But also, whenever its state updates, it's going to rerender. And that means the `<RouterImpl>` will too:

> This is also kind of the source of our layout rerendering problems.

```javascript
// packages/router/src/router.js

// ...

const Router = (props) => (
  <Location>
    {(locationContext) => <RouterImpl {...locationContext} {...props} />}
  </Location>
)

// ...

```

`<RouterImpl>` will look for a page match and render that page. That's basically how it works!

<!-- ### File structure

While `router.js` is where most of the logic is, the logic's pretty spread:

| File                                                                                                  | Description                                                    |
| :---------------------------------------------------------------------------------------------------- | :------------------------------------------------------------- |
| [history.js](https://github.com/redwoodjs/redwood/blob/main/packages/router/src/history.js)           | Setup for client-side routing via the history push-state API   |
| [index.d.ts](https://github.com/redwoodjs/redwood/blob/main/packages/router/src/index.d.ts)           | Types!                                                         |
| [index.js](https://github.com/redwoodjs/redwood/blob/main/packages/router/src/index.js)               | Exports the user can use                                       |
| [internal.js](https://github.com/redwoodjs/redwood/blob/main/packages/router/src/internal.js)         | Exports for internal use between files                         |
| [links.js](https://github.com/redwoodjs/redwood/blob/main/packages/router/src/links.js)               | The <Link to={...}> component                                  |
| [location.js](https://github.com/redwoodjs/redwood/blob/main/packages/router/src/location.js)         | The location api                                               |
| [named-routes.js](https://github.com/redwoodjs/redwood/blob/main/packages/router/src/named-routes.js) | The named routes function (should go to build time!)           |
| [page-loader.js](https://github.com/redwoodjs/redwood/blob/main/packages/router/src/page-loader.js)   | Loads pages on a match!                                        |
| [params.js](https://github.com/redwoodjs/redwood/blob/main/packages/router/src/params.js)             | Context and...                                                 |
| [router.js](https://github.com/redwoodjs/redwood/blob/main/packages/router/src/router.js)             | Where most of the code is                                      |
| [splash-page.js](https://github.com/redwoodjs/redwood/blob/main/packages/router/src/splash-page.js)   | The page you see when you run `yarn rw dev` for the first time |
| [util.js](https://github.com/redwoodjs/redwood/blob/main/packages/router/src/util.js)                 | Utils for stuff like matching routes                           |


### Utils

Utils is mostly param-based. Most of the router logic is matching and providing context. So there's a lot of functions around it.

- createNamedContext
- coreParamTypes
- matchPath
- paramsForRoute
- parseSearch
- replaceParams
- validatePath

### Redwood Router vs Others

## FAQ -->