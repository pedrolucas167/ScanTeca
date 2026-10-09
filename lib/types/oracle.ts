import type { OracleMode } from "@/lib/constants/oracle";

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
}

export interface RetrievalStats {
  durationMs: number;
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
