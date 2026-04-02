import { redirect } from 'next/navigation'

export default async function AuthIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>
}) {
  const { mode } = await searchParams

  if (mode === 'signup') {
    redirect('/auth/sign-up')
  }

  redirect('/auth/login')
}

