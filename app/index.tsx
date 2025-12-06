import { Ionicons } from '@expo/vector-icons';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import * as Location from 'expo-location';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Dimensions,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import MapView, { PROVIDER_GOOGLE } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface Guide {
  id: string;
  name: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}

const GUIDES: Guide[] = [
  {
    id: 'historian',
    name: 'The Historian',
    description: 'Uncover hidden stories & landmarks',
    icon: 'library-outline',
    color: '#8B5CF6',
  },
  {
    id: 'foodie',
    name: 'Local Foodie',
    description: 'Discover authentic flavors nearby',
    icon: 'restaurant-outline',
    color: '#F59E0B',
  },
  {
    id: 'adventurer',
    name: 'Adventure Scout',
    description: 'Find thrilling experiences',
    icon: 'compass-outline',
    color: '#10B981',
  },
];

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const bottomSheetRef = useRef<BottomSheet>(null);
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [selectedGuide, setSelectedGuide] = useState<string | null>(null);
  const [promptText, setPromptText] = useState('');
  const [permissionStatus, setPermissionStatus] = useState<'pending' | 'granted' | 'denied'>('pending');

  // Snap points for the bottom sheet
  const snapPoints = useMemo(() => ['38%', '65%', '90%'], []);

  useEffect(() => {
    requestLocationPermission();
  }, []);

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        setPermissionStatus('denied');
        Alert.alert(
          'Location Access Required',
          'Please enable location services to see your position on the map and get personalized recommendations.',
          [{ text: 'OK' }]
        );
        return;
      }

      setPermissionStatus('granted');
      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setLocation(currentLocation);
    } catch (error) {
      console.error('Error getting location:', error);
      setPermissionStatus('denied');
    }
  };

  const handleGuideSelect = (guideId: string) => {
    setSelectedGuide(guideId === selectedGuide ? null : guideId);
  };

  const handleSubmit = () => {
    if (!promptText.trim()) return;
    
    const guide = GUIDES.find(g => g.id === selectedGuide);
    Alert.alert(
      'Coming Soon!',
      `Your request: "${promptText}"\n${guide ? `Guide: ${guide.name}` : 'No guide selected'}\n\nAI backend integration coming soon!`,
      [{ text: 'OK' }]
    );
  };

  const handleSheetChanges = useCallback((index: number) => {
    // Optional: handle sheet position changes
  }, []);

  return (
    <GestureHandlerRootView style={styles.container}>
      {/* Full Screen Map */}
      <MapView
        style={styles.map}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        showsUserLocation={permissionStatus === 'granted'}
        showsMyLocationButton={false}
        showsCompass={true}
        mapPadding={{
          top: 0,
          right: 0,
          bottom: SCREEN_HEIGHT * 0.45,
          left: 0,
        }}
        initialRegion={{
          latitude: location?.coords.latitude ?? 37.7749,
          longitude: location?.coords.longitude ?? -122.4194,
          latitudeDelta: 0.0922,
          longitudeDelta: 0.0421,
        }}
        region={
          location
            ? {
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
                latitudeDelta: 0.0122,
                longitudeDelta: 0.0121,
              }
            : undefined
        }
      />

      {/* Location Button */}
      <TouchableOpacity 
        style={[styles.locationButton, { top: insets.top + 16 }]}
        onPress={requestLocationPermission}
        activeOpacity={0.8}
      >
        <Ionicons 
          name={permissionStatus === 'granted' ? 'navigate' : 'navigate-outline'} 
          size={22} 
          color={permissionStatus === 'granted' ? '#8B5CF6' : '#64748B'} 
        />
      </TouchableOpacity>

      {/* Bottom Sheet */}
      <BottomSheet
        ref={bottomSheetRef}
        index={0}
        snapPoints={snapPoints}
        onChange={handleSheetChanges}
        backgroundStyle={styles.sheetBackground}
        handleIndicatorStyle={styles.handleIndicator}
        enablePanDownToClose={false}
        enableOverDrag={true}
      >
        <BottomSheetView style={[styles.sheetContent, { paddingBottom: insets.bottom + 16 }]}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.greeting}>Ready to explore?</Text>
            <Text style={styles.subGreeting}>Your AI travel companions are here to help</Text>
          </View>

          {/* Prompt Input */}
          <View style={styles.promptContainer}>
            <View style={styles.inputWrapper}>
              <Ionicons name="sparkles" size={20} color="#8B5CF6" style={styles.inputIcon} />
              <TextInput
                style={styles.promptInput}
                placeholder="What would you like to do today?"
                placeholderTextColor="#9CA3AF"
                value={promptText}
                onChangeText={setPromptText}
                multiline={false}
                returnKeyType="send"
                onSubmitEditing={handleSubmit}
              />
              <TouchableOpacity 
                style={[styles.sendButton, !promptText.trim() && styles.sendButtonDisabled]}
                onPress={handleSubmit}
                disabled={!promptText.trim()}
              >
                <Ionicons name="arrow-forward" size={18} color="#FFF" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Guide Selection */}
          <View style={styles.guidesSection}>
            <Text style={styles.guidesTitle}>Choose your guide</Text>
            <View style={styles.guidesContainer}>
              {GUIDES.map((guide) => (
                <TouchableOpacity
                  key={guide.id}
                  style={[
                    styles.guideCard,
                    selectedGuide === guide.id && styles.guideCardSelected,
                    selectedGuide === guide.id && { borderColor: guide.color },
                  ]}
                  onPress={() => handleGuideSelect(guide.id)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.guideIconContainer, { backgroundColor: guide.color + '20' }]}>
                    <Ionicons name={guide.icon} size={24} color={guide.color} />
                  </View>
                  <Text style={styles.guideName}>{guide.name}</Text>
                  <Text style={styles.guideDescription}>{guide.description}</Text>
                  {selectedGuide === guide.id && (
                    <View style={[styles.selectedIndicator, { backgroundColor: guide.color }]}>
                      <Ionicons name="checkmark" size={12} color="#FFF" />
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </BottomSheetView>
      </BottomSheet>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  locationButton: {
    position: 'absolute',
    right: 16,
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
    borderWidth: 1,
    borderColor: 'rgba(51, 65, 85, 0.5)',
  },
  sheetBackground: {
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 16,
  },
  handleIndicator: {
    backgroundColor: '#475569',
    width: 36,
    height: 4,
  },
  sheetContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  header: {
    marginBottom: 20,
  },
  greeting: {
    fontSize: 26,
    fontWeight: '700',
    color: '#F8FAFC',
    letterSpacing: -0.5,
  },
  subGreeting: {
    fontSize: 15,
    color: '#94A3B8',
    marginTop: 4,
  },
  promptContainer: {
    marginBottom: 24,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 16,
    paddingLeft: 16,
    paddingRight: 6,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  inputIcon: {
    marginRight: 12,
  },
  promptInput: {
    flex: 1,
    fontSize: 16,
    color: '#F8FAFC',
    paddingVertical: 10,
  },
  sendButton: {
    backgroundColor: '#8B5CF6',
    borderRadius: 12,
    padding: 12,
  },
  sendButtonDisabled: {
    backgroundColor: '#4C1D95',
    opacity: 0.5,
  },
  guidesSection: {
    flex: 1,
  },
  guidesTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#CBD5E1',
    marginBottom: 14,
  },
  guidesContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  guideCard: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 14,
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative',
  },
  guideCardSelected: {
    backgroundColor: '#1E293B',
  },
  guideIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  guideName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F8FAFC',
    marginBottom: 4,
  },
  guideDescription: {
    fontSize: 11,
    color: '#94A3B8',
    lineHeight: 15,
  },
  selectedIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
