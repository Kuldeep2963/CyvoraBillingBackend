'use strict';

import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
  forwardRef,
} from "react";
import {
  Box,
  Button,
  Badge,
  Card,
  CardBody,
  CardHeader,
  Center,
  Divider,
  Flex,
  FormControl,
  FormLabel,
  Heading,
  HStack,
  Icon,
  IconButton,
  InputGroup,
  InputLeftElement,
  InputRightElement,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  NumberIncrementStepper,
  NumberDecrementStepper,
  Progress,
  Radio,
  RadioGroup,
  SimpleGrid,
  Spinner,
  Stat,
  StatLabel,
  StatNumber,
  Table,
  Tbody,
  Text,
  Td,
  Th,
  Thead,
  Tooltip,
  Tr,
  useColorModeValue,
  VStack,
  Wrap,
  WrapItem,
} from "@chakra-ui/react";
import { MemoizedInput as Input, MemoizedSelect as Select } from "../components/memoizedinput/memoizedinput";
import PageNavBar from "../components/PageNavBar";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CalendarIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CloseIcon,
  DownloadIcon,
  InfoIcon,
  SearchIcon,
  SettingsIcon,
  StarIcon,
  WarningIcon,
} from "@chakra-ui/icons";
import {
  FiBarChart2,
  FiCalendar,
  FiClock,
  FiEye,
  FiFileText,
  FiFilter,
  FiGrid,
  FiList,
  FiRefreshCw,
  FiTrendingDown,
  FiTrendingUp,
  FiUser,
  FiX,
} from "react-icons/fi";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import {
  exportReport,
  fetchCountryCodes,
  fetchReportAccounts,
  generateReport,
} from "../utils/api";
import MissingGateways from "./missinggateways";
import useNotify from "../utils/notify";

// ─── Constants ────────────────────────────────────────────────────────────────

const REPORT_TYPES = [
  { value: "0", label: "Hourly Reports" },
  { value: "1", label: "Margin Reports" },
  { value: "2", label: "Negative Margin" },
  { value: "3", label: "Customer - Vendor Traffic" },
  { value: "4", label: "Customer Traffic" },
  { value: "5", label: "Vendor Traffic" },
  { value: "6", label: "Missing Gateways" },
];

// FIX #11: added key 6 so the title card never falls back to "Report"
const REPORT_TITLES = {
  0: "Hourly Report",
  1: "Margin Report",
  2: "Negative Margin Report",
  3: "Customer - Vendor Traffic Report",
  4: "Customer Traffic Report",
  5: "Vendor Traffic Report",
  6: "Missing Gateways Report",
};

const REPORT_TYPE_MAP = {
  0: "hourly-report",
  1: "margin-report",
  2: "negative-margin-report",
  3: "customer-traffic",
  4: "customer-only-traffic",
  5: "vendor-traffic",
};

const TRUNK_OPTIONS = [
  { value: "all",      label: "All Trunks" },
  { value: "NCLI",     label: "NCLI" },
  { value: "CLI",      label: "CLI" },
  { value: "ORTP/TDM", label: "ORTP/TDM" },
  { value: "CC",       label: "CC" },
];

const ROWS_PER_PAGE_OPTIONS = [50, 100, 250];

const pad2 = (value) => String(value).padStart(2, "0");

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, hour) => ({
  value: String(hour),
  label: `${pad2(hour)}:00`,
}));

// ─── DatePicker custom input ──────────────────────────────────────────────────

const DatePickerInput = forwardRef(({ value, onClick, size, w }, ref) => (
  <Input
    ref={ref}
    value={value}
    onClick={onClick}
    onChange={() => {}}
    size={size}
    w={w}
    readOnly
    cursor="pointer"
  />
));
DatePickerInput.displayName = "DatePickerInput";

// ─── Formatters ───────────────────────────────────────────────────────────────
// All defined outside the component — stable references, no re-creation on render.

const formatCurrency = (value, fractionDigits = 4) => {
  // FIX #9: default to 4 decimal places; callers that need rate precision pass 4
  const parsed = parseFloat(value);
  if (value === undefined || value === null || isNaN(parsed)) return "$0.00";
  return new Intl.NumberFormat("en-US", {
    style:                 "currency",
    currency:              "USD",
    minimumFractionDigits: 4,
    maximumFractionDigits: fractionDigits,
  }).format(parsed);
};

const formatCurrencyRate = (value) => formatCurrency(value, 6);

const formatNumber = (value) => {
  const parsed = parseFloat(value);
  if (value === undefined || value === null || isNaN(parsed)) return "0";
  return new Intl.NumberFormat("en-US").format(parsed);
};

// FIX #22: single canonical formatter — all table cells use this; never raw `{val}%`
const formatPercentage = (value, decimals = 3) => {
  const parsed = parseFloat(value);
  if (value === undefined || value === null || isNaN(parsed)) return "0.000%";
  return `${parsed.toFixed(decimals)}%`;
};

const formatDuration = (seconds) => {
  if (!seconds || seconds === 0) return "00:00:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
};

const formatDateAsYmd = (date) =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

const getMinimumStartDate = (endDate) => {
  const minDate = new Date(endDate);
  minDate.setHours(0, 0, 0, 0);
  minDate.setMonth(minDate.getMonth() - 2);
  return minDate;
};

const utcSelectionToBackendPayload = (date, hour, minute) => {
  if (!date) return { date: null, hour: 0, minute: 0 };
  return { date: formatDateAsYmd(date), hour, minute };
};

// ─── Shared sub-components ────────────────────────────────────────────────────

const SortIcon = ({ sortConfig, columnKey }) => {
  if (sortConfig.key !== columnKey) return null;
  return sortConfig.direction === "asc" ? <ArrowUpIcon /> : <ArrowDownIcon />;
};

const SortableTh = ({ label, sortKey, sortConfig, onSort, isNumeric }) => (
  <Th
    color="gray.800"
    isNumeric={isNumeric}
    cursor="pointer"
    onClick={() => onSort(sortKey)}
    userSelect="none"
  >
    <HStack justify={isNumeric ? "flex-end" : "flex-start"} spacing={1}>
      <Text>{label}</Text>
      <SortIcon sortConfig={sortConfig} columnKey={sortKey} />
    </HStack>
  </Th>
);

const LoadingState = () => (
  <Center py={20}>
    <VStack spacing={4}>
      <Spinner size="xl" color="blue.500" thickness="4px" />
      <VStack spacing={1}>
        <Text fontWeight="medium">Generating Report</Text>
        <Text fontSize="sm" color="gray.500">Processing your data…</Text>
      </VStack>
      <Progress size="xs" width="200px" isIndeterminate colorScheme="blue" />
    </VStack>
  </Center>
);

const EmptyState = () => (
  <VStack
    spacing={5}
    p={12}
    bg="gray.50"
    border="2px dashed"
    borderColor="gray.300"
    borderRadius="xl"
    textAlign="center"
    w="full"
  >
    <VStack spacing={2}>
      <Heading size="md" color="gray.700">No Report Data Yet</Heading>
      <Text color="gray.500" maxW="md" fontSize="sm">
        You haven't generated any reports yet. Create your first report to start
        viewing analytics and insights from your CDR data.
      </Text>
    </VStack>
  </VStack>
);

// ─── Column definitions ───────────────────────────────────────────────────────

const HOURLY_COLUMNS = [
  { label: "Hour",          key: "hour" },
  { label: "Attempts",      key: "attempts",  isNumeric: true },
  { label: "Completed",     key: "completed", isNumeric: true },
  { label: "ASR %",         key: "asr",       isNumeric: true },
  { label: "ACD (sec)",     key: "acd",       isNumeric: true },
  { label: "Duration (sec)",key: "duration",  isNumeric: true },
  { label: "Revenue",       key: "revenue",   isNumeric: true },
  { label: "Cost",          key: "cost",      isNumeric: true },
  { label: "Margin",        key: "margin",    isNumeric: true },
];

const MARGIN_COLUMNS = [
  { label: "Customer",       key: "accountName",    },
  { label: "Account Owner",  key: "accountOwner",   },
  { label: "Destination",    key: "destination",    },
  { label: "Attempts",       key: "attempts",       isNumeric: true },
  { label: "Revenue",        key: "revenue",        isNumeric: true },
  { label: "Cost",           key: "cost",           isNumeric: true },
  { label: "Margin",         key: "margin",         isNumeric: true },
  { label: "Margin %",       key: "marginPercent",  isNumeric: true },
  { label: "Duration (Sec)", key: "duration",       isNumeric: true },
];

const NEGATIVE_MARGIN_COLUMNS = [
  { label: "Account ID",    key: "accountCode",   },
  { label: "Customer",      key: "accountName",   },
  { label: "Account Owner", key: "accountOwner",  },
  { label: "Destination",   key: "destination",   },
  { label: "Attempts",      key: "attempts",      isNumeric: true },
  { label: "Revenue",       key: "revenue",       isNumeric: true },
  { label: "Cost",          key: "cost",          isNumeric: true },
  { label: "Margin",        key: "margin",        isNumeric: true },
  { label: "Margin %",      key: "marginPercent", isNumeric: true },
];

// ─── Pagination helper ────────────────────────────────────────────────────────

function buildPageNumbers(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 4) return [1, 2, 3, 4, 5, "…", total];
  if (current >= total - 3) return [1, "…", total - 4, total - 3, total - 2, total - 1, total];
  return [1, "…", current - 1, current, current + 1, "…", total];
}

// ─── Main component ───────────────────────────────────────────────────────────

