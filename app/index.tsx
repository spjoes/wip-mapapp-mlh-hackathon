import { Ionicons } from '@expo/vector-icons';
import BottomSheet, { BottomSheetScrollView, BottomSheetView } from '@gorhom/bottom-sheet';
import * as Location from 'expo-location';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  LayoutAnimation,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  UIManager,
  View,
} from 'react-native';
import DraggableFlatList, { RenderItemParams, ScaleDecorator } from 'react-native-draggable-flatlist';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

import { hasApiKey, sendAgentMessage } from '@/services/agent';
import { formatPlacesForAI, hasFoursquareApiKey, searchNearbyPlaces } from '@/services/places';
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
  id: string;
  name: string;
  description: string;
  lat: number;
  lng: number;
  price: 'Free' | '$' | '$$' | '$$$';
  duration: string; // e.g., "30 min", "1-2 hours", "Half day"
}

interface AgentResponseData {
  message: string;
  places: Place[];
}

interface JourneyStep {
  type: 'place' | 'walking';
  // For 'place' type
  place?: Place;
  funFacts?: string[];
  connectionToNext?: string;
  // For 'walking' type
  fromPlace?: string;
  toPlace?: string;
  walkingTime?: string;
  walkingDescription?: string; // What to look for while walking
}

interface JourneyContent {
  title: string;
  introduction: string;
  steps: JourneyStep[];
  totalTime: string;
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
      "lng": -98.765432,
      "price": "$",
      "duration": "1-2 hours"
    }
  ]
}

