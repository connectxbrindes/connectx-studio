import { useEffect, useRef, useState } from 'react';
import { useStore } from '../../../store/useStore';
import { uploadOrderOriginalImage } from '../../../lib/api';
import Button from '../../ui/Button';
import InfoHint from '../../ui/InfoHint';
import { fetchStudioCollections } from '../../../lib/collectionsApi';
import CollectionsModal from './CollectionsModal';

export default function Toolbar() {
  const addTextElement = useStore((s) => s.addTextElement);
  const addImageElement = useStore((s) => s.addImageElement);
  const updateElement = useStore((s) => s.updateElement);
  const fileInputRef = useRef(null);
  const product = useStore((s) => s.selectedProduct);
  const allowImage = product?.allowImageUpload !== false;
  const allowCollections = product?.allowCollections !== false;
  const [allCollections, setAllCollections] = useState([]);
  // Só as coleções liberadas para a categoria do produto (vazio = todas).
  const categoryId = product?.category?.id;
  const collections = allCollections.filter((c) => !c.categoryIds?.length || (categoryId && c.categoryIds.includes(categoryId)));
  const [collectionsOpen, setCollectionsOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchStudioCollections().then((c) => { if (alive) setAllCollections(c); });
    return () => { alive = false; };
  }, []);

  // Mede a proporção REAL do container de edição, pra a caixa da imagem nascer
  // no formato certo (sem esticar).
  const containerAspect = () => {
    const rect = document.querySelector('[data-tour="canvas"]')?.getBoundingClientRect();
    return rect && rect.height > 0 ? rect.width / rect.height : null;
  };

  // Arte da coleção: já está guardada no servidor, então o próprio endereço
  // serve como original em qualidade máxima para o pedido.
  const pickCollectionImage = (image) => new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      addImageElement(image.url, img.naturalWidth || 1000, img.naturalHeight || 1000, containerAspect());
      updateElement(useStore.getState().selectedElementId, { originalImageUrl: image.url });
      setCollectionsOpen(false);
      resolve();
    };
    img.onerror = () => resolve();
    img.src = image.url;
  });

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const src = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      // Mede a proporção REAL (largura/altura) do container de edição na hora,
      // pra a caixa da imagem nascer no formato certo (sem esticar). Térmicos
      // não têm proporção fixa (w-full), então precisa medir.
      const canvasEl = document.querySelector('[data-tour="canvas"]');
      const rect = canvasEl?.getBoundingClientRect();
      const containerAspect = rect && rect.height > 0 ? rect.width / rect.height : null;
      addImageElement(src, img.naturalWidth, img.naturalHeight, containerAspect);
      // O blob: local (src) já basta pro canvas ao vivo — sobe o arquivo
      // original em paralelo, sem travar a edição, só pra guardar a versão
      // em qualidade máxima que vai no zip do pedido depois. Na prévia/teste
      // do painel não há pedido, então não sobe nada (evita arquivo órfão).
      if (useStore.getState().previewMode) return;
      // Loja virtual: cliente ainda anônimo (upload exige login) — o original
      // sobe no checkout a partir do blob local.
      if (useStore.getState().channel === 'store') return;
      const newElementId = useStore.getState().selectedElementId;
      uploadOrderOriginalImage(file).then(({ url }) => {
        if (url) updateElement(newElementId, { originalImageUrl: url });
      });
    };
    img.src = src;
    e.target.value = '';
  };

  return (
    <div data-tour="ferramentas" className="flex flex-wrap items-center gap-3 [&>button]:whitespace-nowrap">
      <Button variant="secondary" onClick={addTextElement}>
        + Texto
      </Button>
      <InfoHint label="Adicionar texto" align="left" text="Cria uma caixa de texto no produto. Depois é só digitar no campo 'Conteúdo' e ajustar fonte, cor e tamanho no painel à direita." />
      {/* "+ Imagem" e "Coleções" dependem do cadastro do produto no Painel. */}
      {allowImage && (
        <>
          <Button variant="secondary" onClick={() => fileInputRef.current.click()}>
            + Imagem
          </Button>
          <InfoHint label="Adicionar imagem" align="left" text="Envia uma foto ou logo do seu dispositivo. Depois arraste para posicionar e use os cantos para redimensionar sobre o produto." />
        </>
      )}
      {allowCollections && (
        <>
          <Button variant="secondary" onClick={() => setCollectionsOpen(true)}>
            Coleções
          </Button>
          <InfoHint label="Coleções" align="left" text="Artes prontas para aplicar no produto. Escolha uma e depois arraste e redimensione como quiser." />
        </>
      )}
      {collectionsOpen && (
        <CollectionsModal collections={collections} onPick={pickCollectionImage} onClose={() => setCollectionsOpen(false)} />
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
        aria-hidden="true"
      />
    </div>
  );
}
