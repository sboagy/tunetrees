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

  tune
  return (
    <>
    <br />
    {scheduled && scheduled.map((tune, index) => {
      return (
        <div key={index}>
          {tune["tune_name"]}
          <br/>
          -----
          <br />
        </div>
      )
    })}
    </>
  )
}
