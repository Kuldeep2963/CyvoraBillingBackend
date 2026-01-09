import React, { useState } from 'react';
import {
  HStack,
  Input,
  InputGroup,
  InputLeftElement,
  Select,
  Button,
  Icon,
  Box,
  useColorModeValue,
} from '@chakra-ui/react';
import { FiSearch, FiFilter, FiCalendar } from 'react-icons/fi';

const FilterBar = ({
  onSearch,
  onFilterChange,
  filters = [],
  onExport,
  onRefresh,
  dateRange,
  onDateRangeChange,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFilters, setSelectedFilters] = useState({});

  const handleSearch = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    onSearch?.(value);
  };

  const handleFilterChange = (key, value) => {
    const newFilters = { ...selectedFilters, [key]: value };
    setSelectedFilters(newFilters);
    onFilterChange?.(newFilters);
  };

  const bg = useColorModeValue('white', 'gray.700');
  const borderColor = useColorModeValue('gray.200', 'gray.600');

  return (
    <Box
      p={4}
      bg={bg}
      borderRadius="lg"
      borderWidth="1px"
      borderColor={borderColor}
      mb={4}
    >
      <HStack spacing={4} flexWrap="wrap">
        {/* Search Input */}
        <InputGroup maxW="300px">
          <InputLeftElement pointerEvents="none">
            <Icon as={FiSearch} color="gray.400" />
          </InputLeftElement>
          <Input
            placeholder="Search..."
            value={searchTerm}
            onChange={handleSearch}
            bg={useColorModeValue('white', 'gray.800')}
          />
        </InputGroup>

        {/* Dynamic Filters */}
        {filters.map((filter) => (
          <Select
            key={filter.key}
            placeholder={filter.placeholder || `Filter by ${filter.label}`}
            onChange={(e) => handleFilterChange(filter.key, e.target.value)}
            w="200px"
            bg={useColorModeValue('white', 'gray.800')}
          >
            {filter.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        ))}

        {/* Date Range Selector */}
        {dateRange && (
          <HStack>
            <Icon as={FiCalendar} color="gray.500" />
            <Select
              defaultValue="all"
              onChange={(e) => onDateRangeChange?.(e.target.value)}
              w="200px"
              bg={useColorModeValue('white', 'gray.800')}
            >
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="quarter">This Quarter</option>
              <option value="all">All Time</option>
            </Select>
          </HStack>
        )}

        {/* Action Buttons */}
        <HStack ml="auto" spacing={2}>
          {onRefresh && (
            <Button
              variant="outline"
              leftIcon={<FiFilter />}
              onClick={onRefresh}
              size="sm"
            >
              Refresh
            </Button>
          )}
          {onExport && (
            <Button
              colorScheme="blue"
              onClick={onExport}
              size="sm"
            >
              Export
            </Button>
          )}
        </HStack>
      </HStack>
    </Box>
  );
};

export default FilterBar;