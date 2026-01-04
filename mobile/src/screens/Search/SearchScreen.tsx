import React from 'react';
import { View, Text, StyleSheet, TextInput } from 'react-native';
import { colors } from '../../theme/colors';

const SearchScreen = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Search</Text>
      <TextInput
        placeholder="Search people, topics, or chirps"
        placeholderTextColor={colors.light.textMuted}
        style={styles.input}
      />
      <Text style={styles.subtitle}>
        Search and discovery are coming soon. For now, use the Home tab to
        browse the feed.
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.light.background,
    padding: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.light.textPrimary,
    marginBottom: 12,
  },
  input: {
    backgroundColor: colors.light.backgroundElevated,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.light.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.light.textPrimary,
  },
  subtitle: {
    marginTop: 16,
    color: colors.light.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
});

export default SearchScreen;


