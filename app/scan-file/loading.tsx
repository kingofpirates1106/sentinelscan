export default function LoadingScanFilePage() {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
      <div className="space-y-8 animate-pulse">
        <div className="space-y-2">
          <div className="h-10 w-56 bg-neutral-800 rounded" />
          <div className="h-4 w-80 bg-neutral-900 rounded" />
        </div>
        <div className="p-6 rounded-lg border border-neutral-800 bg-neutral-900/40 space-y-4">
          <div className="h-4 w-32 bg-neutral-800 rounded" />
          <div className="h-36 w-full bg-neutral-800 rounded" />
          <div className="h-11 w-full bg-neutral-800 rounded" />
        </div>
      </div>
    </div>
  )
}
