import React, { useRef } from 'react';
import { useSearchForm } from '../hooks/useSearchForm';
import { useAutocomplete } from '../hooks/useAutocomplete';
import { useTimeOptions } from '../hooks/useTimeOptions';
import { useCategoryFilter } from '../hooks/useCategoryFilter';
import type { SearchFilters } from '../types';

interface SearchFormProps {
  filters: SearchFilters;
  onFiltersChange: (filters: SearchFilters) => void;
  onSearch: (searchFilters?: SearchFilters) => void;
  isLoading: boolean;
  allDropIns: any[];
  courseTitles: string[];
  locations: string[];
  allLocations: any[];
  onProgramInput?: (value: string) => void;
}

const SearchForm: React.FC<SearchFormProps> = ({
  filters,
  onFiltersChange,
  onSearch,
  isLoading,
  allDropIns,
  courseTitles,
  locations,
  allLocations,
  onProgramInput
}) => {
  const {
    searchInputs,
    selectedLocations,
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
  } = useSearchForm(filters, onFiltersChange, onSearch, allDropIns);

  const {
    showProgramDropdown,
    setShowProgramDropdown,
    showLocationDropdown,
    setShowLocationDropdown,
    filteredProgramOptions,
    filteredLocationOptions,
    allFilteredPrograms,
    handleProgramDropdownScroll,
    handleLocationDropdownScroll
  } = useAutocomplete(allDropIns, courseTitles, locations, allLocations, filters, searchInputs);

  const { timeOptions, dayOptions, formatTimeToAMPM } = useTimeOptions(filters, onFiltersChange, allDropIns);

  const { filteredCategories, filteredSubcategories } = useCategoryFilter(allDropIns, filters);

  const locationInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="p-3 sm:p-4 space-y-3 sm:space-y-4">
      {/* Filter Buttons - Responsive Layout */}
      <div className="space-y-2">
        {/* Category Button - Full Width */}
        <div className="relative">
          <button className="flex items-center justify-between gap-1.5 rounded-lg bg-[#f6f7f8] dark:bg-slate-700 px-3 py-2.5 text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors w-full text-gray-900 dark:text-slate-200">
            <span className="truncate">
              {filters.category ? filteredCategories.find(c => c.id === filters.category)?.name || 'Category' : 'All categories'}
            </span>
            <span className="material-symbols-outlined text-base flex-shrink-0 text-gray-600 dark:text-slate-400"> expand_more </span>
          </button>
          <select
            className="absolute inset-0 opacity-0 cursor-pointer bg-transparent text-gray-900 dark:text-slate-200"
            value={filters.category}
            onChange={(e) => handleInputChange('category', e.target.value)}
          >
            <option value="">All categories</option>
            {filteredCategories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>

        {/* Subcategory Button - Full Width */}
        <div className="relative">
          <button className="flex items-center justify-between gap-1.5 rounded-lg bg-[#f6f7f8] dark:bg-slate-700 px-3 py-2.5 text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors w-full text-gray-900 dark:text-slate-200">
            <span className="truncate">
              {filters.subcategory ? filteredSubcategories.find(s => s.id === filters.subcategory)?.name || 'Subcategory' : 'All subcategories'}
            </span>
            <span className="material-symbols-outlined text-base flex-shrink-0 text-gray-600 dark:text-slate-400"> expand_more </span>
          </button>
          <select
            className="absolute inset-0 opacity-0 cursor-pointer bg-transparent text-gray-900 dark:text-slate-200"
            value={filters.subcategory}
            onChange={(e) => handleInputChange('subcategory', e.target.value)}
          >
            <option value="">All subcategories</option>
            {filteredSubcategories.map((subcategory) => (
              <option key={subcategory.id} value={subcategory.id}>
                {subcategory.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-3">
        {/* Program Search Input */}
        <div className="relative">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500"> search </span>
          <input 
            className="w-full rounded-lg bg-[#f6f7f8] dark:bg-slate-700 py-2.5 pl-10 pr-10 text-sm text-gray-900 dark:text-slate-200 placeholder-gray-500 dark:placeholder-slate-400 focus:ring-2 focus:ring-[#13a4ec] focus:border-[#13a4ec] border-transparent" 
            placeholder="Find a program" 
            type="text"
            value={searchInputs.program}
            onChange={(e) => { handleSearchInputChange('program', e.target.value); onProgramInput?.(e.target.value); }}
            onKeyDown={(e) => handleKeyPress(e, 'program')}
            onFocus={() => setShowProgramDropdown(true)}
            onBlur={() => setTimeout(() => setShowProgramDropdown(false), 150)}
          />
          {searchInputs.program && (
            <button 
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-400"
              onClick={() => handleClearField('program')}
            >
              <span className="material-symbols-outlined text-xl"> close </span>
            </button>
          )}
          
          {/* Program Autocomplete Dropdown */}
          {showProgramDropdown && (filteredProgramOptions.length > 0 || allFilteredPrograms.length > 0) && (
            <div 
              className="absolute z-20 w-full mt-1 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-lg shadow-lg max-h-60 overflow-auto"
              onScroll={handleProgramDropdownScroll}
            >
              {filteredProgramOptions.map((option, index) => (
                <div
                  key={index}
                  className="px-3 py-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700 text-sm text-gray-900 dark:text-slate-200"
                  onMouseDown={(e) => {
                    e.preventDefault() // Prevent input from losing focus
                    handleOptionSelect('program', option, setShowLocationDropdown, setShowProgramDropdown);
                  }}
                >
                  {option}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Location Search Input */}
        <div>
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 text-base"> location_on </span>
            <input 
              ref={locationInputRef}
              className="w-full rounded-lg bg-[#f6f7f8] dark:bg-slate-700 py-2.5 pl-10 pr-10 text-sm text-gray-900 dark:text-slate-200 placeholder-gray-500 dark:placeholder-slate-400 focus:ring-2 focus:ring-[#13a4ec] focus:border-[#13a4ec] border-transparent" 
              placeholder="Search by location" 
              type="text"
              value={searchInputs.location}
              onChange={(e) => handleSearchInputChange('location', e.target.value)}
              onKeyDown={(e) => handleKeyPress(e, 'location')}
              onFocus={() => setShowLocationDropdown(true)}
              onClick={() => setShowLocationDropdown(true)}
              onBlur={() => setTimeout(() => setShowLocationDropdown(false), 200)}
            />
            {searchInputs.location && (
              <button 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-400"
                onClick={() => handleClearField('location')}
              >
                <span className="material-symbols-outlined text-xl"> close </span>
              </button>
            )}
            
            {/* Location Autocomplete Dropdown - hide already selected locations */}
            {showLocationDropdown && (() => {
              const optionsToShow = filteredLocationOptions.filter(option => !selectedLocations.includes(option));
              if (optionsToShow.length === 0) return null;
              return (
              <div 
                className="absolute z-20 w-full mt-1 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-lg shadow-lg max-h-60 overflow-auto"
                onScroll={handleLocationDropdownScroll}
              >
                {optionsToShow.map((option, index) => (
                  <div
                    key={index}
                    className="px-3 py-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700 text-sm text-gray-900 dark:text-slate-200"
                    onMouseDown={(e) => {
                      e.preventDefault() // Prevent input from losing focus
                      handleOptionSelect('location', option, setShowLocationDropdown, setShowProgramDropdown);
                      locationInputRef.current?.blur();
                    }}
                  >
                    {option}
                  </div>
                ))}
              </div>
              );
            })()}
          </div>
          
          {/* Selected Locations */}
          {selectedLocations.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {selectedLocations
                .slice()
                .sort((a, b) => a.localeCompare(b))
                .map((location, index) => (
                <div
                  key={index}
                  className="flex items-center gap-1 bg-[#13a4ec]/10 text-[#13a4ec] px-1.5 py-0.5 rounded text-xs"
                >
                  <span className="truncate max-w-40">{location}</span>
                  <button
                    onClick={() => handleRemoveLocation(location)}
                    className="text-[#13a4ec]/60 hover:text-[#13a4ec] flex-shrink-0"
                  >
                    <span className="material-symbols-outlined text-xs">close</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {/* Day, Time, and Age Buttons - Three Column Layout */}
        <div className="grid grid-cols-3 gap-2">
          {/* Day Button */}
          <div className="relative">
            <button className="flex items-center justify-between gap-1.5 rounded-lg bg-[#f6f7f8] dark:bg-slate-700 px-3 py-2.5 text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors w-full text-gray-900 dark:text-slate-200">
              <span className="truncate">
                {filters.date ? dayOptions.find(d => d.value === filters.date)?.label || 'Day' : 'Day'}
              </span>
              <span className="material-symbols-outlined text-base flex-shrink-0 text-gray-600 dark:text-slate-400"> expand_more </span>
            </button>
            <select
              className="absolute inset-0 opacity-0 cursor-pointer bg-transparent text-gray-900 dark:text-slate-200"
              value={filters.date}
              onChange={(e) => handleInputChange('date', e.target.value)}
            >
              {dayOptions.map((day) => (
                <option key={day.value} value={day.value}>
                  {day.label}
                </option>
              ))}
            </select>
          </div>

          {/* Time Button */}
          <div className="relative">
            <button className="flex items-center justify-between gap-1.5 rounded-lg bg-[#f6f7f8] dark:bg-slate-700 px-3 py-2.5 text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors w-full text-gray-900 dark:text-slate-200">
              <span className="truncate">
                {filters.time && filters.time !== 'Any time' ? formatTimeToAMPM(filters.time) : 'Any time'}
              </span>
              <span className="material-symbols-outlined text-base flex-shrink-0 text-gray-600 dark:text-slate-400"> expand_more </span>
            </button>
            <select
              className="absolute inset-0 opacity-0 cursor-pointer bg-transparent text-gray-900 dark:text-slate-200"
              value={filters.time}
              onChange={(e) => handleInputChange('time', e.target.value)}
            >
              {timeOptions.map((time) => (
                <option key={time} value={time}>
                  {formatTimeToAMPM(time)}
                </option>
              ))}
            </select>
          </div>

          {/* Age Button */}
          <div className="relative">
            <button className="flex items-center justify-between gap-1.5 rounded-lg bg-[#f6f7f8] dark:bg-slate-700 px-3 py-2.5 text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors w-full text-gray-900 dark:text-slate-200">
              <span className="truncate">
                {filters.age ? (filters.age === '99' ? 'Age 99+' : `Age ${filters.age}`) : 'Any age'}
              </span>
              <span className="material-symbols-outlined text-base flex-shrink-0 text-gray-600 dark:text-slate-400"> expand_more </span>
            </button>
            <select
              className="absolute inset-0 opacity-0 cursor-pointer bg-transparent text-gray-900 dark:text-slate-200"
              value={filters.age}
              onChange={(e) => handleInputChange('age', e.target.value)}
            >
              <option value="">Any age</option>
              {Array.from({ length: 100 }, (_, i) => (
                <option key={i} value={i.toString()}>
                  {i === 99 ? '99+' : i.toString()}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Share and Clear Filters Controls */}
      <div className="flex justify-between items-center">
        <div className="relative share-popover-container">
          <button 
            className="flex items-center gap-1 text-sm font-medium text-[#13a4ec] hover:text-[#13a4ec]/80 transition-colors"
            onClick={() => setShowSharePopover(!showSharePopover)}
          >
            <span className="material-symbols-outlined text-base">share</span>
            Share
          </button>
          
          {/* Share Popover */}
          {showSharePopover && (
            <div className="absolute top-full left-0 mt-2 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-lg shadow-lg z-30 min-w-80">
              {/* Caret/Arrow pointing up to the text */}
              <div className="absolute -top-1 left-10 transform w-2 h-2 bg-white dark:bg-slate-800 border-l border-t border-gray-300 dark:border-slate-600 rotate-45"></div>
              
              {/* Close button */}
              <button
                className="absolute top-2 right-2 text-gray-400 dark:text-slate-400 hover:text-gray-600 dark:hover:text-slate-300"
                onClick={() => setShowSharePopover(false)}
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
              
              <div className="p-4">
                <h3 className="text-sm font-medium text-gray-900 dark:text-slate-200 mb-2">Share this view:</h3>
                <div className="mb-1">
                  <input
                    type="text"
                    value={generateShareUrl()}
                    readOnly
                    className="w-full px-3 py-2 text-xs border border-gray-300 dark:border-slate-600 rounded-md bg-gray-50 dark:bg-slate-700 text-gray-700 dark:text-slate-300"
                  />
                </div>
                <button
                  className="text-xs text-[#13a4ec] hover:text-[#13a4ec]/80 underline"
                  onClick={handleCopyToClipboard}
                >
                  {copyButtonText}
                </button>
              </div>
            </div>
          )}
        </div>
        
        <button 
          className="text-sm font-medium text-[#13a4ec] hover:text-[#13a4ec]/80 transition-colors"
          onClick={handleClearAll}
        >
          Clear All Filters
        </button>
      </div>

      {/* Hidden Search Button - triggered by form submission or Enter key */}
      <button
        onClick={() => onSearch()}
        disabled={isLoading}
        className="hidden"
        type="submit"
      >
        Search
      </button>

    </div>
  );
};

export default SearchForm;
