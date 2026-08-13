import { useEffect, useState } from "react";
import { supabase } from "./services/supabase";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Products from "./pages/Products";
import Customers from "./pages/Customers";
import NewBill from "./pages/NewBill";
import Bills from "./pages/Bills";
import Invoice from "./pages/Invoice";
import Reports from "./pages/Reports";
import CustomerDetails from "./pages/CustomerDetails";
import Payments from "./pages/Payments";

import AppHeader from "./components/AppHeader";
import "./App.css";

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState("dashboard");

  const [selectedInvoiceId, setSelectedInvoiceId] = useState(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);

  const [darkMode, setDarkMode] = useState(
    localStorage.getItem("darkMode") === "true"
  );

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
    localStorage.setItem("darkMode", darkMode);
  }, [darkMode]);

  useEffect(() => {
    async function loadSession() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        setUser(session?.user ?? null);
      } catch (error) {
        console.error("Error loading session:", error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    }

    loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);

      if (!session?.user) {
        setPage("dashboard");
        setSelectedInvoiceId(null);
        setSelectedCustomerId(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="text-lg font-medium text-slate-600 dark:text-slate-300">
          Loading...
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <Login
        onLogin={(loggedInUser) => {
          setUser(loggedInUser);
          setPage("dashboard");
        }}
      />
    );
  }

  const header = (
    <AppHeader
      page={page}
      onNavigate={setPage}
      darkMode={darkMode}
      onToggleDarkMode={() => setDarkMode((value) => !value)}
    />
  );

  let content;

  if (page === "products") {
    content = <Products />;
  } else if (page === "customers") {
    content = (
      <Customers
        onViewCustomer={(customerId) => {
          setSelectedCustomerId(customerId);
          setPage("customer-details");
        }}
      />
    );
  } else if (page === "customer-details") {
    content = (
      <CustomerDetails
        customerId={selectedCustomerId}
        onViewBill={(invoiceId) => {
          setSelectedInvoiceId(invoiceId);
          setPage("invoice");
        }}
      />
    );
  } else if (page === "new-bill") {
    content = <NewBill />;
  } else if (page === "bills") {
    content = (
      <Bills
        onViewBill={(invoiceId) => {
          setSelectedInvoiceId(invoiceId);
          setPage("invoice");
        }}
      />
    );
  } else if (page === "invoice") {
    content = <Invoice invoiceId={selectedInvoiceId} />;
  } else if (page === "payments") {
    content = <Payments />;
  } else if (page === "reports") {
    content = <Reports />;
  } else {
    content = (
      <Dashboard
        user={user}
        darkMode={darkMode}
        onToggleDarkMode={() => setDarkMode((value) => !value)}
        onProducts={() => setPage("products")}
        onCustomers={() => setPage("customers")}
        onNewBill={() => setPage("new-bill")}
        onBills={() => setPage("bills")}
        onReports={() => setPage("reports")}
        onPayments={() => setPage("payments")}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {header}
      {content}
    </div>
  );
}

export default App;