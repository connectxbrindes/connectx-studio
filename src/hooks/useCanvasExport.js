/**
 * Hook de exportação do canvas de personalização.
 *
 * Em vez de depender do html-to-image (que falha silenciosamente com imagens
 * cross-origin do Supabase Storage), este hook desenha cada camada
 * manualmente usando a Canvas 2D API nativa do navegador:
 *
 *   1) Fundo (mockup do celular OU cor sólida)
 *   2) Elementos de personalização (imagens + textos do cliente)
 *   3) Máscara por cima (PNG que cobre a arte fora da área permitida)
 *
 * A função loadImage() converte as URLs remotas em blobs locais antes de
 * criar o Image — isso contorna CORS completamente, porque o navegador
 * trata blobs como same-origin.
 */

export function useCanvasExport() {
  /**
   * Carrega uma imagem de qualquer origem convertendo-a em blob local.
   * Isso elimina 100% dos problemas de CORS que o html-to-image tinha.
   */
  const loadImage = (url) =>
    new Promise((resolve, reject) => {
      // Data-URLs e blob-URLs já são same-origin — carrega direto.
      if (url.startsWith('data:') || url.startsWith('blob:')) {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = url;
        return;
      }

      // Imagens remotas (Supabase Storage): busca como blob para evitar CORS.
      fetch(url, { mode: 'cors' })
        .then((res) => {
          if (!res.ok) throw new Error(`fetch ${url} → ${res.status}`);
          return res.blob();
        })
        .then((blob) => {
          const objectUrl = URL.createObjectURL(blob);
          const img = new Image();
          img.onload = () => {
            URL.revokeObjectURL(objectUrl);
            resolve(img);
          };
          img.onerror = (err) => {
            URL.revokeObjectURL(objectUrl);
            reject(err);
          };
          img.src = objectUrl;
        })
        .catch(reject);
    });

  /**
   * Desenha uma imagem na canvas usando object-fit: contain (mesma lógica
   * que o CSS `object-contain` faz na tela).
   */
  const drawContain = (ctx, img, dx, dy, dw, dh) => {
    const imgAspect = img.naturalWidth / img.naturalHeight;
    const boxAspect = dw / dh;
    let drawW, drawH, drawX, drawY;
    if (imgAspect > boxAspect) {
      drawW = dw;
      drawH = dw / imgAspect;
      drawX = dx;
      drawY = dy + (dh - drawH) / 2;
    } else {
      drawH = dh;
      drawW = dh * imgAspect;
      drawX = dx + (dw - drawW) / 2;
      drawY = dy;
    }
    ctx.drawImage(img, drawX, drawY, drawW, drawH);
  };

  /**
   * Gera a prévia (thumbnail) com todas as camadas:
   * mockup + elementos do cliente + máscara.
   *
   * @param {object} opts
   * @param {object} opts.product        – produto selecionado
   * @param {object} opts.color          – cor selecionada
   * @param {object} opts.model          – modelo selecionado (pode ser null)
   * @param {Array}  opts.elements       – elementos de personalização
   * @param {number} [opts.pixelRatio=2] – resolução da imagem
   * @param {boolean} [opts.artOnly=false] – se true, exporta só a arte (sem mockup/máscara)
   * @param {number} [opts.width]        – largura do container de referência
   * @param {number} [opts.height]       – altura do container de referência
   */
  const exportCanvas = async ({
    product,
    color,
    model,
    elements,
    pixelRatio = 2,
    artOnly = false,
    width: overrideW,
    height: overrideH,
  }) => {
    try {
      const hasModelMockup = Boolean(model?.mockupImageUrl);
      const backgroundUrl = model?.mockupImageUrl || color?.image || product.image;
      const maskUrl = model?.maskImageUrl || null;

      // Dimensões do container (mesmas proporções do CSS).
      // Se width/height forem passados (do previewRef), usa eles;
      // senão usa as proporções padrão do componente.
      let containerW, containerH;
      if (overrideW && overrideH) {
        containerW = overrideW;
        containerH = overrideH;
      } else if (hasModelMockup) {
        // aspect-[331/590], h-[560px]
        containerH = 560;
        containerW = 560 * (331 / 590);
      } else {
        containerW = 500;
        containerH = 560;
      }

      const canvas = document.createElement('canvas');
      canvas.width = Math.round(containerW * pixelRatio);
      canvas.height = Math.round(containerH * pixelRatio);
      const ctx = canvas.getContext('2d');
      ctx.scale(pixelRatio, pixelRatio);

      // ── Camada 1: Fundo ──────────────────────────────────────────────
      if (!artOnly) {
        // Havendo qualquer foto (mockup, imagem da cor ou capa do produto),
        // o fundo é neutro (branco). A cor sólida (hex) só entra quando NÃO
        // há imagem nenhuma — senão a cor "vaza" nas laterais da foto (ex:
        // caneta preta com foto de fundo branco).
        if (backgroundUrl) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, containerW, containerH);
        } else if (color?.hex) {
          ctx.fillStyle = color.hex;
          ctx.fillRect(0, 0, containerW, containerH);
        }

        // Imagem de fundo (mockup ou produto)
        if (backgroundUrl) {
          try {
            const bgImg = await loadImage(backgroundUrl);
            drawContain(ctx, bgImg, 0, 0, containerW, containerH);
          } catch (err) {
            console.warn('Não foi possível carregar a imagem de fundo:', err);
          }
        }
      }

      // ── Camada 2: Elementos de personalização ────────────────────────
      for (const element of elements) {
        const elX = (element.x / 100) * containerW;
        const elY = (element.y / 100) * containerH;
        const elW = (element.width / 100) * containerW;
        const elH = (element.height / 100) * containerH;

        ctx.save();

        // Rotação em torno do centro do elemento
        const centerX = elX + elW / 2;
        const centerY = elY + elH / 2;
        ctx.translate(centerX, centerY);
        ctx.rotate((element.rotation * Math.PI) / 180);
        ctx.translate(-centerX, -centerY);

        if (element.type === 'text') {
          const fontSize = element.fontSize || 20;
          const fontWeight = element.fontWeight || 600;
          const fontFamily = element.fontFamily || 'Inter, sans-serif';
          ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
          ctx.fillStyle = element.color || '#1a1a1a';
          ctx.textAlign = element.textAlign || 'center';
          ctx.textBaseline = 'middle';
          const text = element.content?.trim() ? element.content : 'Seu texto aqui';

          let textX;
          if (element.textAlign === 'left') textX = elX;
          else if (element.textAlign === 'right') textX = elX + elW;
          else textX = elX + elW / 2;

          ctx.fillText(text, textX, elY + elH / 2, elW);
        } else if (element.type === 'image' && element.src) {
          try {
            const elImg = await loadImage(element.src);
            // object-fill: preenche toda a caixa (mesmo comportamento do CSS)
            ctx.drawImage(elImg, elX, elY, elW, elH);
          } catch (err) {
            console.warn('Não foi possível carregar elemento de imagem:', err);
          }
        }

        ctx.restore();
      }

      // ── Camada 3: Máscara ────────────────────────────────────────────
      if (maskUrl && !artOnly) {
        try {
          const maskImg = await loadImage(maskUrl);
          drawContain(ctx, maskImg, 0, 0, containerW, containerH);
        } catch (err) {
          console.warn('Não foi possível carregar a máscara:', err);
        }
      }

      return canvas.toDataURL('image/png');
    } catch (err) {
      console.error('exportCanvas falhou:', err);
      return null;
    }
  };

  return { exportCanvas };
}
