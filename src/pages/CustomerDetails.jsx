import { useEffect, useState } from "react";
import { supabase } from "../services/supabase";
import RecordPayment from "../components/RecordPayment";

function CustomerDetails({ customerId, onViewBill }) {
  const [customer, setCustomer] = useState(null);
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [paymentInvoice, setPaymentInvoice] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function loadCustomer() {
      try {
        setLoading(true);
        setMessage("");

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) throw userError;
        if (!user) throw new Error("User session not found.");

        const { data: customerData, error: customerError } =
          await supabase
            .from("customers")
            .select("*")
            .eq("id", customerId)
            .eq("user_id", user.id)
            .single();

        if (customerError) throw customerError;

        const { data: billData, error: billError } =
          await supabase
            .from("invoices")
            .select("*")
            .eq("customer_id", customerId)
            .eq("user_id", user.id)
            .order("created_at", { ascending: false });

        if (billError) throw billError;

        if (!cancelled) {
          setCustomer(customerData);
          setBills(billData || []);
        }
      } catch (error) {
        console.error("Error loading customer:", error);

        if (!cancelled) setMessage(error.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    if (customerId) loadCustomer();

    return () => {
      cancelled = true;
    };
  }, [customerId]);

  function money(value) {
    return `₹ ${Number(value || 0).toFixed(2)}`;
  }

  function formatDate(value) {
    if (!value) return "-";

    return new Date(value).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }

  const totalPurchases = bills.reduce(
    (sum, bill) => sum + Number(bill.total_amount || 0),
    0
  );

  const totalPaid = bills.reduce(
    (sum, bill) => sum + Number(bill.paid_amount || 0),
    0
  );

  const totalOutstanding = bills.reduce(
    (sum, bill) => sum + Number(bill.balance_amount || 0),
    0
  );

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <p className="text-slate-600 dark:text-slate-300">
          Loading customer...
        </p>
      </div>
    );
  }

  if (message) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 dark:bg-slate-950">
        <div className="rounded-xl border border-red-200 bg-white p-6 text-center shadow-sm dark:border-red-900 dark:bg-slate-900">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            Unable to load customer
          </h2>

          <p className="mt-2 text-sm text-red-600 dark:text-red-400">
            {message}
          </p>
        </div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <p className="text-slate-600 dark:text-slate-300">
          Customer not found.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">

      {/* HEADER */}
      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-100 text-xl dark:bg-blue-500/15">
              👤
            </div>

            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">
                Customer Details
              </h1>

              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Complete customer ledger
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:py-8">

        {/* CUSTOMER INFORMATION */}
        <section className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center dark:border-slate-800 dark:bg-slate-900">

          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-blue-100 text-3xl dark:bg-blue-500/15">
            👤
          </div>

          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              {customer.name}
            </h2>

            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              📱 {customer.mobile || "-"}
            </p>

            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              📍 {customer.address || "-"}
            </p>
          </div>

        </section>

        {/* SUMMARY */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

          <SummaryCard
            label="Total Purchases"
            value={money(totalPurchases)}
          />

          <SummaryCard
            label="Total Paid"
            value={money(totalPaid)}
            valueClass="text-green-600 dark:text-green-400"
          />

          <SummaryCard
            label="Outstanding"
            value={money(totalOutstanding)}
            valueClass={
              totalOutstanding > 0
                ? "text-red-600 dark:text-red-400"
                : "text-green-600 dark:text-green-400"
            }
          />

          <SummaryCard
            label="Total Bills"
            value={bills.length}
          />

        </section>

        {/* LEDGER */}
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">

          <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              Purchase History
            </h2>

            <p className="text-sm text-slate-500 dark:text-slate-400">
              {bills.length} bills
            </p>
          </div>

          {bills.length === 0 ? (
            <div className="flex min-h-[260px] flex-col items-center justify-center px-5 text-center">

              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-3xl dark:bg-slate-800">
                🧾
              </div>

              <h3 className="mt-4 font-semibold text-slate-800 dark:text-slate-200">
                No purchases yet
              </h3>

              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Bills for this customer will appear here.
              </p>

            </div>
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-slate-800">

              {bills.map((bill) => (
                <div
                  className="grid gap-4 px-5 py-5 lg:grid-cols-6 lg:items-center"
                  key={bill.id}
                >

                  {/* BILL INFO */}
                  <div className="lg:col-span-2">
                    <strong className="block text-slate-900 dark:text-white">
                      {bill.invoice_number}
                    </strong>

                    <span className="mt-1 block text-sm text-slate-500 dark:text-slate-400">
                      📅{" "}
                      {formatDate(
                        bill.invoice_date || bill.created_at
                      )}
                    </span>
                  </div>

                  {/* TOTAL */}
                  <AmountField
                    label="Total"
                    value={money(bill.total_amount)}
                  />

                  {/* PAID */}
                  <AmountField
                    label="Paid"
                    value={money(bill.paid_amount)}
                    valueClass="text-green-600 dark:text-green-400"
                  />

                  {/* BALANCE */}
                  <AmountField
                    label="Balance"
                    value={money(bill.balance_amount)}
                    valueClass={
                      Number(bill.balance_amount || 0) > 0
                        ? "text-red-600 dark:text-red-400"
                        : "text-green-600 dark:text-green-400"
                    }
                  />

                  {/* ACTIONS */}
                  <div className="flex flex-wrap items-center gap-2 lg:justify-end">

                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                        bill.payment_status === "paid"
                          ? "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400"
                          : bill.payment_status === "partial"
                            ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-400"
                            : "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400"
                      }`}
                    >
                      {(bill.payment_status || "pending").toUpperCase()}
                    </span>

                    <button
                      type="button"
                      onClick={() => onViewBill(bill.id)}
                      className="rounded-lg border border-blue-200 px-3 py-2 text-sm font-semibold text-blue-600 hover:bg-blue-50 dark:border-blue-800 dark:hover:bg-blue-950"
                    >
                      View
                    </button>

                    {Number(bill.balance_amount || 0) > 0 && (
                      <button
                        type="button"
                        onClick={() => setPaymentInvoice(bill)}
                        className="rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-700"
                      >
                        Pay
                      </button>
                    )}

                  </div>
                </div>
              ))}

            </div>
          )}
        </section>
      </main>

      {/* RECORD PAYMENT */}
      {paymentInvoice && (
        <RecordPayment
          invoice={paymentInvoice}
          onClose={() => setPaymentInvoice(null)}
          onSuccess={(updatedInvoice) => {
            setBills((currentBills) =>
              currentBills.map((bill) =>
                bill.id === updatedInvoice.id
                  ? updatedInvoice
                  : bill
              )
            );

            setPaymentInvoice(null);
          }}
        />
      )}

    </div>
  );
}

function SummaryCard({
  label,
  value,
  valueClass = "text-slate-900 dark:text-white",
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        {label}
      </p>

      <strong className={`mt-2 block text-2xl font-bold ${valueClass}`}>
        {value}
      </strong>
    </div>
  );
}

function AmountField({
  label,
  value,
  valueClass = "text-slate-900 dark:text-white",
}) {
  return (
    <div>
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
        {label}
      </span>

      <strong className={`mt-1 block ${valueClass}`}>
        {value}
      </strong>
    </div>
  );
}

export default CustomerDetails;