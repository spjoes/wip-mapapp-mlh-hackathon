const FOURSQUARE_BASE_URL = 'https://places-api.foursquare.com/places';

// Read API key from environment variable
const foursquareApiKey = process.env.EXPO_PUBLIC_FOURSQUARE_API_KEY || null;

export const hasFoursquareApiKey = () => !!foursquareApiKey && foursquareApiKey !== 'your_foursquare_api_key_here';

// New Places API response structure
export interface FoursquarePlace {
  fsq_place_id: string;
  name: string;
  latitude?: number;
  longitude?: number;
  location?: {
    address?: string;
    locality?: string;
    region?: string;
    country?: string;
    formatted_address?: string;
  };
  categories?: {
    fsq_category_id: string;
    name: string;
    short_name?: string;
    plural_name?: string;
    icon?: {
      prefix: string;
      suffix: string;
    };
  }[];
  distance?: number;
  description?: string;
}

export interface PlaceResult {
  id: string;
  name: string;
  description: string;
  address: string;
  lat: number;
  lng: number;
  category: string;
  distance: number;
  guideType?: string; // Which guide type this place came from (for multi-guide searches)
}

// Fallback category mappings for each guide type (only used when user doesn't provide a query)
// When user provides a query like "movie theater", we do an open search instead
const GUIDE_CATEGORIES: Record<string, string[]> = {
  historian: [
    // Landmarks
    '4d4b7105d754a06377d81259', // Landmarks and Outdoors
    '4deefb944765f83613cdba6e', // Historic and Protected Site
    '4bf58dd8d48988d12d941735', // Monument
    '5642206c498e4bfca532186c', // Memorial Site
    '50aaa49e4b90af0d42d5de11', // Castle
    '52e81612bcbc57f1066b7a14', // Palace
    '4bf58dd8d48988d15d941735', // Lighthouse
    // Museums
    '4bf58dd8d48988d181941735', // Museum
    '4bf58dd8d48988d18f941735', // Art Museum
    '4bf58dd8d48988d190941735', // History Museum
    '4bf58dd8d48988d191941735', // Science Museum
    // Religious & Cultural
    '4bf58dd8d48988d132941735', // Church
    '4bf58dd8d48988d13a941735', // Temple
    '4bf58dd8d48988d138941735', // Mosque
    '4bf58dd8d48988d139941735', // Synagogue
    '52e81612bcbc57f1066b7a3e', // Buddhist Temple
    // Government
    '4bf58dd8d48988d126941735', // Government Building
    '4bf58dd8d48988d129941735', // City Hall
    '4bf58dd8d48988d12a941735', // Capitol Building
    '4bf58dd8d48988d12b941735', // Courthouse
    '4bf58dd8d48988d12f941735', // Library
  ],
  foodie: [
    // Restaurants
    '4d4b7105d754a06374d81259', // Restaurant
    '4bf58dd8d48988d16e941735', // Fast Food Restaurant
    '4bf58dd8d48988d1ca941735', // Pizzeria
    '4bf58dd8d48988d1ce941735', // Seafood Restaurant
    '4bf58dd8d48988d1cc941735', // Steakhouse
    '4bf58dd8d48988d1df931735', // BBQ Joint
    // Cafes & Coffee
    '4bf58dd8d48988d16d941735', // Café
    '4bf58dd8d48988d1e0931735', // Coffee Shop
    '4bf58dd8d48988d1dc931735', // Tea Room
    // Bars & Drinks
    '4bf58dd8d48988d116941735', // Bar
    '50327c8591d4c4b30a586d5d', // Brewery
    '4e0e22f5a56208c4ea9a85a0', // Distillery
    '4bf58dd8d48988d14b941735', // Winery
    '4bf58dd8d48988d1de941735', // Vineyard
    // Sweet & Baked
    '4bf58dd8d48988d1d0941735', // Dessert Shop
    '4bf58dd8d48988d16a941735', // Bakery
    '4bf58dd8d48988d1c9941735', // Ice Cream Parlor
    // Markets & Food Shops
    '53e0feef498e5aac066fd8a9', // Street Food Gathering
    '4bf58dd8d48988d1cb941735', // Food Truck
    '4bf58dd8d48988d1fa941735', // Farmers Market
    '53e510b7498ebcb1801b55d4', // Night Market
    '4bf58dd8d48988d1f5941735', // Gourmet Store
  ],
  adventure: [
    // Nature
    '4d4b7105d754a06377d81259', // Landmarks and Outdoors
    '4bf58dd8d48988d1e2941735', // Beach
    '4bf58dd8d48988d161941735', // Lake
    '4eb1d4dd4b900d56c88a45fd', // River
    '56aa371be4b08b9a8d573560', // Waterfall
    '4eb1d4d54b900d56c88a45fc', // Mountain
    '5bae9231bedf3950379f89cd', // Hill
    '56aa371be4b08b9a8d573511', // Cave
    '5032848691d4c4b30a586d61', // Volcano
    // Parks & Trails
    '52e81612bcbc57f1066b7a21', // National Park
    '52e81612bcbc57f1066b7a13', // Nature Preserve
    '4bf58dd8d48988d163941735', // Park
    '4bf58dd8d48988d159941735', // Hiking Trail
    '56aa371be4b08b9a8d57355e', // Bike Trail
    '4bf58dd8d48988d165941735', // Scenic Lookout
    // Adventure Activities
    '4bf58dd8d48988d1e4941735', // Campground
    '50328a4b91d4c4b30a586d6b', // Rock Climbing Spot
    '52e81612bcbc57f1066b7a12', // Dive Spot
    '4bf58dd8d48988d1e3941735', // Surf Spot
    '52e81612bcbc57f1066b7a29', // Rafting Spot
    '52e81612bcbc57f1066b7a0f', // Fishing Area
    '4bf58dd8d48988d1e9941735', // Ski Resort and Area
    '4f4528bc4b90abdf24c9de85', // Sports and Recreation
    '52e81612bcbc57f1066b7a28', // Bathing Area
  ],
  tech_guru: [
    // Tech & Business
    '4bf58dd8d48988d125941735', // Tech Startup
    '4bf58dd8d48988d174941735', // Coworking Space
    '63be6904847c3692a84b9b90', // Technology Business
    '63be6904847c3692a84b9b91', // Software Company
    '52f2ab2ebcbc57f1066b8b36', // IT Service
    '4bf58dd8d48988d124941735', // Office
    // Research & Innovation
    '5744ccdfe4b0c0459246b4d6', // Research Laboratory
    '58daa1558bbb0b01f18ec1b2', // Research Station
    '4eb1bea83b7b6f98df247e06', // Factory
    // Media & Creative Tech
    '56aa371be4b08b9a8d573523', // Film Studio
    '52f2ab2ebcbc57f1066b8b37', // Recording Studio
    '5032856091d4c4b30a586d63', // Radio Station
    '52e81612bcbc57f1066b7a31', // TV Station
    // Science & Tech Museums
    '4bf58dd8d48988d191941735', // Science Museum
    '4bf58dd8d48988d192941735', // Planetarium
    '5744ccdde4b0c0459246b4d9', // Observatory
    // Tech Entertainment
    '5f2c14a5b6d05514c7042eb7', // VR Cafe
    '4bf58dd8d48988d18d941735', // Gaming Cafe
    '4bf58dd8d48988d1f0941735', // Internet Cafe
    '4bf58dd8d48988d1e1931735', // Arcade
    // Events & Conferences
    '4bf58dd8d48988d1ff931735', // Convention Center
    '4bf58dd8d48988d171941735', // Event Space
  ],
  architect: [
    // Iconic Structures
    '4bf58dd8d48988d12d941735', // Monument
    '4bf58dd8d48988d130941735', // Structure
    '4bf58dd8d48988d1df941735', // Bridge
    '52f2ab2ebcbc57f1066b8b4a', // Tunnel
    '5fac018b99ce226e27fe7573', // Dam
    '56aa371be4b08b9a8d573547', // Fountain
    // Historic Buildings
    '50aaa49e4b90af0d42d5de11', // Castle
    '52e81612bcbc57f1066b7a14', // Palace
    '4bf58dd8d48988d15d941735', // Lighthouse
    '4deefb944765f83613cdba6e', // Historic Site
    // Religious Architecture
    '4bf58dd8d48988d132941735', // Church
    '4bf58dd8d48988d138941735', // Mosque
    '4bf58dd8d48988d139941735', // Synagogue
    '4bf58dd8d48988d13a941735', // Temple
    // Government & Civic
    '4bf58dd8d48988d126941735', // Government Building
    '4bf58dd8d48988d129941735', // City Hall
    '4bf58dd8d48988d12a941735', // Capitol Building
    '4bf58dd8d48988d12b941735', // Courthouse
    // Modern Architecture
    '4bf58dd8d48988d181941735', // Museum
    '4bf58dd8d48988d1ed931735', // Airport
    '4bf58dd8d48988d1ff931735', // Convention Center
    '4bf58dd8d48988d184941735', // Stadium
    // Urban Spaces
    '4bf58dd8d48988d166941735', // Plaza
    '4bf58dd8d48988d165941735', // Scenic Lookout
    '4bf58dd8d48988d133951735', // Roof Deck
  ],
  night_owl: [
    // Nightlife
    '4d4b7105d754a06376d81259', // Nightlife Spot
    '4bf58dd8d48988d11f941735', // Nightclub
    '4bf58dd8d48988d121941735', // Lounge
    // Bars (all types)
    '4bf58dd8d48988d116941735', // Bar
    '4bf58dd8d48988d11e941735', // Cocktail Bar
    '4bf58dd8d48988d118941735', // Dive Bar
    '4bf58dd8d48988d11b941735', // Pub
    '4bf58dd8d48988d117941735', // Beer Garden
    '4bf58dd8d48988d119941735', // Hookah Bar
    '4bf58dd8d48988d11c941735', // Sake Bar
    '4bf58dd8d48988d122941735', // Whisky Bar
    '4bf58dd8d48988d123941735', // Wine Bar
    '5f2c224bb6d05514c70440a3', // Rooftop Bar
    '52e81612bcbc57f1066b7a0d', // Beach Bar
    '4bf58dd8d48988d11d941735', // Sports Bar
    // Entertainment
    '4bf58dd8d48988d1e5931735', // Music Venue
    '4bf58dd8d48988d1e9931735', // Rock Club
    '4bf58dd8d48988d1e7931735', // Jazz Club
    '4bf58dd8d48988d18e941735', // Comedy Club
    '5744ccdfe4b0c0459246b4bb', // Karaoke Box
    '4bf58dd8d48988d120941735', // Karaoke Bar
    // Late Night Food
    '4bf58dd8d48988d1d0941735', // Dessert Shop (many open late)
    '53e510b7498ebcb1801b55d4', // Night Market
  ],
  artist: [
    // Art Spaces
    '4bf58dd8d48988d18f941735', // Art Museum
    '4bf58dd8d48988d1e2931735', // Art Gallery
    '58daa1558bbb0b01f18ec1d6', // Art Studio
    '4bf58dd8d48988d1f4941735', // Design Studio
    // Public Art
    '507c8c4091d498d9fc8c67a9', // Public Art
    '52e81612bcbc57f1066b79ee', // Street Art
    '52e81612bcbc57f1066b79ed', // Outdoor Sculpture
    '4bf58dd8d48988d166941735', // Sculpture Garden
    // Performing Arts
    '4bf58dd8d48988d1f2931735', // Performing Arts Venue
    '5032792091d4c4b30a586d5c', // Concert Hall
    '4bf58dd8d48988d137941735', // Theater
    '4bf58dd8d48988d135941735', // Indie Theater
    // Cultural
    '52e81612bcbc57f1066b7a32', // Cultural Center
    '4bf58dd8d48988d181941735', // Museum
    '4bf58dd8d48988d1e5931735', // Music Venue
    '52f2ab2ebcbc57f1066b8b37', // Recording Studio
  ],
  local_oddball: [
    // Quirky Museums
    '4bf58dd8d48988d181941735', // Museum
    '559acbe0498e472f1a53fa23', // Erotic Museum
    // Weird Attractions
    '4bf58dd8d48988d182941735', // Amusement Park
    '4bf58dd8d48988d12f941735', // Theme Park
    '4bf58dd8d48988d193941735', // Water Park
    '52e81612bcbc57f1066b79e7', // Circus
    '4fceea171983d5d06c3e9823', // Aquarium
    '4bf58dd8d48988d17b941735', // Zoo
    // Oddities
    '52f2ab2ebcbc57f1066b8b43', // Psychic and Astrologer
    '4bf58dd8d48988d131941735', // Spiritual Center
    '4bf58dd8d48988d17c941735', // Casino
    '5f2c2834b6d05514c704451e', // Escape Room
    // Unique Shops
    '4bf58dd8d48988d116951735', // Antique Store
    '52f2ab2ebcbc57f1066b8b17', // Costume Store
    '4bf58dd8d48988d101951735', // Vintage and Thrift Store
    '4bf58dd8d48988d128951735', // Gift Store
    '52f2ab2ebcbc57f1066b8b18', // Comic Book Store
    // Hidden Gems
    '4bf58dd8d48988d166941735', // Sculpture Garden
    '4bf58dd8d48988d1e2931735', // Art Gallery
    '56aa371be4b08b9a8d573511', // Cave
  ],
  sports_buff: [
    // Stadiums
    '4bf58dd8d48988d184941735', // Stadium
    '4bf58dd8d48988d18c941735', // Baseball Stadium
    '4bf58dd8d48988d18b941735', // Basketball Stadium
    '4bf58dd8d48988d18a941735', // Cricket Ground
    '4bf58dd8d48988d189941735', // Football Stadium
    '4bf58dd8d48988d185941735', // Hockey Stadium
    '4bf58dd8d48988d188941735', // Soccer Stadium
    '4e39a891bd410d7aed40cbc2', // Tennis Stadium
    '4bf58dd8d48988d187941735', // Track Stadium
    // Playing Fields
    '4bf58dd8d48988d1e8941735', // Baseball Field
    '4bf58dd8d48988d1e1941735', // Basketball Court
    '4cce455aebf7b749d5e191f5', // Soccer Field
    '4e39a956bd410d7aed40cbc3', // Tennis Court
    '4bf58dd8d48988d106941735', // Track
    '4bf58dd8d48988d1e6941735', // Golf Course
    // Recreation
    '4f4528bc4b90abdf24c9de85', // Sports and Recreation
    '4bf58dd8d48988d175941735', // Gym
    '52e81612bcbc57f1066b7a2e', // Sports Club
    '4bf58dd8d48988d167941735', // Skate Park
    '4bf58dd8d48988d168941735', // Skating Rink
    '4bf58dd8d48988d1f4931735', // Race Track
    '5032829591d4c4b30a586d5e', // Paintball Field
    // Watching Sports
    '4bf58dd8d48988d11d941735', // Sports Bar
  ],
};

