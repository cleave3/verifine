import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { useAuthStore } from "./store/authStore";
// @ts-ignore
import Login from "./pages/Login";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Accounts from "./pages/Accounts";
import FiscalPeriods from "./pages/FiscalPeriods";
import JournalEntries from "./pages/JournalEntries";
import Vendors from "./pages/Vendors";
import Bills from "./pages/Bills";
import Customers from "./pages/Customers";
import Invoices from "./pages/Invoices";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import { useCurrencyStore } from "./store/currencyStore";

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isLoading } = useAuthStore();
  if (isLoading) return <div className="p-8">Loading verification...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
};


function App() {
  const checkAuth = useAuthStore((state) => state.checkAuth);
  const fetchSettingsAndRates = useCurrencyStore((state) => state.fetchSettingsAndRates);

  useEffect(() => {
    checkAuth();
    fetchSettingsAndRates();
  }, [checkAuth, fetchSettingsAndRates]);

  return (
    <>
      <Toaster position="top-right" />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="accounts" element={<Accounts />} />
            <Route path="periods" element={<FiscalPeriods />} />
            <Route path="journal-entries" element={<JournalEntries />} />
            <Route path="ap/vendors" element={<Vendors />} />
            <Route path="ap/bills" element={<Bills />} />
            <Route path="ar/customers" element={<Customers />} />
            <Route path="ar/invoices" element={<Invoices />} />
            <Route path="reports" element={<Reports />} />
            <Route path="settings" element={<Settings />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </>
  );
}

export default App;
