import React from 'react';
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
} from '@chakra-ui/react';
import { FiMoreVertical, FiEdit2, FiTrash2, FiEye, FiChevronRight } from 'react-icons/fi';

const DataTable = ({
  columns,
  data,
  onEdit,
  onDelete,
  onView,
  actions = true,
  compact = false,
  striped = false,
  height = '400px',
}) => {
  const rowHoverBg = useColorModeValue('gray.50', 'gray.700');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const stripedBg = useColorModeValue('gray.50', 'gray.800');

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
      return (
        <VStack align="start" spacing={0}>
          <Text fontSize="sm" fontWeight="medium">
            {new Date(item[column.key]).toLocaleDateString()}
          </Text>
          <Text fontSize="xs" color="gray.500">
            {new Date(item[column.key]).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
      overflow="auto"
      bg={useColorModeValue('white', 'gray.800')}
      height={height}
      width="100%"
      position="relative"
    >
      <Table 
        variant="simple" 
        size={compact ? "sm" : "md"}
        sx={{
          '& th': {
            py: compact ? 2 : 3,
            px: compact ? 3 : 4,
            fontWeight: '600',
            fontSize: compact ? 'xs' : 'sm',
            letterSpacing: 'wide',
            textTransform: 'uppercase',
            color: useColorModeValue('gray.600', 'gray.300'),
            whiteSpace: 'nowrap',
            bg: useColorModeValue('gray.50', 'gray.700'),
            borderBottomWidth: '2px',
            borderColor: borderColor,
            position: 'sticky',
            top: 0,
            zIndex: 2,
          },
          '& td': {
            py: compact ? 2 : 3,
            px: compact ? 3 : 4,
            whiteSpace: 'nowrap',
            borderBottomWidth: '1px',
            borderColor: useColorModeValue('gray.100', 'gray.700'),
          },
        }}
      >
        <Thead bg={useColorModeValue('gray.50', 'gray.700')}>
          <Tr>
            {columns.map((column) => (
              <Th key={column.key} minWidth={column.minWidth || "auto"}>
                <Flex align="center">
                  {column.header}
                  {column.tooltip && (
                    <Tooltip label={column.tooltip}>
                      <Box as="span" ml={1} fontSize="xs" opacity={0.6}>ⓘ</Box>
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
          {data.length === 0 ? (
            <Tr>
              <Td 
                colSpan={columns.length + (actions ? 1 : 0)} 
                textAlign="center" 
                py={8}
              >
                <VStack spacing={2}>
                  <Text color="gray.500" fontSize="sm">
                    No data available
                  </Text>
                  <Text color="gray.400" fontSize="xs">
                    Add items to get started
                  </Text>
                </VStack>
              </Td>
            </Tr>
          ) : (
            data.map((item, index) => (
              <Tr
                key={item.id || index}
                _hover={{ bg: rowHoverBg }}
                transition="background 0.2s"
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
                      <Menu placement="bottom-end">
                        <MenuButton
                          as={IconButton}
                          icon={<FiMoreVertical />}
                          variant="ghost"
                          size="xs"
                          aria-label="Actions"
                        />
                        <MenuList minW="160px" fontSize="sm">
                          {onView && (
                            <MenuItem 
                              icon={<FiEye size={14} />} 
                              onClick={() => onView(item)}
                              fontSize="sm"
                              py={2}
                            >
                              View Details
                            </MenuItem>
                          )}
                          {onEdit && (
                            <MenuItem 
                              icon={<FiEdit2 size={14} />} 
                              onClick={() => onEdit(item)}
                              fontSize="sm"
                              py={2}
                            >
                              Edit
                            </MenuItem>
                          )}
                          {onDelete && (
                            <MenuItem
                              icon={<FiTrash2 size={14} />}
                              onClick={() => onDelete(item)}
                              color="red.500"
                              fontSize="sm"
                              py={2}
                            >
                              Delete
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

      {/* Sticky Footer */}
      {data.length > 0 && (
        <Box 
          flexShrink={0}
          borderTopWidth="1px" 
          borderColor={borderColor}
          bg={useColorModeValue('gray.50', 'gray.700')}
          position="sticky"
          bottom={0}
          zIndex={2}
          overflowX="auto"
          overflowY="hidden"
        >
          <Box minWidth="min-content">
            <Flex 
              px={4} 
              py={3}
              justify="space-between"
              align="center"
              fontSize="sm"
              color={useColorModeValue('gray.600', 'gray.300')}
              minWidth="100%"
            >
              <Text>
                Showing <b>{data.length}</b> {data.length === 1 ? 'item' : 'items'}
              </Text>
              <HStack spacing={2}>
                <IconButton
                  size="xs"
                  icon={<FiChevronRight />}
                  variant="ghost"
                  aria-label="Next page"
                  transform="rotate(180deg)"
                  isDisabled
                />
                <Text fontSize="xs">Page 1 of 1</Text>
                <IconButton
                  size="xs"
                  icon={<FiChevronRight />}
                  variant="ghost"
                  aria-label="Next page"
                  isDisabled
                />
              </HStack>
            </Flex>
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default DataTable;