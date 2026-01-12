import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  TextInput,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import type { BookmarkFolder } from '../types';

type BookmarkFolderModalProps = {
  visible: boolean;
  onClose: () => void;
  folders: BookmarkFolder[];
  onSelectFolder: (folderId: string) => void;
  onCreateFolder: (folderName: string) => void;
};

const BookmarkFolderModal: React.FC<BookmarkFolderModalProps> = ({
  visible,
  onClose,
  folders,
  onSelectFolder,
  onCreateFolder,
}) => {
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  useEffect(() => {
    if (!visible) {
      setShowCreateFolder(false);
      setNewFolderName('');
    }
  }, [visible]);

  const handleCreateFolder = () => {
    const trimmedName = newFolderName.trim();
    if (trimmedName.length > 0) {
      onCreateFolder(trimmedName);
      setNewFolderName('');
      setShowCreateFolder(false);
    }
  };

  const handleSelectFolder = (folderId: string) => {
    onSelectFolder(folderId);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback>
            <View style={styles.container}>
              {/* Header */}
              <View style={styles.header}>
                <Text style={styles.title}>Save to folder</Text>
                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                  <Ionicons name="close" size={24} color={colors.light.textMuted} />
                </TouchableOpacity>
              </View>

              {/* Content */}
              <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                {!showCreateFolder ? (
                  <>
                    {/* Create New Folder Button */}
                    <TouchableOpacity
                      onPress={() => setShowCreateFolder(true)}
                      style={styles.createFolderButton}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="add-circle-outline" size={24} color={colors.light.accent} />
                      <Text style={styles.createFolderText}>Create new folder</Text>
                    </TouchableOpacity>

                    {/* Folder List */}
                    {folders.length > 0 && (
                      <View style={styles.foldersList}>
                        <Text style={styles.sectionTitle}>Your folders</Text>
                        {folders.map((folder) => (
                          <TouchableOpacity
                            key={folder.id}
                            onPress={() => handleSelectFolder(folder.id)}
                            style={styles.folderItem}
                            activeOpacity={0.8}
                          >
                            <View style={styles.folderIcon}>
                              <Ionicons name="folder" size={20} color={colors.light.accent} />
                            </View>
                            <View style={styles.folderInfo}>
                              <Text style={styles.folderName}>{folder.name}</Text>
                              <Text style={styles.folderCount}>
                                {folder.chirpIds.length}{' '}
                                {folder.chirpIds.length === 1 ? 'bookmark' : 'bookmarks'}
                              </Text>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color={colors.light.textMuted} />
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}

                    {folders.length === 0 && (
                      <View style={styles.emptyState}>
                        <Ionicons name="folder-outline" size={48} color={colors.light.textMuted} />
                        <Text style={styles.emptyText}>No folders yet</Text>
                        <Text style={styles.emptySubtext}>
                          Create a folder to organize your bookmarks
                        </Text>
                      </View>
                    )}
                  </>
                ) : (
                  <View style={styles.createFolderView}>
                    <Text style={styles.createFolderTitle}>Create new folder</Text>
                    <TextInput
                      style={styles.folderNameInput}
                      placeholder="Folder name"
                      placeholderTextColor={colors.light.textMuted}
                      value={newFolderName}
                      onChangeText={setNewFolderName}
                      autoFocus
                      maxLength={50}
                    />
                    <View style={styles.createFolderActions}>
                      <TouchableOpacity
                        onPress={() => {
                          setShowCreateFolder(false);
                          setNewFolderName('');
                        }}
                        style={styles.cancelButton}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.cancelButtonText}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={handleCreateFolder}
                        style={[
                          styles.createButton,
                          newFolderName.trim().length === 0 && styles.createButtonDisabled,
                        ]}
                        activeOpacity={0.8}
                        disabled={newFolderName.trim().length === 0}
                      >
                        <Text
                          style={[
                            styles.createButtonText,
                            newFolderName.trim().length === 0 && styles.createButtonTextDisabled,
                          ]}
                        >
                          Create
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </ScrollView>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: colors.light.backgroundElevated,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.light.border,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.light.textPrimary,
  },
  closeButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    maxHeight: 500,
    padding: 20,
  },
  createFolderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(124, 58, 237, 0.1)',
    borderWidth: 2,
    borderColor: colors.light.accent,
    borderStyle: 'dashed',
    marginBottom: 24,
  },
  createFolderText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.light.accent,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.light.textMuted,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  foldersList: {
    gap: 8,
  },
  folderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.02)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.light.border,
  },
  folderIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(124, 58, 237, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  folderInfo: {
    flex: 1,
  },
  folderName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.light.textPrimary,
    marginBottom: 4,
  },
  folderCount: {
    fontSize: 13,
    color: colors.light.textMuted,
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.light.textPrimary,
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.light.textMuted,
    textAlign: 'center',
  },
  createFolderView: {
    paddingTop: 8,
  },
  createFolderTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.light.textPrimary,
    marginBottom: 20,
  },
  folderNameInput: {
    backgroundColor: 'rgba(0, 0, 0, 0.02)',
    borderWidth: 2,
    borderColor: colors.light.border,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: colors.light.textPrimary,
    marginBottom: 20,
  },
  createFolderActions: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'flex-end',
  },
  cancelButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.light.textMuted,
  },
  createButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: colors.light.accent,
  },
  createButtonDisabled: {
    backgroundColor: colors.light.border,
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  createButtonTextDisabled: {
    color: colors.light.textMuted,
  },
});

export default BookmarkFolderModal;