const Reports = () => {

  // ── State ──────────────────────────────────────────────────────────────────

  const [dateRange, setDateRange] = useState({
    startDate:   new Date(),
    endDate:     new Date(),
    startHour:   0,
    startMinute: 0,
    endHour:     23,
    endMinute:   59,
  });
  const [activeTab,        setActiveTab]        = useState(0);
  const [selectedAccount,  setSelectedAccount]  = useState("all");
  const [accounts,         setAccounts]         = useState({ customers: [], vendors: [] });
  const [accountsLoading,  setAccountsLoading]  = useState(false);
  const [isVendorReport,   setIsVendorReport]   = useState(false);
  const [reportData,       setReportData]       = useState([]);
  const [reportSummary,    setReportSummary]    = useState({});
  const [loading,          setLoading]          = useState(false);
  const [exporting,        setExporting]        = useState(false);
  const [marginThreshold,  setMarginThreshold]  = useState(0);
  const [searchTerm,       setSearchTerm]       = useState("");
  const [sortConfig,       setSortConfig]       = useState({ key: null, direction: "asc" });
  const [page,             setPage]             = useState(1);
  const [rowsPerPage,      setRowsPerPage]      = useState(50);
  const [selectedTrunk,    setSelectedTrunk]    = useState("all");
  const [selectedOwner,    setSelectedOwner]    = useState("all");
  const [selectedCountry,  setSelectedCountry]  = useState("all");
  const [countryOptions,   setCountryOptions]   = useState([]);
  const [countryLoading,   setCountryLoading]   = useState(false);
  const [filters]                               = useState({ minASR: 0, maxASR: 100, minMargin: -100, maxMargin: 100 });

  const toast       = useNotify();
  const cardBg      = useColorModeValue("white", "gray.800");
  const borderColor = useColorModeValue("gray.200", "gray.700");
  const mutedColor  = useColorModeValue("gray.600", "gray.400");

  // FIX #1 & #4: use a ref so handleExport always reads the latest filteredData
  // without needing filteredData in its own dependency array (which would cause
  // the export callback to be re-created on every search/sort change).
  const filteredDataRef = useRef([]);

  const hasActiveFilters =
    searchTerm !== "" ||
    selectedAccount !== "all" ||
    selectedOwner !== "all" ||
    selectedCountry !== "all" ||
    selectedTrunk !== "all" ||
    isVendorReport ||
    marginThreshold !== 0 ||
    sortConfig.key !== null;

  const handleClearFilters = useCallback(() => {
    setSearchTerm("");
    setSelectedAccount("all");
    setSelectedOwner("all");
    setSelectedCountry("all");
    setSelectedTrunk("all");
    setIsVendorReport(false);
    setMarginThreshold(0);
    setSortConfig({ key: null, direction: "asc" });
    setPage(1);
  }, []);

  // ── Effects ────────────────────────────────────────────────────────────────

  useEffect(() => { loadAccounts();       }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { loadCountryOptions(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // FIX #2: replace the fragile ref-comparison pattern with a straightforward
  // dependency-array effect. Page resets whenever search term, sort config,
  // or the underlying report data changes.
  useEffect(() => { setPage(1); }, [searchTerm, sortConfig, reportData]);

  // ── Data loaders ───────────────────────────────────────────────────────────

  const loadAccounts = useCallback(async () => {
    setAccountsLoading(true);
    try {
      const data = await fetchReportAccounts();
      if (data.success) setAccounts(data);
    } catch (error) {
      toast({ title: "Error loading accounts", description: error.message, status: "error", duration: 5000, isClosable: true });
    } finally {
      setAccountsLoading(false);
    }
  }, [toast]);

  const loadCountryOptions = useCallback(async () => {
    setCountryLoading(true);
    try {
      const allRows   = [];
      let pageNumber  = 1;

      while (true) {
        const result = await fetchCountryCodes({ page: pageNumber, limit: 100 });
        allRows.push(...(result.countryCodes || []));
        if (!result.totalPages || pageNumber >= result.totalPages) break;
        pageNumber += 1;
      }

      const countryMap = new Map();
      allRows.forEach((row) => {
        const countryName = String(row.country_name || "").trim();
        if (!countryName) return;
        const key      = countryName.toLowerCase();
        const existing = countryMap.get(key) ?? { value: countryName, label: countryName, codes: new Set() };
        if (row.code) existing.codes.add(String(row.code).trim());
        countryMap.set(key, existing);
      });

      const options = Array.from(countryMap.values())
        .map((item) => ({
          value:  item.value,
          label:  item.label,
          codes:  Array.from(item.codes).sort((a, b) =>
            a.localeCompare(b, undefined, { numeric: true })
          ),
        }))
        .sort((a, b) => a.label.localeCompare(b.label));

      setCountryOptions(options);
    } catch (error) {
      toast({ title: "Error loading country list", description: error.message, status: "warning", duration: 4000, isClosable: true });
    } finally {
      setCountryLoading(false);
    }
  }, [toast]);

  // ── Date / time handlers ───────────────────────────────────────────────────

  const handleStartDateChange = useCallback(
    (date) => {
      if (!date) return;
      const minStartDate = getMinimumStartDate(dateRange.endDate);
      if (date < minStartDate) {
        toast({ title: "Invalid start date", description: "Start date cannot be more than 2 months before end date", status: "warning", duration: 3000, isClosable: true });
        setDateRange((prev) => ({ ...prev, startDate: minStartDate }));
        return;
      }
      setDateRange((prev) => ({ ...prev, startDate: date }));
    },
    [dateRange.endDate, toast],
  );

  const handleEndDateChange = useCallback((date) => {
    if (!date) return;
    const minStartDate = getMinimumStartDate(date);
    setDateRange((prev) => ({
      ...prev,
      endDate:   date,
      startDate: prev.startDate < minStartDate ? minStartDate : prev.startDate,
    }));
  }, []);

  // FIX #8: hour setters are intentionally one-directional — setStartHour only
  // clamps endHour (never startHour), and setEndHour only clamps startHour (never
  // endHour).  This prevents the two callbacks from fighting each other when
  // TimePickerButton fires both in sequence.
  const setStartHour = useCallback((hour) => {
    setDateRange((prev) => ({
      ...prev,
      startHour: hour,
      endHour:   Math.max(hour, prev.endHour),
    }));
  }, []);

  const setEndHour = useCallback((hour) => {
    setDateRange((prev) => ({
      ...prev,
      endHour:   hour,
      startHour: Math.min(hour, prev.startHour),
    }));
  }, []);

  const setStartMinute = useCallback(
    (minute) => setDateRange((prev) => ({ ...prev, startMinute: minute })),
    [],
  );

  const setEndMinute = useCallback(
    (minute) => setDateRange((prev) => ({ ...prev, endMinute: minute })),
    [],
  );

  // ── Sorting / tab handlers ─────────────────────────────────────────────────

  const handleSort = useCallback((key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  }, []);

  const handleTabChange = useCallback((index) => {
    setActiveTab(index);
    setReportData([]);
    setReportSummary({});
    setSearchTerm("");
    setSortConfig({ key: null, direction: "asc" });
    setSelectedOwner("all");
    // Tab 4 = Customer-only → force customer mode
    // Tab 5 = Vendor-only  → force vendor mode
    // All other tabs keep the user's current choice
    if (index === 4) setIsVendorReport(false);
    else if (index === 5) setIsVendorReport(true);
  }, []);

  // ── Report generation ──────────────────────────────────────────────────────

  const handleGenerateReport = useCallback(async () => {
    if (!dateRange.startDate || !dateRange.endDate) {
      toast({ title: "Date range required", description: "Please select start and end dates", status: "warning", duration: 3000, isClosable: true });
      return;
    }
    if (dateRange.endDate < dateRange.startDate) {
      toast({ title: "Invalid date range", description: "End date must be after start date", status: "warning", duration: 3000, isClosable: true });
      return;
    }
    if (dateRange.startDate < getMinimumStartDate(dateRange.endDate)) {
      toast({ title: "Invalid date range", description: "Start date cannot be more than 2 months before end date", status: "warning", duration: 3000, isClosable: true });
      return;
    }
    if (dateRange.endHour < dateRange.startHour) {
      toast({ title: "Invalid hour range", description: "End hour must be after or equal to start hour", status: "warning", duration: 3000, isClosable: true });
      return;
    }
    if (
      activeTab !== 0 &&
      dateRange.endHour === dateRange.startHour &&
      dateRange.endMinute < dateRange.startMinute
    ) {
      toast({ title: "Invalid time range", description: "End time must be after start time", status: "warning", duration: 3000, isClosable: true });
      return;
    }

    const daysDiff = Math.ceil(
      (dateRange.endDate - dateRange.startDate) / (1000 * 60 * 60 * 24)
    );
    if (daysDiff > 62) {
      toast({ title: "Large date range", description: "For better performance, please select a date range under 2 months", status: "warning", duration: 5000, isClosable: true });
    }

    setLoading(true);
    try {
      const accountsList      = isVendorReport ? accounts.vendors : accounts.customers;
      const selectedAccountObj = selectedAccount !== "all"
        ? accountsList.find((acc) =>
            (isVendorReport ? acc.vendorCode : acc.customerCode) === selectedAccount
          )
        : null;

      const startPayload = utcSelectionToBackendPayload(
        dateRange.startDate,
        dateRange.startHour,
        activeTab === 0 ? 0 : dateRange.startMinute,
      );
      const endPayload = utcSelectionToBackendPayload(
        dateRange.endDate,
        dateRange.endHour,
        activeTab === 0 ? 59 : dateRange.endMinute,
      );

      const params = {
        startDate:    startPayload.date,
        endDate:      endPayload.date,
        startHour:    startPayload.hour,
        startMinute:  startPayload.minute,
        endHour:      endPayload.hour,
        endMinute:    endPayload.minute,
        accountId:    selectedAccount,
        country:      selectedCountry,
        vendorReport: activeTab === 4 ? false : activeTab === 5 ? true : isVendorReport,
        trunk:        selectedTrunk,
        ownerName:    selectedAccountObj?.ownerName ?? "",
      };

      const result = await generateReport(REPORT_TYPE_MAP[activeTab], params);

      if (result.success || result.data) {
        let data = result.data ?? [];

        if (activeTab === 5) {
          data = data.map((r) => ({ ...r, costPerMin: r.costPerMin ?? 0 }));
        }

        setReportData(data);

        if (result.summary && !Array.isArray(result.summary)) {
          setReportSummary(result.summary);
        } else {
          const uniqueArr = (arr) => [...new Set(arr)].filter(Boolean);
          setReportSummary({
            totalAttempts:        data.reduce((s, r) => s + (r.attempts      ?? 0), 0),
            totalCompleted:       data.reduce((s, r) => s + (r.completed     ?? 0), 0),
            totalRevenue:         data.reduce((s, r) => s + (r.revenue       ?? 0), 0),
            totalCost:            data.reduce((s, r) => s + (r.cost          ?? 0), 0),
            totalMargin:          data.reduce((s, r) => s + (r.margin        ?? 0), 0),
            avgASR:               data.length > 0
                                    ? data.reduce((s, r) => s + (r.asr ?? 0), 0) / data.length
                                    : 0,
            avgMarginPercent:     data.length > 0
                                    ? data.reduce((s, r) => s + (r.marginPercent ?? 0), 0) / data.length
                                    : 0,
            totalCustomers:       uniqueArr(data.map((r) => r.customer ?? r.accountName)).length,
            totalVendors:         uniqueArr(data.map((r) => r.vendor   ?? r.vendAccountCode)).length,
            negativeMarginCalls:  data.filter((r) => (r.margin ?? 0) < 0).length,
            totalLoss:            data.filter((r) => (r.margin ?? 0) < 0)
                                    .reduce((s, r) => s + r.margin, 0),
            affectedCustomers:    uniqueArr(
                                    data
                                      .filter((r) => (r.margin ?? 0) < 0)
                                      .map((r) => r.customer ?? r.accountName ?? r.accountCode)
                                  ).length,
            affectedDestinations: uniqueArr(
                                    data
                                      .filter((r) => (r.margin ?? 0) < 0)
                                      .map((r) => r.destination)
                                  ).length,
          });
        }

        toast({
          title:       "Report Generated Successfully",
          description: `${data.length} records processed`,
          status:      "success",
          duration:    3000,
          isClosable:  true,
          position:    "top-right",
        });
      } else {
        throw new Error(result.error ?? "Failed to generate report");
      }
    } catch (error) {
      console.error("Report generation error:", error);
      toast({
        title:       "Error generating report",
        description: error.message,
        status:      "error",
        duration:    5000,
        isClosable:  true,
        position:    "top-right",
      });
    } finally {
      setLoading(false);
    }
  }, [activeTab, accounts, dateRange, isVendorReport, selectedAccount, selectedCountry, selectedTrunk, toast]);

  // FIX #1 & #4: reads filteredDataRef.current so it always gets the latest
  // filtered/sorted data without filteredData appearing in the dependency array
  // (which would cause the callback to be re-created on every keystroke).
  const handleExport = useCallback(async (format) => {
    const data = filteredDataRef.current;
    if (!data.length) {
      toast({ title: "No data to export", description: "Please generate a report first", status: "warning", duration: 3000, isClosable: true });
      return;
    }
    setExporting(true);
    try {
      const fileName = `report_${Date.now()}_${formatDateAsYmd(dateRange.startDate)}_to_${formatDateAsYmd(dateRange.endDate)}`;

      // build meta information for header/footer in exported file
      const accountsList = isVendorReport ? accounts.vendors : accounts.customers;
      const selectedAccountObj = selectedAccount !== "all"
        ? accountsList.find((acc) => (isVendorReport ? acc.vendorCode : acc.customerCode) === selectedAccount)
        : null;

      const meta = {
        title: REPORT_TITLES[activeTab] ?? "Report",
        startDate: formatDateAsYmd(dateRange.startDate),
        endDate: formatDateAsYmd(dateRange.endDate),
        periodLabel: `${dateRange.startDate.toLocaleDateString()} - ${dateRange.endDate.toLocaleDateString()}`,
        account: selectedAccountObj ? selectedAccountObj.accountName : 'All Accounts',
        accountCode: selectedAccountObj ? (isVendorReport ? selectedAccountObj.vendorCode : selectedAccountObj.customerCode) : 'all',
        trunk: selectedTrunk,
        generatedAt: new Date().toISOString(),
        summary: reportSummary,
        totalRecords: data.length,
      };

      await exportReport(data, format, fileName, meta);
      toast({ title: "Export Complete", description: `Exported as ${format.toUpperCase()}`, status: "success", duration: 3000, isClosable: true });
    } catch (error) {
      toast({ title: "Export Failed", description: error.message, status: "error", duration: 5000, isClosable: true });
    } finally {
      setExporting(false);
    }
  }, [dateRange.endDate, dateRange.startDate, toast]);

  // ── Derived data ───────────────────────────────────────────────────────────

  const filteredData = useMemo(() => {
    let data = [...reportData];

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      data = data.filter((row) =>
        Object.values(row).some(
          (v) => v != null && v.toString().toLowerCase().includes(term),
        ),
      );
    }

    // FIX #BUG-original: normalise field name variants before comparing
    data = data.filter((row) => {
      const asr    = parseFloat(row.asr    ?? row.ASR           ?? 0);
      const margin = parseFloat(row.marginPercent ?? row.MarginPercent ?? 0);
      return (
        asr    >= filters.minASR    &&
        asr    <= filters.maxASR    &&
        margin >= filters.minMargin &&
        margin <= filters.maxMargin
      );
    });

    if (sortConfig.key) {
      data.sort((a, b) => {
        const av  = a[sortConfig.key];
        const bv  = b[sortConfig.key];
        const an  = parseFloat(av);
        const bn  = parseFloat(bv);
        const num = !isNaN(an) && !isNaN(bn);
        if (num ? an < bn : av < bv) return sortConfig.direction === "asc" ? -1 : 1;
        if (num ? an > bn : av > bv) return sortConfig.direction === "asc" ?  1 : -1;
        return 0;
      });
    }

    // FIX #1/#4: keep ref in sync so handleExport always reads current value
    filteredDataRef.current = data;
    return data;
  }, [reportData, searchTerm, sortConfig, filters]);

  const paginatedData = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    return filteredData.slice(start, start + rowsPerPage);
  }, [filteredData, page, rowsPerPage]);

  const totalPages = Math.ceil(filteredData.length / rowsPerPage);

  const dashboardMetrics = useMemo(() => {
    if (!reportData.length) return null;

    const customerMap    = {};
    const destinationMap = {};
    let   totalRevenue = 0, totalCost = 0, totalCalls = 0,
          totalMargin = 0, sumASR = 0, sumACD = 0;

    for (const row of reportData) {
      totalRevenue += parseFloat(row.revenue      ?? row.Revenue      ?? row.TotalRevenue ?? 0);
      totalCost    += parseFloat(row.cost         ?? row.Cost         ?? 0);
      totalCalls   += parseInt(  row.attempts     ?? row.Attempts     ?? row.TotalCalls   ?? 0);
      totalMargin  += parseFloat(row.margin       ?? row.Margin       ?? row.TotalMargin  ?? 0);
      sumASR       += parseFloat(row.asr          ?? row.ASR          ?? 0);
      sumACD       += parseFloat(row.acd          ?? row.ACD          ?? 0);

      const customer    = row.customer    ?? row.Customer    ?? row.accountName ?? row.customername;
      if (customer) customerMap[customer] = (customerMap[customer] ?? 0) + parseFloat(row.revenue ?? row.Revenue ?? 0);

      const destination = row.destination ?? row.Destination ?? row.custDestination ?? row.calleeareacode;
      if (destination) destinationMap[destination] = (destinationMap[destination] ?? 0) + parseInt(row.attempts ?? row.Attempts ?? 0);
    }

    const n = reportData.length;
    return {
      totalRevenue,
      totalCost,
      totalCalls,
      totalMargin,
      avgASR:   n > 0 ? sumASR / n : 0,
      avgACD:   n > 0 ? sumACD / n : 0,
      topCustomers: Object.entries(customerMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, revenue]) => ({ name, revenue })),
      topDestinations: Object.entries(destinationMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, calls]) => ({ name, calls })),
    };
  }, [reportData]);

  // ── Summary card config ────────────────────────────────────────────────────

  const summaryConfig = useMemo(() => ({
    0: [
      { label: "Total Attempts",  value: reportSummary.totalAttempts?.toLocaleString()  ?? "0", icon: FiBarChart2,    color: "blue"   },
      { label: "Completed Calls", value: reportSummary.totalCompleted?.toLocaleString() ?? "0", icon: CheckCircleIcon, color: "green"  },
      { label: "Total Revenue",   value: formatCurrency(reportSummary.totalRevenue      ?? 0),  icon: FiTrendingUp,   color: "green"  },
      { label: "Avg ASR",         value: formatPercentage(reportSummary.avgASR          ?? 0, 2), icon: StarIcon,       color: "yellow" },
    ],
    1: [
      { label: "Total Revenue",   value: formatCurrency(reportSummary.totalRevenue      ?? 0), icon: FiTrendingUp,   color: "green"  },
      { label: "Total Cost",      value: formatCurrency(reportSummary.totalCost         ?? 0), icon: FiTrendingDown, color: "red"    },
      { label: "Total Margin",    value: formatCurrency(reportSummary.totalMargin       ?? 0), icon: FiBarChart2,    color: "blue"   },
      { label: "Avg Margin %",    value: formatPercentage(reportSummary.avgMarginPercent ?? 0, 2), icon: StarIcon,   color: "purple" },
    ],
    2: [
      { label: "Total Loss",          value: formatCurrency(Math.abs(reportSummary.totalLoss             ?? 0)), icon: WarningIcon,    color: "red"    },
      { label: "Negative Calls",      value: reportSummary.negativeMarginCalls?.toLocaleString()          ?? "0",  icon: CloseIcon,      color: "orange" },
      { label: "Affected Customers",  value: reportSummary.affectedCustomers?.toLocaleString()            ?? "0",  icon: InfoIcon,       color: "yellow" },
      { label: "Destinations",        value: reportSummary.affectedDestinations?.toLocaleString()         ?? "0",  icon: FiGrid,         color: "cyan"   },
    ],
    3: [
      { label: "Total Customers", value: reportSummary.totalCustomers?.toLocaleString() ?? "0", icon: FiList,        color: "blue"   },
      { label: "Total Attempts",  value: reportSummary.totalAttempts?.toLocaleString()  ?? "0", icon: FiBarChart2,   color: "green"  },
      { label: "Total Revenue",   value: formatCurrency(reportSummary.totalRevenue      ?? 0),  icon: FiTrendingUp,  color: "purple" },
      { label: "Total Cost",      value: formatCurrency(reportSummary.totalCost         ?? 0),  icon: FiTrendingDown,color: "red"    },
    ],
    4: [
      { label: "Total Customers", value: String(reportSummary.totalCustomers            ?? 0),  icon: FiGrid,        color: "purple" },
      { label: "Total Attempts",  value: reportSummary.totalAttempts?.toLocaleString()  ?? "0", icon: FiBarChart2,   color: "blue"   },
      { label: "Total Revenue",   value: formatCurrency(reportSummary.totalRevenue      ?? 0),  icon: FiTrendingUp,  color: "green"  },
      { label: "Avg ASR",         value: formatPercentage(reportSummary.avgASR          ?? 0, 2), icon: StarIcon,    color: "yellow" },
    ],
    5: [
      { label: "Total Vendors",   value: String(reportSummary.totalVendors              ?? 0),  icon: FiGrid,        color: "purple" },
      { label: "Total Attempts",  value: reportSummary.totalAttempts?.toLocaleString()  ?? "0", icon: FiBarChart2,   color: "blue"   },
      { label: "Total Revenue",   value: formatCurrency(reportSummary.totalRevenue      ?? 0),  icon: FiTrendingUp,  color: "green"  },
      { label: "Total Cost",      value: formatCurrency(reportSummary.totalCost         ?? 0),  icon: FiTrendingDown,color: "red"    },
    ],
  }), [reportSummary]);

  // ── Account lists ──────────────────────────────────────────────────────────

  const currentAccounts = isVendorReport ? accounts.vendors : accounts.customers;

  const ownerOptions = useMemo(() => {
    const uniqueOwners = [
      ...new Set(
        currentAccounts
          .map((a) => String(a.ownerName || "").trim())
          .filter(Boolean),
      ),
    ].sort((a, b) => a.localeCompare(b));

    return [
      { value: "all", label: "All Owners" },
      ...uniqueOwners.map((o) => ({ value: o, label: o })),
    ];
  }, [currentAccounts]);

  const ownerFilteredAccounts = useMemo(() =>
    currentAccounts
      .filter((a) => selectedOwner === "all" || String(a.ownerName || "").trim() === selectedOwner)
      .sort((a, b) => {
        const ownerCompare = String(a.ownerName || "").localeCompare(String(b.ownerName || ""));
        return ownerCompare !== 0
          ? ownerCompare
          : String(a.accountName || "").localeCompare(String(b.accountName || ""));
      }),
  [currentAccounts, selectedOwner]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Box>
      <PageNavBar
        title="CDR Analytics Reports"
        description="Generate detailed reports and insights from CDR data"
        rightContent={
          <>
            <Menu>
              <MenuButton
                as={Button}
                size="sm"
                rightIcon={<ChevronDownIcon />}
                colorScheme="green"
                isLoading={exporting}
                isDisabled={!filteredData.length}
              >
                <DownloadIcon mr={2} />Export
              </MenuButton>
              <MenuList>
                <MenuItem icon={<DownloadIcon />} onClick={() => handleExport("csv")}>Export as CSV</MenuItem>
                <MenuItem icon={<DownloadIcon />} onClick={() => handleExport("excel")}>Export as Excel</MenuItem>
                <Divider />
                <MenuItem icon={<SettingsIcon />} onClick={() => window.print()}>Print Report</MenuItem>
              </MenuList>
            </Menu>
          </>
        }
      />

      <Box mt={6} px={2}>
        {/* ── Report type selector + date controls ─────────────────────── */}
        <Flex
          direction={{ base: "column", lg: "row" }}
          gap={4}
          align={{ base: "stretch", lg: "flex-end" }}
        >
          <FormControl maxW={{ base: "100%", md: "320px" }}>
            <FormLabel fontSize="sm" mb={2}>Select Report Type</FormLabel>
            <Select
              size="sm"
              value={activeTab.toString()}
              onChange={(e) => handleTabChange(parseInt(e.target.value, 10))}
            >
              {REPORT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </Select>
          </FormControl>

          {activeTab !== 6 && (
            <Wrap spacing={4} justify="flex-start" align="flex-end">
              {/* Start date */}
              <WrapItem>
                <Box>
                  <FormLabel fontSize="sm" display="flex" alignItems="center" gap={2} mb={2}>
                    <FiCalendar />Start Date
                  </FormLabel>
                  <DatePicker
                    selected={dateRange.startDate}
                    onChange={handleStartDateChange}
                    selectsStart
                    startDate={dateRange.startDate}
                    endDate={dateRange.endDate}
                    minDate={getMinimumStartDate(dateRange.endDate)}
                    maxDate={dateRange.endDate}
                    dateFormat="dd-MM-yyyy"
                    customInput={<DatePickerInput size="sm" w="130px" />}
                  />
                </Box>
              </WrapItem>

              {/* End date */}
              <WrapItem>
                <Box>
                  <FormLabel fontSize="sm" display="flex" alignItems="center" gap={2} mb={2}>
                    <FiCalendar />End Date
                  </FormLabel>
                  <DatePicker
                    selected={dateRange.endDate}
                    onChange={handleEndDateChange}
                    selectsEnd
                    startDate={dateRange.startDate}
                    endDate={dateRange.endDate}
                    minDate={dateRange.startDate}
                    dateFormat="dd-MM-yyyy"
                    customInput={<DatePickerInput size="sm" w="130px" />}
                  />
                </Box>
              </WrapItem>

              {/* Time pickers — hour-only for Hourly report, full time for rest */}
              {activeTab === 0 ? (
                <>
                  <HourPickerButton label="From (UTC)" hour={dateRange.startHour} onHourChange={setStartHour} />
                  <HourPickerButton label="To (UTC)"   hour={dateRange.endHour}   onHourChange={setEndHour} />
                </>
              ) : (
                <>
                  <TimePickerButton label="From Time (UTC)" hour={dateRange.startHour} minute={dateRange.startMinute} onHourChange={setStartHour} onMinuteChange={setStartMinute} />
                  <TimePickerButton label="To Time (UTC)"   hour={dateRange.endHour}   minute={dateRange.endMinute}   onHourChange={setEndHour}   onMinuteChange={setEndMinute} />
                </>
              )}
            </Wrap>
          )}
        </Flex>

        {activeTab !== 6 ? (
          <>
            {/* ── Filters + generate button ─────────────────────────────── */}
            {/* FIX #14: pass only startDate/endDate — not the whole dateRange object */}
            <ReportControls
              activeTab={activeTab}
              isVendorReport={isVendorReport}
              setIsVendorReport={setIsVendorReport}
              selectedAccount={selectedAccount}
              setSelectedAccount={setSelectedAccount}
              selectedOwner={selectedOwner}
              setSelectedOwner={setSelectedOwner}
              ownerOptions={ownerOptions}
              selectedCountry={selectedCountry}
              setSelectedCountry={setSelectedCountry}
              countryOptions={countryOptions}
              countryLoading={countryLoading}
              selectedTrunk={selectedTrunk}
              setSelectedTrunk={setSelectedTrunk}
              accounts={ownerFilteredAccounts}
              accountsLoading={accountsLoading}
              marginThreshold={marginThreshold}
              setMarginThreshold={setMarginThreshold}
              hasActiveFilters={hasActiveFilters}
              onClearFilters={handleClearFilters}
              loading={loading}
              startDate={dateRange.startDate}
              endDate={dateRange.endDate}
              onGenerate={handleGenerateReport}
              cardBg={cardBg}
            />

            {/* ── Dashboard overview ────────────────────────────────────── */}
            {dashboardMetrics && (
              <DashboardMetrics
                metrics={dashboardMetrics}
                cardBg={cardBg}
                borderColor={borderColor}
                mutedColor={mutedColor}
              />
            )}

            {/* ── Summary stat cards ────────────────────────────────────── */}
            {reportSummary && Object.keys(reportSummary).length > 0 && summaryConfig[activeTab] && (
              <ReportSummaryCards
                stats={summaryConfig[activeTab]}
                cardBg={cardBg}
                borderColor={borderColor}
                mutedColor={mutedColor}
              />
            )}

            {/* ── Data table ────────────────────────────────────────────── */}
            <Card bg={cardBg} border="1px" borderColor={borderColor}>
              <CardHeader>
                <Flex
                  justify="space-between"
                  align={{ base: "stretch", md: "center" }}
                  gap={4}
                  direction={{ base: "column", md: "row" }}
                >
                  <VStack align="start" spacing={1}>
                    {/* FIX #11: REPORT_TITLES now has key 6; this never falls back */}
                    <Heading size="md">{REPORT_TITLES[activeTab] ?? "Report"}</Heading>
                    <Text fontSize="sm" color={mutedColor}>
                      Generated on {new Date().toLocaleDateString()} | Data range:{" "}
                      {dateRange.startDate.toLocaleDateString()} to {dateRange.endDate.toLocaleDateString()}
                    </Text>
                    <Badge
                      colorScheme={selectedTrunk === "all" ? "gray" : "blue"}
                       borderRadius="full"
            px="8px"
            py="2px"
            fontWeight="500"
            fontSize="11px"
                    >
                      Trunk: {selectedTrunk === "all" ? "All Trunks" : selectedTrunk}
                    </Badge>
                  </VStack>

                  <HStack spacing={3} align="center" justify={{ base: "flex-start", md: "flex-end" }}>
                    <InputGroup size="sm" w={{ base: "full", sm: "280px" }}>
                      <InputLeftElement pointerEvents="none">
                        <SearchIcon color="gray.500" />
                      </InputLeftElement>
                      <Input
                        pl={9}
                        placeholder="Search in report…"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </InputGroup>
                    <Badge colorScheme="yellow" fontSize="xs"  borderRadius="full"
            px="8px"
            py="2px"
            fontWeight="500"
            fontSize="11px" whiteSpace="nowrap">
                      {filteredData.length} records
                    </Badge>
                  </HStack>
                </Flex>
              </CardHeader>

              <CardBody overflowX="auto">
                {loading ? (
                  <LoadingState />
                ) : !reportData.length ? (
                  <EmptyState />
                ) : (
                  <ReportTable
                    activeTab={activeTab}
                    paginatedData={paginatedData}
                    filteredData={filteredData}
                    sortConfig={sortConfig}
                    onSort={handleSort}
                    isVendorReport={isVendorReport}
                    page={page}
                    setPage={setPage}
                    totalPages={totalPages}
                    rowsPerPage={rowsPerPage}
                    setRowsPerPage={setRowsPerPage}
                    borderColor={borderColor}
                    mutedColor={mutedColor}
                  />
                )}
              </CardBody>
            </Card>
          </>
        ) : (
          <MissingGateways />
        )}
      </Box>
    </Box>
  );
};

