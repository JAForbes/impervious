export type PathSegment = { op: 'get'; value: string }

export type Path = PathSegment[]

export type Patch =
	| { op: 'delete'; prop: string; path: Path }
	| { op: 'set'; prop: string; path: Path; value: any }
	| {
			op: 'arrayMethod'
			path: Path
			thisArg: any
			args: any[]
			target(this: any, ...args: any[]): any
	  }

type ProxyAny = any
type OriginalAny = any


const originals = new WeakMap<ProxyAny, OriginalAny>()
const paths = new WeakMap<ProxyAny, Path>()
const parents = new WeakMap<ProxyAny, ProxyAny>()

export const hasOriginal = (x:any) => originals.has(x)
export const getOriginal = (x:any) => originals.get(x)

export const hasPath = (x:any) => paths.has(x)
export const getPath = (x:any) => paths.get(x)

export const hasParent = (x:any) => parents.has(x)
export const getParent = (x:any) => parents.get(x)

const supportedPureArrayMethods = new Set(['at', 'slice', 'concat', "entries", "includes", "join", "keys", "indexOf", "lastIndexOf", "toLocaleString", "toReversed", "toSorted", "toSpliced", "toString", "values"])
const supportedMutationArrayMethods = new Set(["fill", "pop", "push", "shift", "unshift", "splice", "sort", "reverse", "with"])
const supportedIterationArrayMethods = new Set(["forEach", "find", "filter", "findIndex", "findLast", "findLastIndex", "every", "some", "map", "flatMap"])

const returnValues = new Map<string, (...args: any[]) => any>(Object.entries({
	
	// mutation array methods
	fill: x => x,
	pop: xs => xs.at(-1),
	push: xs => xs.length,
	shift: xs => xs.at(0),
	unshift: xs => xs.length,
	splice: (xs, start, deleteCount) => xs.slice(start, deleteCount),
	sort: xs => xs,
	reverse: xs => xs,
	with: xs => xs,

}))

const replacementSymbol = Symbol('impervious/replace')

export function replace<T extends object>(source: T, replacement: T): void {
	if (originals.has(source)) {
		(source as any)[replacementSymbol] = replacement
	}
}

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
			const recording = recorder(got, patches, path.concat({ op: 'get', value: prop }))

			parents.set(recording.proxy, proxy)

			return recording
				.proxy
		},
		set(_, prop, value) {
			// if they assign a proxy, assign the "real" value
			// to prevent infinite loops
			if (originals.has(value)) {
				value = originals.get(value)
			}

			if (prop === replacementSymbol) {
				patches.push({
					path: path.slice(0, -1),
					prop: path.at(-1)!.value,
					value,
					op: 'set'
				})
				return true
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
				if (supportedPureArrayMethods.has(methodName)) {
					return Reflect.apply(target as any, thisArg, argumentsList)
				} else if ( supportedMutationArrayMethods.has(methodName) ) {
					patches.push({
						op: 'arrayMethod',
						path: path.slice(0, -1),
						args: argumentsList,
						thisArg,
						target: target as any,
					})

					if ( returnValues.has(methodName) ) {
						return returnValues.get(methodName)!(thisArg, ...argumentsList)
					}
					throw new Error('Unexpected missing return value for methodName' + methodName)
				} else if (supportedIterationArrayMethods.has(methodName)) {

					const [visitor, thisArg2] = argumentsList

					return ((thisArg2 ?? thisArg) as any[])[methodName as 'forEach']( (x, i, list) => {

						if ( Object(x) === x ) {
							const recording = recorder(x, patches, path.slice(0, -1).concat({
								op: 'get',
								value: `${i}`,
							}))

							parents.set(recording.proxy, proxy)
	
							return visitor(recording.proxy, i, list)
						} else {
							return visitor(x, i, list)
						}
					})
				}
			} else if (typeof target === 'object') {
				throw new Error('Unexpected method call ' + methodName + 'on simple object.')
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
	paths.set(proxy, path)
	return { proxy, patches, path }
}

function clone(child:any):any{
	return typeof child === 'function'
		? child
		: Array.isArray(child) ? child.slice() : { ...child }
}

export function applyPatch<T extends object>(patch: Patch, state: T, cloneFn=clone): T {
	let parent = cloneFn(state) as any
	state = parent
	let states: any[] = []
	for (let op of patch.path) {
		
		states.push(parent)
		let child = parent[op.value]

		if (child == null) {
			if (op.value.match(/^\d+$/)) {
				child = []
			} else {
				child = {}
			}
		} else {
			child = cloneFn(child)
		}

		parent[op.value] = child


		// now make the parent the child
		// so next loop we traverse down
		parent = child
	}

	if (patch.op === 'set') {
		parent[patch.prop] = patch.value
	}
	if (patch.op === 'delete') {
		delete (parent as any)[patch.prop]
	}
	if (patch.op === 'arrayMethod') {
		try {
			let self = cloneFn(patch.thisArg)
			
			patch.target.apply(self, patch.args)
			const key = patch.path.at(-1)!.value
			states.at(-1)[key] = self

		} catch (e) {
			console.error('error', e)
		}
	}
	return state
}

export function applyPatches<T extends object>(patches: Patch[], state: T, cloneFn=clone): T {
	for (let patch of patches) {
		state = applyPatch(patch, state, cloneFn)
	}

	return state
}

export function update<T extends object>(state: T, f: (x: T) => void, options: {
	clone?: typeof clone
}={}): T {
	const { proxy, patches } = recorder(state)

	f(proxy)
	return applyPatches(patches, state, options.clone)
}
