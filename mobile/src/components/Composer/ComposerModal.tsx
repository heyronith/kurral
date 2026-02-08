import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
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
import { useUserStore } from '../../stores/useUserStore';
import {
  ALL_TOPICS,
  ReachMode,
  Topic,
  TunedAudience,
  type Chirp,
} from '../../types';
import { useTheme } from '../../hooks/useTheme';
import { storageService } from '../../services/storageService';
import { extractMentionHandles, linkifyMentions } from '../../utils/mentions';
import { userService } from '../../services/userService';
import { tryGenerateEmbedding } from '../../services/embeddingService';
import {
  mapSemanticTopicToBucket,
  ensureBucket,
  getAllBuckets,
} from '../../services/topicBucketService';
import { topicService } from '../../services/topicService';
import { isValidTopic } from '../../types';
import { renderFormattedText } from '../../utils/formattedText';
import AudienceDescriptionBox from './AudienceDescriptionBox';

type MentionCandidate = {
  id: string;
  name: string;
  handle: string;
  profilePictureUrl?: string;
};

const CHAR_LIMIT = 280;

// Comprehensive emoji list organized by categories
const EMOJI_CATEGORIES = {
  'Smileys & People': [
    '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙',
    '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥',
    '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '🥵', '🥶', '😶‍🌫️', '😵', '😵‍💫', '🤯', '🤠', '🥳', '😎',
    '🤓', '🧐', '😕', '😟', '🙁', '😮', '😯', '😲', '😳', '🥺', '😦', '😧', '😨', '😰', '😥', '😢', '😭', '😱', '😖', '😣',
    '😞', '😓', '😩', '😫', '🥱', '😤', '😡', '😠', '🤬', '😈', '👿', '💀', '☠️', '💩', '🤡', '👹', '👺', '👻', '👽', '👾',
    '🤖', '😺', '😸', '😹', '😻', '😼', '😽', '🙀', '😿', '😾', '👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞',
    '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝',
    '🙏', '✍️', '💪', '🦾', '🦿', '🦵', '🦶', '👂', '🦻', '👃', '🧠', '🫀', '🫁', '🦷', '🦴', '👀', '👁️', '👅', '👄',
  ],
  'Animals & Nature': [
    '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐻‍❄️', '🐨', '🐯', '🦁', '🐮', '🐷', '🐽', '🐸', '🐵', '🙈', '🙉', '🙊',
    '🐒', '🐔', '🐧', '🐦', '🐤', '🐣', '🐥', '🦆', '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🐛', '🦋', '🐌', '🐞',
    '🐜', '🦟', '🦗', '🕷️', '🦂', '🐢', '🐍', '🦎', '🦖', '🦕', '🐙', '🦑', '🦐', '🦞', '🦀', '🐡', '🐠', '🐟', '🐬', '🐳',
    '🐋', '🦈', '🐊', '🐅', '🐆', '🦓', '🦍', '🦧', '🦣', '🐘', '🦛', '🦏', '🐪', '🐫', '🦒', '🦘', '🦬', '🐃', '🐂', '🐄',
    '🐎', '🐖', '🐏', '🐑', '🦙', '🐐', '🦌', '🐕', '🐩', '🦮', '🐕‍🦺', '🐈', '🐈‍⬛', '🪶', '🦅', '🦆', '🦢', '🦉', '🦤', '🪶',
    '🌲', '🌳', '🌴', '🌵', '🌶️', '🌾', '🌿', '☘️', '🍀', '🍁', '🍂', '🍃', '🌺', '🌻', '🌹', '🌷', '🌼', '🌸', '🌾', '🌱',
    '🌿', '🍃', '🍂', '🍁', '🍄', '🌰', '🪵', '🪨', '🌍', '🌎', '🌏', '🌑', '🌒', '🌓', '🌔', '🌕', '🌖', '🌗', '🌘', '🌙',
    '🌚', '🌛', '🌜', '🌝', '🌞', '⭐', '🌟', '🌠', '☀️', '⛅', '☁️', '⛈️', '🌤️', '🌥️', '🌦️', '🌧️', '🌨️', '🌩️', '🌪️', '🌫️',
    '🌬️', '🌀', '🌈', '☂️', '☔', '⛱️', '⚡', '❄️', '☃️', '⛄', '☄️', '🔥', '💧', '🌊',
  ],
  'Food & Drink': [
    '🍏', '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🍆', '🥑', '🥦',
    '🥬', '🥒', '🌶️', '🌽', '🥕', '🥔', '🍠', '🥐', '🥯', '🍞', '🥖', '🥨', '🧀', '🥚', '🍳', '🥞', '🥓', '🥩', '🍗', '🍖',
    '🦴', '🌭', '🍔', '🍟', '🍕', '🥪', '🥙', '🌮', '🌯', '🥗', '🥘', '🥫', '🍝', '🍜', '🍲', '🍛', '🍣', '🍱', '🥟', '🦪',
    '🍤', '🍙', '🍚', '🍘', '🍥', '🥠', '🥮', '🍢', '🍡', '🍧', '🍨', '🍦', '🥧', '🧁', '🍰', '🎂', '🍮', '🍭', '🍬', '🍫',
    '🍿', '🍩', '🍪', '🌰', '🥜', '🍯', '🥛', '🍼', '🫖', '☕', '🍵', '🧃', '🥤', '🧋', '🍶', '🍺', '🍻', '🥂', '🍷', '🥃',
    '🍸', '🍹', '🧉', '🍾', '🧊',
  ],
  'Activities': [
    '⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱', '🏓', '🏸', '🏒', '🏑', '🥍', '🏏', '🥅', '⛳', '🏹', '🎣',
    '🤿', '🥊', '🥋', '🎽', '🛹', '🛷', '⛸️', '🥌', '🎿', '⛷️', '🏂', '🪂', '🏋️', '🤼', '🤸', '⛹️', '🤺', '🤾', '🏌️', '🏇',
    '🧘', '🏄', '🏊', '🤽', '🚣', '🧗', '🚵', '🚴', '🏆', '🥇', '🥈', '🥉', '🏅', '🎖️', '🏵️', '🎗️', '🎫', '🎟️', '🎪', '🤹',
    '🎭', '🩰', '🎨', '🎬', '🎤', '🎧', '🎼', '🎹', '🥁', '🎷', '🎺', '🎸', '🪕', '🎻', '🎲', '♟️', '🎯', '🎳', '🎮', '🎰',
    '🧩',
  ],
  'Travel & Places': [
    '🚗', '🚕', '🚙', '🚌', '🚎', '🏎️', '🚓', '🚑', '🚒', '🚐', '🛻', '🚚', '🚛', '🚜', '🦯', '🦽', '🦼', '🛴', '🚲', '🛵',
    '🏍️', '🛺', '🚨', '🚔', '🚍', '🚘', '🚖', '🚡', '🚠', '🚟', '🚃', '🚋', '🚞', '🚝', '🚄', '🚅', '🚈', '🚂', '🚆', '🚇',
    '🚊', '🚉', '✈️', '🛫', '🛬', '🛩️', '💺', '🚁', '🚟', '🚠', '🚡', '🛰️', '🚀', '🛸', '🛎️', '🧳', '⌛', '⏳', '⌚', '⏰',
    '⏱️', '⏲️', '🕰️', '🕛', '🕧', '🕐', '🕜', '🕑', '🕝', '🕒', '🕞', '🕓', '🕟', '🕔', '🕠', '🕕', '🕡', '🕖', '🕢', '🕗',
    '🕣', '🕘', '🕤', '🕙', '🕥', '🕚', '🕦', '🌑', '🌒', '🌓', '🌔', '🌕', '🌖', '🌗', '🌘', '🌙', '🌚', '🌛', '🌜', '🌝',
    '🌞', '⭐', '🌟', '💫', '✨', '☄️', '💥', '🔥', '🌈', '☀️', '⛅', '☁️', '⛈️', '🌤️', '🌥️', '🌦️', '🌧️', '🌨️', '🌩️', '🌪️',
    '🌫️', '🌬️', '🌀', '💨', '💧', '💦', '☔', '☂️', '🌊', '⛄', '🏔️', '⛰️', '🌋', '🗻', '🏕️', '🏖️', '🏜️', '🏝️', '🏞️', '🏟️',
    '🏛️', '🏗️', '🧱', '🏘️', '🏚️', '🏠', '🏡', '🏢', '🏣', '🏤', '🏥', '🏦', '🏨', '🏩', '🏪', '🏫', '🏬', '🏭', '🏯', '🏰',
    '💒', '🗼', '🗽', '⛪', '🕌', '🛕', '🕍', '⛩️', '🕋', '⛲', '⛺', '🌁', '🌃', '🏙️', '🌄', '🌅', '🌆', '🌇', '🌉', '♨️',
    '🎠', '🎡', '🎢', '💈', '🎪', '🚂', '🚃', '🚄', '🚅', '🚆', '🚇', '🚈', '🚉', '🚊', '🚝', '🚞', '🚋', '🚌', '🚍', '🚎',
    '🚐', '🚑', '🚒', '🚓', '🚔', '🚕', '🚖', '🚗', '🚘', '🚙', '🚚', '🚛', '🚜', '🏎️', '🏍️', '🛵', '🦽', '🦼', '🛴', '🚲',
    '🛺', '🚏', '🛣️', '🛤️', '🛢️', '⛽', '🚨', '🚥', '🚦', '🛑', '🚧', '⚓', '⛵', '🛶', '🚤', '🛳️', '⛴️', '🛥️', '🚢', '⚓',
    '⛽', '🚨', '🚧', '🚦', '🚥', '🗺️', '🗿', '🗽', '🗼', '🏰', '🏯', '🏟️', '🎡', '🎢', '🎠', '⛲', '⛱️', '🏖️', '🏝️', '🏜️',
    '🌋', '⛰️', '🏔️', '🗻', '🏕️', '⛺', '🏠', '🏡', '🏘️', '🏚️', '🏗️', '🏭', '🏢', '🏬', '🏣', '🏤', '🏥', '🏦', '🏨', '🏩',
    '🏪', '🏫', '🏰', '💒', '🗼', '🗽', '⛪', '🕌', '🛕', '🕍', '⛩️', '🕋', '⛲', '⛺', '🌁', '🌃', '🏙️', '🌄', '🌅', '🌆',
    '🌇', '🌉', '♨️', '🎠', '🎡', '🎢', '💈', '🎪',
  ],
  'Objects': [
    '⌚', '📱', '📲', '💻', '⌨️', '🖥️', '🖨️', '🖱️', '🖲️', '🕹️', '🗜️', '💾', '💿', '📀', '📼', '📷', '📸', '📹', '🎥', '📽️',
    '🎞️', '📞', '☎️', '📟', '📠', '📺', '📻', '🎙️', '🎚️', '🎛️', '⏱️', '⏲️', '⏰', '🕰️', '⌛', '⏳', '📡', '🔋', '🔌', '💡',
    '🔦', '🕯️', '🪔', '🧯', '🛢️', '💸', '💵', '💴', '💶', '💷', '💰', '💳', '💎', '⚖️', '🪜', '🧰', '🪛', '🔧', '🔨', '⚒️',
    '🛠️', '⛏️', '🪚', '🔩', '⚙️', '🪤', '🧱', '⛓️', '🧲', '🔫', '💣', '🧨', '🪓', '🔪', '🗡️', '⚔️', '🛡️', '🚬', '⚰️', '🪦',
    '⚱️', '🏺', '🔮', '📿', '🧿', '💈', '⚗️', '🔭', '🔬', '🕳️', '🩹', '🩺', '💊', '💉', '🩸', '🧬', '🦠', '🧫', '🧪', '🌡️',
    '🧹', '🪠', '🧺', '🧻', '🚽', '🚿', '🛁', '🛀', '🛎️', '🧴', '🧷', '🧹', '🧯', '🛒', '🚬', '⚰️', '🪦', '⚱️', '🗿', '🏧',
    '🚮', '🚰', '♿', '🚹', '🚺', '🚻', '🚼', '🚾', '🛂', '🛃', '🛄', '🛅', '⚠️', '🚸', '⛔', '🚫', '🚳', '🚭', '🚯', '🚱',
    '🚷', '📵', '🔞', '☢️', '☣️', '⬆️', '↗️', '➡️', '↘️', '⬇️', '↙️', '⬅️', '↖️', '↕️', '↔️', '↩️', '↪️', '⤴️', '⤵️', '🔃',
    '🔄', '🔙', '🔚', '🔛', '🔜', '🔝', '🛐', '⚛️', '🕉️', '✡️', '☸️', '☯️', '✝️', '☦️', '☪️', '☮️', '🕎', '🔯', '♈', '♉',
    '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓', '⛎', '🔀', '🔁', '🔂', '▶️', '⏩', '⏭️', '⏯️', '⏸️', '⏹️',
    '⏺️', '⏮️', '⏪', '⏫', '⏬', '◀️', '🔼', '🔽', '➡️', '⬅️', '⬆️', '⬇️', '↗️', '↘️', '↙️', '↖️', '↕️', '↔️', '↩️', '↪️',
    '⤴️', '⤵️', '🔃', '🔄', '🔙', '🔚', '🔛', '🔜', '🔝', '🛐', '⚛️', '🕉️', '✡️', '☸️', '☯️', '✝️', '☦️', '☪️', '☮️', '🕎',
    '🔯', '♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓', '⛎', '🔀', '🔁', '🔂', '▶️', '⏩', '⏭️',
    '⏯️', '⏸️', '⏹️', '⏺️', '⏮️', '⏪', '⏫', '⏬', '◀️', '🔼', '🔽', '➕', '➖', '➗', '✖️', '♾️', '💲', '💱', '™️', '©️',
    '®️', '〰️', '➰', '➿', '🔚', '🔙', '🔛', '🔜', '🔝', '〽️', '✳️', '✴️', '❇️', '‼️', '⁉️', '❓', '❔', '❕', '❗', '〰️',
    '💱', '💲', '🔱', '🔰', '⭕', '✅', '☑️', '✔️', '✖️', '❌', '⭕', '🔴', '🟠', '🟡', '🟢', '🔵', '🟣', '⚫', '⚪', '🟤',
    '🔶', '🔷', '🔸', '🔹', '🔺', '🔻', '💠', '🔘', '🔳', '🔲', '▪️', '▫️', '◾', '◽', '◼️', '◻️', '🟥', '🟧', '🟨', '🟩',
    '🟦', '🟪', '⬛', '⬜', '🟫', '🔶', '🔷', '🔸', '🔹', '🔺', '🔻', '💠', '🔘', '🔳', '🔲',
  ],
  'Symbols': [
    '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '☮️',
    '✝️', '☪️', '🕉️', '☸️', '✡️', '🔯', '🕎', '☯️', '☦️', '🛐', '⛎', '♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐',
    '♑', '♒', '♓', '🆔', '⚛️', '🉑', '☢️', '☣️', '📴', '📳', '🈶', '🈚', '🈸', '🈺', '🈷️', '✴️', '🆚', '💮', '🉐', '㊙️',
    '㊗️', '🈴', '🈵', '🈹', '🈲', '🅰️', '🅱️', '🆎', '🆑', '🅾️', '🆘', '❌', '⭕', '🛑', '⛔', '📛', '🚫', '💯', '💢', '♨️',
    '🚷', '🚯', '🚳', '🚱', '🔞', '📵', '🚭', '❗', '❓', '❕', '❔', '‼️', '⁉️', '🔅', '🔆', '〽️', '⚠️', '🚸', '🔱', '⚜️',
    '🔰', '♻️', '✅', '🈯', '💹', '❇️', '✳️', '❎', '🌐', '💠', 'Ⓜ️', '🌀', '💤', '🏧', '🚾', '♿', '🅿️', '🈳', '🈂️', '🛂',
    '🛃', '🛄', '🛅', '🚹', '🚺', '🚼', '🚻', '🚮', '🎦', '📶', '🈁', '🔣', 'ℹ️', '🔤', '🔡', '🔠', '🔢', '#️⃣', '*️⃣', '0️⃣',
    '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟', '🔺', '🔻', '🔸', '🔹', '🔶', '🔷', '🔴', '🟠', '🟡', '🟢',
    '🔵', '🟣', '⚫', '⚪', '🟤', '🔘', '🔳', '🔲', '▪️', '▫️', '◾', '◽', '◼️', '◻️', '🟥', '🟧', '🟨', '🟩', '🟦', '🟪',
    '⬛', '⬜', '🟫', '🔶', '🔷', '🔸', '🔹', '🔺', '🔻', '💠', '🔘', '🔳', '🔲',
  ],
};

