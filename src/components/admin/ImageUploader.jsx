import { useRef, useState } from 'react';
import { uploadProductImage } from '../../lib/api';

export default function ImageUploader({ value, onChange, label = 'Imagem' }) {
  const inputRef = useRef(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setError('');
    const { url, error: uploadError } = await uploadProductImage(file);
    setIsUploading(false);
    e.target.value = '';

    if (uploadError) {
      setError('Falha no upload da imagem.');
      return;
    }
    onChange(url);
  };

  return (
    <div className="flex flex-col gap-2 text-sm">
      <span className="font-medium">{label}</span>
      <div className="flex items-center gap-3">
        <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-bg">
          {value ? (
            <img src={value} alt="" className="h-full w-full object-contain" />
          ) : (
            <span className="text-xs text-text-secondary">Sem foto</span>
          )}
        </div>
        <button
          type="button"
          onClick={() => inputRef.current.click()}
          disabled={isUploading}
          className="rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium transition-colors hover:border-text-primary disabled:opacity-50"
        >
          {isUploading ? 'Enviando…' : 'Enviar imagem'}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
          aria-hidden="true"
        />
      </div>
      {error && <p className="text-xs text-accent">{error}</p>}
    </div>
  );
}
