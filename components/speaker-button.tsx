import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from 'react-native';

interface SpeakerButtonProps {
  isPlaying: boolean;
  isLoading?: boolean;
  onPress: () => void;
  onLongPress: () => void;
}

export const SpeakerButton = ({ 
  isPlaying, 
  isLoading = false,
  onPress, 
  onLongPress 
}: SpeakerButtonProps) => {
  return (
    <TouchableOpacity
      style={[
        styles.button,
        isPlaying && styles.buttonPlaying,
      ]}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.7}
      delayLongPress={500}
    >
      {isLoading ? (
        <ActivityIndicator size="small" color="#8B5CF6" />
      ) : (
        <View style={styles.iconContainer}>
          <Ionicons
            name={isPlaying ? 'stop-circle' : 'volume-high'}
            size={22}
            color={isPlaying ? '#EF4444' : '#8B5CF6'}
          />
          {isPlaying && (
            <View style={styles.playingIndicator}>
              <View style={[styles.soundBar, styles.soundBar1]} />
              <View style={[styles.soundBar, styles.soundBar2]} />
              <View style={[styles.soundBar, styles.soundBar3]} />
            </View>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  buttonPlaying: {
    backgroundColor: '#FEF2F2',
    borderWidth: 2,
    borderColor: '#FECACA',
  },
  iconContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  playingIndicator: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginLeft: 2,
    height: 12,
  },
  soundBar: {
    width: 2,
    backgroundColor: '#EF4444',
    marginHorizontal: 1,
    borderRadius: 1,
  },
  soundBar1: {
    height: 4,
  },
  soundBar2: {
    height: 8,
  },
  soundBar3: {
    height: 6,
  },
});
