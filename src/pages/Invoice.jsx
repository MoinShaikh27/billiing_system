import { useEffect, useState } from "react";
import { supabase } from "../services/supabase";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

function Invoice({ invoiceId }) {
  const [invoice, setInvoice] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadInvoice() {
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
              *,
              customers (
                name,
                mobile,
                address
              )
            `)
            .eq("id", invoiceId)
            .eq("user_id", user.id)
            .single();

        if (invoiceError) throw invoiceError;

        const { data: itemData, error: itemError } =
          await supabase
            .from("invoice_items")
            .select("*")
            .eq("invoice_id", invoiceId)
            .order("created_at", { ascending: true });

        if (itemError) throw itemError;

        if (!cancelled) {
          setInvoice(invoiceData);
          setItems(itemData || []);
        }
      } catch (error) {
        console.error("Error loading invoice:", error);
        if (!cancelled) {
          setMessage(error.message || "Unable to load invoice.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    if (invoiceId) loadInvoice();

    return () => {
      cancelled = true;
    };
  }, [invoiceId]);

  function formatDate(value) {
    if (!value) return "-";

    return new Date(value).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }

  function formatTime(value) {
    if (!value) return "";

    return new Date(value).toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }

  function printInvoice() {
    window.print();
  }

  // ==========================================================
  // CONVERT UNSUPPORTED CSS COLORS
  // ==========================================================

  function resolveCSSValue(property, value) {
    if (!value || !value.includes("oklch")) {
      return value;
    }

    try {
      const temp = document.createElement("div");

      temp.style.position = "absolute";
      temp.style.visibility = "hidden";
      temp.style.setProperty(property, value);

      document.body.appendChild(temp);

      const resolved = getComputedStyle(temp).getPropertyValue(
        property
      );

      document.body.removeChild(temp);

      if (resolved && !resolved.includes("oklch")) {
        return resolved;
      }
    } catch {
      // Continue to fallback.
    }

    // Last-resort replacement so html2canvas never receives oklch.
    return value.replace(
      /oklch\([^)]*\)/gi,
      "#000000"
    );
  }

  // ==========================================================
  // COPY RENDERED STYLES
  // ==========================================================

  function copyStyles(source, target) {
    if (!(source instanceof Element)) return;

    const computed = window.getComputedStyle(source);

    for (let i = 0; i < computed.length; i++) {
      const property = computed[i];

      // Skip CSS variables. They can contain Tailwind oklch values.
      if (property.startsWith("--")) continue;

      let value = computed.getPropertyValue(property);

      if (value.includes("oklch")) {
        value = resolveCSSValue(property, value);
      }

      try {
        target.style.setProperty(property, value);
      } catch {
        // Ignore unsupported CSS properties.
      }
    }

    const sourceChildren = source.children;
    const targetChildren = target.children;

    for (let i = 0; i < sourceChildren.length; i++) {
      if (targetChildren[i]) {
        copyStyles(
          sourceChildren[i],
          targetChildren[i]
        );
      }
    }
  }

  // ==========================================================
  // CREATE EXPORT CANVAS
  // ==========================================================

  async function createCanvas() {
    const original = document.getElementById("invoice-pdf");

    if (!original) {
      throw new Error("Invoice element not found.");
    }

    const clone = original.cloneNode(true);

    // Copy actual browser-rendered styles first.
    copyStyles(original, clone);

    // Remove Tailwind classes.
    // The styles are already copied inline above.
    clone.querySelectorAll("*").forEach((element) => {
      element.removeAttribute("class");
    });

    clone.removeAttribute("class");

    // Remove elements that should not be exported.
    clone
      .querySelectorAll(".no-print")
      .forEach((element) => element.remove());

    clone.style.backgroundColor = "#ffffff";
    clone.style.color = "#111827";
    clone.style.width = `${original.scrollWidth}px`;
    clone.style.maxWidth = "none";
    clone.style.margin = "0";
    clone.style.boxShadow = "none";

    const wrapper = document.createElement("div");

    wrapper.style.position = "fixed";
    wrapper.style.left = "-100000px";
    wrapper.style.top = "0";
    wrapper.style.width = `${original.scrollWidth}px`;
    wrapper.style.backgroundColor = "#ffffff";
    wrapper.style.padding = "0";
    wrapper.style.margin = "0";
    wrapper.style.zIndex = "-9999";

    wrapper.appendChild(clone);
    document.body.appendChild(wrapper);

    // Wait for browser layout.
    await new Promise((resolve) =>
      requestAnimationFrame(resolve)
    );

    await new Promise((resolve) =>
      setTimeout(resolve, 100)
    );

    if (document.fonts?.ready) {
      await document.fonts.ready;
    }

    try {
      const canvas = await html2canvas(clone, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
        allowTaint: false,
        logging: false,
        imageTimeout: 15000,
        scrollX: 0,
        scrollY: 0,
      });

      if (!canvas.width || !canvas.height) {
        throw new Error(
          "Generated invoice image is empty."
        );
      }

      return canvas;
    } finally {
      document.body.removeChild(wrapper);
    }
  }

  // ==========================================================
  // GENERATE PDF
  // ==========================================================

  async function generatePDF() {
    const canvas = await createCanvas();

    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
      compress: true,
    });

    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 8;
    const usableWidth = pageWidth - margin * 2;

    const imageHeight =
      (canvas.height * usableWidth) /
      canvas.width;

    const imageData = canvas.toDataURL(
      "image/jpeg",
      0.92
    );

    const usablePageHeight =
      pageHeight - margin * 2;

    let remaining = imageHeight;
    let offset = 0;

    while (remaining > 0) {
      if (offset > 0) {
        pdf.addPage();
      }

      const height = Math.min(
        usablePageHeight,
        remaining
      );

      const sourceHeight =
        (canvas.width * height) /
        usableWidth;

      const pageCanvas =
        document.createElement("canvas");

      pageCanvas.width = canvas.width;
      pageCanvas.height = Math.ceil(sourceHeight);

      const context =
        pageCanvas.getContext("2d");

      context.fillStyle = "#ffffff";
      context.fillRect(
        0,
        0,
        pageCanvas.width,
        pageCanvas.height
      );

      context.drawImage(
        canvas,
        0,
        offset,
        canvas.width,
        sourceHeight,
        0,
        0,
        pageCanvas.width,
        pageCanvas.height
      );

      const pageImage =
        pageCanvas.toDataURL(
          "image/jpeg",
          0.92
        );

      pdf.addImage(
        pageImage,
        "JPEG",
        margin,
        margin,
        usableWidth,
        height,
        undefined,
        "FAST"
      );

      offset += sourceHeight;
      remaining -= height;
    }

    return pdf;
  }

  // ==========================================================
  // DOWNLOAD PDF
  // ==========================================================

  async function downloadPDF() {
    if (!invoice || generating) return;

    try {
      setGenerating(true);

      const pdf = await generatePDF();

      const invoiceNumber =
        invoice.invoice_number || "invoice";

      pdf.save(`${invoiceNumber}.pdf`);
    } catch (error) {
      console.error("PDF generation error:", error);

      alert(
        "Could not generate PDF.\n\n" +
          (error.message || "Unknown error")
      );
    } finally {
      setGenerating(false);
    }
  }

  // ==========================================================
  // DOWNLOAD IMAGE
  // ==========================================================

  async function downloadImage() {
    if (!invoice || generating) return;

    try {
      setGenerating(true);

      const canvas = await createCanvas();

      const blob = await new Promise((resolve) =>
        canvas.toBlob(
          resolve,
          "image/png"
        )
      );

      if (!blob) {
        throw new Error(
          "Could not create invoice image."
        );
      }

      const invoiceNumber =
        invoice.invoice_number || "invoice";

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = `${invoiceNumber}.png`;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setTimeout(
        () => URL.revokeObjectURL(url),
        1000
      );
    } catch (error) {
      console.error(
        "Image generation error:",
        error
      );

      alert(
        "Could not generate invoice image.\n\n" +
          (error.message || "Unknown error")
      );
    } finally {
      setGenerating(false);
    }
  }

  // ==========================================================
  // WHATSAPP PDF
  // ==========================================================

  async function sharePDFOnWhatsApp() {
    if (!invoice || generating) return;

    try {
      setGenerating(true);

      const pdf = await generatePDF();

      const invoiceNumber =
        invoice.invoice_number || "invoice";

      const blob = pdf.output("blob");

      const file = new File(
        [blob],
        `${invoiceNumber}.pdf`,
        {
          type: "application/pdf",
        }
      );

      if (
        navigator.share &&
        navigator.canShare &&
        navigator.canShare({ files: [file] })
      ) {
        try {
          await navigator.share({
            title: `Invoice ${invoiceNumber}`,
            text: "Please find your invoice.",
            files: [file],
          });

          return;
        } catch (error) {
          if (error.name === "AbortError") return;

          console.warn(
            "Native sharing failed:",
            error
          );
        }
      }

      pdf.save(`${invoiceNumber}.pdf`);
      openWhatsApp();
    } catch (error) {
      console.error(
        "WhatsApp PDF error:",
        error
      );

      alert(
        "Could not generate invoice PDF.\n\n" +
          (error.message || "Unknown error")
      );
    } finally {
      setGenerating(false);
    }
  }

  // ==========================================================
  // WHATSAPP IMAGE
  // ==========================================================

  async function shareImageOnWhatsApp() {
    if (!invoice || generating) return;

    try {
      setGenerating(true);

      const canvas = await createCanvas();

      const blob = await new Promise((resolve) =>
        canvas.toBlob(
          resolve,
          "image/png"
        )
      );

      if (!blob) {
        throw new Error(
          "Could not create invoice image."
        );
      }

      const invoiceNumber =
        invoice.invoice_number || "invoice";

      const file = new File(
        [blob],
        `${invoiceNumber}.png`,
        {
          type: "image/png",
        }
      );

      if (
        navigator.share &&
        navigator.canShare &&
        navigator.canShare({ files: [file] })
      ) {
        try {
          await navigator.share({
            title: `Invoice ${invoiceNumber}`,
            text: "Please find your invoice.",
            files: [file],
          });

          return;
        } catch (error) {
          if (error.name === "AbortError") return;

          console.warn(
            "Native sharing failed:",
            error
          );
        }
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = `${invoiceNumber}.png`;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setTimeout(
        () => URL.revokeObjectURL(url),
        1000
      );

      openWhatsApp();
    } catch (error) {
      console.error(
        "WhatsApp image error:",
        error
      );

      alert(
        "Could not generate invoice image.\n\n" +
          (error.message || "Unknown error")
      );
    } finally {
      setGenerating(false);
    }
  }

  // ==========================================================
  // WHATSAPP FALLBACK
  // ==========================================================

  function openWhatsApp() {
    const customer = invoice.customers || {};

    const phone = String(
      customer.mobile || ""
    ).replace(/\D/g, "");

    const invoiceNumber =
      invoice.invoice_number || "invoice";

    const text =
      `Hello ${customer.name || ""},\n\n` +
      `Please find invoice ${invoiceNumber}.\n\n` +
      `Total: ₹${Number(
        invoice.total_amount || 0
      ).toFixed(2)}\n\n` +
      `Thank you for your business.`;

    const url = phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(
          text
        )}`
      : `https://wa.me/?text=${encodeURIComponent(
          text
        )}`;

    window.open(
      url,
      "_blank",
      "noopener,noreferrer"
    );
  }

  // ==========================================================
  // LOADING
  // ==========================================================

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <p className="text-slate-600 dark:text-slate-300">
          Loading invoice...
        </p>
      </div>
    );
  }

  // ==========================================================
  // ERROR
  // ==========================================================

  if (message) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 dark:bg-slate-950">
        <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-xl font-bold text-red-600">
            Unable to load invoice
          </h2>

          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            {message}
          </p>

        </div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        Invoice not found.
      </div>
    );
  }

  const customer = invoice.customers || {};

  const subtotal = items.reduce(
    (sum, item) =>
      sum + Number(item.amount || 0),
    0
  );

  const discountAmount = Number(
    invoice.discount_amount ??
      invoice.discount ??
      0
  );

  const totalAmount = Number(
    invoice.total_amount || 0
  );

  const paidAmount = Number(
    invoice.paid_amount || 0
  );

  const balanceAmount = Number(
    invoice.balance_amount || 0
  );

  const status =
    invoice.payment_status || "pending";

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-4 dark:bg-slate-950 sm:px-6">

      {/* ACTION BUTTONS */}
      <div className="no-print mx-auto mb-4 flex w-full max-w-6xl justify-end">
        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={printInvoice}
            disabled={generating}
            className="rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-50"
          >
            🖨 Print Invoice
          </button>

          <button
            type="button"
            onClick={downloadPDF}
            disabled={generating}
            className="rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
          >
            📄 PDF
          </button>

          <button
            type="button"
            onClick={sharePDFOnWhatsApp}
            disabled={generating}
            className="rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
          >
            📱 WhatsApp PDF
          </button>

          <button
            type="button"
            onClick={downloadImage}
            disabled={generating}
            className="rounded-lg bg-blue-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-50"
          >
            🖼 Image
          </button>

          <button
            type="button"
            onClick={shareImageOnWhatsApp}
            disabled={generating}
            className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            🖼 WhatsApp Image
          </button>

        </div>
      </div>

      {generating && (
        <div className="no-print mx-auto mb-4 max-w-6xl rounded-lg bg-blue-50 px-4 py-3 text-center text-sm font-medium text-blue-700">
          Generating invoice...
        </div>
      )}

      {/* INVOICE */}
      <div
        id="invoice-pdf"
        className="mx-auto w-full max-w-5xl bg-white p-6 text-slate-900 shadow-sm sm:p-10"
      >

        {/* HEADER */}
        <div className="border-b-2 border-slate-800 pb-6 text-center">
          <h1 className="text-2xl font-bold sm:text-3xl">
            धनपुरा किसान सेवा केन्द्र
          </h1>

          <h2 className="mt-2 text-xl font-semibold">
            Billing Invoice
          </h2>

          <p className="mt-2 text-sm text-slate-600">
            GST No.: 09EJCPK3134C1ZL
          </p>
        </div>

        {/* CUSTOMER / INVOICE DETAILS */}
        <div className="grid gap-8 py-7 sm:grid-cols-2">

          <div>
            <h3 className="mb-4 text-lg font-semibold">
              Customer Details
            </h3>

            <DetailRow
              label="Customer Name"
              value={customer.name || "-"}
            />

            <DetailRow
              label="Mobile Number"
              value={customer.mobile || "-"}
            />

            <DetailRow
              label="Address"
              value={customer.address || "-"}
            />
          </div>

          <div>
            <DetailRow
              label="Invoice No."
              value={invoice.invoice_number || "-"}
              strong
            />

            <DetailRow
              label="Date"
              value={formatDate(
                invoice.invoice_date ||
                  invoice.created_at
              )}
              strong
            />

            <DetailRow
              label="Time"
              value={formatTime(
                invoice.invoice_time ||
                  invoice.created_at
              )}
              strong
            />

            <DetailRow
              label="Status"
              value={status.toUpperCase()}
              strong
              valueClass={
                status === "paid"
                  ? "text-green-600"
                  : status === "partial"
                    ? "text-yellow-600"
                    : "text-red-600"
              }
            />
          </div>

        </div>

        {/* ITEMS */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">

            <thead>
              <tr className="bg-slate-100">

                <th className="border border-slate-300 px-3 py-3 text-center">
                  क्र.
                </th>

                <th className="border border-slate-300 px-3 py-3 text-left">
                  वस्तु
                </th>

                <th className="border border-slate-300 px-3 py-3 text-center">
                  Unit
                </th>

                <th className="border border-slate-300 px-3 py-3 text-right">
                  मात्रा
                </th>

                <th className="border border-slate-300 px-3 py-3 text-right">
                  विक्रय दर ₹
                </th>

                <th className="border border-slate-300 px-3 py-3 text-right">
                  कुल ₹
                </th>

              </tr>
            </thead>

            <tbody>

              {items.map((item, index) => (
                <tr key={item.id}>

                  <td className="border border-slate-300 px-3 py-3 text-center">
                    {index + 1}
                  </td>

                  <td className="border border-slate-300 px-3 py-3">
                    {item.product_name || "-"}
                  </td>

                  <td className="border border-slate-300 px-3 py-3 text-center">
                    {item.unit || "-"}
                  </td>

                  <td className="border border-slate-300 px-3 py-3 text-right">
                    {Number(item.quantity || 0)}
                  </td>

                  <td className="border border-slate-300 px-3 py-3 text-right">
                    ₹ {Number(item.rate || 0).toFixed(2)}
                  </td>

                  <td className="border border-slate-300 px-3 py-3 text-right">
                    ₹ {Number(item.amount || 0).toFixed(2)}
                  </td>

                </tr>
              ))}

              {!items.length && (
                <tr>
                  <td
                    colSpan="6"
                    className="border border-slate-300 px-3 py-8 text-center text-slate-500"
                  >
                    No items found.
                  </td>
                </tr>
              )}

            </tbody>
          </table>
        </div>

        {/* TOTALS */}
        <div className="mt-8 grid gap-8 sm:grid-cols-2">

          <div>
            <h3 className="font-bold">
              Payment Status
            </h3>

            <p className="mt-2 text-slate-600">
              {status === "paid"
                ? "Payment completed"
                : status === "partial"
                  ? "Partially paid"
                  : "Payment pending"}
            </p>
          </div>

          <div>

            <TotalRow
              label="कुल बिल"
              value={subtotal}
            />

            <TotalRow
              label="Discount"
              value={discountAmount}
              prefix="- ₹ "
            />

            <TotalRow
              label="कुल बिल राशि"
              value={totalAmount}
              bold
            />

            <TotalRow
              label="ग्राहक द्वारा दी गई राशि"
              value={paidAmount}
            />

            <div className="flex items-center justify-between border-t-2 border-slate-800 py-3">
              <span className="font-semibold">
                बाकी राशि
              </span>

              <strong
                className={
                  balanceAmount > 0
                    ? "text-red-600"
                    : "text-green-600"
                }
              >
                ₹ {balanceAmount.toFixed(2)}
              </strong>
            </div>

          </div>
        </div>

        {/* FOOTER */}
        <div className="mt-10 border-t border-slate-300 pt-6 text-center">

          <strong>
            धन्यवाद! फिर से पधारें।
          </strong>

          <p className="mt-1 text-sm text-slate-600">
            Thank you for your business!
          </p>

          <small className="mt-2 block text-xs text-slate-400">
            This is a computer-generated invoice.
          </small>

        </div>

      </div>

      {/* PRINT CSS */}
      <style>{`
        @media print {
          body {
            background: white !important;
          }

          .no-print {
            display: none !important;
          }

          #invoice-pdf {
            width: 100% !important;
            max-width: none !important;
            margin: 0 !important;
            box-shadow: none !important;
          }

          @page {
            size: A4;
            margin: 10mm;
          }
        }
      `}</style>
    </div>
  );
}

function DetailRow({
  label,
  value,
  strong = false,
  valueClass = "text-slate-900",
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 py-2.5">
      <span className="text-slate-600">
        {label}
      </span>

      <span
        className={`text-right ${
          strong ? "font-bold" : "font-medium"
        } ${valueClass}`}
      >
        {value}
      </span>
    </div>
  );
}

function TotalRow({
  label,
  value,
  prefix = "₹ ",
  bold = false,
}) {
  return (
    <div
      className={`flex items-center justify-between border-t border-slate-300 py-3 ${
        bold ? "text-lg" : ""
      }`}
    >
      <span
        className={
          bold
            ? "font-bold"
            : "font-semibold text-slate-800"
        }
      >
        {label}
      </span>

      <strong>
        {prefix}
        {Number(value || 0).toFixed(2)}
      </strong>
    </div>
  );
}

export default Invoice;