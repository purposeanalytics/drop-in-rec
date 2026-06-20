import { useState, useEffect, useMemo } from 'react';
import { getDayOfWeek, formatTimeForComparison, formatTimeStringForComparison, isDateInRange, normalizeDatePickerValue } from '../services/api';
import { categorizeCourse, courseMatchesCategory, categories } from '../services/categories';
import { getSmartDefaults } from '../utils/dateTimeUtils';

interface SearchFilters {
  courseTitle: string;
  category: string;
  subcategory: string;
  date: string;
  time: string;
  location: string[];
  age: string;
}

interface SearchResult {
  courseTitle: string;
  location: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  date: string;
  locationURL?: string | null;
  locationAddress?: string | null;
  category?: string;
  subcategory?: string;
  ageRange?: string;
  "Age Min"?: string;
  "Age Max"?: string;
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

// Helper function to get current date in YYYY-MM-DD format (local timezone)
const getCurrentDate = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Helper function to get default date - if it's late in the day, default to tomorrow (local timezone)
const getDefaultDate = (): string => {
  const now = new Date();
  const hour = now.getHours();
  
  // If it's after 10 PM, default to tomorrow
  if (hour >= 22) {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const year = tomorrow.getFullYear();
    const month = (tomorrow.getMonth() + 1).toString().padStart(2, '0');
    const day = tomorrow.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  
  return getCurrentDate();
};

// Helper function to get default time - return the next closest available time
const getDefaultTime = (): string => {
  const now = new Date();
  const hour = now.getHours();
  const minute = now.getMinutes();
  
  // If it's after 10 PM, default to "Any time" (for tomorrow)
  if (hour >= 22) {
    return 'Any time';
  }
  
  // If it's before 6 AM, default to "Any time"
  if (hour < 6) {
    return 'Any time';
  }
  
  // Find the next closest time slot
  let nextHour = hour;
  let nextMinute = minute;
  
  // Round to next 30-minute interval
  if (minute <= 0) {
    nextMinute = 30;
  } else if (minute <= 30) {
    nextMinute = 30;
  } else {
    nextMinute = 0;
    nextHour = (nextHour + 1) % 24;
  }
  
  // If we've gone past 11:30 PM, default to "Any time"
  if (nextHour >= 24 || (nextHour === 23 && nextMinute > 30)) {
    return 'Any time';
  }
  
  // Format the time
  const timeString = `${nextHour.toString().padStart(2, '0')}:${nextMinute.toString().padStart(2, '0')}`;
  return timeString;
};

export const useSearchLogic = (
  allDropIns: DropInRecord[],
  allLocations: Location[],
  locationURLMap: Map<string, string>,
  locationAddressMap: Map<string, string>,
  locationPhoneMap: Map<string, string>,
  locationCoordsMap: Map<string, { lat: number; lng: number }>
) => {
  const [filters, setFilters] = useState<SearchFilters>({
    courseTitle: '',
    category: '',
    subcategory: '',
    date: getDefaultDate(),
    time: getDefaultTime(),
    location: [],
    age: ''
  });
  
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<string | undefined>(undefined);
  const [sortOrder, setSortOrder] = useState<'location-name' | 'earliest' | 'latest' | 'open-longest'>('location-name');

  // Extract unique locations with coordinates for the map and location list
  const mapLocations = useMemo(() => {
    const uniqueLocations = new Map<string, { name: string; lat: number; lng: number; address?: string; phone?: string; url?: string }>();
    
    // Create a mapping from location name to location ID
    const locationNameToIdMap = new Map<string, string>();
    allLocations.forEach(loc => {
      locationNameToIdMap.set(loc["Location Name"], loc["Location ID"].toString());
    });
    
    // Helper function to add a location to the map
    const addLocationToMap = (locationName: string) => {
      if (!uniqueLocations.has(locationName)) {
        const locationId = locationNameToIdMap.get(locationName);
        
        if (locationId) {
          const coords = locationCoordsMap.get(locationId);
          
          if (!coords) {
            // Debug: Log locations that exist in data but don't have coordinates
            console.warn(`Location "${locationName}" (ID: ${locationId}) exists in data but has no coordinates in GeoJSON file`);
          }
          
          if (coords) {
            // Find the location data from allLocations for address formatting
            const locationData = allLocations.find(loc => loc["Location ID"].toString() === locationId);
            
            // Format address from Locations.json data
            let formattedAddress = '';
            if (locationData) {
              const streetNo = locationData["Street No"] && locationData["Street No"] !== "None" ? locationData["Street No"] : '';
              const streetNoSuffix = locationData["Street No Suffix"] && locationData["Street No Suffix"] !== "None" ? locationData["Street No Suffix"] : '';
              const streetName = locationData["Street Name"] && locationData["Street Name"] !== "None" ? locationData["Street Name"] : '';
              const streetType = locationData["Street Type"] && locationData["Street Type"] !== "None" ? locationData["Street Type"] : '';
              const streetDirection = locationData["Street Direction"] && locationData["Street Direction"] !== "None" ? locationData["Street Direction"] : '';
              const postalCode = locationData["Postal Code"] && locationData["Postal Code"] !== "None" ? locationData["Postal Code"] : '';
              
              // Format: {Street Number}{Street No Suffix} {Street Name} {Street Type} {Street Direction}
              const streetAddress = [streetNo, streetNoSuffix, streetName, streetType, streetDirection]
                .filter(part => part && part !== "None")
                .join(' ');
              
              // Format: Toronto, ON  {Postal Code}
              const cityLine = postalCode ? `Toronto, ON  ${postalCode}` : 'Toronto, ON';
              
              formattedAddress = streetAddress ? `${streetAddress}\n${cityLine}` : cityLine;
            }
            
            // Get URL and phone from maps using location ID
            const locationIdForURL = locationData ? locationData["Location ID"].toString() : locationId;
            const locationURL = locationURLMap.get(locationIdForURL) || undefined;
            const locationPhone = locationPhoneMap.get(locationIdForURL) || undefined;

            uniqueLocations.set(locationName, {
              name: locationName,
              lat: coords.lat,
              lng: coords.lng,
              address: formattedAddress || undefined,
              phone: locationPhone,
              url: locationURL
            });
          }
        }
      }
    };
    
    // Check if we have any active filters
    const hasActiveFilters = filters.courseTitle || filters.category || filters.subcategory || 
                            filters.location.length > 0 || filters.age || 
                            (filters.date && filters.date !== getDefaultDate()) || 
                            (filters.time && filters.time !== 'Any time');
    
    if (results.length > 0) {
      // Only show locations from results and selected locations
      // Add locations from results
      results.forEach(result => {
        addLocationToMap(result.location);
      });
      
      // Add selected locations (even if they don't have results)
      filters.location.forEach(selectedLocationName => {
        addLocationToMap(selectedLocationName);
      });
    } else if (hasActiveFilters) {
      // No results but have active filters - show selected locations if any
      if (filters.location.length > 0) {
        // Add selected locations even if they don't have results
        filters.location.forEach(selectedLocationName => {
          addLocationToMap(selectedLocationName);
        });
      } else {
        // No results and no selected locations - return empty array to hide map
        return [];
      }
    } else {
      // No results and no active filters - show all locations that have programs in the upcoming week
      const locationsWithPrograms = new Set<number>();
      allDropIns.forEach(dropIn => {
        locationsWithPrograms.add(dropIn["Location ID"]);
      });
      
      // Add locations that have programs in the upcoming week
      allLocations.forEach(location => {
        if (locationsWithPrograms.has(location["Location ID"])) {
          const locationName = location["Location Name"];
          const locationId = location["Location ID"].toString();
          const coords = locationCoordsMap.get(locationId);
          
          if (coords) {
            // Format address from Locations.json data
            let formattedAddress = '';
            const streetNo = location["Street No"] && location["Street No"] !== "None" ? location["Street No"] : '';
            const streetNoSuffix = location["Street No Suffix"] && location["Street No Suffix"] !== "None" ? location["Street No Suffix"] : '';
            const streetName = location["Street Name"] && location["Street Name"] !== "None" ? location["Street Name"] : '';
            const streetType = location["Street Type"] && location["Street Type"] !== "None" ? location["Street Type"] : '';
            const streetDirection = location["Street Direction"] && location["Street Direction"] !== "None" ? location["Street Direction"] : '';
            const postalCode = location["Postal Code"] && location["Postal Code"] !== "None" ? location["Postal Code"] : '';
            
            // Format: {Street Number}{Street No Suffix} {Street Name} {Street Type} {Street Direction}
            const streetAddress = [streetNo, streetNoSuffix, streetName, streetType, streetDirection]
              .filter(part => part && part !== "None")
              .join(' ');
            
            // Format: Toronto, ON  {Postal Code}
            const cityLine = postalCode ? `Toronto, ON  ${postalCode}` : 'Toronto, ON';
            
            formattedAddress = streetAddress ? `${streetAddress}\n${cityLine}` : cityLine;
            
            // Get URL and phone from maps using location ID
            const locationId = location["Location ID"].toString();
            const locationURL = locationURLMap.get(locationId) || undefined;
            const locationPhone = locationPhoneMap.get(locationId) || undefined;

            uniqueLocations.set(locationName, {
              name: locationName,
              lat: coords.lat,
              lng: coords.lng,
              address: formattedAddress || undefined,
              phone: locationPhone,
              url: locationURL
            });
          }
        }
      });
    }
    
    return Array.from(uniqueLocations.values());
  }, [results, allLocations, allDropIns, locationURLMap, locationPhoneMap, filters.location, hasSearched]);

  // Create a list of location names that should be available in the dropdown
  const availableLocationNames = useMemo(() => {
    // Get all locations that have programs in the upcoming week
    const locationsWithPrograms = new Set<number>();
    allDropIns.forEach(dropIn => {
      locationsWithPrograms.add(dropIn["Location ID"]);
    });
    
    // Return location names that have programs
    return allLocations
      .filter(location => locationsWithPrograms.has(location["Location ID"]))
      .map(location => location["Location Name"]);
  }, [allDropIns, allLocations]);

  const performSearch = async (searchFilters?: SearchFilters) => {
    const currentFilters = searchFilters || filters;
    
    setIsLoading(true);
    setHasSearched(true);

    try {
      let filteredResults = allDropIns;
      
      
      // Filter by category/subcategory first
      if (currentFilters.category) {
        // Use the new courseMatchesCategory function with age filtering
        filteredResults = filteredResults.filter(dropIn => {
          const courseTitle = dropIn["Course Title"];
          if (!courseTitle) return false;
          
          if (currentFilters.subcategory) {
            // Both category and subcategory specified - use additive age filtering
            return courseMatchesCategory(courseTitle, currentFilters.category, currentFilters.subcategory, dropIn["Age Min"], dropIn["Age Max"]);
          } else {
            // Only category specified
            return courseMatchesCategory(courseTitle, currentFilters.category, undefined, dropIn["Age Min"], dropIn["Age Max"]);
          }
        });
      } else if (currentFilters.subcategory) {
        // When no category is selected but a subcategory is, filter by that subcategory across all categories
        // Find which category this subcategory belongs to
        const parentCategory = categories.find(cat => 
          cat.subcategories.some(sub => sub.id === currentFilters.subcategory)
        );
        
        if (parentCategory) {
          filteredResults = filteredResults.filter(dropIn => {
            const courseTitle = dropIn["Course Title"];
            if (!courseTitle) return false;
            return courseMatchesCategory(courseTitle, parentCategory.id, currentFilters.subcategory, dropIn["Age Min"], dropIn["Age Max"]);
          });
        }
      }

      // Filter by specific course title (if selected)
      if (currentFilters.courseTitle) {
        filteredResults = filteredResults.filter(dropIn => 
          dropIn["Course Title"] === currentFilters.courseTitle
        );
      }

      // Filter by location
      if (currentFilters.location.length > 0) {
        // Find the location IDs for the selected location names
        const locationMap = new Map(allLocations.map(loc => [loc["Location Name"], loc["Location ID"]]));
        const selectedLocationIds = currentFilters.location
          .map(locationName => locationMap.get(locationName))
          .filter(id => id !== undefined);
        
        if (selectedLocationIds.length > 0) {
          filteredResults = filteredResults.filter(dropIn => 
            selectedLocationIds.includes(dropIn["Location ID"])
          );
        }
      }

      // Filter by date (if date is provided)
      if (currentFilters.date) {
        if (currentFilters.date === 'this-week') {
          // For "This week", show results from all days in the next 6 days (7 days total including today)
          const today = new Date();
          const nextWeek = new Date(today);
          nextWeek.setDate(today.getDate() + 6);
          
          // Use local date strings without timezone conversion
          const todayStr = getCurrentDate();
          const nextWeekYear = nextWeek.getFullYear();
          const nextWeekMonth = (nextWeek.getMonth() + 1).toString().padStart(2, '0');
          const nextWeekDay = nextWeek.getDate().toString().padStart(2, '0');
          const nextWeekStr = `${nextWeekYear}-${nextWeekMonth}-${nextWeekDay}`;
          
          filteredResults = filteredResults.filter(dropIn => {
            const firstDate = dropIn["First Date"];
            const lastDate = dropIn["Last Date"];
            
            // Check if the program runs during the next week
            return (firstDate <= nextWeekStr && lastDate >= todayStr);
          });
        } else if (currentFilters.date === 'tomorrow') {
          // For "Tomorrow", show results for tomorrow's date
          const today = new Date();
          const tomorrow = new Date(today);
          tomorrow.setDate(today.getDate() + 1);
          const tomorrowYear = tomorrow.getFullYear();
          const tomorrowMonth = (tomorrow.getMonth() + 1).toString().padStart(2, '0');
          const tomorrowDay = tomorrow.getDate().toString().padStart(2, '0');
          const tomorrowStr = `${tomorrowYear}-${tomorrowMonth}-${tomorrowDay}`;
          
          filteredResults = filteredResults.filter(dropIn => 
            isDateInRange(tomorrowStr, dropIn["Date Range"])
          );
        } else {
          // For specific dates, use the existing logic
          const normalizedDate = normalizeDatePickerValue(currentFilters.date);
          filteredResults = filteredResults.filter(dropIn => 
            isDateInRange(normalizedDate, dropIn["Date Range"])
          );
        }
      }

      // Filter by time (if time is provided and not "Any time")
      if (currentFilters.time && currentFilters.time !== 'Any time') {
        const targetTime = formatTimeStringForComparison(currentFilters.time);
        filteredResults = filteredResults.filter(dropIn => {
          const startTime = formatTimeForComparison(dropIn["Start Hour"], dropIn["Start Minute"]);
          const endTime = formatTimeForComparison(dropIn["End Hour"], dropIn["End Min"]);
          // Show programs that start at or before the target time and end after the target time
          // This includes programs that start exactly at the target time
          return targetTime >= startTime && targetTime < endTime;
        });
      }

      // Filter by age (if age is provided)
      if (currentFilters.age) {
        const selectedAge = parseInt(currentFilters.age);
        filteredResults = filteredResults.filter(dropIn => {
          const ageMin = parseInt(dropIn["Age Min"]) || 0;
          const ageMax = dropIn["Age Max"] === "None" ? 999 : parseInt(dropIn["Age Max"]) || 999;
          
          // Check if the selected age falls within the program's age range
          return selectedAge >= ageMin && selectedAge <= ageMax;
        });
      }

      // Convert to search results format
      const locationMap = new Map(allLocations.map(loc => [loc["Location ID"], loc["Location Name"]]));
      const searchResults: SearchResult[] = filteredResults.map(dropIn => {
        const locationName = locationMap.get(dropIn["Location ID"]) || 'Unknown Location';
        const startTime = `${dropIn["Start Hour"].toString().padStart(2, '0')}:${dropIn["Start Minute"].toString().padStart(2, '0')}`;
        const endTime = `${dropIn["End Hour"].toString().padStart(2, '0')}:${dropIn["End Min"].toString().padStart(2, '0')}`;
        
        const resultDate = currentFilters.date && currentFilters.date !== 'this-week' && currentFilters.date !== 'tomorrow' ? normalizeDatePickerValue(currentFilters.date) : dropIn["First Date"];
        
        // Get URL and address for this location using location ID
        const locationId = dropIn["Location ID"].toString();
        const locationURL = locationURLMap.get(locationId) || null;
        const locationAddress = locationAddressMap.get(locationId) || null;
        
        // Get category information for this program
        const categorizations = categorizeCourse(dropIn["Course Title"], dropIn["Age Min"], dropIn["Age Max"]);
        const primaryCategory = categorizations.length > 0 ? categorizations[0] : null;
        
        // Calculate age range display
        const ageMin = dropIn["Age Min"];
        const ageMax = dropIn["Age Max"];
        let ageRange = '';
        if (ageMax === "None") {
          ageRange = `Ages ${ageMin}+`;
        } else {
          ageRange = `Ages ${ageMin}-${ageMax}`;
        }
        
        return {
          courseTitle: dropIn["Course Title"],
          location: locationName,
          dayOfWeek: getDayOfWeek(dropIn["First Date"]),
          startTime: startTime,
          endTime: endTime,
          date: resultDate,
          locationURL: locationURL,
          locationAddress: locationAddress,
          category: primaryCategory?.category,
          subcategory: primaryCategory?.subcategory,
          ageRange: ageRange,
          "Age Min": dropIn["Age Min"],
          "Age Max": dropIn["Age Max"]
        };
      });

      setResults(searchResults);
    } catch (err) {
      console.error('Error performing search:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLocationSelect = (location: string) => {
    // Toggle selection: if clicking the same location, deselect it
    const newSelectedLocation = selectedLocation === location ? undefined : location;
    setSelectedLocation(newSelectedLocation);
    
    // Trigger search refresh when location selection changes
    performSearch();
  };

  // Trigger initial search when data is loaded (but not if URL has parameters)
  useEffect(() => {
    if (allDropIns.length > 0 && !hasSearched) {
      // Check if there are URL parameters - if so, let SearchForm handle the search
      const params = new URLSearchParams(window.location.search);
      if (params.toString()) {
        return;
      }
      // Compute smart defaults based on actual activity data before the first search
      const smartDefaults = getSmartDefaults(allDropIns);
      const defaultFilters: SearchFilters = {
        courseTitle: '',
        category: '',
        subcategory: '',
        date: smartDefaults.date,
        time: smartDefaults.time,
        location: [],
        age: ''
      };
      setFilters(defaultFilters);
      performSearch(defaultFilters);
    }
  }, [allDropIns.length, hasSearched]);

  return {
    filters,
    setFilters,
    results,
    isLoading,
    hasSearched,
    selectedLocation,
    sortOrder,
    setSortOrder,
    mapLocations,
    availableLocationNames,
    performSearch,
    handleLocationSelect
  };
};
