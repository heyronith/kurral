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

type ActionModalProps = {
  visible: boolean;
  onClose: () => void;
  title: string;
  message: string;
  type?: 'info' | 'success' | 'error' | 'warning';
  primaryAction?: {
    label: string;
    onPress: () => void;
    variant?: 'primary' | 'secondary';
  };
  secondaryAction?: {
    label: string;
    onPress: () => void;
  };
};

const ActionModal: React.FC<ActionModalProps> = ({
  visible,
  onClose,
  title,
  message,
  type = 'info',
  primaryAction,
  secondaryAction,
}) => {
  const { colors } = useTheme();
  
  const getIcon = () => {
    switch (type) {
      case 'success':
        return { name: 'checkmark-circle' as const, color: colors.success };
      case 'error':
        return { name: 'close-circle' as const, color: colors.error };
      case 'warning':
        return { name: 'warning' as const, color: '#F59E0B' };
      default:
        return { name: 'information-circle' as const, color: colors.accent };
    }
  };

  const icon = getIcon();
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
                <View style={dynamicStyles.headerLeft}>
                  <Ionicons name={icon.name} size={24} color={icon.color} />
                  <Text style={dynamicStyles.title}>{title}</Text>
                </View>
                <TouchableOpacity onPress={onClose} style={dynamicStyles.closeButton}>
                  <Ionicons name="close" size={24} color={colors.textMuted} />
                </TouchableOpacity>
              </View>

              {/* Content */}
              <View style={dynamicStyles.content}>
                <Text style={dynamicStyles.message}>{message}</Text>

                {/* Actions */}
                <View style={dynamicStyles.actions}>
                  {primaryAction && (
                    <TouchableOpacity
                      onPress={() => {
                        primaryAction.onPress();
                        onClose();
                      }}
                      style={[
                        dynamicStyles.actionButton,
                        primaryAction.variant === 'primary'
                          ? dynamicStyles.actionButtonPrimary
                          : dynamicStyles.actionButtonSecondary,
                      ]}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[
                          dynamicStyles.actionButtonText,
                          primaryAction.variant === 'primary' && dynamicStyles.actionButtonTextPrimary,
                        ]}
                      >
                        {primaryAction.label}
                      </Text>
                    </TouchableOpacity>
                  )}

                  {secondaryAction && (
                    <TouchableOpacity
                      onPress={() => {
                        secondaryAction.onPress();
                        onClose();
                      }}
                      style={[dynamicStyles.actionButton, dynamicStyles.actionButtonSecondary]}
                      activeOpacity={0.8}
                    >
                      <Text style={dynamicStyles.actionButtonText}>{secondaryAction.label}</Text>
                    </TouchableOpacity>
                  )}

                  {!primaryAction && !secondaryAction && (
                    <TouchableOpacity
                      onPress={onClose}
                      style={[dynamicStyles.actionButton, dynamicStyles.actionButtonPrimary]}
                      activeOpacity={0.8}
                    >
                      <Text style={dynamicStyles.actionButtonTextPrimary}>OK</Text>
                    </TouchableOpacity>
                  )}
                </View>
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
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    flex: 1,
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
    lineHeight: 22,
  },
  actions: {
    gap: 12,
  },
  actionButton: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonPrimary: {
    backgroundColor: colors.accent,
  },
  actionButtonSecondary: {
    backgroundColor: colors.accent + '1A',
    borderWidth: 2,
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
});

export default ActionModal;

