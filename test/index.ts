import test from 'node:test'
import * as p from '../lib/index'
import assert from 'node:assert'


test('basic', () => {

    let state = {
        schedules: [
            {
                schedule_id: 1,
                schedule_name: 'Cool',
                schedule_versions: [
                    {
                        schedule_id: 1,
                        schedule_version_id: 2,
                        schedule_priority: 'Cost',
                    },
                ],
            },
        ],
    }

  const updated = p.update(state, x => {
   
    if (x.schedules[0].schedule_name === 'Cool') {
      x.schedules[0].schedule_name = 'Wow'
      assert.equal(x.schedules[0].schedule_name, 'Cool', 'mutation deferred')
    }
    
    if ('schedule_versions' in x.schedules[0] ){
      const y = x.schedules[0]
      const copy = y.schedule_versions
  
      delete (y as any).schedule_versions
      y.schedule_versions = copy
    }
  
    x.schedules[0].schedule_versions.unshift({ 
        schedule_id: x.schedules[0].schedule_id,
        schedule_version_id: 0,
        schedule_priority: 'Time'
    })
    x.schedules[0].schedule_versions.unshift({
      ...x.schedules[0].schedule_versions.at(0),
      schedule_version_id: x.schedules[0].schedule_versions[0].schedule_version_id
    } as any);

    (x as any).people = ['James'];
    assert.throws(() => {
      (x as any).people.shift();
    },/Cannot read properties of undefined/)
    

    x.schedules.forEach( x => {
      x.schedule_id = Math.random()
      x.schedule_versions.forEach( y => {
        y.schedule_id = x.schedule_id
        y.schedule_version_id = Math.random()

      })
    })

    const ref = x.schedules[0]

    const spread = { ...ref };

    (spread as any).newProperty = true;
    assert.equal((spread as any).newProperty, true, 'Assigning to a non proxy here, so it takes affect, but will not actually affect the original');
    (spread.schedule_versions[0] as any).newProperty = true;

    assert(p.hasOriginal(spread.schedule_versions[0]))
    assert.equal((spread.schedule_versions[0] as any).newProperty, undefined, 'items within version array are still proxies');


    assert.throws(() => {
      (x as any).a.b.c.d.e = 2
    }, /Cannot read properties of undefined/, 'Cannot reference data that does not exist')

    return x
  })

  assert.notEqual((updated.schedules[0] as any), true, 'Mutation of spread did nothing')
  assert.equal((updated.schedules[0].schedule_versions[0] as any).newProperty, true, 'Mutation of proxy was applied')

  assert.deepEqual( (updated as any).people, [ 'James' ])
  assert.notEqual( updated.schedules[0].schedule_id, 1, 'Mutation applied' )
  assert.equal( updated.schedules[0].schedule_versions[0].schedule_id, 1, 'Reference to immutable property, mutation ignored')
  assert.notEqual( updated.schedules[0].schedule_versions[0].schedule_version_id, 2, 'Mutation applied')
  
})

test('recorder', () => {
  let state = { a: 1, b: [ 1, 2, 3 ], c: [ { a: 1 }, { a: 2 }, { a: 3 } ] }

  let { proxy, patches } = p.recorder(state)

  let original = proxy.b.sort( (a,b) => b - a )

  assert.deepEqual(original, [1,2,3], 'unchanged as yet')

  assert(patches.length == 1)
  assert(patches[0].op === 'arrayMethod')
  assert(patches[0].target.name === 'sort')
  assert(patches[0].args.length === 1)
  assert.equal(patches[0].args[0].toString(), `${(a:number,b:number) => b - a}`)

  const updated = p.applyPatches(patches, state)

  assert.deepEqual(updated.b, [3,2,1])
  assert.deepEqual(state.b, [1,2,3])
  assert.strictEqual(original, state.b)
  
})

test('array methods: map', () => {
  let state = { 
    a: 1, simple: [ 1, 2, 3 ], complex: [ { a: 1 }, { a: 2 }, { a: 3 } ] 
  }

  {
    let updated = p.update(state, x => {
      {
        const out = x.simple.map( x => x * 2 )
        assert.deepEqual(out, [2,4,6], 'map simple')
      }
  
      {
        const out = x.complex.map( x => {
          x.a *= 2
          return x
        } )
        assert.deepEqual(out, [ { a: 1 }, { a: 2 }, { a: 3 } ], 'map complex: no modifications in update')
      }
  
    })
    assert.deepEqual(updated.complex, [ { a: 2 }, { a: 4 }, { a: 6 } ], 'map complex: modification occurred after update')
  }

  {
    let updated = p.update(state, x => {
   
      {
        const out = x.complex.map( x => {
          
          return { ...x, a: 100 }
        })
        assert.deepEqual(out, [ { a: 100 }, { a: 100 }, { a: 100 } ], 'map complex: new objects returned in update')

        x.complex = out
      }
  
    })
    assert.deepEqual(updated.complex, [ { a: 100 }, { a: 100 }, { a: 100 } ], 'map complex: replacing list successful')
  }
})

test('array methods: find', () => {
  let state = { 
    a: 1, simple: [ 1, 2, 3 ], complex: [ { a: 1 }, { a: 2 }, { a: 3 } ] 
  }

  p.update(state, state => {
    const found = state.complex.find( x => x.a === 2)

    assert.deepEqual(found, { a: 2 }, 'find works')
  })

  {
    const updated = p.update(state, state => {
      state.complex = []
  
      const found = state.complex.find( x => x.a === 2)
  
      assert.deepEqual(found, { a: 2 }, 'find works even when list emptied')
    })
    assert.deepEqual(updated.complex, [], 'mutation occurred afterwards')
  }

  {
    const updated = p.update(state, state => {
   
  
      const found = state.complex.find( x => {

        x.a = 4
        return x.a === 2
      })
  
      assert.deepEqual(found, { a: 2 }, 'find works even when list emptied')
      assert.deepEqual(state.complex, [ { a: 1 }, { a: 2 }, { a: 3 } ])
    })
    assert.deepEqual(updated.complex,  [ { a: 4 }, { a: 4 }, { a: 3 } ], 'mutation occurred afterwards')
  }
})

test('mutation: custom clone', () => {
  let state = { 
    a: 1, simple: [ 1, 2, 3 ], complex: [ { a: 1 }, { a: 2 }, { a: 3 } ] 
  }

  let updated = p.update(state, state => {

    state.simple = [4,5,6]
    state.complex[2].a = 40000

  }, {
    // mutable
    clone: x => x
  })


  assert.strictEqual(state, updated)
  assert.strictEqual(state.simple, updated.simple)
  assert.strictEqual(state.complex, updated.complex)
})

test('replace', () => {
  let state = { 
    a: 1, simple: [ 1, 2, 3 ], complex: [ { a: 1 }, { a: 2 }, { a: 3 } ] 
  }

  function f(x: { a: number }): void {
    p.replace(x, { a: 100 })
  }
  
  let updated = p.update(
    state,
    x => {
      let ref = x.complex[0]

      f(ref)
    }
  )

  assert.equal(updated.complex[0].a, 100)
})