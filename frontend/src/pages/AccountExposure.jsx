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

        <DataTable
          isLoading={loading}
          emptyMessage={
            hasCalculated
              ? "No accounts found for the selected date range."
              : "Calculate account exposure to see results."
          }
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
    </Box>
  );
};

export default AccountExposure;
