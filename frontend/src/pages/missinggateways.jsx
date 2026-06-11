import React, { useEffect, useMemo, useState } from "react";
import {
  Card,
  CardBody,
  HStack,
  SimpleGrid,
  Text,
  VStack,
} from "@chakra-ui/react";
import useNotify from "../utils/notify";
import { fetchMissingGateways } from "../utils/api";
import DataTable from "../components/DataTable";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatDuration = (seconds) => {
  const n = Number(seconds) || 0;
  const m = Math.floor(n / 60);
  const s = n % 60;
  return `${m}m ${String(s).padStart(2, "0")}sec`;
};

const formatTimestamp = (value) => {
  if (!value) return "—";
  return new Date(Number(value)).toLocaleString("en-US", {
    year:   "numeric",
    month:  "short",
    day:    "2-digit",
    hour:   "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
};

// ─── Column definitions ───────────────────────────────────────────────────────
//
// Customer view (vendorReport=false):
//   Unknown gateway is the caller — show callerip + customer-side identifiers.
//
// Vendor view (vendorReport=true):
//   Unknown gateway is the callee  — show calleeip + vendor-side identifiers.
//
// Both views share occurrences, duration, firstSeen, lastSeen.

const SHARED_TAIL_COLUMNS = [
  {
    key:       "occurrences",
    header:    "Occurrences",
    isNumeric: true,
    minWidth:  "120px",
    render:    (value) => (
      <Text  fontSize="sm">
        {Number(value || 0).toLocaleString()}
      </Text>
    ),
  },
  {
    key:       "duration",
    header:    "Duration",
    isNumeric: true,
    minWidth:  "110px",
    render:    (value) => (
      <Text  fontSize="sm">{formatDuration(value)}</Text>
    ),
  },
  {
    key:      "firstSeen",
    header:   "First Seen",
    minWidth: "180px",
    render:   (value) => <Text fontSize="xs">{formatTimestamp(value)}</Text>,
  },
  {
    key:      "lastSeen",
    header:   "Last Seen",
    minWidth: "180px",
    render:   (value) => <Text fontSize="xs">{formatTimestamp(value)}</Text>,
  },
];

const CUSTOMER_COLUMNS = [
  {
    key:      "callerip",
    header:   "Caller IP",
    minWidth: "150px",
    render:   (value) => (
      <Text fontSize={"sm"} color={value ? "inherit" : "gray.400"}>
        {value || "—"}
      </Text>
    ),
  },
 
  {
    key:      "customername",
    header:   "Customer Name",
    minWidth: "160px",
    render:   (value) => (
      <Text fontSize="xs" color={value ? "inherit" : "gray.400"}>
        {value || "—"}
      </Text>
    ),
  },
  ...SHARED_TAIL_COLUMNS,
];

const VENDOR_COLUMNS = [
  {
    key:      "calleeip",
    header:   "Callee IP",
    minWidth: "150px",
    render:   (value) => (
      <Text  fontSize="sm" color={value ? "inherit" : "gray.400"}>
        {value || "—"}
      </Text>
    ),
  },
 
  {
    key:      "agentname",
    header:   "Vendor Name",
    minWidth: "160px",
    render:   (value) => (
      <Text fontSize="xs" color={value ? "inherit" : "gray.400"}>
        {value || "—"}
      </Text>
    ),
  },
  ...SHARED_TAIL_COLUMNS,
];

// ─── Stat card ────────────────────────────────────────────────────────────────

const SummaryStatCard = React.memo(({ label, value, color }) => (
  <Card bg="white" shadow="sm" _hover={{ boxShadow: "md" }} transition="all 0.2s">
    <CardBody px={4} py={3}>
      <HStack justify="space-between" align="center">
        <Text fontSize="sm" fontWeight="medium" color="gray.600">{label}</Text>
        <Text fontSize="lg" fontWeight="bold" color={color}>{value}</Text>
      </HStack>
    </CardBody>
  </Card>
));
SummaryStatCard.displayName = "SummaryStatCard";

const STAT_CARDS = [
  { label: "Unique Missing IPs",  getValue: (s) => (s.uniqueGateways   ?? 0).toLocaleString(), color: "blue.600"   },
  { label: "Total Missing CDRs",  getValue: (s) => (s.totalOccurrences ?? 0).toLocaleString(), color: "purple.600" },
  { label: "Total Duration",      getValue: (s) => `${Math.round((s.totalDuration ?? 0) / 60).toLocaleString()} min`, color: "green.600" },
  { label: "Total Records",       getValue: (s) => (s.total            ?? 0).toLocaleString(), color: "red.600"    },
];

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_SUMMARY    = { total: 0, uniqueGateways: 0, totalDuration: 0, totalOccurrences: 0 };
const DEFAULT_PAGINATION = { total: 0, page: 1, limit: 25, totalPages: 1 };

// ─── Main component ───────────────────────────────────────────────────────────

const MissingGateways = ({
  startDate,
  endDate,
  startHour    = 0,
  startMinute  = 0,
  endHour      = 23,
  endMinute    = 59,
  vendorReport = false,
  searchTerm   = "",
  triggerLoad  = 0,
  onDataReady,
}) => {
  const toast = useNotify();

  const [rows,              setRows]             = useState([]);
  const [summary,           setSummary]          = useState(DEFAULT_SUMMARY);
  const [loading,           setLoading]          = useState(false);
  const [page,              setPage]             = useState(1);
  const [pageSize,          setPageSize]         = useState(25);
  const [pagination,        setPagination]       = useState(DEFAULT_PAGINATION);
  const [hasAppliedFilters, setHasAppliedFilters]= useState(false);

  // Pick column set based on which side is being inspected
  const tableColumns = useMemo(
    () => (vendorReport ? VENDOR_COLUMNS : CUSTOMER_COLUMNS),
    [vendorReport],
  );

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const loadData = async (pageNum = 1) => {
    if (!startDate || !endDate) {
      toast({
        title:       "Date range required",
        description: "Please select start and end dates before generating the report.",
        status:      "warning",
        duration:    3000,
        isClosable:  true,
      });
      return;
    }

    setLoading(true);
    setPage(pageNum);
    try {
      const result = await fetchMissingGateways({
        startDate,
        endDate,
        startHour,
        startMinute,
        endHour,
        endMinute,
        vendorReport,
        search: searchTerm,
        page:   pageNum,
        limit:  pageSize,
      });

      const data = result?.data ?? [];
      setRows(data);
      setSummary(result?.summary   ?? DEFAULT_SUMMARY);
      setPagination(result?.pagination ?? { total: 0, page: pageNum, limit: pageSize, totalPages: 1 });
      setHasAppliedFilters(true);

      // Bubble rows up so Reports can export them
      onDataReady?.(data);
    } catch (error) {
      toast({
        title:       "Failed to load missing gateways",
        description: error.message,
        status:      "error",
        duration:    3000,
        isClosable:  true,
      });
    } finally {
      setLoading(false);
    }
  };

  // Triggered by parent Generate button
  useEffect(() => {
    if (triggerLoad > 0) {
      setPage(1);
      loadData(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggerLoad]);

  // Reset data when vendorReport toggles so stale rows from the other side
  // don't show under the wrong column headers before the next load fires.
  useEffect(() => {
    setRows([]);
    setSummary(DEFAULT_SUMMARY);
    setPagination(DEFAULT_PAGINATION);
    setHasAppliedFilters(false);
  }, [vendorReport]);

  // Reload when page / pageSize changes after first load
  useEffect(() => {
    if (hasAppliedFilters) loadData(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize]);

  // ── Render ─────────────────────────────────────────────────────────────────

  const emptyMessage = vendorReport
    ? "No missing vendor gateways found. All CDRs in the date range have a recognised callee (vendor) IP."
    : "No missing customer gateways found. All CDRs in the date range have a recognised caller (customer) IP.";

  return (
    <VStack spacing={4} align="stretch">

      {hasAppliedFilters && (
        <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={4}>
          {STAT_CARDS.map(({ label, getValue, color }) => (
            <SummaryStatCard key={label} label={label} value={getValue(summary)} color={color} />
          ))}
        </SimpleGrid>
      )}

      <DataTable
        columns={tableColumns}
        data={rows}
        actions={false}
        isLoading={loading}
        emptyMessage={emptyMessage}
        striped
        height="calc(100vh - 370px)"
        serverPagination
        page={pagination.page    ?? page}
        pageSize={pagination.limit ?? pageSize}
        total={pagination.total  ?? 0}
        onPageChange={setPage}
        onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
      />

    </VStack>
  );
};

export default MissingGateways;