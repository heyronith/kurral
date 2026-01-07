import type { Claim, FactCheck } from '../types';

export type PolicyDecision = {
  status: 'clean' | 'needs_review' | 'blocked';
  reasons: string[];
  escalateToHuman: boolean;
};

const findFactCheckForClaim = (claim: Claim, factChecks: FactCheck[]): FactCheck | undefined => {
  return factChecks.find((fc) => fc.claimId === claim.id);
};

export function evaluatePolicy(claims: Claim[], factChecks: FactCheck[]): PolicyDecision {
  if (claims.length === 0) {
    return {
      status: 'clean',
      reasons: ['No extractable claims'],
      escalateToHuman: false,
    };
  }

  const reasons: string[] = [];
  let status: PolicyDecision['status'] = 'clean';
  let escalateToHuman = false;

  claims.forEach((claim) => {
    const factCheck = findFactCheckForClaim(claim, factChecks);
    if (!factCheck) {
      status = status === 'blocked' ? 'blocked' : 'needs_review';
      reasons.push(`Claim "${claim.text}" lacks verification.`);
      escalateToHuman = true;
      return;
    }

    if (factCheck.verdict === 'false' && factCheck.confidence > 0.7) {
      status = 'blocked';
      reasons.push(`Claim "${claim.text}" is false with high confidence.`);
      escalateToHuman = true;
      return;
    }

    if (factCheck.verdict === 'unknown') {
      if (status !== 'blocked') {
        status = 'needs_review';
      }
      reasons.push(`Claim "${claim.text}" could not be verified.`);
      escalateToHuman = true;
      return;
    }

    if (factCheck.verdict === 'mixed') {
      if (status !== 'blocked') {
        status = 'needs_review';
      }
      reasons.push(`Claim "${claim.text}" has mixed evidence.`);
      escalateToHuman = true;
      return;
    }
  });

  if (reasons.length === 0) {
    reasons.push('All claims verified.');
  }

  return { status, reasons, escalateToHuman };
}
