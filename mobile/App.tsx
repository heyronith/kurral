import React from 'react';
import { StatusBar } from 'expo-status-bar';
import RootNavigator from './src/navigation/RootNavigator';
import { ComposerProvider } from './src/context/ComposerContext';
import ComposerModal from './src/components/Composer/ComposerModal';
import { useThemeStore } from './src/stores/useThemeStore';

export default function App() {
  const theme = useThemeStore((state) => state.theme);
  
  return (
    <ComposerProvider>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
      <RootNavigator />
      <ComposerModal />
    </ComposerProvider>
  );
}
