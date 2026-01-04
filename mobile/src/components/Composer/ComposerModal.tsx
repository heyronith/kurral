import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  NativeSyntheticEvent,
  TextInputSelectionChangeEventData,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useComposer } from '../../context/ComposerContext';
import { useAuthStore } from '../../stores/useAuthStore';
import { useFeedStore } from '../../stores/useFeedStore';
import {
  ALL_TOPICS,
  ReachMode,
  Topic,
  TunedAudience,
  type Chirp,
} from '../../types';
import { colors } from '../../theme/colors';
import { storageService } from '../../services/storageService';
import { extractMentionHandles, linkifyMentions } from '../../utils/mentions';
import { userService } from '../../services/userService';
import { getReachAgent } from '../../services/reachAgentService';
import { tryGenerateEmbedding } from '../../services/embeddingService';
import {
  mapSemanticTopicToBucket,
  ensureBucket,
  getAllBuckets,
} from '../../services/topicBucketService';
import { topicService } from '../../services/topicService';
import { isValidTopic } from '../../types';

type MentionCandidate = {
  id: string;
  name: string;
  handle: string;
  profilePictureUrl?: string;
};

const CHAR_LIMIT = 280;
const EMOJI_BANK = ['😀', '😁', '😂', '😊', '😍', '🔥', '🎉', '👍', '🙏', '🚀'];
const QUICK_SCHEDULES = [
  { label: 'None', value: null },
  { label: 'In 30m', value: () => new Date(Date.now() + 30 * 60 * 1000) },
  { label: 'In 3h', value: () => new Date(Date.now() + 3 * 60 * 60 * 1000) },
  {
    label: 'Tomorrow 9am',
    value: () => {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      d.setHours(9, 0, 0, 0);
      return d;
    },
  },
];

const escapeHtml = (input: string): string =>
  input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

