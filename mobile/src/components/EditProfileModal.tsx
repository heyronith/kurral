import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Modal,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useUserStore } from '../stores/useUserStore';
import { useAuthStore } from '../stores/useAuthStore';
import { userService } from '../services/userService';
import { authService } from '../services/authService';
import { extractInterestsFromStatement } from '../services/profileInterestAgent';
import { generateAndSaveProfileSummary } from '../services/profileSummaryAgent';
import { deleteField } from 'firebase/firestore';
import type { User } from '../types';
import { colors } from '../theme/colors';

interface EditProfileModalProps {
  visible: boolean;
  onClose: () => void;
  user: User;
  onUpdate: (user: User) => void;
}

const EditProfileModal: React.FC<EditProfileModalProps> = ({
  visible,
  onClose,
  user,
  onUpdate,
}) => {
  const { updateInterests } = useUserStore();
  const { setUser } = useAuthStore();
  const [displayName, setDisplayName] = useState(user.displayName || user.name || '');
  const [userId, setUserId] = useState(user.userId || user.handle || '');
  const [semanticInterests, setSemanticInterests] = useState<string[]>(user.interests || []);
  const [unifiedInterestInput, setUnifiedInterestInput] = useState('');
  const [interestError, setInterestError] = useState('');
  const [interestLoading, setInterestLoading] = useState(false);
  const [bio, setBio] = useState(user.bio || '');
  const [url, setUrl] = useState(user.url || '');
  const [location, setLocation] = useState(user.location || '');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingUserId, setCheckingUserId] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // Reset form when user changes or modal opens
  useEffect(() => {
    if (visible && user) {
      setDisplayName(user.displayName || user.name || '');
      setUserId(user.userId || user.handle || '');
      setSemanticInterests(user.interests || []);
      setBio(user.bio || '');
      setUrl(user.url || '');
      setLocation(user.location || '');
      setUnifiedInterestInput('');
      setInterestError('');
      setError('');
    }
  }, [visible, user]);

  // Detect if input looks like a statement (natural language) vs direct interest
  const looksLikeStatement = (text: string): boolean => {
    const trimmed = text.trim();
    if (trimmed.length < 10) return false; // Too short to be a statement
    
    // Check for sentence indicators
    const statementIndicators = [
      /\b(i|i'd|i'll|i've|i'm|i want|i like|i prefer|i need|i'm interested|show me|give me|more|less|fewer)\b/i,
      /[.!?]\s*$/, // Ends with punctuation
      /\b(and|or|but|because|since|when|where|how|what|why)\b/i, // Conjunctions
      /\b(should|would|could|might|may|can)\b/i, // Modal verbs
    ];
    
    return statementIndicators.some(pattern => pattern.test(trimmed));
  };

  const handleUnifiedInterestSubmit = async () => {
    const input = unifiedInterestInput.trim();
    if (!input) {
      setInterestError('Enter an interest or describe what you want to see.');
      return;
    }

    setInterestError('');
    setInterestLoading(true);

    try {
      // Check if it looks like a statement - if so, extract interests
      if (looksLikeStatement(input)) {
        const extracted = await extractInterestsFromStatement(input);
        if (extracted.length === 0) {
          setInterestError('Could not extract interests. Try adding keywords directly or rephrase your statement.');
          return;
        }

        setSemanticInterests((prev) => {
          const combined = [...prev, ...extracted];
          const unique = Array.from(new Set(combined.map(i => i.toLowerCase())));
          return unique;
        });
        setUnifiedInterestInput('');
      } else {
        // Treat as direct interest
        const normalized = input.toLowerCase();
        if (semanticInterests.includes(normalized)) {
          setInterestError('Interest already added.');
          return;
        }
        if (normalized.length < 2) {
          setInterestError('Interest must be at least 2 characters.');
          return;
        }
        setSemanticInterests([...semanticInterests, normalized]);
        setUnifiedInterestInput('');
      }
    } catch (error: any) {
      console.error('[EditProfileModal] Error processing interest:', error);
      setInterestError('Failed to process. Try again or add keywords directly.');
    } finally {
      setInterestLoading(false);
    }
  };

  const handleRemoveInterest = (interest: string) => {
    setSemanticInterests(semanticInterests.filter(i => i !== interest));
  };

  const checkUserIdAvailability = async (userIdToCheck: string): Promise<boolean> => {
    if (!userIdToCheck || userIdToCheck.length < 3) return false;
    
    try {
      setCheckingUserId(true);
      // Check if user with this handle exists
      const existingUser = await userService.getUserByHandle(userIdToCheck);
      // Available if no user exists, or if it's the current user's handle
      return !existingUser || (user !== null && existingUser.id === user.id);
    } catch (error) {
      console.error('Error checking user ID:', error);
      return true; // Assume available on error
    } finally {
      setCheckingUserId(false);
    }
  };

  const handleSubmit = async () => {
    setError('');

    // Validation
    if (!displayName.trim()) {
      setError('Display name is required');
      return;
    }

    if (!userId.trim()) {
      setError('User ID is required');
      return;
    }

    if (!userId.match(/^[a-zA-Z0-9_]+$/)) {
      setError('User ID can only contain letters, numbers, and underscores');
      return;
    }

    if (userId.length < 3) {
      setError('User ID must be at least 3 characters');
      return;
    }

    // Check if user ID is available (only if changed)
    if (userId.toLowerCase() !== (user.userId || user.handle).toLowerCase()) {
      const isAvailable = await checkUserIdAvailability(userId);
      if (!isAvailable) {
        setError('This user ID is already taken. Please choose another.');
        return;
      }
    }

    // Validate interests (recommended, not required)
    if (semanticInterests.length === 0) {
      setError('Please add at least one interest to help personalize your feed');
      return;
    }

    setLoading(true);

    try {
      // Build update object, only including fields with values (Firestore doesn't accept undefined)
      const updateData: any = {
        displayName: displayName.trim(),
        userId: userId.trim().toLowerCase(),
        handle: userId.trim().toLowerCase(), // Also update handle
        name: displayName.trim(), // Also update name
        interests: semanticInterests, // Update semantic interests
        // Keep legacy topics field in database for backward compatibility
        topics: user.topics || [], // Preserve existing topics, don't update from UI
      };

      // Handle optional fields - remove if empty, add if has value
      const trimmedBio = bio.trim();
      if (trimmedBio) {
        updateData.bio = trimmedBio;
      } else if (user.bio) {
        // Remove bio if it was previously set but now empty
        updateData.bio = deleteField();
      }

      const trimmedUrl = url.trim();
      if (trimmedUrl) {
        updateData.url = trimmedUrl;
      } else if (user.url) {
        // Remove url if it was previously set but now empty
        updateData.url = deleteField();
      }

      const trimmedLocation = location.trim();
      if (trimmedLocation) {
        updateData.location = trimmedLocation;
      } else if (user.location) {
        // Remove location if it was previously set but now empty
        updateData.location = deleteField();
      }

      await userService.updateUser(user.id, updateData);

      // Also update interests via store to keep state in sync
      if (semanticInterests.length > 0 || user.interests?.length) {
        try {
          await updateInterests(semanticInterests);
        } catch (interestError) {
          console.warn('Failed to update interests via store (non-critical):', interestError);
          // Continue even if store update fails
        }
      }

      // Reload updated user
      const updatedUser = await userService.getUser(user.id);
      if (updatedUser) {
        onUpdate(updatedUser);
        
        // Generate profile summary asynchronously after profile update
        generateAndSaveProfileSummary(user.id).catch((error) => {
          console.error('[EditProfileModal] Error generating profile summary:', error);
          // Non-critical, continue even if summary generation fails
        });
      }

      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user?.id) return;

    setIsDeleting(true);
    setDeleteError('');

    try {
      // Delete all user data
      const result = await userService.deleteAccount(user.id);

      console.log('Account deletion result:', result);

      // Sign out the user
      await authService.logout();
      setUser(null);

      // Close modal
      onClose();
    } catch (err: any) {
      console.error('Error deleting account:', err);
      setDeleteError(err.message || 'Failed to delete account. Please try again or contact support.');
      setIsDeleting(false);
    }
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <View style={styles.modalContainer}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.headerTitle}>Edit Profile</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>Close</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
              {error ? (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              {/* Display Name and User ID */}
              <View style={styles.formSection}>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>
                    Display Name <Text style={styles.required}>*</Text>
                  </Text>
                  <TextInput
                    style={styles.input}
                    value={displayName}
                    onChangeText={setDisplayName}
                    placeholder="Your name"
                    maxLength={50}
                    editable={!loading}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>
                    User ID <Text style={styles.required}>*</Text>
                  </Text>
                  <View style={styles.userIdContainer}>
                    <Text style={styles.userIdPrefix}>@</Text>
                    <TextInput
                      style={[styles.input, styles.userIdInput]}
                      value={userId}
                      onChangeText={(text) => setUserId(text.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                      placeholder="username"
                      maxLength={30}
                      editable={!loading}
                    />
                    {checkingUserId && (
                      <Text style={styles.checkingText}>Checking...</Text>
                    )}
                  </View>
                </View>
              </View>

              {/* Interests */}
              <View style={styles.formSection}>
                <Text style={styles.label}>
                  Interests <Text style={styles.required}>*</Text>
                </Text>
                <View style={styles.interestsContainer}>
                  {semanticInterests.length === 0 ? (
                    <Text style={styles.emptyInterests}>No interests yet</Text>
                  ) : (
                    <View style={styles.interestsList}>
                      {semanticInterests.map((interest) => (
                        <TouchableOpacity
                          key={interest}
                          style={styles.interestTag}
                          onPress={() => handleRemoveInterest(interest)}
                        >
                          <Text style={styles.interestTagText}>{interest}</Text>
                          <Text style={styles.interestRemove}>×</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
                <View style={styles.interestInputContainer}>
                  <TextInput
                    style={[styles.input, styles.interestInput]}
                    value={unifiedInterestInput}
                    onChangeText={(text) => {
                      setUnifiedInterestInput(text);
                      if (interestError) setInterestError('');
                    }}
                    placeholder={
                      looksLikeStatement(unifiedInterestInput)
                        ? "e.g. I want more AI research and less politics"
                        : "e.g. ai research, react development, or describe what you want"
                    }
                    editable={!loading && !interestLoading}
                    onSubmitEditing={handleUnifiedInterestSubmit}
                    returnKeyType="done"
                  />
                  <TouchableOpacity
                    style={[styles.addInterestButton, (!unifiedInterestInput.trim() || interestLoading || loading) && styles.addInterestButtonDisabled]}
                    onPress={handleUnifiedInterestSubmit}
                    disabled={!unifiedInterestInput.trim() || interestLoading || loading}
                  >
                    {interestLoading ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.addInterestButtonText}>
                        {looksLikeStatement(unifiedInterestInput) ? 'Extract' : 'Add'}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
                {interestError ? (
                  <Text style={styles.interestErrorText}>{interestError}</Text>
                ) : null}
              </View>

              {/* Bio, URL, Location */}
              <View style={styles.formSection}>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Bio</Text>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    value={bio}
                    onChangeText={setBio}
                    placeholder="Tell us about yourself..."
                    maxLength={160}
                    multiline
                    numberOfLines={3}
                    editable={!loading}
                  />
                  <Text style={styles.charCount}>{bio.length}/160</Text>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Website</Text>
                  <TextInput
                    style={styles.input}
                    value={url}
                    onChangeText={setUrl}
                    placeholder="https://..."
                    keyboardType="url"
                    autoCapitalize="none"
                    editable={!loading}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Location</Text>
                  <TextInput
                    style={styles.input}
                    value={location}
                    onChangeText={setLocation}
                    placeholder="City, State"
                    maxLength={50}
                    editable={!loading}
                  />
                </View>
              </View>

              {/* Account Settings Section */}
              <View style={styles.formSection}>
                <Text style={styles.sectionTitle}>Account Settings</Text>
                
                <View style={styles.deleteAccountContainer}>
                  <Text style={styles.deleteAccountTitle}>Delete Account</Text>
                  <Text style={styles.deleteAccountDescription}>
                    Permanently delete your account and all associated data. This action cannot be undone.
                  </Text>
                  <Text style={styles.deleteAccountWarning}>
                    This will delete all your posts, comments, bookmarks, and profile data immediately. Your Firebase Auth account will be scheduled for deletion separately (this may take up to 24 hours to process via our backend systems).
                  </Text>

                  {deleteError ? (
                    <View style={styles.deleteErrorContainer}>
                      <Text style={styles.deleteErrorText}>{deleteError}</Text>
                    </View>
                  ) : null}

                  <TouchableOpacity
                    style={[styles.deleteButton, isDeleting && styles.deleteButtonDisabled]}
                    onPress={() => setShowDeleteConfirm(true)}
                    disabled={isDeleting}
                  >
                    <Text style={styles.deleteButtonText}>
                      {isDeleting ? 'Deleting Account...' : 'Delete My Account'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>

            {/* Footer Actions */}
            <View style={styles.footer}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={onClose}
                disabled={loading}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.saveButton, (loading || checkingUserId || semanticInterests.length === 0) && styles.saveButtonDisabled]}
                onPress={handleSubmit}
                disabled={loading || checkingUserId || semanticInterests.length === 0}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.saveButtonText}>Save Changes</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>

      {/* Delete Confirmation Modal */}
      <Modal
        visible={showDeleteConfirm}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowDeleteConfirm(false)}
      >
        <View style={styles.confirmModalOverlay}>
          <View style={styles.confirmModalContent}>
            <Text style={styles.confirmModalTitle}>Delete Account</Text>
            <Text style={styles.confirmModalText}>
              Are you sure you want to delete your account? This will permanently delete:
            </Text>
            <View style={styles.confirmModalList}>
              <Text style={styles.confirmModalListItem}>• All your posts and comments</Text>
              <Text style={styles.confirmModalListItem}>• Your profile and account data</Text>
              <Text style={styles.confirmModalListItem}>• Your bookmarks and following list</Text>
              <Text style={styles.confirmModalListItem}>• All images you've uploaded</Text>
            </View>
            <Text style={styles.confirmModalWarning}>
              This action cannot be undone.
            </Text>
            <View style={styles.confirmModalButtons}>
              <TouchableOpacity
                style={[styles.confirmButton, styles.confirmCancelButton]}
                onPress={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
              >
                <Text style={styles.confirmCancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmButton, styles.confirmDeleteButton, isDeleting && styles.confirmDeleteButtonDisabled]}
                onPress={handleDeleteAccount}
                disabled={isDeleting}
              >
                <Text style={styles.confirmDeleteButtonText}>
                  {isDeleting ? 'Deleting...' : 'Delete Account'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  safeArea: {
    flex: 1,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.light.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    marginTop: 'auto',
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.light.border,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.light.textPrimary,
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.light.textMuted,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  errorContainer: {
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 14,
    color: '#dc2626',
    fontWeight: '600',
  },
  formSection: {
    marginBottom: 24,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.light.textPrimary,
    marginBottom: 6,
  },
  required: {
    color: '#dc2626',
  },
  input: {
    backgroundColor: colors.light.backgroundElevated,
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: colors.light.textPrimary,
  },
  userIdContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userIdPrefix: {
    fontSize: 14,
    color: colors.light.textMuted,
    marginRight: 4,
  },
  userIdInput: {
    flex: 1,
  },
  checkingText: {
    fontSize: 12,
    color: colors.light.textMuted,
    marginLeft: 8,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: 11,
    color: colors.light.textMuted,
    marginTop: 4,
    textAlign: 'right',
  },
  interestsContainer: {
    minHeight: 60,
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.light.backgroundElevated,
    borderWidth: 1,
    borderColor: colors.light.border,
    marginBottom: 12,
  },
  emptyInterests: {
    fontSize: 12,
    fontStyle: 'italic',
    color: colors.light.textMuted,
  },
  interestsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  interestTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: colors.light.accent + '25',
    borderWidth: 1,
    borderColor: colors.light.accent + '50',
    gap: 6,
  },
  interestTagText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.light.accent,
  },
  interestRemove: {
    fontSize: 14,
    color: colors.light.accent,
    fontWeight: '700',
  },
  interestInputContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  interestInput: {
    flex: 1,
  },
  addInterestButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: colors.light.accent,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 80,
  },
  addInterestButtonDisabled: {
    opacity: 0.5,
  },
  addInterestButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  interestErrorText: {
    fontSize: 12,
    color: '#dc2626',
    marginTop: 4,
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: colors.light.border,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: colors.light.backgroundElevated,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.light.textPrimary,
  },
  saveButton: {
    backgroundColor: colors.light.accent,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.light.textPrimary,
    marginBottom: 12,
  },
  deleteAccountContainer: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#fecaca',
    backgroundColor: '#fef2f2',
  },
  deleteAccountTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#991b1b',
    marginBottom: 8,
  },
  deleteAccountDescription: {
    fontSize: 14,
    color: '#991b1b',
    marginBottom: 8,
    lineHeight: 20,
  },
  deleteAccountWarning: {
    fontSize: 12,
    color: '#991b1b',
    marginBottom: 16,
    lineHeight: 18,
  },
  deleteErrorContainer: {
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  deleteErrorText: {
    fontSize: 13,
    color: '#dc2626',
    fontWeight: '600',
  },
  deleteButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#dc2626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButtonDisabled: {
    opacity: 0.5,
  },
  deleteButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  confirmModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  confirmModalContent: {
    backgroundColor: colors.light.background,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  confirmModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.light.textPrimary,
    marginBottom: 16,
  },
  confirmModalText: {
    fontSize: 14,
    color: colors.light.textPrimary,
    marginBottom: 16,
    lineHeight: 20,
  },
  confirmModalList: {
    marginBottom: 16,
  },
  confirmModalListItem: {
    fontSize: 13,
    color: colors.light.textMuted,
    marginBottom: 4,
    lineHeight: 20,
  },
  confirmModalWarning: {
    fontSize: 13,
    color: '#dc2626',
    fontWeight: '600',
    marginBottom: 20,
  },
  confirmModalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmCancelButton: {
    backgroundColor: colors.light.backgroundElevated,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  confirmCancelButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.light.textPrimary,
  },
  confirmDeleteButton: {
    backgroundColor: '#dc2626',
  },
  confirmDeleteButtonDisabled: {
    opacity: 0.5,
  },
  confirmDeleteButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
});

export default EditProfileModal;

