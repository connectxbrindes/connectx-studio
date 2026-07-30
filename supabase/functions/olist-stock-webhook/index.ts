import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Webhook de estoque do Olist Tiny (integração "API do ERP" → Notificações →
// "URL de notificações do estoque" / "URL para envio de produtos").

Deno.serve(async (req: Request) => {
  let rawBody = "";
  let payload: any = null;

  try {
    rawBody = await req.text();
    // Tenta fazer o parse do JSON enviado pelo Tiny
    payload = JSON.parse(rawBody);
  } catch {
    payload = null;
  }

  console.log("OLIST_WEBHOOK_PAYLOAD:", payload);

  let sku = "";
  let estoque = 0;

  if (payload && payload.dados) {
    sku = payload.dados.codigo || "";
    estoque = payload.dados.estoqueAtual ?? 0;
    console.log(`[Tiny ERP] Recebido produto/estoque. SKU: ${sku}, EstoqueAtual: ${estoque}`);

    // Atualizando o banco de dados via Supabase (usando Service Role para burlar RLS se necessário)
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    
    if (supabaseUrl && supabaseServiceKey) {
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      // 1. Tenta atualizar se for um produto baseado em CORES
      const { error: errColor } = await supabase
        .from('product_colors')
        .update({ stock_quantity: estoque })
        .eq('bling_sku', sku);
      
      if (errColor) console.error("[Erro] product_colors:", errColor);

      // 2. Tenta atualizar se for um produto baseado em MODELOS (ex: Capas IPHONE11)
      const { error: errModel } = await supabase
        .from('product_model_variants')
        .update({ stock_quantity: estoque })
        .eq('bling_sku', sku);
        
      if (errModel) console.error("[Erro] product_model_variants:", errModel);

      console.log(`Estoque do SKU ${sku} atualizado com sucesso no banco de dados!`);
    } else {
      console.error("Variáveis do Supabase (URL ou KEY) não configuradas no Edge Function.");
    }
  }

  // O Tiny ERP ("API do ERP") exige que a gente responda com o formato de mapeamento
  // quando ele envia um produto, caso contrário dá erro de "Produto não mapeado".
  // Colocamos várias opções (id, idProduto, idMapeamento) para cobrir todas as versões da API do Tiny.
  return new Response(
    JSON.stringify({
      status: "OK",
      id: sku || "ID_DESCONHECIDO",
      idProduto: sku || "ID_DESCONHECIDO",
      idMapeamento: sku || "ID_DESCONHECIDO"
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }
  );
});