// Flatten all emojis into a single array for easy access
const ALL_EMOJIS = Object.values(EMOJI_CATEGORIES).flat();

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

const ComposerModal = () => {
  const { colors } = useTheme();
  const dynamicStyles = getStyles(colors);
  const { isOpen, close, quotedChirp, commentingChirp } = useComposer();
  const { user } = useAuthStore();
  const { addChirp, addComment } = useFeedStore();
  const { getUser, loadUser } = useUserStore();

  const [text, setText] = useState('');
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [reachMode, setReachMode] = useState<ReachMode>('forAll');
  const [tunedAudience, setTunedAudience] = useState<TunedAudience>({
    allowFollowers: true,
    allowNonFollowers: false,
  });
  const [isPosting, setIsPosting] = useState(false);
  const [analysisVisible, setAnalysisVisible] = useState(false);
  const [analysisStatus, setAnalysisStatus] = useState<string>('Analyzing your post...');
  const [analysisDecision, setAnalysisDecision] = useState<string | null>(null);
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
  const [audienceDescription, setAudienceDescription] = useState('');
  const [showTopicPicker, setShowTopicPicker] = useState(false);
  const [showSchedulePicker, setShowSchedulePicker] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [selectedEmojiCategory, setSelectedEmojiCategory] = useState<string>(Object.keys(EMOJI_CATEGORIES)[0]);
  const [tempScheduleDate, setTempScheduleDate] = useState<Date | null>(null);
  const [tempScheduleTime, setTempScheduleTime] = useState<string>('');
  const mentionStartRef = useRef<number | null>(null);
  const mentionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mentionCache = useRef<Map<string, string>>(new Map());;

  const remaining = useMemo(() => CHAR_LIMIT - text.length, [text]);
  const canPost = useMemo(
    () => !!user && text.trim().length > 0 && remaining >= 0 && !isPosting && !isUploadingImage,
    [user, text, remaining, isPosting, isUploadingImage]
  );

  const resetState = () => {
    setText('');
    setSelectedTopics([]);
    setAudienceDescription('');
    setReachMode('forAll');
    setTunedAudience({ allowFollowers: true, allowNonFollowers: false });
    setIsPosting(false);
    setImageUri(null);
    setImageUrl(null);
    setIsUploadingImage(false);
    setScheduledAt(null);
    setMentionQuery(null);
    setMentionResults([]);
    setShowTopicPicker(false);
    setShowSchedulePicker(false);
    setShowEmojiPicker(false);
    setTempScheduleDate(null);
    setTempScheduleTime('');
    mentionStartRef.current = null;
  };

  useEffect(() => {
    if (isOpen) {
      resetState();
    }
  }, [isOpen]);

  // Load author of commenting chirp
  useEffect(() => {
    if (commentingChirp) {
      loadUser(commentingChirp.authorId);
    }
  }, [commentingChirp, loadUser]);

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

  // Reset audience settings when switching away from tuned mode
  useEffect(() => {
    if (reachMode === 'forAll') {
      // Reset tuned mode state when switching to forAll
      setSelectedTopics([]);
      setAudienceDescription('');
      setTunedAudience({
        allowFollowers: true,
        allowNonFollowers: false,
      });
    }
  }, [reachMode]);

  const updateMentionState = (currentText: string, cursorPos: number) => {
    if (!currentText || cursorPos < 0) {
      setMentionQuery(null);
      mentionStartRef.current = null;
      return;
    }
    
    const beforeCursor = currentText.slice(0, cursorPos);
    // Match @ followed by word characters (including empty string for just @)
    // Match @ at start of text or after whitespace/newline
    const match = beforeCursor.match(/(?:^|[\s\n])@(\w*)$/);
    if (match) {
      const query = match[1];
      setMentionQuery(query);
      // Find the actual @ position (accounting for the space/newline in the match)
      const atIndex = beforeCursor.lastIndexOf('@', cursorPos);
      mentionStartRef.current = atIndex >= 0 ? atIndex : null;
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
    // When text changes, cursor is typically at the end of the new text
    // But we'll update mention state in a useEffect that watches both text and selection
  };

  // Update mention state whenever text or selection changes
  useEffect(() => {
    updateMentionState(text, selection.start);
  }, [text, selection.start]);

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

    // Handle comment mode (simplified - no analysis needed)
    if (commentingChirp) {
      try {
        const trimmed = text.trim();
        const formatted = buildFormattedText(trimmed);
        const handles = extractMentionHandles(trimmed);
        const mentionIds = await resolveMentions(handles);

        await addComment(commentingChirp.id, {
          authorId: user.id,
          text: trimmed,
          formattedText: formatted,
          imageUrl: imageUrl || undefined,
        });

        resetState();
        close();
      } catch (error) {
        console.error('[Composer] failed to post comment', error);
        setIsPosting(false);
        Alert.alert('Error', 'Unable to post comment right now. Please try again.');
      }
      return;
    }

    // Handle regular post (with analysis)
    setAnalysisVisible(true);
    setAnalysisStatus('Analyzing your post...');
    setAnalysisDecision(null);
    // Close composer modal to show analysis modal
    close();
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

      // Merge user-selected topics into semanticTopics
      const userSelectedTopicsNormalized = selectedTopics.map((t) => t.toLowerCase().trim()).filter(Boolean);
      const allSemanticTopics = [...new Set([...userSelectedTopicsNormalized, ...semanticTopics])];
      semanticTopics = allSemanticTopics;

      // Primary topic = first user-selected topic, or AI bucket, or fallback
      const primaryTopic = userSelectedTopicsNormalized[0] || null;

      // Map semantic topics to buckets
      const semanticTopicBuckets: Record<string, string> = {};
      if (semanticTopics.length > 0) {
        const mapped = await Promise.all(
          semanticTopics.map(async (topic) => {
            const bucket = await mapSemanticTopicToBucket(topic, bucketFromAI || primaryTopic || '');
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
        (primaryTopic && isValidTopic(primaryTopic) ? primaryTopic : null) ||
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

      setAnalysisStatus('Running fact-check and content analysis...');
      const processed = await addChirp(chirpData, { waitForProcessing: true });

      // Ensure we have a factCheckStatus (should never be undefined after processing)
      const decision = processed.factCheckStatus || 'needs_review';
      
      if (decision === 'blocked') {
        setAnalysisStatus('Post blocked');
        setAnalysisDecision('This post was blocked and will only be visible to you in your profile.');
      } else if (decision === 'needs_review') {
        setAnalysisStatus('Needs review');
        setAnalysisDecision('Your post is visible with a review badge and has been sent to reviewers.');
      } else {
        setAnalysisStatus('Approved');
        setAnalysisDecision('Your post is approved and published to feeds.');
      }
      // Don't reset state or close modal yet - wait for user to click OK on analysis modal
    } catch (error) {
      console.error('[Composer] failed to post', error);
      setAnalysisStatus('Post failed');
      setAnalysisDecision('Unable to post right now. Please try again.');
      setIsPosting(false);
      // Don't reset state on error - let user see the error and click OK
    }
  };

  const scheduleLabel = useMemo(() => {
    if (!scheduledAt) return null;
    const now = new Date();
    const diff = scheduledAt.getTime() - now.getTime();
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
  }, [scheduledAt]);

  const handleOpenSchedulePicker = () => {
    if (showSchedulePicker) {
      setShowSchedulePicker(false);
      return;
    }
    setShowEmojiPicker(false);
    setShowTopicPicker(false);
    if (scheduledAt) {
      setTempScheduleDate(scheduledAt);
      const hours = scheduledAt.getHours().toString().padStart(2, '0');
      const minutes = scheduledAt.getMinutes().toString().padStart(2, '0');
      setTempScheduleTime(`${hours}:${minutes}`);
    } else {
      const now = new Date();
      setTempScheduleDate(now);
      const hours = now.getHours().toString().padStart(2, '0');
      const minutes = now.getMinutes().toString().padStart(2, '0');
      setTempScheduleTime(`${hours}:${minutes}`);
    }
    setShowSchedulePicker(true);
  };

  const handleConfirmSchedule = () => {
    if (tempScheduleDate && tempScheduleTime) {
      const [hours, minutes] = tempScheduleTime.split(':').map(Number);
      const scheduled = new Date(tempScheduleDate);
      scheduled.setHours(hours, minutes, 0, 0);
      
      if (scheduled > new Date()) {
        setScheduledAt(scheduled);
      } else {
        alert('Please select a future date and time');
        return;
      }
    }
    setShowSchedulePicker(false);
  };

  const handleClearSchedule = () => {
    setScheduledAt(null);
    setShowSchedulePicker(false);
  };

  const formatTimeAgo = (date: Date) => {
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
      return 'recently';
    }
    const now = Date.now();
    const diffMs = Math.max(0, now - date.getTime());
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);
    if (diffMinutes < 1) return 'just now';
    if (diffMinutes < 60) return `${diffMinutes}m`;
    if (diffHours < 24) return `${diffHours}h`;
    return `${diffDays}d`;
  };

  const getInitial = (value?: string) => value?.charAt(0)?.toUpperCase() || 'U';

  // Get all topic names for manual selection
  const allTopicNames = useMemo(() => {
    const userTopicsList = user?.topics || user?.interests || [];
    const unique = [...new Set([...ALL_TOPICS, ...userTopicsList])];
    return unique.sort();
  }, [user?.topics, user?.interests]);

  // Handler: Change selected topics
  const handleTopicsChange = (topics: string[]) => {
    setSelectedTopics(topics);
  };

  // Handler: Change audience settings
  const handleAudienceChange = (audience: TunedAudience) => {
    setTunedAudience(audience);
  };

  // Handler: Change audience description
  const handleDescriptionChange = (description: string) => {
    setAudienceDescription(description);
  };

  const isCommentMode = !!commentingChirp;
  const commentingAuthor = commentingChirp ? getUser(commentingChirp.authorId) : null;
  const commentingCreatedAt = commentingChirp?.createdAt 
    ? (commentingChirp.createdAt instanceof Date 
        ? commentingChirp.createdAt 
        : new Date(commentingChirp.createdAt))
    : null;

  return (
    <>
    <Modal visible={isOpen} animationType="slide" transparent>
      <KeyboardAvoidingView
        style={dynamicStyles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <View style={dynamicStyles.container}>
          <View style={dynamicStyles.header}>
            <Text style={dynamicStyles.headerTitle}>{isCommentMode ? 'Add Comment' : 'New Post'}</Text>
            <TouchableOpacity onPress={close} style={dynamicStyles.closeButton}>
              <Text style={dynamicStyles.closeText}>Close</Text>
            </TouchableOpacity>
          </View>

          {/* Commenting Chirp Preview */}
          {isCommentMode && commentingChirp && (
            <View style={dynamicStyles.commentingChirpCard}>
              <View style={dynamicStyles.commentingChirpHeader}>
                <View style={dynamicStyles.commentingChirpAvatar}>
                  {commentingAuthor?.profilePictureUrl ? (
                    <Image
                      source={{ uri: commentingAuthor.profilePictureUrl }}
                      style={dynamicStyles.commentingChirpAvatarImage}
                    />
                  ) : (
                    <View style={dynamicStyles.commentingChirpAvatarPlaceholder}>
                      <Text style={dynamicStyles.commentingChirpAvatarText}>
                        {getInitial(commentingAuthor?.name || commentingAuthor?.handle)}
                      </Text>
                    </View>
                  )}
                </View>
                <View style={dynamicStyles.commentingChirpMeta}>
                  <Text style={dynamicStyles.commentingChirpAuthor}>
                    {commentingAuthor?.name || 'Unknown User'}
                  </Text>
                  <Text style={dynamicStyles.commentingChirpHandle}>
                    @{commentingAuthor?.handle || commentingChirp.authorId.slice(0, 8)}
                    {commentingCreatedAt && ` · ${formatTimeAgo(commentingCreatedAt)}`}
                  </Text>
                </View>
              </View>
              {commentingChirp.text && (
                <View style={dynamicStyles.commentingChirpContent}>
                  {renderFormattedText(
                    commentingChirp.formattedText || commentingChirp.text,
                    dynamicStyles.commentingChirpText
                  )}
                </View>
              )}
              {commentingChirp.imageUrl && (
                <Image
                  source={{ uri: commentingChirp.imageUrl }}
                  style={dynamicStyles.commentingChirpImage}
                  resizeMode="cover"
                />
              )}
            </View>
          )}

          <View style={dynamicStyles.inputArea}>
            <TextInput
              style={dynamicStyles.input}
              placeholder={isCommentMode ? "Add a comment..." : "Share something..."}
              placeholderTextColor={colors.textMuted}
              multiline
              value={text}
              onChangeText={handleTextChange}
              maxLength={CHAR_LIMIT}
              selection={selection}
              onSelectionChange={handleSelectionChange}
              autoFocus
            />
            
            {/* Mention Dropdown */}
            {mentionQuery !== null && mentionResults.length > 0 && (
              <View style={dynamicStyles.mentionDropdown}>
                <ScrollView style={dynamicStyles.mentionList} nestedScrollEnabled>
                  {mentionResults.map((candidate) => (
                    <TouchableOpacity
                      key={candidate.id}
                      style={dynamicStyles.mentionItem}
                      onPress={() => handleMentionSelect(candidate)}
                    >
                      {candidate.profilePictureUrl ? (
                        <Image
                          source={{ uri: candidate.profilePictureUrl }}
                          style={dynamicStyles.mentionAvatar}
                        />
                      ) : (
                        <View style={dynamicStyles.mentionAvatarPlaceholder}>
                          <Text style={dynamicStyles.mentionAvatarText}>
                            {candidate.name.charAt(0).toUpperCase()}
                          </Text>
                        </View>
                      )}
                      <View style={dynamicStyles.mentionInfo}>
                        <Text style={dynamicStyles.mentionName} numberOfLines={1}>
                          {candidate.name}
                        </Text>
                        <Text style={dynamicStyles.mentionHandle} numberOfLines={1}>
                          @{candidate.handle}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            <View style={dynamicStyles.toolbar}>
              <TouchableOpacity onPress={() => wrapSelection('**')} style={dynamicStyles.toolButton}>
                <Text style={dynamicStyles.toolText}>B</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => wrapSelection('_')} style={dynamicStyles.toolButton}>
                <Text style={dynamicStyles.toolText}>I</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={() => {
                  setShowTopicPicker(false);
                  setShowSchedulePicker(false);
                  setShowEmojiPicker(!showEmojiPicker);
                }} 
                style={[dynamicStyles.emojiTool, showEmojiPicker && dynamicStyles.toolButtonActive]}
              >
                <Text style={dynamicStyles.emoji}>😀</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handlePickImage} style={dynamicStyles.toolButton}>
                <Text style={dynamicStyles.toolText}>Image</Text>
              </TouchableOpacity>
              {!isCommentMode && (
                <>
                  <TouchableOpacity 
                    onPress={() => {
                      setShowEmojiPicker(false);
                      setShowSchedulePicker(false);
                      setShowTopicPicker(!showTopicPicker);
                    }} 
                    style={[dynamicStyles.toolButton, (selectedTopics.length > 0 || showTopicPicker) && dynamicStyles.toolButtonActive]}
                  >
                    <Text style={dynamicStyles.toolText}>#</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    onPress={handleOpenSchedulePicker} 
                    style={[dynamicStyles.toolButton, (scheduledAt || showSchedulePicker) && dynamicStyles.toolButtonActive]}
                  >
                    <Text style={dynamicStyles.toolText}>📅</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
            {!isCommentMode && selectedTopics.length > 0 && (
              <View style={dynamicStyles.selectedTopicsRow}>
                {selectedTopics.map((topic, index) => (
                  <View 
                    key={topic} 
                    style={[
                      dynamicStyles.selectedTopicBadge,
                      index === 0 && dynamicStyles.primaryTopicBadge,
                    ]}
                  >
                    <Text style={[
                      dynamicStyles.selectedTopicText,
                      index === 0 && dynamicStyles.primaryTopicText,
                    ]}>
                      #{topic}{index === 0 && ' (primary)'}
                    </Text>
                    <TouchableOpacity onPress={() => setSelectedTopics(selectedTopics.filter(t => t !== topic))}>
                      <Text style={[
                        dynamicStyles.removeTopicText,
                        index === 0 && dynamicStyles.primaryRemoveText,
                      ]}>×</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
            {!isCommentMode && scheduledAt && scheduleLabel && (
              <View style={dynamicStyles.scheduledBadge}>
                <Text style={dynamicStyles.scheduledText}>📅 {scheduleLabel}</Text>
                <TouchableOpacity onPress={() => setScheduledAt(null)}>
                  <Text style={dynamicStyles.removeScheduleText}>×</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Inline Emoji Picker */}
            {showEmojiPicker && (
              <View style={dynamicStyles.inlinePicker}>
                <View style={dynamicStyles.inlinePickerHeader}>
                  <Text style={dynamicStyles.inlinePickerTitle}>Emoji</Text>
                  <TouchableOpacity onPress={() => setShowEmojiPicker(false)}>
                    <Text style={dynamicStyles.inlinePickerClose}>×</Text>
                  </TouchableOpacity>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={dynamicStyles.emojiCategoryTabs}>
                  {Object.keys(EMOJI_CATEGORIES).map((category) => (
                    <TouchableOpacity
                      key={category}
                      style={[
                        dynamicStyles.emojiCategoryTab,
                        selectedEmojiCategory === category && dynamicStyles.emojiCategoryTabActive,
                      ]}
                      onPress={() => setSelectedEmojiCategory(category)}
                    >
                      <Text
                        style={[
                          dynamicStyles.emojiCategoryTabText,
                          selectedEmojiCategory === category && dynamicStyles.emojiCategoryTabTextActive,
                        ]}
                      >
                        {category}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <ScrollView style={dynamicStyles.inlinePickerBody} nestedScrollEnabled>
                  <View style={dynamicStyles.emojiGrid}>
                    {EMOJI_CATEGORIES[selectedEmojiCategory as keyof typeof EMOJI_CATEGORIES].map((emoji, index) => (
                      <TouchableOpacity
                        key={`${emoji}-${index}`}
                        style={dynamicStyles.emojiButton}
                        onPress={() => {
                          insertEmoji(emoji);
                          setShowEmojiPicker(false);
                        }}
                      >
                        <Text style={dynamicStyles.emojiLarge}>{emoji}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>
            )}

            {/* Inline Topic Picker */}
            {showTopicPicker && (
              <View style={dynamicStyles.inlinePicker}>
                <View style={dynamicStyles.inlinePickerHeader}>
                  <Text style={dynamicStyles.inlinePickerTitle}>Topic</Text>
                  <TouchableOpacity onPress={() => setShowTopicPicker(false)}>
                    <Text style={dynamicStyles.inlinePickerClose}>×</Text>
                  </TouchableOpacity>
                </View>
                <ScrollView style={dynamicStyles.inlinePickerBody} nestedScrollEnabled>
                  <View style={dynamicStyles.topicGrid}>
                    {ALL_TOPICS.map((topic) => {
                      const normalizedTopic = topic.toLowerCase();
                      const isSelected = selectedTopics.includes(normalizedTopic);
                      const isDisabled = !isSelected && selectedTopics.length >= 5;
                      return (
                        <TouchableOpacity
                          key={topic}
                          onPress={() => {
                            if (!isDisabled) {
                              if (isSelected) {
                                setSelectedTopics(selectedTopics.filter((t) => t !== normalizedTopic));
                              } else {
                                setSelectedTopics([...selectedTopics, normalizedTopic]);
                              }
                            }
                          }}
                          style={[
                            dynamicStyles.chip,
                            isSelected && dynamicStyles.chipSelected,
                            isDisabled && dynamicStyles.chipDisabled,
                          ]}
                          disabled={isDisabled}
                        >
                          <Text style={[
                            dynamicStyles.chipText, 
                            isSelected && dynamicStyles.chipTextSelected,
                            isDisabled && dynamicStyles.chipTextDisabled,
                          ]}>
                            #{topic}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  {selectedTopics.length >= 5 && (
                    <Text style={dynamicStyles.maxTopicsWarning}>Maximum 5 topics selected</Text>
                  )}
                </ScrollView>
              </View>
            )}

            {/* Inline Schedule Picker */}
            {showSchedulePicker && (
              <View style={dynamicStyles.inlinePicker}>
                <View style={dynamicStyles.inlinePickerHeader}>
                  <Text style={dynamicStyles.inlinePickerTitle}>Schedule</Text>
                  <TouchableOpacity onPress={() => setShowSchedulePicker(false)}>
                    <Text style={dynamicStyles.inlinePickerClose}>×</Text>
                  </TouchableOpacity>
                </View>
                <ScrollView style={dynamicStyles.inlinePickerBody} nestedScrollEnabled>
                  <View style={dynamicStyles.schedulePickerContent}>
                    <Text style={dynamicStyles.smallLabel}>Date</Text>
                    <TextInput
                      style={dynamicStyles.scheduleInput}
                      placeholder="YYYY-MM-DD"
                      value={tempScheduleDate ? tempScheduleDate.toISOString().split('T')[0] : ''}
                      onChangeText={(text) => {
                        const date = new Date(text);
                        if (!isNaN(date.getTime())) {
                          setTempScheduleDate(date);
                        }
                      }}
                    />
                    <Text style={[dynamicStyles.smallLabel, { marginTop: 16 }]}>Time</Text>
                    <TextInput
                      style={dynamicStyles.scheduleInput}
                      placeholder="HH:MM (24h format)"
                      value={tempScheduleTime}
                      onChangeText={setTempScheduleTime}
                    />
                    {tempScheduleDate && tempScheduleTime && (() => {
                      const [hours, minutes] = tempScheduleTime.split(':').map(Number);
                      const scheduled = new Date(tempScheduleDate);
                      scheduled.setHours(hours, minutes, 0, 0);
                      const isValid = scheduled > new Date();
                      return (
                        <View style={dynamicStyles.schedulePreview}>
                          <Text style={dynamicStyles.schedulePreviewText}>
                            {isValid 
                              ? `Will post on ${scheduled.toLocaleString()}`
                              : 'Please select a future date and time'}
                          </Text>
                        </View>
                      );
                    })()}
                  </View>
                </ScrollView>
                <View style={dynamicStyles.inlinePickerFooter}>
                  <TouchableOpacity 
                    style={dynamicStyles.modalButtonSecondary}
                    onPress={handleClearSchedule}
                  >
                    <Text style={dynamicStyles.modalButtonSecondaryText}>Clear</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={dynamicStyles.modalButtonPrimary}
                    onPress={handleConfirmSchedule}
                  >
                    <Text style={dynamicStyles.modalButtonPrimaryText}>Confirm</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>

          {!isCommentMode && (
            <View style={dynamicStyles.reachRow}>
              {(['forAll', 'tuned'] as ReachMode[]).map((mode) => (
                <TouchableOpacity
                  key={mode}
                  style={[
                    dynamicStyles.reachButton,
                    reachMode === mode && dynamicStyles.reachButtonActive,
                  ]}
                  onPress={() => setReachMode(mode)}
                >
                  <Text
                    style={[
                      dynamicStyles.reachLabel,
                      reachMode === mode && dynamicStyles.reachLabelActive,
                    ]}
                  >
                    {mode === 'tuned' ? 'Tuned' : 'For all'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Tuned mode content - Audience Description Box */}
          {!isCommentMode && reachMode === 'tuned' && (
            <AudienceDescriptionBox
              audienceDescription={audienceDescription}
              onDescriptionChange={handleDescriptionChange}
              selectedTopics={selectedTopics}
              onTopicsChange={handleTopicsChange}
              tunedAudience={tunedAudience}
              onAudienceChange={handleAudienceChange}
              allTopics={allTopicNames}
            />
          )}


          <View style={dynamicStyles.footer}>
            <Text style={[dynamicStyles.counter, remaining < 0 ? dynamicStyles.counterOver : undefined]}>
              {remaining}
            </Text>
            <TouchableOpacity
              style={[dynamicStyles.postButton, !canPost && dynamicStyles.postButtonDisabled]}
              onPress={handlePost}
              disabled={!canPost}
            >
              {isPosting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={dynamicStyles.postText}>{isCommentMode ? 'Comment' : 'Post'}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>

      {/* Analysis modal */}
      <Modal visible={analysisVisible} animationType="fade" transparent>
        <View style={dynamicStyles.analysisBackdrop}>
          <View style={dynamicStyles.analysisCard}>
            <Text style={dynamicStyles.analysisTitle}>Post analysis</Text>
            <Text style={dynamicStyles.analysisStatus}>{analysisStatus}</Text>
            {!analysisDecision && (
              <ActivityIndicator style={{ marginTop: 12 }} color={colors.accent} />
            )}
            {analysisDecision && (
              <Text style={dynamicStyles.analysisDecision}>{analysisDecision}</Text>
            )}
            {analysisDecision && (
              <TouchableOpacity
                style={dynamicStyles.analysisButton}
                onPress={() => {
                  setAnalysisVisible(false);
                  setAnalysisStatus('Analyzing your post...');
                  setAnalysisDecision(null);
                  resetState();
                  close();
                }}
              >
                <Text style={dynamicStyles.analysisButtonText}>OK</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
};

const getStyles = (colors: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: colors.backgroundElevated,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 24,
    paddingHorizontal: 16,
    maxHeight: '95%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  subtitle: {
    color: colors.textMuted,
    marginTop: 2,
  },
  closeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  closeText: {
    color: colors.textMuted,
    fontWeight: '600',
  },
  analysisBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  analysisCard: {
    backgroundColor: colors.backgroundElevated,
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
  },
  analysisTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  analysisStatus: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  analysisDecision: {
    marginTop: 12,
    fontSize: 14,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  analysisButton: {
    marginTop: 16,
    backgroundColor: colors.accent,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
  },
  analysisButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  commentingChirpCard: {
    marginTop: 12,
    marginBottom: 12,
    padding: 14,
    backgroundColor: colors.backgroundElevated,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.accent + '40',
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
  },
  commentingChirpHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  commentingChirpAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  commentingChirpAvatarImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  commentingChirpAvatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentingChirpAvatarText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  commentingChirpMeta: {
    marginLeft: 10,
  },
  commentingChirpAuthor: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  commentingChirpHandle: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  commentingChirpContent: {
    marginTop: 8,
  },
  commentingChirpText: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  commentingChirpImage: {
    width: '100%',
    height: 150,
    borderRadius: 12,
    marginTop: 12,
    backgroundColor: colors.border,
  },
  inputArea: {
    marginTop: 12,
    backgroundColor: colors.border + '80',
    borderRadius: 16,
    padding: 12,
  },
  input: {
    minHeight: 120,
    color: colors.textPrimary,
    fontSize: 16,
    textAlignVertical: 'top',
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 12,
  },
  toolButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: colors.backgroundElevated,
  },
  toolButtonActive: {
    backgroundColor: colors.accent,
  },
  toolText: {
    fontWeight: '700',
    color: colors.textPrimary,
  },
  selectedTopicsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  selectedTopicBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: colors.accent + '20',
    borderRadius: 10,
  },
  primaryTopicBadge: {
    backgroundColor: colors.accent,
  },
  selectedTopicText: {
    color: colors.accent,
    fontWeight: '700',
    fontSize: 12,
  },
  primaryTopicText: {
    color: '#fff',
  },
  removeTopicText: {
    color: colors.accent,
    fontSize: 16,
    fontWeight: '700',
  },
  primaryRemoveText: {
    color: '#fff',
  },
  scheduledBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.accent + '20',
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  scheduledText: {
    color: colors.accent,
    fontWeight: '600',
    fontSize: 14,
  },
  removeScheduleText: {
    color: colors.accent,
    fontSize: 18,
    fontWeight: '700',
  },
  emojiTool: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: colors.backgroundElevated,
  },
  emoji: {
    fontSize: 18,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: colors.backgroundElevated,
    marginRight: 8,
  },
  chipSelected: {
    backgroundColor: colors.accent,
  },
  chipDisabled: {
    opacity: 0.5,
  },
  chipText: {
    color: colors.textPrimary,
    fontWeight: '600',
  },
  chipTextSelected: {
    color: '#fff',
  },
  chipTextDisabled: {
    color: colors.textMuted,
  },
  maxTopicsWarning: {
    marginTop: 8,
    fontSize: 12,
    color: '#F59E0B',
    fontWeight: '500',
  },
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 16,
  },
  clearTopicButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.backgroundElevated,
  },
  clearTopicText: {
    color: colors.textMuted,
    fontSize: 12,
  },
  reachRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  reachButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    alignItems: 'center',
  },
  reachButtonActive: {
    backgroundColor: colors.accent,
    borderColor: 'transparent',
  },
  reachLabel: {
    fontWeight: '700',
    color: colors.textPrimary,
  },
  reachLabelActive: {
    color: '#fff',
  },
  audienceRow: {
    marginTop: 16,
  },
  smallLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    marginBottom: 8,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 8,
  },
  toggle: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: colors.backgroundElevated,
  },
  toggleActive: {
    backgroundColor: colors.accent,
  },
  toggleText: {
    color: colors.textPrimary,
    fontWeight: '600',
  },
  toggleTextActive: {
    color: '#fff',
  },
  tunedLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: colors.accent + '15',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.accent + '30',
  },
  tunedLoadingText: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '500',
  },
  aiErrorRow: {
    marginTop: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: '#FEF3C7',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#F59E0B40',
  },
  aiErrorText: {
    fontSize: 12,
    color: '#92400E',
    fontWeight: '500',
  },
  selectedTopicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  selectTopicButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: colors.backgroundElevated,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    alignSelf: 'flex-start',
  },
  selectTopicText: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '600',
  },
  scheduleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 16,
  },
  scheduleChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: colors.backgroundElevated,
  },
  scheduleChipActive: {
    backgroundColor: colors.accent,
  },
  scheduleText: {
    color: colors.textPrimary,
    fontWeight: '600',
  },
  scheduleTextActive: {
    color: '#fff',
  },
  scheduleLabel: {
    color: colors.textMuted,
    marginTop: 6,
  },
  footer: {
    marginTop: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: 12,
  },
  counter: {
    color: colors.textMuted,
    fontWeight: '700',
  },
  counterOver: {
    color: 'red',
  },
  postButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: colors.accent,
  },
  postButtonDisabled: {
    backgroundColor: colors.border,
  },
  postText: {
    color: '#fff',
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: colors.backgroundElevated,
    borderRadius: 20,
    width: '90%',
    maxHeight: '80%',
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  modalClose: {
    fontSize: 28,
    color: colors.textMuted,
    fontWeight: '300',
  },
  modalBody: {
    maxHeight: 400,
    padding: 16,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    padding: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  modalButtonPrimary: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: colors.accent,
  },
  modalButtonPrimaryText: {
    color: '#fff',
    fontWeight: '700',
  },
  modalButtonSecondary: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: colors.backgroundElevated,
  },
  modalButtonSecondaryText: {
    color: colors.textPrimary,
    fontWeight: '600',
  },
  topicGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  emojiCategoryTabs: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  emojiCategoryTab: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginHorizontal: 2,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  emojiCategoryTabActive: {
    borderBottomColor: colors.accent,
  },
  emojiCategoryTabText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
  },
  emojiCategoryTabTextActive: {
    color: colors.accent,
    fontWeight: '700',
  },
  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'flex-start',
    paddingVertical: 4,
  },
  emojiButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: colors.backgroundElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiLarge: {
    fontSize: 24,
  },
  schedulePickerContent: {
    gap: 12,
  },
  scheduleInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    color: colors.textPrimary,
    backgroundColor: colors.backgroundElevated,
  },
  schedulePreview: {
    marginTop: 12,
    padding: 12,
    backgroundColor: colors.backgroundElevated,
    borderRadius: 12,
  },
  schedulePreviewText: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  suggestionLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  suggestionLoadingText: {
    color: colors.textMuted,
    fontSize: 12,
  },
  inlinePicker: {
    marginTop: 12,
    backgroundColor: colors.backgroundElevated,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    maxHeight: 300,
    overflow: 'hidden',
  },
  inlinePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  inlinePickerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  inlinePickerClose: {
    fontSize: 20,
    color: colors.textMuted,
    fontWeight: '300',
  },
  inlinePickerBody: {
    maxHeight: 200,
    padding: 8,
  },
  inlinePickerFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    padding: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  mentionDropdown: {
    marginTop: 8,
    backgroundColor: colors.backgroundElevated,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    maxHeight: 200,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  mentionList: {
    maxHeight: 200,
  },
  mentionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  mentionAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 12,
  },
  mentionAvatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.accent + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  mentionAvatarText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.accent,
  },
  mentionInfo: {
    flex: 1,
    minWidth: 0,
  },
  mentionName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  mentionHandle: {
    fontSize: 12,
    color: colors.textMuted,
  },
});

export default ComposerModal;


