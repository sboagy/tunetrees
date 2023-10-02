import React, { useEffect, useState } from 'react'
import { getPracticeListScheduled } from './queries'

export default function Practice() {

  let [scheduled, setScheduled] = useState<any>()

  useEffect(() => {
    //oh i HAVE To build a useQuery hook, i hate this
    const getScheduled = async () => {
      const data = await getPracticeListScheduled()
      console.log('DATA:', data)
      setScheduled(data)
    }
    getScheduled()
  }, [])

  return (
    <div>Here are the scheduled tunes: {scheduled || "Hmm."}</div>
  )
}
