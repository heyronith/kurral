import { useState, useEffect, useMemo, useRef } from 'react';
import {
  ALL_TOPICS,
  type Topic,
  type ReachMode,
  type TunedAudience,
  type Chirp,
  type TopicMetadata,
} from '../types';
import { useFeedStore } from '../store/useFeedStore';
import { useUserStore } from '../store/useUserStore';
import { useTopicStore } from '../store/useTopicStore';
import { useThemeStore } from '../store/useThemeStore';
import { getReachAgent } from '../lib/agents/reachAgent';
import { topicService } from '../lib/firestore';
import { BaseAgent } from '../lib/agents/baseAgent';
import type { ReachSuggestion } from '../lib/agents/reachAgent';
import TopicSuggestionBox from './TopicSuggestionBox';
import { ImageIcon, EmojiIcon, CalendarIcon } from './Icon';
import EmojiPicker, { Theme } from 'emoji-picker-react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { uploadImage } from '../lib/storage';
import { useComposer } from '../context/ComposerContext';
import { sanitizeHTML } from '../lib/utils/sanitize';
import { tryGenerateEmbedding } from '../lib/services/embeddingService';

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

const isLegacyTopic = (value?: string): value is Topic => {
  if (!value) return false;
  return ALL_TOPICS.includes(value as Topic);
};

