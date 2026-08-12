/**
 * Exporta todos os revendedores do Supabase para um arquivo Excel (.xlsx).
 *
 * Uso:
 *   node scripts/export-resellers.mjs
 *
 * Gera o arquivo "revendedores_export.xlsx" na raiz do projeto.
 */

import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// ---------- Carregar variáveis do .env manualmente ----------
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '..', '.env');
const envContent = readFileSync(envPath, 'utf-8');
const envVars = {};
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx === -1) continue;
  envVars[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
}

const supabaseUrl = envVars.VITE_SUPABASE_URL;
const supabaseAnonKey = envVars.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY precisam estar no .env');
  process.exit(1);
}

// ---------- Supabase client ----------
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false },
});

// ---------- Buscar revendedores ----------
console.log('🔄 Buscando revendedores do Supabase...');

const { data: resellers, error } = await supabase
  .from('resellers')
  .select('*')
  .order('name');

if (error) {
  console.error('❌ Erro ao buscar revendedores:', error.message);
  process.exit(1);
}

if (!resellers || resellers.length === 0) {
  console.log('⚠️  Nenhum revendedor encontrado.');
  process.exit(0);
}

console.log(`✅ ${resellers.length} revendedores encontrados.`);

// ---------- Mapear colunas para nomes amigáveis ----------
const columnMap = {
  id: 'ID',
  name: 'Nome',
  contact_name: 'Nome do Contato',
  cnpj_cpf: 'CNPJ / CPF',
  phone: 'Telefone / WhatsApp',
  email: 'E-mail',
  commission_rate: 'Comissão (%)',
  status: 'Status',
  notes: 'Observações',
  tiny_id: 'Tiny ID (ERP)',
  created_at: 'Criado em',
};

// Traduzir status para português
const statusMap = {
  active: 'Ativo',
  inactive: 'Inativo',
};

const rows = resellers.map((r) => {
  const row = {};
  for (const [key, label] of Object.entries(columnMap)) {
    let value = r[key];
    // Formatar status
    if (key === 'status') {
      value = statusMap[value] || value;
    }
    // Formatar data
    if (key === 'created_at' && value) {
      value = new Date(value).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    }
    row[label] = value ?? '';
  }
  // Incluir qualquer coluna extra que exista no banco mas não no map
  for (const key of Object.keys(r)) {
    if (!columnMap[key]) {
      row[key] = r[key] ?? '';
    }
  }
  return row;
});

// ---------- Gerar Excel ----------
const ws = XLSX.utils.json_to_sheet(rows);

// Auto-ajustar largura das colunas
const colWidths = Object.keys(rows[0]).map((key) => {
  const maxLen = Math.max(
    key.length,
    ...rows.map((row) => String(row[key] || '').length)
  );
  return { wch: Math.min(maxLen + 2, 50) };
});
ws['!cols'] = colWidths;

const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, 'Revendedores');

const outPath = resolve(__dirname, '..', 'revendedores_export.xlsx');
XLSX.writeFile(wb, outPath);

console.log(`📊 Arquivo Excel gerado: ${outPath}`);