interface SearchOptions {
  latitude: number;
  longitude: number;
  guideTypes: string[]; // Multiple guide types to search for
  query?: string;
  radius?: number;
  limit?: number;
}

interface SearchResult {
  success: boolean;
  places?: PlaceResult[];
  error?: string;
}

/**
 * Helper to do a single category search
 */
const searchSingleGuideType = async (
  latitude: number,
  longitude: number,
  guideType: string,
  radius: number,
  limit: number
): Promise<PlaceResult[]> => {
  const categories = GUIDE_CATEGORIES[guideType] || [];
  if (categories.length === 0) return [];

  const params = new URLSearchParams({
    ll: `${latitude},${longitude}`,
    radius: radius.toString(),
    limit: limit.toString(),
    sort: 'RELEVANCE',
    categories: categories.join(','),
  });

  const url = `${FOURSQUARE_BASE_URL}/search?${params.toString()}`;
  
  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${foursquareApiKey}`,
        'Accept': 'application/json',
        'X-Places-Api-Version': '2025-06-17',
      },
    });

    if (!response.ok) {
      console.error(`Foursquare error for ${guideType}:`, response.status);
      return [];
    }

    const data = await response.json();
    
    return (data.results || [])
      .filter((place: FoursquarePlace) => place.latitude != null && place.longitude != null)
      .map((place: FoursquarePlace) => ({
        id: place.fsq_place_id,
        name: place.name,
        description: place.categories?.[0]?.name || 'Point of Interest',
        address: place.location?.formatted_address || place.location?.address || '',
        lat: place.latitude!,
        lng: place.longitude!,
        category: place.categories?.[0]?.name || 'Unknown',
        distance: place.distance || 0,
        guideType, // Track which guide type this came from
      }));
  } catch (error) {
    console.error(`Search error for ${guideType}:`, error);
    return [];
  }
};

export const searchNearbyPlaces = async (options: SearchOptions): Promise<SearchResult> => {
  if (!foursquareApiKey) {
    return { success: false, error: 'Foursquare API key not configured' };
  }

  const { latitude, longitude, guideTypes, query, radius = 5000, limit = 20 } = options;

  try {
    // If user provides a query, use that for open search (no category restrictions)
    if (query) {
      const params = new URLSearchParams({
        ll: `${latitude},${longitude}`,
        radius: radius.toString(),
        limit: limit.toString(),
        sort: 'RELEVANCE',
        query,
      });
      console.log(`Searching Foursquare with user query: "${query}"`);
      
      const url = `${FOURSQUARE_BASE_URL}/search?${params.toString()}`;
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${foursquareApiKey}`,
          'Accept': 'application/json',
          'X-Places-Api-Version': '2025-06-17',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Foursquare API error:', response.status, errorText);
        return { success: false, error: `Places API error: ${response.status}` };
      }

      const data = await response.json();
      const places: PlaceResult[] = (data.results || [])
        .filter((place: FoursquarePlace) => place.latitude != null && place.longitude != null)
        .map((place: FoursquarePlace) => ({
          id: place.fsq_place_id,
          name: place.name,
          description: place.categories?.[0]?.name || 'Point of Interest',
          address: place.location?.formatted_address || place.location?.address || '',
          lat: place.latitude!,
          lng: place.longitude!,
          category: place.categories?.[0]?.name || 'Unknown',
          distance: place.distance || 0,
        }));

      console.log(`Found ${places.length} places for query "${query}"`);
      return { success: true, places };
    }

    // NO QUERY: Do SEPARATE searches for EACH guide type to ensure fair representation
    // This is critical for multi-guide selection - otherwise one guide's popular categories dominate
    console.log(`Searching Foursquare separately for ${guideTypes.length} guide types: ${guideTypes.join(', ')}`);
    
    const limitPerGuide = Math.max(15, Math.floor(50 / guideTypes.length)); // At least 15 per guide, up to 50 total
    
    // Run searches in parallel for speed
    const searchPromises = guideTypes.map(guideType => 
      searchSingleGuideType(latitude, longitude, guideType, radius, limitPerGuide)
    );
    
    const results = await Promise.all(searchPromises);
    
    // Combine results, removing duplicates by place ID
    const seenIds = new Set<string>();
    const allPlaces: PlaceResult[] = [];
    
    // Interleave results from each guide type for diversity
    const maxResultsPerGuide = Math.max(...results.map(r => r.length));
    for (let i = 0; i < maxResultsPerGuide; i++) {
      for (const guideResults of results) {
        if (i < guideResults.length) {
          const place = guideResults[i];
          if (!seenIds.has(place.id)) {
            seenIds.add(place.id);
            allPlaces.push(place);
          }
        }
      }
    }

    // Log results per guide type
    for (let i = 0; i < guideTypes.length; i++) {
      console.log(`  ${guideTypes[i]}: ${results[i].length} places found`);
    }
    console.log(`Combined total: ${allPlaces.length} unique places`);

    return { success: true, places: allPlaces };
  } catch (error) {
    console.error('Places search error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to search places',
    };
  }
};

