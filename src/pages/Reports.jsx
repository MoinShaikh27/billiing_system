import { useEffect, useState } from "react";
import { supabase } from "../services/supabase";

function Reports() {
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const [today, setToday] = useState({
    sales: 0,
    bills: 0,
    received: 0,
    outstanding: 0,
  });

  const [month, setMonth] = useState({ sales: 0, bills: 0 });
  const [topProducts, setTopProducts] = useState([]);
  const [outstandingCustomers, setOutstandingCustomers] = useState([]);

  useEffect(() => {
    let cancelled = false;

    async function loadReports() {
      try {
        setLoading(true);
        setMessage("");

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) throw userError;
        if (!user) throw new Error("User session not found.");

        const now = new Date();

        // TODAY
        const startOfToday = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate()
        );

        const startOfTomorrow = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate() + 1
        );

        const { data: todayBills, error: todayError } =
          await supabase
            .from("invoices")
            .select(
              "id, total_amount, paid_amount, balance_amount"
            )
            .eq("user_id", user.id)
            .gte("created_at", startOfToday.toISOString())
            .lt("created_at", startOfTomorrow.toISOString());

        if (todayError) throw todayError;

        const todayData = todayBills || [];

        const todaySales = todayData.reduce(
          (sum, bill) =>
            sum + Number(bill.total_amount || 0),
          0
        );

        const todayReceived = todayData.reduce(
          (sum, bill) =>
            sum + Number(bill.paid_amount || 0),
          0
        );

        const todayOutstanding = todayData.reduce(
          (sum, bill) =>
            sum + Number(bill.balance_amount || 0),
          0
        );

        // MONTH
        const startOfMonth = new Date(
          now.getFullYear(),
          now.getMonth(),
          1
        );

        const startOfNextMonth = new Date(
          now.getFullYear(),
          now.getMonth() + 1,
          1
        );

        const { data: monthBills, error: monthError } =
          await supabase
            .from("invoices")
            .select("id, total_amount")
            .eq("user_id", user.id)
            .gte(
              "created_at",
              startOfMonth.toISOString()
            )
            .lt(
              "created_at",
              startOfNextMonth.toISOString()
            );

        if (monthError) throw monthError;

        const monthData = monthBills || [];

        const monthSales = monthData.reduce(
          (sum, bill) =>
            sum + Number(bill.total_amount || 0),
          0
        );

        // TOP PRODUCTS
        const { data: itemData, error: itemError } =
          await supabase
            .from("invoice_items")
            .select(
              "product_name, quantity, amount, invoice_id"
            );

        if (itemError) throw itemError;

        const productMap = {};

        (itemData || []).forEach((item) => {
          const name = item.product_name || "Unknown";

          if (!productMap[name]) {
            productMap[name] = {
              name,
              quantity: 0,
              sales: 0,
            };
          }

          productMap[name].quantity += Number(
            item.quantity || 0
          );

          productMap[name].sales += Number(
            item.amount || 0
          );
        });

        const products = Object.values(productMap)
          .sort((a, b) => b.sales - a.sales)
          .slice(0, 5);

        // OUTSTANDING CUSTOMERS
        const {
          data: outstandingBills,
          error: outstandingError,
        } = await supabase
          .from("invoices")
          .select(`
            customer_id,
            balance_amount,
            customers (name, mobile)
          `)
          .eq("user_id", user.id)
          .gt("balance_amount", 0);

        if (outstandingError) throw outstandingError;

        const customerMap = {};

        (outstandingBills || []).forEach((bill) => {
          if (!bill.customer_id) return;

          if (!customerMap[bill.customer_id]) {
            customerMap[bill.customer_id] = {
              name:
                bill.customers?.name ||
                "Unknown",
              mobile:
                bill.customers?.mobile || "",
              balance: 0,
            };
          }

          customerMap[bill.customer_id].balance +=
            Number(bill.balance_amount || 0);
        });

        const customers = Object.values(customerMap)
          .sort((a, b) => b.balance - a.balance)
          .slice(0, 10);

        if (!cancelled) {
          setToday({
            sales: todaySales,
            bills: todayData.length,
            received: todayReceived,
            outstanding: todayOutstanding,
          });

          setMonth({
            sales: monthSales,
            bills: monthData.length,
          });

          setTopProducts(products);
          setOutstandingCustomers(customers);
        }
      } catch (error) {
        console.error("Reports error:", error);

        if (!cancelled) {
          setMessage(error.message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadReports();

    return () => {
      cancelled = true;
    };
  }, []);

  function money(value) {
    return `₹ ${Number(value || 0).toFixed(2)}`;
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-600 dark:bg-slate-950 dark:text-slate-300">
        Loading reports...
      </div>
    );
  }

  const card =
    "rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 transition-colors dark:bg-slate-950 dark:text-slate-100">

      {/* HEADER */}
      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">

          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Reports
          </h1>

          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Sales and payment summary
          </p>

        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">

        {/* ERROR */}
        {message && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
            {message}
          </div>
        )}

        {/* TODAY */}
        <section>
          <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">
            Today's Summary
          </h2>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">

            <SummaryCard
              icon="💰"
              label="Sales"
              value={money(today.sales)}
            />

            <SummaryCard
              icon="🧾"
              label="Bills"
              value={today.bills}
            />

            <SummaryCard
              icon="💵"
              label="Received"
              value={money(today.received)}
            />

            <SummaryCard
              icon="⚠️"
              label="Outstanding"
              value={money(today.outstanding)}
              valueClass="text-red-600 dark:text-red-400"
            />

          </div>
        </section>

        {/* MONTH */}
        <section className="mt-8">
          <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">
            This Month
          </h2>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

            <SummaryCard
              label="Total Sales"
              value={money(month.sales)}
            />

            <SummaryCard
              label="Total Bills"
              value={month.bills}
            />

          </div>
        </section>

        {/* TOP PRODUCTS */}
        <section className="mt-8">
          <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">
            Top Products
          </h2>

          <div className={`${card} overflow-hidden p-0`}>

            {topProducts.length === 0 ? (
              <Empty text="No product sales yet." />
            ) : (
              <div className="divide-y divide-slate-200 dark:divide-slate-800">

                {topProducts.map((product) => (
                  <div
                    key={product.name}
                    className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                  >
                    <div className="min-w-0">
                      <strong className="block truncate text-sm font-semibold text-slate-900 dark:text-white">
                        📦 {product.name}
                      </strong>

                      <small className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
                        Quantity sold: {product.quantity}
                      </small>
                    </div>

                    <strong className="shrink-0 text-sm font-semibold text-slate-900 dark:text-white">
                      {money(product.sales)}
                    </strong>
                  </div>
                ))}

              </div>
            )}

          </div>
        </section>

        {/* OUTSTANDING CUSTOMERS */}
        <section className="mt-8 pb-8">
          <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">
            Outstanding Customers
          </h2>

          <div className={`${card} overflow-hidden p-0`}>

            {outstandingCustomers.length === 0 ? (
              <Empty text="No outstanding payments 🎉" />
            ) : (
              <div className="divide-y divide-slate-200 dark:divide-slate-800">

                {outstandingCustomers.map(
                  (customer, index) => (
                    <div
                      key={`${customer.mobile}-${index}`}
                      className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                    >
                      <div className="min-w-0">
                        <strong className="block truncate text-sm font-semibold text-slate-900 dark:text-white">
                          👤 {customer.name}
                        </strong>

                        {customer.mobile && (
                          <small className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
                            📱 {customer.mobile}
                          </small>
                        )}
                      </div>

                      <strong className="shrink-0 text-sm font-semibold text-red-600 dark:text-red-400">
                        {money(customer.balance)}
                      </strong>
                    </div>
                  )
                )}

              </div>
            )}

          </div>
        </section>

      </main>
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  valueClass = "text-slate-900 dark:text-white",
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
      <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
        {icon && `${icon} `}
        {label}
      </span>

      <strong
        className={`mt-3 block text-2xl font-bold ${valueClass}`}
      >
        {value}
      </strong>
    </div>
  );
}

function Empty({ text }) {
  return (
    <div className="px-5 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
      {text}
    </div>
  );
}

export default Reports;