import { useState, useEffect } from 'react';
import { getAllResources } from '../services/api';
import { getCurrentDate } from '../utils/dateTimeUtils';
import { loadGeoJSONData, createLocationURLMap, createLocationCoordsMap, loadFallbackCoordinates } from '../services/geojson';

interface Location {
  _id: number;
  "Location ID": number;
  "Parent Location ID": number;
  "Location Name": string;
  "Location Type": string;
  "Accessibility": string;
  "Intersection": string;
  "TTC Information": string;
  "District": string;
  "Street No": string;
  "Street No Suffix": string;
  "Street Name": string;
  "Street Type": string;
  "Street Direction": string;
  "Postal Code": string;
  "Description": string;
}

interface DropInRecord {
  _id: number;
  "Location ID": number;
  "Course_ID": number;
  "Course Title": string;
  "Section": string;
  "Age Min": string;
  "Age Max": string;
  "Date Range": string;
  "Start Hour": number;
  "Start Minute": number;
  "End Hour": number;
  "End Min": number;
  "First Date": string;
  "Last Date": string;
}

export const useAppData = () => {
  const [allCourseTitles, setAllCourseTitles] = useState<string[]>([]);
  const [allDropIns, setAllDropIns] = useState<DropInRecord[]>([]);
  const [allLocations, setAllLocations] = useState<Location[]>([]);
  const [locationURLMap, setLocationURLMap] = useState<Map<string, string>>(new Map());
  const [locationAddressMap, setLocationAddressMap] = useState<Map<string, string>>(new Map());
  const [locationCoordsMap, setLocationCoordsMap] = useState<Map<string, { lat: number; lng: number }>>(new Map());
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        setIsInitialLoading(true);
        setError(null);
        
        // Load recreation data, GeoJSON, and fallback coordinates in parallel
        const [{ locations, dropIns }, geoJSONData, fallbackCoords] = await Promise.all([
          getAllResources(),
          loadGeoJSONData(),
          loadFallbackCoordinates()
        ]);
        
        // Filter drop-ins to only include programs available in the upcoming week
        const today = new Date();
        const nextWeek = new Date(today);
        nextWeek.setDate(today.getDate() + 7);
        
        const todayStr = getCurrentDate();
        const nextWeekYear = nextWeek.getFullYear();
        const nextWeekMonth = (nextWeek.getMonth() + 1).toString().padStart(2, '0');
        const nextWeekDay = nextWeek.getDate().toString().padStart(2, '0');
        const nextWeekStr = `${nextWeekYear}-${nextWeekMonth}-${nextWeekDay}`;
        
        const filteredDropIns = dropIns.filter(dropIn => {
          const firstDate = dropIn["First Date"];
          const lastDate = dropIn["Last Date"];
          return (firstDate <= nextWeekStr && lastDate >= todayStr);
        });
        
        // Extract unique course titles and locations from filtered data
        const uniqueCourseTitles = [...new Set(filteredDropIns.map(d => d["Course Title"]).filter(Boolean))].sort();
        
        // Create URL, address, and coordinates maps from GeoJSON data
        const urlMap = createLocationURLMap(geoJSONData);
        const coordsMap = createLocationCoordsMap(geoJSONData);

        // Fill in coordinates for locations missing from the GeoJSON
        for (const [id, coords] of fallbackCoords) {
          if (!coordsMap.has(id)) coordsMap.set(id, coords);
        }
        const addressMap = new Map<string, string>();
        
        geoJSONData.features.forEach(feature => {
          const locationId = feature.properties.LOCATIONID;
          const address = feature.properties.ADDRESS;
          if (locationId && address && address !== 'None') {
            addressMap.set(locationId, address);
          }
        });
        
        setAllCourseTitles(uniqueCourseTitles);
        setAllDropIns(filteredDropIns);
        setAllLocations(locations);
        setLocationURLMap(urlMap);
        setLocationAddressMap(addressMap);
        setLocationCoordsMap(coordsMap);
      } catch (err) {
        console.error('Error loading data:', err);
        setError('Failed to load recreation data. Please try again later.');
      } finally {
        setIsInitialLoading(false);
      }
    };

    loadData();
  }, []);

  return {
    allCourseTitles,
    allDropIns,
    allLocations,
    locationURLMap,
    locationAddressMap,
    locationCoordsMap,
    isInitialLoading,
    error
  };
};
