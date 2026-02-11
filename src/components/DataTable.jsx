import React, { useState } from 'react';
import {
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Box,
  Flex,
  Text,
  IconButton,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  Badge,
  Tooltip,
  useColorModeValue,
  HStack,
  VStack,
  Select,
} from '@chakra-ui/react';
import { 
  FiMoreVertical, 
  FiEdit2, 
  FiTrash2, 
  FiEye, 
  FiChevronRight,
  FiChevronsRight,
  FiChevronLeft,
  FiChevronsLeft 
} from 'react-icons/fi';

const DataTable = ({
  columns,
  data,
  onEdit,
  onDelete,
  onView,
  actions = true,
  compact = false,
  striped = false,
  height = 'calc(100vh - 400px)',
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const rowHoverBg = useColorModeValue('blue.50', 'gray.700');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const stripedBg = useColorModeValue('gray.50', 'gray.800');
  const headerBg = useColorModeValue('gray.100', 'gray.200');

  // Pagination logic
  const totalItems = data.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedData = data.slice(startIndex, startIndex + pageSize);

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  const renderCell = (item, column) => {
    if (column.render) {
      return column.render(item[column.key], item);
    }

    if (column.type === 'badge') {
      const colorScheme = column.colorMap?.[item[column.key]] || 'gray';
      return (
        <Badge 
          colorScheme={colorScheme} 
          variant="subtle"
          fontSize="xs"
          px={2}
          py={0.5}
          borderRadius="full"
        >
          {item[column.key]}
        </Badge>
      );
    }

    if (column.type === 'date') {
      const dateValue = item[column.key];
      const date = !dateValue || dateValue === 'N/A' 
        ? null 
        : (isNaN(dateValue) ? new Date(dateValue) : new Date(parseInt(dateValue)));

      if (!date || isNaN(date.getTime())) return <Text fontSize="sm" color="gray.400">N/A</Text>;

      return (
        <VStack align="start" spacing={0}>
          <Text fontSize="sm" fontWeight="medium">
            {date.toLocaleDateString()}
          </Text>
          <Text fontSize="xs" color="gray.500">
            {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </VStack>
      );
    }

    if (column.type === 'currency') {
      return (
        <Text fontWeight="medium">
          ${parseFloat(item[column.key]).toFixed(4)}
        </Text>
      );
    }

    if (column.type === 'duration') {
      const duration = item[column.key];
      if (duration < 60) return `${duration}s`;
      const minutes = Math.floor(duration / 60);
      const seconds = duration % 60;
      return `${minutes}m ${seconds}s`;
    }

    if (column.type === 'textWithLabel') {
      return (
        <VStack align="start" spacing={0}>
          <Text fontSize="xs" color="gray.500">
            {column.label}
          </Text>
          <Text fontSize="sm" fontWeight="medium" noOfLines={1}>
            {item[column.key]}
          </Text>
        </VStack>
      );
    }

    return (
      <Text fontSize="sm" noOfLines={1}>
        {item[column.key]}
      </Text>
    );
  };

  return (
    <Box 
      borderWidth="1px" 
      borderRadius="lg" 
      borderColor={borderColor}
      bg={useColorModeValue('white', 'gray.800')}
      width="100%"
      boxShadow="sm"
      overflow="hidden"
    >
      <Box 
        overflow="auto"
        height={height}
        position="relative"
      >
        <Table 
          variant="simple" 
          size={compact ? "xs" : "sm"}
          sx={{
            'th': {
              py: 3,
              px: 4,
              fontWeight: '600',
              fontSize: 'xs',
              textTransform: 'uppercase',
              letterSpacing: 'wider',
              color: useColorModeValue('gray.600', 'gray.400'),
              bg: headerBg,
              borderBottom: '2px solid',
              borderColor: borderColor,
              position: 'sticky',
              top: 0,
              zIndex: 2,
            },
            'td': {
              py: 3,
              px: 4,
              fontSize: 'sm',
              borderColor: useColorModeValue('gray.100', 'gray.700'),
            },
          }}
        >
          <Thead>
            <Tr>
              {columns.map((column) => (
                <Th 
                  key={column.key} 
                  minWidth={column.minWidth || "auto"}
                  isNumeric={column.isNumeric}
                >
                  <Flex align="center" justify={column.isNumeric ? "flex-end" : "flex-start"}>
                    {column.header}
                    {column.tooltip && (
                      <Tooltip label={column.tooltip}>
                        <Box as="span" ml={1} fontSize="xs" opacity={0.6} cursor="help">ⓘ</Box>
                      </Tooltip>
                    )}
                  </Flex>
                </Th>
              ))}
              {actions && (
                <Th 
                  width="80px" 
                  textAlign="right"
                >
                  Actions
                </Th>
              )}
            </Tr>
          </Thead>
          <Tbody>
            {paginatedData.length === 0 ? (
              <Tr>
                <Td 
                  colSpan={columns.length + (actions ? 1 : 0)} 
                  textAlign="center" 
                  py={20}
                >
                  <VStack spacing={3}>
                    <Box 
                      p={4} 
                      borderRadius="full" 
                      bg={useColorModeValue('gray.50', 'gray.700')}
                      color="gray.400"
                    >
                      <FiEye size={24} />
                    </Box>
                    <Box>
                      <Text color="gray.500" fontWeight="medium">
                        No results found
                      </Text>
                      <Text color="gray.400" fontSize="xs">
                        Try adjusting your filters or adding new items
                      </Text>
                    </Box>
                  </VStack>
                </Td>
              </Tr>
            ) : (
              paginatedData.map((item, index) => (
                <Tr
                  key={item.id || index}
                  _hover={{ bg: rowHoverBg }}
                  transition="all 0.2s"
                  bg={striped && index % 2 === 0 ? stripedBg : 'transparent'}
                >
                  {columns.map((column) => (
                    <Td key={`${item.id}-${column.key}`} minWidth={column.minWidth || "auto"}>
                      {renderCell(item, column)}
                    </Td>
                  ))}
                  {actions && (
                    <Td 
                      width="80px" 
                      textAlign="right"
                    >
                      <Flex justify="flex-end">
                        <Menu placement="bottom-end" isLazy>
                          <MenuButton
                            as={IconButton}
                            icon={<FiMoreVertical />}
                            variant="ghost"
                            size="sm"
                            borderRadius="full"
                            aria-label="Actions"
                            _hover={{ bg: useColorModeValue('gray.100', 'gray.600') }}
                          />
                          <MenuList minW="160px" boxShadow="lg" py={2}>
                            {onView && (
                              <MenuItem 
                                icon={<FiEye size={14} />} 
                                onClick={() => onView(item)}
                              >
                                View Details
                              </MenuItem>
                            )}
                            {onEdit && (
                              <MenuItem 
                                icon={<FiEdit2 size={14} />} 
                                onClick={() => onEdit(item)}
                              >
                                Edit Record
                              </MenuItem>
                            )}
                            {onDelete && (
                              <MenuItem
                                icon={<FiTrash2 size={14} />}
                                onClick={() => onDelete(item)}
                                color="red.500"
                              >
                                Delete Record
                              </MenuItem>
                            )}
                          </MenuList>
                        </Menu>
                      </Flex>
                    </Td>
                  )}
                </Tr>
              ))
            )}
          </Tbody>
        </Table>
      </Box>

      {/* Pagination Footer - Moved outside scrollable Box */}
      <Flex 
        px={6} 
        py={4}
        justify="space-between"
        align="center"
        bg={useColorModeValue('gray.100', 'gray.900')}
        borderTop="1px solid"
        borderColor={borderColor}
        flexWrap="wrap"
        gap={4}
      >
        <HStack spacing={4}>
          <Text fontSize="sm" color="gray.500">
            Showing <b>{Math.min(startIndex + 1, totalItems)}</b> to <b>{Math.min(startIndex + pageSize, totalItems)}</b> of <b>{totalItems}</b> items
          </Text>
          <Select
            size="sm"
            width="110px"
            borderRadius="md"
            value={pageSize}
            onChange={(e) => {
              setPageSize(parseInt(e.target.value));
              setCurrentPage(1);
            }}
            bg={useColorModeValue('white', 'gray.800')}
          >
            <option value={10}>10 rows</option>
            <option value={25}>25 rows</option>
            <option value={50}>50 rows</option>
            <option value={100}>100 rows</option>
          </Select>
        </HStack>

        <HStack spacing={2}>
          <IconButton
            size="sm"
            icon={<FiChevronsLeft />}
            variant="outline"
            onClick={() => handlePageChange(1)}
            isDisabled={currentPage === 1}
            aria-label="First page"
          />
          <IconButton
            size="sm"
            icon={<FiChevronLeft />}
            variant="outline"
            onClick={() => handlePageChange(currentPage - 1)}
            isDisabled={currentPage === 1}
            aria-label="Previous page"
          />
          
          <Flex align="center" px={2}>
            <Text fontSize="sm" fontWeight="medium">
              Page {currentPage} of {totalPages || 1}
            </Text>
          </Flex>

          <IconButton
            size="sm"
            icon={<FiChevronRight />}
            variant="outline"
            onClick={() => handlePageChange(currentPage + 1)}
            isDisabled={currentPage === totalPages || totalPages === 0}
            aria-label="Next page"
          />
          <IconButton
            size="sm"
            icon={<FiChevronsRight />}
            variant="outline"
            onClick={() => handlePageChange(totalPages)}
            isDisabled={currentPage === totalPages || totalPages === 0}
            aria-label="Last page"
          />
        </HStack>
      </Flex>
    </Box>
  );
};

export default DataTable;