import { Routes, Route, Navigate } from 'react-router-dom';
import Apresentacao from './pages/Apresentacao';
import Storefront from './pages/Storefront';
import StaffLogin from './pages/StaffLogin';
import MyOrders from './pages/MyOrders';
import PriceTable from './pages/PriceTable';
import StorefrontGuard from './components/layout/StorefrontGuard';
import AdminLogin from './pages/admin/AdminLogin';
import AdminGuard from './pages/admin/AdminGuard';
import AdminDashboard from './pages/admin/AdminDashboard';
import { AdminIndexRedirect, RequirePermission, RequireMaster } from './pages/admin/AdminAuthContext';
import AdminResellers from './pages/admin/AdminResellers';
import AdminUsers from './pages/admin/AdminUsers';
import AdminOrders from './pages/admin/AdminOrders';
import AdminStudio from './pages/admin/AdminStudio';
import AdminTokens from './pages/admin/AdminTokens';
import AdminBanners from './pages/admin/AdminBanners';
import StoreSettingsCard from './pages/admin/StoreSettingsCard';
import StoreAdminLayout from './pages/admin/store/StoreAdminLayout';
import StorePricesTab from './pages/admin/store/StorePricesTab';
import StoreShippingTab from './pages/admin/store/StoreShippingTab';
import Store from './pages/Store';
import AdminArts from './pages/admin/AdminArts';
import StoreLayout from './pages/store/StoreLayout';
import StoreHome from './pages/store/StoreHome';
import StoreListing from './pages/store/StoreListing';
import StoreProduct from './pages/store/StoreProduct';
import StoreHelp from './pages/store/StoreHelp';
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
      {/* Loja virtual de varejo: vitrine + Studio aberto, sem login (cadastro só no checkout). */}
      <Route path="/store" element={<StoreLayout />}>
        <Route index element={<StoreHome />} />
        <Route path="c/:slug" element={<StoreListing mode="category" />} />
        <Route path="busca" element={<StoreListing mode="search" />} />
        <Route path="campanha" element={<StoreListing mode="campaign" />} />
        <Route path="p/:slug" element={<StoreProduct />} />
        <Route path="ajuda/:topic" element={<StoreHelp />} />
      </Route>
      <Route path="/store/personalizar" element={<Store />} />
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
      <Route
        path="/tabela-de-precos"
        element={
          <StorefrontGuard>
            <PriceTable />
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
          path="loja"
          element={
            <RequirePermission section="tokens">
              <StoreAdminLayout />
            </RequirePermission>
          }
        >
          <Route index element={<Navigate to="banners" replace />} />
          <Route path="banners" element={<AdminBanners />} />
          <Route path="precos" element={<StorePricesTab />} />
          <Route path="tokens" element={<AdminTokens />} />
          <Route path="frete" element={<StoreShippingTab />} />
          <Route path="configuracoes" element={<StoreSettingsCard />} />
        </Route>
        <Route
          path="artes"
          element={
            <RequirePermission section="arts">
              <AdminArts />
            </RequirePermission>
          }
        />
        {/* Endereços antigos do Painel */}
        <Route path="tokens" element={<Navigate to="/admin/loja/tokens" replace />} />
        <Route path="banners" element={<Navigate to="/admin/loja/banners" replace />} />
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
