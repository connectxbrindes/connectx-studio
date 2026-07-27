import { useRef } from 'react';
import { useStore } from '../../../store/useStore';
import { uploadOrderOriginalImage } from '../../../lib/api';
import Button from '../../ui/Button';

export default function Toolbar() {
  const addTextElement = useStore((s) => s.addTextElement);
  const addImageElement = useStore((s) => s.addImageElement);
  const updateElement = useStore((s) => s.updateElement);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const src = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      addImageElement(src, img.naturalWidth, img.naturalHeight);
      // O blob: local (src) já basta pro canvas ao vivo — sobe o arquivo
      // original em paralelo, sem travar a edição, só pra guardar a versão
      // em qualidade máxima que vai no zip do pedido depois. Na prévia/teste
      // do painel não há pedido, então não sobe nada (evita arquivo órfão).
      if (useStore.getState().previewMode) return;
      const newElementId = useStore.getState().selectedElementId;
      uploadOrderOriginalImage(file).then(({ url }) => {
        if (url) updateElement(newElementId, { originalImageUrl: url });
      });
    };
    img.src = src;
    e.target.value = '';
  };

  return (
    <div className="flex gap-3">
      <Button variant="secondary" onClick={addTextElement}>
        + Texto
      </Button>
      <Button variant="secondary" onClick={() => fileInputRef.current.click()}>
        + Imagem
      </Button>
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
