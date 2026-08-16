import { useEffect, useState } from "react";
import { supabase } from "../services/supabase";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { QRCodeSVG } from "qrcode.react";

function Invoice({ invoiceId, onBack }) {
  const [invoice, setInvoice] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [generating, setGenerating] = useState(false);

  // ==========================================================
  // LOAD INVOICE
  // ==========================================================

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

        if (userError) {
          throw userError;
        }

        if (!user) {
          throw new Error("User session not found.");
        }

        const {
          data: invoiceData,
          error: invoiceError,
        } = await supabase
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

        if (invoiceError) {
          throw invoiceError;
        }

        const {
          data: itemData,
          error: itemError,
        } = await supabase
          .from("invoice_items")
          .select("*")
          .eq("invoice_id", invoiceId)
          .order("created_at", {
            ascending: true,
          });

        if (itemError) {
          throw itemError;
        }

        if (!cancelled) {
          setInvoice(invoiceData);
          setItems(itemData || []);
        }
      } catch (error) {
        console.error(
          "Error loading invoice:",
          error
        );

        if (!cancelled) {
          setMessage(
            error.message ||
              "Unable to load invoice."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    if (invoiceId) {
      loadInvoice();
    }

    return () => {
      cancelled = true;
    };
  }, [invoiceId]);

  // ==========================================================
  // FORMAT DATE
  // ==========================================================

  function formatDate(value) {
    if (!value) {
      return "-";
    }

    return new Date(value).toLocaleDateString(
      "en-IN",
      {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }
    );
  }

  // ==========================================================
  // FORMAT TIME
  // ==========================================================

  function formatTime(value) {
    if (!value) {
      return "";
    }

    return new Date(value).toLocaleTimeString(
      "en-IN",
      {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }
    );
  }

  // ==========================================================
  // PRINT
  // ==========================================================

  function printInvoice() {
    window.print();
  }

  // ==========================================================
  // CONVERT OKLCH COLORS
  // ==========================================================

  function convertOklchToRgb(value) {
    if (
      !value ||
      !value.toLowerCase().includes("oklch")
    ) {
      return value;
    }

    const pattern =
      /oklch\(\s*([0-9.]+%?)\s+([0-9.]+%?)\s+([0-9.]+)(?:deg)?(?:\s*\/\s*([0-9.]+%?))?\s*\)/gi;

    let converted = value;

    converted = converted.replace(
      pattern,
      (
        full,
        lValue,
        cValue,
        hValue,
        alphaValue
      ) => {
        try {
          let L = parseFloat(lValue);

          if (lValue.endsWith("%")) {
            L /= 100;
          }

          let C = parseFloat(cValue);

          if (cValue.endsWith("%")) {
            C = (C / 100) * 0.4;
          }

          const H = parseFloat(hValue);
          const h = (H * Math.PI) / 180;

          const a =
            C * Math.cos(h);

          const b =
            C * Math.sin(h);

          const l_ =
            L +
            0.3963377774 * a +
            0.2158037573 * b;

          const m_ =
            L -
            0.1055613458 * a -
            0.0638541728 * b;

          const s_ =
            L -
            0.0894841775 * a -
            1.291485548 * b;

          const l = l_ * l_ * l_;
          const m = m_ * m_ * m_;
          const s = s_ * s_ * s_;

          let r =
            4.0767416621 * l -
            3.3077115913 * m +
            0.2309699292 * s;

          let g =
            -1.2684380046 * l +
            2.6097574011 * m -
            0.3413193965 * s;

          let blue =
            -0.0041960863 * l -
            0.7034186147 * m +
            1.707614701 * s;

          function toSrgb(channel) {
            if (channel <= 0.0031308) {
              return 12.92 * channel;
            }

            return (
              1.055 *
                Math.pow(
                  Math.max(channel, 0),
                  1 / 2.4
                ) -
              0.055
            );
          }

          r = Math.round(
            Math.max(
              0,
              Math.min(1, toSrgb(r))
            ) * 255
          );

          g = Math.round(
            Math.max(
              0,
              Math.min(1, toSrgb(g))
            ) * 255
          );

          blue = Math.round(
            Math.max(
              0,
              Math.min(1, toSrgb(blue))
            ) * 255
          );

          let alpha = 1;

          if (alphaValue !== undefined) {
            alpha = parseFloat(alphaValue);

            if (alphaValue.endsWith("%")) {
              alpha /= 100;
            }
          }

          if (alpha < 1) {
            return `rgba(${r}, ${g}, ${blue}, ${alpha})`;
          }

          return `rgb(${r}, ${g}, ${blue})`;
        } catch {
          return full;
        }
      }
    );

    if (
      converted
        .toLowerCase()
        .includes("oklch")
    ) {
      return null;
    }

    return converted;
  }

  // ==========================================================
  // COPY COMPUTED STYLES
  // ==========================================================

  function copyComputedStyles(
    source,
    target
  ) {
    if (
      !(source instanceof Element) ||
      !(target instanceof Element)
    ) {
      return;
    }

    const computed =
      window.getComputedStyle(source);

    for (
      let i = 0;
      i < computed.length;
      i++
    ) {
      const property =
        computed[i];

      if (
        property.startsWith("--")
      ) {
        continue;
      }

      let value =
        computed.getPropertyValue(
          property
        );

      if (
        value &&
        value
          .toLowerCase()
          .includes("oklch")
      ) {
        const converted =
          convertOklchToRgb(value);

        if (converted === null) {
          continue;
        }

        value = converted;
      }

      try {
        target.style.setProperty(
          property,
          value,
          computed.getPropertyPriority(
            property
          )
        );
      } catch {
        // Ignore unsupported properties.
      }
    }

    const sourceChildren =
      source.children;

    const targetChildren =
      target.children;

    for (
      let i = 0;
      i < sourceChildren.length;
      i++
    ) {
      if (targetChildren[i]) {
        copyComputedStyles(
          sourceChildren[i],
          targetChildren[i]
        );
      }
    }
  }

  // ==========================================================
  // SVG QR -> PNG IMAGE
  // ==========================================================

  async function svgToPngImage(svg) {
    if (!svg) {
      return null;
    }

    try {
      const serializer =
        new XMLSerializer();

      let svgString =
        serializer.serializeToString(
          svg
        );

      if (
        !svgString.includes(
          "xmlns="
        )
      ) {
        svgString =
          svgString.replace(
            "<svg",
            '<svg xmlns="http://www.w3.org/2000/svg"'
          );
      }

      /*
       * Explicitly force white background.
       */
      if (
        !svgString.includes(
          'background="'
        )
      ) {
        svgString =
          svgString.replace(
            "<svg",
            '<svg style="background:#ffffff"'
          );
      }

      const svgBlob =
        new Blob(
          [svgString],
          {
            type: "image/svg+xml;charset=utf-8",
          }
        );

      const url =
        URL.createObjectURL(
          svgBlob
        );

      try {
        const image =
          new Image();

        image.decoding =
          "async";

        await new Promise(
          (resolve, reject) => {
            image.onload =
              resolve;

            image.onerror =
              reject;

            image.src = url;
          }
        );

        const width =
          230;

        const height =
          230;

        /*
         * Render at 2x resolution.
         */
        const canvas =
          document.createElement(
            "canvas"
          );

        canvas.width =
          width * 2;

        canvas.height =
          height * 2;

        const context =
          canvas.getContext(
            "2d"
          );

        /*
         * White background is critical.
         */
        context.fillStyle =
          "#ffffff";

        context.fillRect(
          0,
          0,
          canvas.width,
          canvas.height
        );

        context.imageSmoothingEnabled =
          false;

        context.drawImage(
          image,
          0,
          0,
          canvas.width,
          canvas.height
        );

        const png =
          canvas.toDataURL(
            "image/png"
          );

        const pngImage =
          document.createElement(
            "img"
          );

        pngImage.src =
          png;

        pngImage.width =
          width;

        pngImage.height =
          height;

        pngImage.style.width =
          `${width}px`;

        pngImage.style.height =
          `${height}px`;

        pngImage.style.display =
          "block";

        pngImage.style.backgroundColor =
          "#ffffff";

        pngImage.style.opacity =
          "1";

        pngImage.style.visibility =
          "visible";

        pngImage.alt =
          "UPI Payment QR Code";

        return pngImage;
      } finally {
        URL.revokeObjectURL(
          url
        );
      }
    } catch (error) {
      console.error(
        "SVG QR conversion failed:",
        error
      );

      return null;
    }
  }

  // ==========================================================
  // PREPARE QR FOR EXPORT
  // ==========================================================

  async function prepareQRCodeForExport(
    original,
    clone
  ) {
    const originalSVG =
      original.querySelector(
        "[data-payment-qr='true'] svg"
      );

    const clonedQR =
      clone.querySelector(
        "[data-payment-qr='true']"
      );

    if (
      !originalSVG ||
      !clonedQR
    ) {
      console.warn(
        "QR SVG/container not found."
      );

      return;
    }

    const pngImage =
      await svgToPngImage(
        originalSVG
      );

    if (!pngImage) {
      console.warn(
        "Could not convert QR SVG to PNG."
      );

      return;
    }

    /*
     * Completely remove the SVG
     * from the export clone.
     */
    clonedQR.innerHTML = "";

    clonedQR.style.backgroundColor =
      "#ffffff";

    clonedQR.style.color =
      "#000000";

    clonedQR.style.opacity =
      "1";

    clonedQR.style.visibility =
      "visible";

    clonedQR.style.display =
      "flex";

    clonedQR.style.alignItems =
      "center";

    clonedQR.style.justifyContent =
      "center";

    clonedQR.style.boxSizing =
      "border-box";

    clonedQR.appendChild(
      pngImage
    );
  }

  // ==========================================================
  // CREATE EXPORT CANVAS
  // ==========================================================

  async function createCanvas() {
    const original =
      document.getElementById(
        "invoice-pdf"
      );

    if (!original) {
      throw new Error(
        "Invoice element not found."
      );
    }

    /*
     * Wait until fonts are ready.
     */
    if (document.fonts?.ready) {
      await document.fonts.ready;
    }

    /*
     * Give React/browser time to
     * render the QR SVG.
     */
    await new Promise((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(resolve);
      });
    });

    await new Promise((resolve) =>
      setTimeout(resolve, 200)
    );

    /*
     * Clone invoice.
     */
    const clone =
      original.cloneNode(true);

    /*
     * Remove buttons.
     */
    clone
      .querySelectorAll(".no-print")
      .forEach((element) => {
        element.remove();
      });

    /*
     * Convert QR SVG -> PNG.
     *
     * IMPORTANT:
     * Do this BEFORE removing classes/styles.
     */
    await prepareQRCodeForExport(
      original,
      clone
    );

    /*
     * Copy computed styles.
     */
    copyComputedStyles(
      original,
      clone
    );

    /*
     * Remove Tailwind classes after
     * computed styles have been copied.
     */
    clone
      .querySelectorAll("*")
      .forEach((element) => {
        element.removeAttribute(
          "class"
        );
      });

    clone.removeAttribute(
      "class"
    );

    // --------------------------------------------------------
    // FORCE WHITE INVOICE
    // --------------------------------------------------------

    clone.style.backgroundColor =
      "#ffffff";

    clone.style.color =
      "#111827";

    clone.style.width =
      `${original.scrollWidth}px`;

    clone.style.maxWidth =
      "none";

    clone.style.margin =
      "0";

    clone.style.boxShadow =
      "none";

    clone.style.overflow =
      "visible";

    // --------------------------------------------------------
    // FORCE TABLE COLORS
    // --------------------------------------------------------

    clone
      .querySelectorAll(
        "thead tr"
      )
      .forEach((element) => {
        element.style.backgroundColor =
          "#f1f5f9";

        element.style.color =
          "#111827";
      });

    clone
      .querySelectorAll(
        "th"
      )
      .forEach((element) => {
        element.style.backgroundColor =
          "#f1f5f9";

        element.style.color =
          "#111827";

        element.style.borderColor =
          "#cbd5e1";
      });

    clone
      .querySelectorAll(
        "td"
      )
      .forEach((element) => {
        element.style.backgroundColor =
          "#ffffff";

        element.style.color =
          "#111827";

        element.style.borderColor =
          "#cbd5e1";
      });

    // --------------------------------------------------------
    // FORCE QR COLORS
    // --------------------------------------------------------

    clone
      .querySelectorAll(
        "[data-payment-qr='true']"
      )
      .forEach((element) => {
        element.style.backgroundColor =
          "#ffffff";

        element.style.color =
          "#000000";

        element.style.opacity =
          "1";

        element.style.visibility =
          "visible";

        element.style.display =
          "flex";

        element.style.alignItems =
          "center";

        element.style.justifyContent =
          "center";
      });

    clone
      .querySelectorAll(
        "[data-payment-qr='true'] img"
      )
      .forEach((element) => {
        element.style.backgroundColor =
          "#ffffff";

        element.style.display =
          "block";

        element.style.visibility =
          "visible";

        element.style.opacity =
          "1";

        element.style.width =
          "230px";

        element.style.height =
          "230px";

        element.style.objectFit =
          "contain";
      });

    // --------------------------------------------------------
    // EXPORT WRAPPER
    // --------------------------------------------------------

    const wrapper =
      document.createElement(
        "div"
      );

    wrapper.style.position =
      "fixed";

    wrapper.style.left =
      "-100000px";

    wrapper.style.top =
      "0";

    wrapper.style.width =
      `${original.scrollWidth}px`;

    wrapper.style.backgroundColor =
      "#ffffff";

    wrapper.style.padding =
      "0";

    wrapper.style.margin =
      "0";

    wrapper.style.zIndex =
      "999999";

    wrapper.style.visibility =
      "visible";

    wrapper.style.opacity =
      "1";

    wrapper.appendChild(
      clone
    );

    document.body.appendChild(
      wrapper
    );

    /*
     * Wait for the PNG image.
     */
    const qrImage =
      clone.querySelector(
        "[data-payment-qr='true'] img"
      );

    if (qrImage) {
      await new Promise(
        (resolve) => {
          if (
            qrImage.complete &&
            qrImage.naturalWidth > 0
          ) {
            resolve();
            return;
          }

          qrImage.onload =
            resolve;

          qrImage.onerror =
            resolve;
        }
      );
    }

    /*
     * Wait for browser paint.
     */
    await new Promise((resolve) =>
      setTimeout(resolve, 300)
    );

    await new Promise((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(resolve);
      });
    });

    try {
      const canvas =
        await html2canvas(
          clone,
          {
            scale: 2,

            backgroundColor:
              "#ffffff",

            useCORS: true,

            allowTaint: false,

            logging: false,

            imageTimeout: 15000,

            scrollX: 0,

            scrollY: 0,

            windowWidth:
              original.scrollWidth,

            windowHeight:
              original.scrollHeight,

            removeContainer:
              false,
          }
        );

      if (
        !canvas.width ||
        !canvas.height
      ) {
        throw new Error(
          "Generated invoice image is empty."
        );
      }

      return canvas;
    } finally {
      if (wrapper.parentNode) {
        wrapper.parentNode.removeChild(
          wrapper
        );
      }
    }
  }

  // ==========================================================
  // GENERATE PDF
  // ==========================================================

  async function generatePDF() {
    const canvas =
      await createCanvas();

    const pdf =
      new jsPDF({
        orientation:
          "portrait",
        unit: "mm",
        format: "a4",
        compress: true,
      });

    const pageWidth =
      210;

    const pageHeight =
      297;

    const margin =
      8;

    const usableWidth =
      pageWidth -
      margin * 2;

    const imageHeight =
      (canvas.height *
        usableWidth) /
      canvas.width;

    const usablePageHeight =
      pageHeight -
      margin * 2;

    let remaining =
      imageHeight;

    let offset =
      0;

    while (remaining > 0) {
      if (offset > 0) {
        pdf.addPage();
      }

      const height =
        Math.min(
          usablePageHeight,
          remaining
        );

      const sourceHeight =
        (canvas.width *
          height) /
        usableWidth;

      const pageCanvas =
        document.createElement(
          "canvas"
        );

      pageCanvas.width =
        canvas.width;

      pageCanvas.height =
        Math.ceil(
          sourceHeight
        );

      const context =
        pageCanvas.getContext(
          "2d"
        );

      context.fillStyle =
        "#ffffff";

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
          "image/png"
        );

      pdf.addImage(
        pageImage,
        "PNG",
        margin,
        margin,
        usableWidth,
        height,
        undefined,
        "FAST"
      );

      offset +=
        sourceHeight;

      remaining -=
        height;
    }

    return pdf;
  }

  // ==========================================================
  // DOWNLOAD PDF
  // ==========================================================

  async function downloadPDF() {
    if (
      !invoice ||
      generating
    ) {
      return;
    }

    try {
      setGenerating(true);

      const pdf =
        await generatePDF();

      const invoiceNumber =
        invoice.invoice_number ||
        "invoice";

      pdf.save(
        `${invoiceNumber}.pdf`
      );
    } catch (error) {
      console.error(
        "PDF generation error:",
        error
      );

      alert(
        "Could not generate PDF.\n\n" +
          (
            error.message ||
            "Unknown error"
          )
      );
    } finally {
      setGenerating(false);
    }
  }

  // ==========================================================
  // DOWNLOAD IMAGE
  // ==========================================================

  async function downloadImage() {
    if (
      !invoice ||
      generating
    ) {
      return;
    }

    try {
      setGenerating(true);

      const canvas =
        await createCanvas();

      const blob =
        await new Promise(
          (resolve) =>
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
        invoice.invoice_number ||
        "invoice";

      const url =
        URL.createObjectURL(
          blob
        );

      const link =
        document.createElement(
          "a"
        );

      link.href =
        url;

      link.download =
        `${invoiceNumber}.png`;

      document.body.appendChild(
        link
      );

      link.click();

      document.body.removeChild(
        link
      );

      setTimeout(() => {
        URL.revokeObjectURL(
          url
        );
      }, 1000);
    } catch (error) {
      console.error(
        "Image generation error:",
        error
      );

      alert(
        "Could not generate invoice image.\n\n" +
          (
            error.message ||
            "Unknown error"
          )
      );
    } finally {
      setGenerating(false);
    }
  }

  // ==========================================================
  // WHATSAPP PDF
  // ==========================================================

  async function sharePDFOnWhatsApp() {
    if (
      !invoice ||
      generating
    ) {
      return;
    }

    try {
      setGenerating(true);

      const pdf =
        await generatePDF();

      const invoiceNumber =
        invoice.invoice_number ||
        "invoice";

      const blob =
        pdf.output("blob");

      const file =
        new File(
          [blob],
          `${invoiceNumber}.pdf`,
          {
            type:
              "application/pdf",
          }
        );

      if (
        navigator.share &&
        navigator.canShare &&
        navigator.canShare({
          files: [file],
        })
      ) {
        try {
          await navigator.share({
            title:
              `Invoice ${invoiceNumber}`,

            text:
              "Please find your invoice.",

            files: [file],
          });

          return;
        } catch (error) {
          if (
            error.name ===
            "AbortError"
          ) {
            return;
          }

          console.warn(
            "Native sharing failed:",
            error
          );
        }
      }

      /*
       * Desktop fallback.
       */
      pdf.save(
        `${invoiceNumber}.pdf`
      );

      openWhatsApp();
    } catch (error) {
      console.error(
        "WhatsApp PDF error:",
        error
      );

      alert(
        "Could not generate invoice PDF.\n\n" +
          (
            error.message ||
            "Unknown error"
          )
      );
    } finally {
      setGenerating(false);
    }
  }

  // ==========================================================
  // WHATSAPP IMAGE
  // ==========================================================

  async function shareImageOnWhatsApp() {
    if (
      !invoice ||
      generating
    ) {
      return;
    }

    try {
      setGenerating(true);

      const canvas =
        await createCanvas();

      const blob =
        await new Promise(
          (resolve) =>
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
        invoice.invoice_number ||
        "invoice";

      const file =
        new File(
          [blob],
          `${invoiceNumber}.png`,
          {
            type:
              "image/png",
          }
        );

      if (
        navigator.share &&
        navigator.canShare &&
        navigator.canShare({
          files: [file],
        })
      ) {
        try {
          await navigator.share({
            title:
              `Invoice ${invoiceNumber}`,

            text:
              "Please find your invoice.",

            files: [file],
          });

          return;
        } catch (error) {
          if (
            error.name ===
            "AbortError"
          ) {
            return;
          }

          console.warn(
            "Native sharing failed:",
            error
          );
        }
      }

      const url =
        URL.createObjectURL(
          blob
        );

      const link =
        document.createElement(
          "a"
        );

      link.href =
        url;

      link.download =
        `${invoiceNumber}.png`;

      document.body.appendChild(
        link
      );

      link.click();

      document.body.removeChild(
        link
      );

      setTimeout(() => {
        URL.revokeObjectURL(
          url
        );
      }, 1000);

      openWhatsApp();
    } catch (error) {
      console.error(
        "WhatsApp image error:",
        error
      );

      alert(
        "Could not generate invoice image.\n\n" +
          (
            error.message ||
            "Unknown error"
          )
      );
    } finally {
      setGenerating(false);
    }
  }

  // ==========================================================
  // OPEN WHATSAPP
  // ==========================================================

  function openWhatsApp() {
    const customer =
      invoice?.customers ||
      {};

    let phone =
      String(
        customer.mobile || ""
      ).replace(
        /\D/g,
        ""
      );

    if (
      phone.length === 10
    ) {
      phone =
        `91${phone}`;
    }

    const invoiceNumber =
      invoice?.invoice_number ||
      "invoice";

    const text =
      `Hello ${
        customer.name || ""
      },\n\n` +
      `Please find invoice ${invoiceNumber}.\n\n` +
      `Total: ₹${Number(
        invoice?.total_amount ||
          0
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
        <div className="text-center">

          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />

          <p className="font-medium text-slate-600 dark:text-slate-300">
            Loading invoice...
          </p>

        </div>
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

          <button
            type="button"
            onClick={onBack}
            className="mt-5 rounded-lg bg-blue-600 px-5 py-2.5 font-semibold text-white hover:bg-blue-700"
          >
            ← Back to Bills
          </button>

        </div>
      </div>
    );
  }

  // ==========================================================
  // NOT FOUND
  // ==========================================================

  if (!invoice) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        Invoice not found.
      </div>
    );
  }

  // ==========================================================
  // CALCULATIONS
  // ==========================================================

  const customer =
    invoice.customers ||
    {};

  const subtotal =
    items.reduce(
      (sum, item) =>
        sum +
        Number(
          item.amount || 0
        ),
      0
    );

  const taxableTotal =
    items.reduce(
      (sum, item) =>
        sum +
        Number(
          item.taxable_amount ||
            0
        ),
      0
    );

  const cgstTotal =
    items.reduce(
      (sum, item) =>
        sum +
        Number(
          item.cgst_amount ||
            0
        ),
      0
    );

  const sgstTotal =
    items.reduce(
      (sum, item) =>
        sum +
        Number(
          item.sgst_amount ||
            0
        ),
      0
    );

  const discountAmount =
    Number(
      invoice.discount_amount ??
        invoice.discount ??
        0
    );

  const totalAmount =
    Number(
      invoice.total_amount ||
        0
    );

  const paidAmount =
    Number(
      invoice.paid_amount ||
        0
    );

  const balanceAmount =
    Math.max(
      Number(
        invoice.balance_amount ??
          totalAmount -
            paidAmount
      ),
      0
    );

  const status =
    invoice.payment_status ||
    "pending";

  // ==========================================================
  // UPI QR DATA
  // ==========================================================

  const UPI_ID =
    "8859924403m@pnb";

  const upiPaymentUrl =
    `upi://pay?pa=${encodeURIComponent(
      UPI_ID
    )}` +
    `&pn=${encodeURIComponent(
      "Dhanpura Kisan Seva Kendra"
    )}` +
    `&am=${balanceAmount.toFixed(
      2
    )}` +
    `&cu=INR` +
    `&tn=${encodeURIComponent(
      `Invoice ${
        invoice.invoice_number ||
        ""
      }`
    )}`;

  // ==========================================================
  // UI
  // ==========================================================

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-4 dark:bg-slate-950 sm:px-6">

      {/* ======================================================
          ACTION BUTTONS
          ====================================================== */}

      <div className="no-print mx-auto mb-4 flex w-full max-w-6xl justify-end">

        <div className="flex flex-wrap justify-end gap-2">

          <button
            type="button"
            onClick={onBack}
            disabled={generating}
            className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50"
          >
            ← Back to Bills
          </button>

          <button
            type="button"
            onClick={printInvoice}
            disabled={generating}
            className="rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-purple-700 disabled:opacity-50"
          >
            🖨 Print Invoice
          </button>

          <button
            type="button"
            onClick={downloadPDF}
            disabled={generating}
            className="rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 disabled:opacity-50"
          >
            📄 PDF
          </button>

          <button
            type="button"
            onClick={sharePDFOnWhatsApp}
            disabled={generating}
            className="rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-green-700 disabled:opacity-50"
          >
            📱 WhatsApp PDF
          </button>

          <button
            type="button"
            onClick={downloadImage}
            disabled={generating}
            className="rounded-lg bg-blue-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-600 disabled:opacity-50"
          >
            🖼 Image
          </button>

          <button
            type="button"
            onClick={shareImageOnWhatsApp}
            disabled={generating}
            className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
          >
            🖼 WhatsApp Image
          </button>

        </div>
      </div>

      {/* ======================================================
          GENERATING
          ====================================================== */}

      {generating && (
        <div className="no-print mx-auto mb-4 max-w-6xl rounded-lg bg-blue-50 px-4 py-3 text-center text-sm font-medium text-blue-700">
          Generating invoice...
        </div>
      )}

      {/* ======================================================
          INVOICE
          ====================================================== */}

      <div
        id="invoice-pdf"
        className="mx-auto w-full max-w-5xl bg-white p-6 text-slate-900 shadow-sm sm:p-10"
      >

        {/* ====================================================
            HEADER
            ==================================================== */}

        <div className="border-b-2 border-slate-800 pb-6 text-center">

          <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
            धनपुरा किसान सेवा केन्द्र
          </h1>

          <h2 className="mt-2 text-xl font-semibold text-slate-800">
            Billing Invoice
          </h2>

          <p className="mt-2 text-sm text-slate-600">
            GST No.: 09EJCPK3134C1ZL
          </p>

        </div>

        {/* ====================================================
            CUSTOMER DETAILS
            ==================================================== */}

        <div className="grid gap-8 py-7 sm:grid-cols-2">

          <div>

            <h3 className="mb-4 text-lg font-semibold text-slate-900">
              Customer Details
            </h3>

            <DetailRow
              label="Customer Name"
              value={
                customer.name ||
                "-"
              }
            />

            <DetailRow
              label="Mobile Number"
              value={
                customer.mobile ||
                "-"
              }
            />

            <DetailRow
              label="Address"
              value={
                customer.address ||
                "-"
              }
            />

          </div>

          <div>

            <DetailRow
              label="Invoice No."
              value={
                invoice.invoice_number ||
                "-"
              }
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
                  : status ===
                      "partial"
                    ? "text-yellow-600"
                    : "text-red-600"
              }
            />

          </div>

        </div>

        {/* ====================================================
            ITEMS TABLE
            ==================================================== */}

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
                  Taxable ₹
                </th>

                <th className="border border-slate-300 px-3 py-3 text-right">
                  CGST ₹
                </th>

                <th className="border border-slate-300 px-3 py-3 text-right">
                  SGST ₹
                </th>

                <th className="border border-slate-300 px-3 py-3 text-right">
                  कुल ₹
                </th>

              </tr>

            </thead>

            <tbody>

              {items.map(
                (item, index) => (
                  <tr
                    key={
                      item.id ||
                      index
                    }
                  >

                    <td className="border border-slate-300 px-3 py-3 text-center">
                      {index + 1}
                    </td>

                    <td className="border border-slate-300 px-3 py-3">
                      {item.product_name ||
                        "-"}
                    </td>

                    <td className="border border-slate-300 px-3 py-3 text-center">
                      {item.unit ||
                        "-"}
                    </td>

                    <td className="border border-slate-300 px-3 py-3 text-right">
                      {Number(
                        item.quantity ||
                          0
                      )}
                    </td>

                    <td className="border border-slate-300 px-3 py-3 text-right">
                      ₹{" "}
                      {Number(
                        item.rate ||
                          0
                      ).toFixed(2)}
                    </td>

                    <td className="border border-slate-300 px-3 py-3 text-right">
                      ₹{" "}
                      {Number(
                        item.taxable_amount ||
                          0
                      ).toFixed(2)}
                    </td>

                    <td className="border border-slate-300 px-3 py-3 text-right">
                      ₹{" "}
                      {Number(
                        item.cgst_amount ||
                          0
                      ).toFixed(2)}
                    </td>

                    <td className="border border-slate-300 px-3 py-3 text-right">
                      ₹{" "}
                      {Number(
                        item.sgst_amount ||
                          0
                      ).toFixed(2)}
                    </td>

                    <td className="border border-slate-300 px-3 py-3 text-right">
                      ₹{" "}
                      {Number(
                        item.amount ||
                          0
                      ).toFixed(2)}
                    </td>

                  </tr>
                )
              )}

              {!items.length && (
                <tr>
                  <td
                    colSpan="9"
                    className="border border-slate-300 px-3 py-8 text-center text-slate-500"
                  >
                    No items found.
                  </td>
                </tr>
              )}

            </tbody>

          </table>

        </div>

        {/* ====================================================
            PAYMENT + TOTALS
            ==================================================== */}

        <div className="mt-6 grid items-start gap-6 sm:grid-cols-2">

          {/* ==================================================
              PAYMENT STATUS
              ================================================== */}

          <div>

            <h3 className="font-bold text-slate-900">
              Payment Status
            </h3>

            <p className="mt-1 text-sm text-slate-600">
              {status ===
              "paid"
                ? "Payment completed"
                : status ===
                    "partial"
                  ? "Partially paid"
                  : "Payment pending"}
            </p>

            {/* =================================================
                QR CODE
                ================================================= */}

            {balanceAmount > 0 && (
              <div className="mt-4 flex w-full max-w-[300px] flex-col items-center rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-center">

                <h3 className="text-base font-bold text-slate-900">
                  Scan to Pay
                </h3>

                <p className="mt-0.5 text-xs text-slate-600">
                  Pending Amount
                </p>

                <div
                  data-payment-qr="true"
                  className="mt-3 flex items-center justify-center rounded-xl bg-white p-3 shadow-sm"
                  style={{
                    width:
                      "260px",
                    height:
                      "260px",
                    backgroundColor:
                      "#ffffff",
                    overflow:
                      "hidden",
                  }}
                >

                  <QRCodeSVG
                    value={
                      upiPaymentUrl
                    }
                    size={230}
                    level="M"
                    includeMargin={
                      true
                    }
                    bgColor="#ffffff"
                    fgColor="#000000"
                    style={{
                      display:
                        "block",
                      width:
                        "230px",
                      height:
                        "230px",
                      backgroundColor:
                        "#ffffff",
                    }}
                  />

                </div>

                <p className="mt-2 text-lg font-bold text-red-600">
                  ₹{" "}
                  {balanceAmount.toFixed(
                    2
                  )}
                </p>

                <p className="mt-0.5 text-[10px] text-slate-500">
                  Scan using any UPI app
                </p>

                <p className="mt-1 text-[10px] text-slate-500">
                  UPI:{" "}
                  {UPI_ID}
                </p>

              </div>
            )}

          </div>

          {/* ==================================================
              TOTALS
              ================================================== */}

          <div>

            <TotalRow
              label="Taxable Amount"
              value={
                taxableTotal
              }
            />

            <TotalRow
              label="CGST"
              value={
                cgstTotal
              }
            />

            <TotalRow
              label="SGST"
              value={
                sgstTotal
              }
            />

            <TotalRow
              label="कुल बिल"
              value={
                subtotal
              }
            />

            <TotalRow
              label="Discount"
              value={
                discountAmount
              }
              prefix="- ₹ "
            />

            <TotalRow
              label="कुल बिल राशि"
              value={
                totalAmount
              }
              bold
            />

            <TotalRow
              label="ग्राहक द्वारा दी गई राशि"
              value={
                paidAmount
              }
            />

            <div className="flex items-center justify-between border-t-2 border-slate-800 py-2">

              <span className="font-semibold">
                बाकी राशि
              </span>

              <strong
                className={
                  balanceAmount >
                  0
                    ? "text-red-600"
                    : "text-green-600"
                }
              >
                ₹{" "}
                {balanceAmount.toFixed(
                  2
                )}
              </strong>

            </div>

          </div>

        </div>

        {/* ====================================================
            FOOTER
            ==================================================== */}

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

      {/* ======================================================
          PRINT CSS
          ====================================================== */}

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

          [data-payment-qr="true"] {
            background: #ffffff !important;
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

// ============================================================
// DETAIL ROW
// ============================================================

function DetailRow({
  label,
  value,
  strong = false,
  valueClass =
    "text-slate-900",
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 py-2.5">

      <span className="text-slate-600">
        {label}
      </span>

      <span
        className={`text-right ${
          strong
            ? "font-bold"
            : "font-medium"
        } ${valueClass}`}
      >
        {value}
      </span>

    </div>
  );
}

// ============================================================
// TOTAL ROW
// ============================================================

function TotalRow({
  label,
  value,
  prefix = "₹ ",
  bold = false,
}) {
  return (
    <div
      className={`flex items-center justify-between border-t border-slate-300 py-3 ${
        bold
          ? "text-lg"
          : ""
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
        {Number(
          value || 0
        ).toFixed(2)}
      </strong>

    </div>
  );
}

export default Invoice;