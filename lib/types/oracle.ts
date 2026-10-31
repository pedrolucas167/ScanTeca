import type { OracleMode, OracleStage } from "@/lib/constants/oracle";
import type { OracleAction } from "@/lib/oracle-actions";

export interface Source {
  id: string;
  title: string;
  author: string;
  status?: string;
  genre?: string | null;
  relevance?: number | null;
  matchedBy?: string;
  evidence?: string | null;
  sourceType?: "book" | "diary" | "review";
  external?: boolean;
}

export interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  retrievalStats?: RetrievalStats;
  citations?: number[];
  action?: OracleAction;
}

export interface OracleStreamEvent {
  stage?: OracleStage;
  transcript?: string;
  sessionId?: string;
  sources?: Source[];
  retrievalStats?: RetrievalStats;
  citations?: number[];
  text?: string;
  action?: unknown;
}

export interface RetrievalStats {
  durationMs: number;
  metadataCandidates?: number;
  lexicalCandidates?: number;
  embeddingAvailable?: boolean;
  vectorCandidates: number;
  selectedBooks: number;
  selectedDiary: number;
  selectedReviews: number;
  externalBooks: number;
  scope: "library" | "all";
}

export interface OracleSession {
  id: string;
  title: string;
  mode: OracleMode;
  updatedAt: string;
  _count?: { messages: number; artifacts: number };
}

export interface OracleArtifact {
  id: string;
  title: string;
  type: string;
  content: string;
  sources?: Source[];
  updatedAt: string;
}
