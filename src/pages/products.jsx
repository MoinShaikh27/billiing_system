import { useEffect, useState } from "react";
import { supabase } from "../services/supabase";

function Products() {
  const [products, setProducts] = useState([]);
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("kg");
  const [rate, setRate] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [editingId, setEditingId] = useState(null);

  async function fetchProducts() {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) throw userError;
    if (!user) throw new Error("User session not found.");

    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("user_id", user.id)
      .eq("active", true)
      .order("name", { ascending: true });

    if (error) throw error;
    return data || [];
  }

  useEffect(() => {
    let cancelled = false;

    async function loadProducts() {
      try {
        const data = await fetchProducts();

        if (!cancelled) {
          setProducts(data);
        }
      } catch (error) {
        console.error("Error loading products:", error);

        if (!cancelled) {
          setMessage(error.message);
        }
      }
    }

    loadProducts();

    return () => {
      cancelled = true;
    };
  }, []);

  async function refreshProducts() {
    try {
      setProducts(await fetchProducts());
    } catch (error) {
      console.error("Error refreshing products:", error);
      setMessage(error.message);
    }
  }

  async function saveProduct(event) {
    event.preventDefault();
    setMessage("");

    if (!name.trim()) {
      setMessage("Product name is required.");
      return;
    }

    if (rate === "" || Number(rate) < 0) {
      setMessage("Enter a valid selling rate.");
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

      if (editingId) {
        const { error } = await supabase
          .from("products")
          .update({
            name: name.trim(),
            unit,
            selling_rate: Number(rate),
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingId)
          .eq("user_id", user.id);

        if (error) throw error;

        setMessage("Product updated successfully.");
      } else {
        const { error } = await supabase
          .from("products")
          .insert({
            user_id: user.id,
            name: name.trim(),
            unit,
            selling_rate: Number(rate),
            active: true,
          });

        if (error) throw error;

        setMessage("Product added successfully.");
      }

      clearForm();
      await refreshProducts();
    } catch (error) {
      console.error("Error saving product:", error);
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  function editProduct(product) {
    setEditingId(product.id);
    setName(product.name || "");
    setUnit(product.unit || "kg");
    setRate(product.selling_rate ?? "");
    setMessage("");
  }

  async function deleteProduct(productId) {
    if (!window.confirm("Are you sure you want to delete this product?")) {
      return;
    }

    setMessage("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!user) throw new Error("User session not found.");

      const { error } = await supabase
        .from("products")
        .update({
          active: false,
          updated_at: new Date().toISOString(),
        })
        .eq("id", productId)
        .eq("user_id", user.id);

      if (error) throw error;

      setMessage("Product deleted successfully.");
      await refreshProducts();
    } catch (error) {
      console.error("Error deleting product:", error);
      setMessage(error.message);
    }
  }

  function clearForm() {
    setEditingId(null);
    setName("");
    setUnit("kg");
    setRate("");
  }

  const inputClass =
    "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-blue-400 dark:focus:ring-blue-900";

  const labelClass =
    "mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 transition-colors dark:bg-slate-950 dark:text-slate-100">

      {/* HEADER */}
      <header className="border-b border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Products
          </h1>

          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Manage your available products
          </p>
        </div>
      </header>

      {/* CONTENT */}
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

          {/* FORM */}
          <div className="lg:col-span-1">
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">

              <h2 className="mb-6 text-lg font-semibold text-slate-900 dark:text-white">
                {editingId ? "Edit Product" : "Add Product"}
              </h2>

              <form onSubmit={saveProduct} className="space-y-5">

                <div>
                  <label htmlFor="product-name" className={labelClass}>
                    Product Name
                  </label>

                  <input
                    id="product-name"
                    type="text"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Example: Sorage"
                    className={inputClass}
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">

                  <div>
                    <label htmlFor="product-unit" className={labelClass}>
                      Unit
                    </label>

                    <select
                      id="product-unit"
                      value={unit}
                      onChange={(event) => setUnit(event.target.value)}
                      className={inputClass}
                    >
                      <option value="kg">kg</option>
                      <option value="g">g</option>
                      <option value="L">L</option>
                      <option value="ml">ml</option>
                      <option value="PC">PC</option>
                      <option value="bag">Bag</option>
                      <option value="box">Box</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="product-rate" className={labelClass}>
                      Selling Rate ₹
                    </label>

                    <input
                      id="product-rate"
                      type="number"
                      step="0.01"
                      min="0"
                      value={rate}
                      onChange={(event) => setRate(event.target.value)}
                      placeholder="120"
                      className={inputClass}
                    />
                  </div>

                </div>

                <div className="flex flex-col gap-3 sm:flex-row">

                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loading
                      ? "Saving..."
                      : editingId
                        ? "Update Product"
                        : "+ Add Product"}
                  </button>

                  {editingId && (
                    <button
                      type="button"
                      onClick={clearForm}
                      className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                    >
                      Cancel
                    </button>
                  )}

                </div>

                {message && (
                  <div className="rounded-lg border border-slate-200 bg-slate-100 px-4 py-3 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    {message}
                  </div>
                )}

              </form>
            </div>
          </div>

          {/* PRODUCT LIST */}
          <div className="lg:col-span-2">
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">

              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                    Available Products
                  </h2>

                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Manage your product catalog
                  </p>
                </div>

                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  {products.length}{" "}
                  {products.length === 1 ? "product" : "products"}
                </span>
              </div>

              {products.length === 0 ? (
                <div className="px-6 py-12 text-center">
                  <div className="mb-3 text-4xl">📦</div>

                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                    No products yet
                  </h3>

                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Add your first product above.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">

                  {products.map((product) => (
                    <div
                      key={product.id}
                      className="flex flex-col gap-4 px-5 py-4 transition hover:bg-slate-50 dark:hover:bg-slate-800/60 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                          {product.name}
                        </h3>

                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                          <span className="font-medium text-slate-700 dark:text-slate-200">
                            ₹ {Number(product.selling_rate).toFixed(2)}
                          </span>

                          <span className="mx-1 text-slate-300 dark:text-slate-600">
                            /
                          </span>

                          {product.unit}
                        </p>
                      </div>

                      <div className="flex shrink-0 gap-2">
                        <button
                          type="button"
                          onClick={() => editProduct(product)}
                          className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 transition hover:bg-blue-100 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-900/60"
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          onClick={() => deleteProduct(product.id)}
                          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-100 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300 dark:hover:bg-red-900/60"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}

                </div>
              )}

            </div>
          </div>

        </div>
      </main>
    </div>
  );
}

export default Products;