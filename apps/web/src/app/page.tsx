import { HealthStatus } from '@/components/health-status';

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-6 py-16">
      <section className="w-full max-w-2xl rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm sm:p-12">
        <div className="mb-10 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-indigo-600 text-sm font-semibold text-white">
              DR
            </div>
            <span className="font-medium text-zinc-950">Secure Data Room</span>
          </div>
          <HealthStatus />
        </div>

        <p className="mb-3 text-sm font-medium text-indigo-600">
          Foundation ready
        </p>
        <h1 className="max-w-xl text-4xl font-semibold tracking-tight text-zinc-950 sm:text-5xl">
          A secure place for high-stakes documents.
        </h1>
        <p className="mt-5 max-w-xl text-base leading-7 text-zinc-600">
          The Next.js frontend and NestJS API are connected. Authentication,
          rooms, folders, files, and sharing will be added in the next slices.
        </p>
      </section>
    </main>
  );
}
