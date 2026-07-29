// Armazenamento do carrinho em IndexedDB (em vez de localStorage).
//
// Cada item do carrinho carrega imagens em base64 — a miniatura (thumbnail) e
// a arte montada (artImage). Com 1-2 capas personalizadas com foto, isso soma
// vários MB e estoura a cota de ~5MB do localStorage. Quando a escrita
// estourava, o carrinho não era salvo e voltava VAZIO no próximo
// reload/navegação. O IndexedDB tem cota muito maior (centenas de MB), então
// o carrinho passa a persistir de forma confiável.
//
// Implementa a interface que o `createJSONStorage` do zustand espera
// (getItem/setItem/removeItem — podem ser assíncronos e devolver string|null).

const DB_NAME = 'personalization-studio';
const STORE_NAME = 'keyval';

function withStore(mode, run) {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(DB_NAME, 1);
    open.onupgradeneeded = () => {
      if (!open.result.objectStoreNames.contains(STORE_NAME)) {
        open.result.createObjectStore(STORE_NAME);
      }
    };
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction(STORE_NAME, mode);
      const req = run(tx.objectStore(STORE_NAME));
      tx.oncomplete = () => {
        db.close();
        resolve(req ? req.result : undefined);
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    };
  });
}

export const idbStorage = {
  getItem: async (name) => {
    try {
      const value = await withStore('readonly', (store) => store.get(name));
      return value ?? null;
    } catch {
      return null;
    }
  },
  setItem: async (name, value) => {
    try {
      await withStore('readwrite', (store) => store.put(value, name));
    } catch {
      /* sem espaço/indisponível: mantém só em memória nesta sessão */
    }
  },
  removeItem: async (name) => {
    try {
      await withStore('readwrite', (store) => store.delete(name));
    } catch {
      /* ignora */
    }
  },
};
