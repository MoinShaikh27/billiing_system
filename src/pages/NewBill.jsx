import { useEffect, useState } from "react";
import { supabase } from "../services/supabase";

function NewBill({ onSaved }) {
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [customerId, setCustomerId] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [rate, setRate] = useState("");
  const [cgstAmount, setCgstAmount] = useState("");
  const [sgstAmount, setSgstAmount] = useState("");
  const [productRate, setProductRate] = useState("");
  const [productCgst, setProductCgst] = useState("");
  const [productSgst, setProductSgst] = useState("");
  const [items, setItems] = useState([]);

  const [discount, setDiscount] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [generatedCoupon, setGeneratedCoupon] = useState(null);
  const [couponGenerated, setCouponGenerated] = useState(false);

  const [paidAmount, setPaidAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [showQr, setShowQr] = useState(false);
  const [upiId, setUpiId] = useState("8859924403m@pn");
  const [editingUpi, setEditingUpi] = useState(false);
  const [newUpiId, setNewUpiId] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerMobile, setCustomerMobile] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [savingCustomer, setSavingCustomer] = useState(false);

  const [showProductForm, setShowProductForm] = useState(false);
  const [productName, setProductName] = useState("");
  const [productUnit, setProductUnit] = useState("kg");
  const [savingProduct, setSavingProduct] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      try {
        setLoading(true);

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) throw userError;
        if (!user) throw new Error("User session not found.");

        const [customersResult, productsResult] =
          await Promise.all([
            supabase
              .from("customers")
              .select("*")
              .eq("user_id", user.id)
              .order("name"),

            supabase
              .from("products")
              .select("*")
              .eq("user_id", user.id)
              .eq("active", true)
              .order("name"),
          ]);

        if (customersResult.error) throw customersResult.error;
        if (productsResult.error) throw productsResult.error;

        if (!cancelled) {
          setCustomers(customersResult.data || []);
          setProducts(productsResult.data || []);
        }
      } catch (error) {
        console.error("Error loading data:", error);
        if (!cancelled) setMessage(error.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadData();

    return () => {
      cancelled = true;
    };
  }, []);

   function handleProductChange(event) {
        const id = event.target.value;

        setSelectedProductId(id);

        const product = products.find(
          (item) => String(item.id) === String(id)
        );

        if (!product) {
          setRate("");
          setCgstAmount("");
          setSgstAmount("");
          return;
        }

        setRate(
          product.selling_rate ??
          product.rate ??
          ""
        );

        setCgstAmount(
          product.cgst ?? ""
        );

        setSgstAmount(
          product.sgst ?? ""
        );
      }

  function addProduct() {
    setMessage("");

    if (!selectedProductId) {
      setMessage("Please select a product.");
      return;
    }

    const qty = Number(quantity);
    const productRate = Number(rate);

    if (!qty || qty <= 0) {
      setMessage("Please enter a valid quantity.");
      return;
    }

    if (Number.isNaN(productRate) || productRate < 0) {
      setMessage("Please enter a valid rate.");
      return;
    }

    const product = products.find(
      (item) => String(item.id) === String(selectedProductId)
    );

    if (!product) {
      setMessage("Product not found.");
      return;
    }

    setItems((current) => [
      ...current,
      {
        product_id: product.id,
        product_name: product.name,
        unit: product.unit || "kg",

        quantity: qty,
        rate: productRate,

        // Final amount including tax
        amount: qty * productRate,

        // GST declared in product
        cgst_amount:
          Number(cgstAmount || 0) * qty,

        sgst_amount:
          Number(sgstAmount || 0) * qty,

        // Amount before GST
        taxable_amount:
          Math.max(
            qty * productRate -
            Number(cgstAmount || 0) * qty -
            Number(sgstAmount || 0) * qty,
            0
          ),
      },
    ]);

    setSelectedProductId("");
    setQuantity("");
    setRate("");
    setCgstAmount("");
    setSgstAmount("");
  }

  function removeItem(index) {
    setItems((current) => current.filter((_, i) => i !== index));
  }

  const subtotal = items.reduce(
    (sum, item) => sum + Number(item.amount || 0),
    0
  );

  const manualDiscount = Math.max(Number(discount) || 0, 0);

  function generateCouponCode() {
  if (couponGenerated) return;

  if (!customerId) {
    setMessage("Please select a customer first.");
    return;
  }

  if (subtotal <= 0) {
    setMessage("Add products before generating a coupon.");
    return;
  }

  const customer = customers.find(
    (item) => String(item.id) === String(customerId)
  );

  if (!customer) {
    setMessage("Customer not found.");
    return;
  }

  if (!customer.mobile) {
    setMessage(
      "Customer does not have a mobile number."
    );
    return;
  }

  const characters =
    "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  let code = "SAVE-";

  for (let i = 0; i < 6; i++) {
    code +=
      characters[
        Math.floor(
          Math.random() * characters.length
        )
      ];
  }

  const maxDiscount = Math.min(
    100,
    Math.floor(subtotal * 0.1)
  );

  if (maxDiscount < 1) {
    setMessage(
      "Bill amount is too low to generate a coupon."
    );
    return;
  }

  const randomDiscount =
    Math.floor(
      Math.random() * maxDiscount
    ) + 1;

  setGeneratedCoupon({
    code,
    discount: randomDiscount,
    customerId: customer.id,
    customerName: customer.name,
    mobile: customer.mobile,
  });

  // IMPORTANT:
  // Do NOT apply the discount here.
  setCouponCode("");
  setCouponDiscount(0);

  setCouponGenerated(true);

  setMessage(
    `Coupon generated: ${code} — ₹${randomDiscount} OFF. Enter the code manually and click Apply to use it.`
  );
}
// function generateCouponCode() {
//   if (couponGenerated) return;

