import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  Linking,
} from 'react-native';
import type { Chirp, Claim, FactCheck } from '../types';
import { colors } from '../theme/colors';

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
      <View style={styles.backdrop}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View
                style={[
                  styles.statusIcon,
                  { backgroundColor: statusInfo.bgColor, borderColor: statusInfo.borderColor },
                ]}
              >
                <Text style={[styles.statusIconText, { color: statusInfo.color }]}>
                  {statusInfo.icon}
                </Text>
              </View>
              <View>
                <Text style={styles.headerTitle}>Fact-Check Status</Text>
                <Text style={[styles.headerSubtitle, { color: statusInfo.color }]}>
                  {statusInfo.label}
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Claims & Fact Checks */}
            {chirp.claims && chirp.claims.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Claims & Verification</Text>
                {chirp.claims.map((claim) => {
                  const factCheck = chirp.factChecks?.find((fc) => fc.claimId === claim.id);
                  return (
                    <View key={claim.id} style={styles.claimCard}>
                      <Text style={styles.claimText}>{claim.text}</Text>
                      <View style={styles.claimMeta}>
                        <View style={styles.claimBadge}>
                          <Text style={styles.claimBadgeText}>{claim.type}</Text>
                        </View>
                        <View style={styles.claimBadge}>
                          <Text style={styles.claimBadgeText}>{claim.domain}</Text>
                        </View>
                      </View>
                      {factCheck && (
                        <View style={styles.factCheckSection}>
                          <View style={styles.verdictRow}>
                            <View
                              style={[
                                styles.verdictBadge,
                                {
                                  backgroundColor:
                                    factCheck.verdict === 'true'
                                      ? 'rgba(16, 185, 129, 0.1)'
                                      : factCheck.verdict === 'false'
                                      ? 'rgba(239, 68, 68, 0.1)'
                                      : factCheck.verdict === 'mixed'
                                      ? 'rgba(245, 158, 11, 0.1)'
                                      : 'rgba(107, 114, 128, 0.1)',
                                  borderColor:
                                    factCheck.verdict === 'true'
                                      ? 'rgba(16, 185, 129, 0.2)'
                                      : factCheck.verdict === 'false'
                                      ? 'rgba(239, 68, 68, 0.2)'
                                      : factCheck.verdict === 'mixed'
                                      ? 'rgba(245, 158, 11, 0.2)'
                                      : 'rgba(107, 114, 128, 0.2)',
                                },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.verdictText,
                                  {
                                    color:
                                      factCheck.verdict === 'true'
                                        ? '#10B981'
                                        : factCheck.verdict === 'false'
                                        ? '#EF4444'
                                        : factCheck.verdict === 'mixed'
                                        ? '#F59E0B'
                                        : colors.light.textMuted,
                                  },
                                ]}
                              >
                                {factCheck.verdict.toUpperCase()}
                              </Text>
                            </View>
                            <Text style={styles.confidenceText}>
                              {(factCheck.confidence * 100).toFixed(0)}% confidence
                            </Text>
                          </View>
                          {factCheck.evidence && factCheck.evidence.length > 0 && (
                            <View style={styles.evidenceSection}>
                              <Text style={styles.evidenceTitle}>Evidence:</Text>
                              {factCheck.evidence.map((evidence, idx) => (
                                <View key={idx} style={styles.evidenceCard}>
                                  <Text style={styles.evidenceSource}>{evidence.source}</Text>
                                  <Text style={styles.evidenceSnippet}>{evidence.snippet}</Text>
                                  {evidence.url && (
                                    <TouchableOpacity
                                      onPress={() => handleOpenURL(evidence.url!)}
                                      style={styles.evidenceLink}
                                    >
                                      <Text style={styles.evidenceLinkText}>View source →</Text>
                                    </TouchableOpacity>
                                  )}
                                </View>
                              ))}
                            </View>
                          )}
                          {factCheck.caveats && factCheck.caveats.length > 0 && (
                            <View style={styles.caveatsCard}>
                              <Text style={styles.caveatsText}>
                                <Text style={styles.caveatsBold}>Note:</Text>{' '}
                                {factCheck.caveats.join(' ')}
                              </Text>
                            </View>
                          )}
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            ) : (
              <View style={styles.emptySection}>
                <Text style={styles.emptyText}>
                  No claims have been extracted from this post yet.
                </Text>
              </View>
            )}

            {/* Value Score Section */}
            {chirp.valueScore && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Value Score</Text>
                <View style={styles.valueScoreCard}>
                  <View style={styles.valueScoreHeader}>
                    <Text style={styles.valueScoreIcon}>⭐</Text>
                    <View style={styles.valueScoreMain}>
                      <Text style={styles.valueScoreTotal}>
                        {(chirp.valueScore.total * 100).toFixed(0)}
                      </Text>
                      <Text style={styles.valueScoreLabel}>Overall Value Score</Text>
                    </View>
                    {chirp.valueScore.confidence && (
                      <View style={styles.valueScoreConfidence}>
                        <Text style={styles.valueScoreConfidenceValue}>
                          {(chirp.valueScore.confidence * 100).toFixed(0)}%
                        </Text>
                        <Text style={styles.valueScoreConfidenceLabel}>Confidence</Text>
                      </View>
                    )}
                  </View>

                  {/* Value Score Breakdown */}
                  <View style={styles.valueScoreBreakdown}>
                    <View style={styles.valueScoreMetric}>
                      <Text style={styles.valueScoreMetricLabel}>Epistemic</Text>
                      <Text style={styles.valueScoreMetricValue}>
                        {(chirp.valueScore.epistemic * 100).toFixed(0)}
                      </Text>
                    </View>
                    <View style={styles.valueScoreMetric}>
                      <Text style={styles.valueScoreMetricLabel}>Insight</Text>
                      <Text style={styles.valueScoreMetricValue}>
                        {(chirp.valueScore.insight * 100).toFixed(0)}
                      </Text>
                    </View>
                    <View style={styles.valueScoreMetric}>
                      <Text style={styles.valueScoreMetricLabel}>Practical</Text>
                      <Text style={styles.valueScoreMetricValue}>
                        {(chirp.valueScore.practical * 100).toFixed(0)}
                      </Text>
                    </View>
                    <View style={styles.valueScoreMetric}>
                      <Text style={styles.valueScoreMetricLabel}>Relational</Text>
                      <Text style={styles.valueScoreMetricValue}>
                        {(chirp.valueScore.relational * 100).toFixed(0)}
                      </Text>
                    </View>
                  </View>

                  {/* Value Explanation */}
                  {chirp.valueExplanation && (
                    <View style={styles.valueExplanationSection}>
                      <Text style={styles.valueExplanationTitle}>Explanation</Text>
                      <Text style={styles.valueExplanationText}>{chirp.valueExplanation}</Text>
                    </View>
                  )}
                </View>
              </View>
            )}

            {/* Discussion Quality Section */}
            {chirp.discussionQuality && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Discussion Quality</Text>
                <View style={styles.discussionQualityCard}>
                  <View style={styles.discussionQualityGrid}>
                    <View style={styles.discussionQualityMetric}>
                      <Text style={styles.discussionQualityLabel}>Informativeness</Text>
                      <Text style={styles.discussionQualityValue}>
                        {(chirp.discussionQuality.informativeness * 100).toFixed(0)}%
                      </Text>
                    </View>
                    <View style={styles.discussionQualityMetric}>
                      <Text style={styles.discussionQualityLabel}>Civility</Text>
                      <Text style={styles.discussionQualityValue}>
                        {(chirp.discussionQuality.civility * 100).toFixed(0)}%
                      </Text>
                    </View>
                    <View style={styles.discussionQualityMetric}>
                      <Text style={styles.discussionQualityLabel}>Reasoning Depth</Text>
                      <Text style={styles.discussionQualityValue}>
                        {(chirp.discussionQuality.reasoningDepth * 100).toFixed(0)}%
                      </Text>
                    </View>
                    <View style={styles.discussionQualityMetric}>
                      <Text style={styles.discussionQualityLabel}>Cross-Perspective</Text>
                      <Text style={styles.discussionQualityValue}>
                        {(chirp.discussionQuality.crossPerspective * 100).toFixed(0)}%
                      </Text>
                    </View>
                  </View>
                  {chirp.discussionQuality.summary && (
                    <View style={styles.discussionQualitySummary}>
                      <Text style={styles.discussionQualitySummaryTitle}>Summary</Text>
                      <Text style={styles.discussionQualitySummaryText}>
                        {chirp.discussionQuality.summary}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: colors.light.backgroundElevated,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.light.border,
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
    color: colors.light.textPrimary,
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
    color: colors.light.textMuted,
    fontWeight: '300',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.light.textPrimary,
    marginBottom: 16,
  },
  claimCard: {
    backgroundColor: 'rgba(0, 0, 0, 0.02)',
    borderRadius: 12,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.light.border,
    marginBottom: 12,
  },
  claimText: {
    fontSize: 14,
    color: colors.light.textPrimary,
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
    backgroundColor: 'rgba(0, 0, 0, 0.04)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.light.border,
  },
  claimBadgeText: {
    fontSize: 11,
    color: colors.light.textMuted,
    fontWeight: '600',
  },
  factCheckSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.light.border,
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
  verdictText: {
    fontSize: 11,
    fontWeight: '700',
  },
  confidenceText: {
    fontSize: 12,
    color: colors.light.textMuted,
  },
  evidenceSection: {
    marginTop: 12,
  },
  evidenceTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.light.textPrimary,
    marginBottom: 8,
  },
  evidenceCard: {
    backgroundColor: 'rgba(0, 0, 0, 0.02)',
    borderRadius: 8,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.light.border,
    marginBottom: 8,
  },
  evidenceSource: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.light.textSecondary,
    marginBottom: 4,
  },
  evidenceSnippet: {
    fontSize: 12,
    color: colors.light.textMuted,
    marginBottom: 6,
    lineHeight: 16,
  },
  evidenceLink: {
    marginTop: 4,
  },
  evidenceLinkText: {
    fontSize: 12,
    color: colors.light.accent,
    fontWeight: '600',
  },
  caveatsCard: {
    marginTop: 8,
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.2)',
  },
  caveatsText: {
    fontSize: 12,
    color: '#92400E',
    lineHeight: 16,
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
    color: colors.light.textMuted,
    textAlign: 'center',
  },
  valueScoreCard: {
    backgroundColor: 'rgba(0, 0, 0, 0.02)',
    borderRadius: 12,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.light.border,
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
    color: colors.light.textPrimary,
  },
  valueScoreLabel: {
    fontSize: 12,
    color: colors.light.textMuted,
    marginTop: 2,
  },
  valueScoreConfidence: {
    alignItems: 'flex-end',
  },
  valueScoreConfidenceValue: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.light.textPrimary,
  },
  valueScoreConfidenceLabel: {
    fontSize: 11,
    color: colors.light.textMuted,
    marginTop: 2,
  },
  valueScoreBreakdown: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.light.border,
  },
  valueScoreMetric: {
    flex: 1,
    minWidth: '45%',
  },
  valueScoreMetricLabel: {
    fontSize: 12,
    color: colors.light.textMuted,
    marginBottom: 4,
  },
  valueScoreMetricValue: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.light.textPrimary,
  },
  valueExplanationSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.light.border,
  },
  valueExplanationTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.light.textPrimary,
    marginBottom: 8,
  },
  valueExplanationText: {
    fontSize: 14,
    color: colors.light.textMuted,
    lineHeight: 20,
  },
  discussionQualityCard: {
    backgroundColor: 'rgba(0, 0, 0, 0.02)',
    borderRadius: 12,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.light.border,
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
    color: colors.light.textMuted,
    marginBottom: 4,
  },
  discussionQualityValue: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.light.textPrimary,
  },
  discussionQualitySummary: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.light.border,
  },
  discussionQualitySummaryTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.light.textPrimary,
    marginBottom: 8,
  },
  discussionQualitySummaryText: {
    fontSize: 14,
    color: colors.light.textMuted,
    lineHeight: 20,
  },
});

export default FactCheckStatusModal;

