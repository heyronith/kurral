import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useComposer } from '../../context/ComposerContext';
import { useTheme } from '../../hooks/useTheme';

const ComposeFab = () => {
  const { open } = useComposer();
  const { colors } = useTheme();
  const dynamicStyles = getStyles(colors);

  return (
    <View style={dynamicStyles.container} pointerEvents="box-none">
      <TouchableOpacity style={dynamicStyles.button} onPress={open} activeOpacity={0.85}>
        <Text style={dynamicStyles.plus}>＋</Text>
      </TouchableOpacity>
    </View>
  );
};

const getStyles = (colors: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  container: {
    position: 'absolute',
    right: 16,
    bottom: 24,
  },
  button: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  plus: {
    color: '#fff',
    fontSize: 30,
    fontWeight: '700',
  },
});

export default ComposeFab;


