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

    console.time('example')
  const updated = p.update(state, x => {
   
    if (x.schedules[0].schedule_name === 'Cool') {
      x.schedules[0].schedule_name = 'Wow'
      console.log(x.schedules[0].schedule_name)
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
    return x
  })
  console.timeEnd('example')

  assert.deepEqual( (updated as any).people, [ 'James' ])

  console.log(updated)
  console.log(updated.schedules[0].schedule_versions)
})