import { useRef, useState } from 'react';
import { uploadProductModel3D } from '../../lib/api';

export default function Model3DUploader({ value, onChange, label = 'Arquivo 3D (.obj)' }) {
  const inputRef = useRef(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setError('');
    const { url, error: uploadError } = await uploadProductModel3D(file);
    setIsUploading(false);
    e.target.value = '';

    if (uploadError) {
      setError(uploadError.message || 'Falha no upload do arquivo 3D.');
      return;
    }
    onChange(url);
  };

  return (
    <div className="flex flex-col gap-2 text-sm">
      <span className="font-medium">{label}</span>
      <div className="flex items-center gap-3">
        <div className="flex h-16 flex-1 items-center overflow-hidden rounded-lg border border-border bg-bg px-3">
          {value ? (
            <span className="truncate text-xs text-text-secondary" title={value}>
              {value.split('/').pop()}
            </span>
          ) : (
            <span className="text-xs text-text-secondary">Nenhum arquivo enviado</span>
          )}
        </div>
        <button
          type="button"
          onClick={() => inputRef.current.click()}
          disabled={isUploading}
          className="flex-shrink-0 rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium transition-colors hover:border-text-primary disabled:opacity-50"
        >
          {isUploading ? 'Enviando…' : 'Enviar .obj'}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".obj"
          onChange={handleFileChange}
          className="hidden"
          aria-hidden="true"
        />
      </div>
      {error && <p className="text-xs text-accent">{error}</p>}
    </div>
  );
}
