import Link from 'next/link'

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ error: string }>
}) {
  const params = await searchParams

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-8 text-center">
        <div className="space-y-4">
          <div className="text-5xl mb-4">⚠️</div>
          <h1 className="text-3xl font-bold">
            Something Went Wrong
          </h1>
          {params?.error && (
            <p className="text-neutral-400 font-mono text-sm">
              Error: {params.error}
            </p>
          )}
          <p className="text-neutral-400">
            An authentication error occurred. Please try again.
          </p>
        </div>

        <div className="space-y-3">
          <Link
            href="/auth/login"
            className="block w-full px-6 py-3 rounded bg-white text-black hover:bg-neutral-200 transition font-medium"
          >
            Back to Sign In
          </Link>
          <Link
            href="/"
            className="block w-full px-6 py-3 rounded border border-neutral-700 hover:border-white transition"
          >
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  )
}
