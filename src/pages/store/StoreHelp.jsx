import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Palette, ShoppingBag, Store, Truck } from 'lucide-react';
import { fetchStorePublicInfo } from '../../lib/storeApi';

const HOW_IT_WORKS = [
  [ShoppingBag, 'Escolha o produto', 'Navegue pelas categorias e escolha o produto e a cor.'],
  [Palette, 'Personalize no Studio', 'Coloque foto, nome ou frase e veja a prévia antes de comprar.'],
  [Store, 'Finalize o pedido', 'Crie sua conta no carrinho e pague com Pix, cartão ou boleto.'],
  [Truck, 'Retire ou receba', 'Retire grátis na loja ou receba em casa pelos Correios.'],
];

const TOPICS = {
  'como-funciona': { title: 'Como funciona' },
  trocas: { title: 'Trocas e devoluções', field: 'exchange_policy' },
  privacidade: { title: 'Política de privacidade', field: 'privacy_policy' },
};

/** Páginas de ajuda da loja: como funciona e as políticas cadastradas no Painel. */
export default function StoreHelp() {
  const { topic } = useParams();
  const [info, setInfo] = useState(null);
  const page = TOPICS[topic];

  useEffect(() => {
    fetchStorePublicInfo().then(setInfo);
  }, []);

  useEffect(() => {
    if (page) document.title = `${page.title} — ConnectX Brindes`;
  }, [page]);

  const text = page?.field ? info?.[page.field] : null;

  return (
    <section className="mx-auto max-w-3xl px-4 pt-8 sm:px-6">
      <nav className="mb-6 text-xs text-text-secondary" aria-label="Você está em">
        <Link to="/store" className="hover:text-brand">Início</Link> <span aria-hidden="true">›</span> <span>{page?.title || 'Ajuda'}</span>
      </nav>
      <h1 className="text-3xl font-extrabold text-brand-dark">{page?.title || 'Página não encontrada'}</h1>

      {topic === 'como-funciona' && (
        <ol className="mt-8 grid gap-4 sm:grid-cols-2">
          {HOW_IT_WORKS.map(([Icon, title, body], i) => (
            <li key={title} className="flex gap-4 rounded-2xl border border-border p-5">
              <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-[#fff1ec] text-accent">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <span>
                <span className="block text-xs font-bold uppercase tracking-wider text-text-secondary">Passo {i + 1}</span>
                <span className="block font-bold text-brand-dark">{title}</span>
                <span className="mt-1 block text-sm text-text-secondary">{body}</span>
              </span>
            </li>
          ))}
        </ol>
      )}

      {page?.field && info && (
        text
          ? <div className="mt-6 whitespace-pre-line text-sm leading-relaxed text-brand-dark/80">{text}</div>
          : <p className="mt-6 text-sm text-text-secondary">Em breve.</p>
      )}

      {!page && (
        <Link to="/store" className="mt-6 inline-block font-semibold text-accent">Voltar para a loja</Link>
      )}
    </section>
  );
}
