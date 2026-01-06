import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  NativeSyntheticEvent,
  TextInputSelectionChangeEventData,
} from 'react-native';
import { colors } from '../theme/colors';
import { extractMentionHandles, linkifyMentions } from '../utils/mentions';
import { userService } from '../services/userService';
// Helper function to convert markdown to HTML (same as ComposerModal)
const markdownToHtml = (text: string): string => {
  const escapeHtml = (input: string): string =>
    input
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  let html = escapeHtml(text);
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/_(.+?)_/g, '<em>$1</em>');
  html = html.replace(/\n/g, '<br />');
  html = linkifyMentions(html);
  return html;
};

type MentionCandidate = {
  id: string;
  name: string;
  handle: string;
  profilePictureUrl?: string;
};

type Props = {
  chirpId: string;
  parentCommentId?: string;
  replyToUserId?: string;
  replyToHandle?: string;
  onSubmit: (text: string, formattedText: string, mentions: string[]) => Promise<void>;
  onCancel?: () => void;
  placeholder?: string;
  autoFocus?: boolean;
};

const CommentEditor: React.FC<Props> = ({
  chirpId,
  parentCommentId,
  replyToUserId,
  replyToHandle,
  onSubmit,
  onCancel,
  placeholder = 'Write a comment...',
  autoFocus = false,
}) => {
  const [text, setText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionResults, setMentionResults] = useState<MentionCandidate[]>([]);
  const [selection, setSelection] = useState<{ start: number; end: number }>({
    start: 0,
    end: 0,
  });
  const mentionStartRef = useRef<number | null>(null);
  const mentionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mentionCache = useRef<Map<string, string>>(new Map());

  // Initialize text with @mention if replying
  useEffect(() => {
    if (replyToHandle) {
      setText(`@${replyToHandle} `);
      setSelection({ start: `@${replyToHandle} `.length, end: `@${replyToHandle} `.length });
    }
  }, [replyToHandle]);

  // Search for users when mention query changes
  useEffect(() => {
    if (mentionQuery === null) {
      setMentionResults([]);
      return;
    }

    if (mentionTimer.current) {
      clearTimeout(mentionTimer.current);
    }

    mentionTimer.current = setTimeout(async () => {
      const results = await userService.searchUsers(mentionQuery, 5);
      setMentionResults(
        results
          .filter((u) => u.id !== replyToUserId) // Filter out the user being replied to
          .map((u) => ({
            id: u.id,
            name: u.name,
            handle: u.handle,
            profilePictureUrl: u.profilePictureUrl,
          }))
      );
    }, mentionQuery.length === 0 ? 0 : 250);
  }, [mentionQuery, replyToUserId]);

  const updateMentionState = (currentText: string, cursorPos: number) => {
    const beforeCursor = currentText.slice(0, cursorPos);
    const match = beforeCursor.match(/@(\w*)$/);
    if (match) {
      setMentionQuery(match[1]);
      mentionStartRef.current = match.index ?? null;
    } else {
      setMentionQuery(null);
      mentionStartRef.current = null;
    }
  };

  const handleSelectionChange = (
    e: NativeSyntheticEvent<TextInputSelectionChangeEventData>
  ) => {
    const sel = e.nativeEvent.selection;
    setSelection(sel);
    updateMentionState(text, sel.start);
  };

  const handleTextChange = (value: string) => {
    setText(value);
    updateMentionState(value, selection.start);
  };

  const handleMentionSelect = (candidate: MentionCandidate) => {
    if (mentionStartRef.current === null) return;
    const start = mentionStartRef.current;
    const { end } = selection;
    const before = text.slice(0, start);
    const after = text.slice(end);
    const mentionText = `@${candidate.handle} `;
    const next = before + mentionText + after;
    const newPos = (before + mentionText).length;
    setText(next);
    setSelection({ start: newPos, end: newPos });
    setMentionQuery(null);
    mentionStartRef.current = null;
    mentionCache.current.set(candidate.handle, candidate.id);
  };

  const resolveMentions = async (handles: string[]): Promise<string[]> => {
    const ids: string[] = [];
    for (const handle of handles) {
      if (mentionCache.current.has(handle)) {
        ids.push(mentionCache.current.get(handle)!);
      } else {
        const found = await userService.getUserByHandle(handle);
        if (found) {
          ids.push(found.id);
          mentionCache.current.set(handle, found.id);
        }
      }
    }
    return Array.from(new Set(ids));
  };

  const handleSubmit = async () => {
    const trimmed = text.trim();
    if (!trimmed || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const formatted = markdownToHtml(trimmed);
      const handles = extractMentionHandles(trimmed);
      const mentionIds = await resolveMentions(handles);
      await onSubmit(trimmed, formatted, mentionIds);
      setText('');
      setMentionQuery(null);
      mentionStartRef.current = null;
    } catch (error) {
      console.error('[CommentEditor] Submit error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const canSubmit = text.trim().length > 0 && !isSubmitting;

  return (
    <View style={styles.container}>
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor={colors.light.textMuted}
          multiline
          value={text}
          onChangeText={handleTextChange}
          selection={selection}
          onSelectionChange={handleSelectionChange}
          autoFocus={autoFocus}
          maxLength={500}
        />

        {/* Mention Dropdown */}
        {mentionQuery !== null && mentionResults.length > 0 && (
          <View style={styles.mentionDropdown}>
            {mentionResults.map((candidate) => (
              <TouchableOpacity
                key={candidate.id}
                style={styles.mentionItem}
                onPress={() => handleMentionSelect(candidate)}
              >
                {candidate.profilePictureUrl ? (
                  <Image
                    source={{ uri: candidate.profilePictureUrl }}
                    style={styles.mentionAvatar}
                  />
                ) : (
                  <View style={styles.mentionAvatarPlaceholder}>
                    <Text style={styles.mentionAvatarText}>
                      {candidate.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
                <View style={styles.mentionInfo}>
                  <Text style={styles.mentionName} numberOfLines={1}>
                    {candidate.name}
                  </Text>
                  <Text style={styles.mentionHandle} numberOfLines={1}>
                    @{candidate.handle}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      <View style={styles.actions}>
        {onCancel && (
          <TouchableOpacity onPress={onCancel} style={styles.cancelButton}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          onPress={handleSubmit}
          style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
          disabled={!canSubmit}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.submitText}>Post</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 12,
    backgroundColor: colors.light.backgroundElevated,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.light.border,
  },
  inputContainer: {
    position: 'relative',
  },
  input: {
    minHeight: 60,
    maxHeight: 150,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: colors.light.textPrimary,
    textAlignVertical: 'top',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.light.border,
  },
  mentionDropdown: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    backgroundColor: colors.light.backgroundElevated,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.light.border,
    maxHeight: 200,
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  mentionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.light.border,
  },
  mentionAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginRight: 10,
  },
  mentionAvatarPlaceholder: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.light.accent + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  mentionAvatarText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.light.accent,
  },
  mentionInfo: {
    flex: 1,
    minWidth: 0,
  },
  mentionName: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.light.textPrimary,
    marginBottom: 2,
  },
  mentionHandle: {
    fontSize: 11,
    color: colors.light.textMuted,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 12,
    marginTop: 12,
  },
  cancelButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  cancelText: {
    color: colors.light.textMuted,
    fontWeight: '600',
  },
  submitButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.light.accent,
  },
  submitButtonDisabled: {
    backgroundColor: colors.light.border,
  },
  submitText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
});

export default CommentEditor;