For each place:
- "price": Estimate the cost as "Free", "$" (budget), "$$" (moderate), or "$$$" (expensive)
- "duration": How long to enjoy/visit, e.g. "30 min", "1-2 hours", "2-3 hours", "Half day"

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
  
  // Track guide usage order (most recent first)
  const [guideUsageOrder, setGuideUsageOrder] = useState<string[]>([]);
  
  // Agent state
  const [isLoading, setIsLoading] = useState(false);
  const [showResponseModal, setShowResponseModal] = useState(false);
  const [agentResponse, setAgentResponse] = useState<AgentResponseData | null>(null);
  const [selectedPlaces, setSelectedPlaces] = useState<Set<number>>(new Set());
  
  // Itinerary state
  const [itinerary, setItinerary] = useState<Place[]>([]);
  const [routeCoordinates, setRouteCoordinates] = useState<{ latitude: number; longitude: number }[]>([]);
  const [routeInfo, setRouteInfo] = useState<{ duration: number; distance: number } | null>(null);
  const [isItineraryExpanded, setIsItineraryExpanded] = useState(false);
  
  // Journey mode state
  const [isJourneyMode, setIsJourneyMode] = useState(false);
  const [journeyContent, setJourneyContent] = useState<JourneyContent | null>(null);
  const [isGeneratingJourney, setIsGeneratingJourney] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  // Snap points for the bottom sheet
  const snapPoints = useMemo(() => ['38%', '65%', '90%'], []);

  // Sort guides by usage order (most recently used first)
  const sortedGuides = useMemo(() => {
    if (guideUsageOrder.length === 0) return GUIDES;
    
    return [...GUIDES].sort((a, b) => {
      const aIndex = guideUsageOrder.indexOf(a.id);
      const bIndex = guideUsageOrder.indexOf(b.id);
      
      // If neither has been used, keep original order
      if (aIndex === -1 && bIndex === -1) return 0;
      // If only a hasn't been used, b comes first
      if (aIndex === -1) return 1;
      // If only b hasn't been used, a comes first
      if (bIndex === -1) return -1;
      // Both have been used, sort by index (lower = more recent)
      return aIndex - bIndex;
    });
  }, [guideUsageOrder]);

  // The most recently used guide ID (for showing "Last used!" badge)
  const lastUsedGuideId = guideUsageOrder.length > 0 ? guideUsageOrder[0] : null;

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

    // Check if API keys are configured in .env
    if (!hasApiKey() || !hasFoursquareApiKey()) {
      Alert.alert(
        'API Keys Missing',
        'Please add your API keys to the .env file:\n\n• EXPO_PUBLIC_DO_AGENT_API_KEY\n• EXPO_PUBLIC_FOURSQUARE_API_KEY\n\nThen restart the app.',
        [{ text: 'OK' }]
      );
      return;
    }

    await startAgentConversation();
  };

  const startAgentConversation = async () => {
    const guide = GUIDES.find(g => g.id === selectedGuide);
    if (!guide) return;

    // Track this guide as most recently used
    setGuideUsageOrder(prev => {
      const filtered = prev.filter(id => id !== guide.id);
      return [guide.id, ...filtered];
    });

    setIsLoading(true);

    // Build the user message
    const userMessage = promptText.trim() 
      ? promptText 
      : "I'm exploring the area. What do you recommend I check out today?";

    // Get location context if available
    const locationContext = location 
      ? { latitude: location.coords.latitude, longitude: location.coords.longitude }
      : undefined;

    // Fetch nearby places from Foursquare
    let nearbyPlacesContext: string | undefined;
    if (locationContext && hasFoursquareApiKey()) {
      const placesResult = await searchNearbyPlaces({
        latitude: locationContext.latitude,
        longitude: locationContext.longitude,
        guideType: guide.id,
        query: promptText.trim() || undefined,
        radius: 10000, // 10km radius
        limit: 25,
      });

      if (placesResult.success && placesResult.places) {
        nearbyPlacesContext = formatPlacesForAI(placesResult.places);
        console.log('Found nearby places for AI context');
      }
    }

    const response = await sendAgentMessage(
      guide.personality,
      userMessage,
      locationContext,
      nearbyPlacesContext
    );

    setIsLoading(false);

    if (response.success && response.message) {
      try {
        // Parse the JSON response
        const parsed: AgentResponseData = JSON.parse(response.message);
        setAgentResponse(parsed);
        setShowResponseModal(true);
      } catch (parseError) {
        // If JSON parsing fails, show as plain text
        console.error('Failed to parse agent response as JSON:', parseError);
        setAgentResponse({ 
          message: response.message, 
          places: [] 
        });
        setShowResponseModal(true);
      }
    } else {
      Alert.alert(
        'Connection Error',
        response.error || 'Failed to connect to your guide. Please try again.',
        [{ text: 'OK' }]
      );
    }
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
    
    // Add unique IDs to each place
    const placesToAdd = agentResponse.places
      .filter((_, index) => selectedPlaces.has(index))
      .map((place, idx) => ({
        ...place,
        id: `place-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 9)}`,
      }));
    
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

  const generateJourneyContent = async () => {
    if (itinerary.length === 0) return;
    
    setIsGeneratingJourney(true);
    
    // Build a prompt for the AI to generate journey content
    const placesDescription = itinerary.map((place, idx) => 
      `${idx + 1}. "${place.name}" - ${place.description} (${place.duration}, ${place.price})`
    ).join('\n');

    const locationContext = location 
      ? { latitude: location.coords.latitude, longitude: location.coords.longitude }
      : undefined;

    const journeyPrompt = `You are creating an engaging walking tour guide. The user has planned this itinerary:

${placesDescription}

Generate a detailed journey guide with:
1. An exciting introduction to set the mood
2. For each place: 2-3 fun facts and how it connects to the next destination
3. For walks between places: interesting things to look for (architecture styles, street art, local culture, historical buildings, etc.)

Respond with this exact JSON format:
{
  "title": "A catchy title for this journey",
  "introduction": "An engaging 2-3 sentence introduction that gets the user excited",
  "steps": [
    {
      "type": "place",
      "placeIndex": 0,
      "funFacts": ["Fun fact 1", "Fun fact 2"],
      "connectionToNext": "How this place connects to the next (if not last stop)"
    },
    {
      "type": "walking",
      "fromIndex": 0,
      "toIndex": 1,
      "walkingDescription": "What to look for while walking - architecture, murals, street life, etc."
    }
  ],
  "totalTime": "Estimated total time including walks and visits"
}

Alternate between 'place' and 'walking' steps. Only respond with valid JSON.`;

    const response = await sendAgentMessage(
      'You are an enthusiastic local tour guide who knows fascinating stories about every corner of the city.',
      journeyPrompt,
      locationContext
    );

    setIsGeneratingJourney(false);

    if (response.success && response.message) {
      try {
        const parsed = JSON.parse(response.message);
        
        // Transform the parsed response to include actual place data
        const steps: JourneyStep[] = [];
        
        for (const step of parsed.steps) {
          if (step.type === 'place') {
            const place = itinerary[step.placeIndex];
            if (place) {
              steps.push({
                type: 'place',
                place,
                funFacts: step.funFacts || [],
                connectionToNext: step.connectionToNext,
              });
            }
          } else if (step.type === 'walking') {
            const fromPlace = itinerary[step.fromIndex];
            const toPlace = itinerary[step.toIndex];
            if (fromPlace && toPlace) {
              steps.push({
                type: 'walking',
                fromPlace: fromPlace.name,
                toPlace: toPlace.name,
                walkingDescription: step.walkingDescription,
                walkingTime: '5-10 min', // Could calculate from route data
              });
            }
          }
        }

        setJourneyContent({
          title: parsed.title || 'Your Journey',
          introduction: parsed.introduction || 'Get ready for an amazing adventure!',
          steps,
          totalTime: parsed.totalTime || routeInfo ? formatDuration(routeInfo!.duration) : 'Varies',
        });
        setIsJourneyMode(true);
        setCurrentStepIndex(0);
      } catch (e) {
        console.error('Failed to parse journey content:', e);
        Alert.alert('Error', 'Failed to generate journey guide. Please try again.');
      }
    } else {
      Alert.alert('Error', 'Failed to generate journey guide. Please try again.');
    }
  };

  const exitJourneyMode = () => {
    setIsJourneyMode(false);
    setJourneyContent(null);
    setCurrentStepIndex(0);
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
        <View style={[
          styles.routeInfoCard, 
          { top: insets.top + 16 },
          isItineraryExpanded && styles.routeInfoCardExpanded
        ]}>
          {/* Header - Tappable to expand/collapse */}
          <TouchableOpacity 
            style={styles.routeInfoHeaderTouchable}
            onPress={() => {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              setIsItineraryExpanded(!isItineraryExpanded);
            }}
            activeOpacity={0.7}
          >
            <View style={styles.routeInfoHeader}>
              <Ionicons name="map" size={18} color="#8B5CF6" />
              <Text style={styles.routeInfoTitle}>Your Itinerary</Text>
              <Ionicons 
                name={isItineraryExpanded ? "chevron-up" : "chevron-down"} 
                size={18} 
                color="#94A3B8" 
                style={styles.expandIcon}
              />
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
          </TouchableOpacity>

          {/* Clear Button */}
          <TouchableOpacity 
            style={styles.clearItineraryButton}
            onPress={() => {
              setItinerary([]);
              setIsItineraryExpanded(false);
            }}
          >
            <Ionicons name="close-circle" size={16} color="#EF4444" />
            <Text style={styles.clearItineraryText}>Clear</Text>
          </TouchableOpacity>

          {/* Expanded Itinerary List */}
          {isItineraryExpanded && (
            <View style={styles.itineraryListContainer}>
              <Text style={styles.itineraryListHint}>
                <Ionicons name="reorder-three" size={14} color="#64748B" /> Hold and drag to reorder
              </Text>
              <DraggableFlatList
                data={itinerary}
                onDragEnd={({ data }) => setItinerary(data)}
                keyExtractor={(item) => item.id}
                renderItem={({ item, drag, isActive, getIndex }: RenderItemParams<Place>) => {
                  const index = getIndex() ?? 0;
                  return (
                    <ScaleDecorator>
                      <TouchableOpacity
                        style={[
                          styles.itineraryItem,
                          isActive && styles.itineraryItemDragging,
                        ]}
                        onLongPress={drag}
                        disabled={isActive}
                        delayLongPress={100}
                      >
                        <View style={styles.itineraryItemNumber}>
                          <Text style={styles.itineraryItemNumberText}>{index + 1}</Text>
                        </View>
                        <View style={styles.itineraryItemContent}>
                          <Text style={styles.itineraryItemName} numberOfLines={1}>
                            {item.name}
                          </Text>
                          <Text style={styles.itineraryItemDesc} numberOfLines={1}>
                            {item.description}
                          </Text>
                        </View>
                        <View style={styles.itineraryItemHandle}>
                          <Ionicons name="reorder-two" size={20} color="#64748B" />
                        </View>
                      </TouchableOpacity>
                    </ScaleDecorator>
                  );
                }}
                activationDistance={10}
                containerStyle={styles.draggableContainer}
              />
            </View>
          )}
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
        {isJourneyMode && journeyContent ? (
          /* Journey Mode - Use BottomSheetScrollView directly */
          <BottomSheetScrollView 
            style={[styles.sheetContent, { paddingBottom: insets.bottom + 16 }]}
            contentContainerStyle={styles.journeyScrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Journey Header */}
            <View style={styles.journeyHeader}>
              <View style={styles.journeyTitleRow}>
                <Ionicons name="footsteps" size={24} color="#8B5CF6" />
                <Text style={styles.journeyTitle}>{journeyContent.title}</Text>
              </View>
              <TouchableOpacity onPress={exitJourneyMode} style={styles.exitJourneyButton}>
                <Ionicons name="close-circle" size={24} color="#94A3B8" />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.journeyIntro}>{journeyContent.introduction}</Text>
            
            <View style={styles.journeyMetaRow}>
              <View style={styles.journeyMetaItem}>
                <Ionicons name="location" size={16} color="#10B981" />
                <Text style={styles.journeyMetaText}>{itinerary.length} stops</Text>
              </View>
              <View style={styles.journeyMetaItem}>
                <Ionicons name="time" size={16} color="#F59E0B" />
                <Text style={styles.journeyMetaText}>{journeyContent.totalTime}</Text>
              </View>
            </View>

            {/* Journey Steps */}
            {journeyContent.steps.map((step, index) => (
              <View key={index}>
                {step.type === 'place' && step.place && (
                  <View style={[
                    styles.journeyPlaceCard,
                    currentStepIndex === index && styles.journeyPlaceCardActive
                  ]}>
                    <View style={styles.journeyPlaceHeader}>
                      <View style={styles.journeyStepNumber}>
                        <Text style={styles.journeyStepNumberText}>
                          {journeyContent.steps.filter((s, i) => s.type === 'place' && i <= index).length}
                        </Text>
                      </View>
                      <View style={styles.journeyPlaceInfo}>
                        <Text style={styles.journeyPlaceName}>{step.place.name}</Text>
                        <View style={styles.journeyPlaceMeta}>
                          <Text style={styles.journeyPlaceMetaText}>{step.place.duration}</Text>
                          <Text style={styles.journeyPlaceMetaDot}>•</Text>
                          <Text style={styles.journeyPlaceMetaText}>{step.place.price}</Text>
                        </View>
                      </View>
                    </View>
                    
                    {step.funFacts && step.funFacts.length > 0 && (
                      <View style={styles.funFactsContainer}>
                        <Text style={styles.funFactsTitle}>
                          <Ionicons name="bulb" size={14} color="#F59E0B" /> Fun Facts
                        </Text>
                        {step.funFacts.map((fact, factIndex) => (
                          <Text key={factIndex} style={styles.funFactText}>• {fact}</Text>
                        ))}
                      </View>
                    )}
                    
                    {step.connectionToNext && (
                      <View style={styles.connectionContainer}>
                        <Ionicons name="link" size={14} color="#8B5CF6" />
                        <Text style={styles.connectionText}>{step.connectionToNext}</Text>
                      </View>
                    )}
                  </View>
                )}
                
                {step.type === 'walking' && (
                  <View style={styles.walkingCard}>
                    <View style={styles.walkingIconContainer}>
                      <Ionicons name="walk" size={20} color="#64748B" />
                    </View>
                    <View style={styles.walkingContent}>
                      <Text style={styles.walkingTitle}>
                        Walk to {step.toPlace}
                      </Text>
                      {step.walkingDescription && (
                        <Text style={styles.walkingDescription}>
                          <Ionicons name="eye" size={12} color="#94A3B8" /> {step.walkingDescription}
                        </Text>
                      )}
                    </View>
                  </View>
                )}
              </View>
            ))}
          </BottomSheetScrollView>
        ) : (
          /* Planning Mode - Use BottomSheetView */
          <BottomSheetView style={[styles.sheetContent, { paddingBottom: insets.bottom + 16 }]}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.greeting}>
                {itinerary.length > 0 ? 'Your trip is ready!' : 'Ready to explore?'}
              </Text>
              <Text style={styles.subGreeting}>
                {itinerary.length > 0 
                  ? `${itinerary.length} places in your itinerary` 
                  : 'Your AI travel companions are here to help'}
              </Text>
            </View>

            {/* Start Journey Button - Only show when itinerary has places */}
            {itinerary.length > 0 && (
              <TouchableOpacity
                style={styles.startJourneyButton}
                onPress={generateJourneyContent}
                disabled={isGeneratingJourney}
                activeOpacity={0.8}
              >
                {isGeneratingJourney ? (
                  <>
                    <ActivityIndicator size="small" color="#FFF" />
                    <Text style={styles.startJourneyButtonText}>Creating your guide...</Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="footsteps" size={22} color="#FFF" />
                    <Text style={styles.startJourneyButtonText}>Start Journey</Text>
                    <Ionicons name="arrow-forward" size={18} color="#FFF" />
                  </>
                )}
              </TouchableOpacity>
            )}

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
                />
              </View>
            </View>

            {/* Guide Selection */}
            <View style={styles.guidesSection}>
              <Text style={styles.guidesTitle}>Choose your guide</Text>
              <View style={styles.guidesContainer}>
                {sortedGuides.map((guide) => (
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
                    {/* Last used badge - only show on most recently used guide */}
                    {lastUsedGuideId === guide.id && (
                      <View style={styles.lastUsedBadge}>
                        <Text style={styles.lastUsedText}>Last used!</Text>
                      </View>
                    )}
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
                      {itinerary.length > 0 ? 'Add more places' : "Let's go!"}
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
        )}
      </BottomSheet>

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
                            <View style={styles.placeFooter}>
                              <Text style={styles.placeCoords}>
                                📍 {place.lat.toFixed(6)}, {place.lng.toFixed(6)}
                              </Text>
                              <View style={styles.placeMetaContainer}>
                                {place.duration && (
                                  <View style={styles.placeMetaBadge}>
                                    <Ionicons name="time-outline" size={12} color="#F59E0B" />
                                    <Text style={styles.placeMetaText}>{place.duration}</Text>
                                  </View>
                                )}
                                {place.price && (
                                  <View style={[
                                    styles.placeMetaBadge,
                                    place.price === 'Free' && styles.placeMetaBadgeFree
                                  ]}>
                                    <Text style={[
                                      styles.placeMetaText,
                                      place.price === 'Free' && styles.placeMetaTextFree
                                    ]}>
                                      {place.price}
                                    </Text>
                                  </View>
                                )}
                              </View>
                            </View>
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
    right: 16,
    backgroundColor: 'rgba(15, 23, 42, 0.98)',
    borderRadius: 16,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
    borderWidth: 1,
    borderColor: 'rgba(51, 65, 85, 0.5)',
    maxHeight: SCREEN_HEIGHT * 0.5,
  },
  routeInfoCardExpanded: {
    backgroundColor: 'rgba(15, 23, 42, 0.98)',
  },
  routeInfoHeaderTouchable: {
    paddingRight: 50,
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
    flex: 1,
  },
  expandIcon: {
    marginLeft: 'auto',
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
  // Expanded Itinerary List
  itineraryListContainer: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#334155',
    paddingTop: 12,
  },
  itineraryListHint: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 10,
    textAlign: 'center',
  },
  draggableContainer: {
    maxHeight: SCREEN_HEIGHT * 0.3,
  },
  itineraryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  itineraryItemDragging: {
    backgroundColor: '#334155',
    borderColor: '#8B5CF6',
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  itineraryItemNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#8B5CF6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  itineraryItemNumberText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
  itineraryItemContent: {
    flex: 1,
    marginRight: 8,
  },
  itineraryItemName: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '600',
  },
  itineraryItemDesc: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
  },
  itineraryItemHandle: {
    padding: 4,
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
    paddingHorizontal: 16,
    paddingVertical: 12,
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
  lastUsedBadge: {
    position: 'absolute',
    top: -8,
    left: 8,
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    zIndex: 1,
  },
  lastUsedText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#FFF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
  placeFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  placeCoords: {
    fontSize: 12,
    color: '#64748B',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    flex: 1,
  },
  placeMetaContainer: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  placeMetaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#334155',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  placeMetaBadgeFree: {
    backgroundColor: '#10B98120',
  },
  placeMetaText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#CBD5E1',
  },
  placeMetaTextFree: {
    color: '#10B981',
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
  // Start Journey Button
  startJourneyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10B981',
    borderRadius: 16,
    paddingVertical: 16,
    marginBottom: 20,
    gap: 10,
  },
  startJourneyButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFF',
  },
  // Journey Mode Styles
  journeyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  journeyTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  journeyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#F8FAFC',
    flex: 1,
  },
  exitJourneyButton: {
    padding: 4,
  },
  journeyIntro: {
    fontSize: 15,
    color: '#CBD5E1',
    lineHeight: 22,
    marginBottom: 16,
  },
  journeyMetaRow: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 20,
  },
  journeyMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  journeyMetaText: {
    fontSize: 14,
    color: '#94A3B8',
    fontWeight: '500',
  },
  journeyScrollContent: {
    paddingBottom: 40,
  },
  journeyPlaceCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  journeyPlaceCardActive: {
    borderColor: '#8B5CF6',
  },
  journeyPlaceHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  journeyStepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#8B5CF6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  journeyStepNumberText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFF',
  },
  journeyPlaceInfo: {
    flex: 1,
  },
  journeyPlaceName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F8FAFC',
    marginBottom: 4,
  },
  journeyPlaceMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  journeyPlaceMetaText: {
    fontSize: 13,
    color: '#94A3B8',
  },
  journeyPlaceMetaDot: {
    fontSize: 13,
    color: '#64748B',
  },
  funFactsContainer: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  funFactsTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#F59E0B',
    marginBottom: 8,
  },
  funFactText: {
    fontSize: 13,
    color: '#CBD5E1',
    lineHeight: 20,
    marginBottom: 4,
  },
  connectionContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  connectionText: {
    fontSize: 13,
    color: '#A78BFA',
    fontStyle: 'italic',
    flex: 1,
    lineHeight: 18,
  },
  walkingCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    paddingHorizontal: 8,
    gap: 12,
  },
  walkingIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
  },
  walkingContent: {
    flex: 1,
  },
  walkingTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#94A3B8',
    marginBottom: 4,
  },
  walkingDescription: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
  },
});
