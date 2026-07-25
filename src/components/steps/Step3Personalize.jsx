import { useStore } from '../../store/useStore';
import Button from '../ui/Button';
import Canvas from './personalize/Canvas';
import Toolbar from './personalize/Toolbar';
import PropertiesPanel from './personalize/PropertiesPanel';
import LayerList from './personalize/LayerList';

export default function Step3Personalize() {
  const goNext = useStore((s) => s.goNext);
  const goBack = useStore((s) => s.goBack);
  const elements = useStore((s) => s.elements);

  return (
    <section className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_380px]">
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-3xl font-bold">Personalize seu produto</h1>
          <p className="mt-1 text-text-secondary">
            Adicione texto ou imagem e arraste, redimensione ou gire sobre o produto.
          </p>
        </div>
        <Toolbar />
        <Canvas />
      </div>

      <div className="flex flex-col gap-8 rounded-2xl border border-border bg-panel p-6">
        <PropertiesPanel />
        <LayerList />

        <div className="mt-auto flex justify-between pt-6">
          <Button variant="secondary" onClick={goBack}>
            Voltar
          </Button>
          <Button onClick={goNext}>{elements.length > 0 ? 'Próximo' : 'Pular personalização'}</Button>
        </div>
      </div>
    </section>
  );
}
