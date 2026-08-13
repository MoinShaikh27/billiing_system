import { useState } from "react";
import { supabase } from "../services/supabase";

function RecordPayment({ invoice, onClose, onSuccess }) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const balance = Number(invoice?.balance_amount || 0);

  async function savePayment(event) {
    event.preventDefault();
    setMessage("");

    const paymentAmount = Number(amount);

    if (!paymentAmount || paymentAmount <= 0) {
      setMessage("Enter a valid payment amount.");
      return;
    }

    if (paymentAmount > balance) {
      setMessage(
        `Payment cannot exceed outstanding balance of ₹${balance.toFixed(2)}.`
      );
      return;
    }

    setSaving(true);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!user) throw new Error("User session not found.");

      const { error: paymentError } = await supabase
        .from("payments")
        .insert({
          user_id: user.id,
          invoice_id: invoice.id,
          amount: paymentAmount,
          payment_method: method,
          notes: notes.trim() || null,
        });

      if (paymentError) throw paymentError;

      const oldPaid = Number(invoice.paid_amount || 0);
      const totalAmount = Number(invoice.total_amount || 0);
      const newPaid = oldPaid + paymentAmount;
      const newBalance = Math.max(0, totalAmount - newPaid);

      const paymentStatus =
        newBalance === 0
          ? "paid"
          : newPaid > 0
            ? "partial"
            : "pending";

      const {
        data: updatedInvoice,
        error: invoiceError,
      } = await supabase
        .from("invoices")
        .update({
          paid_amount: newPaid,
          balance_amount: newBalance,
          payment_status: paymentStatus,
        })
        .eq("id", invoice.id)
        .eq("user_id", user.id)
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      setMessage("Payment recorded successfully.");
      setAmount("");
      setNotes("");

      if (onSuccess) onSuccess(updatedInvoice);
    } catch (error) {
      console.error("Error recording payment:", error);
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              Record Payment
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Invoice: {invoice?.invoice_number}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-2xl leading-none text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            ×
          </button>
        </div>

        <div className="mx-5 mt-5 flex items-center justify-between rounded-xl bg-red-50 px-4 py-3">
          <span className="text-sm font-medium text-red-700">
            Outstanding Balance
          </span>

          <strong className="text-lg text-red-700">
            ₹{balance.toFixed(2)}
          </strong>
        </div>

        <form onSubmit={savePayment} className="space-y-4 p-5">
          <div>
            <label
              htmlFor="payment-amount"
              className="mb-1.5 block text-sm font-semibold text-slate-700"
            >
              Payment Amount
            </label>

            <input
              id="payment-amount"
              type="number"
              min="0.01"
              max={balance}
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="Enter amount"
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div>
            <label
              htmlFor="payment-method"
              className="mb-1.5 block text-sm font-semibold text-slate-700"
            >
              Payment Method
            </label>

            <select
              id="payment-method"
              value={method}
              onChange={(event) => setMethod(event.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              <option value="cash">💵 Cash</option>
              <option value="upi">📱 UPI</option>
              <option value="bank">🏦 Bank Transfer</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="payment-notes"
              className="mb-1.5 block text-sm font-semibold text-slate-700"
            >
              Notes
            </label>

            <textarea
              id="payment-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Optional note"
              rows={3}
              className="w-full resize-none rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          {message && (
            <div
              className={`rounded-lg px-4 py-3 text-sm ${
                message.includes("successfully")
                  ? "bg-green-50 text-green-700"
                  : "bg-red-50 text-red-600"
              }`}
            >
              {message}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="flex-1 rounded-lg border border-slate-300 px-4 py-2.5 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-lg bg-green-600 px-4 py-2.5 font-semibold text-white hover:bg-green-700 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Record Payment"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default RecordPayment;