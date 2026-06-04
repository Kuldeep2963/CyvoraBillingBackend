import React, { useMemo, useState } from "react";
import {
  Badge,
  Box,
  Button,
  Card,
  CardBody,
  Flex,
  Spinner,
  Text,
} from "@chakra-ui/react";
import useNotify from "../utils/notify";
import { SearchIcon } from "@chakra-ui/icons";
import DateRangePicker from "../components/formats/DateRangepicker";
import PageNavBar from "../components/PageNavBar";
import { fetchAllAccountExposure } from "../utils/api";
import DataTable from "../components/DataTable";

const formatAmount = (amount) =>
  Number(amount || 0).toLocaleString("en-US", {
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  });

const parseDateString = (value) => {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatDateToYMD = (date) => {
  if (!date) return "";
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  const d = `${date.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const EmptyState = () => (
  <Box
    border="0.5px dashed"
    borderColor="gray.200"
    borderRadius="12px"
    bg="gray.50"
    py={16}
    px={6}
    textAlign="center"
  >
    {/* Icon cluster */}
    <Flex justify="center" mb={5} position="relative" h="56px" align="center">
      {/* Background rings */}
      <Box
        position="absolute"
        w="80px"
        h="80px"
        borderRadius="full"
        border="0.5px solid"
        borderColor="gray.200"
        bg="transparent"
      />
      <Box
        position="absolute"
        w="56px"
        h="56px"
        borderRadius="full"
        border="0.5px solid"
        borderColor="gray.200"
        bg="white"
      />
      {/* Center icon */}
      <Box
        position="relative"
        w="36px"
        h="36px"
        borderRadius="full"
        bg="white"
        border="0.5px solid"
        borderColor="gray.200"
        display="flex"
        alignItems="center"
        justifyContent="center"
        boxShadow="sm"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#94a3b8"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 3h18v4H3z" />
          <path d="M3 10h18v11H3z" />
          <line x1="8" y1="14" x2="16" y2="14" />
          <line x1="8" y1="17" x2="13" y2="17" />
        </svg>
      </Box>
    </Flex>

    {/* Text */}
    <Text
      fontSize="14px"
      fontWeight="500"
      color="gray.600"
      mb={1}
    >
      No exposure data yet
    </Text>
    <Text
      fontSize="12px"
      color="gray.400"
      maxW="280px"
      mx="auto"
      lineHeight="1.7"
    >
      Select a date range above and click{" "}
      <Box as="span" color="blue.500" fontWeight="500">
        Calculate Account Exposure
      </Box>{" "}
      to see CDR-based results for all accounts.
    </Text>
  </Box>
);
const accountRoleLabel = {
  customer: "Customer",
  vendor: "Vendor",
  both: "Bilateral",
};
const COLUMNS = [
  {
    key: "accountName",
    header: "Account",
    minWidth: "160px",
    render: (value, row) => (
      <Box>
        <Text fontWeight="500" fontSize="14px" color="gray.800">
          {value}
        </Text>
        <Badge
          borderRadius="full"
          px="8px"
          py="2px"
          mt={2}
          fontWeight="500"
          fontSize="11px"
          colorScheme={
            row.accountRole === "customer"
              ? "green"
              : row.accountRole === "vendor"
                ? "blue"
                : row.accountRole === "both"
                  ? "purple"
                  : "gray"
          }
          textTransform="none"
        >
          {accountRoleLabel[row.accountRole] || "-"}
        </Badge>
      </Box>
    ),
  },
  {
    key: "customerExpense",
    header: "Customer Expense",
    isNumeric: true,
    render: (value) => (
      <Text
        fontWeight="500"
        textAlign="right"
        color="blue.700"
        fontVariantNumeric="tabular-nums"
      >
        ${formatAmount(value)}
      </Text>
    ),
  },
  {
    key: "vendorExpense",
    header: "Vendor Expense",
    isNumeric: true,
    render: (value) => (
      <Text
        fontWeight="500"
        textAlign="right"
        color="purple.700"
        fontVariantNumeric="tabular-nums"
      >
        ${formatAmount(value)}
      </Text>
    ),
  },
  {
    key: "totalReceivable",
    header: "Total Receivable",
    isNumeric: true,
    render: (value) => (
      <Text
        fontWeight="500"
        textAlign="right"
        color={Number(value) > 0 ? "green.700" : "gray.400"}
        fontVariantNumeric="tabular-nums"
      >
        ${formatAmount(value)}
      </Text>
    ),
  },
  {
    key: "totalPayable",
    header: "Total Payable",
    isNumeric: true,
    render: (value) => (
      <Text
        fontWeight="500"
        textAlign="right"
        color={Number(value) > 0 ? "red.600" : "gray.400"}
        fontVariantNumeric="tabular-nums"
      >
        ${formatAmount(value)}
      </Text>
    ),
  },
  {
    key: "netAmount",
    header: "Net Exposure",
    isNumeric: true,
    render: (value, row) => (
      <Text
        fontWeight="500"
        textAlign="right"
        color={
          row.netPosition === "receivable"
            ? "green.700"
            : row.netPosition === "payable"
              ? "red.600"
              : "gray.500"
        }
        fontVariantNumeric="tabular-nums"
      >
        ${formatAmount(value)}
      </Text>
    ),
  },
  {
    key: "netPosition",
    header: "Position",
    render: (value) => {
      const map = {
        receivable: { label: "Receivable", color: "green" },
        payable: { label: "Payable", color: "red" },
        balanced: { label: "Balanced", color: "gray" },
      };
      const badge = map[value] || map.balanced;
      return (
        <Badge
          colorScheme={badge.color}
          fontSize="11px"
          fontWeight="500"
          px={3}
          py="3px"
          borderRadius="full"
          textTransform="none"
        >
          {badge.label}
        </Badge>
      );
    },
  },
];

const PAGE_SIZE = 10;

const AccountExposure = () => {
  const toast = useNotify();
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const [startDate, setStartDate] = useState(formatDateToYMD(yesterday));
  const [endDate, setEndDate] = useState(formatDateToYMD(today));
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    totalPages: 1,
  });
  const [hasCalculated, setHasCalculated] = useState(false);

  const fetchPage = async (pg = 1) => {
    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      toast({
        title: "Invalid date range",
        description: "Start date cannot be after end date",
        status: "warning",
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    try {
      setLoading(true);
      const result = await fetchAllAccountExposure({
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        page: pg,
        limit: PAGE_SIZE,
      });

      if (!result?.success)
        throw new Error(result?.error || "Failed to fetch exposure");

      setData(result.data || []);
      setPagination(result.pagination || { total: 0, page: pg, totalPages: 1 });
      setHasCalculated(true);
    } catch (err) {
      toast({
        title: "Failed to load exposure",
        description: err.message,
        status: "error",
        duration: 4000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCalculate = () => fetchPage(1);

  const handlePageChange = (pg) => fetchPage(pg);

  return (
    <Box>
      <PageNavBar
        title="Account Exposure"
        description="CDR-based exposure summary for all accounts"
        mb={5}
      />

      {/* Filter Bar */}
      <Card
        mb={4}
        bg="white"
        borderWidth="0.5px"
        borderColor="gray.200"
        borderRadius="10px"
        boxShadow="none"
      >
        <CardBody py={3} px={5}>
          <Flex align="center" gap={3} flexWrap="wrap">
            <Text
              fontSize="10px"
              fontWeight="600"
              color="gray.400"
              textTransform="uppercase"
              letterSpacing="0.07em"
              whiteSpace="nowrap"
            >
              Date Range
            </Text>

            <DateRangePicker
              value={{
                startDate: parseDateString(startDate),
                endDate: parseDateString(endDate),
              }}
              onChange={(range) => {
                setStartDate(formatDateToYMD(range?.startDate));
                setEndDate(formatDateToYMD(range?.endDate));
                setData([]);
                setHasCalculated(false);
              }}
              placeholder="Select date range"
              inputProps={{ minW: "220px", maxW: "300px", size: "sm" }}
            />

            <Button
              size="sm"
              bg="blue.500"
              color="white"
              _hover={{ bg: "blue.600" }}
              _active={{ bg: "blue.700" }}
              leftIcon={<SearchIcon boxSize="11px" />}
              onClick={handleCalculate}
              isLoading={loading}
              loadingText="Calculating..."
              height="34px"
              px={5}
              borderRadius="8px"
              fontWeight="500"
              fontSize="13px"
              boxShadow="none"
            >
              Calculate Account Exposure
            </Button>

            {hasCalculated && !loading && (
              <Text fontSize="12px" color="gray.400">
                {pagination.total} accounts · page {pagination.page} of{" "}
                {pagination.totalPages}
              </Text>
            )}
          </Flex>
        </CardBody>
      </Card>

      {loading ? (
        <Flex
          justify="center"
          align="center"
          mt={20}
          direction="column"
          gap={3}
        >
          <Spinner size="lg" color="blue.400" thickness="2px" />
          <Text fontSize="13px" color="gray.500">Calculating exposure for accounts{" "} {(pagination.page - 1) * PAGE_SIZE + 1} – {Math.min(pagination.page * PAGE_SIZE,pagination.total || PAGE_SIZE,)} ...</Text>
        </Flex>
      ) : hasCalculated ? (
        <DataTable
          columns={COLUMNS}
          data={data}
          serverPagination
          page={pagination.page}
          pageSize={PAGE_SIZE}
          total={pagination.total}
          onPageChange={handlePageChange}
          isPaginationDisabled={loading}
          striped
          height="calc(100vh - 280px)"
          rowactions ={false}
        />
      ) : (
        <EmptyState />
      )}
    </Box>
  );
};

export default AccountExposure;