// Helper functions for semantic analysis (matching webapp behavior)
const extractSemanticKeywords = (text: string, limit: number = 6): string[] => {
  const tokens = text.toLowerCase().match(/[a-z0-9#]{3,}/g) || [];
  const unique = Array.from(new Set(tokens));
  return unique.slice(0, limit);
};

const detectIntentFromContent = (text: string): string => {
  const lower = text.toLowerCase();
  if (lower.includes('?')) return 'question';
  if (lower.includes('announcing') || lower.includes('launch') || lower.includes('release')) return 'announcement';
  if (lower.includes('tutorial') || lower.includes('guide')) return 'tutorial';
  if (lower.includes('opinion') || lower.includes('i think')) return 'opinion';
  return 'update';
};

const normalizeSemanticTopics = (topics: string[]): string[] => {
  const normalizeTopic = (topic: string): string => {
    if (!topic) return '';
    let normalized = topic.replace(/#/g, '').trim().toLowerCase();
    normalized = normalized.replace(/[^a-z0-9-]+/g, '-');
    normalized = normalized.replace(/-+/g, '-');
    normalized = normalized.replace(/^-+|-+$/g, '');
    return normalized.slice(0, 50);
  };

  return Array.from(
    new Set(
      topics
        .map(normalizeTopic)
        .filter((topic) => topic.length > 0)
    )
  );
};

const createMissingTopics = async (
  topics: string[],
  existingTopics: Array<{ name: string }>
): Promise<string[]> => {
  const existingNames = new Set(existingTopics.map((topic) => topic.name.toLowerCase()));
  const missing = topics.filter((topic) => !existingNames.has(topic));
  if (missing.length === 0) {
    return [];
  }

  // Note: topicService.createTopic doesn't exist in mobile yet, but we can skip this
  // The webapp's topicService.createTopic will be called via the wrapper
  // For now, we'll just return the missing topics list
  return missing;
};

const markdownToHtml = (text: string): string => {
  let html = escapeHtml(text);
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/_(.+?)_/g, '<em>$1</em>');
  html = html.replace(/\n/g, '<br />');
  html = linkifyMentions(html);
  return html;
};

const TopicChip = ({
  value,
  selected,
  onPress,
}: {
  value: string;
  selected: boolean;
  onPress: (topic: string) => void;
}) => (
  <TouchableOpacity
    onPress={() => onPress(value)}
    style={[
      styles.chip,
      selected ? styles.chipSelected : undefined,
    ]}
  >
    <Text style={[styles.chipText, selected ? styles.chipTextSelected : undefined]}>
      #{value}
    </Text>
  </TouchableOpacity>
);

const ComposerModal = () => {
  const { isOpen, close, quotedChirp } = useComposer();
  const { user } = useAuthStore();
  const { addChirp } = useFeedStore();

  const [text, setText] = useState('');
  const [selectedTopic, setSelectedTopic] = useState<string>('');
  const [reachMode, setReachMode] = useState<ReachMode>('forAll');
  const [tunedAudience, setTunedAudience] = useState<TunedAudience>({
    allowFollowers: true,
    allowNonFollowers: false,
  });
  const [activeSchedulePreset, setActiveSchedulePreset] = useState<string | null>(null);
  const [isPosting, setIsPosting] = useState(false);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [scheduledAt, setScheduledAt] = useState<Date | null>(null);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionResults, setMentionResults] = useState<MentionCandidate[]>([]);
  const [selection, setSelection] = useState<{ start: number; end: number }>({
    start: 0,
    end: 0,
  });
  const [isGeneratingSuggestion, setIsGeneratingSuggestion] = useState(false);
  const mentionStartRef = useRef<number | null>(null);
  const mentionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mentionCache = useRef<Map<string, string>>(new Map());
  const suggestionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestInFlightRef = useRef<boolean>(false);
  const availableTopicsRef = useRef<Array<{ name: string; postsLast48h?: number; totalUsers?: number }>>([]);

  const remaining = useMemo(() => CHAR_LIMIT - text.length, [text]);
  const canPost = useMemo(
    () => !!user && text.trim().length > 0 && remaining >= 0 && !isPosting && !isUploadingImage,
    [user, text, remaining, isPosting, isUploadingImage]
  );

  const resetState = () => {
    setText('');
    setSelectedTopic('');
    setReachMode('forAll');
    setTunedAudience({ allowFollowers: true, allowNonFollowers: false });
    setIsPosting(false);
    setImageUri(null);
    setImageUrl(null);
    setIsUploadingImage(false);
    setScheduledAt(null);
    setActiveSchedulePreset(null);
    setMentionQuery(null);
    setMentionResults([]);
    setIsGeneratingSuggestion(false);
    mentionStartRef.current = null;
    if (suggestionTimeoutRef.current) {
      clearTimeout(suggestionTimeoutRef.current);
      suggestionTimeoutRef.current = null;
    }
    requestInFlightRef.current = false;
    availableTopicsRef.current = [];
  };

  useEffect(() => {
    if (isOpen) {
      resetState();
    }
  }, [isOpen]);

  useEffect(() => {
    if (mentionQuery === null) {
      setMentionResults([]);
      return;
    }

    if (mentionTimer.current) {
      clearTimeout(mentionTimer.current);
    }

    mentionTimer.current = setTimeout(async () => {
      const results = await userService.searchUsers(mentionQuery, 8);
      setMentionResults(
        results.map((u) => ({
          id: u.id,
          name: u.name,
          handle: u.handle,
          profilePictureUrl: u.profilePictureUrl,
        }))
      );
    }, mentionQuery.length === 0 ? 0 : 250);
  }, [mentionQuery]);

  // Auto-suggest topics when switching to Tuned mode (matching webapp behavior)
  useEffect(() => {
    // Clear any pending timeout
    if (suggestionTimeoutRef.current) {
      clearTimeout(suggestionTimeoutRef.current);
      suggestionTimeoutRef.current = null;
    }

    if (reachMode === 'tuned' && text.trim() && text.trim().length > 10 && user && !requestInFlightRef.current) {
      suggestionTimeoutRef.current = setTimeout(async () => {
        // Prevent duplicate requests
        if (requestInFlightRef.current) {
          return;
        }

        requestInFlightRef.current = true;
        setIsGeneratingSuggestion(true);
        setSelectedTopic(''); // Clear previous selection

        try {
          const userTopics = user.topics || user.interests || [];
          
          // Load topics for user (top 30 + user's topics)
          let availableTopics: Array<{ name: string; postsLast48h?: number; totalUsers?: number }> = [];
          try {
            availableTopics = await topicService.getTopicsForUser(userTopics);
            availableTopicsRef.current = availableTopics;
          } catch (error) {
            console.warn('[Composer] Failed to load topics:', error);
            requestInFlightRef.current = false;
            setIsGeneratingSuggestion(false);
            return;
          }

          if (availableTopics.length === 0) {
            console.warn('[Composer] No topics available');
            requestInFlightRef.current = false;
            setIsGeneratingSuggestion(false);
            return;
          }

          const reachAgent = getReachAgent();
          console.log('[Composer] ReachAgent available:', !!reachAgent);
          console.log('[Composer] Available topics:', availableTopics.length);

          if (reachAgent) {
            // Use AI agent to suggest topics + reach settings
            console.log('[Composer] Using AI agent...');
            const response = await reachAgent.suggestTopicsAndReach(
              text.trim(),
              availableTopics as any,
              userTopics
            );

            console.log('[Composer] AI response:', response);

            if (response.success && response.data) {
              console.log('[Composer] Using AI suggestion');
              const suggestionResult = response.data;

              // Auto-select the first (highest confidence) suggested topic
              if (suggestionResult.suggestedTopics.length > 0) {
                setSelectedTopic(suggestionResult.suggestedTopics[0].topic);
                setTunedAudience({
                  ...suggestionResult.tunedAudience,
                  targetAudienceDescription: suggestionResult.targetAudienceDescription,
                  targetAudienceEmbedding: suggestionResult.targetAudienceEmbedding,
                });
              }
            } else if (response.fallback) {
              console.warn('[Composer] AI failed, using fallback:', response.error);
              const fallbackResult = response.fallback;

              // Auto-select fallback topic if available
              if (fallbackResult.suggestedTopics.length > 0) {
                setSelectedTopic(fallbackResult.suggestedTopics[0].topic);
                setTunedAudience({
                  ...fallbackResult.tunedAudience,
                  targetAudienceDescription: fallbackResult.targetAudienceDescription,
                  targetAudienceEmbedding: fallbackResult.targetAudienceEmbedding,
                });
              }
            } else {
              // No suggestion available - use most active topic as fallback
              const fallbackTopic = availableTopics[0].name;
              setSelectedTopic(fallbackTopic);
              setTunedAudience({
                allowFollowers: true,
                allowNonFollowers: true,
                targetAudienceDescription: undefined,
                targetAudienceEmbedding: undefined,
              });
            }
          } else {
            // No agent available - use most active topic as fallback
            const fallbackTopic = availableTopics[0].name;
            setSelectedTopic(fallbackTopic);
            setTunedAudience({
              allowFollowers: true,
              allowNonFollowers: true,
              targetAudienceDescription: undefined,
              targetAudienceEmbedding: undefined,
            });
          }
        } catch (error) {
          console.error('[Composer] Error generating suggestion:', error);
          // Fallback to first available topic
          if (availableTopicsRef.current.length > 0) {
            setSelectedTopic(availableTopicsRef.current[0].name);
          }
        } finally {
          setIsGeneratingSuggestion(false);
          requestInFlightRef.current = false;
        }
      }, 1000); // 1 second debounce
    } else if (reachMode === 'forAll') {
      // Reset to empty when switching back to forAll
      setSelectedTopic('');
    }

    return () => {
      if (suggestionTimeoutRef.current) {
        clearTimeout(suggestionTimeoutRef.current);
        suggestionTimeoutRef.current = null;
      }
    };
  }, [reachMode, text, user]);

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

  const wrapSelection = (marker: string) => {
    const { start, end } = selection;
    const selected = text.slice(start, end);
    const wrapped = `${marker}${selected}${marker}`;
    const next =
      text.slice(0, start) + wrapped + text.slice(end);
    setText(next);
    const newPos = start + wrapped.length;
    setSelection({ start: newPos, end: newPos });
  };

  const insertEmoji = (emoji: string) => {
    const { start, end } = selection;
    const next = text.slice(0, start) + emoji + text.slice(end);
    const newPos = start + emoji.length;
    setText(next);
    setSelection({ start: newPos, end: newPos });
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

  const handlePickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      alert('We need media permissions to attach images.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });

    if (result.canceled || !result.assets.length) return;

    const asset = result.assets[0];
    setImageUri(asset.uri);
    setIsUploadingImage(true);
    try {
      if (!user?.id) throw new Error('No user');
      const url = await storageService.uploadChirpImage(asset.uri, user.id);
      setImageUrl(url);
    } catch (error) {
      console.error('[Composer] upload failed', error);
      alert('Failed to upload image. Please try again.');
      setImageUri(null);
      setImageUrl(null);
    } finally {
      setIsUploadingImage(false);
    }
  };

  const resolveMentions = async (handles: string[]): Promise<string[]> => {
    const ids: string[] = [];
    for (const handle of handles) {
      if (mentionCache.current.has(handle)) {
        ids.push(mentionCache.current.get(handle)!);
      } else if (handles.length <= 3) {
        const found = await userService.getUserByHandle(handle);
        if (found) {
          ids.push(found.id);
          mentionCache.current.set(handle, found.id);
        }
      }
    }
    return Array.from(new Set(ids));
  };

  const buildFormattedText = (raw: string): string => {
    const html = markdownToHtml(raw.trim());
    return html;
  };

  const handlePost = async () => {
    if (!canPost || !user) return;
    setIsPosting(true);
    try {
      const trimmed = text.trim();
      const formatted = buildFormattedText(trimmed);
      const handles = extractMentionHandles(trimmed);
      const mentionIds = await resolveMentions(handles);

      // Get user topics for semantic analysis
      const userTopics = user.topics || user.interests || [];
      
      // Load available topics for analysis (top 30 + user's topics)
      // Use mobile topicService which now has getTopicsForUser
      let availableTopicsForAnalysis: Array<{ name: string; postsLast48h?: number; totalUsers?: number }> = [];
      try {
        availableTopicsForAnalysis = await topicService.getTopicsForUser(userTopics);
      } catch (error) {
        console.warn('[Composer] Failed to load topics for analysis, using empty list:', error);
      }

      // Semantic analysis using reachAgent
      let semanticTopics: string[] = [];
      let entities: string[] = [];
      let intentValue: string | undefined;
      let bucketFromAI: Topic | null = null;
      let analysisTimestamp: Date | undefined;

      const reachAgent = getReachAgent();
      if (reachAgent && trimmed.length >= 4) {
        try {
          const existingBuckets = await getAllBuckets();
          const analysis = await reachAgent.analyzePostContent(
            trimmed,
            availableTopicsForAnalysis as any,
            existingBuckets
          );
          semanticTopics = analysis.semanticTopics || [];
          entities = analysis.entities || [];
          intentValue = analysis.intent;
          const rawBucket = analysis.suggestedBucket;
          if (rawBucket) {
            const sanitized = rawBucket.trim().replace(/^#+/, '').toLowerCase();
            bucketFromAI = isValidTopic(sanitized) ? (sanitized as Topic) : null;
          }
          analysisTimestamp = new Date();
        } catch (analysisError) {
          console.warn('[Composer] Semantic analysis failed, using fallback keywords.', analysisError);
        }
      }

      // Fallback to keyword extraction if no semantic topics
      if (semanticTopics.length === 0) {
        semanticTopics = extractSemanticKeywords(trimmed);
      }

      // Normalize semantic topics
      semanticTopics = normalizeSemanticTopics(semanticTopics);

      // Map semantic topics to buckets
      const semanticTopicBuckets: Record<string, string> = {};
      if (semanticTopics.length > 0) {
        const mapped = await Promise.all(
          semanticTopics.map(async (topic) => {
            const bucket = await mapSemanticTopicToBucket(topic, bucketFromAI || selectedTopic);
            return { topic, bucket };
          })
        );
        mapped.forEach(({ topic, bucket }) => {
          semanticTopicBuckets[topic] = bucket;
        });
        // If AI did not provide a bucket, reuse the first mapped bucket as a hint
        if (!bucketFromAI && mapped[0]) {
          bucketFromAI = mapped[0].bucket as Topic;
        }
      }

      // Create missing topics
      const newTopicNames = await createMissingTopics(semanticTopics, availableTopicsForAnalysis);
      // Note: Topic creation will happen server-side or via webapp's topicService

      // Detect intent if not provided by AI
      if (!intentValue) {
        intentValue = detectIntentFromContent(trimmed);
      }

      // Resolve final topic
      const resolvedTopic: Topic =
        (selectedTopic && isValidTopic(selectedTopic) ? selectedTopic : null) ||
        (bucketFromAI && isValidTopic(bucketFromAI) ? bucketFromAI : null) ||
        (userTopics.find((topic) => isValidTopic(topic)) as Topic | undefined) ||
        ALL_TOPICS[0];

      // Ensure the resolved topic bucket exists
      if (resolvedTopic && isValidTopic(resolvedTopic)) {
        await ensureBucket(resolvedTopic).catch((error) => {
          console.warn('[Composer] Failed to ensure bucket exists:', resolvedTopic, error);
        });
      }

      // Generate content embedding
      const contentEmbedding = trimmed ? await tryGenerateEmbedding(trimmed) : undefined;

      const chirpData: Omit<Chirp, 'id' | 'createdAt' | 'commentCount'> = {
        authorId: user.id,
        text: trimmed,
        topic: resolvedTopic,
        reachMode,
        tunedAudience: reachMode === 'tuned' ? tunedAudience : undefined,
        quotedChirpId: quotedChirp?.id,
        imageUrl: imageUrl || undefined,
        scheduledAt: scheduledAt || undefined,
        formattedText: formatted,
        mentions: mentionIds.length ? mentionIds : undefined,
        contentEmbedding: contentEmbedding,
      };

      // Add semantic analysis fields
      if (semanticTopics.length > 0) {
        chirpData.semanticTopics = semanticTopics;
        chirpData.semanticTopicBuckets = semanticTopicBuckets;
      }
      if (entities.length > 0) {
        chirpData.entities = entities;
      }
      if (intentValue) {
        chirpData.intent = intentValue;
      }
      if (analysisTimestamp) {
        chirpData.analyzedAt = analysisTimestamp;
      }

      await addChirp(chirpData);
      close();
    } catch (error) {
      console.error('[Composer] failed to post', error);
      alert('Unable to post right now. Please try again.');
    } finally {
      setIsPosting(false);
    }
  };

  const scheduleLabel = useMemo(() => {
    if (!scheduledAt) return 'Post now';
    return scheduledAt.toLocaleString();
  }, [scheduledAt]);

  return (
    <Modal visible={isOpen} animationType="slide" transparent>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>New chirp</Text>
              <Text style={styles.subtitle}>{user?.name}</Text>
            </View>
            <TouchableOpacity onPress={close} style={styles.closeButton}>
              <Text style={styles.closeText}>Close</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            <TextInput
              style={styles.input}
              placeholder="Share something..."
              placeholderTextColor={colors.light.textMuted}
              multiline
              value={text}
              onChangeText={handleTextChange}
              maxLength={CHAR_LIMIT}
              selection={selection}
              onSelectionChange={handleSelectionChange}
            />
            <View style={styles.toolbar}>
              <TouchableOpacity onPress={() => wrapSelection('**')} style={styles.toolButton}>
                <Text style={styles.toolText}>B</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => wrapSelection('_')} style={styles.toolButton}>
                <Text style={styles.toolText}>I</Text>
              </TouchableOpacity>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {EMOJI_BANK.map((emoji) => (
                  <TouchableOpacity
                    key={emoji}
                    onPress={() => insertEmoji(emoji)}
                    style={styles.emojiButton}
                  >
                    <Text style={styles.emoji}>{emoji}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <TouchableOpacity onPress={handlePickImage} style={styles.toolButton}>
                <Text style={styles.toolText}>Image</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.row}>
              <Text style={styles.label}>Topic</Text>
              {isGeneratingSuggestion && (
                <View style={styles.suggestionLoading}>
                  <ActivityIndicator size="small" color={colors.light.accent} />
                  <Text style={styles.suggestionLoadingText}>Analyzing content...</Text>
                </View>
              )}
              {selectedTopic ? (
                <View style={styles.selectedTopicContainer}>
                  <TopicChip
                    value={selectedTopic}
                    selected={true}
                    onPress={() => {}}
                  />
                  <TouchableOpacity
                    onPress={() => setSelectedTopic('')}
                    style={styles.clearTopicButton}
                  >
                    <Text style={styles.clearTopicText}>Change</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {ALL_TOPICS.map((topic) => (
                    <TopicChip
                      key={topic}
                      value={topic}
                      selected={topic === selectedTopic}
                      onPress={setSelectedTopic}
                    />
                  ))}
                </ScrollView>
              )}
            </View>

            <View style={styles.row}>
              <Text style={styles.label}>Reach</Text>
              <View style={styles.segment}>
                <TouchableOpacity
                  style={[
                    styles.segmentButton,
                    reachMode === 'forAll' && styles.segmentButtonActive,
                  ]}
                  onPress={() => setReachMode('forAll')}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      reachMode === 'forAll' && styles.segmentTextActive,
                    ]}
                  >
                    For all
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.segmentButton,
                    reachMode === 'tuned' && styles.segmentButtonActive,
                  ]}
                  onPress={() => setReachMode('tuned')}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      reachMode === 'tuned' && styles.segmentTextActive,
                    ]}
                  >
                    Tuned
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {reachMode === 'tuned' && (
              <View style={styles.row}>
                <Text style={styles.label}>Audience</Text>
                <View style={styles.toggleRow}>
                  <TouchableOpacity
                    style={[
                      styles.toggle,
                      tunedAudience.allowFollowers && styles.toggleActive,
                    ]}
                    onPress={() =>
                      setTunedAudience((prev) => ({
                        ...prev,
                        allowFollowers: !prev.allowFollowers,
                      }))
                    }
                  >
                    <Text
                      style={[
                        styles.toggleText,
                        tunedAudience.allowFollowers && styles.toggleTextActive,
                      ]}
                    >
                      Followers
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.toggle,
                      tunedAudience.allowNonFollowers && styles.toggleActive,
                    ]}
                    onPress={() =>
                      setTunedAudience((prev) => ({
                        ...prev,
                        allowNonFollowers: !prev.allowNonFollowers,
                      }))
                    }
                  >
                    <Text
                      style={[
                        styles.toggleText,
                        tunedAudience.allowNonFollowers && styles.toggleTextActive,
                      ]}
                    >
                      Non-followers
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            <View style={styles.row}>
              <Text style={styles.label}>Schedule</Text>
              <View style={styles.scheduleRow}>
                {QUICK_SCHEDULES.map((item) => (
                  <TouchableOpacity
                    key={item.label}
                    style={[
                      styles.scheduleChip,
                      activeSchedulePreset === item.label && styles.scheduleChipActive,
                    ]}
                    onPress={() => {
                      const nextDate = item.value ? item.value() : null;
                      setScheduledAt(nextDate);
                      setActiveSchedulePreset(item.label);
                    }}
                  >
                    <Text
                      style={[
                        styles.scheduleText,
                        activeSchedulePreset === item.label && styles.scheduleTextActive,
                      ]}
                    >
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.scheduleLabel}>{scheduleLabel}</Text>
            </View>

            {quotedChirp && (
              <View style={styles.quoteBox}>
                <Text style={styles.quoteTitle}>Quoting</Text>
                <Text style={styles.quoteText} numberOfLines={3}>
                  {quotedChirp.text}
                </Text>
              </View>
            )}

            {(imageUri || imageUrl) && (
              <View style={styles.previewBox}>
                {imageUri && (
                  <Image source={{ uri: imageUri }} style={styles.previewImage} />
                )}
                {isUploadingImage && (
                  <View style={styles.uploadOverlay}>
                    <ActivityIndicator color="#fff" />
                  </View>
                )}
                <TouchableOpacity
                  style={styles.removeImage}
                  onPress={() => {
                    setImageUri(null);
                    setImageUrl(null);
                  }}
                >
                  <Text style={styles.removeImageText}>Remove</Text>
                </TouchableOpacity>
              </View>
            )}

            {mentionQuery !== null && mentionResults.length > 0 && (
              <View style={styles.mentionBox}>
                {mentionResults.map((user) => (
                  <TouchableOpacity
                    key={user.id}
                    style={styles.mentionRow}
                    onPress={() => handleMentionSelect(user)}
                  >
                    <View style={styles.mentionAvatar}>
                      <Text style={styles.mentionAvatarText}>
                        {user.name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View>
                      <Text style={styles.mentionName}>{user.name}</Text>
                      <Text style={styles.mentionHandle}>@{user.handle}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </ScrollView>

          <View style={styles.footer}>
            <Text style={[styles.counter, remaining < 0 ? styles.counterOver : undefined]}>
              {remaining}
            </Text>
            <TouchableOpacity
              style={[styles.postButton, !canPost && styles.postButtonDisabled]}
              onPress={handlePost}
              disabled={!canPost}
            >
              {isPosting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.postText}>Post</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '95%',
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.light.border,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.light.textPrimary,
  },
  subtitle: {
    color: colors.light.textMuted,
    marginTop: 2,
  },
  closeButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: colors.light.backgroundElevated,
  },
  closeText: {
    color: colors.light.textPrimary,
    fontWeight: '600',
  },
  body: {
    padding: 16,
    gap: 12,
  },
  input: {
    minHeight: 140,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.light.border,
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    color: colors.light.textPrimary,
    backgroundColor: '#fafafa',
    textAlignVertical: 'top',
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  toolButton: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: colors.light.backgroundElevated,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.light.border,
  },
  toolText: {
    fontWeight: '700',
    color: colors.light.textPrimary,
  },
  emojiButton: {
    paddingHorizontal: 8,
  },
  emoji: {
    fontSize: 20,
  },
  row: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.light.textPrimary,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.light.backgroundElevated,
    borderRadius: 16,
    marginRight: 8,
  },
  chipSelected: {
    backgroundColor: colors.light.accent,
  },
  chipText: {
    color: colors.light.textPrimary,
    fontWeight: '600',
  },
  chipTextSelected: {
    color: '#fff',
  },
  segment: {
    flexDirection: 'row',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.light.border,
    borderRadius: 12,
    overflow: 'hidden',
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: colors.light.backgroundElevated,
  },
  segmentButtonActive: {
    backgroundColor: colors.light.accent,
  },
  segmentText: {
    color: colors.light.textPrimary,
    fontWeight: '700',
  },
  segmentTextActive: {
    color: '#fff',
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 8,
  },
  toggle: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: colors.light.backgroundElevated,
  },
  toggleActive: {
    backgroundColor: colors.light.accent,
  },
  toggleText: {
    color: colors.light.textPrimary,
    fontWeight: '600',
  },
  toggleTextActive: {
    color: '#fff',
  },
  scheduleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  scheduleChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: colors.light.backgroundElevated,
  },
  scheduleChipActive: {
    backgroundColor: colors.light.accent,
  },
  scheduleText: {
    color: colors.light.textPrimary,
    fontWeight: '600',
  },
  scheduleTextActive: {
    color: '#fff',
  },
  scheduleLabel: {
    color: colors.light.textMuted,
    marginTop: 4,
  },
  quoteBox: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.light.border,
    borderRadius: 12,
    padding: 12,
    backgroundColor: colors.light.backgroundElevated,
  },
  quoteTitle: {
    fontWeight: '700',
    color: colors.light.textPrimary,
    marginBottom: 6,
  },
  quoteText: {
    color: colors.light.textSecondary,
  },
  previewBox: {
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#000',
  },
  previewImage: {
    width: '100%',
    height: 220,
  },
  uploadOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  removeImage: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  removeImageText: {
    color: '#fff',
    fontWeight: '700',
  },
  mentionBox: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.light.border,
    borderRadius: 12,
    backgroundColor: '#fff',
  },
  mentionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.light.border,
  },
  mentionAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.light.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  mentionAvatarText: {
    color: '#fff',
    fontWeight: '700',
  },
  mentionName: {
    color: colors.light.textPrimary,
    fontWeight: '700',
  },
  mentionHandle: {
    color: colors.light.textMuted,
  },
  footer: {
    padding: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.light.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  counter: {
    color: colors.light.textMuted,
    fontWeight: '700',
  },
  counterOver: {
    color: 'red',
  },
  postButton: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: colors.light.accent,
  },
  postButtonDisabled: {
    backgroundColor: colors.light.border,
  },
  postText: {
    color: '#fff',
    fontWeight: '700',
  },
  suggestionLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  suggestionLoadingText: {
    color: colors.light.textMuted,
    fontSize: 12,
  },
  selectedTopicContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  clearTopicButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.light.backgroundElevated,
  },
  clearTopicText: {
    color: colors.light.textPrimary,
    fontSize: 12,
    fontWeight: '600',
  },
});

export default ComposerModal;


