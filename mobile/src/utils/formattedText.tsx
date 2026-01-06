import React from 'react';
import { Text, TextProps, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

/**
 * Renders formatted HTML text (from formattedText field) as React Native Text components
 * Supports: <strong>, <em>, <br>, and mention links
 */
export const renderFormattedText = (
  html: string,
  textStyle?: TextProps['style']
): React.ReactElement => {
  if (!html) return <Text style={textStyle}></Text>;

  // Parse HTML and convert to React Native Text components
  const parts: Array<{ text: string; bold?: boolean; italic?: boolean; mention?: boolean }> = [];
  let currentText = '';
  let inBold = false;
  let inItalic = false;

  // Simple HTML parser for our specific use case
  let i = 0;
  while (i < html.length) {
    if (html.substring(i).startsWith('<strong>')) {
      if (currentText) {
        parts.push({ text: currentText, bold: inBold, italic: inItalic });
        currentText = '';
      }
      inBold = true;
      i += 8; // '<strong>'.length
    } else if (html.substring(i).startsWith('</strong>')) {
      if (currentText) {
        parts.push({ text: currentText, bold: inBold, italic: inItalic });
        currentText = '';
      }
      inBold = false;
      i += 9; // '</strong>'.length
    } else if (html.substring(i).startsWith('<em>')) {
      if (currentText) {
        parts.push({ text: currentText, bold: inBold, italic: inItalic });
        currentText = '';
      }
      inItalic = true;
      i += 4; // '<em>'.length
    } else if (html.substring(i).startsWith('</em>')) {
      if (currentText) {
        parts.push({ text: currentText, bold: inBold, italic: inItalic });
        currentText = '';
      }
      inItalic = false;
      i += 5; // '</em>'.length
    } else if (html.substring(i).startsWith('<br') || html.substring(i).startsWith('<BR')) {
      if (currentText) {
        parts.push({ text: currentText, bold: inBold, italic: inItalic });
        currentText = '';
      }
      parts.push({ text: '\n', bold: inBold, italic: inItalic });
      // Skip to end of <br> or <br />
      const brEnd = html.indexOf('>', i);
      i = brEnd >= 0 ? brEnd + 1 : html.length;
    } else if (html.substring(i).startsWith('<a')) {
      // Extract mention handle from data-mention attribute
      const aEnd = html.indexOf('</a>', i);
      if (aEnd >= 0) {
        const aTag = html.substring(i, html.indexOf('>', i) + 1);
        const mentionMatch = aTag.match(/data-mention="([^"]+)"/);
        if (mentionMatch) {
          if (currentText) {
            parts.push({ text: currentText, bold: inBold, italic: inItalic });
            currentText = '';
          }
          // Add mention as text (we'll style it differently)
          parts.push({ text: `@${mentionMatch[1]}`, bold: inBold, italic: inItalic, mention: true });
          i = aEnd + 4; // '</a>'.length
        } else {
          currentText += html[i];
          i++;
        }
      } else {
        currentText += html[i];
        i++;
      }
    } else {
      // Regular character
      currentText += html[i];
      i++;
    }
  }

  // Add remaining text
  if (currentText) {
    parts.push({ text: currentText, bold: inBold, italic: inItalic });
  }

  // Render parts as Text components
  return (
    <Text style={textStyle}>
      {parts.map((part, index) => {
        const style: any = {};
        if (part.bold) style.fontWeight = '700';
        if (part.italic) style.fontStyle = 'italic';
        if (part.mention) {
          style.color = colors.light.accent;
        }

        return (
          <Text key={index} style={style}>
            {part.text}
          </Text>
        );
      })}
    </Text>
  );
};

