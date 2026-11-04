import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { isSupabaseConfigured } from '../lib/supabaseClient';
import { useStoreSession } from './store/useStoreSession';
import Storefront from './Storefront';
import SupabaseNotConfigured from './admin/SupabaseNotConfigured';

// Studio da loja virtual (/store/personalizar?produto=slug&cor=id): o mesmo
// Studio das unidades, aberto sem login e já com o produto/cor escolhidos na
// vitrine. O cadastro do cliente só é pedido ao finalizar a compra.
export default function Store() {
  useStoreSession();
  const [params] = useSearchParams();

  useEffect(() => {
    document.title = 'Personalize o seu — ConnectX Brindes';
  }, []);

  if (!isSupabaseConfigured) return <SupabaseNotConfigured />;
  return <Storefront channel="store" initialProductSlug={params.get('produto')} initialColorId={params.get('cor')} />;
}
