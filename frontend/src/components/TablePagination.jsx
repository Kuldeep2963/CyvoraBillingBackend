import React from "react";
import { Flex, HStack, Text, IconButton, useColorModeValue } from "@chakra-ui/react";
import {
  FiChevronLeft,
  FiChevronRight,
  FiChevronsLeft,
  FiChevronsRight,
} from "react-icons/fi";
import { MemoizedSelect as Select } from "./memoizedinput/memoizedinput";

const TablePagination = ({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
  isDisabled = false,
}) => {
  const borderColor = useColorModeValue("#d1d5db", "#d1d5db");
  const footerBg = useColorModeValue("gray.100", "gray.900");
  const selectBg = useColorModeValue("white", "gray.800");

  const safeTotal = Number.isFinite(Number(total)) ? Number(total) : 0;
  const safePageSize = Number.isFinite(Number(pageSize)) && Number(pageSize) > 0 ? Number(pageSize) : 10;
  const totalPages = Math.max(1, Math.ceil(safeTotal / safePageSize));
  const currentPage = Math.min(Math.max(1, Number(page) || 1), totalPages);

  const start = safeTotal === 0 ? 0 : (currentPage - 1) * safePageSize + 1;
  const end = Math.min(currentPage * safePageSize, safeTotal);

  const goTo = (nextPage) => {
    if (isDisabled) return;
    const bounded = Math.min(Math.max(1, nextPage), totalPages);
    if (bounded !== currentPage) onPageChange?.(bounded);
  };

  return (
    <Flex
      className="app-table-pagination"
      px={6}
      py={4}
      justify="space-between"
      align="center"
      bg={footerBg}
      borderTop="1px solid"
      borderColor={borderColor}
      flexWrap="wrap"
      gap={4}
    >
      <HStack spacing={4}>
        <Text fontSize="sm" color="gray.500">
          Showing <b>{start}</b> to <b>{end}</b> of <b>{safeTotal}</b> items
        </Text>
        <Select
          size="sm"
          width="110px"
          borderRadius="md"
          value={safePageSize}
          onChange={(e) => onPageSizeChange?.(parseInt(e.target.value, 10))}
          bg={selectBg}
          isDisabled={isDisabled}
        >
          {pageSizeOptions.map((size) => (
            <option key={size} value={size}>
              {size} rows
            </option>
          ))}
        </Select>
      </HStack>

      <HStack spacing={2}>
        <IconButton
          size="sm"
          icon={<FiChevronsLeft />}
          variant="outline"
          onClick={() => goTo(1)}
          isDisabled={isDisabled || currentPage === 1}
          aria-label="First page"
        />
        <IconButton
          size="sm"
          icon={<FiChevronLeft />}
          variant="outline"
          onClick={() => goTo(currentPage - 1)}
          isDisabled={isDisabled || currentPage === 1}
          aria-label="Previous page"
        />

        <Flex align="center" px={2}>
          <Text fontSize="sm" fontWeight="medium">
            Page {currentPage} of {totalPages}
          </Text>
        </Flex>

        <IconButton
          size="sm"
          icon={<FiChevronRight />}
          variant="outline"
          onClick={() => goTo(currentPage + 1)}
          isDisabled={isDisabled || currentPage >= totalPages}
          aria-label="Next page"
        />
        <IconButton
          size="sm"
          icon={<FiChevronsRight />}
          variant="outline"
          onClick={() => goTo(totalPages)}
          isDisabled={isDisabled || currentPage >= totalPages}
          aria-label="Last page"
        />
      </HStack>
    </Flex>
  );
};

export default TablePagination;
