import { ACCENT_OPTIONS, AccentType } from '@/services/audio-narration';
import { Ionicons } from '@expo/vector-icons';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface AccentPickerModalProps {
  visible: boolean;
  selectedAccent: AccentType;
  onSelect: (accent: AccentType) => void;
  onClose: () => void;
}

const ACCENT_ICONS: Record<AccentType, string> = {
  american: '🇺🇸',
  australian: '🇦🇺',
  british: '🇬🇧',
  scottish: '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
  other: '🌍',
};

export const AccentPickerModal = ({
  visible,
  selectedAccent,
  onSelect,
  onClose,
}: AccentPickerModalProps) => {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity 
        style={styles.overlay} 
        activeOpacity={1} 
        onPress={onClose}
      >
        <View 
          style={[styles.container, { paddingBottom: insets.bottom + 16 }]}
          onStartShouldSetResponder={() => true}
        >
          <View style={styles.header}>
            <Text style={styles.title}>Choose Voice Accent</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#64748B" />
            </TouchableOpacity>
          </View>
          
          <Text style={styles.subtitle}>
            Select an accent for your journey narration
          </Text>

          <View style={styles.optionsList}>
            {ACCENT_OPTIONS.map((accent) => (
              <TouchableOpacity
                key={accent.id}
                style={[
                  styles.option,
                  selectedAccent === accent.id && styles.optionSelected,
                ]}
                onPress={() => {
                  onSelect(accent.id);
                  onClose();
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.optionFlag}>{ACCENT_ICONS[accent.id]}</Text>
                <View style={styles.optionText}>
                  <Text style={[
                    styles.optionName,
                    selectedAccent === accent.id && styles.optionNameSelected,
                  ]}>
                    {accent.name}
                  </Text>
                  <Text style={styles.optionDescription}>
                    {accent.description}
                  </Text>
                </View>
                {selectedAccent === accent.id && (
                  <Ionicons name="checkmark-circle" size={24} color="#8B5CF6" />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 16,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
  },
  closeButton: {
    padding: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 20,
  },
  optionsList: {
    gap: 12,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  optionSelected: {
    backgroundColor: '#F5F3FF',
    borderColor: '#8B5CF6',
  },
  optionFlag: {
    fontSize: 28,
    marginRight: 14,
  },
  optionText: {
    flex: 1,
  },
  optionName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 2,
  },
  optionNameSelected: {
    color: '#8B5CF6',
  },
  optionDescription: {
    fontSize: 13,
    color: '#64748B',
  },
});