// Format places for AI context
export const formatPlacesForAI = (places: PlaceResult[]): string => {
  if (places.length === 0) {
    return 'No nearby places found.';
  }

  const placesList = places.map((place, index) => {
    let details = `${index + 1}. "${place.name}" (${place.category})`;
    details += `\n   - Address: ${place.address || 'N/A'}`;
    details += `\n   - Coordinates: ${place.lat}, ${place.lng}`;
    details += `\n   - Distance: ${(place.distance / 1000).toFixed(1)}km away`;
    return details;
  }).join('\n\n');

  return placesList;
};

/**
 * Geocode a place name + city to get accurate coordinates using Nominatim (OpenStreetMap)
 * This is free and doesn't require an API key
 */
export interface GeocodedPlace {
  name: string;
  lat: number;
  lng: number;
  address?: string;
  found: boolean;
}

export const geocodePlace = async (
  placeName: string,
  city: string = 'San Francisco'
): Promise<GeocodedPlace | null> => {
  try {
    // Try searching with place name + city
    const query = encodeURIComponent(`${placeName}, ${city}`);
    const url = `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1&addressdetails=1`;
    
    console.log(`Geocoding: "${placeName}" in ${city}`);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'DetourApp/1.0', // Required by Nominatim
      },
    });

    if (!response.ok) {
      console.error('Nominatim error:', response.status);
      return null;
    }

    const results = await response.json();
    
    if (results.length > 0) {
      const result = results[0];
      console.log(`  Found: ${result.display_name} at ${result.lat}, ${result.lon}`);
      return {
        name: placeName,
        lat: parseFloat(result.lat),
        lng: parseFloat(result.lon),
        address: result.display_name,
        found: true,
      };
    }

    console.log(`  Not found for "${placeName}"`);
    return null;
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
};

