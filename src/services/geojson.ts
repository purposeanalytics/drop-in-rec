// Service for loading and processing GeoJSON location data

export interface GeoJSONFeature {
  type: string;
  properties: {
    _id: number;
    LOCATIONID: string;
    ASSET_ID: number;
    ASSET_NAME: string;
    TYPE: string;
    AMENITIES: string;
    ADDRESS: string;
    PHONE: string;
    URL: string;
  };
  geometry: {
    type: string;
    coordinates: number[][];
  };
}

export interface GeoJSONData {
  type: string;
  name: string;
  crs: any;
  features: GeoJSONFeature[];
}

// Load GeoJSON data from the public folder
export const loadGeoJSONData = async (): Promise<GeoJSONData> => {
  try {
    const response = await fetch('./Parks and Recreation Facilities - 4326.geojson');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error loading GeoJSON data:', error);
    throw error;
  }
};

// Create a mapping from location IDs to their City of Toronto URLs
export const createLocationURLMap = (geoJSONData: GeoJSONData): Map<string, string> => {
  const urlMap = new Map<string, string>();
  
  geoJSONData.features.forEach(feature => {
    const locationId = feature.properties.LOCATIONID;
    const url = feature.properties.URL;
    
    if (locationId && url && url !== 'None') {
      urlMap.set(locationId, url);
    }
  });
  
  return urlMap;
};

// Create a mapping from location IDs to their coordinates
export const createLocationCoordsMap = (geoJSONData: GeoJSONData): Map<string, { lat: number; lng: number }> => {
  const coordsMap = new Map<string, { lat: number; lng: number }>();
  
  geoJSONData.features.forEach(feature => {
    const locationId = feature.properties.LOCATIONID;
    const coordinates = feature.geometry.coordinates;
    
    if (locationId && coordinates && coordinates.length > 0) {
      // GeoJSON coordinates are [longitude, latitude]
      // Handle different geometry types - try to extract the first coordinate
      let coord: number[] | null = null;
      
      try {
        if (Array.isArray(coordinates[0])) {
          if (Array.isArray(coordinates[0][0])) {
            // Polygon: coordinates[0][0] is the first ring
            coord = coordinates[0][0] as unknown as number[];
          } else {
            // LineString: coordinates[0] is the first coordinate
            coord = coordinates[0] as unknown as number[];
          }
        } else {
          // Point: coordinates is the coordinate
          coord = coordinates as unknown as number[];
        }
        
        if (coord && coord.length >= 2 && typeof coord[0] === 'number' && typeof coord[1] === 'number') {
          const [lng, lat] = coord;
          coordsMap.set(locationId, { lat, lng });
        }
      } catch (error) {
        // Silently handle coordinate parsing errors
      }
    }
  });
  
  return coordsMap;
};

// Load fallback coordinates for locations missing from the GeoJSON
export const loadFallbackCoordinates = async (): Promise<Map<string, { lat: number; lng: number }>> => {
  const map = new Map<string, { lat: number; lng: number }>();
  try {
    const response = await fetch('./LocationCoordinates.json');
    if (!response.ok) return map;
    const data: Record<string, [number, number]> = await response.json();
    for (const [id, [lng, lat]] of Object.entries(data)) {
      map.set(id, { lat, lng });
    }
  } catch {
    // Non-fatal: fall back to GeoJSON-only coordinates
  }
  return map;
};

// Get URL for a specific location ID
export const getLocationURL = (locationId: string, urlMap: Map<string, string>): string | null => {
  return urlMap.get(locationId) || null;
};
