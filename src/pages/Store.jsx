import { useEffect } from 'react';
import { useStore } from '../store/useStore';
import { isSupabaseConfigured } from '../lib/supabaseClient';
import { fetchCampaignProductIds, fetchStoreCustomer, onStoreAuthChange } from '../lib/storeApi';
import Storefront from './Storefront';
import SupabaseNotConfigured from './admin/SupabaseNotConfigured';

// Loja virtual de varejo: o mesmo Studio, aberto pra qualquer pessoa (sem
// login). O cadastro/login do cliente só é pedido ao finalizar a compra.
export default function Store() {
  const setCampaignProductIds = useStore((s) => s.setCampaignProductIds);
  const setStoreCustomer = useStore((s) => s.setStoreCustomer);

  useEffect(() => {
    document.title = 'Loja ConnectX Brindes — Personalize o seu';
    fetchCampaignProductIds().then(setCampaignProductIds);
    fetchStoreCustomer().then(setStoreCustomer);
    return onStoreAuthChange(() => {
      fetchStoreCustomer().then(setStoreCustomer);
    });
  }, [setCampaignProductIds, setStoreCustomer]);

  if (!isSupabaseConfigured) return <SupabaseNotConfigured />;
  return <Storefront channel="store" />;
}