//   if (!customerId) {
//     setMessage("Please select a customer first.");
//     return;
//   }

//   if (subtotal <= 0) {
//     setMessage("Add products before generating a coupon.");
//     return;
//   }

//   const customer = customers.find(
//     (item) => String(item.id) === String(customerId)
//   );

//   if (!customer) {
//     setMessage("Customer not found.");
//     return;
//   }

//   if (!customer.mobile) {
//     setMessage(
//       "Customer does not have a mobile number."
//     );
//     return;
//   }

//   const characters =
//     "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

//   let code = "SAVE-";

//   for (let i = 0; i < 6; i++) {
//     code +=
//       characters[
//         Math.floor(
//           Math.random() * characters.length
//         )
//       ];
//   }

//   // 10% of subtotal, maximum ₹100
//   const maxDiscount = Math.min(
//     100,
//     Math.floor(subtotal * 0.1)
//   );

//   if (maxDiscount < 1) {
//     setMessage(
//       "Bill amount is too low to generate a coupon."
//     );
//     return;
//   }

//   const randomDiscount =
//     Math.floor(
//       Math.random() * maxDiscount
//     ) + 1;

//   const coupon = {
//     code,
//     discount: randomDiscount,
//     customerId: customer.id,
//     customerName: customer.name,
//     mobile: customer.mobile,
//   };

//   setGeneratedCoupon(coupon);
//   setCouponCode(code);
//   setCouponDiscount(0);
//   setCouponGenerated(true);

