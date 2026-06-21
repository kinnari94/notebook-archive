import { NextResponse } from 'next/server'
import { getDb, COLLECTIONS } from '@/lib/db'

export async function GET() {
  const db = await getDb()
  const [
    incPeople,
    bkPerson,
    bkOtherPeople,
    incLocations,
    bkLocation,
    sampleBK,
    sampleInc,
  ] = await Promise.all([
    db.collection(COLLECTIONS.incidents).distinct('people'),
    db.collection(COLLECTIONS.bk_stories).distinct('person'),
    db.collection(COLLECTIONS.bk_stories).distinct('other_people'),
    db.collection(COLLECTIONS.incidents).distinct('locations'),
    db.collection(COLLECTIONS.bk_stories).distinct('location'),
    db.collection(COLLECTIONS.bk_stories).findOne({}, { projection: { person: 1, other_people: 1, location: 1, categories: 1, category: 1 } }),
    db.collection(COLLECTIONS.incidents).findOne({}, { projection: { people: 1, locations: 1, category: 1 } }),
  ])

  return NextResponse.json({
    incidents: {
      people_distinct: incPeople.slice(0, 10),
      locations_distinct: incLocations.slice(0, 10),
      sample: sampleInc,
    },
    bk_stories: {
      person_distinct: bkPerson.slice(0, 10),
      other_people_distinct: bkOtherPeople.slice(0, 10),
      location_distinct: bkLocation.slice(0, 10),
      sample: sampleBK,
    },
  })
}
