'use client'
import React, { useEffect, useState } from 'react'
import { getPracticeListScheduled, getRecentlyPracticed } from './queries'
import { Tune } from './types'
import { CircularProgress, Box, Tab, Tabs, Typography } from '@mui/material'
import { josefinSans } from '@/app/layout'

import ScheduledTunesGrid from './components/ScheduledTunesGrid';
import RecentlyPracticed from './components/RecentlyPracticed';
import WarmUpTimer from './components/WarmUpTimer'

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

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

  /////ORIGINAL RETURN BLOCK/////

  // return (  
  //   <>
  //     <Box sx={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', mx: 4}}>
  //       <h1 className={josefinSans.className}>tunetrees</h1>
  //       <WarmUpTimer />
  //     </Box>
  //     <Box sx={{m: 4}}>
  //       {scheduled ? <ScheduledTunes tunes={scheduled} /> : <CircularProgress />}
  //       <Box sx={{height: 20}}></Box>
  //       {recentlyPracticed ? <RecentlyPracticed tunes={recentlyPracticed} /> : <CircularProgress />}
  //     </Box>
  //   </>
  // )

  /////TABS START HERE/////

  function CustomTabPanel(props: TabPanelProps) {
    const { children, value, index, ...other } = props;
  
    return (
      <div
        role="tabpanel"
        hidden={value !== index}
        id={`simple-tabpanel-${index}`}
        aria-labelledby={`simple-tab-${index}`}
        {...other}
      >
        {value === index && (
          <Box sx={{ p: 3 }}>
            <Typography>{children}</Typography>
          </Box>
        )}
      </div>
    );
  }
  
  const [tabValue, setTabValue] = React.useState(0);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };
  
  return (
    <>
      <Box sx={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', mx: 4}}>
         <h1 className={josefinSans.className}>tunetrees</h1>
         <WarmUpTimer />
      </Box>
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
      <Tabs value={tabValue} onChange={handleTabChange} aria-label="basic tabs example">
        <Tab label="Scheduled for Practice"  />
        <Tab label="Recently Practiced" />
      </Tabs>
      </Box>
      <CustomTabPanel value={tabValue} index={0}>
        {scheduled ? <ScheduledTunesGrid tunes={scheduled} /> : <CircularProgress />}
      </CustomTabPanel>
      <CustomTabPanel value={tabValue} index={1}>
        {recentlyPracticed ? <RecentlyPracticed tunes={recentlyPracticed} /> : <CircularProgress />}
      </CustomTabPanel>
    </>
  )

}