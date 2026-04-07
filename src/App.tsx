import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import AuthGuard from './components/AuthGuard';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Customers from './pages/Customers';
import Technicians from './pages/Technicians';
import Suppliers from './pages/Suppliers';
import ServiceOrders from './pages/ServiceOrders';
import OrderForm from './pages/OrderForm';
import OrderDetails from './pages/OrderDetails';
import SettingsPage from './pages/SettingsPage';
import Reports from './pages/Reports';
import ScrollToTop from './components/ui/ScrollToTop';

import { Toaster } from 'sonner';

export default function App() {
  return (
    <Router>
      <ScrollToTop />
      <Toaster position="top-right" richColors />
      <AuthGuard>
        <Layout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/technicians" element={<Technicians />} />
            <Route path="/suppliers" element={<Suppliers />} />
            <Route path="/orders" element={<ServiceOrders />} />
            <Route path="/orders/new" element={<OrderForm />} />
            <Route path="/orders/:id" element={<OrderDetails />} />
            <Route path="/orders/:id/edit" element={<OrderForm />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </Layout>
      </AuthGuard>
    </Router>
  );
}
