'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

function Content() {
  const searchParams = useSearchParams()
  const email = searchParams.get('email')

  return <div>{email}</div>
}

export default function Page() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <Content />
    </Suspense>
  )
}