const normalizeSemanticTopics = (topics: string[]): string[] => {
  return Array.from(
    new Set(
      topics
        .map((topic) => topic.replace(/#/g, '').trim().toLowerCase())
        .filter((topic) => topic.length > 0)
    )
  );
};

const createMissingTopics = async (
  topics: string[],
  existingTopics: TopicMetadata[]
): Promise<string[]> => {
  const existingNames = new Set(existingTopics.map((topic) => topic.name.toLowerCase()));
  const missing = topics.filter((topic) => !existingNames.has(topic));
  if (missing.length === 0) {
    return [];
  }

  const creationPromises = missing.map((topicName) =>
    topicService.createTopic(topicName).catch((error) => {
      console.error('[Composer] Failed to create topic record:', topicName, error);
    })
  );

  await Promise.allSettled(creationPromises);
  return missing;
};

const Composer = () => {
  const [text, setText] = useState('');
  const [selectedTopic, setSelectedTopic] = useState<string>('');
  const [reachMode, setReachMode] = useState<ReachMode>('forAll');
  const [tunedAudience, setTunedAudience] = useState<TunedAudience>({
    allowFollowers: true,
    allowNonFollowers: false,
  });
  const [isPosting, setIsPosting] = useState(false);
  const [suggestion, setSuggestion] = useState<ReachSuggestion | null>(null);
  const [showSuggestion, setShowSuggestion] = useState(false);
  const [isGeneratingSuggestion, setIsGeneratingSuggestion] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  
  // New state for enhanced features
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState('');
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [scheduledAt, setScheduledAt] = useState<Date | null>(null);
  const [showSchedulePicker, setShowSchedulePicker] = useState(false);
  const [isBoldActive, setIsBoldActive] = useState(false);
  const [isItalicActive, setIsItalicActive] = useState(false);
  const [showReachMenu, setShowReachMenu] = useState(false);

  // Ref to track if a request is in flight and prevent duplicate calls
  const requestInFlight = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contentEditableRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const reachMenuRef = useRef<HTMLDivElement>(null);
  const availableTopicsRef = useRef<TopicMetadata[]>([]);
  const composerRef = useRef<HTMLDivElement>(null);

  const { addChirp } = useFeedStore();
  const { currentUser } = useUserStore();
  const { loadTopicsForUser, allTopics, isLoading: topicsLoading } = useTopicStore();
  const { hideComposer } = useComposer();
  const { theme } = useThemeStore();

  // Get topics from user's profile, fallback to empty array
  const userTopics = useMemo(() => {
    return currentUser?.topics || [];
  }, [currentUser]);

  // Get all topic names for manual selection
  const allTopicNames = useMemo(() => {
    const names = allTopics.map(t => t.name);
    const unique = [...new Set([...names, ...userTopics])];
    return unique.sort();
  }, [allTopics, userTopics]);

  const charLimit = 280;
  
  // Get plain text from contentEditable for character counting and posting
  const getPlainText = (): string => {
    if (!contentEditableRef.current) return '';
    return contentEditableRef.current.innerText || '';
  };

  // Get formatted HTML from contentEditable
  const getFormattedText = (): string => {
    if (!contentEditableRef.current) return '';
    return contentEditableRef.current.innerHTML || '';
  };

  const plainText = getPlainText();
  const remaining = charLimit - plainText.length;
  const canPost = plainText.trim().length > 0 && !isPosting && !!currentUser;
  const isScheduled = scheduledAt !== null && scheduledAt > new Date();

  // Update text state when contentEditable changes
  const handleContentChange = () => {
    const plain = getPlainText();
    if (plain.length <= charLimit) {
      setText(plain);
    } else {
      // Truncate if over limit
      const truncated = plain.slice(0, charLimit);
      if (contentEditableRef.current) {
        contentEditableRef.current.innerText = truncated;
        setText(truncated);
      }
    }
    
    // Update formatting state
    if (contentEditableRef.current) {
      contentEditableRef.current.focus();
      setIsBoldActive(document.queryCommandState('bold'));
      setIsItalicActive(document.queryCommandState('italic'));
    }
  };

  // Generate suggestion when switching to Tuned mode (new flow)
  useEffect(() => {
    // Clear any pending timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    if (reachMode === 'tuned' && plainText.trim() && plainText.trim().length > 10 && currentUser && !requestInFlight.current) {
      timeoutRef.current = setTimeout(async () => {
        // Prevent duplicate requests
        if (requestInFlight.current) {
          return;
        }

        requestInFlight.current = true;
        setIsGeneratingSuggestion(true);
        setShowSuggestion(false);
        setSelectedTopic(''); // Clear previous selection

        try {
          // Load topics for user (top 30 + user's topics)
          const availableTopics = await loadTopicsForUser(userTopics);
          availableTopicsRef.current = availableTopics;
          
          if (availableTopics.length === 0) {
            console.warn('[Composer] No topics available');
            setIsGeneratingSuggestion(false);
            requestInFlight.current = false;
            return;
          }

          const reachAgent = getReachAgent();
          console.log('[Composer] ReachAgent available:', !!reachAgent);
          console.log('[Composer] Available topics:', availableTopics.length);
          
          let suggestionResult: ReachSuggestion | null = null;

          if (reachAgent) {
            // Use AI agent to suggest topics + reach settings
            console.log('[Composer] Using AI agent...');
            const response = await reachAgent.suggestTopicsAndReach(
              plainText.trim(),
              availableTopics,
              userTopics
            );
            
            console.log('[Composer] AI response:', response);
            
            if (response.success && response.data) {
              console.log('[Composer] Using AI suggestion');
              suggestionResult = response.data;
              
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
              
              // Check if it's a rate limit error
              if (response.error?.includes('rate limit') || response.error?.includes('quota') || response.error?.includes('429')) {
                setAiError('AI suggestions temporarily unavailable (rate limit). Using smart fallback suggestions.');
                // Clear error after 5 seconds
                setTimeout(() => setAiError(null), 5000);
              } else if (response.error?.includes('Empty response')) {
                setAiError('AI temporarily unavailable. Using smart fallback suggestions.');
                setTimeout(() => setAiError(null), 5000);
              }
              
              suggestionResult = response.fallback;
              
              // Auto-select fallback topic if available
              if (suggestionResult.suggestedTopics.length > 0) {
                setSelectedTopic(suggestionResult.suggestedTopics[0].topic);
                setTunedAudience({
                  ...suggestionResult.tunedAudience,
                  targetAudienceDescription: suggestionResult.targetAudienceDescription,
                  targetAudienceEmbedding: suggestionResult.targetAudienceEmbedding,
                });
              }
            }
          }

          // Fallback if AI not available or failed
          if (!suggestionResult && availableTopics.length > 0) {
            console.warn('[Composer] AI not available, using fallback');
            const fallbackTopic = availableTopics[0].name;
            suggestionResult = {
              suggestedTopics: [{
                topic: fallbackTopic,
                confidence: 0.5,
                explanation: 'Using most active topic as fallback.',
                isUserTopic: userTopics.includes(fallbackTopic),
              }],
              tunedAudience: {
                allowFollowers: true,
                allowNonFollowers: true,
              },
              explanation: 'Using default settings.',
              overallExplanation: 'AI suggestions not available. Using most active topic with default settings.',
              targetAudienceDescription: 'Default reach settings for topic audience.',
              targetAudienceEmbedding: undefined,
            };
            setSelectedTopic(fallbackTopic);
            setTunedAudience({
              ...suggestionResult.tunedAudience,
              targetAudienceDescription: suggestionResult.targetAudienceDescription,
              targetAudienceEmbedding: suggestionResult.targetAudienceEmbedding,
            });
          }

          if (suggestionResult) {
            setSuggestion(suggestionResult);
            setShowSuggestion(true);
          }
        } catch (error) {
          console.error('[Composer] Error generating suggestion:', error);
          // Fallback to first available topic name
          if (allTopicNames.length > 0) {
            const fallbackTopic = allTopicNames[0];
            setSelectedTopic(fallbackTopic);
            setTunedAudience({
              allowFollowers: true,
              allowNonFollowers: true,
              targetAudienceDescription: undefined,
              targetAudienceEmbedding: undefined,
            });
          }
        } finally {
          setIsGeneratingSuggestion(false);
          requestInFlight.current = false;
        }
      }, 1500); // Increased debounce to 1500ms to reduce API calls

      return () => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
      };
    } else if (reachMode === 'forAll') {
      // Reset when switching away from tuned mode
      setShowSuggestion(false);
      setIsGeneratingSuggestion(false);
      setSuggestion(null);
      setAiError(null);
      requestInFlight.current = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    }
  }, [reachMode, plainText, currentUser, userTopics, loadTopicsForUser, allTopicNames]);

  // Close reach menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (reachMenuRef.current && !reachMenuRef.current.contains(event.target as Node)) {
        setShowReachMenu(false);
      }
    };

    if (showReachMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showReachMenu]);

  const handleApplySuggestion = () => {
    // Settings are already applied, just hide suggestion
    setShowSuggestion(false);
  };

  const handleIgnoreSuggestion = () => {
    setShowSuggestion(false);
    // Reset to defaults
    if (suggestion && suggestion.suggestedTopics.length > 0) {
      setSelectedTopic('');
    }
  };

  const handleTopicSelect = (topic: string) => {
    setSelectedTopic(topic);
  };

  const handleAudienceChange = (audience: TunedAudience) => {
    setTunedAudience(audience);
  };

  // WYSIWYG Formatting functions
  const handleBold = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!contentEditableRef.current) return;
    
    // Ensure focus is on the contentEditable
    contentEditableRef.current.focus();
    
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    
    const range = selection.getRangeAt(0);
    
    // If there's selected text, apply formatting to it
    if (!range.collapsed) {
      document.execCommand('bold', false);
      setIsBoldActive(document.queryCommandState('bold'));
    } else {
      // No selection - toggle state for future typing
      const newBoldState = !isBoldActive;
      setIsBoldActive(newBoldState);
      
      // Insert a zero-width space inside a strong tag to establish formatting context
      if (newBoldState) {
        const strong = document.createElement('strong');
        const zwsp = document.createTextNode('\u200B');
        strong.appendChild(zwsp);
        range.insertNode(strong);
        // Move cursor INSIDE the strong tag (after the zero-width space)
        range.setStart(zwsp, 1);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
      } else {
        // Remove bold formatting if we're inside a strong tag
        let node = range.commonAncestorContainer;
        if (node.nodeType === Node.TEXT_NODE) {
          node = node.parentElement || node;
        }
        const strongParent = (node as Element)?.closest('strong, b');
        if (strongParent) {
          const parent = strongParent.parentNode;
          const text = strongParent.textContent;
          const textNode = document.createTextNode(text || '');
          parent?.replaceChild(textNode, strongParent);
          range.setStart(textNode, textNode.length);
          range.collapse(true);
          selection.removeAllRanges();
          selection.addRange(range);
        }
      }
    }
    
    handleContentChange();
  };

  const handleItalic = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!contentEditableRef.current) return;
    
    // Ensure focus is on the contentEditable
    contentEditableRef.current.focus();
    
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    
    const range = selection.getRangeAt(0);
    
    // If there's selected text, apply formatting to it
    if (!range.collapsed) {
      document.execCommand('italic', false);
      setIsItalicActive(document.queryCommandState('italic'));
    } else {
      // No selection - toggle state for future typing
      const newItalicState = !isItalicActive;
      setIsItalicActive(newItalicState);
      
      // Insert a zero-width space inside an em tag to establish formatting context
      if (newItalicState) {
        const em = document.createElement('em');
        const zwsp = document.createTextNode('\u200B');
        em.appendChild(zwsp);
        range.insertNode(em);
        // Move cursor INSIDE the em tag (after the zero-width space)
        range.setStart(zwsp, 1);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
      } else {
        // Remove italic formatting if we're inside an em tag
        let node = range.commonAncestorContainer;
        if (node.nodeType === Node.TEXT_NODE) {
          node = node.parentElement || node;
        }
        const emParent = (node as Element)?.closest('em, i');
        if (emParent) {
          const parent = emParent.parentNode;
          const text = emParent.textContent;
          const textNode = document.createTextNode(text || '');
          parent?.replaceChild(textNode, emParent);
          range.setStart(textNode, textNode.length);
          range.collapse(true);
          selection.removeAllRanges();
          selection.addRange(range);
        }
      }
    }
    
    handleContentChange();
  };

  const handleEmojiClick = (emojiData: { emoji: string }) => {
    const emoji = emojiData.emoji;
    if (!contentEditableRef.current) return;

    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      range.deleteContents();
      const textNode = document.createTextNode(emoji);
      range.insertNode(textNode);
      range.setStartAfter(textNode);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
    } else {
      // Insert at end if no selection
      contentEditableRef.current.textContent += emoji;
    }
    
    handleContentChange();
    setShowEmojiPicker(false);
    contentEditableRef.current.focus();
  };

  // Handle image file selection
  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Image size must be less than 5MB');
      return;
    }

    setImageFile(file);
    
    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Upload to Firebase Storage
    setIsUploadingImage(true);
    try {
      const downloadURL = await uploadImage(file, currentUser.id);
      setImageUrl(downloadURL);
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('Failed to upload image. Please try again.');
      setImageFile(null);
      setImagePreview(null);
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setImageUrl('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const formatScheduleTime = (date: Date): string => {
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `in ${days}d ${hours % 24}h`;
    } else if (hours > 0) {
      return `in ${hours}h ${minutes}m`;
    } else {
      return `in ${minutes}m`;
    }
  };

  const handlePost = async () => {
    if (!canPost || !currentUser) return;

    setIsPosting(true);

    try {
      // Get formatted HTML and plain text
      const formattedHTML = getFormattedText();
      const sanitizedHTML = formattedHTML ? sanitizeHTML(formattedHTML) : '';
      const plainTextContent = getPlainText();
      const trimmedContent = plainTextContent.trim();

      const reachAgent = getReachAgent();
      let availableTopicsForAnalysis = availableTopicsRef.current;
      if (availableTopicsForAnalysis.length === 0) {
        try {
          availableTopicsForAnalysis = await loadTopicsForUser(userTopics);
          availableTopicsRef.current = availableTopicsForAnalysis;
        } catch (topicError) {
          console.error('[Composer] Failed to load topics for analysis:', topicError);
          availableTopicsForAnalysis = [];
        }
      }
      let semanticTopics: string[] = [];
      let entities: string[] = [];
      let intentValue: string | undefined;
      let legacyTopicFromAI: Topic | null = null;
      let analysisTimestamp: Date | undefined;

      // Show analyzing modal during AI analysis
      if (reachAgent && plainTextContent.trim().length >= 4) {
        setIsGeneratingSuggestion(true);
        try {
          const analysis = await reachAgent.analyzePostContent(
            plainTextContent.trim(),
            availableTopicsForAnalysis
          );
          semanticTopics = analysis.semanticTopics || [];
          entities = analysis.entities || [];
          intentValue = analysis.intent;
          legacyTopicFromAI = analysis.suggestedLegacyTopic;
          analysisTimestamp = new Date();
        } catch (analysisError) {
          console.warn('[Composer] Semantic analysis failed, using fallback keywords.', analysisError);
        } finally {
          setIsGeneratingSuggestion(false);
        }
      }

      if (semanticTopics.length === 0) {
        semanticTopics = extractSemanticKeywords(plainTextContent);
      }

      semanticTopics = normalizeSemanticTopics(semanticTopics);

      const newTopicNames = await createMissingTopics(semanticTopics, availableTopicsForAnalysis);
      if (newTopicNames.length > 0) {
        const timestamp = new Date();
        const newMetadata = newTopicNames.map((topicName) => ({
          name: topicName,
          postsLast48h: 0,
          postsLast1h: 0,
          postsLast4h: 0,
          totalUsers: 0,
          lastEngagementUpdate: timestamp,
          averageVelocity1h: 0,
          isTrending: false,
        }));
        availableTopicsForAnalysis = [...availableTopicsForAnalysis, ...newMetadata];
        availableTopicsRef.current = availableTopicsForAnalysis;
      }

      if (!intentValue) {
        intentValue = detectIntentFromContent(plainTextContent);
      }

      const resolvedTopic: Topic =
        (isLegacyTopic(selectedTopic) ? (selectedTopic as Topic) : null) ||
        legacyTopicFromAI ||
        (userTopics.find((topic) => isLegacyTopic(topic)) as Topic | undefined) ||
        'dev';

      // Create new chirp (will be persisted to Firestore)
      const contentEmbedding = trimmedContent ? await tryGenerateEmbedding(trimmedContent) : undefined;

      const chirpData: Omit<Chirp, 'id' | 'createdAt' | 'commentCount'> = {
        authorId: currentUser.id,
        text: trimmedContent,
        topic: resolvedTopic,
        reachMode,
        tunedAudience: reachMode === 'tuned' ? tunedAudience : undefined,
        contentEmbedding: contentEmbedding,
      };

      if (semanticTopics.length > 0) {
        chirpData.semanticTopics = semanticTopics;
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

      // Add optional fields
      if (imageUrl.trim()) {
        chirpData.imageUrl = imageUrl.trim();
      }
      if (scheduledAt && scheduledAt > new Date()) {
        chirpData.scheduledAt = scheduledAt;
      }
      // Store formatted HTML
      if (sanitizedHTML.trim()) {
        chirpData.formattedText = sanitizedHTML.trim();
      }

      await addChirp(chirpData);

      // Reset form
      if (contentEditableRef.current) {
        contentEditableRef.current.innerHTML = '';
      }
      setText('');
      setImageFile(null);
      setImagePreview(null);
      setImageUrl('');
      setSelectedTopic('');
      setReachMode('forAll');
      setScheduledAt(null);
      setSuggestion(null);
      setShowSuggestion(false);
      setShowEmojiPicker(false);
      setShowSchedulePicker(false);
      setShowReachMenu(false);
      setIsBoldActive(false);
      setIsItalicActive(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      setTunedAudience({
        allowFollowers: true,
        allowNonFollowers: false,
      });
      
      // Hide composer after successful post
      hideComposer();
    } catch (error) {
      console.error('Error posting chirp:', error);
      // You could show an error message to the user here
    } finally {
      setIsPosting(false);
    }
  };

  // Get Reach mode display for post button
  const getReachButtonLabel = (): string => {
    if (isScheduled) {
      return reachMode === 'tuned' ? 'Schedule Tuned' : 'Schedule Post';
    }
    return reachMode === 'tuned' ? 'Post Tuned' : 'Post';
  };

  return (
    <div 
      ref={composerRef}
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] w-[calc(100%-3rem)] max-w-2xl"
      style={{ position: 'fixed' }}
    >
      {/* Always visible: Full composer */}
      <div className={`${theme === 'dark' ? 'bg-black/90 border-white/20' : 'bg-gradient-to-br from-blue-50 via-blue-100/80 to-primary/20 border-primary/40'} rounded-3xl border-2 ${theme === 'dark' ? '' : 'shadow-2xl'} overflow-hidden relative`}>
        {/* Inline Analyzing Overlay - Embedded in Composer */}
        {isGeneratingSuggestion && (
          <div className={`absolute inset-0 z-50 ${theme === 'dark' ? 'bg-black/80' : 'bg-white/80'} backdrop-blur-sm rounded-3xl flex items-center justify-center`}>
            <div className="flex flex-col items-center gap-3">
              {/* Simple Spinner */}
              <div className="relative w-8 h-8">
                <div className={`absolute inset-0 border-2 ${theme === 'dark' ? 'border-white/20' : 'border-primary/20'} rounded-full`}></div>
                <div className={`absolute inset-0 border-2 border-transparent ${theme === 'dark' ? 'border-t-white' : 'border-t-primary'} rounded-full animate-spin`}></div>
              </div>
              {/* Simple Message */}
              <p className={`text-sm font-medium ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`}>
                {isPosting ? 'Analyzing post...' : 'Analyzing content...'}
              </p>
            </div>
          </div>
        )}
        {/* Compact Header with Profile */}
        <div className={`flex items-center gap-3 px-4 pt-4 pb-3 border-b-2 ${theme === 'dark' ? 'border-white/10' : 'border-primary/20'}`}>
          {currentUser?.profilePictureUrl ? (
            <img
              src={currentUser.profilePictureUrl}
              alt={currentUser.name}
              className={`w-10 h-10 rounded-full object-cover ${theme === 'dark' ? '' : 'border-2 border-border/40'}`}
            />
          ) : (
            <div className={`w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center ${theme === 'dark' ? '' : 'border-2 border-border/40'}`}>
              <span className="text-white font-semibold text-sm">
                {currentUser?.name?.charAt(0).toUpperCase() || 'U'}
              </span>
            </div>
          )}
          <div className="flex-1">
            <div className={`font-medium text-sm ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`}>{currentUser?.name || 'User'}</div>
            <div className={`text-xs ${theme === 'dark' ? 'text-white/70' : 'text-textMuted'}`}>@{currentUser?.handle || 'username'}</div>
          </div>
          <button
            onClick={hideComposer}
            className={`p-1.5 rounded-lg ${theme === 'dark' ? 'text-white/70 hover:bg-white/10 hover:text-white' : 'text-textMuted hover:bg-backgroundElevated/60 hover:text-textPrimary'} transition-colors`}
            aria-label="Close composer"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

          {/* Compact Input Area */}
          <div className="px-4 py-3">
            <div className="relative">
        {/* ContentEditable for WYSIWYG formatting */}
        <div
          ref={contentEditableRef}
                id="composer-input"
          contentEditable
          onInput={(e) => {
            // Clean up zero-width spaces after typing
            if (contentEditableRef.current) {
              const zwspElements = contentEditableRef.current.querySelectorAll('strong:only-child, em:only-child');
              zwspElements.forEach((el) => {
                if (el.textContent === '\u200B' && el.children.length === 0) {
                  // Remove empty formatting markers
                  const parent = el.parentNode;
                  if (parent) {
                    parent.removeChild(el);
                  }
                }
              });
            }
            handleContentChange();
            // Maintain formatting state when typing
            if (contentEditableRef.current) {
              setIsBoldActive(document.queryCommandState('bold'));
              setIsItalicActive(document.queryCommandState('italic'));
            }
          }}
          onPaste={(e) => {
            // Handle paste - strip formatting from pasted text to keep it simple
            e.preventDefault();
            const text = e.clipboardData.getData('text/plain');
            
            // Apply current formatting if active
            if (isBoldActive) {
              document.execCommand('bold', false);
            }
            if (isItalicActive) {
              document.execCommand('italic', false);
            }
            
            document.execCommand('insertText', false, text);
            handleContentChange();
          }}
                data-placeholder="Share something..."
                className={`w-full ${theme === 'dark' ? 'bg-white/10 border-white/20 text-white placeholder:text-white/50 focus:border-accent/60 focus:ring-accent/20' : 'bg-white/80 border-primary/30 text-textPrimary focus:ring-primary/30 focus:border-primary/60'} backdrop-blur-sm border-2 resize-none outline-none text-sm focus:ring-2 rounded-xl px-4 py-3 transition-all duration-200 min-h-[60px] max-h-[200px] overflow-y-auto`}
          style={{
            whiteSpace: 'pre-wrap',
            wordWrap: 'break-word',
          }}
          onMouseDown={(e) => {
            // Prevent toolbar buttons from losing focus
            if ((e.target as HTMLElement).closest('.formatting-toolbar')) {
              e.preventDefault();
            }
          }}
          onMouseUp={() => {
            // Update formatting state when selection changes
            if (contentEditableRef.current) {
              setIsBoldActive(document.queryCommandState('bold'));
              setIsItalicActive(document.queryCommandState('italic'));
            }
          }}
        />
        
        {/* Placeholder styling and formatting styles */}
        <style>{`
          [contenteditable][data-placeholder]:empty:before {
            content: attr(data-placeholder);
            color: ${theme === 'dark' ? 'rgba(255, 255, 255, 0.5)' : 'rgb(107 114 128 / 0.6)'};
            pointer-events: none;
          }
          [contenteditable] strong,
          [contenteditable] b {
            font-weight: 700;
          }
          [contenteditable] em,
          [contenteditable] i {
            font-style: italic;
          }
          .schedule-calendar {
            background-color: transparent !important;
            color: rgb(249 250 251);
            border: none !important;
            border-radius: 0.5rem;
            padding: 0;
            width: 100%;
            font-family: inherit;
          }
          .schedule-calendar .react-datepicker__month-container {
            width: 100%;
            float: none;
          }
          .schedule-calendar .react-datepicker__header {
            background-color: transparent !important;
            border-bottom: 1px solid rgba(255,255,255,0.1);
            padding: 0.75rem 0.5rem;
          }
          .schedule-calendar .react-datepicker__current-month {
            color: rgb(249 250 251);
            font-weight: 600;
            font-size: 0.875rem;
            margin-bottom: 0.5rem;
          }
          .schedule-calendar .react-datepicker__day-names {
            display: flex;
            justify-content: space-around;
            margin-bottom: 0.5rem;
          }
          .schedule-calendar .react-datepicker__day-name {
            color: rgb(156 163 175);
            font-size: 0.75rem;
            font-weight: 500;
            width: 2.25rem;
            line-height: 2.25rem;
            margin: 0;
          }
          .schedule-calendar .react-datepicker__month {
            margin: 0;
            padding: 0.25rem;
          }
          .schedule-calendar .react-datepicker__week {
            display: flex;
            justify-content: space-around;
          }
          .schedule-calendar .react-datepicker__day {
            color: rgb(249 250 251);
            width: 2.25rem;
            height: 2.25rem;
            line-height: 2.25rem;
            margin: 0.125rem;
            border-radius: 0.375rem;
            font-size: 0.875rem;
          }
          .schedule-calendar .react-datepicker__day:hover {
            background-color: rgba(99, 102, 241, 0.2);
            border-radius: 0.375rem;
          }
          .schedule-calendar .react-datepicker__day--selected,
          .schedule-calendar .react-datepicker__day--keyboard-selected {
            background-color: #6366f1 !important;
            color: white !important;
            border-radius: 0.375rem;
            font-weight: 600;
          }
          .schedule-calendar .react-datepicker__day--today {
            border: 1px solid #6366f1;
            border-radius: 0.375rem;
            font-weight: 600;
          }
          .schedule-calendar .react-datepicker__day--outside-month {
            color: rgba(156, 163, 175, 0.4);
          }
          .schedule-calendar .react-datepicker__navigation {
            top: 0.75rem;
            width: 1.5rem;
            height: 1.5rem;
          }
          .schedule-calendar .react-datepicker__navigation-icon::before {
            border-color: rgb(156 163 175);
            border-width: 2px 2px 0 0;
          }
          .schedule-calendar .react-datepicker__navigation:hover *::before {
            border-color: #6366f1;
          }
          .schedule-calendar .react-datepicker__time-container {
            border-left: 1px solid rgba(255,255,255,0.1);
            width: 120px;
          }
          .schedule-calendar .react-datepicker__time-container .react-datepicker__time {
            background-color: transparent;
          }
          .schedule-calendar .react-datepicker__time-container .react-datepicker__time .react-datepicker__time-box {
            width: 100%;
          }
          .schedule-calendar .react-datepicker__time-list-item {
            height: 2.5rem;
            padding: 0.5rem;
            border-radius: 0.375rem;
            margin: 0.125rem 0;
            color: rgb(249 250 251);
          }
          .schedule-calendar .react-datepicker__time-list-item:hover {
            background-color: rgba(99, 102, 241, 0.2);
          }
          .schedule-calendar .react-datepicker__time-list-item--selected {
            background-color: #6366f1 !important;
            color: white !important;
            font-weight: 600;
          }
          .schedule-calendar .react-datepicker-time__header {
            color: rgb(249 250 251);
            font-weight: 600;
            font-size: 0.75rem;
          }
          .schedule-calendar input {
            background-color: rgba(30, 30, 40, 0.6);
            border: 1px solid rgba(255,255,255,0.1);
            color: rgb(249 250 251);
          }
          .schedule-calendar input:focus {
            outline: none;
            border-color: #6366f1;
            box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.2);
          }
        `}</style>
            </div>
        
            {/* Compact Action Bar - Inline with input */}
            <div className={`flex items-center justify-between mt-3 pt-3 border-t ${theme === 'dark' ? 'border-white/10' : 'border-border/30'}`}>
              <div className="flex items-center gap-2">
                {/* Formatting toolbar - Compact */}
                <div className="formatting-toolbar flex items-center gap-1">
          <button
            onMouseDown={handleBold}
                    className={`p-1.5 rounded-lg transition-all duration-200 active:scale-95 ${
                      isBoldActive 
                        ? 'bg-accent/20 text-accent' 
                        : theme === 'dark' 
                          ? 'text-white/70 hover:bg-white/10 hover:text-white' 
                          : 'text-textMuted hover:bg-backgroundElevated/60 hover:text-textPrimary'
            }`}
            title="Bold"
            type="button"
          >
                    <span className="text-xs font-bold">B</span>
          </button>
          <button
            onMouseDown={handleItalic}
                    className={`p-1.5 rounded-lg transition-all duration-200 active:scale-95 ${
                      isItalicActive 
                        ? 'bg-accent/20 text-accent' 
                        : theme === 'dark' 
                          ? 'text-white/70 hover:bg-white/10 hover:text-white' 
                          : 'text-textMuted hover:bg-backgroundElevated/60 hover:text-textPrimary'
            }`}
            title="Italic"
            type="button"
          >
                    <span className="text-xs italic">I</span>
          </button>
                  <div className={`w-px h-4 ${theme === 'dark' ? 'bg-white/10' : 'bg-border/60'} mx-1`} />
          <div className="relative">
            <button
              onClick={() => {
                setShowEmojiPicker(!showEmojiPicker);
                setShowSchedulePicker(false);
              }}
                      className={`p-1.5 rounded-lg transition-all duration-200 active:scale-95 ${theme === 'dark' ? 'text-white/70 hover:bg-white/10 hover:text-white' : 'text-textMuted hover:bg-backgroundElevated/60 hover:text-textPrimary'}`}
              title="Emoji"
              type="button"
            >
                      <EmojiIcon size={16} />
            </button>
            {/* Full Emoji Picker - positioned relative to emoji button */}
            {showEmojiPicker && (
                      <div className="absolute top-full left-0 mt-1 z-20 shadow-2xl">
                <EmojiPicker
                  onEmojiClick={handleEmojiClick}
                  width={400}
                  height={500}
                  previewConfig={{ showPreview: true }}
                  skinTonesDisabled
                  theme={Theme.DARK}
                  searchPlaceHolder="Search emojis"
                  autoFocusSearch={false}
                  lazyLoadEmojis={true}
                />
              </div>
            )}
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
                    className={`p-1.5 rounded-lg transition-all duration-200 active:scale-95 ${theme === 'dark' ? 'text-white/70 hover:bg-white/10 hover:text-white' : 'text-textMuted hover:bg-backgroundElevated/60 hover:text-textPrimary'}`}
            title="Add Image"
            type="button"
            disabled={isUploadingImage}
          >
                    <ImageIcon size={16} />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageSelect}
            className="hidden"
          />
          <button
            onClick={() => {
              setShowSchedulePicker(!showSchedulePicker);
              setShowEmojiPicker(false);
            }}
                    className={`p-1.5 rounded-lg transition-all duration-200 active:scale-95 ${
                      isScheduled 
                        ? 'text-primary bg-primary/10' 
                        : theme === 'dark' 
                          ? 'text-white/70 hover:bg-white/10 hover:text-white' 
                          : 'text-textMuted hover:bg-backgroundElevated/60 hover:text-textPrimary'
            }`}
            title={isScheduled ? `Scheduled: ${formatScheduleTime(scheduledAt!)}` : 'Schedule Post'}
            type="button"
          >
                    <CalendarIcon size={16} />
          </button>
                </div>
        </div>

              {/* Character count and Post button */}
              <div className="flex items-center gap-3">
                <span
                  className={`text-xs font-medium ${
                    remaining < 20 ? 'text-warning' : theme === 'dark' ? 'text-white/70' : 'text-textMuted'
                  }`}
                >
                  {remaining}
                </span>
                
                {/* Compact Post button with Reach selector */}
                <div ref={reachMenuRef} className="relative flex items-center">
                  <div className={`flex items-center rounded-full overflow-hidden border ${theme === 'dark' ? 'border-white/20' : 'border-border/40'} shadow-sm`}>
                    {/* Reach mode selector */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowReachMenu(!showReachMenu);
                      }}
                      className={`px-2.5 py-1.5 text-xs font-medium transition-all duration-200 flex items-center gap-1 border-r ${theme === 'dark' ? 'border-white/20' : 'border-border/40'} ${
                        canPost && !isUploadingImage
                          ? reachMode === 'tuned'
                            ? 'bg-primary/10 text-primary hover:bg-primary/20'
                            : 'bg-accent/10 text-accent hover:bg-accent/20'
                          : theme === 'dark' ? 'bg-white/5 text-white/50' : 'bg-backgroundElevated/30 text-textMuted'
                      }`}
                      type="button"
                      disabled={!canPost || isUploadingImage}
                    >
                      <span className="text-[10px]">{reachMode === 'tuned' ? 'Tuned' : 'All'}</span>
                      <svg
                        className={`w-2.5 h-2.5 transition-transform ${showReachMenu ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    
                    {/* Post button */}
                    <button
                      onClick={handlePost}
                      disabled={!canPost || isUploadingImage}
                      className={`px-4 py-1.5 text-sm font-semibold transition-all duration-200 ${
                        canPost && !isUploadingImage
                          ? reachMode === 'tuned'
                            ? 'bg-gradient-to-r from-primary to-accent text-white hover:from-primaryHover hover:to-accentHover active:scale-[0.98]'
                            : 'bg-accent text-white hover:bg-accentHover active:scale-[0.98]'
                          : theme === 'dark' ? 'bg-white/10 text-white/50 cursor-not-allowed' : 'bg-backgroundElevated/50 text-textMuted cursor-not-allowed'
                      }`}
                    >
                      {isPosting ? (
                        <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      ) : isUploadingImage ? (
                        <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      ) : (
                        'Post'
                      )}
                    </button>
                  </div>

                  {/* Reach mode dropdown menu */}
                  {showReachMenu && (
                    <div className={`absolute bottom-full right-0 mb-2 ${theme === 'dark' ? 'bg-black/95 border-white/20' : 'bg-backgroundElevated border-border/60'} rounded-xl border shadow-2xl z-30 min-w-[160px] overflow-hidden`}>
                      <button
                        onClick={() => {
                          setReachMode('forAll');
                          setShowReachMenu(false);
                        }}
                        className={`w-full px-4 py-3 text-left text-sm font-medium transition-colors flex items-center gap-2 ${
                          reachMode === 'forAll'
                            ? 'bg-accent/10 text-accent'
                            : theme === 'dark' ? 'text-white hover:bg-white/10' : 'text-textPrimary hover:bg-backgroundElevated/70'
                        }`}
                        type="button"
                      >
                        <div className="flex-1">
                          <div className={`font-semibold ${theme === 'dark' ? 'text-white' : ''}`}>For All</div>
                          <div className={`text-xs ${theme === 'dark' ? 'text-white/70' : 'text-textMuted'}`}>Public post</div>
                        </div>
                        {reachMode === 'forAll' && (
                          <svg className="w-4 h-4 text-accent" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </button>
                      <button
                        onClick={() => {
                          setReachMode('tuned');
                          setShowReachMenu(false);
                        }}
                        className={`w-full px-4 py-3 text-left text-sm font-medium transition-colors flex items-center gap-2 border-t ${theme === 'dark' ? 'border-white/10' : 'border-border/40'} ${
                          reachMode === 'tuned'
                            ? 'bg-primary/10 text-primary'
                            : theme === 'dark' ? 'text-white hover:bg-white/10' : 'text-textPrimary hover:bg-backgroundElevated/70'
                        }`}
                        type="button"
                      >
                        <div className="flex-1">
                          <div className={`font-semibold ${theme === 'dark' ? 'text-white' : ''}`}>Tuned</div>
                          <div className={`text-xs ${theme === 'dark' ? 'text-white/70' : 'text-textMuted'}`}>AI-optimized</div>
                        </div>
                        {reachMode === 'tuned' && (
                          <svg className="w-4 h-4 text-primary" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

        {/* Schedule Picker Modal */}
        {showSchedulePicker && (
          <>
            {/* Backdrop */}
            <div 
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-30"
              onClick={() => setShowSchedulePicker(false)}
            />
            {/* Modal */}
            <div className="fixed inset-0 flex items-center justify-center z-40 p-4">
              <div 
                className={`${theme === 'dark' ? 'bg-black/95 border-white/20' : 'bg-backgroundElevated border-border/60'} rounded-2xl border shadow-2xl w-full max-w-2xl overflow-hidden`}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div className={`px-6 py-4 border-b ${theme === 'dark' ? 'border-white/10' : 'border-border/40'}`}>
                  <h3 className={`text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`}>Pick date & time</h3>
                </div>
                
                {/* Content: Calendar + Date/Time Inputs */}
                <div className="flex flex-col md:flex-row">
                  {/* Calendar (Left Side) */}
                  <div className={`flex-1 p-4 border-b md:border-b-0 md:border-r ${theme === 'dark' ? 'border-white/10' : 'border-border/40'}`}>
                    <DatePicker
                      selected={scheduledAt ?? null}
                      onChange={(date: Date | null) => {
                        if (date) {
                          // Preserve time if already set, otherwise use current time
                          if (scheduledAt) {
                            const newDate = new Date(date);
                            newDate.setHours(scheduledAt.getHours());
                            newDate.setMinutes(scheduledAt.getMinutes());
                            setScheduledAt(newDate);
                          } else {
                            // Use current time if no time set yet
                            const now = new Date();
                            const newDate = new Date(date);
                            newDate.setHours(now.getHours());
                            newDate.setMinutes(Math.ceil(now.getMinutes() / 15) * 15); // Round to nearest 15 min
                            setScheduledAt(newDate);
                          }
                        } else {
                          setScheduledAt(null);
                        }
                      }}
                      inline
                      minDate={new Date()}
                      calendarStartDay={1}
                      className="text-sm w-full"
                      calendarClassName="schedule-calendar"
                      wrapperClassName="w-full"
                    />
                  </div>
                  
                  {/* Time Input (Right Side) */}
                  <div className="flex-1 p-6 flex flex-col gap-4">
                    {/* Time Input */}
                    <div>
                      <label className={`block text-xs font-medium ${theme === 'dark' ? 'text-white/70' : 'text-textMuted'} mb-2`}>
                        Time
                      </label>
                      <DatePicker
                        selected={scheduledAt ?? null}
                        onChange={(date: Date | null) => {
                          if (date) {
                            // If we have a date from calendar, preserve it
                            if (scheduledAt) {
                              const newDate = new Date(scheduledAt);
                              newDate.setHours(date.getHours());
                              newDate.setMinutes(date.getMinutes());
                              setScheduledAt(newDate);
                            } else {
                              // If no date selected yet, use today with selected time
                              const today = new Date();
                              today.setHours(date.getHours());
                              today.setMinutes(date.getMinutes());
                              setScheduledAt(today);
                            }
                          } else {
                            setScheduledAt(null);
                          }
                        }}
                        showTimeSelect
                        showTimeSelectOnly
                        timeIntervals={15}
                        timeCaption="Time"
                        dateFormat="h:mm aa"
                        className={`w-full px-3 py-2 ${theme === 'dark' ? 'bg-white/5 border-white/20 text-white' : 'bg-card/40 border-border/60 text-textPrimary'} rounded-lg text-sm focus:ring-2 focus:ring-accent/30 focus:border-accent/60 outline-none`}
                        calendarClassName="schedule-calendar"
                      />
                    </div>
                    
                    {/* Selected Date/Time Display */}
                    {isScheduled && scheduledAt && (
                      <div className={`mt-2 px-3 py-2 rounded-lg bg-accent/10 ${theme === 'dark' ? 'text-white border-accent/20' : 'text-textPrimary border-accent/20'} border`}>
                        <div className={`font-medium mb-1 ${theme === 'dark' ? 'text-white' : ''}`}>Scheduled for:</div>
                        <div className={theme === 'dark' ? 'text-white/70' : 'text-textMuted'}>
                          {scheduledAt.toLocaleString(undefined, { 
                            weekday: 'long', 
                            month: 'long', 
                            day: 'numeric', 
                            year: 'numeric',
                            hour: 'numeric', 
                            minute: '2-digit' 
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Footer with Action Buttons */}
                <div className={`px-6 py-4 border-t ${theme === 'dark' ? 'border-white/10' : 'border-border/40'} flex items-center justify-end gap-3`}>
                  <button
                    onClick={() => {
                      setScheduledAt(null);
                      setShowSchedulePicker(false);
                    }}
                    className={`px-4 py-2 text-sm font-medium transition-colors ${theme === 'dark' ? 'text-white/70 hover:text-white' : 'text-textMuted hover:text-textPrimary'}`}
                    type="button"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      if (scheduledAt && scheduledAt > new Date()) {
                        setShowSchedulePicker(false);
                      }
                    }}
                    disabled={!scheduledAt || scheduledAt <= new Date()}
                    className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
                      scheduledAt && scheduledAt > new Date()
                        ? 'bg-accent text-white hover:bg-accentHover active:scale-95'
                        : theme === 'dark' ? 'bg-white/10 text-white/50 cursor-not-allowed' : 'bg-backgroundElevated/50 text-textMuted cursor-not-allowed'
                    }`}
                    type="button"
                  >
                    Schedule Post
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Image Preview */}
        {(imagePreview || imageUrl) && (
          <div className="mt-3 px-4 pb-3 relative">
                <div className={`rounded-xl overflow-hidden border ${theme === 'dark' ? 'border-white/20' : 'border-border/40'} relative group`}>
              <img
                src={imagePreview || imageUrl}
                alt="Post attachment"
                    className="w-full max-h-64 object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
              <button
                onClick={handleRemoveImage}
                className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                type="button"
              >
                ✕
              </button>
            {isUploadingImage && (
                    <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                <div className="text-white text-sm">Uploading...</div>
              </div>
            )}
          </div>
      </div>
            )}
      
      {/* AI Suggestions for Tuned Mode */}
      {reachMode === 'tuned' && plainText.trim() && plainText.trim().length > 10 && (
        <>
          {/* Error message for AI issues */}
          {aiError && (
                  <div className="px-4 pb-3">
                    <div className="p-3 bg-warning/10 border border-warning/30 rounded-lg text-warning text-xs font-medium">
              {aiError}
                    </div>
            </div>
          )}
          
          {showSuggestion && suggestion && suggestion.suggestedTopics.length > 0 && (
                  <div className="px-4 pb-3">
            <TopicSuggestionBox
              suggestedTopics={suggestion.suggestedTopics}
              selectedTopic={selectedTopic}
              onTopicSelect={handleTopicSelect}
              tunedAudience={tunedAudience}
              onAudienceChange={handleAudienceChange}
              overallExplanation={suggestion.overallExplanation || suggestion.explanation}
              onApply={handleApplySuggestion}
              onIgnore={handleIgnoreSuggestion}
              allTopics={allTopicNames}
            />
                  </div>
          )}
        </>
      )}

        {/* Manual reach settings - only show if not using AI suggestions */}
        {reachMode === 'tuned' && !showSuggestion && selectedTopic && (
          <div className={`px-4 pb-3 pt-2 border-t ${theme === 'dark' ? 'border-white/10' : 'border-border/30'}`}>
                <div className="flex items-center gap-4 text-xs">
                  <label className={`flex items-center gap-1.5 ${theme === 'dark' ? 'text-white/70' : 'text-textMuted'}`}>
              <input
                type="checkbox"
                checked={tunedAudience.allowFollowers}
                onChange={(e) =>
                  setTunedAudience({ ...tunedAudience, allowFollowers: e.target.checked })
                }
                className="rounded"
              />
              Followers
            </label>
                  <label className={`flex items-center gap-1.5 ${theme === 'dark' ? 'text-white/70' : 'text-textMuted'}`}>
              <input
                type="checkbox"
                checked={tunedAudience.allowNonFollowers}
                onChange={(e) =>
                  setTunedAudience({ ...tunedAudience, allowNonFollowers: e.target.checked })
                }
                className="rounded"
              />
              Non-followers
            </label>
                </div>
          </div>
        )}
            </div>
    </div>
  );
};

export default Composer;
