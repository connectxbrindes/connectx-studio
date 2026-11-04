import { useEffect } from 'react';
import { useStore } from '../../store/useStore';
import { fetchCatalog } from '../../lib/api';
import { fetchCampaignProductIds, fetchStoreCustomer, onStoreAuthChange } from '../../lib/storeApi';

/** Carrega o que toda página da loja precisa: cliente logado, produtos da
 * campanha e (opcional) o catálogo. Marca o canal como 'store'. */
export function useStoreSession({ loadCatalog = false } = {}) {
  const setChannel = useStore((s) => s.setChannel);
  const setCampaignProductIds = useStore((s) => s.setCampaignProductIds);
  const setStoreCustomer = useStore((s) => s.setStoreCustomer);
  const setCatalog = useStore((s) => s.setCatalog);

  useEffect(() => {
    setChannel('store');
    useStore.setState({ identity: null });
    fetchCampaignProductIds().then(setCampaignProductIds);
    fetchStoreCustomer().then(setStoreCustomer);
    return onStoreAuthChange(() => {
      fetchStoreCustomer().then(setStoreCustomer);
    });
  }, [setChannel, setCampaignProductIds, setStoreCustomer]);

  useEffect(() => {
    if (!loadCatalog || useStore.getState().catalogLoaded) return;
    let mounted = true;
    fetchCatalog().then((data) => mounted && setCatalog(data));
    return () => {
      mounted = false;
    };
  }, [loadCatalog, setCatalog]);
}

/** Categorias do catálogo (na ordem dos produtos), com os produtos de cada uma. */
export function groupByCategory(catalog) {
  return catalog.reduce((groups, product) => {
    if (!product.category) return groups;
    const existing = groups.find((g) => g.category.id === product.category.id);
    if (existing) existing.products.push(product);
    else groups.push({ category: product.category, products: [product] });
    return groups;
  }, []);
}

/** Imagem principal do produto: capa, ou a da primeira cor. */
export const productImage = (product, color) =>
  color?.image || product.image || product.options?.colors?.find((c) => c.image)?.image || '';
