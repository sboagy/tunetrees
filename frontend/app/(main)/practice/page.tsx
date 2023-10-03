'use client'
import React, { useEffect, useState } from 'react'
import { getPracticeListScheduled, getRecentlyPracticed } from './queries'
import { Tune } from './types'
import { CircularProgress, Box } from '@mui/material'
import { josefinSans } from '@/app/layout'

import ScheduledTunes from './components/ScheduledTunes';
import RecentlyPracticed from './components/RecentlyPracticed';
import WarmUpTimer from './components/WarmUpTimer'

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
      <Box sx={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', mx: 4}}>
        <h1 className={josefinSans.className}>tunetrees</h1>
        <WarmUpTimer />
      </Box>
      <Box sx={{m: 4}}>
        {scheduled ? <ScheduledTunes tunes={scheduled} /> : <CircularProgress />}
        <Box sx={{height: 20}}></Box>
        {recentlyPracticed ? <RecentlyPracticed tunes={recentlyPracticed} /> : <CircularProgress />}
      </Box>
    </>
  )
}
