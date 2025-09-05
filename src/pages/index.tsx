"use client"

import { Suspense, useEffect } from 'react'
import { useRouter } from 'waku'
import { useAtomValue } from 'jotai'
import { Reader } from '../Components/FileReader'
import { Map } from '../Map'

export default function HomePage() {
  return (
    <Suspense fallback={<p>Loading...</p>}>
      <div className="flex h-screen flex-col">
        {/* <Navbar /> */}
        {/* <TwoCanvas /> */}
        <Map />

      </div>
    </Suspense>
  )
}
