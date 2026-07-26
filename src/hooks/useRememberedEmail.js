import { useState } from 'react';

/**
 * "Lembrar de mim" que guarda SÓ o e-mail no navegador (a senha nunca é
 * salva — fica com o gerenciador de senhas do próprio navegador). Pré-carrega
 * o e-mail salvo e persiste conforme o checkbox.
 */
export function useRememberedEmail(storageKey) {
  const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(storageKey) : null;
  const [email, setEmail] = useState(saved || '');
  const [remember, setRemember] = useState(Boolean(saved));

  // Chamar no login bem-sucedido: salva o e-mail se "lembrar" estiver marcado,
  // senão remove o que estivesse salvo.
  const persistEmail = (value) => {
    if (typeof localStorage === 'undefined') return;
    if (remember && value) localStorage.setItem(storageKey, value);
    else localStorage.removeItem(storageKey);
  };

  return { email, setEmail, remember, setRemember, persistEmail };
}
