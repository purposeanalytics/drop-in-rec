import { useCallback, useEffect, useRef, useState } from 'react';
import SearchForm from './components/SearchForm';
import SearchResults from './components/SearchResults';
import LocationMap from './components/LocationMap';
import AppHeader from './components/AppHeader';
import LoadingScreen from './components/LoadingScreen';
import ErrorScreen from './components/ErrorScreen';
import { WODModal } from './components/WODModal';
import { useAppData } from './hooks/useAppData';
import { useSearchLogic } from './hooks/useSearchLogic';
import { categories } from './services/categories';
import {
  generateOrganizationSchema,
  generateWebSiteSchema,
  generateEventSchema,
  generateLocalBusinessSchema
} from './utils/structuredData';

function App() {
  const {
    allCourseTitles,
    allDropIns,
    allLocations,
    locationURLMap,
    locationAddressMap,
    locationPhoneMap,
    locationCoordsMap,
    isInitialLoading,
    error
  } = useAppData();

  const {
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
  } = useSearchLogic(allDropIns, allLocations, locationURLMap, locationAddressMap, locationPhoneMap, locationCoordsMap);

  const [hoveredLocation, setHoveredLocation] = useState<string | null>(null);
  const [showWOD, setShowWOD] = useState(false);

  // Close WOD modal when the user changes any search filter
  useEffect(() => {
    setShowWOD(false);
  }, [filters]);

  // Easter egg: type "gianni" while Wallace Emerson is selected (via search or map marker)
  const filtersRef = useRef(filters);
  filtersRef.current = filters;
  const selectedLocationRef = useRef(selectedLocation);
  selectedLocationRef.current = selectedLocation;
  useEffect(() => {
    const SECRET = 'wesharks';
    const LOCATION = 'Wallace Emerson Community Recreation Centre';
    let buffer = '';

    const handleKeyDown = (e: KeyboardEvent) => {
      const wallaceActive =
        filtersRef.current.location.includes(LOCATION) ||
        selectedLocationRef.current === LOCATION;
      if (!wallaceActive) {
        buffer = '';
        return;
      }
      if (e.key.length === 1) {
        buffer += e.key.toLowerCase();
        if (buffer.length > SECRET.length) buffer = buffer.slice(-SECRET.length);
        if (buffer === SECRET) {
          setShowWOD(true);
          buffer = '';
        }
      } else if (!['Shift', 'Control', 'Alt', 'Meta', 'CapsLock'].includes(e.key)) {
        buffer = '';
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);
  const locationHasResults = useCallback(
    (locationName: string) => results.some(result => result.location === locationName),
    [results]
  );

  // Handle category filter from map popup
  const handleCategoryFilter = (location: string, categoryId: string) => {
    const newFilters = { ...filters };
    
    // Set the category filter
    newFilters.category = categoryId || '';
    newFilters.subcategory = ''; // Clear subcategory when category changes
    
    // Set the location filter to include this location
    if (categoryId && !newFilters.location.includes(location)) {
      newFilters.location = [location];
    } else if (!categoryId) {
      // If clearing category, keep the location filter as is
      // (don't change location filter when deselecting category)
    }
    
    setFilters(newFilters);
    performSearch(newFilters);
  };

  // Update page title and SEO metadata based on search filters
  useEffect(() => {
    const baseTitle = 'Toronto Drop-in Recreation Finder';
    const baseDescription = 'Discover drop-in recreation programs and activities across Toronto. Find swimming, fitness, sports, arts, and community programs near you using an interactive map and search tool.';
    const baseUrl = 'https://recfinderto.ca';
    
    let title = baseTitle;
    let description = baseDescription;
    let canonicalUrl = baseUrl;
    
    // Build search-specific metadata with priority: courseTitle > subcategory > category > single location > special dates
    if (hasSearched) {
      let searchTerm = '';
      
      // Only use course title if it's a valid course from the list (prevents arbitrary text in title)
      const isValidCourse = filters.courseTitle && allCourseTitles.includes(filters.courseTitle);
      
      if (isValidCourse) {
        searchTerm = filters.courseTitle;
        description = `Find ${filters.courseTitle} drop-in programs in Toronto. ${baseDescription}`;
      } else if (filters.subcategory) {
        // Get subcategory display name
        const category = categories.find(cat => 
          cat.subcategories.some(sub => sub.id === filters.subcategory)
        );
        const subcategory = category?.subcategories.find(sub => sub.id === filters.subcategory);
        searchTerm = subcategory?.name || filters.subcategory;
        description = `Find ${searchTerm} drop-in programs in Toronto. ${baseDescription}`;
      } else if (filters.category) {
        // Get category display name
        const category = categories.find(cat => cat.id === filters.category);
        searchTerm = category?.name || filters.category;
        description = `Find ${searchTerm} drop-in programs in Toronto. ${baseDescription}`;
      } else if (filters.location.length === 1) {
        // Single location selected
        searchTerm = filters.location[0];
        description = `Find drop-in programs at ${searchTerm} in Toronto. ${baseDescription}`;
      } else if (filters.date === 'tomorrow') {
        // Special date: tomorrow (only if no other filters are selected)
        searchTerm = "What's Open Tomorrow";
        description = `Find drop-in programs open tomorrow in Toronto. ${baseDescription}`;
      } else if (filters.date === 'this-week') {
        // Special date: this week (only if no other filters are selected)
        searchTerm = "What's Open This Week";
        description = `Find drop-in programs open this week in Toronto. ${baseDescription}`;
      }
      
      if (searchTerm) {
        title = `${searchTerm} | ${baseTitle}`;
        
        // Include search params in canonical URL for shared searches
        const params = new URLSearchParams(window.location.search);
        if (params.toString()) {
          canonicalUrl = `${baseUrl}/?${params.toString()}`;
        }
      }
    }
    
    // Update document title
    document.title = title;
    
    // Helper function to update or create meta tags
    const updateMetaTag = (property: string, content: string, isProperty = true) => {
      const selector = isProperty 
        ? `meta[property="${property}"]` 
        : `meta[name="${property}"]`;
      
      let tag = document.querySelector(selector);
      
      if (!tag) {
        tag = document.createElement('meta');
        if (isProperty) {
          tag.setAttribute('property', property);
        } else {
          tag.setAttribute('name', property);
        }
        document.head.appendChild(tag);
      }
      
      tag.setAttribute('content', content);
    };
    
    // Update meta description
    updateMetaTag('description', description, false);
    
    // Update Open Graph tags
    updateMetaTag('og:title', title);
    updateMetaTag('og:description', description);
    updateMetaTag('og:url', canonicalUrl);
    
    // Update Twitter tags
    updateMetaTag('twitter:title', title);
    updateMetaTag('twitter:description', description);
    updateMetaTag('twitter:url', canonicalUrl);
    
    // Update canonical link
    let canonicalLink = document.querySelector('link[rel="canonical"]');
    if (!canonicalLink) {
      canonicalLink = document.createElement('link');
      canonicalLink.setAttribute('rel', 'canonical');
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.setAttribute('href', canonicalUrl);
    
  }, [filters.courseTitle, filters.category, filters.subcategory, filters.location.join(','), filters.date, hasSearched, allCourseTitles]);

  // Update JSON-LD structured data based on search state
  useEffect(() => {
    // Helper function to inject or update JSON-LD script
    const injectJSONLD = (id: string, schema: any) => {
      // Remove existing script if it exists
      const existingScript = document.getElementById(id);
      if (existingScript) {
        existingScript.remove();
      }
      
      // Create new script tag
      const script = document.createElement('script');
      script.id = id;
      script.type = 'application/ld+json';
      script.textContent = JSON.stringify(schema);
      document.head.appendChild(script);
    };
    
    // Always inject Organization and WebSite schemas
    injectJSONLD('schema-organization', generateOrganizationSchema());
    injectJSONLD('schema-website', generateWebSiteSchema());
    
    // Create mapping from location name to location ID
    const locationNameToIdMap = new Map<string, string>();
    allLocations.forEach(loc => {
      locationNameToIdMap.set(loc["Location Name"], loc["Location ID"].toString());
    });
    
    // Helper function to get location data by name
    const getLocationData = (locationName: string) => {
      const locationId = locationNameToIdMap.get(locationName);
      if (!locationId) return null;
      
      const coords = locationCoordsMap.get(locationId);
      const address = locationAddressMap.get(locationId);
      const url = locationURLMap.get(locationId);
      
      return { locationId, coords, address, url };
    };
    
    // Inject Event schemas when results exist (limit to first 20 to avoid overwhelming the page)
    const existingEventScripts = document.querySelectorAll('script[id^="schema-event-"]');
    existingEventScripts.forEach(script => script.remove());
    
    if (results.length > 0) {
      const eventResults = results.slice(0, 20); // Limit to first 20 events
      eventResults.forEach((result, index) => {
        const locationData = getLocationData(result.location);
        const eventSchema = generateEventSchema(result, locationData?.coords);
        
        if (eventSchema) {
          injectJSONLD(`schema-event-${index}`, eventSchema);
        }
      });
    }
    
    // Inject LocalBusiness schema when a single location is selected
    const existingBusinessScript = document.getElementById('schema-localbusiness');
    if (existingBusinessScript) {
      existingBusinessScript.remove();
    }
    
    if (filters.location.length === 1) {
      const locationName = filters.location[0];
      const locationData = getLocationData(locationName);
      
      if (locationData) {
        const businessSchema = generateLocalBusinessSchema(
          locationName,
          locationData.address,
          locationData.coords,
          locationData.url || undefined
        );
        injectJSONLD('schema-localbusiness', businessSchema);
      }
    }
    
  }, [results, filters.location, allLocations, locationCoordsMap, locationAddressMap, locationURLMap]);

  if (isInitialLoading) {
    return <LoadingScreen />;
  }

  if (error) {
    return <ErrorScreen error={error} />;
  }

  return (
    <div className="relative flex min-h-screen lg:h-screen w-full flex-col bg-[#f6f7f8] dark:bg-slate-900 text-slate-800 dark:text-slate-200">
      <div className="flex flex-1 flex-col min-h-0">
        {/* Header */}
        <AppHeader onAboutClick={() => {}} />

        {/* Main content area - Responsive layout */}
        <div className="flex flex-1 min-h-0 flex-col lg:flex-row">
          {/* Search Form - Full width on mobile, sidebar on desktop */}
          <aside className="w-full lg:w-[460px] flex-shrink-0 border-r-0 lg:border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex flex-col min-h-0">
            <SearchForm
              filters={filters}
              onFiltersChange={setFilters}
              onSearch={performSearch}
              isLoading={isLoading}
              allDropIns={allDropIns}
              courseTitles={allCourseTitles}
              locations={availableLocationNames}
              allLocations={allLocations}
              onProgramInput={(value) => {
                const LOCATION = 'Wallace Emerson Community Recreation Centre';
                const wallaceActive = filters.location.includes(LOCATION) || selectedLocation === LOCATION;
                if (wallaceActive && value.toLowerCase().includes('wesharks')) setShowWOD(true);
              }}
            />
            <div className="flex-1 min-h-0 lg:block hidden">
              <SearchResults
                results={results}
                isLoading={isLoading}
                hasSearched={hasSearched}
                onLocationSelect={handleLocationSelect}
                onLocationHover={setHoveredLocation}
                selectedLocation={selectedLocation}
                sortOrder={sortOrder}
                onSortOrderChange={(sortOrder: 'location-name' | 'earliest' | 'latest' | 'open-longest') => setSortOrder(sortOrder)}
              />
            </div>
          </aside>

          {/* Map and Results - Full width on mobile, right side on desktop */}
          <main className="flex-1 min-h-0 flex flex-col lg:block">
            {/* Map - Above results on mobile, full area on desktop */}
            <div className="relative h-[300px] lg:h-full w-full">
              <LocationMap
                key={`${mapLocations.length}-${results.length}`}
                locations={mapLocations}
                isLoading={isLoading}
                selectedLocation={selectedLocation}
                onLocationSelect={handleLocationSelect}
                selectedLocations={filters.location}
                hoveredLocation={hoveredLocation ?? undefined}
                locationHasResults={locationHasResults}
                allDropIns={allDropIns}
                allLocations={allLocations}
                onCategoryFilter={handleCategoryFilter}
                currentCategory={filters.category}
              />
        </div>

            {/* Mobile Results - Below map on mobile, hidden on desktop */}
            <div className="lg:hidden flex-1 min-h-0">
          <SearchResults
            results={results}
            isLoading={isLoading}
            hasSearched={hasSearched}
            onLocationSelect={handleLocationSelect}
            onLocationHover={setHoveredLocation}
            selectedLocation={selectedLocation}
            sortOrder={sortOrder}
            onSortOrderChange={setSortOrder}
          />
        </div>
          </main>
        </div>
      </div>

      <WODModal isOpen={showWOD} onClose={() => setShowWOD(false)} />
      </div>
  );
}

export default App;
