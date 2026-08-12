import { useRef, useState, useEffect, useCallback } from 'react';
import Moveable from 'react-moveable';
import { useStore } from '../../../store/useStore';
import PersonalizationElement from './PersonalizationElement';

export default function Canvas() {
  const containerRef = useRef(null);
  const elementNodes = useRef({});
  const moveableRef = useRef(null);
  const [targetEl, setTargetEl] = useState(null);

  const product = useStore((s) => s.selectedProduct);
  const color = useStore((s) => s.selectedColor);
  const selectedModel = useStore((s) => s.selectedModel);
  const elements = useStore((s) => s.elements);
  const selectedElementId = useStore((s) => s.selectedElementId);
  const selectElement = useStore((s) => s.selectElement);
  const updateElement = useStore((s) => s.updateElement);
  const removeElement = useStore((s) => s.removeElement);

  useEffect(() => {
    setTargetEl(selectedElementId ? elementNodes.current[selectedElementId] || null : null);
  }, [selectedElementId, elements]);

  useEffect(() => {
    if (!selectedElementId) return undefined;

    const handleDocumentMouseDown = (e) => {
      // Ignora se o clique foi dentro do próprio canvas (já é tratado no onMouseDown do container)
      if (containerRef.current?.contains(e.target)) return;

      // Ignora se clicou em um botão (ex: Toolbar, ou botões de remover/voltar/próximo)
      if (e.target.closest('button')) return;

      // Ignora se clicou em inputs, textareas ou selects (PropertiesPanel)
      if (e.target.closest('input, textarea, select')) return;

      // Ignora se clicou em qualquer lugar dentro do painel lateral (PropertiesPanel / LayerList)
      if (e.target.closest('.bg-panel')) return;

      // Se clicou no fundo "vazio" da página, desseleciona
      selectElement(null);
    };

    document.addEventListener('mousedown', handleDocumentMouseDown);
    return () => document.removeEventListener('mousedown', handleDocumentMouseDown);
  }, [selectedElementId, selectElement]);

  const selectedElement = elements.find((el) => el.id === selectedElementId);
  // Marca quando a próxima mudança de x/y/width/height/rotation já veio de
  // um gesto da própria Moveable (drag/resize/rotate end) — nesses casos ela
  // já está com a referência certa, e chamar updateRect() de novo competia
  // com o re-render do React e podia reverter o valor aplicado.
  const skipNextRectSync = useRef(false);
  // true só durante um gesto de arrastar/redimensionar realmente ativo. O
  // auto-scroll (perto da borda da tela) continua disparando onResize/onDrag
  // por conta própria por um instante depois do mouse já ter sido solto —
  // sem essa trava, esses eventos "fantasmas" escreviam direto no DOM (em
  // px) por fora do fluxo normal, e nada convertia isso de volta pra %,
  // deixando a caixa da imagem com um tamanho desatualizado pra sempre.
  const isGestureActiveRef = useRef(false);

  // Quando o alvo muda por fora do gesto (ex: slider de Rotação do painel
  // lateral), a Moveable não fica sabendo sozinha. Sem chamar updateRect()
  // nesse caso, o próximo redimensionar/girar parte de referência
  // desatualizada e desalinha a moldura da imagem de verdade.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- depende só dos
  // campos numéricos de propósito; `selectedElement` muda de referência a
  // cada render (é um .find() novo) e dispararia isso o tempo todo.
  useEffect(() => {
    if (!selectedElement) return;
    if (skipNextRectSync.current) {
      skipNextRectSync.current = false;
      return;
    }
    moveableRef.current?.updateRect();
  }, [selectedElement?.x, selectedElement?.y, selectedElement?.width, selectedElement?.height, selectedElement?.rotation]);

  useEffect(() => {
    if (!selectedElementId) return undefined;

    const handleKeyDown = (e) => {
      // Não intercepta teclas de edição quando o foco está num campo de
      // texto (ex: caixa "Conteúdo" do painel) — senão Delete/Backspace
      // apagavam o elemento inteiro em vez de editar o texto.
      const ae = document.activeElement;
      if (
        ae?.isContentEditable ||
        ae?.tagName === 'INPUT' ||
        ae?.tagName === 'TEXTAREA' ||
        ae?.tagName === 'SELECT'
      )
        return;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        removeElement(selectedElementId);
        return;
      }

      const step = e.shiftKey ? 5 : 1;
      const deltas = {
        ArrowLeft: { dx: -step, dy: 0 },
        ArrowRight: { dx: step, dy: 0 },
        ArrowUp: { dx: 0, dy: -step },
        ArrowDown: { dx: 0, dy: step },
      };
      const delta = deltas[e.key];
      if (!delta) return;

      e.preventDefault();
      const current = elements.find((el) => el.id === selectedElementId);
      if (!current) return;
      updateElement(selectedElementId, { x: current.x + delta.dx, y: current.y + delta.dy });
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedElementId, elements, updateElement, removeElement]);

  const registerRef = useCallback((id, node) => {
    elementNodes.current[id] = node;
  }, []);

  const containerRect = () => containerRef.current.getBoundingClientRect();

  const area = product.personalizationArea;
  // Guia tracejada da área de personalização — desligada temporariamente a
  // pedido do cliente. Reativar trocando para true.
  const SHOW_AREA_GUIDE = false;
  // 3 camadas quando o modelo tem mockup: 1) foto do produto (fundo),
  // 2) arte do cliente (meio), 3) máscara por cima de tudo — a parte opaca
  // dela cobre a arte fora da área de personalização (câmera, bordas), a
  // parte transparente deixa a arte aparecer. Não é um clip-mask de CSS,
  // é só uma imagem PNG empilhada por cima mesmo.
  const backgroundImage = selectedModel?.mockupImageUrl || color?.image || product.image;
  const maskImageUrl = selectedModel?.maskImageUrl || null;
  const hasModelMockup = Boolean(selectedModel?.mockupImageUrl);
  // Perspectiva (skew) da área: inclina a base do conteúdo do texto só pra
  // dar a ilusão de estar deitado na superfície. Aplicado no conteúdo interno
  // (não na caixa/target da Moveable), pra os manípulos continuarem alinhados.
  const previewSkew = Number(area?.skew) || 0;

  return (
    <div
      ref={containerRef}
      data-tour="canvas"
      onMouseDown={(e) => {
        // Desseleciona ao clicar em qualquer lugar que NÃO seja um controle da
        // moldura (Moveable). O elemento em si faz stopPropagation no seu
        // próprio mousedown, então clicar nele nunca chega aqui — só o "vazio"
        // (fora da moldura, incluindo o mockup) cai aqui e desseleciona.
        if (e.target.closest?.('.moveable-control-box')) return;
        selectElement(null);
      }}
      // Sem overflow-hidden aqui de propósito: é a partir desta caixa que o
      // Moveable calcula posição dos manípulos de redimensionar/girar — se
      // ela recortasse o conteúdo, os manípulos sumiam quando a arte chegava
      // perto da borda, tirando espaço de edição do cliente.
      className={`relative ${
        hasModelMockup ? 'mx-auto h-[600px] aspect-[331/590]' : 'h-[560px] w-full'
      }`}
    >
      <div
        className={`pointer-events-none absolute inset-0 overflow-hidden rounded-2xl shadow-sm transition-colors duration-500 isolate ${
          hasModelMockup ? 'bg-white' : color?.image ? 'bg-panel' : ''
        }`}
        style={hasModelMockup || color?.image ? undefined : { backgroundColor: color.hex }}
      >
        <img
          src={backgroundImage}
          crossOrigin="anonymous"
          alt={product.name}
          draggable={false}
          className={`absolute inset-0 object-contain ${
            hasModelMockup ? 'h-full w-full' : 'm-auto max-h-[92%] max-w-[92%]'
          }`}
        />

        {SHOW_AREA_GUIDE && !maskImageUrl && (
          <div
            className="absolute rounded-lg border border-dashed border-accent/50"
            style={{
              left: `${area.x}%`,
              top: `${area.y}%`,
              width: `${area.width}%`,
              height: `${area.height}%`,
            }}
          />
        )}

        <div className="pointer-events-auto absolute inset-0" style={{ zIndex: 10 }}>
          {elements.map((element) => (
            <PersonalizationElement
              key={element.id}
              element={element}
              skew={previewSkew}
              isSelected={element.id === selectedElementId}
              registerRef={registerRef}
              onSelect={(e) => {
                e.stopPropagation();
                selectElement(element.id);
              }}
            />
          ))}
        </div>

        {maskImageUrl && (
          <img
            src={maskImageUrl}
            crossOrigin="anonymous"
            alt=""
            draggable={false}
            className="absolute inset-0 h-full w-full object-contain"
            style={{ zIndex: 9999 }}
          />
        )}
      </div>

      {targetEl && (
        <Moveable
          ref={moveableRef}
          target={targetEl}
          draggable
          resizable
          rotatable
          throttleDrag={0}
          throttleResize={0}
          throttleRotate={0}
          // Sempre proporcional — fixo, nunca muda durante o uso do mesmo
          // alvo (mudar essa prop no meio do gesto causava dessincronia).
          keepRatio
          // Só cantos: manípulo de lateral/meio (um eixo só) é ambíguo com
          // keepRatio ligado (a lib não sabe se mantém centro ou borda fixa)
          // e colapsava a altura. Cantos não têm essa ambiguidade.
          renderDirections={['nw', 'ne', 'sw', 'se']}
          // O auto-scroll nativo da lib (scrollable) causava eventos de
          // resize "fantasmas" depois do mouse solto, corrompendo o tamanho
          // salvo (via combinação com keepRatio + rotação) — removido em
          // troca de estabilidade. Sem ele, dá pra continuar redimensionando
          // rolando a página manualmente entre um arraste e outro.
          onDragStart={() => {
            isGestureActiveRef.current = true;
          }}
          onDrag={({ target, left, top }) => {
            if (!isGestureActiveRef.current) return;
            if (!Number.isFinite(left) || !Number.isFinite(top)) return;
            target.style.left = `${left}px`;
            target.style.top = `${top}px`;
          }}
          onDragEnd={({ target }) => {
            isGestureActiveRef.current = false;
            const rect = containerRect();
            const x = (parseFloat(target.style.left) / rect.width) * 100;
            const y = (parseFloat(target.style.top) / rect.height) * 100;
            // Guarda contra valor inválido (NaN) — sem isso, um cálculo ruim
            // gravava NaN no estado e corrompia o elemento permanentemente.
            if (!Number.isFinite(x) || !Number.isFinite(y)) return;
            skipNextRectSync.current = true;
            updateElement(selectedElementId, { x, y });
          }}
          onResizeStart={() => {
            isGestureActiveRef.current = true;
          }}
          onResize={({ target, width, height, drag }) => {
            if (!isGestureActiveRef.current) return;
            if (![width, height, drag.left, drag.top].every(Number.isFinite)) return;
            target.style.width = `${width}px`;
            target.style.height = `${height}px`;
            target.style.left = `${drag.left}px`;
            target.style.top = `${drag.top}px`;
          }}
          onResizeEnd={({ target }) => {
            isGestureActiveRef.current = false;
            const rect = containerRect();
            const width = (parseFloat(target.style.width) / rect.width) * 100;
            const height = (parseFloat(target.style.height) / rect.height) * 100;
            const x = (parseFloat(target.style.left) / rect.width) * 100;
            const y = (parseFloat(target.style.top) / rect.height) * 100;
            if (![width, height, x, y].every(Number.isFinite)) return;
            skipNextRectSync.current = true;
            updateElement(selectedElementId, { width, height, x, y });
          }}
          onRotate={({ target, rotate }) => {
            target.style.transform = `rotate(${rotate}deg)`;
          }}
          onRotateEnd={({ lastEvent }) => {
            if (!lastEvent) return;
            skipNextRectSync.current = true;
            updateElement(selectedElementId, { rotation: lastEvent.rotate });
          }}
        />
      )}
    </div>
  );
}
