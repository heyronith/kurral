/**
 * Value Pipeline v2 - Type Definitions
 * 
 * Simple, clean types for the redesigned pipeline.
 */

import type { Chirp, Comment, Claim, FactCheck, ValueScore } from '../../types';

// ============================================================================
// Pipeline Status
// ============================================================================

export type PipelineStatus = 'pending' | 'processing' | 'completed' | 'failed';

// ============================================================================
// Step 1: Pre-check Result
// ============================================================================

export type PreCheckResult = {
  needsFactCheck: boolean;
  confidence: number;
  reasoning: string;
  contentType: 'factual' | 'news' | 'opinion' | 'experience' | 'question' | 'humor' | 'other';
};

// ============================================================================
// Step 2: Claim Extraction Result
// ============================================================================

export type ClaimExtractionResult = {
  claims: Claim[];
  extractedAt: Date;
};

// ============================================================================
// Step 3: Evidence Gathering Result
// ============================================================================

export type Evidence = {
  source: string;
  url?: string;
  snippet: string;
  quality: number; // 0-1
  fetchedAt: Date;
};

export type EvidenceResult = {
  claimId: string;
  evidence: Evidence[];
  searchQuery?: string;
  searchSucceeded: boolean;
};

// ============================================================================
// Step 4: Fact Check Result (per claim)
// ============================================================================

export type FactCheckResult = {
  factCheck: FactCheck;
  usedEvidence: Evidence[];
};

// ============================================================================
// Step 5: Value Score Result
// ============================================================================

export type ValueScoreResult = {
  valueScore: ValueScore;
  penaltiesApplied: string[];
};

// ============================================================================
// Pipeline Result (Final Output)
// ============================================================================

export type PipelineResult = {
  success: boolean;
  status: PipelineStatus;
  
  // Pre-check
  preCheck?: PreCheckResult;
  
  // Claims
  claims: Claim[];
  
  // Fact checks
  factChecks: FactCheck[];
  factCheckStatus: 'clean' | 'needs_review' | 'blocked';
  
  // Value score
  valueScore?: ValueScore;
  
  // Metadata
  processedAt: Date;
  durationMs: number;
  stepsCompleted: string[];
  
  // Error info (if failed)
  error?: {
    step: string;
    message: string;
    isRetryable: boolean;
  };
};

// ============================================================================
// Pipeline Input
// ============================================================================

export type ChirpPipelineInput = {
  chirp: Chirp;
  skipPreCheck?: boolean; // Force full processing
};

export type CommentPipelineInput = {
  comment: Comment;
  parentChirp: Chirp;
  skipPreCheck?: boolean;
};

// ============================================================================
// Pipeline Options
// ============================================================================

export type PipelineOptions = {
  maxRetries?: number;
  timeoutMs?: number;
  skipValueScoring?: boolean;
};

// ============================================================================
// Side Effect Jobs (for async processing)
// ============================================================================

export type SideEffectJob = {
  type: 'reputation_update' | 'kurral_score_update';
  userId: string;
  contentId: string;
  contentType: 'chirp' | 'comment';
  data: Record<string, any>;
  createdAt: Date;
};