// ─── ReportControls ───────────────────────────────────────────────────────────
// FIX #14: receives startDate/endDate directly instead of the full dateRange
// object, so hour/minute changes don't trigger needless re-renders of this subtree.

const ReportControls = React.memo(({
  activeTab, isVendorReport, setIsVendorReport,
  selectedAccount, setSelectedAccount,
  selectedOwner, setSelectedOwner, ownerOptions,
  selectedCountry, setSelectedCountry, countryOptions, countryLoading,
  selectedTrunk, setSelectedTrunk,
  accounts, accountsLoading,
  marginThreshold, setMarginThreshold,
  loading, startDate, endDate, onGenerate, onClearFilters, hasActiveFilters, cardBg,
}) => (
  <Box mb={4} p={4} bg={cardBg} shadow="sm" borderRadius="md">
    <VStack spacing={6} align="stretch">
      <Flex direction={{ base: "column", lg: "row" }} gap={6} align={{ base: "stretch", lg: "flex-end" }}>

        {/* Report side (Customer / Vendor) — only for tabs that support the toggle */}
        {[0, 1, 3].includes(activeTab) && (
          <FormControl>
            <FormLabel display="flex" alignItems="center" gap={2}>
              <FiFileText />Report Side
            </FormLabel>
            <RadioGroup
              value={isVendorReport ? "vendor" : "customer"}
              onChange={(val) => {
                setIsVendorReport(val === "vendor");
                setSelectedOwner("all");
                setSelectedAccount("all");
              }}
            >
              <HStack spacing={6}>
                <Radio value="customer">Customer</Radio>
                <Radio value="vendor">Vendor</Radio>
              </HStack>
            </RadioGroup>
          </FormControl>
        )}

        {/* Account Owner filter */}
        <FormControl maxW={{ base: "100%", lg: "220px" }}>
          <FormLabel>Account Owner</FormLabel>
          <Select
            size="sm"
            value={selectedOwner}
            onChange={(e) => {
              setSelectedOwner(e.target.value);
              setSelectedAccount("all");
            }}
            isDisabled={accountsLoading}
          >
            {ownerOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Select>
        </FormControl>

        {/* Account selector */}
        {/* FIX #5: use customerCode/vendorCode as key — id/_id can be undefined */}
        <FormControl>
          <FormLabel display="flex" alignItems="center" gap={2}>
            <FiUser />{isVendorReport ? "Vendor Account" : "Customer Account"}
          </FormLabel>
          <Select
            size="sm"
            value={selectedAccount}
            onChange={(e) => setSelectedAccount(e.target.value)}
            isDisabled={accountsLoading}
            placeholder={accountsLoading ? "Loading accounts…" : undefined}
          >
            <option value="all">All Accounts</option>
            {accounts.map((account) => {
              const code = isVendorReport ? account.vendorCode : account.customerCode;
              return (
                <option key={code} value={code}>
                  {account.accountName} ({code})
                </option>
              );
            })}
          </Select>
        </FormControl>

        {/* Trunk */}
        <FormControl maxW={{ base: "100%", lg: "180px" }}>
          <FormLabel>Trunk</FormLabel>
          <Select
            size="sm"
            value={selectedTrunk}
            onChange={(e) => setSelectedTrunk(e.target.value)}
            isDisabled={loading}
          >
            {TRUNK_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Select>
        </FormControl>

        {/* Country search */}
        <CountrySearchSelect
          label="Country"
          value={selectedCountry}
          options={countryOptions}
          onChange={setSelectedCountry}
          placeholder={countryLoading ? "Loading countries…" : "All Countries"}
          loading={countryLoading || loading}
        />

        {/* Negative margin threshold (tab 2 only) */}
        {activeTab === 2 && (
          <FormControl>
            <FormLabel fontWeight="medium" display="flex" alignItems="center" gap={2}>
              <FiTrendingDown />Negative Margin Threshold
            </FormLabel>
            <NumberInput
              value={marginThreshold}
              onChange={(val) => setMarginThreshold(val)}
              precision={2}
              step={0.1}
              min={-100}
              max={0}
              width="150px"
            >
              <NumberInputField />
              <NumberInputStepper>
                <NumberIncrementStepper />
                <NumberDecrementStepper />
              </NumberInputStepper>
            </NumberInput>
          </FormControl>
        )}

        <Button
          alignSelf={{ base: "stretch", lg: "flex-end" }}
          minW={{ base: "100%", lg: "180px" }}
          size="sm"
          leftIcon={<CalendarIcon />}
          colorScheme="green"
          onClick={onGenerate}
          isDisabled={loading || accountsLoading || !startDate || !endDate}
          isLoading={loading}
          loadingText="Generating"
        >
          Generate Report
        </Button>

        <Button
          alignSelf={{ base: "stretch", lg: "flex-end" }}
          minW={{ base: "100%", lg: "180px" }}
          size="sm"
          leftIcon={<FiX />}
          colorScheme="red"
          variant="outline"
          onClick={onClearFilters}
          isDisabled={!hasActiveFilters}
        >
          Clear Filters
        </Button>
      </Flex>
    </VStack>
  </Box>
));
ReportControls.displayName = "ReportControls";

// ─── DashboardMetrics ─────────────────────────────────────────────────────────

const DashboardMetrics = React.memo(({ metrics, cardBg, borderColor, mutedColor }) => {
  // FIX #12: guard against division by zero producing Infinity/NaN
  const marginPct = metrics.totalRevenue > 0
    ? ((metrics.totalMargin / metrics.totalRevenue) * 100).toFixed(6)
    : "0.000000";

  return (
    <Box p={4} bg={cardBg} border="1px" borderColor={borderColor} borderRadius="md" shadow="lg" mb={2}>
      <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={6}>
        <Box>
          <Text fontSize="sm" color={mutedColor}>Profit Margin</Text>
          <Heading size="md" color={metrics.totalMargin >= 0 ? "green.600" : "red.500"}>
            {formatCurrency(metrics.totalMargin)}
          </Heading>
          <Text fontSize="xs">{marginPct}% margin</Text>
        </Box>
        <Box>
          <Text fontSize="sm" color={mutedColor}>Call Success Rate</Text>
          <Heading size="md">{formatPercentage(metrics.avgASR)}</Heading>
          <Progress value={metrics.avgASR} colorScheme="green" size="sm" mt={1} />
        </Box>
        <Box>
          <Text fontSize="sm" color={mutedColor}>Avg Call Duration</Text>
          <Heading size="md">{formatDuration(metrics.avgACD)}</Heading>
          <Text fontSize="xs">per call</Text>
        </Box>
        <Box>
          <Text fontSize="sm" color={mutedColor}>Total Calls</Text>
          <Heading size="md">{formatNumber(metrics.totalCalls)}</Heading>
          <Text fontSize="xs">in selected period</Text>
        </Box>
      </SimpleGrid>
    </Box>
  );
});
DashboardMetrics.displayName = "DashboardMetrics";

// ─── ReportSummaryCards ────────────────────────────────────────────────────────

const ReportSummaryCards = React.memo(({ stats, cardBg, borderColor, mutedColor }) => (
  <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={4} mb={4}>
    {/* FIX #15: use stat.label as key — stable and semantically meaningful */}
    {stats.map((stat) => (
      <Card
        key={stat.label}
        bg={cardBg}
        border="1px"
        borderColor={borderColor}
        _hover={{ transform: "translateY(-2px)", boxShadow: "lg" }}
        transition="all 0.2s"
      >
        <CardBody>
          <HStack justify="space-between" mb={2}>
            <Box p={2} bg={`${stat.color}.100`} borderRadius="md">
              <Icon as={stat.icon} color={`${stat.color}.500`} boxSize={5} />
            </Box>
            <Stat>
              <StatLabel color={mutedColor} fontSize="sm">{stat.label}</StatLabel>
              <StatNumber fontSize="xl" color={`${stat.color}.500`}>{stat.value}</StatNumber>
            </Stat>
          </HStack>
        </CardBody>
      </Card>
    ))}
  </SimpleGrid>
));
ReportSummaryCards.displayName = "ReportSummaryCards";

// ─── TimePickerButton ─────────────────────────────────────────────────────────

const TimePickerButton = React.memo(({ label, hour, minute, onHourChange, onMinuteChange }) => (
  <WrapItem>
    <Box>
      <FormLabel fontSize="sm" display="flex" alignItems="center" gap={2} mb={2}>
        <FiClock />{label}
      </FormLabel>
      <InputGroup w="170px">
        <InputLeftElement pointerEvents="none" color="gray.500" />
        <Input
          type="time"
          value={`${pad2(hour)}:${pad2(minute)}`}
          step={60}
          size="sm"
          pl={9}
          bg="white"
          borderColor="gray.300"
          _hover={{ borderColor: "blue.400" }}
          _focus={{ borderColor: "blue.500", boxShadow: "0 0 0 1px var(--chakra-colors-blue-500)" }}
          onChange={(e) => {
            const [nextHour, nextMinute] = (e.target.value || "")
              .split(":")
              .map((v) => Number(v));
            if (!Number.isInteger(nextHour)   || !Number.isInteger(nextMinute))  return;
            if (nextHour < 0 || nextHour > 23 || nextMinute < 0 || nextMinute > 59) return;
            // FIX #8: call both change handlers with the same values; the parent's
            // hour setters (setStartHour / setEndHour) handle clamping independently.
            onHourChange(nextHour);
            onMinuteChange(nextMinute);
          }}
        />
      </InputGroup>
    </Box>
  </WrapItem>
));
TimePickerButton.displayName = "TimePickerButton";

const HourPickerButton = React.memo(({ label, hour, onHourChange }) => (
  <WrapItem>
    <Box>
      <FormLabel fontSize="sm" display="flex" alignItems="center" gap={2} mb={2}>
        <FiClock />{label}
      </FormLabel>
      <Box w="120px">
        <Select
          size="xs"
          value={String(hour)}
          onChange={(e) => {
            const nextHour = Number(e.target.value);
            if (!Number.isInteger(nextHour) || nextHour < 0 || nextHour > 23) return;
            onHourChange(nextHour);
          }}
          options={HOUR_OPTIONS}
        />
      </Box>
    </Box>
  </WrapItem>
));
HourPickerButton.displayName = "HourPickerButton";

// ─── CountrySearchSelect ──────────────────────────────────────────────────────

const CountrySearchSelect = React.memo(
  ({
    label,
    value,
    options,
    onChange,
    placeholder = "Search country...",
    loading = false,
  }) => {
    const wrapperRef = useRef(null);
    const listRef = useRef(null);

    const [query, setQuery] = useState("");
    const [isOpen, setIsOpen] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(0);

    const selectedOption = useMemo(
      () =>
        options.find((option) => option.value === value) || null,
      [options, value]
    );

    useEffect(() => {
      if (!isOpen) {
        setQuery(selectedOption?.label || "");
      }
    }, [selectedOption, isOpen]);

    useEffect(() => {
      const handleOutsideClick = (event) => {
        if (
          wrapperRef.current &&
          !wrapperRef.current.contains(event.target)
        ) {
          setIsOpen(false);
        }
      };

      document.addEventListener("mousedown", handleOutsideClick);

      return () => {
        document.removeEventListener(
          "mousedown",
          handleOutsideClick
        );
      };
    }, []);

    const filteredOptions = useMemo(() => {
      const searchTerm = query.trim().toLowerCase();

      const allOptions = [
        {
          value: "all",
          label: "All Countries",
          codes: [],
        },
        ...options,
      ];

      if (!searchTerm) return allOptions;

      return allOptions.filter((option) => {
        const searchableText = `
          ${option.label}
          ${(option.codes || []).join(" ")}
        `.toLowerCase();

        return searchableText.includes(searchTerm);
      });
    }, [options, query]);

    useEffect(() => {
      if (!isOpen) return;

      const selectedIndex = filteredOptions.findIndex(
        (option) => option.value === value
      );

      if (selectedIndex >= 0) {
        setHighlightedIndex(selectedIndex);

        setTimeout(() => {
          const element = document.getElementById(
            `country-option-${selectedIndex}`
          );

          element?.scrollIntoView({
            block: "nearest",
          });
        }, 0);
      }
    }, [isOpen, value, filteredOptions]);

    const handleSelect = (option) => {
      onChange(option.value);

      setQuery(
        option.value === "all"
          ? ""
          : option.label
      );

      setIsOpen(false);
    };

    const handleKeyDown = (event) => {
      if (!isOpen) return;

      switch (event.key) {
        case "ArrowDown":
          event.preventDefault();
          setHighlightedIndex((prev) =>
            Math.min(
              prev + 1,
              filteredOptions.length - 1
            )
          );
          break;

        case "ArrowUp":
          event.preventDefault();
          setHighlightedIndex((prev) =>
            Math.max(prev - 1, 0)
          );
          break;

        case "Enter":
          event.preventDefault();

          if (filteredOptions[highlightedIndex]) {
            handleSelect(
              filteredOptions[highlightedIndex]
            );
          }
          break;

        case "Escape":
          setIsOpen(false);
          break;

        default:
          break;
      }
    };

    return (
      <FormControl maxW={{ base: "100%", lg: "260px" }}>
        <FormLabel>{label}</FormLabel>

        <Box
          ref={wrapperRef}
          position="relative"
        >
          <InputGroup size="sm">
            <Input
              value={query}
              placeholder={placeholder}
              disabled={loading}
              onFocus={() => setIsOpen(true)}
              onClick={() => setIsOpen(true)}
              onKeyDown={handleKeyDown}
              onChange={(event) => {
                const nextValue =
                  event.target.value;

                setQuery(nextValue);
                setIsOpen(true);

                if (!nextValue.trim()) {
                  onChange("all");
                }
              }}
            />

            <InputRightElement>
              {loading ? (
                <Spinner size="xs" />
              ) : query ? (
                <IconButton
                  icon={<FiX />}
                  size="xs"
                  variant="ghost"
                  aria-label="Clear"
                  onClick={() => {
                    setQuery("");
                    onChange("all");
                    setIsOpen(false);
                  }}
                />
              ) : null}
            </InputRightElement>
          </InputGroup>

          {isOpen && (
            <Box
              ref={listRef}
              position="absolute"
              top="calc(100% + 6px)"
              left={0}
              right={0}
              zIndex={999}
              bg="white"
              borderWidth="1px"
              borderColor="gray.200"
              borderRadius="md"
              boxShadow="xl"
              maxH="280px"
              overflowY="auto"
            >
              {filteredOptions.length > 0 ? (
                filteredOptions.map(
                  (option, index) => {
                    const isSelected =
                      option.value === value;

                    const isHighlighted =
                      index === highlightedIndex;

                    return (
                      <Box
                        id={`country-option-${index}`}
                        key={option.value}
                        px={3}
                        py={2}
                        cursor="pointer"
                        bg={
                          isHighlighted
                            ? "gray.100"
                            : isSelected
                            ? "blue.50"
                            : "transparent"
                        }
                        _hover={{
                          bg: "gray.100",
                        }}
                        onMouseEnter={() =>
                          setHighlightedIndex(
                            index
                          )
                        }
                        onClick={() =>
                          handleSelect(option)
                        }
                      >
                        <VStack
                          spacing={0}
                          align="start"
                        >
                          <Text
                            fontSize="sm"
                            fontWeight={
                              isSelected
                                ? "700"
                                : "500"
                            }
                          >
                            {option.label}
                          </Text>

                          {option.codes?.length >
                            0 &&
                            option.value !==
                              "all" && (
                              <Text
                                fontSize="xs"
                                color="gray.500"
                              >
                                {option.codes.join(
                                  ", "
                                )}
                              </Text>
                            )}
                        </VStack>
                      </Box>
                    );
                  }
                )
              ) : (
                <Box px={3} py={3}>
                  <Text
                    fontSize="sm"
                    color="gray.500"
                  >
                    No matching countries
                  </Text>
                </Box>
              )}
            </Box>
          )}
        </Box>
      </FormControl>
    );
  }
);

CountrySearchSelect.displayName =
  "CountrySearchSelect";


// ─── ReportTable ──────────────────────────────────────────────────────────────

const ReportTable = React.memo(({
  activeTab, paginatedData, filteredData, sortConfig, onSort,
  isVendorReport, page, setPage, totalPages, rowsPerPage, setRowsPerPage,
  borderColor, mutedColor,
}) => {
  const tableBody = useMemo(() => {
    switch (activeTab) {
      case 0: return <HourlyTableBody            rows={paginatedData} />;
      case 1: return <MarginTableBody            rows={paginatedData} />;
      case 2: return <NegativeMarginTableBody    rows={paginatedData} />;
      case 3: return <CustomerVendorTableBody    rows={paginatedData} isVendorReport={isVendorReport} />;
      case 4: return <CustomerOnlyTableBody      rows={paginatedData} />;
      case 5: return <VendorOnlyTableBody        rows={paginatedData} />;
      default: return null;
    }
  }, [activeTab, paginatedData, isVendorReport]);

  const tableHead = useMemo(() => {
    switch (activeTab) {
      case 0: return <HourlyTableHead            sortConfig={sortConfig} onSort={onSort} />;
      case 1: return <MarginTableHead            sortConfig={sortConfig} onSort={onSort} />;
      case 2: return <NegativeMarginTableHead    sortConfig={sortConfig} onSort={onSort} />;
      case 3: return <CustomerVendorTableHead    sortConfig={sortConfig} onSort={onSort} isVendorReport={isVendorReport} />;
      case 4: return <CustomerOnlyTableHead      sortConfig={sortConfig} onSort={onSort} />;
      case 5: return <VendorOnlyTableHead        sortConfig={sortConfig} onSort={onSort} />;
      default: return null;
    }
  }, [activeTab, sortConfig, onSort, isVendorReport]);

  const headBg          = activeTab === 2 ? "red.50"    : "gray.200";
  const tableBorderColor = activeTab === 2 ? "red.200"  : borderColor;

  return (
    <>
      <Box
        maxH="580px"
        overflowY="auto"
        overflowX="hidden"
        border="1px solid"
        borderColor={tableBorderColor}
        borderRadius="md"
      >
        <Table variant="simple" size="sm" sx={{ tableLayout: "fixed", width: "100%" }}>
          <Thead h="30px" position="sticky" top={0} zIndex={10} bg={headBg}>
            {tableHead}
          </Thead>
          <Tbody>{tableBody}</Tbody>
        </Table>
      </Box>

      {/* Pagination */}
      <Flex justify="space-between" align="center" mt={4} py={2}>
        <HStack spacing={3}>
          <Menu>
            <MenuButton as={Button} size="sm" variant="outline">
              <HStack spacing={2}>
                <FiEye />
                <Text>{rowsPerPage}</Text>
                <ChevronDownIcon ml={1} />
              </HStack>
            </MenuButton>
            <MenuList>
              {ROWS_PER_PAGE_OPTIONS.map((n) => (
                <MenuItem key={n} onClick={() => { setRowsPerPage(n); setPage(1); }}>
                  {n} per page
                </MenuItem>
              ))}
            </MenuList>
          </Menu>
          <Text fontSize="sm" color={mutedColor}>
            Showing {Math.min((page - 1) * rowsPerPage + 1, filteredData.length)}–
            {Math.min(page * rowsPerPage, filteredData.length)} of {filteredData.length} entries
          </Text>
        </HStack>

        <HStack spacing={2}>
          <IconButton
            icon={<ChevronLeftIcon />}
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            isDisabled={page === 1}
            aria-label="Previous page"
          />
          {buildPageNumbers(page, totalPages).map((pageNum, i) =>
            pageNum === "…" ? (
              <Text key={`ellipsis-${i}`} px={2}>…</Text>
            ) : (
              <Button
                key={pageNum}
                size="sm"
                variant={page === pageNum ? "solid"   : "outline"}
                colorScheme={page === pageNum ? "blue" : "gray"}
                onClick={() => setPage(pageNum)}
              >
                {pageNum}
              </Button>
            ),
          )}
          <IconButton
            icon={<ChevronRightIcon />}
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            isDisabled={page === totalPages || totalPages === 0}
            aria-label="Next page"
          />
        </HStack>
      </Flex>
    </>
  );
});
ReportTable.displayName = "ReportTable";

// ─── Table Heads ──────────────────────────────────────────────────────────────

const HourlyTableHead = ({ sortConfig, onSort }) => (
  <Tr>
    {HOURLY_COLUMNS.map((col) => (
      <SortableTh key={col.key} label={col.label} sortKey={col.key} sortConfig={sortConfig} onSort={onSort} isNumeric={col.isNumeric} />
    ))}
  </Tr>
);

const MarginTableHead = ({ sortConfig, onSort }) => (
  <Tr>
    {MARGIN_COLUMNS.map((col) => (
      <SortableTh key={col.key} label={col.label} sortKey={col.key} sortConfig={sortConfig} onSort={onSort} isNumeric={col.isNumeric} />
    ))}
  </Tr>
);

const NegativeMarginTableHead = ({ sortConfig, onSort }) => (
  <Tr>
    {NEGATIVE_MARGIN_COLUMNS.map((col) => (
      <SortableTh key={col.key} label={col.label} sortKey={col.key} sortConfig={sortConfig} onSort={onSort} isNumeric={col.isNumeric} />
    ))}
  </Tr>
);

// FIX #19: sortKey was "venDestination" (missing 'd') — now "vendDestination"
// to match the field name used in CustomerVendorTableBody
const CustomerVendorTableHead = ({ sortConfig, onSort, isVendorReport }) => (
  <Tr>
    <SortableTh label="Account Owner" sortKey="accountOwner"    sortConfig={sortConfig} onSort={onSort} />
    <SortableTh label="Customer"      sortKey="customer"        sortConfig={sortConfig} onSort={onSort} />
    <SortableTh label="Destination"   sortKey="vendDestination" sortConfig={sortConfig} onSort={onSort} />
    <SortableTh label="Vendor"        sortKey="vendor"          sortConfig={sortConfig} onSort={onSort} />
    <SortableTh label="Attempts"      sortKey="attempts"        sortConfig={sortConfig} onSort={onSort} isNumeric />
    <SortableTh label="Comp"          sortKey="completed"       sortConfig={sortConfig} onSort={onSort} isNumeric />
    <SortableTh label="ASR%"          sortKey="asr"             sortConfig={sortConfig} onSort={onSort} isNumeric />
    <SortableTh label="ACD"           sortKey="acd"             sortConfig={sortConfig} onSort={onSort} isNumeric />
    <SortableTh label="Revenue"       sortKey="revenue"         sortConfig={sortConfig} onSort={onSort} isNumeric />
    <SortableTh label="Rev/min"       sortKey="revenuePerMin"   sortConfig={sortConfig} onSort={onSort} isNumeric />
    {isVendorReport && (
      <>
        <SortableTh label="Cost"      sortKey="cost"            sortConfig={sortConfig} onSort={onSort} isNumeric />
        <SortableTh label="Cost/min"  sortKey="costPerMin"      sortConfig={sortConfig} onSort={onSort} isNumeric />
      </>
    )}
    <SortableTh label="Margin"        sortKey="margin"          sortConfig={sortConfig} onSort={onSort} isNumeric />
    <SortableTh label="Margin %"      sortKey="marginPercent"   sortConfig={sortConfig} onSort={onSort} isNumeric />
  </Tr>
);

const CustomerOnlyTableHead = ({ sortConfig, onSort }) => (
  <Tr>
    <SortableTh label="Customer"       sortKey="customer"       sortConfig={sortConfig} onSort={onSort} />
    <SortableTh label="Account Owner"  sortKey="accountOwner"  sortConfig={sortConfig} onSort={onSort} />
    <SortableTh label="Destination"    sortKey="vendDestination" sortConfig={sortConfig} onSort={onSort} />
    <SortableTh label="Attempts"       sortKey="attempts"       sortConfig={sortConfig} onSort={onSort} isNumeric />
    <SortableTh label="Comp"           sortKey="completed"      sortConfig={sortConfig} onSort={onSort} isNumeric />
    <SortableTh label="ASR%"           sortKey="asr"            sortConfig={sortConfig} onSort={onSort} isNumeric />
    <SortableTh label="ACD"            sortKey="acd"            sortConfig={sortConfig} onSort={onSort} isNumeric />
    <SortableTh label="Revenue"        sortKey="revenue"        sortConfig={sortConfig} onSort={onSort} isNumeric />
    <SortableTh label="Rev/min"        sortKey="revenuePerMin"  sortConfig={sortConfig} onSort={onSort} isNumeric />
    <SortableTh label="Margin"         sortKey="margin"         sortConfig={sortConfig} onSort={onSort} isNumeric />
    <SortableTh label="Margin %"       sortKey="marginPercent"  sortConfig={sortConfig} onSort={onSort} isNumeric />
  </Tr>
);

const VendorOnlyTableHead = ({ sortConfig, onSort }) => (
  <Tr>
    <SortableTh label="Account Owner"      sortKey="accountOwner"   sortConfig={sortConfig} onSort={onSort} />
    <SortableTh label="Vendor"             sortKey="vendor"         sortConfig={sortConfig} onSort={onSort} />
    <SortableTh label="Destination Country"sortKey="vendDestination" sortConfig={sortConfig} onSort={onSort} />
    <SortableTh label="Attempts"           sortKey="attempts"       sortConfig={sortConfig} onSort={onSort} isNumeric />
    <SortableTh label="Comp"               sortKey="completed"      sortConfig={sortConfig} onSort={onSort} isNumeric />
    <SortableTh label="ASR%"               sortKey="asr"            sortConfig={sortConfig} onSort={onSort} isNumeric />
    <SortableTh label="ACD (Sec)"          sortKey="acd"            sortConfig={sortConfig} onSort={onSort} isNumeric />
    <SortableTh label="Cost"               sortKey="cost"           sortConfig={sortConfig} onSort={onSort} isNumeric />
    <SortableTh label="Cost/min"           sortKey="costPerMin"     sortConfig={sortConfig} onSort={onSort} isNumeric />
    <SortableTh label="Margin"             sortKey="margin"         sortConfig={sortConfig} onSort={onSort} isNumeric />
    <SortableTh label="Margin %"           sortKey="marginPercent"  sortConfig={sortConfig} onSort={onSort} isNumeric />
  </Tr>
);

// ─── Table Bodies ─────────────────────────────────────────────────────────────
// FIX #10: replaced key={i} (index) with stable composite keys derived from row data.
// FIX #17 & #22: all margin/ASR percentage cells now use formatPercentage().

const HourlyTableBody = React.memo(({ rows }) => (
  <>
    {rows.map((row) => (
      <Tr key={`hourly-${row.hour}`}>
        <Td>{row.hour}</Td>
        <Td isNumeric>{formatNumber(row.attempts)}</Td>
        <Td isNumeric>{formatNumber(row.completed)}</Td>
        <Td isNumeric>
          <Badge  borderRadius="full"
            px="8px"
            py="2px"
            fontWeight="500"
            fontSize="11px" colorScheme={row.asr > 50 ? "green" : row.asr > 20 ? "yellow" : "red"}>
            {formatPercentage(row.asr)}
          </Badge>
        </Td>
        <Td isNumeric>{row.acd}</Td>
        <Td isNumeric>{formatNumber(row.duration)}</Td>
        <Td isNumeric>{formatCurrency(row.revenue)}</Td>
        <Td isNumeric>{formatCurrency(row.cost)}</Td>
        <Td isNumeric>
          <Text fontWeight="semibold" color={row.margin >= 0 ? "green.600" : "red.500"}>
            {formatCurrency(row.margin)}
          </Text>
        </Td>
      </Tr>
    ))}
  </>
));
HourlyTableBody.displayName = "HourlyTableBody";

const MarginTableBody = React.memo(({ rows }) => (
  <>
    {rows.map((row) => (
      <Tr key={`margin-${row.accountName}-${row.destination}`}>
        <Td>{row.accountName}</Td>
        <Td>{row.accountOwner ?? "—"}</Td>
        <Td>{row.destination}</Td>
        <Td isNumeric>{formatNumber(row.attempts)}</Td>
        <Td isNumeric>{formatCurrency(row.revenue)}</Td>
        <Td isNumeric>{formatCurrency(row.cost)}</Td>
        <Td isNumeric>
          <Text color={row.margin >= 0 ? "green.600" : "red.500"} fontWeight="bold">
            {formatCurrency(row.margin)}
          </Text>
        </Td>
        <Td isNumeric>
          <Badge  borderRadius="full"
            px="8px"
            py="2px"
            fontWeight="500"
            fontSize="11px" colorScheme={row.marginPercent >= 0 ? "green" : "red"}>
            {formatPercentage(row.marginPercent)}
          </Badge>
        </Td>
        <Td isNumeric>{formatNumber(row.duration)}</Td>
      </Tr>
    ))}
  </>
));
MarginTableBody.displayName = "MarginTableBody";

const NegativeMarginTableBody = React.memo(({ rows }) => (
  <>
    {rows.map((row) => (
      <Tr key={`negmargin-${row.accountCode}-${row.destination}`} bg="red.50">
        <Td>{row.accountCode}</Td>
        <Td>{row.accountName}</Td>
        <Td>{row.accountOwner ?? "—"}</Td>
        <Td>{row.destination}</Td>
        <Td isNumeric>{formatNumber(row.attempts)}</Td>
        <Td isNumeric>{formatCurrency(row.revenue)}</Td>
        <Td isNumeric>{formatCurrency(row.cost)}</Td>
        <Td isNumeric color="red.600" fontWeight="bold">{formatCurrency(row.margin)}</Td>
        <Td isNumeric>
          <Badge  borderRadius="full"
            px="8px"
            py="2px"
            fontWeight="500"
            fontSize="11px" colorScheme="red">{formatPercentage(row.marginPercent)}</Badge>
        </Td>
      </Tr>
    ))}
  </>
));
NegativeMarginTableBody.displayName = "NegativeMarginTableBody";

const CustomerVendorTableBody = React.memo(({ rows, isVendorReport }) => (
  <>
    {rows.map((row) => (
      <Tr key={`cv-${row.customer}-${row.vendor}-${row.vendDestination}`}>
        <Td fontSize="xs">{row.accountOwner ?? "—"}</Td>
        <Td fontSize="xs">{row.customer}</Td>
        <Td>{row.vendDestination}</Td>
        <Td fontSize="xs">{row.vendor}</Td>
        <Td isNumeric>{formatNumber(row.attempts)}</Td>
        <Td isNumeric color="green.600">{formatNumber(row.completed)}</Td>
        <Td isNumeric>
          <Badge  borderRadius="full"
            px="8px"
            py="2px"
            fontWeight="500"
            fontSize="11px" colorScheme={row.asr > 40 ? "green" : "orange"}>
            {formatPercentage(row.asr)}
          </Badge>
        </Td>
        <Td isNumeric>{row.acd}</Td>
        <Td isNumeric>{formatCurrency(row.revenue)}</Td>
        {/* FIX #9: rate columns use 6 decimal places */}
        <Td isNumeric>{formatCurrencyRate(row.revenuePerMin)}</Td>
        {isVendorReport && (
          <>
            <Td isNumeric>{formatCurrency(row.cost)}</Td>
            <Td isNumeric>{formatCurrencyRate(row.costPerMin)}</Td>
          </>
        )}
        <Td isNumeric color={row.margin >= 0 ? "green.600" : "red.500"}>
          {formatCurrency(row.margin)}
        </Td>
        <Td isNumeric>{formatPercentage(row.marginPercent)}</Td>
      </Tr>
    ))}
  </>
));
CustomerVendorTableBody.displayName = "CustomerVendorTableBody";

const CustomerOnlyTableBody = React.memo(({ rows }) => (
  <>
    {rows.map((row) => (
      <Tr key={`custonly-${row.customer}-${row.vendDestination}`}>
        <Td fontSize="xs">{row.customer}</Td>
        <Td fontSize="xs">{row.accountOwner ?? "—"}</Td>
        <Td>{row.vendDestination}</Td>
        <Td isNumeric>{formatNumber(row.attempts)}</Td>
        <Td isNumeric color="green.600">{formatNumber(row.completed)}</Td>
        <Td isNumeric>
          <Badge  borderRadius="full"
            px="8px"
            py="2px"
            fontWeight="500"
            fontSize="11px" colorScheme={row.asr > 40 ? "green" : "orange"}>
            {formatPercentage(row.asr)}
          </Badge>
        </Td>
        <Td isNumeric>{row.acd}</Td>
        <Td isNumeric>{formatCurrency(row.revenue)}</Td>
        <Td isNumeric>{formatCurrencyRate(row.revenuePerMin)}</Td>
        <Td isNumeric color={row.margin >= 0 ? "green.600" : "red.500"}>
          {formatCurrency(row.margin)}
        </Td>
        <Td isNumeric>{formatPercentage(row.marginPercent)}</Td>
      </Tr>
    ))}
  </>
));
CustomerOnlyTableBody.displayName = "CustomerOnlyTableBody";

const VendorOnlyTableBody = React.memo(({ rows }) => (
  <>
    {rows.map((row) => (
      <Tr key={`vendonly-${row.vendor}-${row.vendDestination}`}>
        <Td fontSize="xs">{row.accountOwner ?? "—"}</Td>
        <Td fontSize="xs">{row.vendor}</Td>
        <Td>{row.vendDestination}</Td>
        <Td isNumeric>{formatNumber(row.attempts)}</Td>
        <Td isNumeric color="green.600">{formatNumber(row.completed)}</Td>
        <Td isNumeric>
          <Badge  borderRadius="full"
            px="8px"
            py="2px"
            fontWeight="500"
            fontSize="11px" colorScheme={row.asr > 40 ? "green" : "orange"}>
            {formatPercentage(row.asr)}
          </Badge>
        </Td>
        <Td isNumeric>{row.acd}</Td>
        <Td isNumeric>{formatCurrency(row.cost)}</Td>
        <Td isNumeric>{formatCurrencyRate(row.costPerMin)}</Td>
        <Td isNumeric color={row.margin >= 0 ? "green.600" : "red.500"}>
          {formatCurrency(row.margin)}
        </Td>
        <Td isNumeric>{formatPercentage(row.marginPercent)}</Td>
      </Tr>
    ))}
  </>
));
VendorOnlyTableBody.displayName = "VendorOnlyTableBody";

export default Reports;