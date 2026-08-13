import { useEffect, useState } from "react";
import { supabase } from "../services/supabase";

function Customers({ onViewCustomer }) {
  const [customers, setCustomers] = useState([]);
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [address, setAddress] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [editingId, setEditingId] = useState(null);

  async function fetchCustomers() {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) throw userError;
    if (!user) throw new Error("User session not found.");

    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .eq("user_id", user.id)
      .order("name", { ascending: true });

    if (error) throw error;
    return data || [];
  }

  useEffect(() => {
    let cancelled = false;

    async function loadCustomers() {
      try {
        const data = await fetchCustomers();
        if (!cancelled) setCustomers(data);
      } catch (error) {
        console.error("Error loading customers:", error);
        if (!cancelled) setMessage(error.message);
      }
    }

    loadCustomers();

    return () => {
      cancelled = true;
    };
  }, []);

  async function refreshCustomers() {
    try {
      setCustomers(await fetchCustomers());
    } catch (error) {
      console.error("Error refreshing customers:", error);
      setMessage(error.message);
    }
  }

  async function saveCustomer(event) {
    event.preventDefault();
    setMessage("");

    if (!name.trim()) {
      setMessage("Customer name is required.");
      return;
    }

    setLoading(true);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!user) throw new Error("User session not found.");

      const customer = {
        name: name.trim(),
        mobile: mobile.trim(),
        address: address.trim(),
        updated_at: new Date().toISOString(),
      };

      if (editingId) {
        const { error } = await supabase
          .from("customers")
          .update(customer)
          .eq("id", editingId)
          .eq("user_id", user.id);

        if (error) throw error;
        setMessage("Customer updated successfully.");
      } else {
        const { error } = await supabase
          .from("customers")
          .insert({
            user_id: user.id,
            name: name.trim(),
            mobile: mobile.trim(),
            address: address.trim(),
          });

        if (error) throw error;
        setMessage("Customer added successfully.");
      }

      clearForm();
      await refreshCustomers();
    } catch (error) {
      console.error("Error saving customer:", error);
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  function editCustomer(customer) {
    setEditingId(customer.id);
    setName(customer.name || "");
    setMobile(customer.mobile || "");
    setAddress(customer.address || "");
    setMessage("");
  }

  async function deleteCustomer(id) {
    if (!window.confirm("Are you sure you want to delete this customer?")) {
      return;
    }

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error("User session not found.");

      const { error } = await supabase
        .from("customers")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);

      if (error) throw error;

      setCustomers((current) =>
        current.filter((customer) => customer.id !== id)
      );

      setMessage("Customer deleted successfully.");
    } catch (error) {
      console.error("Error deleting customer:", error);
      setMessage(error.message);
    }
  }

  function clearForm() {
    setEditingId(null);
    setName("");
    setMobile("");
    setAddress("");
    setMessage("");
  }

  const filteredCustomers = customers.filter((customer) => {
    const text = search.toLowerCase().trim();

    if (!text) return true;

    return (
      (customer.name || "").toLowerCase().includes(text) ||
      (customer.mobile || "").toLowerCase().includes(text) ||
      (customer.address || "").toLowerCase().includes(text)
    );
  });

  const inputClass =
    "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-blue-400 dark:focus:ring-blue-900";

  const cardClass =
    "rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 transition-colors dark:bg-slate-950 dark:text-slate-100">

      {/* HEADER */}
      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-100 text-xl dark:bg-blue-500/15">
              👥
            </div>

            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">
                Customers
              </h1>

              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Manage your customers
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[400px_1fr] lg:py-8">

        {/* FORM */}
        <section className={`${cardClass} h-fit p-5`}>
          <h2 className="mb-5 text-xl font-bold text-slate-900 dark:text-white">
            {editingId ? "Edit Customer" : "Add Customer"}
          </h2>

          <form onSubmit={saveCustomer} className="space-y-4">

            <div>
              <label
                htmlFor="customer-name"
                className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-300"
              >
                Customer Name
              </label>

              <input
                id="customer-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Example: Rajesh Kumar"
                className={inputClass}
              />
            </div>

            <div>
              <label
                htmlFor="customer-mobile"
                className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-300"
              >
                Mobile Number
              </label>

              <input
                id="customer-mobile"
                type="tel"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                placeholder="Example: 9876543210"
                className={inputClass}
              />
            </div>

            <div>
              <label
                htmlFor="customer-address"
                className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-300"
              >
                Address
              </label>

              <textarea
                id="customer-address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Customer address"
                rows={3}
                className={`${inputClass} resize-none`}
              />
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {loading
                  ? "Saving..."
                  : editingId
                    ? "Update Customer"
                    : "+ Add Customer"}
              </button>

              {editingId && (
                <button
                  type="button"
                  onClick={clearForm}
                  className="rounded-lg border border-slate-300 px-4 py-2.5 font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
              )}
            </div>

            {message && (
              <div className="rounded-lg bg-slate-100 px-4 py-3 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                {message}
              </div>
            )}
          </form>
        </section>

        {/* CUSTOMER LIST */}
        <section className={`${cardClass} overflow-hidden`}>
          <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              Customers
            </h2>

            <p className="text-sm text-slate-500 dark:text-slate-400">
              {filteredCustomers.length} customers
            </p>

            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="🔍 Search by name or mobile"
              className={`mt-4 ${inputClass}`}
            />
          </div>

          {filteredCustomers.length === 0 ? (
            <div className="px-5 py-16 text-center">
              <div className="text-5xl">👥</div>

              <h3 className="mt-4 font-semibold text-slate-800 dark:text-slate-200">
                {search
                  ? "No matching customers"
                  : "No customers yet"}
              </h3>

              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {search
                  ? "Try another search."
                  : "Add your first customer above."}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {filteredCustomers.map((customer) => (
                <div
                  key={customer.id}
                  className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <h3 className="font-semibold text-slate-900 dark:text-white">
                      {customer.name}
                    </h3>

                    {customer.mobile && (
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        📱 {customer.mobile}
                      </p>
                    )}

                    {customer.address && (
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        📍 {customer.address}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => onViewCustomer(customer.id)}
                      className="rounded-lg border border-blue-200 px-3 py-2 text-sm font-semibold text-blue-600 hover:bg-blue-50 dark:border-blue-800 dark:hover:bg-blue-950"
                    >
                      View
                    </button>

                    <button
                      type="button"
                      onClick={() => editCustomer(customer)}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      onClick={() => deleteCustomer(customer.id)}
                      className="rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/40"
                    >
                      Delete
                    </button>
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

export default Customers;