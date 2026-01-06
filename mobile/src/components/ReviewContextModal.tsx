import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import type { Chirp, PostReviewAction } from '../types';
import { colors } from '../theme/colors';
import { reviewContextService } from '../services/reviewContextService';
import { useUserStore } from '../stores/useUserStore';

interface ReviewContextModalProps {
  visible: boolean;
  onClose: () => void;
  chirp: Chirp;
  onSubmitted?: () => void;
}

const ReviewContextModal: React.FC<ReviewContextModalProps> = ({
  visible,
  onClose,
  chirp,
  onSubmitted
}) => {
  const [action, setAction] = useState<PostReviewAction | null>(null);
  const [sources, setSources] = useState('');
  const [context, setContext] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { currentUser } = useUserStore();

  useEffect(() => {
    if (visible) {
      setAction(null);
      setSources('');
      setContext('');
      setError('');
    }
  }, [visible]);

  const handleSubmit = async () => {
    if (!currentUser) {
      setError('You must be logged in to submit a review');
      return;
    }

    if (!action) {
      setError('Please select whether to validate or invalidate the claim');
      return;
    }

    // Parse sources - split by newline or comma, filter empty strings
    const sourcesArray = sources
      .split(/[,\n]/)
      .map(s => s.trim())
      .filter(s => s.length > 0);

    if (sourcesArray.length === 0) {
      setError('Please provide at least one source URL');
      return;
    }

    // Validate URLs
    const urlPattern = /^https?:\/\/.+/i;
    const invalidUrls = sourcesArray.filter(url => !urlPattern.test(url));
    if (invalidUrls.length > 0) {
      setError(`Invalid URL(s): ${invalidUrls.join(', ')}. URLs must start with http:// or https://`);
      return;
    }

    const trimmedContext = context.trim();
    if (trimmedContext.length < 20) {
      setError('Please provide at least 20 characters of context');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await reviewContextService.createReviewContext(
        chirp.id,
        currentUser.id,
        action,
        sourcesArray,
        trimmedContext
      );

      // Reset form
      setAction(null);
      setSources('');
      setContext('');

      onSubmitted?.();
      onClose();

      Alert.alert('Success', 'Your review has been submitted. Thank you for helping verify this content!');
    } catch (error: any) {
      console.error('Error submitting review context:', error);
      setError(error.message || 'Failed to submit review. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!visible) return null;

  const canSubmit = action && sources.trim() && context.trim().length >= 20 && !loading;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.container}>
          <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.headerTitle}>Review Post</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Text style={styles.closeText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Info Banner */}
            <View style={styles.infoBanner}>
              <Text style={styles.infoText}>
                This post has been marked as <Text style={styles.boldText}>Needs Review</Text>.
                Help verify the claims by either validating or invalidating them with sources.
              </Text>
            </View>

            {/* Error Message */}
            {error ? (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* Action Selection */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Your assessment:</Text>
              <View style={styles.actionButtons}>
                <TouchableOpacity
                  onPress={() => setAction('validate')}
                  style={[
                    styles.actionButton,
                    action === 'validate' && styles.validateButtonActive,
                    action !== 'validate' && styles.actionButtonInactive
                  ]}
                  activeOpacity={0.8}
                >
                  <Text style={[
                    styles.actionIcon,
                    action === 'validate' && styles.validateIcon
                  ]}>
                    ✓
                  </Text>
                  <Text style={[
                    styles.actionText,
                    action === 'validate' && styles.validateText
                  ]}>
                    Validate Claim
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setAction('invalidate')}
                  style={[
                    styles.actionButton,
                    action === 'invalidate' && styles.invalidateButtonActive,
                    action !== 'invalidate' && styles.actionButtonInactive
                  ]}
                  activeOpacity={0.8}
                >
                  <Text style={[
                    styles.actionIcon,
                    action === 'invalidate' && styles.invalidateIcon
                  ]}>
                    ✗
                  </Text>
                  <Text style={[
                    styles.actionText,
                    action === 'invalidate' && styles.invalidateText
                  ]}>
                    Invalidate Claim
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Sources Input */}
            <View style={styles.section}>
              <Text style={styles.inputLabel}>
                Sources * (URLs, one per line or comma-separated)
              </Text>
              <TextInput
                style={styles.sourcesInput}
                value={sources}
                onChangeText={setSources}
                placeholder="https://example.com/source1&#10;https://example.com/source2"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                editable={!loading}
              />
              <Text style={styles.helperText}>
                Provide at least one source URL supporting your assessment. URLs must start with http:// or https://
              </Text>
            </View>

            {/* Context Input */}
            <View style={styles.section}>
              <Text style={styles.inputLabel}>
                Additional context (required, min 20 chars)
              </Text>
              <TextInput
                style={styles.contextInput}
                value={context}
                onChangeText={setContext}
                placeholder="Any additional explanation or context..."
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                maxLength={500}
                editable={!loading}
              />
              <Text style={styles.charCount}>
                {context.length}/500 characters
              </Text>
            </View>

            {/* Action Buttons */}
            <View style={styles.formActions}>
              <TouchableOpacity
                onPress={onClose}
                style={styles.cancelButton}
                disabled={loading}
                activeOpacity={0.8}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleSubmit}
                style={[
                  styles.submitButton,
                  canSubmit && action === 'validate' && styles.validateSubmitButton,
                  canSubmit && action === 'invalidate' && styles.invalidateSubmitButton,
                  !canSubmit && styles.submitButtonDisabled
                ]}
                disabled={!canSubmit}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.submitButtonText}>
                    {action ? `Submit ${action === 'validate' ? 'Validation' : 'Invalidation'}` : 'Select Action'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
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
  scrollView: {
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.light.textPrimary,
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
  infoBanner: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.2)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  infoText: {
    fontSize: 14,
    color: colors.light.textPrimary,
    lineHeight: 20,
  },
  boldText: {
    fontWeight: '700',
  },
  errorBanner: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 14,
    color: '#ef4444',
    lineHeight: 20,
  },
  section: {
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.light.textPrimary,
    marginBottom: 12,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
  },
  actionButtonInactive: {
    backgroundColor: 'rgba(0, 0, 0, 0.02)',
    borderColor: colors.light.border,
  },
  validateButtonActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderColor: '#10B981',
  },
  invalidateButtonActive: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: '#EF4444',
  },
  actionIcon: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  validateIcon: {
    color: '#10B981',
  },
  invalidateIcon: {
    color: '#EF4444',
  },
  actionText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.light.textPrimary,
  },
  validateText: {
    color: '#10B981',
  },
  invalidateText: {
    color: '#EF4444',
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.light.textPrimary,
    marginBottom: 8,
  },
  sourcesInput: {
    backgroundColor: '#fff',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.light.border,
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: colors.light.textPrimary,
    fontFamily: 'monospace',
    minHeight: 100,
  },
  helperText: {
    fontSize: 12,
    color: colors.light.textMuted,
    marginTop: 4,
    lineHeight: 16,
  },
  contextInput: {
    backgroundColor: '#fff',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.light.border,
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: colors.light.textPrimary,
    minHeight: 80,
  },
  charCount: {
    fontSize: 12,
    color: colors.light.textMuted,
    textAlign: 'right',
    marginTop: 4,
  },
  formActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.light.border,
    backgroundColor: 'rgba(0, 0, 0, 0.02)',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.light.textPrimary,
  },
  submitButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.6)',
  },
  validateSubmitButton: {
    backgroundColor: '#10B981',
  },
  invalidateSubmitButton: {
    backgroundColor: '#EF4444',
  },
  submitButtonDisabled: {
    backgroundColor: colors.light.border,
  },
  submitButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
});

export default ReviewContextModal;
