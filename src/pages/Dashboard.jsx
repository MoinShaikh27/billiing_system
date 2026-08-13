import { useEffect, useState } from "react";
import { supabase } from "../services/supabase";
import jokesText from "./hindi-jokes.txt?raw";
function Dashboard({
  user,
  onProducts,
  onCustomers,
  onNewBill,
  onBills,
  onReports,
  onPayments,
  darkMode,
  onToggleDarkMode,
}) {
  const [stats, setStats] = useState({
    bills: 0,
    customers: 0,
    products: 0,
    todaySales: 0,
  });

  const [loading, setLoading] = useState(true);

  const [dailyJoke, setDailyJoke] = useState("");
  const [jokeLoading, setJokeLoading] = useState(true);

  // ============================================================
  // DAILY HINDI JOKE
  // ============================================================
  useEffect(() => {
    async function loadJoke() {
      try {
        setJokeLoading(true);

        const today = new Date().toISOString().split("T")[0];

        const savedJoke = localStorage.getItem("dailyHindiJoke");
        const savedDate = localStorage.getItem("dailyHindiJokeDate");

        // Use today's saved joke if available
        if (savedJoke && savedDate === today) {
          setDailyJoke(savedJoke);
          setJokeLoading(false);
          return;
        }

        const response = await fetch(
          "https://hindi-jokes-api.onrender.com/jokes"
        );

        if (!response.ok) {
          throw new Error("Failed to fetch Hindi joke.");
        }

        const data = await response.json();

        const joke =
          data?.jokeContent ||
          data?.joke ||
          data?.content ||
          "आज मुस्कुराना मत भूलिए! 😄";

        setDailyJoke(joke);

        // Save today's joke
        localStorage.setItem("dailyHindiJoke", joke);
        localStorage.setItem("dailyHindiJokeDate", today);
      } catch (error) {
        console.error("Joke API error:", error);

        // Use previously saved joke if API is unavailable
        const savedJoke = localStorage.getItem("dailyHindiJoke");

       const fallbackJokes = jokesText
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean)
          .map((line) => line.replace(/^\d+\.\s*/, "").trim())
          .filter(Boolean);

          const randomJoke =
            fallbackJokes[
              Math.floor(Math.random() * fallbackJokes.length)
            ];

          setDailyJoke(savedJoke || randomJoke);
      } finally {
        setJokeLoading(false);
      }
    }

    loadJoke();
  }, []);

  // ============================================================
  // LOAD DASHBOARD DATA
  // ============================================================
  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      try {
        setLoading(true);

        if (!user?.id) return;

        const [customers, products, bills] =
          await Promise.all([
            supabase
              .from("customers")
              .select("id", {
                count: "exact",
                head: true,
              })
              .eq("user_id", user.id),

            supabase
              .from("products")
              .select("id", {
                count: "exact",
                head: true,
              })
              .eq("user_id", user.id),

            supabase
              .from("invoices")
              .select("id", {
                count: "exact",
                head: true,
              })
              .eq("user_id", user.id),
          ]);

        if (customers.error) throw customers.error;
        if (products.error) throw products.error;
        if (bills.error) throw bills.error;

        const today = new Date();

        const startOfDay = new Date(
          today.getFullYear(),
          today.getMonth(),
          today.getDate()
        );

        const startOfTomorrow = new Date(
          today.getFullYear(),
          today.getMonth(),
          today.getDate() + 1
        );

        const {
          data: todayBills,
          error: salesError,
        } = await supabase
          .from("invoices")
          .select("total_amount")
          .eq("user_id", user.id)
          .gte(
            "created_at",
            startOfDay.toISOString()
          )
          .lt(
            "created_at",
            startOfTomorrow.toISOString()
          );

        if (salesError) throw salesError;

        const todaySales = (todayBills || []).reduce(
          (sum, bill) =>
            sum + Number(bill.total_amount || 0),
          0
        );

        if (!cancelled) {
          setStats({
            bills: bills.count || 0,
            customers: customers.count || 0,
            products: products.count || 0,
            todaySales,
          });
        }
      } catch (error) {
        console.error(
          "Dashboard error:",
          error
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadDashboard();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  // ============================================================
  // STAT CARDS
  // ============================================================
  const statCards = [
    {
      title: "Bills",
      value: stats.bills,
      icon: "🧾",
      iconBg:
        "bg-blue-100 dark:bg-blue-500/15",
      iconText:
        "text-blue-600 dark:text-blue-400",
    },
    {
      title: "Customers",
      value: stats.customers,
      icon: "👥",
      iconBg:
        "bg-purple-100 dark:bg-purple-500/15",
      iconText:
        "text-purple-600 dark:text-purple-400",
    },
    {
      title: "Products",
      value: stats.products,
      icon: "📦",
      iconBg:
        "bg-orange-100 dark:bg-orange-500/15",
      iconText:
        "text-orange-600 dark:text-orange-400",
    },
    {
      title: "Today's Sales",
      value: `₹${stats.todaySales.toFixed(2)}`,
      icon: "💰",
      iconBg:
        "bg-emerald-100 dark:bg-emerald-500/15",
      iconText:
        "text-emerald-600 dark:text-emerald-400",
      sales: true,
    },
  ];

  // ============================================================
  // QUICK ACTIONS
  // ============================================================
  const actions = [
    {
      label: "New Bill",
      icon: "＋",
      action: onNewBill,
      className:
        "from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700",
    },
    {
      label: "Customers",
      icon: "👥",
      action: onCustomers,
      className:
        "from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700",
    },
    {
      label: "Products",
      icon: "📦",
      action: onProducts,
      className:
        "from-indigo-500 to-blue-600 hover:from-indigo-600 hover:to-blue-700",
    },
    {
      label: "Bills",
      icon: "🧾",
      action: onBills,
      className:
        "from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700",
    },
    {
      label: "Reports",
      icon: "📊",
      action: onReports,
      className:
        "from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700",
    },
    {
      label: "Payments",
      icon: "💳",
      action: onPayments,
      className:
        "from-cyan-500 to-teal-600 hover:from-cyan-600 hover:to-teal-700",
    },
  ];

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 transition-colors duration-300 dark:bg-[#111827] dark:text-white">

      {/* ========================================================
          MAIN
      ======================================================== */}
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">

        {/* ======================================================
            WELCOME SECTION
        ====================================================== */}
        <section className="relative mb-7 overflow-hidden rounded-2xl bg-gradient-to-br from-green-500 via-emerald-500 to-teal-600 p-6 text-white shadow-xl shadow-emerald-900/10 sm:p-8">

          <div className="relative z-10">

            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-green-100">
              <span className="rounded-full bg-white/15 px-3 py-1">
                Dashboard
              </span>
            </div>

            <h2 className="text-2xl font-bold sm:text-3xl">
              Welcome back! 👋
            </h2>

            <p className="mt-2 text-sm text-green-50 sm:text-base">
              {user?.email}
            </p>

            <p className="mt-4 max-w-xl text-sm leading-6 text-green-50/90">
              Manage your bills, customers, products and
              payments from one place.
            </p>

            {/* ==================================================
                DAILY HINDI JOKE
            ================================================== */}
            <div className="mt-6 max-w-xl rounded-xl border border-white/20 bg-white/10 p-4 shadow-sm backdrop-blur-sm">

              <div className="flex items-center gap-2">
                <span className="text-lg">
                  😄
                </span>

                <p className="text-xs font-bold uppercase tracking-wider text-yellow-200">
                  आज का मज़ेदार जोक
                </p>
              </div>

              <p className="mt-2 text-sm font-medium leading-6 text-white sm:text-base">
                {jokeLoading
                  ? "आज का जोक लाया जा रहा है... 😄"
                  : dailyJoke}
              </p>

            </div>
          </div>

          {/* DECORATIVE CIRCLES */}
          <div className="absolute -right-10 -top-16 h-56 w-56 rounded-full bg-white/10" />

          <div className="absolute -bottom-24 right-24 h-48 w-48 rounded-full bg-white/5" />

          <div className="absolute right-6 top-1/2 hidden -translate-y-1/2 text-7xl opacity-20 lg:block">
            🌾
          </div>
        </section>

        {/* ======================================================
            STATS
        ====================================================== */}
        <section className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">

          {statCards.map((card) => (
            <div
              key={card.title}
              className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-lg dark:border-slate-800 dark:bg-[#1e293b]"
            >
              <div className="flex items-start justify-between">

                <div>
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                    {card.title}
                  </p>

                  <div
                    className={`mt-2 text-2xl font-bold sm:text-3xl ${
                      card.sales
                        ? "text-emerald-500"
                        : "text-slate-900 dark:text-white"
                    }`}
                  >
                    {loading
                      ? "..."
                      : card.value}
                  </div>
                </div>

                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-xl text-xl ${card.iconBg} ${card.iconText} transition group-hover:scale-110`}
                >
                  {card.icon}
                </div>

              </div>

              <div className="mt-4 h-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div
                  className={`h-full w-2/3 rounded-full ${
                    card.sales
                      ? "bg-emerald-500"
                      : "bg-blue-500"
                  }`}
                />
              </div>
            </div>
          ))}
        </section>

        {/* ======================================================
            QUICK ACTIONS
        ====================================================== */}
        <section>

          <div className="mb-4 flex items-center justify-between">

            <div>
              <h2 className="text-xl font-bold">
                Quick Actions
              </h2>

              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Frequently used billing operations
              </p>
            </div>

          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">

            {actions.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={item.action}
                className={`group relative overflow-hidden rounded-2xl bg-gradient-to-r ${item.className} p-5 text-left text-white shadow-lg transition duration-200 hover:-translate-y-1 hover:shadow-xl`}
              >
                <div className="relative z-10 flex items-center justify-between">

                  <div className="flex items-center gap-4">

                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 text-xl backdrop-blur">
                      {item.icon}
                    </div>

                    <div>
                      <p className="text-base font-bold">
                        {item.label}
                      </p>

                      <p className="mt-0.5 text-xs text-white/75">
                        Open{" "}
                        {item.label.toLowerCase()}
                      </p>
                    </div>

                  </div>

                  <span className="text-xl transition-transform group-hover:translate-x-1">
                    →
                  </span>

                </div>

                <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-white/10" />
              </button>
            ))}

          </div>
        </section>

        {/* ======================================================
            FOOTER
        ====================================================== */}
        <footer className="mt-10 border-t border-slate-200 pt-5 text-center text-xs text-slate-400 dark:border-slate-700 dark:text-slate-500">
          धनपुरा किसान सेवा केन्द्र · Billing System
        </footer>

      </main>
    </div>
  );
}

export default Dashboard;