/**
 * Geocode multiple places with rate limiting to respect Nominatim's usage policy
 * Nominatim requires 1 second between requests
 */
export const geocodePlaces = async (
  places: Array<{ name: string; lat?: number; lng?: number; description?: string; price?: string; duration?: string }>,
  city: string = 'San Francisco'
): Promise<Array<{ name: string; description: string; lat: number; lng: number; price: string; duration: string; geocoded: boolean }>> => {
  const results: Array<{ name: string; description: string; lat: number; lng: number; price: string; duration: string; geocoded: boolean }> = [];
  
  for (let i = 0; i < places.length; i++) {
    const place = places[i];
    
    // Add delay between requests (Nominatim rate limit)
    if (i > 0) {
      await new Promise(resolve => setTimeout(resolve, 1100)); // 1.1 seconds
    }
    
    const geocoded = await geocodePlace(place.name, city);
    
    if (geocoded && geocoded.found) {
      results.push({
        name: place.name,
        description: place.description || '',
        lat: geocoded.lat,
        lng: geocoded.lng,
        price: place.price || '$',
        duration: place.duration || '1 hour',
        geocoded: true,
      });
    } else {
      // Fall back to AI's coordinates if geocoding fails
      results.push({
        name: place.name,
        description: place.description || '',
        lat: place.lat || 0,
        lng: place.lng || 0,
        price: place.price || '$',
        duration: place.duration || '1 hour',
        geocoded: false,
      });
    }
  }
  
  return results;
};
