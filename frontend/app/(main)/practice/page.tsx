'use client'
import React, { useEffect, useState } from 'react'
import { getPracticeListScheduled, getRecentlyPracticed } from './queries'
import { Tune } from './types'
import { CircularProgress, Box } from '@mui/material'

import ScheduledTunes from './ScheduledTunes';
import RecentlyPracticed from './RecentlyPracticed';

export default function Practice() {

  let [scheduled, setScheduled] = useState<Tune[]>()
  let [recentlyPracticed, setRecentlyPracticed] = useState<Tune[]>()

  useEffect(() => {
    const getScheduled = async () => {
      const data = await getPracticeListScheduled()
      setScheduled(data)
    }
    getScheduled()
  }, [])

  useEffect(() => {
    const getRecent = async () => {
      const data = await getRecentlyPracticed()
      setRecentlyPracticed(data)
    }
    getRecent()
  }, [])


  return (
    <>
      {scheduled ? <ScheduledTunes tunes={scheduled} /> : <CircularProgress />}
      <Box sx={{height: 20}}></Box>
      {recentlyPracticed ? <RecentlyPracticed tunes={recentlyPracticed} /> : <CircularProgress />}
    </>
  )
}
