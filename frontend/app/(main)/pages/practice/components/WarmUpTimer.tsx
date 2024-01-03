import { Box, Button } from '@mui/material'
import React, { useState } from 'react'
import { CountdownCircleTimer } from 'react-countdown-circle-timer'

export default function WarmUpTimer() {

    const [playing, setIsPlaying] = useState<boolean>(false)
    const [endOfCountdown, setEndOfCountdown] = useState<boolean>(false)

  return (
    <Box sx={{display: "flex", justifyContent: "flex-end", alignItems: 'center', height: "20vh"}}>
        {endOfCountdown ? "You're warmed up!" : 
        <>
          <Button sx={{mr: 2, height: 32}} onClick={() => setIsPlaying(!playing)}>{playing ? "Stop Warm-up" : "Start Warm-up"}</Button>
          <CountdownCircleTimer
          isPlaying={playing}
          duration={300}
          colors={['#FF5733', '#FF954D', '#FF849E', '#FF2956']}
          colorsTime={[7, 5, 2, 0]}
          >
          {({ remainingTime }) => {
              const minutes = Math.floor(remainingTime / 60)
              const seconds = (remainingTime % 60).toString().padStart(2, '0')

              if (minutes === 0 && seconds === "00") setEndOfCountdown(true)

              return `${minutes}:${seconds}`
          }}
          </CountdownCircleTimer>
        </>}
    </Box>
  )
}
