import React from 'react';
import { Modal, StyleSheet, View, TouchableOpacity, TouchableWithoutFeedback } from 'react-native';
import { ThemedText } from './ThemedText';
import { useTheme } from '../context/ThemeContext';

interface ConfirmModalProps {
  visible: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  onNeutral?: () => void;
  onDismiss?: () => void;
  confirmText?: string;
  cancelText?: string;
  neutralText?: string;
  confirmVariant?: 'danger' | 'primary' | 'neutral';
  cancelVariant?: 'danger' | 'primary' | 'neutral';
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  visible,
  title,
  message,
  onConfirm,
  onCancel,
  onNeutral,
  onDismiss,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  neutralText,
  confirmVariant = 'danger',
  cancelVariant = 'neutral',
}) => {
  const { colors, isDark } = useTheme();

  const getButtonStyle = (variant: 'danger' | 'primary' | 'neutral') => {
    if (variant === 'danger') {
      return { backgroundColor: colors.error, borderColor: colors.border, textColor: '#FFFFFF' };
    }
    if (variant === 'primary') {
      return { backgroundColor: colors.primary, borderColor: colors.border, textColor: '#111111' };
    }
    return { backgroundColor: colors.background, borderColor: colors.border, textColor: colors.text };
  };

  const cancelBtn = getButtonStyle(cancelVariant);
  const confirmBtn = getButtonStyle(confirmVariant);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss || onCancel}>
      <View style={styles.overlay}>
        <TouchableWithoutFeedback>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: isDark ? 'transparent' : colors.shadow }]}>
            <ThemedText type="subtitle" style={styles.title}>{title}</ThemedText>
            <ThemedText style={styles.message}>{message}</ThemedText>

            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.button, { backgroundColor: cancelBtn.backgroundColor, borderColor: cancelBtn.borderColor }]}
                onPress={onCancel}
              >
                <ThemedText style={[styles.buttonText, { color: cancelBtn.textColor }]}>{cancelText}</ThemedText>
              </TouchableOpacity>
              
              {onNeutral && (
                <TouchableOpacity
                  style={[styles.button, { backgroundColor: colors.background, borderColor: colors.primary }]}
                  onPress={onNeutral}
                >
                  <ThemedText style={[styles.buttonText, { color: colors.primary }]}>{neutralText}</ThemedText>
                </TouchableOpacity>
              )}
              
              <TouchableOpacity
                style={[styles.button, { backgroundColor: confirmBtn.backgroundColor, borderColor: confirmBtn.borderColor }]}
                onPress={onConfirm}
              >
                <ThemedText style={[styles.buttonText, { color: confirmBtn.textColor }]}>{confirmText}</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    borderWidth: 2,
    padding: 24,
    shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  title: {
    marginBottom: 8,
    fontFamily: 'SpaceGrotesk-Bold',
  },
  message: {
    marginBottom: 24,
    lineHeight: 22,
  },
  actions: {
    flexDirection: 'column',
    gap: 12,
  },
  button: {
    borderWidth: 2,
    paddingVertical: 12,
    paddingHorizontal: 16,
    width: '100%',
    alignItems: 'center',
  },
  buttonText: {
    fontFamily: 'SpaceGrotesk-Bold',
  },
});
