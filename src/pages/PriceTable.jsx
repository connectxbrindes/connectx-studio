import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { fetchPriceTable } from '../lib/api';
import { useStore } from '../store/useStore';
import { formatCurrency } from '../utils/price';
import Header from '../components/layout/Header';

export default function PriceTable() {
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const hidePrices = useStore((s) => s.identity?.hidePrices);
  const navigate = useNavigate();

  // Conta de apresentação/demo oculta preços — não deve ver a tabela.
  useEffect(() => {
    if (hidePrices) navigate('/', { replace: true });
  }, [hidePrices, navigate]);

  useEffect(() => {
    fetchPriceTable()
      .then(setProducts)
      .finally(() => setIsLoading(false));
  }, []);

  // Agrupa por categoria, preservando ordem alfabética de categoria e produto.
  const groups = useMemo(() => {
    const byCat = new Map();
    for (const p of products) {
      if (!byCat.has(p.categoryName)) byCat.set(p.categoryName, []);
      byCat.get(p.categoryName).push(p);
    }
    return [...byCat.entries()]
      .sort((a, b) => a[0].localeCompare(b[0], 'pt-BR'))
      .map(([categoryName, items]) => ({ categoryName, items }));
  }, [products]);

  return (
    <div className="min-h-screen bg-bg">
      <Header />
      <main className="mx-auto max-w-[900px] px-6 py-10 sm:px-10">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Tabela de Preços</h1>
            <p className="mt-1 text-sm text-text-secondary">
              Valores dos produtos para a sua unidade.
            </p>
          </div>
          <Link to="/" className="text-sm font-medium text-accent hover:underline">
            Voltar pro Studio
          </Link>
        </div>

        {isLoading ? (
          <div className="flex h-32 items-center justify-center text-text-secondary">Carregando…</div>
        ) : groups.length === 0 ? (
          <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-border text-text-secondary">
            Nenhum produto disponível.
          </div>
        ) : (
          <div className="flex flex-col gap-8">
            {groups.map((group) => (
              <section key={group.categoryName}>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-secondary">
                  {group.categoryName}
                </h2>
                <div className="overflow-hidden rounded-2xl border border-border bg-panel">
                  {group.items.map((p, i) => (
                    <div
                      key={p.id}
                      className={`flex items-center justify-between gap-4 px-5 py-4 ${
                        i > 0 ? 'border-t border-border' : ''
                      }`}
                    >
                      <span className="font-medium text-text-primary">{p.name}</span>
                      <span className="whitespace-nowrap font-semibold text-text-primary">
                        {p.resellerPrice != null ? formatCurrency(p.resellerPrice) : '—'}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
