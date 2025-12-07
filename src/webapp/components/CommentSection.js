import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { useFeedStore } from '../store/useFeedStore';
import { useUserStore } from '../store/useUserStore';
import { useThemeStore } from '../store/useThemeStore';
import { tuningService } from '../lib/services/tuningService';
import { commentService, realtimeService } from '../lib/firestore';
import { TrashIcon, ImageIcon, EmojiIcon, CalendarIcon } from './Icon';
import ConfirmDialog from './ConfirmDialog';
import EmojiPicker, { Theme } from 'emoji-picker-react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { uploadImage } from '../lib/storage';
import { sanitizeHTML } from '../lib/utils/sanitize';
import { linkifyMentions } from '../lib/utils/mentions';
// Reusable Rich Comment Editor Component
const RichCommentEditor = ({ placeholder, onSubmit, onCancel, replyToUser, initialText = '' }) => {
    const [text, setText] = useState('');
    const [imageFile, setImageFile] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const [imageUrl, setImageUrl] = useState('');
    const [isUploadingImage, setIsUploadingImage] = useState(false);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [scheduledAt, setScheduledAt] = useState(null);
    const [showSchedulePicker, setShowSchedulePicker] = useState(false);
    const [isBoldActive, setIsBoldActive] = useState(false);
    const [isItalicActive, setIsItalicActive] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const contentEditableRef = useRef(null);
    const fileInputRef = useRef(null);
    const emojiButtonRef = useRef(null);
    const [emojiPickerPosition, setEmojiPickerPosition] = useState(null);
    const { currentUser } = useUserStore();
    const { theme } = useThemeStore();
    const charLimit = 280;
    // Initialize with initialText if provided
    useEffect(() => {
        if (initialText && contentEditableRef.current && !contentEditableRef.current.textContent) {
            contentEditableRef.current.textContent = initialText;
            setText(initialText);
        }
    }, [initialText]);
    // Get plain text from contentEditable
    const getPlainText = () => {
        if (!contentEditableRef.current)
            return '';
        return contentEditableRef.current.innerText || '';
    };
    // Get formatted HTML from contentEditable
    const getFormattedText = () => {
        if (!contentEditableRef.current)
            return '';
        return contentEditableRef.current.innerHTML || '';
    };
    const plainText = getPlainText();
    const remaining = charLimit - plainText.length;
    const canSubmit = plainText.trim().length > 0 && !isSubmitting && !isUploadingImage && !!currentUser;
    const isScheduled = scheduledAt !== null && scheduledAt > new Date();
    // Update text state when contentEditable changes
    const handleContentChange = () => {
        const plain = getPlainText();
        if (plain.length <= charLimit) {
            setText(plain);
        }
        else {
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
    // WYSIWYG Formatting functions
    const handleBold = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!contentEditableRef.current)
            return;
        contentEditableRef.current.focus();
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0)
            return;
        const range = selection.getRangeAt(0);
        if (!range.collapsed) {
            document.execCommand('bold', false);
            setIsBoldActive(document.queryCommandState('bold'));
        }
        else {
            const newBoldState = !isBoldActive;
            setIsBoldActive(newBoldState);
            if (newBoldState) {
                const strong = document.createElement('strong');
                const zwsp = document.createTextNode('\u200B');
                strong.appendChild(zwsp);
                range.insertNode(strong);
                range.setStart(zwsp, 1);
                range.collapse(true);
                selection.removeAllRanges();
                selection.addRange(range);
            }
            else {
                let node = range.commonAncestorContainer;
                if (node.nodeType === Node.TEXT_NODE) {
                    node = node.parentElement || node;
                }
                const strongParent = node?.closest('strong, b');
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
    const handleItalic = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!contentEditableRef.current)
            return;
        contentEditableRef.current.focus();
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0)
            return;
        const range = selection.getRangeAt(0);
        if (!range.collapsed) {
            document.execCommand('italic', false);
            setIsItalicActive(document.queryCommandState('italic'));
        }
        else {
            const newItalicState = !isItalicActive;
            setIsItalicActive(newItalicState);
            if (newItalicState) {
                const em = document.createElement('em');
                const zwsp = document.createTextNode('\u200B');
                em.appendChild(zwsp);
                range.insertNode(em);
                range.setStart(zwsp, 1);
                range.collapse(true);
                selection.removeAllRanges();
                selection.addRange(range);
            }
            else {
                let node = range.commonAncestorContainer;
                if (node.nodeType === Node.TEXT_NODE) {
                    node = node.parentElement || node;
                }
                const emParent = node?.closest('em, i');
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
    const handleEmojiClick = (emojiData) => {
        const emoji = emojiData.emoji;
        if (!contentEditableRef.current)
            return;
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
        }
        else {
            contentEditableRef.current.textContent += emoji;
        }
        handleContentChange();
        setShowEmojiPicker(false);
        contentEditableRef.current.focus();
    };
    // Handle image file selection
    const handleImageSelect = async (e) => {
        const file = e.target.files?.[0];
        if (!file || !currentUser)
            return;
        if (!file.type.startsWith('image/')) {
            alert('Please select an image file');
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            alert('Image size must be less than 5MB');
            return;
        }
        setImageFile(file);
        const reader = new FileReader();
        reader.onloadend = () => {
            setImagePreview(reader.result);
        };
        reader.readAsDataURL(file);
        setIsUploadingImage(true);
        try {
            const downloadURL = await uploadImage(file, currentUser.id);
            setImageUrl(downloadURL);
        }
        catch (error) {
            console.error('Error uploading image:', error);
            alert('Failed to upload image. Please try again.');
            setImageFile(null);
            setImagePreview(null);
        }
        finally {
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
    const formatScheduleTime = (date) => {
        const now = new Date();
        const diff = date.getTime() - now.getTime();
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        if (hours > 24) {
            const days = Math.floor(hours / 24);
            return `in ${days}d ${hours % 24}h`;
        }
        else if (hours > 0) {
            return `in ${hours}h ${minutes}m`;
        }
        else {
            return `in ${minutes}m`;
        }
    };
    // Update emoji picker position on scroll/resize when open
    useEffect(() => {
        if (!showEmojiPicker || !emojiButtonRef.current || !emojiPickerPosition)
            return;
        const updatePosition = () => {
            if (!emojiButtonRef.current)
                return;
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
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!canSubmit || !currentUser)
            return;
        setIsSubmitting(true);
        try {
            const formattedHTML = getFormattedText();
            const sanitizedHTML = formattedHTML ? sanitizeHTML(formattedHTML) : '';
            const plainTextContent = getPlainText().trim();
            await onSubmit({
                text: plainTextContent,
                formattedText: sanitizedHTML.trim() || undefined,
                imageUrl: imageUrl.trim() || undefined,
                scheduledAt: scheduledAt && scheduledAt > new Date() ? scheduledAt : undefined,
            });
            // Reset form
            if (contentEditableRef.current) {
                contentEditableRef.current.innerHTML = '';
            }
            setText('');
            setImageFile(null);
            setImagePreview(null);
            setImageUrl('');
            setScheduledAt(null);
            setShowEmojiPicker(false);
            setShowSchedulePicker(false);
            setIsBoldActive(false);
            setIsItalicActive(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
        catch (error) {
            console.error('Error submitting comment:', error);
        }
        finally {
            setIsSubmitting(false);
        }
    };
    return (_jsxs(_Fragment, { children: [_jsxs("form", { onSubmit: handleSubmit, className: "space-y-2", children: [replyToUser && (_jsxs("div", { className: "mb-2 text-xs text-textMuted", children: [_jsx("span", { children: "Replying to " }), _jsxs(Link, { to: `/profile/${replyToUser.id}`, className: "text-primary hover:text-accent font-medium", children: ["@", replyToUser.handle] })] })), _jsxs("div", { className: "relative", children: [_jsx("div", { ref: contentEditableRef, contentEditable: true, onInput: (e) => {
                                    if (contentEditableRef.current) {
                                        const zwspElements = contentEditableRef.current.querySelectorAll('strong:only-child, em:only-child');
                                        zwspElements.forEach((el) => {
                                            if (el.textContent === '\u200B' && el.children.length === 0) {
                                                const parent = el.parentNode;
                                                if (parent) {
                                                    parent.removeChild(el);
                                                }
                                            }
                                        });
                                    }
                                    handleContentChange();
                                    if (contentEditableRef.current) {
                                        setIsBoldActive(document.queryCommandState('bold'));
                                        setIsItalicActive(document.queryCommandState('italic'));
                                    }
                                }, onPaste: (e) => {
                                    e.preventDefault();
                                    const text = e.clipboardData.getData('text/plain');
                                    if (isBoldActive) {
                                        document.execCommand('bold', false);
                                    }
                                    if (isItalicActive) {
                                        document.execCommand('italic', false);
                                    }
                                    document.execCommand('insertText', false, text);
                                    handleContentChange();
                                }, "data-placeholder": placeholder, className: `w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition-all duration-200 resize-none min-h-[60px] max-h-[200px] overflow-y-auto ${theme === 'dark' ? 'bg-white/10 border-white/20 text-white shadow-sm focus:border-accent/60 focus:ring-2 focus:ring-accent/30 placeholder:text-white/60' : 'bg-background/50 border-border text-textPrimary shadow-sm focus:border-primary/60 focus:ring-2 focus:ring-primary/30 placeholder:text-textMuted'}`, style: {
                                    whiteSpace: 'pre-wrap',
                                    wordWrap: 'break-word',
                                }, onMouseUp: () => {
                                    if (contentEditableRef.current) {
                                        setIsBoldActive(document.queryCommandState('bold'));
                                        setIsItalicActive(document.queryCommandState('italic'));
                                    }
                                } }), _jsx("style", { children: `
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
          ` })] }), _jsxs("div", { className: "flex items-center justify-between mt-2", children: [_jsx("div", { className: "flex items-center gap-2", children: _jsxs("div", { className: `formatting-toolbar flex items-center gap-1 rounded-full border px-2 py-1 ${theme === 'dark' ? 'border-white/10 bg-white/5' : 'border-border/40 bg-white/90 shadow-sm'}`, children: [_jsx("button", { onMouseDown: handleBold, className: `p-1.5 rounded-lg transition-all duration-200 active:scale-95 ${isBoldActive
                                                ? 'bg-gradient-to-r from-accent/50 to-accent/20 text-accent'
                                                : theme === 'dark'
                                                    ? 'text-white/70 hover:bg-white/10 hover:text-white'
                                                    : 'text-textMuted hover:bg-backgroundElevated/60 hover:text-textPrimary'}`, title: "Bold", type: "button", children: _jsx("span", { className: "text-xs font-bold", children: "B" }) }), _jsx("button", { onMouseDown: handleItalic, className: `p-1.5 rounded-lg transition-all duration-200 active:scale-95 ${isItalicActive
                                                ? 'bg-gradient-to-r from-accent/50 to-accent/20 text-accent'
                                                : theme === 'dark'
                                                    ? 'text-white/70 hover:bg-white/10 hover:text-white'
                                                    : 'text-textMuted hover:bg-backgroundElevated/60 hover:text-textPrimary'}`, title: "Italic", type: "button", children: _jsx("span", { className: "text-xs italic", children: "I" }) }), _jsx("div", { className: `w-px h-4 ${theme === 'dark' ? 'bg-white/10' : 'bg-border/60'} mx-1` }), _jsx("div", { className: "relative", children: _jsx("button", { ref: emojiButtonRef, onClick: () => {
                                                    if (!showEmojiPicker && emojiButtonRef.current) {
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
                                                    }
                                                    setShowEmojiPicker(!showEmojiPicker);
                                                    setShowSchedulePicker(false);
                                                }, className: `p-1.5 rounded-lg transition-all duration-200 active:scale-95 ${theme === 'dark' ? 'text-white/70 hover:bg-white/10 hover:text-white' : 'text-textMuted hover:bg-backgroundElevated/60 hover:text-textPrimary'}`, title: "Emoji", type: "button", children: _jsx(EmojiIcon, { size: 16 }) }) }), _jsx("button", { onClick: () => fileInputRef.current?.click(), className: `p-1.5 rounded-lg transition-all duration-200 active:scale-95 ${theme === 'dark' ? 'text-white/70 hover:bg-white/10 hover:text-white' : 'text-textMuted hover:bg-backgroundElevated/60 hover:text-textPrimary'}`, title: "Add Image", type: "button", disabled: isUploadingImage, children: _jsx(ImageIcon, { size: 16 }) }), _jsx("input", { ref: fileInputRef, type: "file", accept: "image/*", onChange: handleImageSelect, className: "hidden" }), _jsx("button", { onClick: () => {
                                                setShowSchedulePicker(!showSchedulePicker);
                                                setShowEmojiPicker(false);
                                            }, className: `p-1.5 rounded-lg transition-all duration-200 active:scale-95 ${isScheduled
                                                ? 'text-primary bg-primary/10'
                                                : theme === 'dark'
                                                    ? 'text-white/70 hover:bg-white/10 hover:text-white'
                                                    : 'text-textMuted hover:bg-backgroundElevated/60 hover:text-textPrimary'}`, title: isScheduled ? `Scheduled: ${formatScheduleTime(scheduledAt)}` : 'Schedule Comment', type: "button", children: _jsx(CalendarIcon, { size: 16 }) })] }) }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: `text-xs font-medium ${remaining < 20 ? 'text-warning' : theme === 'dark' ? 'text-white/70' : 'text-textMuted'}`, children: remaining }), _jsx("button", { type: "button", onClick: onCancel, className: `px-3 py-1.5 text-xs rounded-lg transition-all duration-200 ${theme === 'dark' ? 'bg-white/10 text-white/70 hover:bg-white/20' : 'bg-background/50 text-textMuted hover:bg-backgroundHover'}`, children: "Cancel" }), _jsx("button", { type: "submit", disabled: !canSubmit, className: `px-3 py-1.5 text-xs rounded-lg transition-all duration-200 ${canSubmit
                                            ? 'bg-primary text-white hover:bg-primary/90 active:scale-95'
                                            : theme === 'dark'
                                                ? 'bg-white/10 text-white/50 cursor-not-allowed'
                                                : 'bg-background/50 text-textMuted cursor-not-allowed'}`, children: isSubmitting ? (_jsxs("svg", { className: "animate-spin h-3 w-3", xmlns: "http://www.w3.org/2000/svg", fill: "none", viewBox: "0 0 24 24", children: [_jsx("circle", { className: "opacity-25", cx: "12", cy: "12", r: "10", stroke: "currentColor", strokeWidth: "4" }), _jsx("path", { className: "opacity-75", fill: "currentColor", d: "M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" })] })) : isScheduled ? ('Schedule') : ('Post') })] })] }), (imagePreview || imageUrl) && (_jsx("div", { className: "mt-2 relative", children: _jsxs("div", { className: `rounded-lg overflow-hidden border ${theme === 'dark' ? 'border-white/20 bg-black/40' : 'border-border/40 bg-gradient-to-br from-white to-gray-100'} aspect-square max-w-xs w-full flex items-center justify-center relative group shadow-md`, children: [_jsx("img", { src: imagePreview || imageUrl, alt: "Comment attachment", className: "w-full h-full object-contain", onError: (e) => {
                                        e.currentTarget.style.display = 'none';
                                    } }), _jsx("button", { onClick: handleRemoveImage, className: "absolute top-2 right-2 bg-black/70 hover:bg-black/80 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-all duration-200 shadow-lg", type: "button", children: "\u2715" }), isUploadingImage && (_jsx("div", { className: "absolute inset-0 bg-black/20 flex items-center justify-center", children: _jsx("div", { className: "text-white text-sm", children: "Uploading..." }) }))] }) }))] }), showSchedulePicker && (_jsxs(_Fragment, { children: [_jsx("div", { className: `fixed inset-0 z-[130] transition-all duration-300 ${showSchedulePicker
                            ? 'bg-black/60 backdrop-blur-md opacity-100'
                            : 'bg-black/0 backdrop-blur-0 opacity-0'}`, onClick: () => setShowSchedulePicker(false) }), _jsx("div", { className: "fixed inset-0 flex items-center justify-center z-[140] p-4 pointer-events-none", children: _jsxs("div", { className: `${theme === 'dark' ? 'bg-black/95 border border-white/10' : 'bg-white/98 border border-border/40'} rounded-3xl shadow-[0_30px_80px_rgba(15,23,42,0.4)] w-full max-w-2xl overflow-hidden backdrop-blur-xl pointer-events-auto transition-all duration-300 ease-out ${showSchedulePicker
                                ? 'opacity-100 scale-100 translate-y-0'
                                : 'opacity-0 scale-95 translate-y-4'}`, onClick: (e) => e.stopPropagation(), children: [_jsxs("div", { className: `px-6 py-4 border-b ${theme === 'dark' ? 'border-white/10' : 'border-border/40'} flex items-center justify-between`, children: [_jsx("h3", { className: `text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`, children: "Pick date & time" }), _jsx("button", { onClick: () => setShowSchedulePicker(false), className: `p-1.5 rounded-lg transition-all duration-200 hover:scale-110 ${theme === 'dark'
                                                ? 'text-white/70 hover:bg-white/10 hover:text-white'
                                                : 'text-textMuted hover:bg-backgroundElevated/60 hover:text-textPrimary'}`, "aria-label": "Close schedule picker", type: "button", children: _jsx("svg", { className: "w-5 h-5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M6 18L18 6M6 6l12 12" }) }) })] }), _jsxs("div", { className: "flex flex-col md:flex-row gap-4 px-4 py-3", children: [_jsx("div", { className: `flex-1 rounded-2xl p-4 transition-shadow border ${theme === 'dark' ? 'border-white/10 bg-white/5 shadow-[0_10px_40px_rgba(255,255,255,0.08)]' : 'border-border/40 bg-white shadow-[0_10px_40px_rgba(15,23,42,0.08)]'}`, children: _jsx(DatePicker, { selected: scheduledAt ?? null, onChange: (date) => {
                                                    if (date) {
                                                        if (scheduledAt) {
                                                            const newDate = new Date(date);
                                                            newDate.setHours(scheduledAt.getHours());
                                                            newDate.setMinutes(scheduledAt.getMinutes());
                                                            setScheduledAt(newDate);
                                                        }
                                                        else {
                                                            const now = new Date();
                                                            const newDate = new Date(date);
                                                            newDate.setHours(now.getHours());
                                                            newDate.setMinutes(Math.ceil(now.getMinutes() / 15) * 15);
                                                            setScheduledAt(newDate);
                                                        }
                                                    }
                                                    else {
                                                        setScheduledAt(null);
                                                    }
                                                }, inline: true, minDate: new Date(), calendarStartDay: 1, className: "text-sm w-full", calendarClassName: "schedule-calendar", wrapperClassName: "w-full" }) }), _jsxs("div", { className: `flex-1 p-6 flex flex-col gap-4 rounded-2xl border ${theme === 'dark' ? 'border-white/10 bg-white/5 shadow-[0_8px_30px_rgba(255,255,255,0.08)]' : 'border-border/40 bg-white/90 shadow-[0_8px_30px_rgba(15,23,42,0.08)]'}`, children: [_jsxs("div", { children: [_jsx("label", { className: `block text-xs font-medium ${theme === 'dark' ? 'text-white/70' : 'text-textMuted'} mb-2`, children: "Time" }), _jsx(DatePicker, { selected: scheduledAt ?? null, onChange: (date) => {
                                                                if (date) {
                                                                    if (scheduledAt) {
                                                                        const newDate = new Date(scheduledAt);
                                                                        newDate.setHours(date.getHours());
                                                                        newDate.setMinutes(date.getMinutes());
                                                                        setScheduledAt(newDate);
                                                                    }
                                                                    else {
                                                                        const today = new Date();
                                                                        today.setHours(date.getHours());
                                                                        today.setMinutes(date.getMinutes());
                                                                        setScheduledAt(today);
                                                                    }
                                                                }
                                                                else {
                                                                    setScheduledAt(null);
                                                                }
                                                            }, showTimeSelect: true, showTimeSelectOnly: true, timeIntervals: 15, timeCaption: "Time", dateFormat: "h:mm aa", className: `w-full px-3 py-2 ${theme === 'dark' ? 'bg-white/5 border-white/20 text-white' : 'bg-card/40 border-border/60 text-textPrimary'} rounded-lg text-sm focus:ring-2 focus:ring-accent/30 focus:border-accent/60 outline-none`, calendarClassName: "schedule-calendar" })] }), isScheduled && scheduledAt && (_jsxs("div", { className: `mt-2 px-3 py-2 rounded-lg bg-accent/10 ${theme === 'dark' ? 'text-white border-accent/20' : 'text-textPrimary border-accent/20'} border`, children: [_jsx("div", { className: `font-medium mb-1 ${theme === 'dark' ? 'text-white' : ''}`, children: "Scheduled for:" }), _jsx("div", { className: theme === 'dark' ? 'text-white/70' : 'text-textMuted', children: scheduledAt.toLocaleString(undefined, {
                                                                weekday: 'long',
                                                                month: 'long',
                                                                day: 'numeric',
                                                                year: 'numeric',
                                                                hour: 'numeric',
                                                                minute: '2-digit'
                                                            }) })] }))] })] }), _jsxs("div", { className: `px-6 py-4 border-t ${theme === 'dark' ? 'border-white/10' : 'border-border/40'} flex items-center justify-end gap-3`, children: [_jsx("button", { onClick: () => {
                                                setScheduledAt(null);
                                                setShowSchedulePicker(false);
                                            }, className: `px-5 py-2.5 text-sm font-medium rounded-full transition-all duration-200 ${theme === 'dark'
                                                ? 'text-white/70 hover:text-white hover:bg-white/10'
                                                : 'text-textMuted hover:text-textPrimary hover:bg-backgroundElevated/60'}`, type: "button", children: "Cancel" }), _jsx("button", { onClick: () => {
                                                if (scheduledAt && scheduledAt > new Date()) {
                                                    setShowSchedulePicker(false);
                                                }
                                            }, disabled: !scheduledAt || scheduledAt <= new Date(), className: `px-5 py-2.5 text-sm font-semibold rounded-full transition-all duration-200 ${scheduledAt && scheduledAt > new Date()
                                                ? 'bg-gradient-to-r from-accent to-accent/90 text-white hover:from-accentHover hover:to-accent shadow-[0_4px_14px_rgba(59,130,246,0.4)] active:scale-95'
                                                : theme === 'dark' ? 'bg-white/10 text-white/50 cursor-not-allowed' : 'bg-backgroundElevated/50 text-textMuted cursor-not-allowed'}`, type: "button", children: "Schedule Comment" })] })] }) })] })), showEmojiPicker && emojiPickerPosition && typeof document !== 'undefined' && createPortal(_jsxs(_Fragment, { children: [_jsx("div", { className: "fixed inset-0 z-[110]", onClick: () => setShowEmojiPicker(false) }), _jsx("div", { className: `fixed z-[120] rounded-2xl overflow-hidden border shadow-[0_20px_60px_rgba(15,23,42,0.4)] backdrop-blur-xl transition-all duration-300 ease-out ${showEmojiPicker
                            ? 'opacity-100 scale-100 translate-y-0'
                            : 'opacity-0 scale-95 translate-y-2'} ${theme === 'dark' ? 'bg-black/95 border-white/20' : 'bg-white/95 border-border/40'}`, style: {
                            top: `${emojiPickerPosition.top}px`,
                            left: `${emojiPickerPosition.left}px`,
                        }, children: _jsx("div", { className: "p-2", children: _jsx(EmojiPicker, { onEmojiClick: handleEmojiClick, width: 400, height: 500, previewConfig: { showPreview: true }, skinTonesDisabled: true, theme: theme === 'dark' ? Theme.DARK : Theme.LIGHT, searchPlaceHolder: "Search emojis", autoFocusSearch: false, lazyLoadEmojis: true }) }) })] }), document.body)] }));
};
const CommentItem = ({ comment, chirpId, chirpAuthorId, depth, maxDepth = 5 }) => {
    const [isReplying, setIsReplying] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const { addComment, deleteComment } = useFeedStore();
    const { currentUser, getUser } = useUserStore();
    const { theme } = useThemeStore();
    const replyToUser = comment.replyToUserId ? getUser(comment.replyToUserId) : null;
    const author = getUser(comment.authorId);
    const formatTime = (date) => {
        const minutesAgo = Math.floor((Date.now() - date.getTime()) / 60000);
        if (minutesAgo < 1)
            return 'now';
        if (minutesAgo < 60)
            return `${minutesAgo}m`;
        const hoursAgo = Math.floor(minutesAgo / 60);
        if (hoursAgo < 24)
            return `${hoursAgo}h`;
        const daysAgo = Math.floor(hoursAgo / 24);
        return `${daysAgo}d`;
    };
    const handleReplySubmit = async (data) => {
        if (!currentUser || !author)
            return;
        try {
            await addComment({
                chirpId,
                authorId: currentUser.id,
                text: data.text,
                formattedText: data.formattedText,
                imageUrl: data.imageUrl,
                scheduledAt: data.scheduledAt,
                parentCommentId: comment.id,
                replyToUserId: comment.authorId,
            });
            tuningService.trackChirpEngagement(chirpId);
            setIsReplying(false);
        }
        catch (error) {
            console.error('Error posting reply:', error);
            throw error;
        }
    };
    const handleDeleteClick = () => {
        if (!currentUser)
            return;
        if (currentUser.id !== comment.authorId && currentUser.id !== chirpAuthorId)
            return;
        setShowDeleteConfirm(true);
    };
    const handleDeleteConfirm = async () => {
        if (!currentUser)
            return;
        if (currentUser.id !== comment.authorId && currentUser.id !== chirpAuthorId)
            return;
        try {
            await deleteComment(comment.id, currentUser.id);
            setShowDeleteConfirm(false);
        }
        catch (error) {
            console.error('Error deleting comment:', error);
            setShowDeleteConfirm(false);
            alert('Failed to delete comment. Please try again.');
        }
    };
    // Render formatted text or plain text
    const renderCommentText = () => {
        if (comment.formattedText) {
            const content = sanitizeHTML(linkifyMentions(comment.formattedText));
            return (_jsx("div", { className: `text-sm ${theme === 'dark' ? 'text-white' : 'text-textPrimary'} mb-2 leading-relaxed whitespace-pre-wrap`, dangerouslySetInnerHTML: { __html: content } }));
        }
        return (_jsx("p", { className: "text-sm text-textPrimary whitespace-pre-wrap mb-2 leading-relaxed", children: comment.text }));
    };
    const isCommentAuthor = currentUser?.id === comment.authorId;
    const isChirpAuthor = currentUser?.id === chirpAuthorId;
    const canDelete = isCommentAuthor || isChirpAuthor;
    if (!author)
        return null;
    const indentLevel = Math.min(depth, maxDepth);
    const indentPx = indentLevel * 24;
    const hasReplies = comment.replies.length > 0;
    return (_jsxs("div", { className: "relative", children: [depth > 0 && (_jsx("div", { className: "absolute left-0 top-0 bottom-0 w-0.5 bg-border/40", style: { left: `${indentPx - 12}px` } })), _jsxs("div", { className: "relative pl-4", style: { paddingLeft: `${indentPx}px` }, children: [_jsxs("div", { className: `rounded-lg p-3 transition-colors ${depth > 0
                            ? 'bg-background/30 border border-border/30'
                            : 'bg-transparent'}`, children: [_jsxs("div", { className: "flex items-start gap-2 mb-1.5", children: [_jsx("div", { className: "flex-shrink-0", children: author.profilePictureUrl ? (_jsx("img", { src: author.profilePictureUrl, alt: author.name, className: "w-8 h-8 rounded-full object-cover border border-border/50" })) : (_jsx("div", { className: "w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center border border-border/50", children: _jsx("span", { className: "text-primary font-semibold text-xs", children: author.name.charAt(0).toUpperCase() }) })) }), _jsx("div", { className: "flex-1 min-w-0", children: _jsxs("div", { className: "flex items-center gap-2 flex-wrap", children: [_jsx(Link, { to: `/profile/${author.id}`, className: "text-sm font-semibold text-textPrimary hover:text-primary transition-colors", children: author.name }), _jsxs(Link, { to: `/profile/${author.id}`, className: "text-xs text-textMuted hover:text-primary transition-colors", children: ["@", author.handle] }), _jsx("span", { className: "text-xs text-textMuted", children: "\u00B7" }), _jsx("span", { className: "text-xs text-textMuted", children: formatTime(comment.createdAt) })] }) })] }), renderCommentText(), comment.imageUrl && (_jsx("div", { className: "mb-2", children: _jsx("img", { src: comment.imageUrl, alt: "Comment attachment", className: "rounded-lg max-w-xs w-full object-contain border border-border/40", onError: (e) => {
                                        e.currentTarget.style.display = 'none';
                                    } }) })), (comment.valueContribution || comment.discussionRole) && (_jsxs("div", { className: "mb-2 flex flex-wrap items-center gap-2", children: [comment.valueContribution && (_jsxs("div", { className: "px-2 py-0.5 bg-accent/10 text-accent rounded border border-accent/20 text-xs flex items-center gap-1", children: [_jsx("span", { children: "\u2B50" }), _jsx("span", { className: "font-semibold", children: (comment.valueContribution.total * 100).toFixed(0) })] })), comment.discussionRole && (_jsx("div", { className: "px-2 py-0.5 bg-backgroundElevated/60 text-textMuted rounded border border-border/50 text-xs capitalize", children: comment.discussionRole }))] })), _jsxs("div", { className: "flex items-center gap-3 mt-2", children: [currentUser && depth < maxDepth && (_jsx("button", { onClick: () => setIsReplying(!isReplying), className: "text-xs text-textMuted hover:text-primary transition-colors font-medium", children: "Reply" })), canDelete && (_jsxs(_Fragment, { children: [_jsxs("button", { onClick: handleDeleteClick, className: "text-xs text-textMuted hover:text-red-500 transition-colors font-medium flex items-center gap-1", title: isChirpAuthor && !isCommentAuthor ? "Delete comment (as post author)" : "Delete your comment", children: [_jsx(TrashIcon, { size: 12 }), "Delete"] }), _jsx(ConfirmDialog, { isOpen: showDeleteConfirm, title: "Delete Comment", message: isChirpAuthor && !isCommentAuthor
                                                    ? "Are you sure you want to delete this comment from your post? This action cannot be undone."
                                                    : "Are you sure you want to delete this comment? This action cannot be undone.", confirmText: "Delete", cancelText: "Cancel", confirmVariant: "danger", onConfirm: handleDeleteConfirm, onCancel: () => setShowDeleteConfirm(false) })] })), (comment.replyCount ?? 0) > 0 && (_jsxs(_Fragment, { children: [_jsx("button", { onClick: () => setIsCollapsed(!isCollapsed), className: "text-xs text-textMuted hover:text-primary transition-colors font-medium", children: isCollapsed
                                                    ? `Show ${comment.replyCount} repl${comment.replyCount !== 1 ? 'ies' : 'y'}`
                                                    : `Hide repl${comment.replyCount !== 1 ? 'ies' : 'y'}` }), _jsxs("span", { className: "text-xs text-textMuted", children: [comment.replyCount, " repl", comment.replyCount !== 1 ? 'ies' : 'y'] })] }))] }), isReplying && currentUser && (_jsx("div", { className: "mt-3", children: _jsxs("div", { className: "flex gap-3", children: [_jsx("div", { className: "flex-shrink-0", children: currentUser.profilePictureUrl ? (_jsx("img", { src: currentUser.profilePictureUrl, alt: currentUser.name, className: "w-8 h-8 rounded-full object-cover border border-border/50" })) : (_jsx("div", { className: "w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center border border-border/50", children: _jsx("span", { className: "text-primary font-semibold text-xs", children: currentUser.name.charAt(0).toUpperCase() }) })) }), _jsx("div", { className: "flex-1", children: _jsx(RichCommentEditor, { placeholder: `Reply to @${author.handle}...`, onSubmit: handleReplySubmit, onCancel: () => setIsReplying(false), replyToUser: replyToUser ? { name: replyToUser.name, handle: replyToUser.handle, id: replyToUser.id } : null }) })] }) }))] }), hasReplies && !isCollapsed && (_jsx("div", { className: "mt-2 space-y-2", children: comment.replies.map((reply) => (_jsx(CommentItem, { comment: reply, chirpId: chirpId, chirpAuthorId: chirpAuthorId, depth: depth + 1, maxDepth: maxDepth }, reply.id))) }))] })] }));
};
const CommentSection = ({ chirp, initialExpanded = false }) => {
    const [isExpanded, setIsExpanded] = useState(initialExpanded);
    const { addComment, getCommentTreeForChirp, loadComments, comments } = useFeedStore();
    const { currentUser } = useUserStore();
    const { theme } = useThemeStore();
    const commentTree = getCommentTreeForChirp(chirp.id);
    const { getUser } = useUserStore();
    useEffect(() => {
        if (chirp.commentCount > 0 && (!comments[chirp.id] || comments[chirp.id].length === 0)) {
            const loadChirpComments = async () => {
                try {
                    const chirpComments = await commentService.getCommentsForChirp(chirp.id);
                    if (chirpComments.length > 0) {
                        loadComments(chirp.id, chirpComments);
                        realtimeService.subscribeToComments(chirp.id, (comments) => {
                            loadComments(chirp.id, comments);
                        });
                    }
                }
                catch (error) {
                    console.error(`Error loading comments for chirp ${chirp.id}:`, error);
                }
            };
            loadChirpComments();
        }
    }, [chirp.id, chirp.commentCount, comments, loadComments]);
    const handleSubmit = async (data) => {
        if (!currentUser)
            return;
        try {
            await addComment({
                chirpId: chirp.id,
                authorId: currentUser.id,
                text: data.text,
                formattedText: data.formattedText,
                imageUrl: data.imageUrl,
                scheduledAt: data.scheduledAt,
            });
            tuningService.trackChirpEngagement(chirp.id);
        }
        catch (error) {
            console.error('Error posting comment:', error);
            throw error;
        }
    };
    return (_jsxs("div", { className: "mt-3 pt-3 border-t border-border/60", children: [_jsxs("button", { onClick: () => setIsExpanded(!isExpanded), className: "text-sm text-textMuted hover:text-primary transition-colors mb-3 font-medium flex items-center gap-1", children: [_jsx("span", { children: isExpanded ? 'Hide comments' : 'Show comments' }), _jsx("span", { className: "text-xs", children: isExpanded ? '↑' : '↓' })] }), isExpanded && (_jsxs("div", { className: "space-y-4 transition-all duration-200", children: [currentUser && (_jsx("div", { className: "space-y-2", children: _jsxs("div", { className: "flex gap-3", children: [_jsx("div", { className: "flex-shrink-0", children: currentUser.profilePictureUrl ? (_jsx("img", { src: currentUser.profilePictureUrl, alt: currentUser.name, className: "w-10 h-10 rounded-full object-cover border border-border/50" })) : (_jsx("div", { className: "w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center border border-border/50", children: _jsx("span", { className: "text-primary font-semibold text-sm", children: currentUser.name.charAt(0).toUpperCase() }) })) }), _jsx("div", { className: "flex-1", children: _jsx(RichCommentEditor, { placeholder: "Write a comment...", onSubmit: handleSubmit, onCancel: () => { } }) })] }) })), commentTree.length > 0 && (_jsx("div", { className: "space-y-3", children: commentTree.map((comment) => (_jsx(CommentItem, { comment: comment, chirpId: chirp.id, chirpAuthorId: chirp.authorId, depth: 0 }, comment.id))) })), commentTree.length === 0 && (_jsx("div", { className: "text-center py-6 text-textMuted text-sm", children: "No comments yet. Be the first to comment!" }))] }))] }));
};
export default CommentSection;
