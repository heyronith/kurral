import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  Linking,
  ActivityIndicator,
} from 'react-native';
import type { Chirp, Claim, FactCheck, PostReviewContext } from '../types';
import { useTheme } from '../hooks/useTheme';
import ReviewContextModal from './ReviewContextModal';
import { reviewContextService } from '../services/reviewContextService';
import { useUserStore } from '../stores/useUserStore';

interface FactCheckStatusModalProps {
  visible: boolean;
  onClose: () => void;
  chirp: Chirp;
}

const FactCheckStatusModal: React.FC<FactCheckStatusModalProps> = ({
  visible,
  onClose,
  chirp,
}) => {
  const { colors } = useTheme();
  const [reviewContexts, setReviewContexts] = useState<PostReviewContext[]>([]);
  const [loadingContexts, setLoadingContexts] = useState(false);
  const [showReviewContextModal, setShowReviewContextModal] = useState(false);
  const { currentUser } = useUserStore();
  const dynamicStyles = getStyles(colors);

  useEffect(() => {
    if (visible && chirp) {
      // Debug: Log chirp data to help diagnose missing evidence
      console.log('[FactCheckStatusModal] Chirp data:', {
        id: chirp.id,
        factCheckStatus: chirp.factCheckStatus,
        factCheckingStatus: chirp.factCheckingStatus,
        claimsCount: chirp.claims?.length || 0,
        factChecksCount: chirp.factChecks?.length || 0,
        hasClaims: !!chirp.claims,
        hasFactChecks: !!chirp.factChecks,
        claims: chirp.claims,
        factChecks: chirp.factChecks,
        claimsIsArray: Array.isArray(chirp.claims),
        factChecksIsArray: Array.isArray(chirp.factChecks),
      });
      if (chirp.claims && chirp.claims.length > 0) {
        console.log('[FactCheckStatusModal] First claim:', chirp.claims[0]);
        const firstClaim = chirp.claims[0];
        const matchingFactCheck = chirp.factChecks?.find(fc => fc.claimId === firstClaim.id);
        console.log('[FactCheckStatusModal] Matching factCheck for first claim:', matchingFactCheck);
        if (matchingFactCheck) {
          console.log('[FactCheckStatusModal] FactCheck evidence:', matchingFactCheck.evidence);
          console.log('[FactCheckStatusModal] Evidence count:', matchingFactCheck.evidence?.length || 0);
        }
      }
      loadReviewContexts();
    }
  }, [visible, chirp]);

  const loadReviewContexts = async () => {
    setLoadingContexts(true);
    try {
      const contexts = await reviewContextService.getReviewContextsForChirp(chirp.id);
      setReviewContexts(contexts);
    } catch (error) {
      console.error('[FactCheckStatusModal] Error loading review contexts:', error);
    } finally {
      setLoadingContexts(false);
    }
  };

  const getStatusInfo = () => {
    switch (chirp.factCheckStatus) {
      case 'clean':
        return {
          icon: '✓',
          label: 'Verified',
          color: '#10B981',
          bgColor: 'rgba(16, 185, 129, 0.1)',
          borderColor: 'rgba(16, 185, 129, 0.2)',
        };
      case 'needs_review':
        return {
          icon: '⚠',
          label: 'Needs Review',
          color: '#F59E0B',
          bgColor: 'rgba(245, 158, 11, 0.1)',
          borderColor: 'rgba(245, 158, 11, 0.2)',
        };
      case 'blocked':
        return {
          icon: '✗',
          label: 'Blocked',
          color: '#EF4444',
          bgColor: 'rgba(239, 68, 68, 0.1)',
          borderColor: 'rgba(239, 68, 68, 0.2)',
        };
      default:
        return null;
    }
  };

  const statusInfo = getStatusInfo();
  if (!statusInfo || !visible) return null;

  const handleOpenURL = async (url: string) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      }
    } catch (error) {
      console.error('[FactCheckStatusModal] Error opening URL:', error);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={dynamicStyles.backdrop}>
        <View style={dynamicStyles.container}>
          {/* Header */}
          <View style={dynamicStyles.header}>
            <View style={dynamicStyles.headerLeft}>
              <View
                style={[
                  dynamicStyles.statusIcon,
                  { backgroundColor: statusInfo.bgColor, borderColor: statusInfo.borderColor },
                ]}
              >
                <Text style={[dynamicStyles.statusIconText, { color: statusInfo.color }]}>
                  {statusInfo.icon}
                </Text>
              </View>
              <View>
                <Text style={dynamicStyles.headerTitle}>Fact-Check Status</Text>
                <Text style={[dynamicStyles.headerSubtitle, { color: statusInfo.color }]}>
                  {statusInfo.label}
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={dynamicStyles.closeButton}>
              <Text style={dynamicStyles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView 
            style={dynamicStyles.content} 
            showsVerticalScrollIndicator={true}
            contentContainerStyle={{ paddingBottom: 40 }}
          >
            {/* Decision Summary - Prominent Section */}
            {chirp.factCheckStatus && (
              <View style={[
                dynamicStyles.decisionSummary,
                {
                  backgroundColor: chirp.factCheckStatus === 'blocked' 
                    ? 'rgba(239, 68, 68, 0.1)' 
                    : chirp.factCheckStatus === 'needs_review'
                    ? 'rgba(245, 158, 11, 0.1)'
                    : 'rgba(16, 185, 129, 0.1)',
                  borderColor: chirp.factCheckStatus === 'blocked'
                    ? 'rgba(239, 68, 68, 0.3)'
                    : chirp.factCheckStatus === 'needs_review'
                    ? 'rgba(245, 158, 11, 0.3)'
                    : 'rgba(16, 185, 129, 0.3)',
                }
              ]}>
                <Text style={dynamicStyles.decisionSummaryTitle}>Why {statusInfo.label}?</Text>
                {chirp.factChecks && chirp.factChecks.length > 0 ? (
                  <View style={dynamicStyles.decisionSummaryContent}>
                    {chirp.factChecks.map((fc, idx) => {
                      const claim = chirp.claims?.find(c => c.id === fc.claimId);
                      return (
                        <View key={idx} style={dynamicStyles.decisionSummaryItem}>
                          <Text style={dynamicStyles.decisionSummaryClaim}>
                            Claim: "{claim?.text || 'Unknown claim'}"
                          </Text>
                          <Text style={dynamicStyles.decisionSummaryVerdict}>
                            Verdict: <Text style={dynamicStyles.decisionSummaryVerdictBold}>{fc.verdict.toUpperCase()}</Text>
                            {' '}({(fc.confidence * 100).toFixed(0)}% confidence)
                            {fc.evidence && fc.evidence.length > 0 && (
                              <Text style={dynamicStyles.decisionSummarySources}>
                                {' '}• {fc.evidence.length} source{fc.evidence.length !== 1 ? 's' : ''} cited
                              </Text>
                            )}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                ) : (
                  <Text style={dynamicStyles.decisionSummaryText}>
                    {chirp.factCheckStatus === 'blocked' 
                      ? 'This post contains false or misleading claims that were verified as incorrect.'
                      : chirp.factCheckStatus === 'needs_review'
                      ? 'This post requires additional review by human experts.'
                      : 'This post has been verified and contains accurate information.'}
                  </Text>
                )}
              </View>
            )}

            {/* Claims & Fact Checks - Detailed View */}
            {(() => {
              const hasClaims = chirp.claims && Array.isArray(chirp.claims) && chirp.claims.length > 0;
              console.log('[FactCheckStatusModal] Rendering claims section:', {
                hasClaims,
                claimsLength: chirp.claims?.length,
                isArray: Array.isArray(chirp.claims),
                claims: chirp.claims,
              });
              
              if (!hasClaims) {
                return null;
              }
              
              return (
                <View style={dynamicStyles.section}>
                  <Text style={dynamicStyles.sectionTitle}>Detailed Evidence</Text>
                  {chirp.claims.map((claim, claimIdx) => {
                    if (!claim || !claim.id) {
                      console.warn('[FactCheckStatusModal] Invalid claim at index', claimIdx, claim);
                      return null;
                    }
                    const factCheck = chirp.factChecks?.find((fc) => fc && fc.claimId === claim.id);
                    console.log('[FactCheckStatusModal] Rendering claim:', {
                      claimId: claim.id,
                      claimText: claim.text,
                      hasFactCheck: !!factCheck,
                      factCheckId: factCheck?.id,
                      factCheckVerdict: factCheck?.verdict,
                      evidenceCount: factCheck?.evidence?.length || 0,
                    });
                    if (!factCheck) {
                      console.warn('[FactCheckStatusModal] No factCheck found for claim', claim.id, 'Available factChecks:', chirp.factChecks?.map(fc => ({ id: fc?.id, claimId: fc?.claimId })));
                    }
                    return (
                      <View key={claim.id || claimIdx} style={dynamicStyles.claimCard}>
                      {/* Claim Header */}
                      <View style={dynamicStyles.claimHeader}>
                        <Text style={dynamicStyles.claimTextBold}>"{claim.text}"</Text>
                        <View style={dynamicStyles.claimMeta}>
                          <View style={dynamicStyles.claimBadge}>
                            <Text style={dynamicStyles.claimBadgeText}>{claim.type}</Text>
                          </View>
                          <View style={dynamicStyles.claimBadge}>
                            <Text style={dynamicStyles.claimBadgeText}>{claim.domain}</Text>
                          </View>
                          <View style={dynamicStyles.claimBadge}>
                            <Text style={dynamicStyles.claimBadgeText}>Risk: {claim.riskLevel}</Text>
                          </View>
                        </View>
                      </View>

                      {/* Fact Check Result */}
                      {factCheck ? (
                        <View style={dynamicStyles.factCheckSection}>
                          <View style={dynamicStyles.verdictRow}>
                            <View
                              style={[
                                dynamicStyles.verdictBadgeLarge,
                                {
                                  backgroundColor:
                                    factCheck.verdict === 'true'
                                      ? 'rgba(16, 185, 129, 0.2)'
                                      : factCheck.verdict === 'false'
                                      ? 'rgba(239, 68, 68, 0.2)'
                                      : factCheck.verdict === 'mixed'
                                      ? 'rgba(245, 158, 11, 0.2)'
                                      : 'rgba(107, 114, 128, 0.1)',
                                  borderColor:
                                    factCheck.verdict === 'true'
                                      ? 'rgba(16, 185, 129, 0.4)'
                                      : factCheck.verdict === 'false'
                                      ? 'rgba(239, 68, 68, 0.4)'
                                      : factCheck.verdict === 'mixed'
                                      ? 'rgba(245, 158, 11, 0.4)'
                                      : 'rgba(107, 114, 128, 0.2)',
                                },
                              ]}
                            >
                              <Text
                                style={[
                                  dynamicStyles.verdictTextLarge,
                                  {
                                    color:
                                      factCheck.verdict === 'true'
                                        ? '#10B981'
                                        : factCheck.verdict === 'false'
                                        ? '#EF4444'
                                        : factCheck.verdict === 'mixed'
                                        ? '#F59E0B'
                                        : colors.textMuted,
                                  },
                                ]}
                              >
                                {factCheck.verdict.toUpperCase()}
                              </Text>
                            </View>
                            <View style={dynamicStyles.confidenceInfo}>
                              <Text style={dynamicStyles.confidenceLabel}>Confidence</Text>
                              <Text style={dynamicStyles.confidenceValue}>
                                {(factCheck.confidence * 100).toFixed(0)}%
                              </Text>
                              {factCheck.checkedAt && (
                                <Text style={dynamicStyles.checkedDate}>
                                  Checked {new Date(factCheck.checkedAt).toLocaleDateString()}
                                </Text>
                              )}
                            </View>
                          </View>

                          {/* Evidence Section - Prominent */}
                          {factCheck.evidence && factCheck.evidence.length > 0 ? (
                            <View style={dynamicStyles.evidenceSection}>
                              <View style={dynamicStyles.evidenceHeader}>
                                <Text style={dynamicStyles.evidenceIcon}>📚</Text>
                                <Text style={dynamicStyles.evidenceTitle}>
                                  Evidence Sources ({factCheck.evidence.length})
                                </Text>
                              </View>
                              {factCheck.evidence.map((evidence, idx) => (
                                <View key={idx} style={dynamicStyles.evidenceCardProminent}>
                                  <View style={dynamicStyles.evidenceCardHeader}>
                                    <Text style={dynamicStyles.evidenceSourceBold}>{evidence.source}</Text>
                                    {evidence.quality && (
                                      <Text style={dynamicStyles.evidenceQuality}>
                                        Quality: {(evidence.quality * 100).toFixed(0)}%
                                      </Text>
                                    )}
                                  </View>
                                  <Text style={dynamicStyles.evidenceSnippetBold}>"{evidence.snippet}"</Text>
                                  {evidence.url && (
                                    <TouchableOpacity
                                      onPress={() => handleOpenURL(evidence.url!)}
                                      style={dynamicStyles.evidenceLinkProminent}
                                      activeOpacity={0.7}
                                    >
                                      <Text style={dynamicStyles.evidenceLinkIcon}>🔗</Text>
                                      <Text style={dynamicStyles.evidenceLinkTextBold}>View Full Source</Text>
                                    </TouchableOpacity>
                                  )}
                                </View>
                              ))}
                            </View>
                          ) : (
                            <View style={dynamicStyles.noEvidenceCard}>
                              <Text style={dynamicStyles.noEvidenceText}>
                                No evidence sources were found for this claim.
                              </Text>
                            </View>
                          )}

                          {/* Caveats */}
                          {factCheck.caveats && factCheck.caveats.length > 0 && (
                            <View style={dynamicStyles.caveatsCard}>
                              <Text style={dynamicStyles.caveatsTitle}>⚠️ Important Notes:</Text>
                              {factCheck.caveats.map((caveat, idx) => (
                                <Text key={idx} style={dynamicStyles.caveatsText}>
                                  • {caveat}
                                </Text>
                              ))}
                            </View>
                          )}
                        </View>
                      ) : (
                        <View style={dynamicStyles.noFactCheckCard}>
                          <Text style={dynamicStyles.noFactCheckText}>
                            This claim has not been fact-checked yet.
                          </Text>
                        </View>
                      )}
                    </View>
                  );
                  })}
                </View>
              );
            })()}
            {(!chirp.claims || !Array.isArray(chirp.claims) || chirp.claims.length === 0) && (
              chirp.factCheckStatus ? (
                <View style={dynamicStyles.section}>
                  <Text style={dynamicStyles.sectionTitle}>Evidence</Text>
                  <View style={dynamicStyles.emptySection}>
                    <Text style={dynamicStyles.emptyText}>
                      {chirp.factCheckingStatus === 'in_progress' || chirp.factCheckingStatus === 'pending'
                        ? 'Fact-checking is still in progress. Evidence will appear here once processing is complete.'
                        : 'Evidence details are not available yet. This post has been marked as ' +
                          (chirp.factCheckStatus === 'blocked' ? 'blocked' : 
                           chirp.factCheckStatus === 'needs_review' ? 'needing review' : 'verified') +
                          ' but the detailed claims and evidence have not been loaded.'}
                    </Text>
                  </View>
                </View>
              ) : (
                <View style={dynamicStyles.emptySection}>
                  <Text style={dynamicStyles.emptyText}>
                    No claims have been extracted from this post yet.
                  </Text>
                </View>
              )
            )}

            {/* Value Score Section */}
            {chirp.valueScore && (
              <View style={dynamicStyles.section}>
                <Text style={dynamicStyles.sectionTitle}>Value Score</Text>
                <View style={dynamicStyles.valueScoreCard}>
                  <View style={dynamicStyles.valueScoreHeader}>
                    <Text style={dynamicStyles.valueScoreIcon}>⭐</Text>
                    <View style={dynamicStyles.valueScoreMain}>
                      <Text style={dynamicStyles.valueScoreTotal}>
                        {(chirp.valueScore.total * 100).toFixed(0)}
                      </Text>
                      <Text style={dynamicStyles.valueScoreLabel}>Overall Value Score</Text>
                    </View>
                    {chirp.valueScore.confidence && (
                      <View style={dynamicStyles.valueScoreConfidence}>
                        <Text style={dynamicStyles.valueScoreConfidenceValue}>
                          {(chirp.valueScore.confidence * 100).toFixed(0)}%
                        </Text>
                        <Text style={dynamicStyles.valueScoreConfidenceLabel}>Confidence</Text>
                      </View>
                    )}
                  </View>

                  {/* Value Score Breakdown */}
                  <View style={dynamicStyles.valueScoreBreakdown}>
                    <View style={dynamicStyles.valueScoreMetric}>
                      <Text style={dynamicStyles.valueScoreMetricLabel}>Epistemic</Text>
                      <Text style={dynamicStyles.valueScoreMetricValue}>
                        {(chirp.valueScore.epistemic * 100).toFixed(0)}
                      </Text>
                    </View>
                    <View style={dynamicStyles.valueScoreMetric}>
                      <Text style={dynamicStyles.valueScoreMetricLabel}>Insight</Text>
                      <Text style={dynamicStyles.valueScoreMetricValue}>
                        {(chirp.valueScore.insight * 100).toFixed(0)}
                      </Text>
                    </View>
                    <View style={dynamicStyles.valueScoreMetric}>
                      <Text style={dynamicStyles.valueScoreMetricLabel}>Practical</Text>
                      <Text style={dynamicStyles.valueScoreMetricValue}>
                        {(chirp.valueScore.practical * 100).toFixed(0)}
                      </Text>
                    </View>
                    <View style={dynamicStyles.valueScoreMetric}>
                      <Text style={dynamicStyles.valueScoreMetricLabel}>Relational</Text>
                      <Text style={dynamicStyles.valueScoreMetricValue}>
                        {(chirp.valueScore.relational * 100).toFixed(0)}
                      </Text>
                    </View>
                  </View>

                  {/* Value Explanation */}
                  {chirp.valueExplanation && (
                    <View style={dynamicStyles.valueExplanationSection}>
                      <Text style={dynamicStyles.valueExplanationTitle}>Explanation</Text>
                      <Text style={dynamicStyles.valueExplanationText}>{chirp.valueExplanation}</Text>
                    </View>
                  )}
                </View>
              </View>
            )}

            {/* Discussion Quality Section */}
            {chirp.discussionQuality && (
              <View style={dynamicStyles.section}>
                <Text style={dynamicStyles.sectionTitle}>Discussion Quality</Text>
                <View style={dynamicStyles.discussionQualityCard}>
                  <View style={dynamicStyles.discussionQualityGrid}>
                    <View style={dynamicStyles.discussionQualityMetric}>
                      <Text style={dynamicStyles.discussionQualityLabel}>Informativeness</Text>
                      <Text style={dynamicStyles.discussionQualityValue}>
                        {(chirp.discussionQuality.informativeness * 100).toFixed(0)}%
                      </Text>
                    </View>
                    <View style={dynamicStyles.discussionQualityMetric}>
                      <Text style={dynamicStyles.discussionQualityLabel}>Civility</Text>
                      <Text style={dynamicStyles.discussionQualityValue}>
                        {(chirp.discussionQuality.civility * 100).toFixed(0)}%
                      </Text>
                    </View>
                    <View style={dynamicStyles.discussionQualityMetric}>
                      <Text style={dynamicStyles.discussionQualityLabel}>Reasoning Depth</Text>
                      <Text style={dynamicStyles.discussionQualityValue}>
                        {(chirp.discussionQuality.reasoningDepth * 100).toFixed(0)}%
                      </Text>
                    </View>
                    <View style={dynamicStyles.discussionQualityMetric}>
                      <Text style={dynamicStyles.discussionQualityLabel}>Cross-Perspective</Text>
                      <Text style={dynamicStyles.discussionQualityValue}>
                        {(chirp.discussionQuality.crossPerspective * 100).toFixed(0)}%
                      </Text>
                    </View>
                  </View>
                  {chirp.discussionQuality.summary && (
                    <View style={dynamicStyles.discussionQualitySummary}>
                      <Text style={dynamicStyles.discussionQualitySummaryTitle}>Summary</Text>
                      <Text style={dynamicStyles.discussionQualitySummaryText}>
                        {chirp.discussionQuality.summary}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            )}

            {/* Add Context Button - for needs_review posts */}
            {chirp.factCheckStatus === 'needs_review' && currentUser && currentUser.id !== chirp.authorId && (
              <View style={dynamicStyles.section}>
                <TouchableOpacity
                  onPress={() => {
                    setShowReviewContextModal(true);
                  }}
                  style={dynamicStyles.addContextButton}
                  activeOpacity={0.8}
                >
                  <Text style={dynamicStyles.addContextButtonText}>Add Context for Review</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Review Contexts */}
            {loadingContexts ? (
              <View style={dynamicStyles.loadingSection}>
                <ActivityIndicator size="small" color={colors.accent} />
                <Text style={dynamicStyles.loadingText}>Loading review contexts...</Text>
              </View>
            ) : reviewContexts.length > 0 ? (
              <View style={dynamicStyles.section}>
                <Text style={dynamicStyles.sectionTitle}>User Reviews</Text>
                {reviewContexts.map((review) => (
                  <View
                    key={review.id}
                    style={[
                      dynamicStyles.reviewCard,
                      review.action === 'validate' ? dynamicStyles.validateReviewCard : dynamicStyles.invalidateReviewCard
                    ]}
                  >
                    <View style={dynamicStyles.reviewHeader}>
                      <Text style={[
                        dynamicStyles.reviewActionIcon,
                        review.action === 'validate' ? dynamicStyles.validateIcon : dynamicStyles.invalidateIcon
                      ]}>
                        {review.action === 'validate' ? '✓' : '✗'}
                      </Text>
                      <Text style={[
                        dynamicStyles.reviewActionText,
                        review.action === 'validate' ? dynamicStyles.validateText : dynamicStyles.invalidateText
                      ]}>
                        {review.action === 'validate' ? 'Validated' : 'Invalidated'}
                      </Text>
                      <Text style={dynamicStyles.reviewDate}>
                        {new Date(review.createdAt).toLocaleDateString()}
                      </Text>
                    </View>
                    {review.sources && review.sources.length > 0 && (
                      <View style={dynamicStyles.sourcesSection}>
                        <Text style={dynamicStyles.sourcesTitle}>Sources:</Text>
                        {review.sources.map((source, idx) => (
                          <TouchableOpacity
                            key={idx}
                            onPress={() => handleOpenURL(source)}
                            activeOpacity={0.7}
                          >
                            <Text style={dynamicStyles.sourceLink}>
                              {source}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                    {review.context && (
                      <View style={dynamicStyles.contextSection}>
                        <Text style={dynamicStyles.contextTitle}>Context:</Text>
                        <Text style={dynamicStyles.contextText}>{review.context}</Text>
                      </View>
                    )}
                  </View>
                ))}
              </View>
            ) : null}
          </ScrollView>
        </View>
      </View>

      {/* Review Context Modal */}
      <ReviewContextModal
        visible={showReviewContextModal}
        onClose={() => setShowReviewContextModal(false)}
        chirp={chirp}
        onSubmitted={async () => {
          // Reload review contexts after submission
          await loadReviewContexts();
        }}
      />
    </Modal>
  );
};

const getStyles = (colors: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: colors.backgroundElevated,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    minHeight: '50%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  statusIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusIconText: {
    fontSize: 20,
    fontWeight: '700',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  headerSubtitle: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 2,
  },
  closeButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    fontSize: 24,
    color: colors.textMuted,
    fontWeight: '300',
  },
  content: {
    flexGrow: 1,
    flexShrink: 1,
    padding: 20,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 16,
  },
  claimCard: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    marginBottom: 12,
  },
  decisionSummary: {
    marginBottom: 20,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
  },
  decisionSummaryTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 12,
  },
  decisionSummaryContent: {
    gap: 12,
  },
  decisionSummaryItem: {
    marginBottom: 8,
  },
  decisionSummaryClaim: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  decisionSummaryVerdict: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  decisionSummaryVerdictBold: {
    fontWeight: '700',
  },
  decisionSummarySources: {
    fontSize: 12,
    color: colors.textMuted,
  },
  decisionSummaryText: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  claimHeader: {
    marginBottom: 12,
  },
  claimTextBold: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    lineHeight: 20,
    marginBottom: 8,
  },
  claimText: {
    fontSize: 14,
    color: colors.textPrimary,
    lineHeight: 20,
    marginBottom: 8,
  },
  claimMeta: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  claimBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: colors.border + '33',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  claimBadgeText: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '600',
  },
  factCheckSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  verdictRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  verdictBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
  },
  verdictBadgeLarge: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 2,
  },
  verdictText: {
    fontSize: 11,
    fontWeight: '700',
  },
  verdictTextLarge: {
    fontSize: 14,
    fontWeight: '700',
  },
  confidenceInfo: {
    flex: 1,
    alignItems: 'flex-end',
  },
  confidenceLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  confidenceValue: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  checkedDate: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 2,
  },
  confidenceText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  evidenceSection: {
    marginTop: 16,
  },
  evidenceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  evidenceIcon: {
    fontSize: 18,
  },
  evidenceTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  evidenceCard: {
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    marginBottom: 8,
  },
  evidenceCardProminent: {
    backgroundColor: colors.background,
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
  },
  evidenceCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  evidenceSource: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 4,
  },
  evidenceSourceBold: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    flex: 1,
  },
  evidenceQuality: {
    fontSize: 11,
    color: colors.textMuted,
  },
  evidenceSnippet: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 6,
    lineHeight: 16,
  },
  evidenceSnippetBold: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textSecondary,
    marginBottom: 10,
    lineHeight: 18,
    fontStyle: 'italic',
  },
  evidenceLink: {
    marginTop: 4,
  },
  evidenceLinkProminent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingVertical: 8,
  },
  evidenceLinkText: {
    fontSize: 12,
    color: colors.accent,
    fontWeight: '600',
  },
  evidenceLinkTextBold: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.accent,
  },
  evidenceLinkIcon: {
    fontSize: 16,
  },
  noEvidenceCard: {
    marginTop: 12,
    padding: 12,
    backgroundColor: colors.background,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  noEvidenceText: {
    fontSize: 13,
    color: colors.textMuted,
  },
  noFactCheckCard: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  noFactCheckText: {
    fontSize: 13,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  caveatsCard: {
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.2)',
  },
  caveatsTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#92400E',
    marginBottom: 6,
  },
  caveatsText: {
    fontSize: 12,
    color: '#92400E',
    lineHeight: 18,
    marginBottom: 4,
  },
  caveatsBold: {
    fontWeight: '700',
  },
  emptySection: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
  },
  valueScoreCard: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  valueScoreHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  valueScoreIcon: {
    fontSize: 32,
    marginRight: 12,
  },
  valueScoreMain: {
    flex: 1,
  },
  valueScoreTotal: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  valueScoreLabel: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  valueScoreConfidence: {
    alignItems: 'flex-end',
  },
  valueScoreConfidenceValue: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  valueScoreConfidenceLabel: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  valueScoreBreakdown: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  valueScoreMetric: {
    flex: 1,
    minWidth: '45%',
  },
  valueScoreMetricLabel: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 4,
  },
  valueScoreMetricValue: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  valueExplanationSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  valueExplanationTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  valueExplanationText: {
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 20,
  },
  discussionQualityCard: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  discussionQualityGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  discussionQualityMetric: {
    flex: 1,
    minWidth: '45%',
  },
  discussionQualityLabel: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 4,
  },
  discussionQualityValue: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  discussionQualitySummary: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  discussionQualitySummaryTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  discussionQualitySummaryText: {
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 20,
  },
  addContextButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    alignItems: 'center',
  },
  addContextButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F59E0B',
  },
  loadingSection: {
    padding: 32,
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 14,
    color: colors.textMuted,
  },
  reviewCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  validateReviewCard: {
    backgroundColor: 'rgba(16, 185, 129, 0.05)',
    borderColor: 'rgba(16, 185, 129, 0.2)',
  },
  invalidateReviewCard: {
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
    borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  reviewActionIcon: {
    fontSize: 18,
    fontWeight: '700',
  },
  validateIcon: {
    color: '#10B981',
  },
  invalidateIcon: {
    color: '#EF4444',
  },
  reviewActionText: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  validateText: {
    color: '#10B981',
  },
  invalidateText: {
    color: '#EF4444',
  },
  reviewDate: {
    fontSize: 12,
    color: colors.textMuted,
  },
  sourcesSection: {
    marginTop: 8,
  },
  sourcesTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  sourceLink: {
    fontSize: 12,
    color: colors.accent,
    textDecorationLine: 'underline',
    marginBottom: 2,
  },
  contextSection: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  contextTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  contextText: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 18,
  },
});

export default FactCheckStatusModal;

