export default function AdminHomePage() {
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-hairline bg-white p-6 shadow-card">
        <h2 className="text-xl font-semibold text-text-primary">Welcome</h2>
        <p className="mt-2 text-sm text-text-secondary">
          Use the “Users” and “Engines” sections to review member activity, wallet balances, receipts, and to toggle
          engines on or off. Only accounts granted the admin role can access these tools.
        </p>
      </section>
    </div>
  );
}
