import { Ionicons } from '@expo/vector-icons';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import * as Location from 'expo-location';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

import { hasApiKey, sendAgentMessage, setAgentApiKey } from '@/services/agent';
import { formatDistance, formatDuration, getOptimizedRoute } from '@/services/routing';

interface Guide {
  id: string;
  name: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  personality: string;
}

interface Place {
  name: string;
  description: string;
  lat: number;
  lng: number;
}

interface AgentResponseData {
  message: string;
  places: Place[];
}

const RESPONSE_FORMAT_INSTRUCTIONS = `

IMPORTANT: You must respond with a valid JSON object in this exact format:
{
  "message": "Your friendly response text here with descriptions and tips",
  "places": [
    {
      "name": "Place Name",
      "description": "Brief description of why to visit",
      "lat": 12.345678,
      "lng": -98.765432
    }
  ]
}

Include 3-5 places in your response. The coordinates should be real, accurate GPS coordinates for the locations you recommend. Only respond with the JSON object, no other text.`;

const GUIDES: Guide[] = [
  {
    id: 'historian',
    name: 'The Historian',
    description: 'Uncover hidden stories & landmarks',
    icon: 'library-outline',
    color: '#8B5CF6',
    personality: `You are "The Historian," a passionate and knowledgeable travel guide who specializes in history, culture, and heritage. You speak with enthusiasm about the past, weaving fascinating stories about historical events, architectural marvels, and cultural significance of places.

Your style:
- Share captivating historical anecdotes and lesser-known facts
- Connect past events to present-day locations the user can visit
- Recommend museums, historical landmarks, heritage sites, and walking tours
- Explain the cultural context and significance of traditions
- Use vivid, storytelling language that brings history to life

Always provide specific, actionable recommendations based on the user's location when available. Be warm, engaging, and make history feel accessible and exciting.${RESPONSE_FORMAT_INSTRUCTIONS}`,
  },
  {
    id: 'foodie',
    name: 'Local Foodie',
    description: 'Discover authentic flavors nearby',
    icon: 'restaurant-outline',
    color: '#F59E0B',
    personality: `You are "Local Foodie," an enthusiastic culinary guide who lives and breathes food culture. You have an intimate knowledge of local cuisines, hidden gem restaurants, street food, and authentic dining experiences.

Your style:
- Recommend restaurants, cafes, food markets, and street food vendors
- Explain the cultural significance of local dishes and ingredients
- Share insider tips on the best times to visit and what to order
- Suggest food tours, cooking classes, and culinary experiences
- Balance between hidden gems and must-try classics
- Consider dietary preferences when making recommendations

Always provide specific restaurant names, dishes to try, and practical tips like price ranges and reservation needs. Be passionate about food and make the user hungry to explore!${RESPONSE_FORMAT_INSTRUCTIONS}`,
  },
  {
    id: 'adventurer',
    name: 'Adventure Scout',
    description: 'Find thrilling experiences',
    icon: 'compass-outline',
    color: '#10B981',
    personality: `You are "Adventure Scout," an energetic and daring travel guide who specializes in outdoor activities, unique experiences, and off-the-beaten-path adventures. You thrive on excitement and helping travelers step outside their comfort zone.

Your style:
- Recommend hiking trails, water sports, climbing spots, and outdoor activities
- Suggest unique experiences like hot air balloon rides, zip-lining, or wildlife encounters
- Share tips on the best times, gear needed, and difficulty levels
- Balance adrenaline-pumping activities with scenic nature experiences
- Provide safety tips and practical logistics
- Know about hidden viewpoints, secret beaches, and lesser-known natural wonders

Always consider the user's fitness level and preferences. Be enthusiastic, encouraging, and help users create unforgettable adventure memories!${RESPONSE_FORMAT_INSTRUCTIONS}`,
  },
];

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const bottomSheetRef = useRef<BottomSheet>(null);
  const mapRef = useRef<MapView>(null);
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [selectedGuide, setSelectedGuide] = useState<string | null>(null);
  const [promptText, setPromptText] = useState('');
  const [permissionStatus, setPermissionStatus] = useState<'pending' | 'granted' | 'denied'>('pending');
  
  // Agent state
  const [isLoading, setIsLoading] = useState(false);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showResponseModal, setShowResponseModal] = useState(false);
  const [agentResponse, setAgentResponse] = useState<AgentResponseData | null>(null);
  const [selectedPlaces, setSelectedPlaces] = useState<Set<number>>(new Set());
  
  // Itinerary state
  const [itinerary, setItinerary] = useState<Place[]>([]);
  const [routeCoordinates, setRouteCoordinates] = useState<{ latitude: number; longitude: number }[]>([]);
  const [routeInfo, setRouteInfo] = useState<{ duration: number; distance: number } | null>(null);

  // Snap points for the bottom sheet
  const snapPoints = useMemo(() => ['38%', '65%', '90%'], []);

  useEffect(() => {
    requestLocationPermission();
  }, []);

  // Calculate route when itinerary changes
  useEffect(() => {
    if (itinerary.length === 0) {
      setRouteCoordinates([]);
      setRouteInfo(null);
      return;
    }

    const calculateRoute = async () => {
      const userLoc = location ? {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      } : null;

      const result = await getOptimizedRoute(userLoc, itinerary);
      
      if (result.success && result.coordinates) {
        setRouteCoordinates(result.coordinates);
        if (result.duration !== undefined && result.distance !== undefined) {
          setRouteInfo({ duration: result.duration, distance: result.distance });
        }
        
        // Fit map to show all points
        if (mapRef.current && result.coordinates.length > 0) {
          const allPoints = [...result.coordinates];
          if (userLoc) {
            allPoints.unshift(userLoc);
          }
          
          setTimeout(() => {
            mapRef.current?.fitToCoordinates(allPoints, {
              edgePadding: { 
                top: 100, 
                right: 50, 
                bottom: SCREEN_HEIGHT * 0.45, 
                left: 50 
              },
              animated: true,
            });
          }, 300);
        }
      }
    };

    calculateRoute();
  }, [itinerary, location]);

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

  const handleLetsGo = async () => {
    if (!selectedGuide || isLoading) return;

    // Check if API key is configured
    if (!hasApiKey()) {
      setShowApiKeyModal(true);
      return;
    }

    await startAgentConversation();
  };

  const handleSaveApiKey = async () => {
    if (!apiKeyInput.trim()) {
      Alert.alert('Error', 'Please enter an API key');
      return;
    }
    setAgentApiKey(apiKeyInput.trim());
    setShowApiKeyModal(false);
    setApiKeyInput('');
    
    // Start the conversation after saving key
    await startAgentConversation();
  };

  const startAgentConversation = async () => {
    const guide = GUIDES.find(g => g.id === selectedGuide);
    if (!guide) return;

    setIsLoading(true);

    // Build the user message
    const userMessage = promptText.trim() 
      ? promptText 
      : "I'm exploring the area. What do you recommend I check out today?";

    // Get location context if available
    const locationContext = location 
      ? { latitude: location.coords.latitude, longitude: location.coords.longitude }
      : undefined;

    const response = await sendAgentMessage(
      guide.personality,
      userMessage,
      locationContext
    );

    setIsLoading(false);

    if (response.success && response.message) {
      try {
        // Parse the JSON response
        const parsed: AgentResponseData = JSON.parse(response.message);
        setAgentResponse(parsed);
        setShowResponseModal(true);
        setPromptText(''); // Clear the input after successful response
      } catch (parseError) {
        // If JSON parsing fails, show as plain text
        console.error('Failed to parse agent response as JSON:', parseError);
        setAgentResponse({ 
          message: response.message, 
          places: [] 
        });
        setShowResponseModal(true);
        setPromptText('');
      }
    } else {
      Alert.alert(
        'Connection Error',
        response.error || 'Failed to connect to your guide. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  const handleSubmit = () => {
    if (!promptText.trim()) return;
    handleLetsGo();
  };

  const togglePlaceSelection = (index: number) => {
    setSelectedPlaces(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  const handleAddToItinerary = () => {
    if (!agentResponse || selectedPlaces.size === 0) return;
    
    const placesToAdd = agentResponse.places.filter((_, index) => selectedPlaces.has(index));
    setItinerary(prev => [...prev, ...placesToAdd]);
    
    // Close modal and reset selection
    setShowResponseModal(false);
    setSelectedPlaces(new Set());
    setAgentResponse(null);
  };

  const handleRetry = () => {
    setShowResponseModal(false);
    setSelectedPlaces(new Set());
    setAgentResponse(null);
  };

  const handleSheetChanges = useCallback((index: number) => {
    // Optional: handle sheet position changes
  }, []);

  return (
    <GestureHandlerRootView style={styles.container}>
      {/* Full Screen Map */}
      <MapView
        ref={mapRef}
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
          itinerary.length === 0 && location
            ? {
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
                latitudeDelta: 0.0122,
                longitudeDelta: 0.0121,
              }
            : undefined
        }
      >
        {/* Route Polyline */}
        {routeCoordinates.length > 1 && (
          <Polyline
            coordinates={routeCoordinates}
            strokeColor="#8B5CF6"
            strokeWidth={4}
            lineDashPattern={[0]}
          />
        )}
        
        {/* Itinerary Markers */}
        {itinerary.map((place, index) => (
          <Marker
            key={`itinerary-${index}`}
            coordinate={{ latitude: place.lat, longitude: place.lng }}
            title={place.name}
            description={place.description}
          >
            <View style={styles.markerContainer}>
              <View style={styles.markerBubble}>
                <Text style={styles.markerNumber}>{index + 1}</Text>
              </View>
              <View style={styles.markerTail} />
            </View>
          </Marker>
        ))}
      </MapView>

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

      {/* Route Info Card */}
      {itinerary.length > 0 && (
        <View style={[styles.routeInfoCard, { top: insets.top + 16 }]}>
          <View style={styles.routeInfoHeader}>
            <Ionicons name="map" size={18} color="#8B5CF6" />
            <Text style={styles.routeInfoTitle}>Your Itinerary</Text>
          </View>
          <View style={styles.routeInfoDetails}>
            <View style={styles.routeInfoItem}>
              <Ionicons name="location" size={14} color="#10B981" />
              <Text style={styles.routeInfoText}>{itinerary.length} stops</Text>
            </View>
            {routeInfo && (
              <>
                <View style={styles.routeInfoDivider} />
                <View style={styles.routeInfoItem}>
                  <Ionicons name="time" size={14} color="#F59E0B" />
                  <Text style={styles.routeInfoText}>{formatDuration(routeInfo.duration)}</Text>
                </View>
                <View style={styles.routeInfoDivider} />
                <View style={styles.routeInfoItem}>
                  <Ionicons name="navigate" size={14} color="#8B5CF6" />
                  <Text style={styles.routeInfoText}>{formatDistance(routeInfo.distance)}</Text>
                </View>
              </>
            )}
          </View>
          <TouchableOpacity 
            style={styles.clearItineraryButton}
            onPress={() => setItinerary([])}
          >
            <Ionicons name="close-circle" size={16} color="#EF4444" />
            <Text style={styles.clearItineraryText}>Clear</Text>
          </TouchableOpacity>
        </View>
      )}

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

            {/* Let's Go Button */}
            <TouchableOpacity
              style={[
                styles.letsGoButton,
                (!selectedGuide || isLoading) && styles.letsGoButtonDisabled,
              ]}
              onPress={handleLetsGo}
              disabled={!selectedGuide || isLoading}
              activeOpacity={0.8}
            >
              {isLoading ? (
                <>
                  <ActivityIndicator size="small" color="#FFF" />
                  <Text style={styles.letsGoButtonText}>Connecting...</Text>
                </>
              ) : (
                <>
                  <Text style={[
                    styles.letsGoButtonText,
                    !selectedGuide && styles.letsGoButtonTextDisabled,
                  ]}>
                    Let's go!
                  </Text>
                  <Ionicons 
                    name="arrow-forward-circle" 
                    size={22} 
                    color={selectedGuide ? '#FFF' : '#64748B'} 
                  />
                </>
              )}
            </TouchableOpacity>
          </View>
        </BottomSheetView>
      </BottomSheet>

      {/* API Key Modal */}
      <Modal
        visible={showApiKeyModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowApiKeyModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHeader}>
              <Ionicons name="key-outline" size={28} color="#8B5CF6" />
              <Text style={styles.modalTitle}>API Key Required</Text>
            </View>
            <Text style={styles.modalSubtitle}>
              Enter your Digital Ocean Agent API key to connect with your AI travel guides.
            </Text>
            <TextInput
              style={styles.apiKeyInput}
              placeholder="Enter your API key..."
              placeholderTextColor="#64748B"
              value={apiKeyInput}
              onChangeText={setApiKeyInput}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => {
                  setShowApiKeyModal(false);
                  setApiKeyInput('');
                }}
              >
                <Text style={styles.modalCancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSaveButton}
                onPress={handleSaveApiKey}
              >
                <Text style={styles.modalSaveButtonText}>Save & Connect</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Response Modal */}
      <Modal
        visible={showResponseModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowResponseModal(false)}
      >
        <View style={styles.responseModalOverlay}>
          <View style={[styles.responseModalContent, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.responseModalHeader}>
              <View style={styles.responseModalTitleRow}>
                {selectedGuide && (
                  <View style={[
                    styles.responseGuideIcon, 
                    { backgroundColor: GUIDES.find(g => g.id === selectedGuide)?.color + '20' }
                  ]}>
                    <Ionicons 
                      name={GUIDES.find(g => g.id === selectedGuide)?.icon || 'chatbubble'} 
                      size={20} 
                      color={GUIDES.find(g => g.id === selectedGuide)?.color} 
                    />
                  </View>
                )}
                <Text style={styles.responseModalTitle}>
                  {GUIDES.find(g => g.id === selectedGuide)?.name || 'Your Guide'}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowResponseModal(false)}
              >
                <Ionicons name="close" size={24} color="#94A3B8" />
              </TouchableOpacity>
            </View>
            <ScrollView 
              style={styles.responseScrollView}
              showsVerticalScrollIndicator={false}
            >
              {agentResponse && (
                <>
                  <Text style={styles.responseText}>{agentResponse.message}</Text>
                  
                  {agentResponse.places.length > 0 && (
                    <View style={styles.placesContainer}>
                      <Text style={styles.placesTitle}>
                        Tap to select places for your itinerary
                      </Text>
                      {agentResponse.places.map((place, index) => {
                        const isSelected = selectedPlaces.has(index);
                        return (
                          <TouchableOpacity 
                            key={index} 
                            style={[
                              styles.placeCard,
                              isSelected && styles.placeCardSelected,
                            ]}
                            onPress={() => togglePlaceSelection(index)}
                            activeOpacity={0.7}
                          >
                            <View style={styles.placeHeader}>
                              <Ionicons 
                                name={isSelected ? "checkmark-circle" : "location"} 
                                size={18} 
                                color={isSelected ? "#10B981" : "#8B5CF6"} 
                              />
                              <Text style={styles.placeName}>{place.name}</Text>
                              {isSelected && (
                                <View style={styles.selectedBadge}>
                                  <Ionicons name="checkmark" size={12} color="#FFF" />
                                </View>
                              )}
                            </View>
                            <Text style={styles.placeDescription}>{place.description}</Text>
                            <Text style={styles.placeCoords}>
                              📍 {place.lat.toFixed(6)}, {place.lng.toFixed(6)}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                </>
              )}
            </ScrollView>
            
            {/* Action Button */}
            {selectedPlaces.size > 0 ? (
              <TouchableOpacity
                style={styles.addToItineraryButton}
                onPress={handleAddToItinerary}
              >
                <Ionicons name="add-circle" size={20} color="#FFF" />
                <Text style={styles.addToItineraryButtonText}>
                  Add {selectedPlaces.size} place{selectedPlaces.size > 1 ? 's' : ''} to itinerary
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.retryButton}
                onPress={handleRetry}
              >
                <Ionicons name="refresh" size={20} color="#94A3B8" />
                <Text style={styles.retryButtonText}>Try again</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>
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
  // Marker styles
  markerContainer: {
    alignItems: 'center',
  },
  markerBubble: {
    backgroundColor: '#8B5CF6',
    borderRadius: 20,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  markerNumber: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 14,
  },
  markerTail: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#8B5CF6',
    marginTop: -2,
  },
  // Route Info Card
  routeInfoCard: {
    position: 'absolute',
    left: 16,
    right: 70,
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    borderRadius: 16,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
    borderWidth: 1,
    borderColor: 'rgba(51, 65, 85, 0.5)',
  },
  routeInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  routeInfoTitle: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '600',
  },
  routeInfoDetails: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  routeInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  routeInfoText: {
    color: '#CBD5E1',
    fontSize: 12,
  },
  routeInfoDivider: {
    width: 1,
    height: 12,
    backgroundColor: '#475569',
    marginHorizontal: 10,
  },
  clearItineraryButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  clearItineraryText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '500',
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
  letsGoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#8B5CF6',
    borderRadius: 16,
    paddingVertical: 16,
    marginTop: 20,
    gap: 8,
  },
  letsGoButtonDisabled: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
  },
  letsGoButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFF',
  },
  letsGoButtonTextDisabled: {
    color: '#64748B',
  },
  // API Key Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#1E293B',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#94A3B8',
    marginBottom: 20,
    lineHeight: 20,
  },
  apiKeyInput: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    backgroundColor: '#334155',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalCancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#94A3B8',
  },
  modalSaveButton: {
    flex: 1,
    backgroundColor: '#8B5CF6',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalSaveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  // Response Modal Styles
  responseModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  responseModalContent: {
    backgroundColor: '#1E293B',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '80%',
  },
  responseModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  responseModalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  responseGuideIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  responseModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  closeButton: {
    padding: 4,
  },
  responseScrollView: {
    maxHeight: 400,
  },
  responseText: {
    fontSize: 16,
    color: '#E2E8F0',
    lineHeight: 24,
  },
  placesContainer: {
    marginTop: 20,
  },
  placesTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#94A3B8',
    marginBottom: 12,
  },
  placeCard: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: '#334155',
  },
  placeCardSelected: {
    borderColor: '#10B981',
    backgroundColor: '#10B98110',
  },
  placeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  placeName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#F8FAFC',
    flex: 1,
  },
  selectedBadge: {
    backgroundColor: '#10B981',
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeDescription: {
    fontSize: 14,
    color: '#CBD5E1',
    lineHeight: 20,
    marginBottom: 8,
  },
  placeCoords: {
    fontSize: 12,
    color: '#64748B',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  addToItineraryButton: {
    flexDirection: 'row',
    backgroundColor: '#10B981',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    gap: 8,
  },
  addToItineraryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  retryButton: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    gap: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#94A3B8',
  },
});
