'use client'
import { useEffect, useState } from "react"
import Practice from "./practice/page"

export default function Home() {


  let [greeting, setGreeting] = useState([])
  
  useEffect(() => {
    getGreeting("Boag")
  }, [])
  
  //I don't like how this is set up, we'll want a queries folder and everything, but for now let's see if it works! 
  let getGreeting = async (userName: string) => {
    let response = await fetch(`http://127.0.0.1:8000/hello/${userName}`)
    let data = await response.json()  
    setGreeting(data.message)
  }


  return (
    <div>
      {greeting}
      <br />
      --------
      <Practice />
    </div>
  )
}


