import { useState } from "react";
import { supabase } from "../services/supabase";

function AppHeader({ page, onNavigate, darkMode, onToggleDarkMode }) {
  const [menuOpen, setMenuOpen] = useState(false);

  const navigation = [
    ["dashboard", "🏠", "Dashboard"],
    ["new-bill", "➕", "New Bill"],
    ["bills", "🧾", "Bills"],
    ["customers", "👥", "Customers"],
    ["products", "📦", "Products"],
    ["payments", "💰", "Payments"],
    ["reports", "📊", "Reports"],
  ];

  function navigate(id) {
    setMenuOpen(false);
    onNavigate(id);
  }

  async function logout() {
    setMenuOpen(false);
    await supabase.auth.signOut();
  }

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

        <div className="flex min-h-[72px] items-center justify-between gap-3">

          {/* BRAND */}
          <button
            type="button"
            onClick={() => navigate("dashboard")}
            className="flex min-w-0 items-center gap-3 text-left"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-green-100 text-xl dark:bg-green-900/40">
              🌾
            </div>

            <div className="min-w-0">
              <h1 className="truncate text-sm font-bold text-slate-900 dark:text-white sm:text-base">
                धनपुरा किसान सेवा केन्द्र
              </h1>

              <p className="text-xs text-slate-500 dark:text-slate-400">
                Billing System
              </p>
            </div>
          </button>

          {/* DESKTOP NAV */}
          <nav className="hidden items-center gap-1 xl:flex">
            {navigation.map(([id, icon, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => navigate(id)}
                className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                  page === id
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                }`}
              >
                <span className="mr-1.5">{icon}</span>
                {label}
              </button>
            ))}
          </nav>

          {/* RIGHT ACTIONS */}
          <div className="flex shrink-0 items-center gap-2">

            <button
              type="button"
              onClick={onToggleDarkMode}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              title={darkMode ? "Light mode" : "Dark mode"}
            >
              {darkMode ? "☀️" : "🌙"}
              <span className="ml-1 hidden sm:inline">
                {darkMode ? "Light" : "Dark"}
              </span>
            </button>

            <button
              type="button"
              onClick={logout}
              className="hidden rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700 sm:block"
            >
              Logout
            </button>

            <button
              type="button"
              onClick={() => setMenuOpen((value) => !value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-lg text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 xl:hidden"
              aria-label="Toggle navigation"
            >
              {menuOpen ? "✕" : "☰"}
            </button>
          </div>
        </div>

        {/* MOBILE NAV */}
        {menuOpen && (
          <div className="border-t border-slate-200 py-3 dark:border-slate-800 xl:hidden">
            <nav className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {navigation.map(([id, icon, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => navigate(id)}
                  className={`rounded-lg px-3 py-3 text-left text-sm font-semibold ${
                    page === id
                      ? "bg-blue-600 text-white"
                      : "bg-slate-50 text-slate-700 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                  }`}
                >
                  <span className="mr-2">{icon}</span>
                  {label}
                </button>
              ))}
            </nav>

            <button
              type="button"
              onClick={logout}
              className="mt-2 w-full rounded-lg bg-red-600 px-4 py-3 text-sm font-semibold text-white hover:bg-red-700 sm:hidden"
            >
              Logout
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

export default AppHeader;