export default function LoadingInsightsPage() {
  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <div className="space-y-12 animate-pulse">
        <div className="h-10 w-64 bg-neutral-800 rounded" />
        <div className="h-4 w-[420px] bg-neutral-900 rounded" />
        <div className="h-[320px] rounded-2xl border border-neutral-800 bg-neutral-900/50" />
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
          <div className="h-72 rounded-2xl border border-neutral-800 bg-neutral-900/50" />
          <div className="h-72 rounded-2xl border border-neutral-800 bg-neutral-900/50" />
          <div className="h-72 rounded-2xl border border-neutral-800 bg-neutral-900/50" />
        </div>
      </div>
    </div>
  )
}
