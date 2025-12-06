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
}

// Fallback category mappings for each guide type (only used when user doesn't provide a query)
// When user provides a query like "movie theater", we do an open search instead
const GUIDE_CATEGORIES: Record<string, string[]> = {
  historian: [
    '4d4b7105d754a06377d81259', // Landmarks and Outdoors
    '4deefb944765f83613cdba6e', // Historic and Protected Site
    '4bf58dd8d48988d12d941735', // Monument
    '4bf58dd8d48988d181941735', // Museum
    '4bf58dd8d48988d18f941735', // Art Museum
    '4bf58dd8d48988d190941735', // History Museum
    '4bf58dd8d48988d191941735', // Science Museum
    '4bf58dd8d48988d132941735', // Church
    '4bf58dd8d48988d13a941735', // Temple
    '50aaa49e4b90af0d42d5de11', // Castle
    '5642206c498e4bfca532186c', // Memorial Site
  ],
  foodie: [
    '4d4b7105d754a06374d81259', // Restaurant
    '4bf58dd8d48988d116941735', // Bar
    '4bf58dd8d48988d1e0931735', // Coffee Shop
    '4bf58dd8d48988d1d0941735', // Dessert Shop
    '4bf58dd8d48988d16e941735', // Fast Food Restaurant
    '4bf58dd8d48988d16d941735', // Café
    '53e0feef498e5aac066fd8a9', // Street Food Gathering
    '4bf58dd8d48988d16a941735', // Bakery
    '4bf58dd8d48988d1ca941735', // Pizzeria
    '4bf58dd8d48988d1ce941735', // Seafood Restaurant
  ],
  adventurer: [
    '4d4b7105d754a06377d81259', // Landmarks and Outdoors
    '4bf58dd8d48988d1e2941735', // Beach
    '4bf58dd8d48988d1e4941735', // Campground
    '4bf58dd8d48988d15a941735', // Garden
    '4bf58dd8d48988d161941735', // Lake
    '4eb1d4d54b900d56c88a45fc', // Mountain
    '52e81612bcbc57f1066b7a21', // National Park
    '52e81612bcbc57f1066b7a13', // Nature Preserve
    '4bf58dd8d48988d163941735', // Park
    '4bf58dd8d48988d165941735', // Scenic Lookout
    '4bf58dd8d48988d159941735', // Hiking Trail
    '4f4528bc4b90abdf24c9de85', // Sports and Recreation
    '4bf58dd8d48988d1e3941735', // Surf Spot
    '4bf58dd8d48988d1e9941735', // Ski Resort and Area
  ],
};

interface SearchOptions {
  latitude: number;
  longitude: number;
  guideType: string;
  query?: string;
  radius?: number;
  limit?: number;
}

interface SearchResult {
  success: boolean;
  places?: PlaceResult[];
  error?: string;
}

export const searchNearbyPlaces = async (options: SearchOptions): Promise<SearchResult> => {
  if (!foursquareApiKey) {
    return { success: false, error: 'Foursquare API key not configured' };
  }

  const { latitude, longitude, guideType, query, radius = 5000, limit = 20 } = options;

  try {
    // Build the search URL
    const params = new URLSearchParams({
      ll: `${latitude},${longitude}`,
      radius: radius.toString(),
      limit: limit.toString(),
      sort: 'RELEVANCE',
    });

    // If user provides a query, use that for open search (no category restrictions)
    // This allows any guide to find movie theaters, gyms, etc. based on what the user asks
    if (query) {
      params.set('query', query);
      console.log(`Searching Foursquare with user query: "${query}"`);
    } else {
      // No query provided - use guide-specific categories as fallback
      const categories = GUIDE_CATEGORIES[guideType] || [];
      if (categories.length > 0) {
        params.set('categories', categories.join(','));
        console.log(`Searching Foursquare with ${guideType} guide categories`);
      }
    }

    const url = `${FOURSQUARE_BASE_URL}/search?${params.toString()}`;
    console.log('Fetching places from Foursquare:', url);

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
    console.log('Foursquare response sample:', JSON.stringify(data.results?.[0], null, 2));
    
    // Filter out places without coordinate data and map to our format
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

    console.log(`Found ${places.length} places with valid coordinates`);
    return { success: true, places };
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

