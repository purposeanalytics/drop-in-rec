import React, { useCallback, useEffect, useRef, useState } from 'react';
import { categories, courseMatchesCategory } from '../services/categories';
import type { DropInRecord, Location as LocationType } from '../types';

interface Location {
  name: string;
  lat: number;
  lng: number;
  address?: string;
  phone?: string;
  url?: string;
}

interface LocationMapProps {
  locations: Location[];
  isLoading: boolean;
  selectedLocation?: string;
  onLocationSelect?: (location: string) => void;
  selectedLocations?: string[];
  hoveredLocation?: string;
  locationHasResults?: (locationName: string) => boolean;
  allDropIns?: DropInRecord[];
  allLocations?: LocationType[];
  onCategoryFilter?: (location: string, categoryId: string) => void;
  currentCategory?: string;
}

const LocationMap: React.FC<LocationMapProps> = ({
  locations,
  isLoading,
  selectedLocation,
  onLocationSelect,
  selectedLocations = [],
  hoveredLocation,
  locationHasResults,
  allDropIns = [],
  allLocations = [],
  onCategoryFilter,
  currentCategory
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const markers = useRef<Map<string, any>>(new Map());
  const [mapboxLoaded, setMapboxLoaded] = useState(false);
  const openPopupLocation = useRef<string | null>(null);
  const preventPopupClose = useRef<boolean>(false);
  const prevSelectedLocation = useRef<string | null>(null);

  // Helper function to get available categories for a location
  const getAvailableCategories = (locationName: string): Array<{ id: string; name: string; icon: string }> => {
    if (!allDropIns.length || !allLocations.length) return [];

    // Find the location ID
    const location = allLocations.find(loc => loc["Location Name"] === locationName);
    if (!location) return [];

    const locationId = location["Location ID"];

    // Get all programs at this location
    const locationPrograms = allDropIns.filter(dropIn => dropIn["Location ID"] === locationId);

    // Find which categories have programs at this location
    const availableCategoryIds = new Set<string>();
    
    locationPrograms.forEach(dropIn => {
      const courseTitle = dropIn["Course Title"];
      if (!courseTitle) return;

      // Check each category to see if this program matches
      categories.forEach(category => {
        if (courseMatchesCategory(courseTitle, category.id, undefined, dropIn["Age Min"], dropIn["Age Max"])) {
          availableCategoryIds.add(category.id);
        }
      });
    });

    // Return category info for available categories
    return categories
      .filter(cat => availableCategoryIds.has(cat.id))
      .map(cat => ({
        id: cat.id,
        name: cat.name,
        icon: cat.fallbackIcon
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  };



  const addLabelLayer = useCallback(() => {
    if (!map.current) return;
    try {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const textColor = isDark ? '#9ca3af' : '#808080';
      const haloColor = isDark ? 'rgba(15,23,42,0.85)' : 'rgba(255,255,255,0.9)';

      // Borrow a regular (non-italic) font from the style's own label layers
      let styleFont = ['Noto Sans Regular', 'Arial Unicode MS Regular'];
      try {
        const layers = map.current.getStyle().layers;
        const lbl = layers.find((l: any) => {
          if (l.type !== 'symbol' || !l.layout?.['text-field']) return false;
          const fonts: string[] = l.layout?.['text-font'] ?? [];
          return fonts.some(f => /regular/i.test(f) && !/italic/i.test(f));
        });
        if (lbl?.layout?.['text-font']) styleFont = lbl.layout['text-font'];
      } catch {}

      if (!map.current.getSource('location-labels')) {
        map.current.addSource('location-labels', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] }
        });
      }
      if (!map.current.getLayer('location-label-layer')) {
        map.current.addLayer({
          id: 'location-label-layer',
          type: 'symbol',
          source: 'location-labels',
          minzoom: 11,
          layout: {
            'text-field': ['get', 'name'],
            'text-font': styleFont,
            'text-size': 13,
            'text-anchor': 'top',
            'text-offset': [0, 1.0],
            'text-allow-overlap': false,
            'text-max-width': 8,
            'text-line-height': 1.1,
          },
          paint: {
            'text-color': textColor,
            'text-halo-color': haloColor,
            'text-halo-width': 1.5,
          }
        });
      }
    } catch (e) {
      console.warn('Could not add label layer:', e);
    }
  }, []);

  // Wait for Mapbox to load
  useEffect(() => {
    let attempts = 0;
    const maxAttempts = 50; // 5 seconds max wait
    
    const checkMapLibre = () => {
      if (typeof (window as any).maplibregl !== 'undefined') {
        setMapboxLoaded(true);
      } else if (attempts < maxAttempts) {
        attempts++;
        setTimeout(checkMapLibre, 100);
      } else {
        setMapboxLoaded(false);
      }
    };
    checkMapLibre();
  }, []);

  // Initialize map only once
  useEffect(() => {
    if (!mapContainer.current || !mapboxLoaded || map.current) return;

    try {
      // Detect dark mode preference
      const isDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      const mapStyle = isDarkMode 
        ? 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json' 
        : 'https://tiles.openfreemap.org/styles/positron';
      
      map.current = new (window as any).maplibregl.Map({
        container: mapContainer.current,
        style: mapStyle,
        center: [-79.3832, 43.6532], // Default to Toronto center
        zoom: 10,
        backgroundColor: '#f8f9fa' // Light gray background to prevent black flash
      });

      // Add navigation controls
      map.current.addControl(new (window as any).maplibregl.NavigationControl());
      
      // Force resize and add label layer after map loads
      map.current.on('load', () => {
        setTimeout(() => {
          if (map.current) {
            map.current.resize();
          }
        }, 100);
        addLabelLayer();
      });

      // Listen for dark mode changes
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleDarkModeChange = (e: MediaQueryListEvent) => {
        if (map.current) {
          const newStyle = e.matches
            ? 'https://tiles.openfreemap.org/styles/dark-matter'
            : 'https://tiles.openfreemap.org/styles/positron';
          map.current.setStyle(newStyle);
          // Re-add label layer after the new style finishes loading
          map.current.once('style.load', addLabelLayer);
        }
      };
      
      mediaQuery.addEventListener('change', handleDarkModeChange);
      
      // Store the listener for cleanup
      (map.current as any)._darkModeListener = { mediaQuery, handleDarkModeChange };
      
      // Add simple resize handler
      const handleResize = () => {
        if (map.current) {
          map.current.resize();
        }
      };
      
      window.addEventListener('resize', handleResize);
      (map.current as any)._resizeHandler = handleResize;
      
    } catch (error) {
      console.error('Map initialization error:', error);
    }
  }, [mapboxLoaded]);


  // Update markers and center map when locations change
  useEffect(() => {
    if (!map.current || !mapboxLoaded) return;

    const timer = setTimeout(() => {
    // Store which popup was open before clearing markers (for potential future use)
    // const previouslyOpenLocation = openPopupLocation.current;

    // If no locations, clear markers and return
    if (locations.length === 0) {
      markers.current.forEach(marker => marker.remove());
      markers.current.clear();
      return;
    }

    // Always clear existing markers first
    markers.current.forEach(marker => marker.remove());
    markers.current.clear();

    // Force resize and re-render when locations change from empty to having locations
    // This ensures the map renders properly after being hidden
    setTimeout(() => {
      if (map.current) {
        map.current.resize();
        // Force a style refresh to ensure proper rendering
        map.current.getStyle();
      }
    }, 100);

    // Add markers for each location
    locations.forEach((location) => {
      try {
        if (!location.lat || !location.lng) {
          return;
        }

        const isSelected = selectedLocation === location.name;
        const isInSelectedLocations = selectedLocations.includes(location.name);
        
        // Create custom marker element
        const markerElement = document.createElement('div');
        markerElement.className = 'custom-marker';
        
        if (isSelected) {
          // Currently selected marker - check if it has results to determine color
          const hasResultsForLocation = locationHasResults ? locationHasResults(location.name) : false;
          const isInSelectedLocations = selectedLocations.includes(location.name);
          
          // Check if mobile screen (less than 10240px)
          const isMobile = window.innerWidth < 1024;
          
          let color, size;
          if (isInSelectedLocations && !hasResultsForLocation) {
            // Selected location with no results - darker gray and larger
            color = 'rgb(128, 128, 128)';
            size = isMobile ? '22px' : '26px';
          } else {
            // Selected location with results or not in selected locations - blue
            color = 'rgb(20, 161, 255)';
            size = isMobile ? '22px' : '26px';
          }
          
          markerElement.style.cssText = `
            width: ${size};
            height: ${size};
            background-color: ${color};
            border: 2px solid white;
            border-radius: 50%;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
            cursor: pointer;
            transition: all 0.2s ease;
          `;
        } else if (isInSelectedLocations) {
          // Selected location - light blue if has results for this specific location, gray if no results
          const hasResultsForLocation = locationHasResults ? locationHasResults(location.name) : false;
          const color = hasResultsForLocation ? 'rgb(149, 214, 247)' : 'rgb(180, 180, 180)';
          const isMobile = window.innerWidth < 1024;
          const size = isMobile ? '16px' : '20px';
          
          markerElement.style.cssText = `
            width: ${size};
            height: ${size};
            background-color: ${color};
            border: 2px solid white;
            border-radius: 50%;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
            cursor: pointer;
            transition: all 0.2s ease;
          `;
        } else {
          // Default marker - light blue
          const isMobile = window.innerWidth < 1024;
          const size = isMobile ? '16px' : '20px';
          
          markerElement.style.cssText = `
            width: ${size};
            height: ${size};
            background-color:rgb(149, 214, 247);
            border: 2px solid white;
            border-radius: 50%;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
            cursor: pointer;
            transition: all 0.2s ease;
          `;
        }

        // Get available categories for this location
        const availableCategories = getAvailableCategories(location.name);
        
        // Build category filter buttons HTML
        let categoryFiltersHTML = '';
        if (availableCategories.length > 0 && onCategoryFilter) {
          const categoryButtons = availableCategories.map(cat => {
            const escapedLocationName = location.name.replace(/'/g, "\\'").replace(/"/g, '&quot;');
            const escapedCategoryId = cat.id.replace(/'/g, "\\'").replace(/"/g, '&quot;');
            const isSelected = currentCategory === cat.id && selectedLocations.includes(location.name);
            const restingStyle = isSelected
              ? 'display:inline-flex;align-items:center;justify-content:center;width:2rem;height:2rem;border-radius:0.5rem;background:rgba(19,164,236,0.2);color:#13a4ec;border:2px solid #13a4ec;outline:none;cursor:pointer;transition:background 0.15s;'
              : 'display:inline-flex;align-items:center;justify-content:center;width:2rem;height:2rem;border-radius:0.5rem;background:#f1f5f9;color:#6b7280;border:0;outline:none;cursor:pointer;transition:background 0.15s,color 0.15s;';
            const hoverIn = isSelected
              ? "this.style.background='rgba(19,164,236,0.3)'"
              : "this.style.background='rgba(19,164,236,0.1)';this.style.color='#13a4ec'";
            const hoverOut = isSelected
              ? "this.style.background='rgba(19,164,236,0.2)'"
              : "this.style.background='#f1f5f9';this.style.color='#6b7280'";
            return `
              <button
                class="category-filter-btn"
                style="${restingStyle}"
                data-location="${escapedLocationName}"
                data-category="${escapedCategoryId}"
                title="${cat.name}"
                tabindex="-1"
                onfocus="this.blur()"
                onmouseover="${hoverIn}"
                onmouseout="${hoverOut}"
              >
                <span class="material-symbols-outlined text-base">${cat.icon}</span>
              </button>
            `;
          }).join('');

          categoryFiltersHTML = `
            <div class="mt-2 pt-2 border-t border-slate-200">
              <p class="text-xs font-semibold text-slate-600 mb-2">Programs at this location:</p>
              <div class="flex flex-wrap gap-1.5">
                ${categoryButtons}
              </div>
            </div>
          `;
        }

        const popup = new (window as any).maplibregl.Popup().setHTML(`
              <div class="p-2">
                <h3 class="font-semibold text-base text-slate-800 dark:text-slate-800">${location.name}</h3>
                ${location.address ? `
                  <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location.address + ', Toronto, ON')}" target="_blank" rel="noopener noreferrer" style="display:flex;align-items:flex-start;gap:6px;margin-top:4px;color:#64748b;text-decoration:none;background:none;outline:none;" onmouseover="this.style.color='#13a4ec'" onmouseout="this.style.color='#64748b'" title="Open in Google Maps">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style="flex-shrink:0;margin-top:3px;" width="14" height="14"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
                    <span style="font-size:0.875rem;white-space:pre-line;">${location.address}</span>
                  </a>
                ` : ''}
                ${location.phone ? `
                  <a href="tel:${location.phone}" style="display:flex;align-items:center;gap:6px;margin-top:4px;color:#64748b;text-decoration:none;background:none;" onmouseover="this.style.color='#13a4ec'" onmouseout="this.style.color='#64748b'" title="Call">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style="flex-shrink:0;" width="14" height="14"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg>
                    <span style="font-size:0.875rem;">${location.phone}</span>
                  </a>
                ` : ''}
                ${categoryFiltersHTML}
                ${location.url ? `
                  <a class="p-1 mt-3 inline-flex items-center justify-center line-height-1 w-full bg-[#13a4ec]/10 dark:bg-[#13a4ec]/20 text-gray-700 dark:text-gray-700 text-sm font-medium px-4 rounded-lg hover:text-black dark:hover:text-white hover:bg-[#13a4ec]/1 dark:hover:bg-[#13a4ec]/30 hover:shadow-lg hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-[#13a4ec] focus:ring-offset-2 focus:bg-[#13a4ec]/20 dark:focus:bg-[#13a4ec]/30 focus:text-[#13a4ec] dark:focus:text-[#13a4ec] focus:shadow-lg transition-all duration-200 ease-in-out" href="${location.url}" target="_blank" rel="noopener noreferrer">
                    <span>View on City Website</span>
                    <span class="material-symbols-outlined ml-2 text-base transition-transform duration-200 ease-in-out group-hover:translate-x-1">arrow_right_alt</span>
                  </a>
                ` : ''}
              </div>
            `);
        
        // Track popup open/close events
        popup.on('open', () => {
          openPopupLocation.current = location.name;
          preventPopupClose.current = false;
        });
        
        popup.on('close', () => {
          // Don't clear if we're intentionally keeping this popup open
          // Only clear if it's the same location and we're not keeping it open
          if (openPopupLocation.current === location.name) {
            // Check if we should keep it open (e.g., after a category filter click)
            // Delay clearing to allow for reopening
            setTimeout(() => {
              // Only clear if popup is still closed and we haven't set it again
              const marker = markers.current.get(location.name);
              if (marker) {
                const currentPopup = marker.getPopup();
                if (!currentPopup.isOpen() && openPopupLocation.current === location.name) {
                  openPopupLocation.current = null;
                }
              }
            }, 300);
          }
        });

        const marker = new (window as any).maplibregl.Marker({ element: markerElement })
          .setLngLat([location.lng, location.lat])
          .setPopup(popup)
          .addTo(map.current);

        // Add click handlers for category filter buttons
        if (onCategoryFilter && availableCategories.length > 0) {
          // Use the popup's open event to ensure the element exists
          marker.getPopup().once('open', () => {
            const popupElement = marker.getPopup().getElement();
            if (popupElement) {
              // Remove focus from any buttons to prevent outline
              const buttons = popupElement.querySelectorAll('.category-filter-btn');
              buttons.forEach((btn: Element) => {
                (btn as HTMLElement).blur();
              });
              
              // Don't auto-focus the link as it interferes with user input in other fields
              
              // Use event delegation from the popup element
              popupElement.addEventListener('click', (e: MouseEvent) => {
                const target = e.target as HTMLElement;
                const button = target.closest('.category-filter-btn') as HTMLElement;
                if (button) {
                  e.preventDefault();
                  e.stopPropagation();
                  e.stopImmediatePropagation();
                  const locationName = button.getAttribute('data-location');
                  const categoryId = button.getAttribute('data-category');
                  if (locationName && categoryId && onCategoryFilter) {
                    // Check if this category is already selected - if so, clear the filter
                    const isCurrentlySelected = currentCategory === categoryId && selectedLocations.includes(locationName);
                    const filterCategoryId = isCurrentlySelected ? '' : categoryId;
                    
                    // Store that this popup should stay open and prevent it from closing
                    openPopupLocation.current = locationName;
                    preventPopupClose.current = true;
                    onCategoryFilter(locationName, filterCategoryId);
                    // Keep popup open - check and reopen if needed
                    setTimeout(() => {
                      const marker = markers.current.get(locationName);
                      if (marker && openPopupLocation.current === locationName) {
                        const popup = marker.getPopup();
                        if (!popup.isOpen()) {
                          marker.togglePopup();
                        }
                      }
                    }, 50);
                    // Also check again after a longer delay in case of async updates
                    setTimeout(() => {
                      const marker = markers.current.get(locationName);
                      if (marker && openPopupLocation.current === locationName) {
                        const popup = marker.getPopup();
                        if (!popup.isOpen()) {
                          marker.togglePopup();
                        }
                      }
                      // Reset the prevent close flag after ensuring popup is open
                      preventPopupClose.current = false;
                    }, 250);
                  }
                }
              });
            }
          });
        }

        // Add click handler to marker
        markerElement.addEventListener('click', (e) => {
          e.stopPropagation();
          onLocationSelect?.(location.name);
          // Popup opening is handled by the selectedLocation useEffect
        });

        markers.current.set(location.name, marker);
      } catch (error) {
        // Silently handle marker creation errors
      }
    });

    // Fit map to show all markers
    if (locations.length > 0) {
      try {
        if (locations.length === 1) {
          // Center on single location
          const location = locations[0];
          if (location.lat && location.lng) {
            map.current.setCenter([location.lng, location.lat]);
            map.current.setZoom(12);
          }
        } else {
          // Fit bounds for multiple locations
          const bounds = new (window as any).maplibregl.LngLatBounds();
          locations.forEach(location => {
            if (location.lat && location.lng) {
              bounds.extend([location.lng, location.lat]);
            }
          });
          map.current.fitBounds(bounds, { padding: 50, maxZoom: 15 });
        }
      } catch (error) {
        // Silently handle bounds fitting errors
      }
    }

    // Reopen popup for the selected location after markers are recreated
    if (selectedLocation) {
      const selMarker = markers.current.get(selectedLocation);
      if (selMarker && !selMarker.getPopup().isOpen()) {
        selMarker.togglePopup();
      }
    }

    }, 200);

    return () => clearTimeout(timer);
  }, [locations, mapboxLoaded, selectedLocations, locationHasResults]);

  // Keep label source data in sync with the current location list
  useEffect(() => {
    if (!map.current || !mapboxLoaded) return;

    const update = () => {
      if (!map.current) return;
      // Ensure the layer exists before trying to update its source
      addLabelLayer();
      const source = map.current.getSource('location-labels') as any;
      if (!source) return;
      source.setData({
        type: 'FeatureCollection',
        features: locations
          .filter(l => l.lat && l.lng)
          .map(l => ({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [l.lng, l.lat] },
            properties: { name: l.name }
          }))
      });
    };

    if (map.current.isStyleLoaded()) {
      update();
    } else {
      map.current.once('style.load', update);
    }
  }, [locations, mapboxLoaded, addLabelLayer]);

  // Handle popup opening/closing and immediate dot appearance when selected location changes
  useEffect(() => {
    if (!map.current || !mapboxLoaded) return;

    // Close all open popups first
    markers.current.forEach(marker => {
      if (marker.getPopup().isOpen()) marker.togglePopup();
    });

    // Revert any hover z-index elevation
    markers.current.forEach(marker => {
      const el = marker.getElement();
      if (!el) return;
      el.style.zIndex = '';
      el.style.position = '';
      if (el.parentElement) el.parentElement.style.zIndex = '';
    });

    const isMobile = window.innerWidth < 1024;

    // Revert previously selected marker to its unselected appearance
    const prev = prevSelectedLocation.current;
    if (prev && prev !== selectedLocation) {
      const prevMarker = markers.current.get(prev);
      if (prevMarker) {
        const el = prevMarker.getElement();
        if (el) {
          const size = isMobile ? '16px' : '20px';
          const isInSelected = selectedLocations.includes(prev);
          const hasResults = locationHasResults ? locationHasResults(prev) : false;
          el.style.width = size;
          el.style.height = size;
          el.style.backgroundColor = isInSelected && !hasResults ? 'rgb(180, 180, 180)' : 'rgb(149, 214, 247)';
          el.dataset.baseSize = size;
        }
      }
    }

    // Apply selected appearance to the new marker immediately
    if (selectedLocation) {
      const selMarker = markers.current.get(selectedLocation);
      if (selMarker) {
        const el = selMarker.getElement();
        if (el) {
          const size = isMobile ? '22px' : '26px';
          const isInSelected = selectedLocations.includes(selectedLocation);
          const hasResults = locationHasResults ? locationHasResults(selectedLocation) : false;
          el.style.width = size;
          el.style.height = size;
          el.style.backgroundColor = isInSelected && !hasResults ? 'rgb(128, 128, 128)' : 'rgb(20, 161, 255)';
          el.dataset.baseSize = size;
        }
      }
    }

    prevSelectedLocation.current = selectedLocation ?? null;

    if (!selectedLocation) return;

    // Open popup for the newly selected marker
    const selectedMarker = markers.current.get(selectedLocation);
    if (selectedMarker && !selectedMarker.getPopup().isOpen()) {
      selectedMarker.togglePopup();
    }
  }, [selectedLocation, mapboxLoaded, selectedLocations, locationHasResults]);

  // Enlarge marker when user hovers a result card in the sidebar
  useEffect(() => {
    markers.current.forEach((marker, locationName) => {
      const el = marker.getElement();
      if (!el) return;
      if (locationName === hoveredLocation) {
        if (!el.dataset.baseSize) el.dataset.baseSize = el.style.width;
        const enlarged = window.innerWidth < 1024 ? '22px' : '26px';
        el.style.width = enlarged;
        el.style.height = enlarged;
        el.style.boxShadow = '0 3px 8px rgba(0,0,0,0.4)';
        if (!openPopupLocation.current) {
          el.style.zIndex = '9999';
          el.style.position = 'relative';
          if (el.parentElement) el.parentElement.style.zIndex = '9999';
        }
      } else if (el.dataset.baseSize) {
        el.style.width = el.dataset.baseSize;
        el.style.height = el.dataset.baseSize;
        el.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';
        el.style.zIndex = '';
        el.style.position = '';
        if (el.parentElement) el.parentElement.style.zIndex = '';
      }
    });
  }, [hoveredLocation]);

  // Update popup content when category changes to reflect highlighting
  useEffect(() => {
    if (!map.current || !mapboxLoaded) return;

    // Don't update popup if user is actively typing in an input field
    const activeElement = document.activeElement;
    if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
      return;
    }

    markers.current.forEach((marker, locationName) => {
      const popup = marker.getPopup();
      if (popup.isOpen()) {
        // Regenerate popup content with updated highlighting
        const location = locations.find(loc => loc.name === locationName);
        if (location) {
          const availableCategories = getAvailableCategories(locationName);
          
          let categoryFiltersHTML = '';
          if (availableCategories.length > 0 && onCategoryFilter) {
            const categoryButtons = availableCategories.map(cat => {
              const escapedLocationName = location.name.replace(/'/g, "\\'").replace(/"/g, '&quot;');
              const escapedCategoryId = cat.id.replace(/'/g, "\\'").replace(/"/g, '&quot;');
              const isSelected = currentCategory === cat.id && selectedLocations.includes(location.name);
              const buttonClasses = isSelected
                ? 'category-filter-btn inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[#13a4ec]/20 dark:bg-[#13a4ec]/30 text-[#13a4ec] dark:text-[#13a4ec] border-2 border-[#13a4ec] dark:border-[#13a4ec] hover:bg-[#13a4ec]/30 dark:hover:bg-[#13a4ec]/40 transition-colors focus:outline-none'
                : 'category-filter-btn inline-flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 text-gray-500 dark:text-gray-400 hover:bg-[#13a4ec]/10 dark:hover:bg-[#13a4ec]/20 hover:text-[#13a4ec] dark:hover:text-[#13a4ec] transition-colors focus:outline-none border-0';
              return `
                <button 
                  class="${buttonClasses}"
                  data-location="${escapedLocationName}"
                  data-category="${escapedCategoryId}"
                  title="${cat.name}"
                  tabindex="-1"
                  onfocus="this.blur()"
                >
                  <span class="material-symbols-outlined text-base">${cat.icon}</span>
                </button>
              `;
            }).join('');

            categoryFiltersHTML = `
              <div class="mt-2 pt-2 border-t border-slate-200">
                <p class="text-xs font-semibold text-slate-600 mb-2">Programs at this location:</p>
                <div class="flex flex-wrap gap-1.5">
                  ${categoryButtons}
                </div>
              </div>
            `;
          }

          const popupHTML = `
            <div class="p-2">
              <h3 class="font-semibold text-base text-slate-800 dark:text-slate-800">${location.name}</h3>
              ${location.address ? `<p class="mt-1 text-sm text-slate-500 dark:text-slate-500 whitespace-pre-line">${location.address}</p>` : ''}
              ${categoryFiltersHTML}
              ${location.url ? `
                <a class="p-1 mt-3 inline-flex items-center justify-center line-height-1 w-full bg-[#13a4ec]/10 dark:bg-[#13a4ec]/20 text-gray-700 dark:text-gray-700 text-sm font-medium px-4 rounded-lg hover:text-black dark:hover:text-white hover:bg-[#13a4ec]/1 dark:hover:bg-[#13a4ec]/30 hover:shadow-lg hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-[#13a4ec] focus:ring-offset-2 transition-all duration-200 ease-in-out" href="${location.url}" target="_blank" rel="noopener noreferrer">
                  <span>View on City Website</span>
                  <span class="material-symbols-outlined ml-2 text-base transition-transform duration-200 ease-in-out group-hover:translate-x-1">arrow_right_alt</span>
                </a>
              ` : ''}
            </div>
          `;
          
          popup.setHTML(popupHTML);
          
          // Re-attach event listeners
          const popupElement = popup.getElement();
          if (popupElement && onCategoryFilter) {
            // Remove focus from any buttons to prevent outline
            const buttons = popupElement.querySelectorAll('.category-filter-btn');
            buttons.forEach((btn: Element) => {
              (btn as HTMLElement).blur();
            });
            
            // Don't auto-focus the link as it interferes with user input in other fields
            
            popupElement.addEventListener('click', (e: MouseEvent) => {
              const target = e.target as HTMLElement;
              const button = target.closest('.category-filter-btn') as HTMLElement;
              if (button) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                const buttonLocationName = button.getAttribute('data-location');
                const buttonCategoryId = button.getAttribute('data-category');
                if (buttonLocationName && buttonCategoryId && onCategoryFilter) {
                  // Check if this category is already selected - if so, clear the filter
                  const isCurrentlySelected = currentCategory === buttonCategoryId && selectedLocations.includes(buttonLocationName);
                  const filterCategoryId = isCurrentlySelected ? '' : buttonCategoryId;
                  
                  // Store that this popup should stay open and prevent it from closing
                  openPopupLocation.current = buttonLocationName;
                  preventPopupClose.current = true;
                  onCategoryFilter(buttonLocationName, filterCategoryId);
                  // Keep popup open - check and reopen if needed
                  setTimeout(() => {
                    const marker = markers.current.get(buttonLocationName);
                    if (marker && openPopupLocation.current === buttonLocationName) {
                      const popup = marker.getPopup();
                      if (!popup.isOpen()) {
                        marker.togglePopup();
                      }
                    }
                  }, 50);
                  // Also check again after a longer delay in case of async updates
                  setTimeout(() => {
                    const marker = markers.current.get(buttonLocationName);
                    if (marker && openPopupLocation.current === buttonLocationName) {
                      const popup = marker.getPopup();
                      if (!popup.isOpen()) {
                        marker.togglePopup();
                      }
                    }
                    // Reset the prevent close flag after ensuring popup is open
                    preventPopupClose.current = false;
                  }, 250);
                }
              }
            });
          }
        }
      }
    });
  }, [currentCategory, selectedLocations, locations, mapboxLoaded, onCategoryFilter]);

  // Cleanup effect
  useEffect(() => {
    return () => {
      // Clean up markers
      markers.current.forEach(marker => marker.remove());
      markers.current.clear();
      
      // Clean up map
      if (map.current) {
        // Remove dark mode listener
        const darkModeListener = (map.current as any)._darkModeListener;
        if (darkModeListener) {
          darkModeListener.mediaQuery.removeEventListener('change', darkModeListener.handleDarkModeChange);
        }
        
        // Remove resize handler
        const resizeHandler = (map.current as any)._resizeHandler;
        if (resizeHandler) {
          window.removeEventListener('resize', resizeHandler);
        }
        
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  if (isLoading) {
    return (
      <div className="w-full h-full bg-gray-200 dark:bg-slate-800 rounded-lg flex items-center justify-center">
        <div className="text-gray-500 dark:text-slate-400">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          Loading map...
        </div>
      </div>
    );
  }

  if (!mapboxLoaded) {
    return (
      <div className="w-full h-full bg-gray-200 dark:bg-slate-800 rounded-lg flex items-center justify-center">
        <div className="text-gray-500 dark:text-slate-400">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          Loading map...
        </div>
      </div>
    );
  }

  if (locations.length === 0) {
    return (
      <div className="w-full h-full bg-gray-100 dark:bg-slate-800 rounded-lg flex items-center justify-center">
        <div className="text-center text-gray-500 dark:text-slate-400">
          <svg className="mx-auto h-12 w-12 text-gray-400 dark:text-slate-500 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <p className="text-sm">No locations to display</p>
        </div>
      </div>
    );
  }


  return (
    <div className="w-full h-full min-h-[300px] lg:min-h-0 relative">
      {/* Header positioned absolutely over the map */}
      <div className="absolute top-4 left-4 z-10 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm rounded-lg px-3 py-2 shadow-sm">
        <h3 className="text-base font-semibold text-gray-800 dark:text-slate-200">
          Locations ({locations.length})
        </h3>
      </div>
      
      {/* Map fills the entire container */}
      <div 
        ref={mapContainer} 
        className="w-full h-full rounded-lg overflow-hidden"
        style={{ backgroundColor: '#f8f9fa' }}
      />
    </div>
  );
};

export default LocationMap;