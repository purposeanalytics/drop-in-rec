import React from 'react';
import { getProgramIcon } from '../services/categories';

// Helper function to convert 24-hour time to 12-hour AM/PM format
const formatTimeToAMPM = (time24: string): string => {
  if (time24 === 'Any Time') return time24;
  
  const [hours, minutes] = time24.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  const displayMinutes = minutes.toString().padStart(2, '0');
  
  return `${displayHours}:${displayMinutes} ${period}`;
};

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

// Helper function to format date for display without timezone issues
const formatDateForDisplay = (dateString: string): string => {
  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(year, month - 1, day); // month is 0-indexed
  
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

// Helper function to calculate program duration in minutes
const calculateDuration = (startTime: string, endTime: string): number => {
  if (startTime === 'Any Time' || endTime === 'Any Time') return 0;
  
  const [startHour, startMinute] = startTime.split(':').map(Number);
  const [endHour, endMinute] = endTime.split(':').map(Number);
  
  const startMinutes = startHour * 60 + startMinute;
  const endMinutes = endHour * 60 + endMinute;
  
  // Handle case where end time is next day (e.g., 23:30 to 01:30)
  if (endMinutes < startMinutes) {
    return (24 * 60) - startMinutes + endMinutes;
  }
  
  return endMinutes - startMinutes;
};


interface SearchResultsProps {
  results: SearchResult[];
  isLoading: boolean;
  hasSearched: boolean;
  onLocationSelect?: (location: string) => void;
  onLocationHover?: (location: string | null) => void;
  selectedLocation?: string;
  sortOrder: 'location-name' | 'earliest' | 'latest' | 'open-longest';
  onSortOrderChange: (sortOrder: 'location-name' | 'earliest' | 'latest' | 'open-longest') => void;
}

const SearchResults: React.FC<SearchResultsProps> = ({ results, isLoading, hasSearched, onLocationSelect, onLocationHover, selectedLocation, sortOrder, onSortOrderChange }) => {
  const selectedCardRef = React.useRef<HTMLDivElement>(null);

  // Scroll to selected card when location is selected
  React.useEffect(() => {
    if (selectedLocation && selectedCardRef.current) {
      selectedCardRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    }
  }, [selectedLocation]);

  // Sort results based on sort order
  const sortedResults = React.useMemo(() => {
    const sorted = [...results].sort((a, b) => {
      switch (sortOrder) {
        case 'location-name':
          // Primary: location, Secondary: program name
          const locationCompare = a.location.localeCompare(b.location);
          if (locationCompare !== 0) return locationCompare;
          return a.courseTitle.localeCompare(b.courseTitle);
        case 'earliest':
          // Primary: start time, Secondary: location, Tertiary: program name
          const startTimeCompare = a.startTime.localeCompare(b.startTime);
          if (startTimeCompare !== 0) return startTimeCompare;
          const earliestLocationCompare = a.location.localeCompare(b.location);
          if (earliestLocationCompare !== 0) return earliestLocationCompare;
          return a.courseTitle.localeCompare(b.courseTitle);
        case 'latest':
          // Primary: end time, Secondary: location, Tertiary: program name
          const endTimeCompare = b.endTime.localeCompare(a.endTime);
          if (endTimeCompare !== 0) return endTimeCompare;
          const latestLocationCompare = a.location.localeCompare(b.location);
          if (latestLocationCompare !== 0) return latestLocationCompare;
          return a.courseTitle.localeCompare(b.courseTitle);
        case 'open-longest':
          // Primary: duration (descending), Secondary: start time (earliest), Tertiary: location
          const durationA = calculateDuration(a.startTime, a.endTime);
          const durationB = calculateDuration(b.startTime, b.endTime);
          const durationCompare = durationB - durationA; // Descending order
          if (durationCompare !== 0) return durationCompare;
          const openLongestStartTimeCompare = a.startTime.localeCompare(b.startTime);
          if (openLongestStartTimeCompare !== 0) return openLongestStartTimeCompare;
          return a.location.localeCompare(b.location);
        default:
          return 0;
      }
    });
    return sorted;
  }, [results, sortOrder]);

  if (isLoading) {
    return (
      <div className="flex flex-col h-full lg:h-full min-h-[600px] lg:min-h-0 max-h-96 lg:max-h-none">
        <div className="border-t border-slate-200 px-3 sm:px-4 py-3 flex-shrink-0">
          <h3 className="text-base font-semibold">Searching...</h3>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="flex items-center gap-3">
            <svg className="animate-spin h-6 w-6 text-[#13a4ec]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span className="text-sm font-medium text-slate-600">Searching...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!hasSearched) {
    return (
      <div className="flex flex-col h-full lg:h-full min-h-[600px] lg:min-h-0 max-h-96 lg:max-h-none">
        <div className="border-t border-slate-200 px-3 sm:px-4 py-3 flex-shrink-0">
          <h3 className="text-base font-semibold">Search Results</h3>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-slate-500 px-4">
            <svg className="mx-auto h-12 w-12 text-slate-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <p className="text-sm">Enter your search criteria above to find drop-in recreation programs</p>
          </div>
        </div>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="flex flex-col h-full lg:h-full min-h-[600px] lg:min-h-0 max-h-96 lg:max-h-none">
        <div className="border-t border-slate-200 px-3 sm:px-4 py-3 flex-shrink-0">
          <h3 className="text-base font-semibold">Results (0)</h3>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-slate-500 px-4">
            <svg className="mx-auto h-12 w-12 text-slate-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6-4h6m2 5.291A7.962 7.962 0 0112 15c-2.34 0-4.29-1.009-5.824-2.709" />
            </svg>
            <p className="text-sm">No programs found matching your criteria</p>
            <p className="text-xs mt-2 text-slate-400">Try adjusting your search filters</p>
          </div>
        </div>
      </div>
    );
  }


  return (
    <div className="flex flex-col h-full lg:h-full min-h-[600px] lg:min-h-0 max-h-96 lg:max-h-none">
      <div className="border-t border-slate-200 px-3 sm:px-4 py-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold">Results ({results.length})</h3>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-600 dark:text-slate-400">Sort by</span>
            <div className="relative z-10">
              <button className="flex items-center gap-1.5 rounded-lg bg-[#f6f7f8] dark:bg-slate-700 px-3 py-1.5 text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors text-gray-900 dark:text-slate-200">
                <span className="truncate">
                  {sortOrder === 'location-name' ? 'Location name' : 
                   sortOrder === 'earliest' ? 'Open earliest' : 
                   sortOrder === 'latest' ? 'Open latest' : 'Open longest'}
                </span>
                <span className="material-symbols-outlined text-base text-gray-600 dark:text-slate-400"> expand_more </span>
              </button>
              <select
                className="absolute inset-0 opacity-0 cursor-pointer z-10"
                value={sortOrder}
                onChange={(e) => onSortOrderChange(e.target.value as 'location-name' | 'earliest' | 'latest' | 'open-longest')}
              >
                <option value="location-name">Location name</option>
                <option value="earliest">Open earliest</option>
                <option value="latest">Open latest</option>
                <option value="open-longest">Open longest</option>
              </select>
            </div>
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="divide-y divide-slate-200">
          {sortedResults.map((result, index) => {
            // Find the first occurrence of the selected location
            const isFirstOccurrence = selectedLocation === result.location && 
              sortedResults.findIndex(r => r.location === selectedLocation) === index;
            

            return (
              <div
                key={index}
                ref={isFirstOccurrence ? selectedCardRef : null}
                className={`flex items-start gap-3 sm:gap-4 p-3 sm:p-4 hover:bg-slate-50 cursor-pointer transition-colors ${
                  selectedLocation === result.location
                    ? 'bg-[#13a4ec]/10'
                    : ''
                }`}
                onClick={() => onLocationSelect?.(result.location)}
                onMouseEnter={() => onLocationHover?.(result.location)}
                onMouseLeave={() => onLocationHover?.(null)}
              >
                <div className="flex flex-col items-center w-16 flex-shrink-0">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${
                    selectedLocation === result.location 
                      ? 'bg-[#13a4ec]/20 text-[#13a4ec]' 
                      : 'bg-[#13a4ec]/10 text-[#13a4ec]'
                  }`}>
                    <span className="material-symbols-outlined">{getProgramIcon(result.courseTitle, result["Age Min"], result["Age Max"])}</span>
                  </div>
                  {result.ageRange && (
                    <p className={`text-xs mt-1 text-center w-full ${
                      selectedLocation === result.location ? 'text-[#13a4ec]/60' : 'text-slate-400'
                    }`}>{result.ageRange}</p>
                  )}
                </div>
                <div className="flex-1">
                  <p className={`font-semibold ${
                    selectedLocation === result.location ? 'text-[#13a4ec]' : ''
                  }`}>{result.courseTitle}</p>
                   <p className={`text-sm  ${
                    selectedLocation === result.location ? 'text-[#13a4ec]/80' : 'text-slate-500'
                  }`}>{result.location}</p>
                  <div className="flex items-center justify-between mt-1 text-sm">
                    <div className={`flex items-center gap-2 ${
                      selectedLocation === result.location ? 'text-[#13a4ec]/80' : 'text-slate-500'
                    }`}>
                      <span className="material-symbols-outlined text-base">calendar_today</span>
                      <span>{formatDateForDisplay(result.date)}</span>
                    </div>
                    <div className={`flex items-center gap-2 ${
                      selectedLocation === result.location ? 'text-[#13a4ec]/80' : 'text-slate-500'
                    }`}>
                      <span className="material-symbols-outlined text-base">schedule</span>
                      <span>{formatTimeToAMPM(result.startTime)} - {formatTimeToAMPM(result.endTime)}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default SearchResults;
