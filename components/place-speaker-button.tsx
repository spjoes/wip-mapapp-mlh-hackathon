import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, StyleSheet, TouchableOpacity } from 'react-native';

interface PlaceSpeakerButtonProps {
  isPlaying: boolean;
  isLoading?: boolean;
  onPress: () => void;
}

export const PlaceSpeakerButton = ({ 
  isPlaying, 
  isLoading = false,
  onPress, 
}: PlaceSpeakerButtonProps) => {
  return (
    <TouchableOpacity
      style={[
        styles.button,
        isPlaying && styles.buttonPlaying,
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {isLoading ? (
        <ActivityIndicator size="small" color="#8B5CF6" />
      ) : (
        <Ionicons
          name={isPlaying ? 'stop' : 'volume-medium'}
          size={16}
          color={isPlaying ? '#EF4444' : '#8B5CF6'}
        />
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonPlaying: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
  },
});
