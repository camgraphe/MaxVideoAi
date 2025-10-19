export default function AdminHomePage() {
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg">
        <h2 className="text-xl font-semibold text-white">Welcome</h2>
        <p className="mt-2 text-sm text-slate-300">
          Utilise les onglets « Users » et « Engines » pour superviser l’activité des membres, leurs wallets, leurs jobs
          et activer/désactiver les moteurs. Les actions sont limitées aux comptes avec le rôle admin.
        </p>
      </section>
    </div>
  );
}
