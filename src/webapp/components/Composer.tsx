import { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  ALL_TOPICS,
  isValidTopic,
  type Topic,
  type ReachMode,
  type TunedAudience,
  type Chirp,
  type TopicMetadata,
  type User,
} from '../types';
import { useFeedStore } from '../store/useFeedStore';
import { useUserStore } from '../store/useUserStore';
import { useTopicStore } from '../store/useTopicStore';
import { useThemeStore } from '../store/useThemeStore';
import { getReachAgent } from '../lib/agents/reachAgent';
import { topicService, userService } from '../lib/firestore';
import { extractMentionHandles } from '../lib/utils/mentions';
import { BaseAgent } from '../lib/agents/baseAgent';
import type { ReachSuggestion } from '../lib/agents/reachAgent';
import { mapSemanticTopicToBucket, ensureBucket, getAllBuckets } from '../lib/services/topicBucketService';
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

  // Drag state
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Mention state
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionResults, setMentionResults] = useState<User[]>([]);
  const [showMentionList, setShowMentionList] = useState(false);
  const [mentionListPosition, setMentionListPosition] = useState<{ top: number; left: number } | null>(null);
  const mentionSearchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mentionedUsersRef = useRef<Map<string, string>>(new Map()); // handle -> id

  // Ref to track if a request is in flight and prevent duplicate calls
  const requestInFlight = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contentEditableRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const reachMenuRef = useRef<HTMLDivElement>(null);
  const availableTopicsRef = useRef<TopicMetadata[]>([]);
  const composerRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const emojiButtonRef = useRef<HTMLButtonElement>(null);
  const [emojiPickerPosition, setEmojiPickerPosition] = useState<{ top: number; left: number } | null>(null);

  const { addChirp } = useFeedStore();
  const { currentUser, getUser } = useUserStore();
  const { loadTopicsForUser, allTopics, isLoading: topicsLoading } = useTopicStore();
  const { hideComposer, quotedChirp } = useComposer();
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

    // Check for mention trigger
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      if (range.startContainer.nodeType === Node.TEXT_NODE) {
        const textBefore = range.startContainer.textContent?.slice(0, range.startOffset) || '';
        // Match @username at end of string
        const match = textBefore.match(/@(\w*)$/);
        if (match) {
          setMentionQuery(match[1]);
          
          // Calculate position for floating mention list
          if (contentEditableRef.current) {
            const rect = contentEditableRef.current.getBoundingClientRect();
            const selectionRect = range.getBoundingClientRect();
            
            // Calculate position above the input, aligned with cursor
            let left = Math.min(rect.left, selectionRect.left);
            const dropdownWidth = 256; // w-64 = 256px
            
            // Ensure dropdown doesn't go off-screen to the right
            if (left + dropdownWidth > window.innerWidth) {
              left = window.innerWidth - dropdownWidth - 16; // 16px padding from edge
            }
            
            // Ensure dropdown doesn't go off-screen to the left
            if (left < 16) {
              left = 16;
            }
            
            setMentionListPosition({
              top: rect.top - 8, // 8px above input (mb-2 = 8px)
              left: left,
            });
          }
        } else {
          setMentionQuery(null);
          setMentionListPosition(null);
        }
      } else {
        setMentionQuery(null);
        setMentionListPosition(null);
      }
    } else {
      setMentionQuery(null);
      setMentionListPosition(null);
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

  // Search users when mention query changes
  useEffect(() => {
    if (mentionQuery === null) {
      setMentionResults([]);
      setShowMentionList(false);
      setMentionListPosition(null);
      return;
    }

    if (mentionSearchTimeoutRef.current) {
      clearTimeout(mentionSearchTimeoutRef.current);
    }

    // Instant for empty query (to show suggestions immediately), debounce for text
    const delay = mentionQuery.length === 0 ? 0 : 300;

    mentionSearchTimeoutRef.current = setTimeout(async () => {
      // searchUsers now handles empty queries by returning recent users
      // For non-empty queries, it uses hybrid search (handle + name matching)
      const results = await userService.searchUsers(mentionQuery, 8); // Get 8 results for better UX
      
      // Filter out current user
      const filtered = results.filter(u => u.id !== currentUser?.id);
      
      setMentionResults(filtered);
      setShowMentionList(filtered.length > 0);
      
      // Update position when results change (in case input moved)
      if (contentEditableRef.current && filtered.length > 0) {
        const rect = contentEditableRef.current.getBoundingClientRect();
        const selection = window.getSelection();
        let left = rect.left;
        
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          const selectionRect = range.getBoundingClientRect();
          left = Math.min(rect.left, selectionRect.left);
        }
        
        const dropdownWidth = 256; // w-64 = 256px
        
        // Ensure dropdown doesn't go off-screen to the right
        if (left + dropdownWidth > window.innerWidth) {
          left = window.innerWidth - dropdownWidth - 16; // 16px padding from edge
        }
        
        // Ensure dropdown doesn't go off-screen to the left
        if (left < 16) {
          left = 16;
        }
        
        setMentionListPosition({
          top: rect.top - 8,
          left: left,
        });
      }
    }, delay);

    return () => {
      if (mentionSearchTimeoutRef.current) {
        clearTimeout(mentionSearchTimeoutRef.current);
      }
    };
  }, [mentionQuery, currentUser]);

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

  // Load saved position from localStorage on mount
  useEffect(() => {
    const savedPosition = localStorage.getItem('composerPosition');
    if (savedPosition) {
      try {
        const { x, y } = JSON.parse(savedPosition);
        // Validate position is within viewport (with some tolerance)
        const composerWidth = 672; // max-w-2xl = 672px
        const composerHeight = 400; // estimated height
        const maxX = window.innerWidth - composerWidth;
        const maxY = window.innerHeight - composerHeight;
        
        // Only use saved position if it's valid
        if (x >= -100 && x <= maxX + 100 && y >= -100 && y <= maxY + 100) {
          const constrainedX = Math.max(0, Math.min(x, maxX));
          const constrainedY = Math.max(0, Math.min(y, maxY));
          setPosition({ x: constrainedX, y: constrainedY });
        }
      } catch (error) {
        console.error('Error loading composer position:', error);
      }
    }
  }, []);

  // Save position to localStorage whenever it changes (but not while dragging)
  useEffect(() => {
    if (!isDragging && position) {
      localStorage.setItem('composerPosition', JSON.stringify(position));
    }
  }, [position, isDragging]);

  // Update emoji picker position on scroll/resize when open
  useEffect(() => {
    if (!showEmojiPicker || !emojiButtonRef.current || !emojiPickerPosition) return;

    const updatePosition = () => {
      if (!emojiButtonRef.current) return;
      
      const rect = emojiButtonRef.current.getBoundingClientRect();
      const pickerWidth = 400;
      const pickerHeight = 500;
      const spacing = 8;
      
      let top = rect.bottom + spacing;
      let left = rect.left;
      
      if (left + pickerWidth > window.innerWidth - 16) {
        left = window.innerWidth - pickerWidth - 16;
      }
      
      if (left < 16) {
        left = 16;
      }
      
      if (top + pickerHeight > window.innerHeight - 16) {
        top = rect.top - pickerHeight - spacing;
        if (top < 16) {
          top = 16;
        }
      }
      
      setEmojiPickerPosition({ top, left });
    };

    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);

    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [showEmojiPicker, emojiPickerPosition]);

  // Handle mouse move and mouse up for dragging
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      e.preventDefault();
      
      const newX = e.clientX - dragOffset.x;
      const newY = e.clientY - dragOffset.y;
      
      // Constrain to viewport bounds
      const composerWidth = composerRef.current?.offsetWidth || 672; // max-w-2xl = 672px
      const composerHeight = composerRef.current?.offsetHeight || 400;
      const maxX = window.innerWidth - composerWidth;
      const maxY = window.innerHeight - composerHeight;
      
      const constrainedX = Math.max(0, Math.min(newX, maxX));
      const constrainedY = Math.max(0, Math.min(newY, maxY));
      
      setPosition({ x: constrainedX, y: constrainedY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove, { passive: false });
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset]);

  // Drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    // Don't start dragging if clicking on interactive elements
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('input') || target.closest('[contenteditable]')) {
      return;
    }

    if (!composerRef.current) return;

    e.preventDefault(); // Prevent text selection

    const rect = composerRef.current.getBoundingClientRect();
    const currentX = position?.x ?? rect.left;
    const currentY = position?.y ?? rect.top;
    
    const offsetX = e.clientX - currentX;
    const offsetY = e.clientY - currentY;

    setDragOffset({ x: offsetX, y: offsetY });
    
    // Initialize position if not set
    if (!position) {
      setPosition({ x: rect.left, y: rect.top });
    }
    
    setIsDragging(true);
  };

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

  const handleMentionSelect = (user: User) => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    
    const range = selection.getRangeAt(0);
    const textNode = range.startContainer;
    
    if (textNode.nodeType === Node.TEXT_NODE && textNode.textContent) {
      const textBefore = textNode.textContent.slice(0, range.startOffset);
      const textAfter = textNode.textContent.slice(range.startOffset);
      
      const match = textBefore.match(/@(\w*)$/);
      if (match) {
        // We need to replace the text node with HTML structure to support highlighting
        // This is tricky in contentEditable. 
        // Strategy: 
        // 1. Split text node at start of mention
        // 2. Insert mention span
        // 3. Insert remaining text as new text node
        
        const start = match.index!;
        const mentionText = `@${user.handle}`;
        
        // Create elements
        const beforeNode = document.createTextNode(textBefore.slice(0, start));
        const afterNode = document.createTextNode('\u00A0' + textAfter); // Add non-breaking space after
        
        const mentionSpan = document.createElement('span');
        mentionSpan.className = 'text-accent font-medium'; // Use Tailwind text-accent for theme color
        mentionSpan.textContent = mentionText;
        mentionSpan.dataset.mention = user.handle;
        
        // Replace the original text node
        const parent = textNode.parentNode;
        if (parent) {
          parent.replaceChild(afterNode, textNode);
          parent.insertBefore(mentionSpan, afterNode);
          parent.insertBefore(beforeNode, mentionSpan);
          
          // Set cursor after the inserted mention (start of afterNode)
          try {
            const newRange = document.createRange();
            newRange.setStart(afterNode, 1); // After the space
            newRange.collapse(true);
            selection.removeAllRanges();
            selection.addRange(newRange);
          } catch (e) {
            console.error('Cursor set failed', e);
          }
        }
        
        mentionedUsersRef.current.set(user.handle, user.id);
      }
    }
    
    setMentionQuery(null);
    setShowMentionList(false);
    handleContentChange();
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
      let bucketFromAI: Topic | null = null;
      let analysisTimestamp: Date | undefined;

      // Show analyzing modal during AI analysis
      if (reachAgent && plainTextContent.trim().length >= 4) {
        setIsGeneratingSuggestion(true);
        try {
          // Get all existing buckets to pass to AI for better suggestions
          const existingBuckets = await getAllBuckets();
          const analysis = await reachAgent.analyzePostContent(
            plainTextContent.trim(),
            availableTopicsForAnalysis,
            existingBuckets
          );
          semanticTopics = analysis.semanticTopics || [];
          entities = analysis.entities || [];
          intentValue = analysis.intent;
          // Sanitize AI's suggested bucket (remove # prefix and normalize)
          const rawBucket = analysis.suggestedBucket;
          if (rawBucket) {
            const sanitized = rawBucket.trim().replace(/^#+/, '').toLowerCase();
            bucketFromAI = isValidTopic(sanitized) ? (sanitized as Topic) : null;
          } else {
            bucketFromAI = null;
          }
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

      // Process mentions
      const handles = extractMentionHandles(trimmedContent);
      const mentionIds = new Set<string>();
      
      for (const handle of handles) {
        if (mentionedUsersRef.current.has(handle)) {
          mentionIds.add(mentionedUsersRef.current.get(handle)!);
        } else {
          // Try to find in current results
          const cachedUser = mentionResults.find(u => u.handle === handle);
          if (cachedUser) {
            mentionIds.add(cachedUser.id);
          } else {
            // Try direct lookup for manually typed mentions (limit to 3 to avoid delay)
            if (handles.length <= 3) {
              const user = await userService.getUserByHandle(handle);
              if (user) mentionIds.add(user.id);
            }
          }
        }
      }
      const mentions = Array.from(mentionIds);

      semanticTopics = normalizeSemanticTopics(semanticTopics);

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
        (selectedTopic && isValidTopic(selectedTopic) ? selectedTopic : null) ||
        (bucketFromAI && isValidTopic(bucketFromAI) ? bucketFromAI : null) ||
        (userTopics.find((topic) => isValidTopic(topic)) as Topic | undefined) ||
        'dev';

      // Ensure the resolved topic bucket exists (important for dynamic buckets)
      if (resolvedTopic && isValidTopic(resolvedTopic)) {
        await ensureBucket(resolvedTopic).catch((error) => {
          console.warn('[Composer] Failed to ensure bucket exists:', resolvedTopic, error);
          // Continue anyway - bucket might already exist or will be created on next post
        });
      }

      // Create new chirp (will be persisted to Firestore)
      const contentEmbedding = trimmedContent ? await tryGenerateEmbedding(trimmedContent) : undefined;

      const chirpData: Omit<Chirp, 'id' | 'createdAt' | 'commentCount'> = {
        authorId: currentUser.id,
        text: trimmedContent,
        topic: resolvedTopic,
        reachMode,
        tunedAudience: reachMode === 'tuned' ? tunedAudience : undefined,
        contentEmbedding: contentEmbedding,
        mentions: mentions.length > 0 ? mentions : undefined,
        quotedChirpId: quotedChirp?.id,
      };

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

  const quotedAuthor = quotedChirp ? getUser(quotedChirp.authorId) : null;

  // Calculate position style
  const positionStyle = position
    ? { left: `${position.x}px`, top: `${position.y}px`, transform: 'none' }
    : { bottom: '1.5rem', left: '50%', transform: 'translateX(-50%)' };

  return (
    <>
    <div 
      ref={composerRef}
      className="fixed z-[100] w-[calc(100%-3rem)] max-w-2xl"
      style={{ position: 'fixed', ...positionStyle }}
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
        {/* Compact Header with Profile - Draggable */}
        <div 
          ref={headerRef}
          onMouseDown={handleMouseDown}
          className={`relative flex items-center gap-3 px-5 pt-4 pb-3 border-b ${theme === 'dark' ? 'border-white/10 bg-black/40' : 'border-white/40 bg-white/70'} ${isDragging ? 'cursor-grabbing' : 'cursor-grab'} select-none backdrop-blur shadow-inner rounded-t-3xl`}
        >
          <div className="absolute inset-x-1/2 top-2 h-1.5 -translate-x-1/2 rounded-full bg-white/40 opacity-60" />
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
                className={`w-full rounded-2xl border px-5 py-4 text-sm outline-none transition-all duration-200 resize-none min-h-[80px] max-h-[220px] overflow-y-auto ${theme === 'dark' ? 'bg-gradient-to-br from-black/70 to-black/50 border-white/10 text-white shadow-[0_8px_24px_rgba(0,0,0,0.35)] focus:border-accent/60 focus:ring-2 focus:ring-accent/30 placeholder:text-white/60' : 'bg-white/90 border-primary/30 text-textPrimary shadow-[0_12px_30px_rgba(15,23,42,0.12)] focus:border-primary/60 focus:ring-2 focus:ring-primary/30 placeholder:text-textMuted'}`}
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
          /* Ensure mention spans maintain styling in contenteditable */
          [contenteditable] span[data-mention] {
            color: hsl(var(--color-accent)) !important;
            font-weight: 500;
          }
          /* Fallback for when tailwind classes might not apply in shadow dom or specific contexts */
          .text-accent {
            color: hsl(var(--color-accent));
          }
          .schedule-calendar {
            background-color: transparent !important;
            color: ${theme === 'dark' ? 'rgb(249 250 251)' : 'rgb(15 23 42)'};
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
            border-bottom: 1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.1)'};
            padding: 0.75rem 0.5rem;
          }
          .schedule-calendar .react-datepicker__current-month {
            color: ${theme === 'dark' ? 'rgb(249 250 251)' : 'rgb(15 23 42)'};
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
            color: ${theme === 'dark' ? 'rgb(156 163 175)' : 'rgb(100 116 139)'};
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
            color: ${theme === 'dark' ? 'rgb(249 250 251)' : 'rgb(15 23 42)'};
            width: 2.25rem;
            height: 2.25rem;
            line-height: 2.25rem;
            margin: 0.125rem;
            border-radius: 0.5rem;
            font-size: 0.875rem;
            transition: all 0.2s ease;
          }
          .schedule-calendar .react-datepicker__day:hover {
            background-color: ${theme === 'dark' ? 'rgba(99, 102, 241, 0.2)' : 'rgba(99, 102, 241, 0.1)'};
            border-radius: 0.5rem;
            transform: scale(1.05);
          }
          .schedule-calendar .react-datepicker__day--selected,
          .schedule-calendar .react-datepicker__day--keyboard-selected {
            background: ${theme === 'dark' ? 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)' : 'linear-gradient(135deg, #6366f1 0%, #3b82f6 100%)'} !important;
            color: white !important;
            border-radius: 0.5rem;
            font-weight: 600;
            box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);
          }
          .schedule-calendar .react-datepicker__day--today {
            border: 2px solid ${theme === 'dark' ? '#6366f1' : '#3b82f6'};
            border-radius: 0.5rem;
            font-weight: 600;
            background-color: ${theme === 'dark' ? 'rgba(99, 102, 241, 0.1)' : 'rgba(59, 130, 246, 0.1)'};
          }
          .schedule-calendar .react-datepicker__day--outside-month {
            color: ${theme === 'dark' ? 'rgba(156, 163, 175, 0.4)' : 'rgba(100, 116, 139, 0.4)'};
          }
          .schedule-calendar .react-datepicker__navigation {
            top: 0.75rem;
            width: 1.5rem;
            height: 1.5rem;
            border-radius: 0.375rem;
            transition: all 0.2s ease;
          }
          .schedule-calendar .react-datepicker__navigation:hover {
            background-color: ${theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.05)'};
          }
          .schedule-calendar .react-datepicker__navigation-icon::before {
            border-color: ${theme === 'dark' ? 'rgb(156 163 175)' : 'rgb(100 116 139)'};
            border-width: 2px 2px 0 0;
          }
          .schedule-calendar .react-datepicker__navigation:hover *::before {
            border-color: ${theme === 'dark' ? '#6366f1' : '#3b82f6'};
          }
          .schedule-calendar .react-datepicker__time-container {
            border-left: 1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.1)'};
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
            border-radius: 0.5rem;
            margin: 0.125rem 0;
            color: ${theme === 'dark' ? 'rgb(249 250 251)' : 'rgb(15 23 42)'};
            transition: all 0.2s ease;
          }
          .schedule-calendar .react-datepicker__time-list-item:hover {
            background-color: ${theme === 'dark' ? 'rgba(99, 102, 241, 0.2)' : 'rgba(99, 102, 241, 0.1)'};
            transform: translateX(4px);
          }
          .schedule-calendar .react-datepicker__time-list-item--selected {
            background: ${theme === 'dark' ? 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)' : 'linear-gradient(135deg, #6366f1 0%, #3b82f6 100%)'} !important;
            color: white !important;
            font-weight: 600;
            box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
          }
          .schedule-calendar .react-datepicker-time__header {
            color: ${theme === 'dark' ? 'rgb(249 250 251)' : 'rgb(15 23 42)'};
            font-weight: 600;
            font-size: 0.75rem;
          }
          .schedule-calendar input {
            background-color: ${theme === 'dark' ? 'rgba(30, 30, 40, 0.6)' : 'rgba(249, 250, 251, 0.8)'};
            border: 1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.1)'};
            color: ${theme === 'dark' ? 'rgb(249 250 251)' : 'rgb(15 23 42)'};
            border-radius: 0.5rem;
            transition: all 0.2s ease;
          }
          .schedule-calendar input:focus {
            outline: none;
            border-color: ${theme === 'dark' ? '#6366f1' : '#3b82f6'};
            box-shadow: 0 0 0 3px ${theme === 'dark' ? 'rgba(99, 102, 241, 0.2)' : 'rgba(59, 130, 246, 0.2)'};
          }
        `}</style>
            </div>

            {/* Quote Preview */}
            {quotedChirp && quotedAuthor && (
              <div className="mt-3 px-4 pb-1">
                <div className={`rounded-xl border p-3 ${theme === 'dark' ? 'border-white/10 bg-white/5' : 'border-border/60 bg-backgroundElevated/30'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    {quotedAuthor.profilePictureUrl ? (
                      <img
                        src={quotedAuthor.profilePictureUrl}
                        alt={quotedAuthor.name}
                        className="w-5 h-5 rounded-full object-cover"
                      />
                    ) : (
                      <div className={`w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center`}>
                        <span className="text-primary font-bold text-[10px]">
                          {quotedAuthor.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center gap-1 overflow-hidden">
                      <span className={`text-xs font-semibold truncate ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`}>
                        {quotedAuthor.name}
                      </span>
                      <span className={`text-xs truncate ${theme === 'dark' ? 'text-white/50' : 'text-textMuted'}`}>
                        @{quotedAuthor.handle}
                      </span>
                    </div>
                  </div>
                  <p className={`text-xs line-clamp-3 ${theme === 'dark' ? 'text-white/80' : 'text-textSecondary'}`}>
                    {quotedChirp.text}
                  </p>
                </div>
              </div>
            )}
        
            {/* Compact Action Bar - Inline with input */
}
            <div className={`flex items-center justify-between mt-3 pt-3 border-t ${theme === 'dark' ? 'border-white/10' : 'border-border/30'}`}>
              <div className="flex items-center gap-2">
                {/* Formatting toolbar - Compact */}
                <div className={`formatting-toolbar flex items-center gap-1 rounded-full border px-2 py-1 ${theme === 'dark' ? 'border-white/10 bg-white/5' : 'border-border/40 bg-white/90 shadow-[0_6px_18px_rgba(15,23,42,0.08)]'}`}>
          <button
            onMouseDown={handleBold}
                    className={`p-1.5 rounded-lg transition-all duration-200 active:scale-95 ${
                      isBoldActive 
                        ? 'bg-gradient-to-r from-accent/50 to-accent/20 text-accent shadow-[0_10px_30px_rgba(16,185,129,0.25)]' 
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
                        ? 'bg-gradient-to-r from-accent/50 to-accent/20 text-accent shadow-[0_10px_30px_rgba(59,130,246,0.25)]' 
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
              ref={emojiButtonRef}
              onClick={() => {
                if (!showEmojiPicker && emojiButtonRef.current) {
                  // Calculate position when opening
                  const rect = emojiButtonRef.current.getBoundingClientRect();
                  const pickerWidth = 400;
                  const pickerHeight = 500;
                  const spacing = 8; // mt-2 = 8px
                  
                  // Position above the button (bottom of button to top of picker)
                  let top = rect.bottom + spacing;
                  let left = rect.left;
                  
                  // Adjust if picker would go off-screen to the right
                  if (left + pickerWidth > window.innerWidth - 16) {
                    left = window.innerWidth - pickerWidth - 16;
                  }
                  
                  // Adjust if picker would go off-screen to the left
                  if (left < 16) {
                    left = 16;
                  }
                  
                  // If picker would go off-screen at bottom, position above button instead
                  if (top + pickerHeight > window.innerHeight - 16) {
                    top = rect.top - pickerHeight - spacing;
                    // Ensure it doesn't go off-screen at top
                    if (top < 16) {
                      top = 16;
                    }
                  }
                  
                  setEmojiPickerPosition({ top, left });
                }
                setShowEmojiPicker(!showEmojiPicker);
                setShowSchedulePicker(false);
              }}
              className={`p-1.5 rounded-lg transition-all duration-200 active:scale-95 ${theme === 'dark' ? 'text-white/70 hover:bg-white/10 hover:text-white' : 'text-textMuted hover:bg-backgroundElevated/60 hover:text-textPrimary'}`}
              title="Emoji"
              type="button"
            >
              <EmojiIcon size={16} />
            </button>
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

                {/* Reach mode dropdown menu */}
                {showReachMenu && (
                  <>
                    {/* Backdrop for reach menu */}
                    <div 
                      className="fixed inset-0 z-[115]"
                      onClick={() => setShowReachMenu(false)}
                    />
                    <div className={`absolute bottom-full right-0 mb-2 z-[120] min-w-[200px] overflow-hidden rounded-2xl border backdrop-blur-xl shadow-[0_20px_60px_rgba(15,23,42,0.3)] transition-all duration-300 ease-out ${
                      showReachMenu 
                        ? 'opacity-100 scale-100 translate-y-0' 
                        : 'opacity-0 scale-95 translate-y-2'
                    } ${theme === 'dark' ? 'bg-black/95 border-white/20' : 'bg-white/95 border-border/40'}`}>
                      <button
                        onClick={() => {
                          setReachMode('forAll');
                          setShowReachMenu(false);
                        }}
                        className={`w-full px-4 py-3 text-left text-sm font-medium transition-all duration-200 flex items-center gap-3 hover:bg-opacity-50 ${
                          reachMode === 'forAll'
                            ? 'bg-accent/15 text-accent'
                            : theme === 'dark' ? 'text-white hover:bg-white/10' : 'text-textPrimary hover:bg-backgroundElevated/70'
                        }`}
                        type="button"
                      >
                        <div className="flex-1">
                          <div className={`font-semibold ${theme === 'dark' ? 'text-white' : ''}`}>For All</div>
                          <div className={`text-xs mt-0.5 ${theme === 'dark' ? 'text-white/70' : 'text-textMuted'}`}>Public post</div>
                        </div>
                        {reachMode === 'forAll' && (
                          <svg className="w-5 h-5 text-accent transition-transform duration-200" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </button>
                      <div className={`h-px ${theme === 'dark' ? 'bg-white/10' : 'bg-border/40'}`} />
                      <button
                        onClick={() => {
                          setReachMode('tuned');
                          setShowReachMenu(false);
                        }}
                        className={`w-full px-4 py-3 text-left text-sm font-medium transition-all duration-200 flex items-center gap-3 hover:bg-opacity-50 ${
                          reachMode === 'tuned'
                            ? 'bg-primary/15 text-primary'
                            : theme === 'dark' ? 'text-white hover:bg-white/10' : 'text-textPrimary hover:bg-backgroundElevated/70'
                        }`}
                        type="button"
                      >
                        <div className="flex-1">
                          <div className={`font-semibold ${theme === 'dark' ? 'text-white' : ''}`}>Tuned</div>
                          <div className={`text-xs mt-0.5 ${theme === 'dark' ? 'text-white/70' : 'text-textMuted'}`}>AI-optimized</div>
                        </div>
                        {reachMode === 'tuned' && (
                          <svg className="w-5 h-5 text-primary transition-transform duration-200" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </>
                )}
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
                <div ref={reachMenuRef} className={`relative flex items-center gap-3 rounded-full px-1.5 py-1 shadow-[0_14px_40px_rgba(15,23,42,0.15)] ${theme === 'dark' ? 'bg-black/60 border border-white/10' : 'bg-white/95 border border-border/60'}`}>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowReachMenu(!showReachMenu);
                    }}
                    className={`flex items-center gap-2 rounded-full px-3 py-1 text-[10px] font-semibold tracking-wider transition ${canPost && !isUploadingImage ? (reachMode === 'tuned' ? 'bg-gradient-to-r from-primary/20 to-accent/30 text-primary shadow-[0_6px_20px_rgba(244,114,182,0.25)]' : 'bg-accent/20 text-accent shadow-[0_6px_20px_rgba(59,130,246,0.15)]') : theme === 'dark' ? 'bg-white/5 text-white/50' : 'bg-backgroundElevated/60 text-textMuted'}`}
                    disabled={!canPost || isUploadingImage}
                  >
                    <span>{reachMode === 'tuned' ? 'TUNED' : 'ALL'}</span>
                    <svg
                      className={`w-2.5 h-2.5 transition-transform ${showReachMenu ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  <button
                    onClick={handlePost}
                    disabled={!canPost || isUploadingImage}
                    className={`px-4 py-1.5 text-sm font-semibold transition-all duration-200 rounded-full ${
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
              </div>
            </div>
          </div>

        {/* Schedule Picker Modal */}
        {showSchedulePicker && (
          <>
            {/* Backdrop with smooth animation */}
            <div 
              className={`fixed inset-0 z-[130] transition-all duration-300 ${
                showSchedulePicker 
                  ? 'bg-black/60 backdrop-blur-md opacity-100' 
                  : 'bg-black/0 backdrop-blur-0 opacity-0'
              }`}
              onClick={() => setShowSchedulePicker(false)}
            />
            {/* Modal with smooth enter animation */}
            <div className="fixed inset-0 flex items-center justify-center z-[140] p-4 pointer-events-none">
              <div 
                className={`${theme === 'dark' ? 'bg-black/95 border border-white/10' : 'bg-white/98 border border-border/40'} rounded-3xl shadow-[0_30px_80px_rgba(15,23,42,0.4)] w-full max-w-2xl overflow-hidden backdrop-blur-xl pointer-events-auto transition-all duration-300 ease-out ${
                  showSchedulePicker 
                    ? 'opacity-100 scale-100 translate-y-0' 
                    : 'opacity-0 scale-95 translate-y-4'
                }`}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div className={`px-6 py-4 border-b ${theme === 'dark' ? 'border-white/10' : 'border-border/40'} flex items-center justify-between`}>
                  <h3 className={`text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`}>Pick date & time</h3>
                  <button
                    onClick={() => setShowSchedulePicker(false)}
                    className={`p-1.5 rounded-lg transition-all duration-200 hover:scale-110 ${
                      theme === 'dark' 
                        ? 'text-white/70 hover:bg-white/10 hover:text-white' 
                        : 'text-textMuted hover:bg-backgroundElevated/60 hover:text-textPrimary'
                    }`}
                    aria-label="Close schedule picker"
                    type="button"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                
                {/* Content: Calendar + Date/Time Inputs */}
                <div className="flex flex-col md:flex-row gap-4 px-4 py-3">
                  {/* Calendar (Left Side) */}
                  <div className={`flex-1 rounded-2xl p-4 transition-shadow border ${theme === 'dark' ? 'border-white/10 bg-white/5 shadow-[0_10px_40px_rgba(255,255,255,0.08)]' : 'border-border/40 bg-white shadow-[0_10px_40px_rgba(15,23,42,0.08)]'}`}>
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
                  <div className={`flex-1 p-6 flex flex-col gap-4 rounded-2xl border ${theme === 'dark' ? 'border-white/10 bg-white/5 shadow-[0_8px_30px_rgba(255,255,255,0.08)]' : 'border-border/40 bg-white/90 shadow-[0_8px_30px_rgba(15,23,42,0.08)]'}`}>
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
                    className={`px-5 py-2.5 text-sm font-medium rounded-full transition-all duration-200 ${
                      theme === 'dark' 
                        ? 'text-white/70 hover:text-white hover:bg-white/10' 
                        : 'text-textMuted hover:text-textPrimary hover:bg-backgroundElevated/60'
                    }`}
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
                    className={`px-5 py-2.5 text-sm font-semibold rounded-full transition-all duration-200 ${
                      scheduledAt && scheduledAt > new Date()
                        ? 'bg-gradient-to-r from-accent to-accent/90 text-white hover:from-accentHover hover:to-accent shadow-[0_4px_14px_rgba(59,130,246,0.4)] active:scale-95'
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

        {/* Image Preview - 1:1 aspect ratio, full image visible, compact size */}
        {(imagePreview || imageUrl) && (
          <div className="mt-3 px-4 pb-3 relative">
            <div className={`rounded-2xl overflow-hidden border ${theme === 'dark' ? 'border-white/20 bg-black/40' : 'border-border/40 bg-gradient-to-br from-white to-gray-100'} aspect-square max-w-xs w-full mx-auto flex items-center justify-center relative group shadow-[0_15px_40px_rgba(15,23,42,0.35)]`}>
              <img
                src={imagePreview || imageUrl}
                alt="Post attachment"
                className="w-full h-full object-contain"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
              <button
                onClick={handleRemoveImage}
                className="absolute top-2 right-2 bg-black/70 hover:bg-black/80 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-all duration-200 shadow-lg"
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
    
    {/* Floating Mention Suggestions List - Fixed position, not constrained by composer layout */}
    {showMentionList && mentionResults.length > 0 && mentionListPosition && (
      <div 
        className={`fixed rounded-xl shadow-2xl border z-[200] ${
          theme === 'dark' ? 'bg-black/95 border-white/20' : 'bg-backgroundElevated border-border/60'
        }`}
        style={{
          top: `${mentionListPosition.top}px`,
          left: `${mentionListPosition.left}px`,
          width: '256px', // w-64 = 256px
          // Each item is approximately 60px (py-3 = 24px padding + ~36px content)
          // Show all items up to 6, then enable scroll
          maxHeight: `${Math.min(mentionResults.length, 6) * 60}px`,
          overflowY: mentionResults.length > 6 ? 'auto' : 'visible',
          transform: 'translateY(-100%)', // Position above the input
        }}
      >
        {mentionResults.map((user) => (
          <button
            key={user.id}
            onClick={() => handleMentionSelect(user)}
            className={`w-full px-4 py-3 text-left flex items-center gap-3 transition-colors border-b last:border-b-0 ${
              theme === 'dark' 
                ? 'hover:bg-white/10 text-white border-white/5' 
                : 'hover:bg-backgroundElevated/50 text-textPrimary border-border/30'
            }`}
          >
            {user.profilePictureUrl ? (
                <img src={user.profilePictureUrl} alt={user.name} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
            ) : (
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                    theme === 'dark' ? 'bg-white/10 text-white' : 'bg-primary/10 text-primary'
                }`}>
                    {user.name.charAt(0).toUpperCase()}
                </div>
            )}
            <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{user.name}</div>
                <div className={`text-xs truncate ${theme === 'dark' ? 'text-white/60' : 'text-textMuted'}`}>
                    @{user.handle}
                </div>
            </div>
          </button>
        ))}
      </div>
    )}
    
    {/* Emoji Picker Portal - Rendered outside Composer to avoid overflow clipping */}
    {showEmojiPicker && emojiPickerPosition && typeof document !== 'undefined' && createPortal(
      <>
        {/* Backdrop for emoji picker */}
        <div 
          className="fixed inset-0 z-[110]"
          onClick={() => setShowEmojiPicker(false)}
        />
        <div 
          className={`fixed z-[120] rounded-2xl overflow-hidden border shadow-[0_20px_60px_rgba(15,23,42,0.4)] backdrop-blur-xl transition-all duration-300 ease-out ${
            showEmojiPicker 
              ? 'opacity-100 scale-100 translate-y-0' 
              : 'opacity-0 scale-95 translate-y-2'
          } ${theme === 'dark' ? 'bg-black/95 border-white/20' : 'bg-white/95 border-border/40'}`}
          style={{
            top: `${emojiPickerPosition.top}px`,
            left: `${emojiPickerPosition.left}px`,
          }}
        >
          <div className="p-2">
            <EmojiPicker
              onEmojiClick={handleEmojiClick}
              width={400}
              height={500}
              previewConfig={{ showPreview: true }}
              skinTonesDisabled
              theme={theme === 'dark' ? Theme.DARK : Theme.LIGHT}
              searchPlaceHolder="Search emojis"
              autoFocusSearch={false}
              lazyLoadEmojis={true}
            />
          </div>
        </div>
      </>,
      document.body
    )}
    </>
  );
};

export default Composer;
