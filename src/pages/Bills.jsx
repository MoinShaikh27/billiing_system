import { useEffect, useState } from "react";
import { supabase } from "../services/supabase";
import RecordPayment from "../components/RecordPayment";

function Bills({ onViewBill }) {
  const [bills, setBills] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [paymentInvoice, setPaymentInvoice] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function loadBills() {
      try {
        setLoading(true);
        setMessage("");

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) throw userError;
        if (!user) throw new Error("User session not found.");

        const { data: invoiceData, error: invoiceError } =
          await supabase
            .from("invoices")
            .select(`
              id, user_id, customer_id, invoice_number,
              invoice_date, created_at, total_amount,
              paid_amount, balance_amount, payment_status
            `)
            .eq("user_id", user.id)
            .order("created_at", { ascending: false });

        if (invoiceError) throw invoiceError;

        const invoiceRows = invoiceData || [];

        const customerIds = [
          ...new Set(
            invoiceRows
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

        const customerMap = {};

        customers.forEach((customer) => {
          customerMap[customer.id] = customer;
        });

        const combinedBills = invoiceRows.map((invoice) => ({
          ...invoice,
          customer: customerMap[invoice.customer_id] || null,
        }));

        if (!cancelled) setBills(combinedBills);
      } catch (error) {
        console.error("Error loading bills:", error);

        if (!cancelled) {
          setMessage(
            error.message || "Failed to load bills."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadBills();

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredBills = bills.filter((bill) => {
    const text = search.toLowerCase().trim();
    const invoiceNumber = bill.invoice_number || "";
    const customerName = bill.customer?.name || "";
    const mobile = bill.customer?.mobile || "";
    const billStatus = bill.payment_status || "pending";

    const matchesSearch =
      !text ||
      invoiceNumber.toLowerCase().includes(text) ||
      customerName.toLowerCase().includes(text) ||
      mobile.toLowerCase().includes(text);

    const matchesStatus =
      statusFilter === "all" ||
      billStatus === statusFilter;

    return matchesSearch && matchesStatus;
  });

  function formatDate(value) {
    if (!value) return "-";

    return new Date(value).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }

  function money(value) {
    return `₹ ${Number(value || 0).toFixed(2)}`;
  }

  function exportBillsToCSV() {
    if (!bills.length) {
      alert("No bills available to export.");
      return;
    }

    const headers = [
      "Invoice Number",
      "Customer Name",
      "Mobile",
      "Invoice Date",
      "Total Amount",
      "Paid Amount",
      "Balance Amount",
      "Payment Status",
    ];

    const rows = bills.map((bill) => [
      bill.invoice_number || "",
      bill.customer?.name || "",
      bill.customer?.mobile || "",
      formatDate(bill.invoice_date || bill.created_at),
      Number(bill.total_amount || 0).toFixed(2),
      Number(bill.paid_amount || 0).toFixed(2),
      Number(bill.balance_amount || 0).toFixed(2),
      bill.payment_status || "pending",
    ]);

    const csv = [headers, ...rows]
      .map((row) =>
        row
          .map((value) =>
            `"${String(value).replace(/"/g, '""')}"`
          )
          .join(",")
      )
      .join("\n");

    const blob = new Blob(["\ufeff" + csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `bills_${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  }

  const totalSales = bills.reduce(
    (sum, bill) =>
      sum + Number(bill.total_amount || 0),
    0
  );

  const totalPaid = bills.reduce(
    (sum, bill) =>
      sum + Number(bill.paid_amount || 0),
    0
  );

  const totalOutstanding = bills.reduce(
    (sum, bill) =>
      sum + Number(bill.balance_amount || 0),
    0
  );

  function handlePaymentSuccess(updatedInvoice) {
    setBills((current) =>
      current.map((bill) =>
        bill.id === updatedInvoice.id
          ? { ...bill, ...updatedInvoice }
          : bill
      )
    );

    setPaymentInvoice(null);
  }
  async function handleDeleteBill(bill) {
  const confirmed = window.confirm(
    `Are you sure you want to permanently delete bill ${bill.invoice_number}?\n\n` +
    `Customer: ${bill.customer?.name || "Unknown"}\n` +
    `Amount: ₹${Number(bill.total_amount || 0).toFixed(2)}\n\n` +
    `This will permanently delete the bill, its items and payment records.`
  );

  if (!confirmed) return;

  try {
    setMessage("");

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) throw userError;
    if (!user) throw new Error("User session not found.");

    /*
     * Delete related payment records first.
     */
    const { error: paymentsError } = await supabase
      .from("payments")
      .delete()
      .eq("invoice_id", bill.id)
      .eq("user_id", user.id);

    if (paymentsError) throw paymentsError;

    /*
     * Delete invoice items.
     */
    const { error: itemsError } = await supabase
      .from("invoice_items")
      .delete()
      .eq("invoice_id", bill.id);

    if (itemsError) throw itemsError;

    /*
     * Finally delete the invoice itself.
     */
    const { error: invoiceError } = await supabase
      .from("invoices")
      .delete()
      .eq("id", bill.id)
      .eq("user_id", user.id);

    if (invoiceError) throw invoiceError;

    /*
     * Remove it immediately from the UI.
     */
    setBills((current) =>
      current.filter((item) => item.id !== bill.id)
    );

    setMessage(
      `Bill ${bill.invoice_number} deleted successfully.`
    );
  } catch (error) {
    console.error("Error deleting bill:", error);

    setMessage(
      error.message || "Failed to delete bill."
    );
  }
}

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-600 dark:bg-slate-950 dark:text-slate-300">
        Loading bills...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 transition-colors dark:bg-slate-950 dark:text-slate-100">

      {/* HEADER */}
      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">

          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-100 text-xl dark:bg-violet-500/15">
              🧾
            </div>

            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">
                Bills
              </h1>

              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                View your saved bills
              </p>
            </div>
          </div>

        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:py-8">

        {/* SUMMARY */}
        <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <SummaryCard
            label="Total Bills"
            value={bills.length}
          />

          <SummaryCard
            label="Total Sales"
            value={money(totalSales)}
          />

          <SummaryCard
            label="Total Paid"
            value={money(totalPaid)}
            valueClass="text-green-600 dark:text-green-400"
          />

          <SummaryCard
            label="Outstanding"
            value={money(totalOutstanding)}
            valueClass="text-red-600 dark:text-red-400"
          />
        </section>

        {/* SEARCH + FILTER */}
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">

          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                Bill History
              </h2>

              <p className="text-sm text-slate-500 dark:text-slate-400">
                {filteredBills.length} bills
              </p>
            </div>

            <button
              type="button"
              onClick={exportBillsToCSV}
              className="rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700"
            >
              📊 Export CSV
            </button>

          </div>

          <input
            type="text"
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            placeholder="🔍 Search invoice number, customer or mobile"
            className="mt-4 w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-blue-400 dark:focus:ring-blue-900"
          />

          <div className="mt-4 flex flex-wrap gap-2">
            {["all", "pending", "partial", "paid"].map(
              (status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() =>
                    setStatusFilter(status)
                  }
                  className={`rounded-lg px-4 py-2 text-sm font-semibold ${
                    statusFilter === status
                      ? "bg-blue-600 text-white"
                      : "border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                  }`}
                >
                  {status === "all"
                    ? "All"
                    : status.charAt(0).toUpperCase() +
                      status.slice(1)}
                </button>
              )
            )}
          </div>
        </section>

        {/* ERROR */}
        {message && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
            {message}
          </div>
        )}

        {/* EMPTY */}
        {!message && filteredBills.length === 0 && (
          <section className="rounded-xl border border-slate-200 bg-white px-5 py-16 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">

            <div className="text-5xl">🧾</div>

            <h3 className="mt-4 font-semibold text-slate-800 dark:text-slate-200">
              No bills found
            </h3>

            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Try changing your search or filter.
            </p>

          </section>
        )}

        {/* BILLS */}
        {filteredBills.length > 0 && (
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">

            <div className="divide-y divide-slate-200 dark:divide-slate-800">

              {filteredBills.map((bill) => {
                const status =
                  bill.payment_status || "pending";

                const balance =
                  Number(bill.balance_amount || 0);

                const statusClass =
                  status === "paid"
                    ? "bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-300"
                    : status === "partial"
                      ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-950/50 dark:text-yellow-300"
                      : "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300";

                return (
                  <div
                    key={bill.id}
                    className="flex flex-col gap-5 px-5 py-5 transition hover:bg-slate-50 dark:hover:bg-slate-800/60 lg:flex-row lg:items-center lg:justify-between"
                  >

                    <div className="min-w-0">
                      <h3 className="font-bold text-slate-900 dark:text-white">
                        {bill.invoice_number}
                      </h3>

                      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                        👤{" "}
                        {bill.customer?.name ||
                          "Unknown Customer"}
                      </p>

                      {bill.customer?.mobile && (
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                          📱 {bill.customer.mobile}
                        </p>
                      )}

                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        📅{" "}
                        {formatDate(
                          bill.invoice_date ||
                            bill.created_at
                        )}
                      </p>
                    </div>

                    <div className="flex flex-col gap-2 lg:min-w-[260px] lg:items-end">

                      <strong className="text-xl text-slate-900 dark:text-white">
                        {money(bill.total_amount)}
                      </strong>

                      <div className="text-sm text-slate-500 dark:text-slate-400">
                        Paid: {money(bill.paid_amount)}
                      </div>

                      <div className="text-sm text-slate-500 dark:text-slate-400">
                        Balance: {money(bill.balance_amount)}
                      </div>

                      <span
                        className={`w-fit rounded-full px-3 py-1 text-xs font-bold ${statusClass}`}
                      >
                        {status.toUpperCase()}
                      </span>

                <div className="mt-1 flex flex-wrap gap-2">

                  {/* VIEW */}
                  <button
                    type="button"
                    onClick={() => onViewBill(bill.id)}
                    className="rounded-lg border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-600 hover:bg-blue-50 dark:border-blue-900 dark:text-blue-300 dark:hover:bg-blue-950/50"
                  >
                    View
                  </button>

                  {/* PAY */}
                  {balance > 0 && (
                    <button
                      type="button"
                      onClick={() => setPaymentInvoice(bill)}
                      className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
                    >
                      Pay
                    </button>
                  )}

                  {/* DELETE */}
                  <button
                    type="button"
                    onClick={() => handleDeleteBill(bill)}
                    className="rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/50"
                  >
                    Delete
                  </button>

                </div>
                    </div>

                  </div>
                );
              })}

            </div>
          </section>
        )}

      </main>

      {paymentInvoice && (
        <RecordPayment
          invoice={paymentInvoice}
          onClose={() =>
            setPaymentInvoice(null)
          }
          onSuccess={handlePaymentSuccess}
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

      <strong
        className={`mt-2 block text-xl font-bold ${valueClass}`}
      >
        {value}
      </strong>
    </div>
  );
}

export default Bills;