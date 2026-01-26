import React from 'react';
import { StatusBar } from 'expo-status-bar';
import RootNavigator from './src/navigation/RootNavigator';
import { ComposerProvider } from './src/context/ComposerContext';
import ComposerModal from './src/components/Composer/ComposerModal';
import { useThemeStore } from './src/stores/useThemeStore';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function App() {
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/79478aa2-e9cd-47a0-9d85-d37e8b5e454c', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'mobile/App.tsx:8', message: 'App component mounting', data: {}, timestamp: Date.now(), sessionId: 'debug-session', hypothesisId: 'app-mount' }) }).catch(() => { });
  // #endregion
  const theme = useThemeStore((state) => state.theme);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ComposerProvider>
        <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
        <RootNavigator />
        <ComposerModal />
      </ComposerProvider>
    </GestureHandlerRootView>
  );
}
