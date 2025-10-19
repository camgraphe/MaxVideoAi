export default function AdminHomePage() {
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg">
        <h2 className="text-xl font-semibold text-white">Welcome</h2>
        <p className="mt-2 text-sm text-slate-300">
          Use the “Users” and “Engines” sections to review member activity, wallet balances, receipts, and to toggle
          engines on or off. Only accounts granted the admin role can access these tools.
        </p>
      </section>
    </div>
  );
}
