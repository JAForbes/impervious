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

type ProxyAny = any
type OriginalAny = any


const originals = new WeakMap<ProxyAny, OriginalAny>()

export const hasOriginal = (x:any) => originals.has(x)
export const getOriginal = (x:any) => originals.get(x)

export function recorder<T extends object>(
	state: T,
	patches: Patch[] = [],
	path: Path = [],
) : { proxy: T, patches: Patch[], path: Path } {
	// lie and say proxy is T, kind of the point of a proxy
	const proxy: T = new Proxy(state, {
		get(target, prop, receiver) {
			const got = Reflect.get(target, prop, receiver)

			if (got == null || Object(got) !== got || typeof prop === 'symbol') {
				
				return got
			}
			return recorder(got, patches, path.concat({ op: 'get', value: prop }))
				.proxy
		},
		set(_, prop, value) {
			// if they assign a proxy, assign the "real" value
			// to prevent infinite loops
			if (originals.has(value)) {
				value = originals.get(value)
			}
			// not sure about this one
			if (typeof prop === 'symbol') {
				return false
			}
			patches.push({
				path: path,
				prop,
				value,
				op: 'set',
			})
			return true
		},
		deleteProperty(target, prop) {
			// not sure about this one
			if (typeof prop === 'symbol') {
				return false
			}
			patches.push({
				path: path,
				prop,
				op: 'delete',
			})
			return true
		},
		apply(target, thisArg, argumentsList) {
			// can't apply the initial, so it won't be undefined
			const methodName = path.at(-1)!.value

			if (originals.has(thisArg)) {
				thisArg = originals.get(thisArg)
			}

			if (Array.isArray(thisArg)) {
				if (methodName === 'at' || methodName === 'indexOf' || methodName === 'slice' ) {
					return Reflect.apply(target as any, thisArg, argumentsList)
				}
				else if (methodName === 'unshift' || methodName === 'shift' ) {
					patches.push({
						op: 'method',
						path,
						args: argumentsList,
						thisArg,
						target: target as any,
					})
					return argumentsList.at(-1)
				} else if (methodName === 'forEach') {
					const [visitor, thisArg2] = argumentsList

					return ((thisArg2 ?? thisArg) as any[]).forEach( (x, i, list) => {

						const recording = recorder(x, patches, path.slice(0, -1).concat({
							op: 'get',
							value: `${i}`,
						}))

						visitor(recording.proxy, i, list)
					})
				} else if (methodName === 'push') {
				} else if (methodName === 'pop') {
				} else if (methodName === 'splice') {
				} else if (methodName === 'slice') {
				} else if (methodName === 'at') {
				} else if (methodName === 'map') {
				} else if (methodName === 'flatMap') {
				} else if (methodName === 'flat') {
				} else if (methodName === 'filter') {
				} else if (methodName === 'every') {
				} else if (methodName === 'some') {
				}
			} else if (typeof target === 'object') {
			}

			return null
		},
		// getPrototypeOf(...args){
		// return Reflect.getPrototypeOf(...args)
		// }
		// ,ownKeys(...args){
		// return Reflect.ownKeys(...args)
		// }
		// ,setPrototypeOf(){}
		// ,isExtensible(){}
		// ,preventExtensions(){}
		// ,getOwnPropertyDescriptor(){}
		// ,defineProperty(){}
	})

	originals.set(proxy, state)
	return { proxy, patches, path }
}

export function applyPatch<T extends object>(patch: Patch, state: T): T {
	let _state: any = state

	for (let op of patch.path) {
		let next: any = _state[op.value]

		if (next == null) {
			if (op.value.match(/^\d+$/)) {
				next = _state[op.value] = []
			} else {
				next = _state[op.value] = {}
			}
		}
		_state = next
	}

	if (patch.op === 'set') {
		_state[patch.prop] = patch.value
	}
	if (patch.op === 'delete') {
		delete _state[patch.prop]
	}
	if (patch.op === 'method') {
		try {
			patch.target.apply(patch.thisArg, patch.args)
		} catch (e) {
			console.error('error', e)
		}
	}
	return state
}

export function applyPatches<T extends object>(patches: Patch[], state: T): T {
	for (let patch of patches) {
		state = applyPatch(patch, state)
	}

	return state
}

export function update<T extends object>(state: T, f: (x: T) => void): T {
	const { proxy, patches } = recorder(state)

	f(proxy)
	return applyPatches(patches, state)
}
