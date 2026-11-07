// Central de Artes: chamados das unidades pedindo artes de divulgação.
// As mesmas funções servem ao Studio (client `supabase`, sessão da unidade) e
// ao Painel (client `supabaseAdmin`, sessão da equipe). Quem vê o quê é
// decidido pelo banco (cada unidade só enxerga os próprios chamados).

const REQUEST_FIELDS =
  'id, number, reseller_id, reseller_name, title, art_type, purpose, due_date, status, assignee, unit_unread, team_unread, last_message, last_message_at, created_at';

const toRequest = (r) => ({
  id: r.id,
  number: r.number,
  resellerId: r.reseller_id,
  unit: r.reseller_name,
  title: r.title,
  artType: r.art_type,
  purpose: r.purpose,
  dueDate: r.due_date,
  status: r.status,
  assignee: r.assignee,
  unitUnread: r.unit_unread,
  teamUnread: r.team_unread,
  lastMessage: r.last_message,
  lastMessageAt: r.last_message_at,
  createdAt: r.created_at,
});

const toMessage = (m) => ({
  id: m.id,
  from: m.sender,
  author: m.author_name,
  text: m.body,
  imageUrl: m.image_url,
  fileName: m.file_name,
  deliverable: m.deliverable,
  createdAt: m.created_at,
});

export async function fetchArtRequests(client) {
  const { data, error } = await client
    .from('art_requests')
    .select(REQUEST_FIELDS)
    .order('last_message_at', { ascending: false });
  if (error) {
    console.error('Error fetching art requests:', error);
    return [];
  }
  return data.map(toRequest);
}

export async function fetchArtMessages(client, requestId) {
  const { data, error } = await client
    .from('art_messages')
    .select('id, sender, author_name, body, image_url, file_name, deliverable, created_at')
    .eq('request_id', requestId)
    .order('created_at', { ascending: true });
  if (error) {
    console.error('Error fetching art messages:', error);
    return [];
  }
  return data.map(toMessage);
}

/** Abre um chamado (a unidade é definida pelo login) com a primeira mensagem. */
export async function createArtRequest(client, { title, artType, purpose, dueDate, text, files = [] }) {
  const { data, error } = await client
    .from('art_requests')
    .insert({ title: title.trim(), art_type: artType, purpose, due_date: dueDate || null, reseller_id: null })
    .select(REQUEST_FIELDS)
    .single();
  if (error) {
    console.error('Error creating art request:', error);
    return { request: null, error };
  }
  const sent = await sendArtMessage(client, data.id, { text, files });
  return { request: toRequest(data), error: sent.error };
}

export async function updateArtRequest(client, id, patch) {
  const row = {};
  if (patch.title !== undefined) row.title = patch.title;
  if (patch.purpose !== undefined) row.purpose = patch.purpose;
  if (patch.artType !== undefined) row.art_type = patch.artType;
  if (patch.dueDate !== undefined) row.due_date = patch.dueDate || null;
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.assignee !== undefined) row.assignee = patch.assignee || null;
  const { error } = await client.from('art_requests').update(row).eq('id', id);
  if (error) console.error('Error updating art request:', error);
  return { error };
}

export async function markArtRequestRead(client, id) {
  const { error } = await client.rpc('art_mark_read', { p_request: id });
  if (error) console.error('Error marking art request read:', error);
}

async function uploadArtFile(client, requestId, file) {
  let ext = (file.name.includes('.') ? file.name.split('.').pop() : '').toLowerCase().replace(/[^a-z0-9]/g, '');
  // .jfif/.pjpeg são JPG; salvamos como .jpg para aparecer como foto na conversa.
  if (['jfif', 'pjpeg', 'pjp', 'jpe'].includes(ext) || (!ext && file.type === 'image/jpeg')) ext = 'jpg';
  if (!ext) ext = 'bin';
  const path = `${requestId}/${crypto.randomUUID()}.${ext}`;
  const contentType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : file.type || undefined;
  const { error } = await client.storage.from('art-requests').upload(path, file, { contentType });
  if (error) {
    console.error('Error uploading art file:', error);
    return { url: null, error };
  }
  return { url: client.storage.from('art-requests').getPublicUrl(path).data.publicUrl, error: null };
}

/** Envia texto e/ou anexos. Cada anexo vira uma mensagem própria. */
export async function sendArtMessage(client, requestId, { text = '', files = [], deliverable = false }) {
  const rows = [];
  for (const file of files) {
    const { url, error } = await uploadArtFile(client, requestId, file);
    if (error) return { error };
    rows.push({ request_id: requestId, sender: 'unit', body: '', image_url: url, file_name: file.name, deliverable });
  }
  if (text.trim()) {
    if (rows.length) rows[rows.length - 1].body = text.trim();
    else rows.push({ request_id: requestId, sender: 'unit', body: text.trim(), deliverable: false });
  }
  if (!rows.length) return { error: null };
  // Uma por vez para manter a ordem na conversa.
  for (const row of rows) {
    const { error } = await client.from('art_messages').insert(row);
    if (error) {
      console.error('Error sending art message:', error);
      return { error };
    }
  }
  return { error: null };
}

/** Avisa quando algo muda nos chamados (ao vivo). Retorna a função de cancelar. */
export function subscribeArtChanges(client, name, onChange) {
  const channel = client
    .channel(`arts-${name}-${Math.random().toString(36).slice(2)}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'art_requests' }, (p) => onChange({ type: 'request', payload: p }))
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'art_messages' }, (p) => onChange({ type: 'message', payload: p }))
    .subscribe();
  return () => client.removeChannel(channel);
}
