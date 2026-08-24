import { Routes, Route } from 'react-router-dom';
import Apresentacao from './pages/Apresentacao';
import Storefront from './pages/Storefront';
import StaffLogin from './pages/StaffLogin';
import MyOrders from './pages/MyOrders';
import StorefrontGuard from './components/layout/StorefrontGuard';
import AdminLogin from './pages/admin/AdminLogin';
import AdminGuard from './pages/admin/AdminGuard';
import AdminDashboard from './pages/admin/AdminDashboard';
import { AdminIndexRedirect, RequirePermission, RequireMaster } from './pages/admin/AdminAuthContext';
import AdminResellers from './pages/admin/AdminResellers';
import AdminUsers from './pages/admin/AdminUsers';
import AdminOrders from './pages/admin/AdminOrders';
import AdminStudio from './pages/admin/AdminStudio';
import ProductsLayout from './pages/admin/products/ProductsLayout';
import AdminProductsList from './pages/admin/products/AdminProductsList';
import AdminCategories from './pages/admin/products/AdminCategories';
import AdminBrands from './pages/admin/products/AdminBrands';
import AdminProductModels from './pages/admin/products/AdminProductModels';

function App() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <StorefrontGuard>
            <Storefront />
          </StorefrontGuard>
        }
      />
      <Route path="/apresentacao" element={<Apresentacao />} />
      <Route path="/login" element={<StaffLogin />} />
      <Route
        path="/meus-pedidos"
        element={
          <StorefrontGuard>
            <MyOrders />
          </StorefrontGuard>
        }
      />
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route
        path="/admin"
        element={
          <AdminGuard>
            <AdminDashboard />
          </AdminGuard>
        }
      >
        <Route index element={<AdminIndexRedirect />} />
        <Route
          path="produtos"
          element={
            <RequirePermission section="products">
              <ProductsLayout />
            </RequirePermission>
          }
        >
          <Route index element={<AdminProductsList />} />
          <Route path="categorias" element={<AdminCategories />} />
          <Route path="marcas" element={<AdminBrands />} />
          <Route path="modelos" element={<AdminProductModels />} />
        </Route>
        <Route
          path="revendedores"
          element={
            <RequirePermission section="resellers">
              <AdminResellers />
            </RequirePermission>
          }
        />
        <Route
          path="pedidos"
          element={
            <RequirePermission section="orders">
              <AdminOrders />
            </RequirePermission>
          }
        />
        <Route
          path="usuarios"
          element={
            <RequireMaster>
              <AdminUsers />
            </RequireMaster>
          }
        />
        <Route
          path="studio"
          element={
            <RequirePermission section="studio">
              <AdminStudio />
            </RequirePermission>
          }
        />
      </Route>
    </Routes>
  );
}

export default App;
