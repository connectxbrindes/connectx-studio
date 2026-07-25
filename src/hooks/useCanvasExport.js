import { toPng } from 'html-to-image';

export function useCanvasExport() {
  const exportNode = async (node) => {
    if (!node) return null;
    try {
      return await toPng(node, { pixelRatio: 2 });
    } catch {
      return null;
    }
  };

  return { exportNode };
}
