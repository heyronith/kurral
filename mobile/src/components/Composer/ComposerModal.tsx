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
  const [isGeneratingSuggestion, setIsGeneratingSuggestion] = useState(false);
  const [showTopicPicker, setShowTopicPicker] = useState(false);
  const [showSchedulePicker, setShowSchedulePicker] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [selectedEmojiCategory, setSelectedEmojiCategory] = useState<string>(Object.keys(EMOJI_CATEGORIES)[0]);
  const [tempScheduleDate, setTempScheduleDate] = useState<Date | null>(null);
  const [tempScheduleTime, setTempScheduleTime] = useState<string>('');
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
    setMentionQuery(null);
    setMentionResults([]);
    setIsGeneratingSuggestion(false);
    setShowTopicPicker(false);
    setShowSchedulePicker(false);
    setShowEmojiPicker(false);
    setTempScheduleDate(null);
    setTempScheduleTime('');
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

      setAnalysisStatus('Running fact-check and content analysis...');
      const processed = await addChirp(chirpData, { waitForProcessing: true });

      const decision = processed.factCheckStatus || 'clean';
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

  return (
    <>
    <Modal visible={isOpen} animationType="slide" transparent>
      <View style={styles.backdrop}>
        <View style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity onPress={close} style={styles.closeButton}>
              <Text style={styles.closeText}>Close</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.inputArea}>
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
              <TouchableOpacity 
                onPress={() => {
                  setShowTopicPicker(false);
                  setShowSchedulePicker(false);
                  setShowEmojiPicker(!showEmojiPicker);
                }} 
                style={[styles.emojiTool, showEmojiPicker && styles.toolButtonActive]}
              >
                <Text style={styles.emoji}>😀</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handlePickImage} style={styles.toolButton}>
                <Text style={styles.toolText}>Image</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={() => {
                  setShowEmojiPicker(false);
                  setShowSchedulePicker(false);
                  setShowTopicPicker(!showTopicPicker);
                }} 
                style={[styles.toolButton, (selectedTopic || showTopicPicker) && styles.toolButtonActive]}
              >
                <Text style={styles.toolText}>#</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={handleOpenSchedulePicker} 
                style={[styles.toolButton, (scheduledAt || showSchedulePicker) && styles.toolButtonActive]}
              >
                <Text style={styles.toolText}>📅</Text>
              </TouchableOpacity>
            </View>
            {selectedTopic && (
              <View style={styles.selectedTopicBadge}>
                <Text style={styles.selectedTopicText}>#{selectedTopic}</Text>
                <TouchableOpacity onPress={() => setSelectedTopic('')}>
                  <Text style={styles.removeTopicText}>×</Text>
                </TouchableOpacity>
              </View>
            )}
            {scheduledAt && scheduleLabel && (
              <View style={styles.scheduledBadge}>
                <Text style={styles.scheduledText}>📅 {scheduleLabel}</Text>
                <TouchableOpacity onPress={() => setScheduledAt(null)}>
                  <Text style={styles.removeScheduleText}>×</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Inline Emoji Picker */}
            {showEmojiPicker && (
              <View style={styles.inlinePicker}>
                <View style={styles.inlinePickerHeader}>
                  <Text style={styles.inlinePickerTitle}>Emoji</Text>
                  <TouchableOpacity onPress={() => setShowEmojiPicker(false)}>
                    <Text style={styles.inlinePickerClose}>×</Text>
                  </TouchableOpacity>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.emojiCategoryTabs}>
                  {Object.keys(EMOJI_CATEGORIES).map((category) => (
                    <TouchableOpacity
                      key={category}
                      style={[
                        styles.emojiCategoryTab,
                        selectedEmojiCategory === category && styles.emojiCategoryTabActive,
                      ]}
                      onPress={() => setSelectedEmojiCategory(category)}
                    >
                      <Text
                        style={[
                          styles.emojiCategoryTabText,
                          selectedEmojiCategory === category && styles.emojiCategoryTabTextActive,
                        ]}
                      >
                        {category}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <ScrollView style={styles.inlinePickerBody} nestedScrollEnabled>
                  <View style={styles.emojiGrid}>
                    {EMOJI_CATEGORIES[selectedEmojiCategory as keyof typeof EMOJI_CATEGORIES].map((emoji, index) => (
                      <TouchableOpacity
                        key={`${emoji}-${index}`}
                        style={styles.emojiButton}
                        onPress={() => {
                          insertEmoji(emoji);
                          setShowEmojiPicker(false);
                        }}
                      >
                        <Text style={styles.emojiLarge}>{emoji}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>
            )}

            {/* Inline Topic Picker */}
            {showTopicPicker && (
              <View style={styles.inlinePicker}>
                <View style={styles.inlinePickerHeader}>
                  <Text style={styles.inlinePickerTitle}>Topic</Text>
                  <TouchableOpacity onPress={() => setShowTopicPicker(false)}>
                    <Text style={styles.inlinePickerClose}>×</Text>
                  </TouchableOpacity>
                </View>
                <ScrollView style={styles.inlinePickerBody} nestedScrollEnabled>
                  {isGeneratingSuggestion && (
                    <View style={styles.suggestionLoading}>
                      <ActivityIndicator size="small" color={colors.light.accent} />
                      <Text style={styles.suggestionLoadingText}>Analyzing content...</Text>
                    </View>
                  )}
                  <View style={styles.topicGrid}>
                    {ALL_TOPICS.map((topic) => (
                      <TopicChip
                        key={topic}
                        value={topic}
                        selected={topic === selectedTopic}
                        onPress={(value) => {
                          setSelectedTopic(value);
                          setShowTopicPicker(false);
                        }}
                      />
                    ))}
                  </View>
                </ScrollView>
              </View>
            )}

            {/* Inline Schedule Picker */}
            {showSchedulePicker && (
              <View style={styles.inlinePicker}>
                <View style={styles.inlinePickerHeader}>
                  <Text style={styles.inlinePickerTitle}>Schedule</Text>
                  <TouchableOpacity onPress={() => setShowSchedulePicker(false)}>
                    <Text style={styles.inlinePickerClose}>×</Text>
                  </TouchableOpacity>
                </View>
                <ScrollView style={styles.inlinePickerBody} nestedScrollEnabled>
                  <View style={styles.schedulePickerContent}>
                    <Text style={styles.smallLabel}>Date</Text>
                    <TextInput
                      style={styles.scheduleInput}
                      placeholder="YYYY-MM-DD"
                      value={tempScheduleDate ? tempScheduleDate.toISOString().split('T')[0] : ''}
                      onChangeText={(text) => {
                        const date = new Date(text);
                        if (!isNaN(date.getTime())) {
                          setTempScheduleDate(date);
                        }
                      }}
                    />
                    <Text style={[styles.smallLabel, { marginTop: 16 }]}>Time</Text>
                    <TextInput
                      style={styles.scheduleInput}
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
                        <View style={styles.schedulePreview}>
                          <Text style={styles.schedulePreviewText}>
                            {isValid 
                              ? `Will post on ${scheduled.toLocaleString()}`
                              : 'Please select a future date and time'}
                          </Text>
                        </View>
                      );
                    })()}
                  </View>
                </ScrollView>
                <View style={styles.inlinePickerFooter}>
                  <TouchableOpacity 
                    style={styles.modalButtonSecondary}
                    onPress={handleClearSchedule}
                  >
                    <Text style={styles.modalButtonSecondaryText}>Clear</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.modalButtonPrimary}
                    onPress={handleConfirmSchedule}
                  >
                    <Text style={styles.modalButtonPrimaryText}>Confirm</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>

          <View style={styles.reachRow}>
            {(['forAll', 'tuned'] as ReachMode[]).map((mode) => (
              <TouchableOpacity
                key={mode}
                style={[
                  styles.reachButton,
                  reachMode === mode && styles.reachButtonActive,
                ]}
                onPress={() => setReachMode(mode)}
              >
                <Text
                  style={[
                    styles.reachLabel,
                    reachMode === mode && styles.reachLabelActive,
                  ]}
                >
                  {mode === 'tuned' ? 'Tuned' : 'For all'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {reachMode === 'tuned' && (
            <View style={styles.audienceRow}>
              <Text style={styles.smallLabel}>Audience</Text>
              <View style={styles.toggleRow}>
                {[
                  { label: 'Followers', key: 'allowFollowers' },
                  { label: 'Non-followers', key: 'allowNonFollowers' },
                ].map((option) => (
                  <TouchableOpacity
                    key={option.key}
                    style={[
                      styles.toggle,
                      tunedAudience[option.key as keyof TunedAudience] && styles.toggleActive,
                    ]}
                    onPress={() =>
                      setTunedAudience((prev) => ({
                        ...prev,
                        [option.key]: !prev[option.key as keyof TunedAudience],
                      }))
                    }
                  >
                    <Text
                      style={[
                        styles.toggleText,
                        tunedAudience[option.key as keyof TunedAudience] && styles.toggleTextActive,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}


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

      {/* Analysis modal */}
      <Modal visible={analysisVisible} animationType="fade" transparent>
        <View style={styles.analysisBackdrop}>
          <View style={styles.analysisCard}>
            <Text style={styles.analysisTitle}>Post analysis</Text>
            <Text style={styles.analysisStatus}>{analysisStatus}</Text>
            {!analysisDecision && (
              <ActivityIndicator style={{ marginTop: 12 }} color={colors.light.accent} />
            )}
            {analysisDecision && (
              <Text style={styles.analysisDecision}>{analysisDecision}</Text>
            )}
            {analysisDecision && (
              <TouchableOpacity
                style={styles.analysisButton}
                onPress={() => {
                  setAnalysisVisible(false);
                  setAnalysisStatus('Analyzing your post...');
                  setAnalysisDecision(null);
                  resetState();
                  close();
                }}
              >
                <Text style={styles.analysisButtonText}>OK</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#fff',
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
    paddingVertical: 6,
  },
  closeText: {
    color: colors.light.textMuted,
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
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
  },
  analysisTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.light.textPrimary,
    marginBottom: 8,
  },
  analysisStatus: {
    fontSize: 14,
    color: colors.light.textSecondary,
    textAlign: 'center',
  },
  analysisDecision: {
    marginTop: 12,
    fontSize: 14,
    color: colors.light.textPrimary,
    textAlign: 'center',
  },
  analysisButton: {
    marginTop: 16,
    backgroundColor: colors.light.accent,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
  },
  analysisButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  inputArea: {
    marginTop: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 16,
    padding: 12,
  },
  input: {
    minHeight: 120,
    color: colors.light.textPrimary,
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
    backgroundColor: colors.light.backgroundElevated,
  },
  toolButtonActive: {
    backgroundColor: colors.light.accent,
  },
  toolText: {
    fontWeight: '700',
    color: colors.light.textPrimary,
  },
  selectedTopicBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.light.accent + '20',
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  selectedTopicText: {
    color: colors.light.accent,
    fontWeight: '700',
    fontSize: 14,
  },
  removeTopicText: {
    color: colors.light.accent,
    fontSize: 18,
    fontWeight: '700',
  },
  scheduledBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.light.accent + '20',
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  scheduledText: {
    color: colors.light.accent,
    fontWeight: '600',
    fontSize: 14,
  },
  removeScheduleText: {
    color: colors.light.accent,
    fontSize: 18,
    fontWeight: '700',
  },
  emojiTool: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: colors.light.backgroundElevated,
  },
  emoji: {
    fontSize: 18,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: colors.light.backgroundElevated,
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
    borderColor: colors.light.border,
    backgroundColor: '#fff',
  },
  clearTopicText: {
    color: colors.light.textMuted,
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
    borderColor: colors.light.border,
    alignItems: 'center',
  },
  reachButtonActive: {
    backgroundColor: colors.light.accent,
    borderColor: 'transparent',
  },
  reachLabel: {
    fontWeight: '700',
    color: colors.light.textPrimary,
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
    color: colors.light.textMuted,
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
    marginTop: 16,
  },
  scheduleChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
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
    marginTop: 6,
  },
  footer: {
    marginTop: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.light.border,
    paddingTop: 12,
  },
  counter: {
    color: colors.light.textMuted,
    fontWeight: '700',
  },
  counterOver: {
    color: 'red',
  },
  postButton: {
    paddingHorizontal: 20,
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
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
    borderBottomColor: colors.light.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.light.textPrimary,
  },
  modalClose: {
    fontSize: 28,
    color: colors.light.textMuted,
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
    borderTopColor: colors.light.border,
  },
  modalButtonPrimary: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: colors.light.accent,
  },
  modalButtonPrimaryText: {
    color: '#fff',
    fontWeight: '700',
  },
  modalButtonSecondary: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: colors.light.backgroundElevated,
  },
  modalButtonSecondaryText: {
    color: colors.light.textPrimary,
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
    borderBottomColor: colors.light.border,
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
    borderBottomColor: colors.light.accent,
  },
  emojiCategoryTabText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.light.textMuted,
  },
  emojiCategoryTabTextActive: {
    color: colors.light.accent,
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
    backgroundColor: '#fff',
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
    borderColor: colors.light.border,
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    color: colors.light.textPrimary,
    backgroundColor: colors.light.backgroundElevated,
  },
  schedulePreview: {
    marginTop: 12,
    padding: 12,
    backgroundColor: colors.light.backgroundElevated,
    borderRadius: 12,
  },
  schedulePreviewText: {
    color: colors.light.textSecondary,
    fontSize: 14,
  },
  suggestionLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  suggestionLoadingText: {
    color: colors.light.textMuted,
    fontSize: 12,
  },
  inlinePicker: {
    marginTop: 12,
    backgroundColor: colors.light.backgroundElevated,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.light.border,
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
    borderBottomColor: colors.light.border,
  },
  inlinePickerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.light.textPrimary,
  },
  inlinePickerClose: {
    fontSize: 20,
    color: colors.light.textMuted,
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
    borderTopColor: colors.light.border,
  },
});

export default ComposerModal;


