const HIGH_RISK_DOMAINS = ['health', 'finance', 'politics'];
const isHighRiskClaim = (claim) => {
    return claim.riskLevel === 'high' || HIGH_RISK_DOMAINS.includes(claim.domain);
};
const findFactCheckForClaim = (claim, factChecks) => {
    return factChecks.find((fc) => fc.claimId === claim.id);
};
export function evaluatePolicy(claims, factChecks) {
    if (claims.length === 0) {
        return {
            status: 'clean',
            reasons: ['No extractable claims'],
            escalateToHuman: false,
        };
    }
    const reasons = [];
    let status = 'clean';
    let escalateToHuman = false;
    claims.forEach((claim) => {
        const factCheck = findFactCheckForClaim(claim, factChecks);
        if (!factCheck) {
            if (isHighRiskClaim(claim)) {
                status = status === 'blocked' ? 'blocked' : 'needs_review';
                reasons.push(`High-risk claim "${claim.text}" lacks verification.`);
                escalateToHuman = true;
            }
            return;
        }
        if (factCheck.verdict === 'false' && factCheck.confidence > 0.7) {
            status = 'blocked';
            reasons.push(`Claim "${claim.text}" is false with high confidence.`);
            escalateToHuman = true;
            return;
        }
        if (isHighRiskClaim(claim) && factCheck.verdict === 'mixed') {
            if (status !== 'blocked') {
                status = 'needs_review';
            }
            reasons.push(`High-risk claim "${claim.text}" has mixed evidence.`);
            escalateToHuman = true;
        }
        else if (factCheck.verdict === 'unknown') {
            if (status === 'clean') {
                status = 'needs_review';
            }
            reasons.push(`Claim "${claim.text}" could not be verified.`);
        }
    });
    if (reasons.length === 0) {
        reasons.push('All claims verified or low risk.');
    }
    return { status, reasons, escalateToHuman };
}
