import { toPng } from 'html-to-image';

export function useCanvasExport() {
  // pixelRatio maior = mais resolução (usado na captura da arte pra produção).
  // Sem backgroundColor, o toPng preserva a transparência do nó (arte sem fundo).
  const exportNode = async (node, { pixelRatio = 2 } = {}) => {
    if (!node) return null;
    try {
      return await toPng(node, { pixelRatio });
    } catch (err) {
      console.error('exportNode falhou:', err);
      return null;
    }
  };

  return { exportNode };
}
