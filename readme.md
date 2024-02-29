# 🛡️impervious 

⭐A simple and strict proxy for state management. 

> ⚠️ Note this library is very new and likely has bugs.  We don't recommend you using this in production until we've dogfooded it a bit more.


## Quick Start

```bash
npm install impervious@next
```

```typescript
import * as impervious from 'impervious'

let state = {
	users: [{ id: 1, name: 'James' }]
}

state = impervious.update( state, x => {
	x.users.push({ id: 2, name: 'John' })

	console.log(x.users)
	// logs [{ id: 1, name: 'James' }]

	// mutation is recorded, but typescript won't be happy :)
	(state as any).willWork = true

	// will crash, state.a is undefined
	state.a.b.c.d = 4
})

console.log(state.users)
// logs [{ id: 1, name: 'James' }, { id: 2, name: 'John' }]
```


## What? 😵

*`impervious`* wraps a javascript object in a proxy in order to track changes and to make immutable updates easier to write.

*`impervious`* is far stricter than other proxy state management libries:  Any modifications within a patch are deferred until after the patch is complete, and there is no simulation within the patch function of your modifications at all.

## Why? ⚙️

Proxies are a very leaky abstraction.  It is hard to achieve a perfect mimick of a real JS object, and doing so adds to the complexity of the library and hurts performance.  It also makes it harder to explain to a team what patterns to use and what patterns should be avoided.

While other state proxy libraries tend to support Vanilla.js™️ (and other frameworks) their documentation and API tends to have a bias towards React's API which makes it harder to learn and use outside of a React context.

*`impervious`* does not care what view framework you use, it provides everything you need to perform immutable updates on well structured data, and it does not try to create a perfect total abstraction, instead it treats your state as completely impervious to changes within a patch, recording your changes but not simulating them at all during the patch.

## Atomic and Reliable 💪

Within a call to `update` any changes you make to the proxy are not applied.  We simply record the mutations and apply them in order after the update function has completed.

The reasoning behind this is that it is extraordinarily difficult to make a JS proxy truly imitate a JS object.  Instead of treading carefully into the uncanny valley we instead acknowledge the proxy can never truly fake the real thing, instead it is a nice affordance to make complex immutable updates feel mutable.

An **`impervious`** proxy has very predictable and limited behaviour.  By way of example, here is a list of things impervious doesn't even try to imitate. 

- If you `delete` a property from an object, the deleted property will still be there during the update
- If you `push` an item into a list, it won't be there until after the patch is complete
- If you call `shift` you will mutate the list after the patch, but `shift` will always return the first item within that update function.
- If you assign a property, it won't be there until after the patch is complete.
- *`impervious`* only works with plain old JS objects, no sets, or maps etc
- If you reverse or sort an array, you will get back the unmodified array within the patch

Think of the object you are interacting with as a completely immutable frozen object.  Any change you make will not be visible within that transaction.  But all changes / operations are recorded and are applied naively after the patch is complete.

This simple rule makes the internal logic so much simpler, it is also simple to internalize than the numerous edge cases that would otherwise occur.

## Accessing undefined data

*`impervious`* is also designed to work with typed well-structured data.  If you reference a field that doesn't exist on your object, the handler will crash.

While it is possible to have a proxy that recurses infinitely and permits accessing inaccessible properties, you need to immediately take into account certain trade-offs.  If you reference a property that doesn't exist, what should the new default value be?  Should it be an array, an object, a primative value?  Can it be inferred from the path, maybe sometimes, but not always.

This library is for easily immutably updating well structured data, no more, no less.

## API

### `impervious.update`

```typescript
function update<T extends object>(state: T, f: (x: T) => void, options: { clone?: <T>(x:T) => T }): T
```

The only export you need to use the library, pass in `state` and an update function `f`, and you will get back a new `state` object where every mutation within the update function was performed immutably.

## Advanced API

From here on in, the rest of the API is for advanced use cases, you really probably only need `update` for most use cases.

### `impervious.recorder`

```typescript
export type PathSegment = { op: 'get'; value: string }

export type Path = PathSegment[]

export type Patch =
	| { op: 'delete'; prop: string; path: Path }
	| { op: 'set'; prop: string; path: Path; value: any }
	| {
		op: 'method'
		path: Path
		thisArg: any
		args: any[]
		target(this: any, ...args: any[]): any
	  }

function recorder<T extends object>(
	state: T,
	patches: Patch[] = [],
	path: Path = [],
) : { proxy: T, patches: Patch[], path: Path }
```

An internal util that wraps an object in a proxy.  The returned proxy is typed as `T` even though it is in fact `ProxyHandler<T>` but it is more useful to pretend the proxy is the object when working with typescript, so we make it easy to do just that.

As you access child properties you will get back a `recorder` instance except if the value you are accessing is a primative value, or a symbol.

The patches array returned is mutably updated by each recursively created recorder so you can always inspect the mutations performed from any recorder child instance by inspecting the root `patches` array.

The `path` is currently just an object representation of property names referenced.  But in future we may include function calls that should return a proxy such as `.at(0)`.

### `hasOriginal` and `getOriginal`

```typescript
const originals = new WeakMap<ProxyAny, OriginalAny>()

export const hasOriginal = (x:any) => originals.has(x)
export const getOriginal = (x:any) => originals.get(x)
```

Every time a `proxy` is created we store the `original` value in a publicly exposed `WeakMap`.

This allows you to know reliably if you are dealing with a proxy or a real object (via `hasOriginal(value)`).

And you can "unwrap" the proxy via `getOriginal(value)`

### `applyPatch`

```typescript
export function applyPatch<T extends object>(patch: Patch, state: T, cloneFn?: <T>(x:T) => T): T
```

Apply a single `Patch` to `state`, returns a new `state` object of the same type `T`

### `applyPatches`

```typescript
export function applyPatches<T extends object>(patches: Patch[], state: T, cloneFn?: <T>(x:T) => T): T
```

Apply a list of `Patch`'s to `state`, returns a new `state` object of the same type `T`

## Mutation / Clone

You can customize how the library shallow clones objects and arrays, if you set `options.clone` to `x => x` *`impervious`* will use mutation which can give you a big perf boost if you aren't needing immutable for a specific part of your app but just want controlled mutation.

You may want to use the lower level `recorder` api, to generate your own undo/redo system but you don't mind if `applyPatches` actually mutates the record.


## Contributing

We absolutely welcome and appreciate contributions.

To get started create an issue before doing any work to see if your patch is likely to be merged.

To get starting developing, just run `npm install` and `npm run dev` to run the tests in watch mode.

## Other libraries you may want to use instead

- https://github.com/immerjs/immer
- https://github.com/pmndrs/valtio
- https://github.com/pmndrs/zustand