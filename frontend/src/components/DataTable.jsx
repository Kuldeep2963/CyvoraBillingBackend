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
  Spinner,
} from '@chakra-ui/react';
import {
  FiMoreVertical,
  FiEdit2,
  FiTrash2,
  FiEye,
} from 'react-icons/fi';
import TablePagination from './TablePagination';

const DataTable = ({
  columns,
  data,
  onEdit,
  onDelete,
  onView,
  rowActions,
  getRowBg,
  actions = true,
  compact = false,
  striped = false,
  height = 'calc(100vh - 400px)',
  serverPagination = false,
  page,
  pageSize: externalPageSize,
  total,
  onPageChange,
  onPageSizeChange,
  isPaginationDisabled = false,
  isLoading = false,
  emptyMessage = 'No results found',
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSizeLocal, setPageSizeLocal] = useState(10);

  const rowHoverBg       = useColorModeValue('blue.50',  'gray.700');
  const borderColor      = useColorModeValue('gray.200', 'gray.600');
  const stripedBg        = useColorModeValue('gray.50',  'gray.800');
  const tableBg          = useColorModeValue('white',    'gray.800');
  const tdBorderColor    = useColorModeValue('gray.100', 'gray.700');
  const emptyStateIconBg = useColorModeValue('gray.50',  'gray.700');
  const actionMenuBg     = useColorModeValue('gray.100', 'gray.600');
  const headerBg         = 'gray.200';

  const showActionsColumn =
    actions !== false &&
    rowActions !== false &&
    (typeof rowActions === 'function' || onEdit || onDelete || onView);

  const activePage     = serverPagination ? (Number(page)             || 1)  : currentPage;
  const activePageSize = serverPagination ? (Number(externalPageSize) || 10) : pageSizeLocal;
  const totalItems     = serverPagination ? (Number(total)            || 0)  : data.length;
  const totalPages     = Math.max(1, Math.ceil(totalItems / activePageSize));
  const startIndex     = (activePage - 1) * activePageSize;
  const paginatedData  = serverPagination
    ? data
    : data.slice(startIndex, startIndex + activePageSize);

  const handlePageChange = (newPage) => {
    if (newPage < 1 || newPage > totalPages) return;
    if (serverPagination) {
      onPageChange?.(newPage);
    } else {
      setCurrentPage(newPage);
    }
  };

  const renderCell = (item, column) => {
    if (column.render) return column.render(item[column.key], item);

    if (column.type === 'badge') {
      const colorScheme = column.colorMap?.[item[column.key]] || 'gray';
      return (
        <Badge colorScheme={colorScheme} variant="subtle" fontSize="xs" px={2} py={0.5} borderRadius="full">
          {item[column.key]}
        </Badge>
      );
    }

    if (column.type === 'date') {
      const dateValue = item[column.key];
      const date = !dateValue || dateValue === 'N/A'
        ? null
        : (isNaN(dateValue) ? new Date(dateValue) : new Date(parseInt(dateValue)));
      if (!date || isNaN(date.getTime())) {
        return <Text fontSize="sm" color="gray.400">N/A</Text>;
      }
      return (
        <VStack align="start" spacing={0}>
          <Text fontSize="sm" fontWeight="medium">{date.toLocaleDateString()}</Text>
          <Text fontSize="xs" color="gray.500">
            {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </VStack>
      );
    }

    if (column.type === 'currency') {
      return <Text fontWeight="medium">${parseFloat(item[column.key]).toFixed(4)}</Text>;
    }

    if (column.type === 'duration') {
      const duration = item[column.key];
      if (duration < 60) return `${duration}s`;
      return `${Math.floor(duration / 60)}m ${duration % 60}s`;
    }

    if (column.type === 'textWithLabel') {
      return (
        <VStack align="start" spacing={0}>
          <Text fontSize="xs" color="gray.500">{column.label}</Text>
          <Text fontSize="sm" fontWeight="medium" noOfLines={1}>{item[column.key]}</Text>
        </VStack>
      );
    }

    return <Text fontSize="sm" noOfLines={1}>{item[column.key]}</Text>;
  };

  const getColumnWidth = (column) =>
    column.width || column.maxWidth || column.minWidth || undefined;

  return (
    <Box
      className="app-table-shell"
      borderWidth="1px"
      borderRadius="lg"
      borderColor={borderColor}
      bg={tableBg}
      width="100%"
      boxShadow="sm"
      overflow="hidden"
    >
      <Box overflowY="auto" overflowX="auto" height={height} position="relative">
        <Table
          className="app-table"
          variant="simple"
          size={compact ? 'xs' : 'sm'}
          width="max-content"
          minWidth="100%"
          sx={{
            th: {
              py: 2,
              px: 3,
              fontWeight: '600',
              fontSize: 'xs',
              textTransform: 'uppercase',
              letterSpacing: 'wider',
              color: 'gray.800',
              bg: headerBg,
              borderBottom: '2px solid',
              borderColor: borderColor,
              position: 'sticky',
              top: 0,
              zIndex: 2,
            },
            td: {
              py: 3,
              px: 3,
              fontSize: 'sm',
              borderColor: tdBorderColor,
            },
          }}
        >
          <Thead>
            <Tr>
              {columns.map((column) => (
                <Th
                  className="app-table-header-cell"
                  key={column.key}
                  width={getColumnWidth(column)}
                  minWidth={column.minWidth || column.width || column.maxWidth || 'auto'}
                  maxWidth={column.maxWidth || column.width || undefined}
                  isNumeric={column.isNumeric}
                >
                  <Flex align="center" justify={column.isNumeric ? 'flex-end' : 'flex-start'}>
                    {column.header}
                    {column.tooltip && (
                      <Tooltip label={column.tooltip}>
                        <Box as="span" ml={1} fontSize="xs" opacity={0.6} cursor="help">ⓘ</Box>
                      </Tooltip>
                    )}
                  </Flex>
                </Th>
              ))}

              {showActionsColumn && (
                <Th className="app-table-header-cell" w="50px" textAlign="center">
                  Actions
                </Th>
              )}
            </Tr>
          </Thead>

          <Tbody>
            {/* Loading state */}
            {isLoading ? (
  <Tr>
    <Td
      colSpan={columns.length + (showActionsColumn ? 1 : 0)}
      border="none"
    >
      <Flex
        justify="center"
        align="center"
        direction="column"
        gap={3}
        w="100%"
        minH="300px"
        position="sticky"
        left={0}
        right={0}
      >
        <Spinner size="lg" color="blue.500" thickness="3px" />
        <Text color="gray.500" fontWeight="medium">Loading...</Text>
      </Flex>
    </Td>
  </Tr>

) : paginatedData.length === 0 ? (
  <Tr>
    <Td
      colSpan={columns.length + (showActionsColumn ? 1 : 0)}
      border="none"
    >
      <Flex
        justify="center"
        align="center"
        direction="column"
        gap={1}
        w="100%"
        minH="300px"
        position="sticky"
        left={0}
        right={0}
      >
        <Box p={4} borderRadius="full" bg={emptyStateIconBg} color="gray.400">
          <FiEye size={24} />
        </Box>
        <Box textAlign="center">
          <Text color="gray.500" fontWeight="medium">{emptyMessage}</Text>
          <Text color="gray.400" fontSize="xs">
            Try adjusting your filters or adding new items
          </Text>
        </Box>
      </Flex>
    </Td>
  </Tr>

            ) : (
              /* Data rows */
              paginatedData.map((item, index) => {
                const rowBgColor = getRowBg
                  ? getRowBg(item)
                  : striped && index % 2 === 0
                  ? stripedBg
                  : 'transparent';

                const rowKey = item.id != null ? String(item.id) : `row-${index}`;

                return (
                  <Tr
                    className="app-table-row"
                    key={rowKey}
                    _hover={{ bg: rowHoverBg }}
                    transition="all 0.2s"
                    bg={rowBgColor}
                  >
                    {columns.map((column) => (
                      <Td
                        className="app-table-cell"
                        key={`${rowKey}-${column.key}`}
                        minWidth={column.minWidth || 'auto'}
                        isNumeric={column.isNumeric}
                      >
                        <Box
                          width={getColumnWidth(column)}
                          maxWidth={column.maxWidth || column.width || undefined}
                          overflow={column.maxWidth || column.width ? 'hidden' : 'visible'}
                          textOverflow={column.maxWidth || column.width ? 'ellipsis' : 'clip'}
                          whiteSpace="normal"
                        >
                          {renderCell(item, column)}
                        </Box>
                      </Td>
                    ))}

                    {showActionsColumn && (
                      <Td className="app-table-cell" width="140px" textAlign="right">
                        <Flex justify="center" align="center">
                          {typeof rowActions === 'function' && rowActions(item)}

                          {(onView || onEdit || onDelete) && (
                            <Menu placement="bottom-end" isLazy>
                              <MenuButton
                                as={IconButton}
                                icon={<FiMoreVertical />}
                                variant="ghost"
                                size="sm"
                                borderRadius="full"
                                aria-label="Actions"
                                _hover={{ bg: actionMenuBg }}
                              />
                              <MenuList minW="170px" boxShadow="lg" py={2}>
                                {onView && (
                                  <MenuItem icon={<FiEye size={14} />} onClick={() => onView(item)} color="gray.600">
                                    View Details
                                  </MenuItem>
                                )}
                                {onEdit && (
                                  <MenuItem icon={<FiEdit2 size={14} />} onClick={() => onEdit(item)} color="gray.600">
                                    Edit Account
                                  </MenuItem>
                                )}
                                {onDelete && (
                                  <MenuItem icon={<FiTrash2 size={14} />} onClick={() => onDelete(item)} color="red.500">
                                    Delete Account
                                  </MenuItem>
                                )}
                              </MenuList>
                            </Menu>
                          )}
                        </Flex>
                      </Td>
                    )}
                  </Tr>
                );
              })
            )}
          </Tbody>
        </Table>
      </Box>

      <TablePagination
        page={activePage}
        pageSize={activePageSize}
        total={totalItems}
        onPageChange={handlePageChange}
        onPageSizeChange={(size) => {
          if (serverPagination) {
            onPageSizeChange?.(size);
          } else {
            setPageSizeLocal(size);
            setCurrentPage(1);
          }
        }}
        isDisabled={isPaginationDisabled}
      />
    </Box>
  );
};

export default DataTable;