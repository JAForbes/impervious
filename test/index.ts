import test from 'node:test'
import * as p from '../lib/index'
import assert from 'node:assert'


test('Example', () => {

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