//   setMessage(
//     `Coupon generated: ${code} — ₹${randomDiscount} OFF`
//   );
// }
function applyCoupon() {
  setMessage("");

  const enteredCode = couponCode
    .trim()
    .toUpperCase();

  if (!enteredCode) {
    setMessage("Please enter a coupon code.");
    return;
  }

  if (!generatedCoupon) {
    setMessage(
      "This coupon is not available for this bill."
    );
    return;
  }

  if (
    enteredCode !==
    generatedCoupon.code.toUpperCase()
  ) {
    setMessage("Invalid coupon code.");
    return;
  }

  setCouponDiscount(
    Number(generatedCoupon.discount)
  );

  setMessage(
    `Coupon applied successfully — ₹${Number(
      generatedCoupon.discount
    ).toFixed(2)} discount.`
  );
}
function sendCouponOnWhatsApp() {
  if (!generatedCoupon) {
    setMessage("Please generate a coupon first.");
    return;
  }

  const customer = customers.find(
    (item) =>
      String(item.id) ===
      String(generatedCoupon.customerId)
  );

  if (!customer?.mobile) {
    setMessage(
      "Customer mobile number is not available."
    );
    return;
  }

  let mobile = String(customer.mobile).replace(
    /\D/g,
    ""
  );

  // India number handling
  if (mobile.length === 10) {
    mobile = `91${mobile}`;
  }

  if (mobile.length < 12) {
    setMessage(
      "Please enter a valid 10-digit Indian mobile number."
    );
    return;
  }

  const messageText =
    `🎁 *Dhanupura Kisan Sewa Kendra*\n\n` +
    `Hello ${customer.name || "Customer"} 👋\n\n` +
    `You have received a special coupon! 🎉\n\n` +
    `🎟 Coupon Code: *${generatedCoupon.code}*\n` +
    `💰 Discount: *₹${generatedCoupon.discount} OFF*\n\n` +
    `Use this coupon while creating your bill.\n\n` +
    `Thank you for shopping with us! 🙏`;

  const whatsappUrl =
    `https://wa.me/${mobile}?text=` +
    encodeURIComponent(messageText);

  window.open(
    whatsappUrl,
    "_blank",
    "noopener,noreferrer"
  );
}
  function removeCoupon() {
    setCouponCode("");
    setCouponDiscount(0);
    setGeneratedCoupon(null);
    setCouponGenerated(false);
    setMessage("");
  }

  const totalDiscount = manualDiscount + couponDiscount;
  const total = Math.max(subtotal - totalDiscount, 0);

  const paid = Math.min(Number(paidAmount) || 0, total);
  const balance = Math.max(total - paid, 0);

  function getPaymentStatus() {
    if (total <= 0) return "pending";
    if (paid >= total) return "paid";
    if (paid > 0) return "partial";
    return "pending";
  }

  async function handleCreateCustomer(event) {
    event.preventDefault();

    try {
      setSavingCustomer(true);
      setMessage("");

      const name = customerName.trim();
      const mobile = customerMobile.trim();
      const address = customerAddress.trim();

      if (!name) throw new Error("Customer name is required.");
      if (!mobile) throw new Error("Customer mobile is required.");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!user) throw new Error("User session not found.");

      const { data, error } = await supabase
        .from("customers")
        .insert({
          user_id: user.id,
          name,
          mobile,
          address,
        })
        .select()
        .single();

      if (error) throw error;

      setCustomers((current) =>
        [...current, data].sort((a, b) =>
          (a.name || "").localeCompare(b.name || "")
        )
      );

      setCustomerId(data.id);
      setCustomerName("");
      setCustomerMobile("");
      setCustomerAddress("");
      setShowCustomerForm(false);
      setMessage("Customer created successfully.");
    } catch (error) {
      console.error("Error creating customer:", error);
      setMessage(error.message);
    } finally {
      setSavingCustomer(false);
    }
  }

  async function handleCreateProduct(event) {
    event.preventDefault();

    try {
      setSavingProduct(true);
      setMessage("");

      const name = productName.trim();
      const rateValue = Number(productRate);
      const cgstValue = Number(productCgst);
      const sgstValue = Number(productSgst);

      if (!name) throw new Error("Product name is required.");

      if (Number.isNaN(rateValue) || rateValue < 0) {
        throw new Error("Please enter a valid selling rate.");
      }
      if (Number.isNaN(cgstValue) || cgstValue < 0) {
        throw new Error("Please enter a valid CGST amount.");
      }

      if (Number.isNaN(sgstValue) || sgstValue < 0) {
        throw new Error("Please enter a valid SGST amount.");
      }

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!user) throw new Error("User session not found.");

      const { data, error } = await supabase
        .from("products")
        .insert({
          user_id: user.id,
          name,
          unit: productUnit,
          selling_rate: rateValue,
          cgst: cgstValue,
          sgst: sgstValue,
           active: true,
        })
        .select()
        .single();

      if (error) throw error;

      setProducts((current) =>
        [...current, data].sort((a, b) =>
          (a.name || "").localeCompare(b.name || "")
        )
      );

      setSelectedProductId(data.id);
      setRate(data.selling_rate ?? rateValue);
      setCgstAmount(data.cgst ?? cgstValue);
      setSgstAmount(data.sgst ?? sgstValue);
      setProductName("");
      setProductUnit("kg");
      setProductRate("");
      setProductCgst("");
      setProductSgst("");
      setShowProductForm(false);
      setMessage("Product created successfully.");
    } catch (error) {
      console.error("Error creating product:", error);
      setMessage(error.message);
    } finally {
      setSavingProduct(false);
    }
  }

  async function saveBill() {
    try {
      setSaving(true);
      setMessage("");

      if (!customerId) {
        throw new Error("Please select a customer.");
      }

      if (!items.length) {
        throw new Error("Please add at least one product.");
      }

      if (total <= 0) {
        throw new Error("Bill total must be greater than zero.");
      }

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!user) throw new Error("User session not found.");

      const now = new Date();

      const datePart =
        `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;

      const randomPart = Math.random()
        .toString(36)
        .substring(2, 8)
        .toUpperCase();

      const invoiceNumber = `INV-${datePart}-${randomPart}`;

      const {
        data: invoice,
        error: invoiceError,
      } = await supabase
        .from("invoices")
        .insert({
          user_id: user.id,
          customer_id: customerId,
          invoice_number: invoiceNumber,
          invoice_date: now.toISOString(),
          total_amount: total,
          paid_amount: paid,
          balance_amount: balance,
          payment_status: getPaymentStatus(),
          discount_amount: totalDiscount,
        })
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      const invoiceItems = items.map((item) => {
        const product = products.find(
          (p) => String(p.id) === String(item.product_id)
        );

        return {
          invoice_id: invoice.id,
          product_id: item.product_id,
          product_name:
            item.product_name ||
            product?.name ||
            "Unknown Product",
          unit: item.unit || product?.unit || "kg",
          quantity: item.quantity,
          rate: item.rate,
          amount: item.amount,
          cgst_amount: item.cgst_amount || 0, 
          sgst_amount: item.sgst_amount || 0,
          taxable_amount: item.taxable_amount || 0,
        };
      });

      const { error: itemsError } = await supabase
        .from("invoice_items")
        .insert(invoiceItems);

      if (itemsError) throw itemsError;

      if (paid > 0) {
        const { error: paymentError } = await supabase
          .from("payments")
          .insert({
            user_id: user.id,
            invoice_id: invoice.id,
            amount: paid,
            payment_method: paymentMethod,
          });

        if (paymentError) throw paymentError;
      }

      setMessage(`Bill ${invoiceNumber} saved successfully.`);

      clearBill();

      if (onSaved) onSaved(invoice);
    } catch (error) {
      console.error("Error saving bill:", error);
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  }

  function clearBill() {
  setCustomerId("");
  setSelectedProductId("");
  setQuantity("");
  setRate("");
  setCgstAmount("");
  setSgstAmount("");
  setItems([]);
  setDiscount("");
  setCouponCode("");
  setCouponDiscount(0);
  setGeneratedCoupon(null);
  setPaidAmount("");
  setPaymentMethod("cash");
  setCouponGenerated(false);
}

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-600 dark:bg-slate-950 dark:text-slate-300">
        Loading...
      </div>
    );
  }

  const selectedProduct = products.find(
    (product) =>
      String(product.id) === String(selectedProductId)
  );

  const inputClass =
    "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-blue-400 dark:focus:ring-blue-900";

  const labelClass =
    "mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-300";

  const cardClass =
    "rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 transition-colors dark:bg-slate-950 dark:text-slate-100">

      {/* HEADER */}
      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-green-100 text-xl dark:bg-green-500/15">
              🧾
            </div>

            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">
                New Bill
              </h1>

              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Create a new customer bill
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-5 px-4 py-6 sm:px-6 lg:py-8">

        {/* MESSAGE */}
        {message && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700 dark:border-blue-900 dark:bg-blue-950/50 dark:text-blue-300">
            {message}
          </div>
        )}

        {/* CUSTOMER */}
        <section className={`${cardClass} p-5`}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              Customer
            </h2>

            <button
              type="button"
              onClick={() => setShowCustomerForm(true)}
              className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              + New Customer
            </button>
          </div>

          <select
            value={customerId}
            onChange={(event) => setCustomerId(event.target.value)}
            className={inputClass}
          >
            <option value="">Select customer</option>

            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name}
                {customer.mobile ? ` - ${customer.mobile}` : ""}
              </option>
            ))}
          </select>

          {!customers.length && (
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              No customers available. Create one above.
            </p>
          )}
        </section>

        {/* PRODUCT */}
        <section className={`${cardClass} p-5`}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              Add Product
            </h2>

            <button
              type="button"
              onClick={() => setShowProductForm(true)}
              className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              + New Product
            </button>
          </div>

          <select
            value={selectedProductId}
            onChange={handleProductChange}
            className={inputClass}
          >
            <option value="">Select product</option>

            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name} - ₹
                {Number(
                  product.selling_rate ?? product.rate ?? 0
                ).toFixed(2)}
                {" / "}
                {product.unit || "kg"}
              </option>
            ))}
          </select>

          {selectedProductId && (
            <p className="mt-2 rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              Rate: ₹{Number(rate || 0).toFixed(2)} /{" "}
              {selectedProduct?.unit || "kg"}
            </p>
          )}

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Quantity</label>

              <input
                type="number"
                min="0"
                step="0.001"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                placeholder="Quantity"
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Rate ₹</label>

              <input
                type="number"
                min="0"
                step="0.01"
                value={rate}
                onChange={(event) => setRate(event.target.value)}
                placeholder="Rate"
                className={inputClass}
              />
            </div>
          </div>

          <button
            type="button"
            onClick={addProduct}
            className="mt-4 w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700"
          >
            + Add Product
          </button>
        </section>

        {/* ITEMS */}
        <section className={`${cardClass} overflow-hidden`}>
          <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              Bill Items
            </h2>
          </div>

          {!items.length ? (
            <div className="px-5 py-12 text-center">
              <div className="text-5xl">🧾</div>

              <h3 className="mt-3 font-semibold text-slate-800 dark:text-slate-200">
                No items added
              </h3>

              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Select a product above to add it to the bill.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {items.map((item, index) => (
                <div
                  key={`${item.product_id}-${index}`}
                  className="flex items-center justify-between gap-4 px-5 py-4"
                >
                  <div className="min-w-0">
                    <strong className="block text-slate-900 dark:text-white">
                      {item.product_name}
                    </strong>

                    <span className="block text-sm text-slate-500 dark:text-slate-400">
                      {item.quantity} {item.unit} × ₹
                      {Number(item.rate).toFixed(2)}
                    </span>

                    <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
                      Taxable: ₹{Number(item.taxable_amount || 0).toFixed(2)}
                      {" • "}
                      CGST: ₹{Number(item.cgst_amount || 0).toFixed(2)}
                      {" • "}
                      SGST: ₹{Number(item.sgst_amount || 0).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <strong className="whitespace-nowrap text-slate-900 dark:text-white">
                      ₹{Number(item.amount).toFixed(2)}
                    </strong>

                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      className="rounded-lg px-2 py-1 text-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* BILL SUMMARY */}
        <section className={`${cardClass} p-5`}>
          <h2 className="mb-5 text-xl font-bold text-slate-900 dark:text-white">
            Bill Summary
          </h2>

          <div className="space-y-4">

            {/* PAYMENT METHOD */}
            <div className="flex items-center justify-between gap-4">
              <span className="font-medium text-slate-600 dark:text-slate-300">
                Payment Method
              </span>

              <select
                value={paymentMethod}
                onChange={(event) =>
                  setPaymentMethod(event.target.value)
                }
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
              >
                <option value="cash">💵 Cash</option>
                <option value="upi">📱 UPI</option>
              </select>
            </div>

            {/* MANUAL DISCOUNT */}
            <div className="flex items-center justify-between gap-4">
              <span className="font-medium text-slate-600 dark:text-slate-300">
                Manual Discount
              </span>

              <input
                type="number"
                min="0"
                step="0.01"
                value={discount}
                onChange={(event) =>
                  setDiscount(event.target.value)
                }
                placeholder="0"
                className={`${inputClass} w-32 text-right`}
              />
            </div>

            {/* COUPON */}
            <div className="rounded-xl bg-slate-100 p-4 dark:bg-slate-800">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="font-bold text-slate-800 dark:text-white">
                    🎟 Coupon Discount
                  </h3>

                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Apply or generate a coupon
                  </p>
                </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={generateCouponCode}
                        disabled={couponGenerated}
                        className="rounded-lg bg-purple-600 px-3 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {couponGenerated
                          ? "✓ Coupon Generated"
                          : "🎲 Generate Coupon"}
                      </button>

                      {generatedCoupon && (
                        <div className="mt-4 rounded-xl border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950/40">
                        <div className="flex flex-wrap items-center justify-between gap-3">

                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-green-600 dark:text-green-400">
                              Coupon Generated
                            </p>

                            <p className="mt-1 text-xl font-bold tracking-wider text-green-800 dark:text-green-300">
                              {generatedCoupon.code}
                            </p>

                            <p className="mt-1 text-sm text-green-700 dark:text-green-400">
                              ₹{Number(generatedCoupon.discount).toFixed(2)} OFF
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={sendCouponOnWhatsApp}
                            className="rounded-lg bg-green-600 px-4 py-2.5 font-semibold text-white shadow-sm hover:bg-green-700"
                          >
                            📱 WhatsApp
                          </button>

                        </div>

                      </div>
                    )}
                    </div>
              </div>

              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <input
                  type="text"
                  value={couponCode}
                  onChange={(event) =>
                    setCouponCode(event.target.value.toUpperCase())
                  }
                  placeholder="Enter coupon code"
                  className={inputClass}
                />

                <button
                  type="button"
                  onClick={applyCoupon}
                  className="rounded-lg bg-purple-600 px-4 py-2 font-semibold text-white hover:bg-purple-700"
                >
                  Apply
                </button>

                {couponDiscount > 0 && (
                  <button
                    type="button"
                    onClick={removeCoupon}
                    className="rounded-lg border border-red-200 px-4 py-2 font-semibold text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/40"
                  >
                    Remove
                  </button>
                )}
              </div>

              {generatedCoupon && (
                <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-950/40 dark:text-green-300">
                  <span>Generated:</span>
                  <strong>{generatedCoupon.code}</strong>
                  <span>₹{generatedCoupon.discount} OFF</span>
                </div>
              )}

              {couponDiscount > 0 && (
                <p className="mt-2 text-sm font-medium text-green-600 dark:text-green-400">
                  ✓ Coupon applied — ₹
                  {couponDiscount.toFixed(2)} discount
                </p>
              )}
            </div>

            {/* TOTALS */}
            <div className="border-t border-slate-200 pt-4 dark:border-slate-700">
              <div className="flex justify-between text-slate-600 dark:text-slate-300">
                <span>Subtotal</span>
                <span>₹{subtotal.toFixed(2)}</span>
              </div>

              <div className="mt-2 flex justify-between text-slate-600 dark:text-slate-300">
                <span>Total Discount</span>
                <span>- ₹{totalDiscount.toFixed(2)}</span>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-4 dark:border-slate-700">
                <strong className="text-lg text-slate-900 dark:text-white">
                  Total
                </strong>

                <strong className="text-2xl text-blue-600 dark:text-blue-400">
                  ₹{total.toFixed(2)}
                </strong>
              </div>
            </div>

            {/* PAID */}
            <div className="flex items-center justify-between gap-4">
              <span className="font-medium text-slate-600 dark:text-slate-300">
                Paid Amount
              </span>

              <input
                type="number"
                min="0"
                step="0.01"
                value={paidAmount}
                onChange={(event) =>
                  setPaidAmount(event.target.value)
                }
                placeholder="0"
                className={`${inputClass} w-32 text-right`}
              />
            </div>

            {/* BALANCE */}
            <div className="flex items-center justify-between rounded-lg bg-red-50 px-4 py-3 dark:bg-red-950/40">
              <strong className="text-red-700 dark:text-red-300">
                Balance
              </strong>

              <strong className="text-lg text-red-700 dark:text-red-300">
                ₹{balance.toFixed(2)}
              </strong>
            </div>

            {/* QR */}
            <button
              type="button"
              onClick={() => {
                setEditingUpi(false);
                setNewUpiId("");
                setShowQr(true);
              }}
              disabled={total <= 0}
              className="w-full rounded-lg bg-indigo-600 px-4 py-3 font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              📱 Open QR to Pay ₹{total.toFixed(2)}
            </button>
          </div>
        </section>

        {/* ACTIONS */}
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={clearBill}
            className="rounded-lg border border-slate-300 bg-white px-6 py-3 font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            Clear Bill
          </button>

          <button
            type="button"
            onClick={saveBill}
            disabled={saving || !customerId || !items.length}
            className="rounded-lg bg-green-600 px-6 py-3 font-semibold text-white hover:bg-green-700 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Bill"}
          </button>
        </div>
      </main>

      {/* CUSTOMER MODAL */}
      {showCustomerForm && (
        <Modal
          title="Add Customer"
          onClose={() => setShowCustomerForm(false)}
        >
          <form
            onSubmit={handleCreateCustomer}
            className="space-y-4"
          >
            <Field
              label="Customer Name"
              value={customerName}
              onChange={setCustomerName}
              placeholder="Example: Rajesh Kumar"
              autoFocus
            />

            <Field
              label="Mobile Number"
              value={customerMobile}
              onChange={setCustomerMobile}
              placeholder="Example: 9876543210"
              type="tel"
            />

            <div>
              <label className={labelClass}>Address</label>

              <textarea
                value={customerAddress}
                onChange={(e) =>
                  setCustomerAddress(e.target.value)
                }
                placeholder="Customer address"
                rows={3}
                className={`${inputClass} resize-none`}
              />
            </div>

            <ModalButtons
              onCancel={() => setShowCustomerForm(false)}
              saving={savingCustomer}
              label="Save Customer"
            />
          </form>
        </Modal>
      )}

      {/* PRODUCT MODAL */}
      {showProductForm && (
        <Modal
          title="Add Product"
          onClose={() => setShowProductForm(false)}
        >
          <form
            onSubmit={handleCreateProduct}
            className="space-y-4"
          >
            <Field
              label="Product Name"
              value={productName}
              onChange={setProductName}
              placeholder="Example: Wheat"
              autoFocus
            />

            <div>
              <label className={labelClass}>Unit</label>

              <select
                value={productUnit}
                onChange={(e) =>
                  setProductUnit(e.target.value)
                }
                className={inputClass}
              >
                <option value="kg">kg</option>
                <option value="g">g</option>
                <option value="L">L</option>
                <option value="ml">ml</option>
                <option value="pcs">pcs</option>
                <option value="box">box</option>
                <option value="dozen">dozen</option>
              </select>
            </div>

            <Field
              label="Selling Rate ₹"
              value={productRate}
              onChange={setProductRate}
              placeholder="120"
              type="number"
            />
            <Field
            label="CGST ₹"
            value={productCgst}
            onChange={setProductCgst}
            placeholder="9"
            type="number"
          />

          <Field
            label="SGST ₹"
            value={productSgst}
            onChange={setProductSgst}
            placeholder="9"
            type="number"
          />

            <ModalButtons
              onCancel={() => setShowProductForm(false)}
              saving={savingProduct}
              label="Save Product"
            />
          </form>
        </Modal>
      )}

      {/* QR MODAL */}
      {showQr && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setShowQr(false)}
        >
          <div
            className="relative max-h-[95vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 text-center shadow-2xl dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setShowQr(false)}
              className="absolute right-4 top-4 rounded-lg p-2 text-2xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              ×
            </button>

            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
              📱 Scan & Pay
            </h2>

            <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
              Amount to Pay
            </p>

            <div className="mt-1 text-3xl font-bold text-green-600 dark:text-green-400">
              ₹{total.toFixed(2)}
            </div>

            <img
              src={
                `https://api.qrserver.com/v1/create-qr-code/` +
                `?size=400x400&data=` +
                encodeURIComponent(
                  `upi://pay?pa=${encodeURIComponent(upiId)}` +
                  `&pn=Dhanupura%20Kisan%20Sewa%20Kendra` +
                  `&am=${total.toFixed(2)}&cu=INR`
                )
              }
              alt="UPI Payment QR"
              className="mx-auto my-5 h-64 w-64 rounded-lg border border-slate-200 bg-white p-2 dark:border-slate-700"
            />

            <div className="rounded-lg bg-slate-100 p-3 dark:bg-slate-800">
              <span className="block text-xs text-slate-500 dark:text-slate-400">
                UPI ID
              </span>

              {!editingUpi ? (
                <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
                  <strong className="break-all text-slate-800 dark:text-white">
                    {upiId}
                  </strong>

                  <button
                    type="button"
                    onClick={() => {
                      setNewUpiId(upiId);
                      setEditingUpi(true);
                    }}
                    className="rounded-lg border border-blue-200 px-3 py-1.5 text-sm font-semibold text-blue-600 hover:bg-blue-50 dark:border-blue-800 dark:hover:bg-blue-950"
                  >
                    ✏️ Change UPI
                  </button>
                </div>
              ) : (
                <div className="mt-2 space-y-2">
                  <input
                    type="text"
                    value={newUpiId}
                    onChange={(e) => setNewUpiId(e.target.value)}
                    placeholder="example@upi"
                    className={inputClass}
                  />

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setNewUpiId(upiId);
                        setEditingUpi(false);
                      }}
                      className="flex-1 rounded-lg border border-slate-300 px-3 py-2 font-semibold text-slate-700 dark:border-slate-600 dark:text-slate-200"
                    >
                      Cancel
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const value = newUpiId.trim();

                        if (!value || !value.includes("@")) {
                          setMessage("Please enter a valid UPI ID.");
                          return;
                        }

                        setUpiId(value);
                        setEditingUpi(false);
                        setMessage("UPI ID updated successfully.");
                      }}
                      className="flex-1 rounded-lg bg-blue-600 px-3 py-2 font-semibold text-white hover:bg-blue-700"
                    >
                      Save UPI
                    </button>
                  </div>
                </div>
              )}
            </div>

            <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
              Scan this QR using any supported UPI app to pay the final bill amount.
            </p>

            <button
              type="button"
              onClick={() => setShowQr(false)}
              className="mt-5 w-full rounded-lg bg-slate-800 px-4 py-3 font-semibold text-white hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  autoFocus = false,
}) {
  const className =
    "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-blue-400";

  return (
    <div>
      <label className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-300">
        {label}
      </label>

      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className={className}
      />
    </div>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            {title}
          </h2>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-2xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            ×
          </button>
        </div>

        {children}
      </div>
    </div>
  );
}

function ModalButtons({ onCancel, saving, label }) {
  return (
    <div className="flex gap-3 pt-2">
      <button
        type="button"
        onClick={onCancel}
        disabled={saving}
        className="flex-1 rounded-lg border border-slate-300 px-4 py-2.5 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
      >
        Cancel
      </button>

      <button
        type="submit"
        disabled={saving}
        className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {saving ? "Saving..." : label}
      </button>
    </div>
  );
}

export default NewBill;