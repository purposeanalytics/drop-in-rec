import { useState, useCallback, useEffect } from 'react';
import type { SearchFilters } from '../types';
import { getDefaultDate, getDefaultTime, getSmartDefaults } from '../utils/dateTimeUtils';
import { courseMatchesCategory } from '../services/categories';

export const useSearchForm = (
  filters: SearchFilters,
  onFiltersChange: (filters: SearchFilters) => void,
  onSearch: (searchFilters?: SearchFilters) => void,
  allDropIns: Array<{ "Date Range": string; "End Hour": number; "End Min": number }> = []
) => {
  // State for search inputs
  const [searchInputs, setSearchInputs] = useState({
    location: '',
    program: ''
  });
  
  // State for selected locations
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  
  // State for share popover
  const [showSharePopover, setShowSharePopover] = useState(false);
  const [copyButtonText, setCopyButtonText] = useState('Copy to clipboard');
  
  // State to track if URL has been loaded
  const [urlLoaded, setUrlLoaded] = useState(false);
  
  // Track the committed course title (only updated when selected/searched, not while typing)
  const [committedCourseTitle, setCommittedCourseTitle] = useState<string>('');

  // Sync search inputs with filters
  useEffect(() => {
    setSearchInputs({
      program: filters.courseTitle,
      location: '' // Keep location input empty for typing
    });
    setSelectedLocations(filters.location);
  }, [filters.courseTitle, filters.location]);

  const handleInputChange = useCallback((field: keyof SearchFilters, value: string) => {
    const newFilters = {
      ...filters,
      [field]: value
    };
    
    // If category changes, reset subcategory
    if (field === 'category') {
      newFilters.subcategory = '';
    }
    
    // If category or subcategory changes, check if current course title matches
    // If it doesn't match, clear the course title
    if ((field === 'category' || field === 'subcategory') && filters.courseTitle) {
      const categoryId = field === 'category' ? value : newFilters.category;
      const subcategoryId = field === 'subcategory' ? value : newFilters.subcategory;
      
      // Check if the current course title matches the new category/subcategory
      // Note: We don't have age info here, so we check without age requirements
      // This is a best-effort check - age filtering will happen during the actual search
      if (categoryId && !courseMatchesCategory(filters.courseTitle, categoryId, subcategoryId || undefined)) {
        newFilters.courseTitle = '';
        // Also clear the search input for program
        setSearchInputs(prev => ({ ...prev, program: '' }));
      }
    }
    
    onFiltersChange(newFilters);
    
    // Auto-search after selection changes (except for program text input)
    if (field !== 'courseTitle') {
      onSearch(newFilters);
    }
  }, [filters, onFiltersChange, onSearch]);

  const handleSearchInputChange = useCallback((field: keyof typeof searchInputs, value: string) => {
    setSearchInputs(prev => ({ ...prev, [field]: value }));
    
    // Show dropdown when user types
    if (field === 'program') {
      // Don't update global filters while typing — only on commit (Enter or autocomplete select)
      // to avoid re-rendering the entire app on every keystroke
    } else if (field === 'location') {
      setSearchInputs(prev => ({ ...prev, [field]: value }));
      // Don't update filters while typing - only when location is selected
    }
  }, [filters, onFiltersChange, onSearch]);

  const handleClearField = useCallback((field: keyof typeof searchInputs) => {
    // Clear the field
    setSearchInputs(prev => ({ ...prev, [field]: '' }));
    
    // Update filters and trigger search
    const newFilters = { ...filters };
    if (field === 'program') {
      newFilters.courseTitle = '';
      // Clear committed course title when program is cleared
      setCommittedCourseTitle('');
    } else if (field === 'location') {
      newFilters.location = [];
      setSelectedLocations([]);
    }
    
    onFiltersChange(newFilters);
    onSearch(newFilters);
    
    // Remove focus from the input field
    const inputElement = document.querySelector(`input[placeholder="${field === 'program' ? 'Find a program' : 'Search by location'}"]`) as HTMLInputElement;
    if (inputElement) {
      inputElement.blur();
    }
  }, [filters, onFiltersChange, onSearch]);

  const handleOptionSelect = useCallback((field: keyof typeof searchInputs, value: string, setShowLocationDropdown?: (show: boolean) => void, setShowProgramDropdown?: (show: boolean) => void) => {
    if (field === 'program') {
      setSearchInputs(prev => ({ ...prev, [field]: value }));
      const newFilters = { ...filters, courseTitle: value };
      // Update committed course title when a course is selected
      setCommittedCourseTitle(value);
      onFiltersChange(newFilters);
      onSearch(newFilters);
      // Close the program dropdown after selection
      if (setShowProgramDropdown) {
        setShowProgramDropdown(false);
      }
    } else if (field === 'location') {
      // Add location to selected locations if not already selected
      if (!selectedLocations.includes(value)) {
        const newSelectedLocations = [...selectedLocations, value];
        setSelectedLocations(newSelectedLocations);
        const newFilters = { ...filters, location: newSelectedLocations };
        onFiltersChange(newFilters);
        onSearch(newFilters);
      }
      setSearchInputs(prev => ({ ...prev, location: '' })); // Clear input
      // Close the location dropdown after selection
      if (setShowLocationDropdown) {
        setShowLocationDropdown(false);
      }
    }
  }, [filters, onFiltersChange, onSearch, selectedLocations]);

  const handleRemoveLocation = useCallback((locationToRemove: string) => {
    const newSelectedLocations = selectedLocations.filter(loc => loc !== locationToRemove);
    setSelectedLocations(newSelectedLocations);
    const newFilters = { ...filters, location: newSelectedLocations };
    onFiltersChange(newFilters);
    onSearch(newFilters);
  }, [selectedLocations, filters, onFiltersChange, onSearch]);

  // Copy to clipboard function
  const handleCopyToClipboard = async () => {
    const shareUrl = generateShareUrl();
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopyButtonText('Copied!');
      setTimeout(() => {
        setCopyButtonText('Copy to clipboard');
      }, 3000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  // Bookmark/Share functionality
  const generateShareUrl = useCallback(() => {
    const params = new URLSearchParams();
    if (filters.category) params.set('category', filters.category);
    if (filters.subcategory) params.set('subcategory', filters.subcategory);
    if (committedCourseTitle) params.set('program', committedCourseTitle);
    if (filters.location.length > 0) params.set('locations', filters.location.join(','));
    if (filters.age) params.set('age', filters.age);
    
    // Only add date parameters if no other filters are selected
    const hasOtherFilters = filters.category || filters.subcategory || committedCourseTitle || filters.location.length > 0 || filters.age;
    if (!hasOtherFilters) {
      // Add special date parameters only when used alone
      if (filters.date === 'tomorrow') {
        params.set('date', 'tomorrow');
      } else if (filters.date === 'this-week') {
        params.set('date', 'this-week');
      }
    }
    
    const baseUrl = window.location.origin + window.location.pathname;
    return params.toString() ? `${baseUrl}?${params.toString()}` : baseUrl;
  }, [filters, committedCourseTitle]);

  const loadFromUrl = useCallback(() => {
    if (urlLoaded) return; // Prevent multiple loads
    
    const params = new URLSearchParams(window.location.search);
    
    // Only create filters if there are URL parameters
    if (params.toString()) {
      // Handle special date parameters
      const dateParam = params.get('date');
      let dateValue = getDefaultDate(); // Default date logic
      if (dateParam === 'tomorrow') {
        dateValue = 'tomorrow';
      } else if (dateParam === 'this-week') {
        dateValue = 'this-week';
      }
      
      const urlFilters: SearchFilters = {
        category: params.get('category') || '',
        subcategory: params.get('subcategory') || '',
        courseTitle: params.get('program') || '',
        location: params.get('locations') ? params.get('locations')!.split(',') : [],
        date: dateValue,
        time: getDefaultTime(), // Use default time logic (same as initial app load)
        age: params.get('age') || ''
      };
      
      onFiltersChange(urlFilters);
      onSearch(urlFilters);
      
      // Update selected locations
      setSelectedLocations(urlFilters.location);
      
      // Update committed course title when loading from URL
      setCommittedCourseTitle(urlFilters.courseTitle);
      
      // Update search inputs
      setSearchInputs({
        location: '',
        program: urlFilters.courseTitle
      });
    }
    
    setUrlLoaded(true);
  }, [onFiltersChange, onSearch, urlLoaded]);

  // Load filters from URL on component mount
  useEffect(() => {
    loadFromUrl();
  }, [loadFromUrl]);

  // Update URL when filters change (but not on initial load)
  useEffect(() => {
    if (!urlLoaded) return; // Don't update URL until after initial load
    
    const shareUrl = generateShareUrl();
    
    // Only update URL if it's different from current URL
    if (shareUrl !== window.location.href) {
      window.history.replaceState({}, '', shareUrl);
    }
  }, [filters, generateShareUrl, urlLoaded]);

  const handleKeyPress = useCallback((e: React.KeyboardEvent, field: keyof typeof searchInputs) => {
    if (e.key === 'Enter') {
      if (field === 'program') {
        const newFilters = { ...filters, courseTitle: searchInputs.program };
        setCommittedCourseTitle(searchInputs.program);
        onFiltersChange(newFilters);
        onSearch(newFilters);
      }
    }
  }, [onSearch, onFiltersChange, filters, searchInputs]);

  const handleClearAll = useCallback(() => {
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

    setSearchInputs({ location: '', program: '' });
    setSelectedLocations([]);
    setCommittedCourseTitle('');
    onFiltersChange(defaultFilters);
    onSearch(defaultFilters);
  }, [onFiltersChange, onSearch, allDropIns]);

  return {
    searchInputs,
    setSearchInputs,
    selectedLocations,
    setSelectedLocations,
    showSharePopover,
    setShowSharePopover,
    copyButtonText,
    handleInputChange,
    handleSearchInputChange,
    handleClearField,
    handleOptionSelect,
    handleRemoveLocation,
    handleCopyToClipboard,
    generateShareUrl,
    handleKeyPress,
    handleClearAll
  };
};
