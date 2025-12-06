interface Coordinate {
  lat: number;
  lng: number;
}

interface RouteResult {
  success: boolean;
  coordinates?: { latitude: number; longitude: number }[];
  duration?: number; // in seconds
  distance?: number; // in meters
  error?: string;
}

/**
 * Get route using OSRM (Open Source Routing Machine)
 * This respects the exact order of places in the itinerary
 * This is a free service that doesn't require an API key
 */
export const getOptimizedRoute = async (
  userLocation: { latitude: number; longitude: number } | null,
  places: Coordinate[]
): Promise<RouteResult> => {
  if (places.length === 0) {
    return { success: false, error: 'No places provided' };
  }

  try {
    // Build coordinates string for OSRM
    // Format: lng,lat;lng,lat;...
    const coords: string[] = [];
    
    // Start from user location if available
    if (userLocation) {
      coords.push(`${userLocation.longitude},${userLocation.latitude}`);
    }
    
    // Add all places in the exact order they appear in the itinerary
    places.forEach(place => {
      coords.push(`${place.lng},${place.lat}`);
    });

    // If only one point (user location), we can't route
    if (coords.length < 2) {
      // Just return the single point
      return {
        success: true,
        coordinates: places.map(p => ({ latitude: p.lat, longitude: p.lng })),
        duration: 0,
        distance: 0,
      };
    }

    // Use OSRM route endpoint to respect the exact order of waypoints
    // (Unlike /trip which reorders for optimization)
    const url = `https://router.project-osrm.org/route/v1/driving/${coords.join(';')}?overview=full&geometries=geojson`;
    
    console.log('Fetching route from OSRM:', url);
    
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error('OSRM error:', response.status);
      return { success: false, error: `Routing service error: ${response.status}` };
    }

    const data = await response.json();
    
    if (data.code !== 'Ok') {
      console.error('OSRM response error:', data);
      return { success: false, error: data.message || 'Failed to calculate route' };
    }

    // Extract the route geometry
    const route = data.routes?.[0];
    if (!route) {
      return { success: false, error: 'No route found' };
    }

    // Convert GeoJSON coordinates [lng, lat] to our format { latitude, longitude }
    const routeCoordinates = route.geometry.coordinates.map(
      (coord: [number, number]) => ({
        latitude: coord[1],
        longitude: coord[0],
      })
    );

    return {
      success: true,
      coordinates: routeCoordinates,
      duration: route.duration, // seconds
      distance: route.distance, // meters
    };
  } catch (error) {
    console.error('Routing error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to calculate route',
    };
  }
};

/**
 * Format duration in seconds to human readable string
 */
export const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes} min`;
};

/**
 * Format distance in meters to human readable string
 */
export const formatDistance = (meters: number): string => {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(1)} km`;
  }
  return `${Math.round(meters)} m`;
};

