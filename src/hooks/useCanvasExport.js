import { toPng } from 'html-to-image';

export function useCanvasExport() {
  // pixelRatio maior = mais resolução (usado na captura da arte pra produção).
  // Sem backgroundColor, o toPng preserva a transparência do nó (arte sem fundo).
  const exportNode = async (node, { pixelRatio = 2 } = {}) => {
    if (!node) return null;
    try {
      // 1) Espera todas as imagens do nó estarem realmente decodificadas
      //    (mockup/máscara remotos do Supabase + arte). Sem isso, imagens que
      //    ainda não carregaram saem em branco na captura.
      const imgs = Array.from(node.querySelectorAll('img'));
      await Promise.all(
        imgs.map((img) =>
          img.complete && img.naturalWidth > 0
            ? Promise.resolve()
            : new Promise((resolve) => {
                img.onload = () => resolve();
                img.onerror = () => resolve();
              })
        )
      );

      // 2) Renderiza duas vezes: a primeira "aquece" o cache interno do
      //    html-to-image (a primeira chamada na página costuma sair em branco,
      //    sem as imagens/fontes); a segunda sai completa. Foi o que fazia a
      //    prévia (capturada antes da arte) vir vazia enquanto a arte vinha ok.
      await toPng(node, { pixelRatio });
      return await toPng(node, { pixelRatio });
    } catch (err) {
      console.error('exportNode falhou:', err);
      return null;
    }
  };

  return { exportNode };
}
