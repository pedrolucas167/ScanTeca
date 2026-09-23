/**
 * Jev Query Routing
 * 
 * Analisa a query do usuário e decide instantaneamente se precisa de:
 * - search: busca vetorial no acervo
 * - chat: resposta direta (saudações, conversa casual)
 * - tool: acionar ferramenta específica
 * 
 * TODO: Substituir heurísticas por Jev API quando disponível
 */

export interface RoutingDecision {
  action: "search" | "chat" | "tool";
  confidence: number;
  filters?: Record<string, any>;
  tool?: string;
  params?: Record<string, any>;
  reason?: string;
}

interface Message {
  role: string;
  content: string;
}

const GREETING_PATTERNS = [
  /^(oi|olá|hey|e aí|bom dia|boa tarde|boa noite|oi tudo bem|olá tudo bem)/i,
  /^(tudo bem|como vai|e aí|beleza|suave)/i,
  /^(obrigado|valeu|thanks|agradeço)/i,
  /^(sim|não|talvez|claro|com certeza)/i,
  /^(ok|certo|entendido|beleza)/i,
];

const CHAT_PATTERNS = [
  /^(quem é você|o que você faz|como funciona|me explique)/i,
  /^(me conte|fale sobre|me diga)/i,
  /^(gostei|não gostei|achei|parece)/i,
  /^(interessante|legal|bacana|maneiro)/i,
  /^(sabe|conhece|já leu)/i,
];

const TOOL_PATTERNS = [
  /criar.*rota|montar.*rota|planejar.*leitura/i,
  /adicionar.*livro|cadastrar.*livro|incluir.*livro/i,
  /atualizar.*status|marcar.*como/i,
  /definir.*meta|configurar.*objetivo/i,
];

/**
 * Route query based on heuristics (TODO: replace with Jev API)
 */
export async function jevRouteQuery(
  query: string,
  history: Message[] = []
): Promise<RoutingDecision> {
  const trimmed = query.trim().toLowerCase();
  
  // 1. Check for greetings (highest priority)
  for (const pattern of GREETING_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        action: "chat",
        confidence: 0.95,
        reason: "Saudação detectada",
      };
    }
  }
  
  // 2. Check for casual chat
  for (const pattern of CHAT_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        action: "chat",
        confidence: 0.85,
        reason: "Conversa casual detectada",
      };
    }
  }
  
  // 3. Check for tool actions
  for (const pattern of TOOL_PATTERNS) {
    if (pattern.test(trimmed)) {
      const tool = extractTool(trimmed);
      return {
        action: "tool",
        confidence: 0.80,
        tool: tool.name,
        params: tool.params,
        reason: "Ação específica detectada",
      };
    }
  }
  
  // 4. Default to search (RAG pipeline)
  const filters = extractFilters(trimmed);
  
  return {
    action: "search",
    confidence: 0.75,
    filters,
    reason: "Query de busca no acervo",
  };
}

/**
 * Extract tool name and parameters from query
 */
function extractTool(query: string): { name: string; params: Record<string, any> } {
  if (/criar rota|montar rota|planejar leitura/i.test(query)) {
    return {
      name: "create_route",
      params: {},
    };
  }
  
  if (/adicionar livro|cadastrar livro|incluir livro/i.test(query)) {
    return {
      name: "add_book",
      params: {},
    };
  }
  
  if (/atualizar status|marcar como/i.test(query)) {
    const status = /lido/i.test(query) ? "READ" : 
                   /lendo/i.test(query) ? "READING" : 
                   "TO_READ";
    return {
      name: "update_status",
      params: { status },
    };
  }
  
  return {
    name: "unknown",
    params: {},
  };
}

/**
 * Extract metadata filters from query (simple heuristics)
 * TODO: Replace with Jev NLP extraction
 */
function extractFilters(query: string): Record<string, any> {
  const filters: Record<string, any> = {};
  
  // Extract year (4 digits)
  const yearMatch = query.match(/\b(19|20)\d{2}\b/);
  if (yearMatch) {
    filters.year = parseInt(yearMatch[0]);
  }
  
  // Extract status keywords
  if (/lido|terminado|concluído/i.test(query)) {
    filters.status = "READ";
  } else if (/lendo|atual|em andamento/i.test(query)) {
    filters.status = "READING";
  } else if (/quero ler|pretendo ler|a ler/i.test(query)) {
    filters.status = "TO_READ";
  }
  
  // Extract rating keywords
  if (/5 estrelas|nota 5|excelente|incrível/i.test(query)) {
    filters.rating_min = 5;
  } else if (/4 estrelas|nota 4|muito bom|ótimo/i.test(query)) {
    filters.rating_min = 4;
  } else if (/3 estrelas|nota 3|bom|razoável/i.test(query)) {
    filters.rating_min = 3;
  }
  
  return filters;
}

/**
 * Check if routing decision should use direct chat response
 */
export function shouldDirectChat(decision: RoutingDecision): boolean {
  return decision.action === "chat" && decision.confidence > 0.8;
}

/**
 * Check if routing decision should execute a tool
 */
export function shouldExecuteTool(decision: RoutingDecision): boolean {
  return decision.action === "tool" && decision.confidence > 0.7;
}
