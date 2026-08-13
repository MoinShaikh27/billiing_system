import { useEffect, useState } from "react";
import { supabase } from "../services/supabase";

function Payments() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadPayments() {
      try {
        setLoading(true);
        setMessage("");

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) throw userError;
        if (!user) throw new Error("User session not found.");

        const { data: paymentData, error: paymentError } =
          await supabase
            .from("payments")
            .select(`
              id, user_id, invoice_id, amount,
              payment_method, notes, created_at
            `)
            .eq("user_id", user.id)
            .order("created_at", { ascending: false });

        if (paymentError) throw paymentError;

        const paymentRows = paymentData || [];

        const invoiceIds = [
          ...new Set(
            paymentRows
              .map((payment) => payment.invoice_id)
              .filter(Boolean)
          ),
        ];

        let invoices = [];

        if (invoiceIds.length) {
          const { data, error } = await supabase
            .from("invoices")
            .select("id, invoice_number, customer_id")
            .in("id", invoiceIds);

          if (error) throw error;
          invoices = data || [];
        }

        const customerIds = [
          ...new Set(
            invoices
              .map((invoice) => invoice.customer_id)
              .filter(Boolean)
          ),
        ];

        let customers = [];

        if (customerIds.length) {
          const { data, error } = await supabase
            .from("customers")
            .select("id, name, mobile")
            .in("id", customerIds);

          if (error) throw error;
          customers = data || [];
        }

        const invoiceMap = {};
        invoices.forEach((invoice) => {
          invoiceMap[invoice.id] = invoice;
        });

        const customerMap = {};
        customers.forEach((customer) => {
          customerMap[customer.id] = customer;
        });

        const combinedPayments = paymentRows.map((payment) => {
          const invoice = invoiceMap[payment.invoice_id];
          const customer = invoice
            ? customerMap[invoice.customer_id]
            : null;

          return {
            ...payment,
            invoice: invoice || null,
            customer: customer || null,
          };
        });

        if (!cancelled) {
          setPayments(combinedPayments);
        }
      } catch (error) {
        console.error("Error loading payments:", error);

        if (!cancelled) {
          setMessage(
            error.message || "Failed to load payments."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadPayments();

    return () => {
      cancelled = true;
    };
  }, []);

  const money = (value) =>
    `₹ ${Number(value || 0).toFixed(2)}`;

  const formatDate = (value) =>
    value
      ? new Date(value).toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        })
      : "-";

  const formatTime = (value) =>
    value
      ? new Date(value).toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
        })
      : "";

  const totalReceived = payments.reduce(
    (sum, payment) =>
      sum + Number(payment.amount || 0),
    0
  );

  function getMethod(method) {
    if (method === "cash") return "💵 Cash";
    if (method === "upi") return "📱 UPI";
    if (method === "bank") return "🏦 Bank";
    return "Other";
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-600 dark:bg-slate-950 dark:text-slate-300">
        Loading payments...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 transition-colors dark:bg-slate-950 dark:text-slate-100">

      {/* HEADER */}
      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 text-xl shadow-sm">
              💳
            </div>

            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">
                Payment History
              </h1>

              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Complete record of received payments
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:py-8">

        {/* SUMMARY */}
        <section className="grid gap-4 sm:grid-cols-2">
          <SummaryCard
            label="Total Payments"
            value={payments.length}
          />

          <SummaryCard
            label="Total Received"
            value={money(totalReceived)}
            valueClass="text-green-600 dark:text-green-400"
          />
        </section>

        {/* ERROR */}
        {message && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
            {message}
          </div>
        )}

        {/* PAYMENTS */}
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          {payments.length === 0 ? (
            <div className="flex min-h-[260px] flex-col items-center justify-center px-5 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-green-100 text-3xl dark:bg-green-500/15">
                💵
              </div>

              <h3 className="mt-4 text-lg font-semibold text-slate-800 dark:text-slate-200">
                No payments yet
              </h3>

              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Payments recorded against invoices
                will appear here.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {payments.map((payment) => (
                <div
                  key={payment.id}
                  className="grid gap-5 px-5 py-5 transition hover:bg-slate-50 dark:hover:bg-slate-800/60 sm:grid-cols-2 lg:grid-cols-5"
                >
                  <PaymentField
                    label="Customer"
                    value={
                      <>
                        👤{" "}
                        {payment.customer?.name ||
                          "Unknown Customer"}
                      </>
                    }
                    secondary={
                      payment.customer?.mobile
                        ? `📱 ${payment.customer.mobile}`
                        : null
                    }
                  />

                  <PaymentField
                    label="Invoice"
                    value={
                      payment.invoice?.invoice_number || "-"
                    }
                  />

                  <PaymentField
                    label="Date"
                    value={formatDate(payment.created_at)}
                    secondary={formatTime(payment.created_at)}
                  />

                  <PaymentField
                    label="Method"
                    value={getMethod(payment.payment_method)}
                  />

                  <div className="lg:text-right">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                      Amount
                    </p>

                    <strong className="mt-1 block text-xl font-bold text-green-600 dark:text-green-400">
                      {money(payment.amount)}
                    </strong>

                    {payment.notes && (
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        {payment.notes}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function PaymentField({ label, value, secondary }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
        {label}
      </p>

      <strong className="mt-1 block truncate text-slate-900 dark:text-white">
        {value}
      </strong>

      {secondary && (
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {secondary}
        </p>
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

      <strong
        className={`mt-2 block text-2xl font-bold ${valueClass}`}
      >
        {value}
      </strong>
    </div>
  );
}

export default Payments;