import React from 'react';
import { StatusBar } from 'expo-status-bar';
import RootNavigator from './src/navigation/RootNavigator';
import { ComposerProvider } from './src/context/ComposerContext';
import ComposerModal from './src/components/Composer/ComposerModal';

export default function App() {
  return (
    <ComposerProvider>
      <StatusBar style="dark" />
      <RootNavigator />
      <ComposerModal />
    </ComposerProvider>
  );
}
