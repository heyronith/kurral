import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';

type RepostModalProps = {
  visible: boolean;
  onClose: () => void;
  onJustRepost: () => void;
  onAddThoughts: () => void;
};

const RepostModal: React.FC<RepostModalProps> = ({
  visible,
  onClose,
  onJustRepost,
  onAddThoughts,
}) => {
  const { colors } = useTheme();
  const dynamicStyles = getStyles(colors);

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={dynamicStyles.backdrop}>
          <TouchableWithoutFeedback>
            <View style={dynamicStyles.container}>
              {/* Header */}
              <View style={dynamicStyles.header}>
                <Text style={dynamicStyles.title}>Repost</Text>
                <TouchableOpacity onPress={onClose} style={dynamicStyles.closeButton}>
                  <Ionicons name="close" size={24} color={colors.textMuted} />
                </TouchableOpacity>
              </View>

              {/* Content */}
              <View style={dynamicStyles.content}>
                <Text style={dynamicStyles.message}>How would you like to repost this?</Text>

                {/* Action Buttons */}
                <View style={dynamicStyles.actions}>
                  <TouchableOpacity
                    onPress={() => {
                      onJustRepost();
                      onClose();
                    }}
                    style={dynamicStyles.actionButton}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="repeat" size={20} color={colors.accent} />
                    <Text style={dynamicStyles.actionButtonText}>Just repost</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => {
                      onAddThoughts();
                      onClose();
                    }}
                    style={[dynamicStyles.actionButton, dynamicStyles.actionButtonPrimary]}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="create-outline" size={20} color="#fff" />
                    <Text style={dynamicStyles.actionButtonTextPrimary}>Add thoughts</Text>
                  </TouchableOpacity>
                </View>

                {/* Cancel Button */}
                <TouchableOpacity
                  onPress={onClose}
                  style={dynamicStyles.cancelButton}
                  activeOpacity={0.8}
                >
                  <Text style={dynamicStyles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const getStyles = (colors: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    backgroundColor: colors.backgroundElevated,
    borderRadius: 20,
    width: '100%',
    maxWidth: 400,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  closeButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: 20,
  },
  message: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: 24,
    textAlign: 'center',
  },
  actions: {
    gap: 12,
    marginBottom: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: colors.accent + '1A',
    borderWidth: 2,
    borderColor: colors.accent,
  },
  actionButtonPrimary: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.accent,
  },
  actionButtonTextPrimary: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  cancelButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textMuted,
  },
});

export default RepostModal;

