import React from 'react';
import {
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Box,
  Text,
  IconButton,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  Badge,
  Tooltip,
  useColorModeValue,
} from '@chakra-ui/react';
import { FiMoreVertical, FiEdit2, FiTrash2, FiEye } from 'react-icons/fi';

const DataTable = ({
  columns,
  data,
  onEdit,
  onDelete,
  onView,
  actions = true,
  sortable = true,
}) => {
  const rowHoverBg = useColorModeValue('gray.50', 'gray.700');
  const borderColor = useColorModeValue('gray.200', 'gray.600');

  const renderCell = (item, column) => {
    if (column.render) {
      return column.render(item[column.key], item);
    }

    if (column.type === 'badge') {
      const colorScheme = column.colorMap?.[item[column.key]] || 'gray';
      return (
        <Badge colorScheme={colorScheme} variant="subtle">
          {item[column.key]}
        </Badge>
      );
    }

    if (column.type === 'date') {
      return new Date(item[column.key]).toLocaleDateString();
    }

    if (column.type === 'currency') {
      return `$${parseFloat(item[column.key]).toFixed(4)}`;
    }

    if (column.type === 'duration') {
      const duration = item[column.key];
      if (duration < 60) return `${duration}s`;
      const minutes = Math.floor(duration / 60);
      const seconds = duration % 60;
      return `${minutes}m ${seconds}s`;
    }

    return item[column.key];
  };

  return (
    <Box overflowX="auto" borderWidth="1px" borderRadius="lg" borderColor={borderColor}>
      <Table variant="simple" size="md">
        <Thead bg={useColorModeValue('gray.100', 'gray.700')}>
          <Tr>
            {columns.map((column) => (
              <Th key={column.key} whiteSpace="nowrap">
                {column.header}
              </Th>
            ))}
            {actions && <Th textAlign="right">Actions</Th>}
          </Tr>
        </Thead>
        <Tbody>
          {data.length === 0 ? (
            <Tr>
              <Td colSpan={columns.length + (actions ? 1 : 0)} textAlign="center" py={8}>
                <Text color="gray.500">No data available</Text>
              </Td>
            </Tr>
          ) : (
            data.map((item, index) => (
              <Tr
                key={item.id || index}
                _hover={{ bg: rowHoverBg }}
                transition="background 0.2s"
              >
                {columns.map((column) => (
                  <Td key={`${item.id}-${column.key}`} maxW="200px" overflow="hidden" textOverflow="ellipsis">
                    {renderCell(item, column)}
                  </Td>
                ))}
                {actions && (
                  <Td textAlign="right">
                    <Menu>
                      <MenuButton
                        as={IconButton}
                        icon={<FiMoreVertical />}
                        variant="ghost"
                        size="sm"
                      />
                      <MenuList>
                        {onView && (
                          <MenuItem icon={<FiEye />} onClick={() => onView(item)}>
                            View Details
                          </MenuItem>
                        )}
                        {onEdit && (
                          <MenuItem icon={<FiEdit2 />} onClick={() => onEdit(item)}>
                            Edit
                          </MenuItem>
                        )}
                        {onDelete && (
                          <MenuItem
                            icon={<FiTrash2 />}
                            onClick={() => onDelete(item)}
                            color="red.500"
                          >
                            Delete
                          </MenuItem>
                        )}
                      </MenuList>
                    </Menu>
                  </Td>
                )}
              </Tr>
            ))
          )}
        </Tbody>
      </Table>
    </Box>
  );
};

export default DataTable;