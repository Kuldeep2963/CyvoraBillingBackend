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
  Container,
  Heading,
  Text,
  Button,
  Flex,
  Card,
  CardBody,
  CardHeader,
  SimpleGrid,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Badge,
  HStack,
  VStack,
  IconButton,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  Stat,
  StatLabel,
  StatNumber,
  useColorModeValue,
  FormControl,
  FormLabel,
  useToast,
  Spinner,
  Center,
  RadioGroup,
  Radio,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Grid,
  GridItem,
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverBody,
  PopoverArrow,
  PopoverCloseButton,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  NumberIncrementStepper,
  NumberDecrementStepper,
  Tag,
  Tooltip,
  Progress,
  InputGroup,
  InputLeftElement,
  Icon,
  Divider,
  Wrap,
  WrapItem,
} from "@chakra-ui/react";
import { MemoizedInput as Input, MemoizedSelect as Select } from "../components/memoizedinput/memoizedinput";
import PageNavBar from "../components/PageNavBar";
import {
  DownloadIcon,
  CalendarIcon,
  ChevronDownIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  SettingsIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  SearchIcon,
  WarningIcon,
  CheckCircleIcon,
  CloseIcon,
  StarIcon,
  InfoIcon,
} from "@chakra-ui/icons";
import {
  FiFilter,
  FiBarChart2,
  FiTrendingUp,
  FiTrendingDown,
  FiGrid,
  FiList,
  FiRefreshCw,
  FiCalendar,
  FiEye,
  FiFileText,
  FiUser,
} from "react-icons/fi";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import {
  fetchReportAccounts,
  generateReport,
  exportReport,
} from "../utils/api";
import MissingGateways from "./missinggateways";

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

const REPORT_TITLES = {
  0: "Hourly Report",
  1: "Margin Report",
  2: "Negative Margin Report",
  3: "Customer - Vendor Traffic Report",
  4: "Customer Traffic Report",
  5: "Vendor Traffic Report",
};

const TRUNK_OPTIONS = [
  { value: "all", label: "All Trunks" },
  { value: "NCLI", label: "NCLI" },
  { value: "CLI", label: "CLI" },
  { value: "ORTP/TDM", label: "ORTP/TDM" },
  { value: "CC", label: "CC" },
];

const ROWS_PER_PAGE_OPTIONS = [50, 100, 250];

// ─── Helper: DatePicker custom input (forwardRef required by react-datepicker) ─

const DatePickerInput = forwardRef(({ value, onClick, size, w }, ref) => (
  <Input
    ref={ref}
    value={value}
    onClick={onClick}
    onChange={() => {}} // controlled by DatePicker
    size={size}
    w={w}
    readOnly
    cursor="pointer"
  />
));
DatePickerInput.displayName = "DatePickerInput";

// ─── Formatters (defined outside component – stable references) ───────────────

const formatCurrency = (value) => {
  if (value === undefined || value === null) return "$0.00";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  }).format(parseFloat(value));
};

const formatNumber = (value) => {
  if (value === undefined || value === null) return "0";
  return new Intl.NumberFormat("en-US").format(parseFloat(value));
};

const formatPercentage = (value) => {
  if (value === undefined || value === null) return "0.00%";
  return `${parseFloat(value).toFixed(3)}%`;
};

const formatDuration = (seconds) => {
  if (!seconds || seconds === 0) return "00:00:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return [h, m, s].map((v) => v.toString().padStart(2, "0")).join(":");
};
const pad2 = (value) => String(value).padStart(2, "0");

const formatDateAsYmd = (date) => `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

const utcSelectionToBackendPayload = (date, hour, minute) => {
  if (!date) return { date: null, hour: 0, minute: 0 };

  const utcMillis = Date.UTC(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    hour,
    minute,
    0,
    0,
  );

  const localEquivalent = new Date(utcMillis - new Date(utcMillis).getTimezoneOffset() * 60000);

  return {
    date: formatDateAsYmd(localEquivalent),
    hour: localEquivalent.getHours(),
    minute: localEquivalent.getMinutes(),
  };
};

const getMinimumStartDate = (endDate) => {
  const minDate = new Date(endDate);
  minDate.setHours(0, 0, 0, 0);
  minDate.setMonth(minDate.getMonth() - 2);
  return minDate;
};

// ─── Sub-components (defined OUTSIDE Reports to avoid remounting) ─────────────

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

// ─── Loading / Empty states ────────────────────────────────────────────────────

const LoadingState = () => (
  <Center py={20}>
    <VStack spacing={4}>
      <Spinner size="xl" color="blue.500" thickness="4px" />
      <VStack spacing={1}>
        <Text fontWeight="medium">Generating Report</Text>
        <Text fontSize="sm" color="gray.500">Processing your data...</Text>
      </VStack>
      <Progress size="xs" width="200px" isIndeterminate colorScheme="blue" />
    </VStack>
  </Center>
);

const EmptyState = () => (
  <Alert
    bg="gray.200"
    status="info"
    borderRadius="md"
    variant="subtle"
    flexDirection="column"
    alignItems="center"
    justifyContent="center"
    textAlign="center"
  >
    <HStack spacing={4} align="center">
      <AlertIcon boxSize="30px" mr={0} />
      <AlertTitle mb={1} fontSize="lg">No Report Data</AlertTitle>
    </HStack>
    <AlertDescription maxWidth="lg" fontSize="sm">
      Generate a report to view analytics and insights from your CDR data.
    </AlertDescription>
  </Alert>
);

// ─── Table column definitions ─────────────────────────────────────────────────

// Each tab renders a different table. Column configs are static.
const HOURLY_COLUMNS = [
  { label: "Time Range", key: "hour" },
  { label: "Account Owner", key: "accountOwner" },
  { label: "Attempts", key: "attempts", isNumeric: true },
  { label: "Completed", key: "completed", isNumeric: true },
  { label: "ASR %", key: "asr", isNumeric: true },
  { label: "ACD (sec)", key: "acd", isNumeric: true },
  { label: "Duration (sec)", key: "duration", isNumeric: true },
  { label: "Revenue", key: "revenue", isNumeric: true },
  { label: "Cost", key: "cost", isNumeric: true },
  { label: "Margin", key: "margin", isNumeric: true },
];

const MARGIN_COLUMNS = [
  { label: "Customer", key: "accountName" },
  { label: "Account Owner", key: "accountOwner" },
  { label: "Destination", key: "destination" },
  { label: "Attempts", key: "attempts", isNumeric: true },
  { label: "Revenue", key: "revenue", isNumeric: true },
  { label: "Cost", key: "cost", isNumeric: true },
  { label: "Margin", key: "margin", isNumeric: true },
  { label: "Margin %", key: "marginPercent", isNumeric: true },
  { label: "Duration (Sec)", key: "duration", isNumeric: true },
];

const NEGATIVE_MARGIN_COLUMNS = [
  { label: "Account ID", key: "accountCode" },
  { label: "Customer", key: "accountName" },
  { label: "Account Owner", key: "accountOwner" },
  { label: "Destination", key: "destination" },
  { label: "Attempts", key: "attempts", isNumeric: true },
  { label: "Revenue", key: "revenue", isNumeric: true },
  { label: "Cost", key: "cost", isNumeric: true },
  { label: "Margin", key: "margin", isNumeric: true },
  { label: "Margin %", key: "marginPercent", isNumeric: true },
];

// ─── Main Component ────────────────────────────────────────────────────────────

const Reports = () => {
  // ── State ──────────────────────────────────────────────────────────────────
  const [dateRange, setDateRange] = useState({
    startDate: new Date(),
    endDate: new Date(),
    startHour: 0,
    startMinute: 0,
    endHour: 23,
    endMinute: 59,
  });
  const [activeTab, setActiveTab] = useState(0);
  const [selectedAccount, setSelectedAccount] = useState("all");
  const [accounts, setAccounts] = useState({ customers: [], vendors: [] });
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [isVendorReport, setIsVendorReport] = useState(false);
  const [reportData, setReportData] = useState([]);
  const [reportSummary, setReportSummary] = useState({});
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [marginThreshold, setMarginThreshold] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [selectedTrunk, setSelectedTrunk] = useState("all");
  const [selectedOwner, setSelectedOwner] = useState("all");
  const [filters] = useState({ minASR: 0, maxASR: 100, minMargin: -100, maxMargin: 100 });

  const toast = useToast();
  const cardBg = useColorModeValue("white", "gray.800");
  const borderColor = useColorModeValue("gray.200", "gray.700");
  const mutedColor = useColorModeValue("gray.600", "gray.400");

  // ── Effects ────────────────────────────────────────────────────────────────
  useEffect(() => { loadAccounts(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset page whenever filtered data changes (search, sort, filters)
  // We do this via a ref to detect actual data/search/sort changes
  const prevSearchRef = useRef(searchTerm);
  const prevSortRef = useRef(sortConfig);
  useEffect(() => {
    if (
      prevSearchRef.current !== searchTerm ||
      prevSortRef.current !== sortConfig
    ) {
      setPage(1);
      prevSearchRef.current = searchTerm;
      prevSortRef.current = sortConfig;
    }
  }, [searchTerm, sortConfig]);

  // ── Callbacks ──────────────────────────────────────────────────────────────
  const loadAccounts = useCallback(async () => {
    setAccountsLoading(true);
    try {
      const data = await fetchReportAccounts();
      if (data.success) setAccounts(data);
    } catch (error) {
      toast({
        title: "Error loading accounts",
        description: error.message,
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setAccountsLoading(false);
    }
  }, [toast]);

  const handleStartDateChange = useCallback(
    (date) => {
      if (!date) return;
      const minStartDate = getMinimumStartDate(dateRange.endDate);
      if (date < minStartDate) {
        toast({
          title: "Invalid start date",
          description: "Start date cannot be more than 2 months before end date",
          status: "warning",
          duration: 3000,
          isClosable: true,
        });
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
      endDate: date,
      startDate: prev.startDate < minStartDate ? minStartDate : prev.startDate,
    }));
  }, []);

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
    setPage(1);
    setSearchTerm("");
    setSortConfig({ key: null, direction: "asc" });
    setSelectedOwner("all");
    if (index === 4) setIsVendorReport(false);
    else if (index === 5) setIsVendorReport(true);
    // tabs 0,1,2,3 keep the user's current vendor/customer choice
  }, []);

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
    if (dateRange.endHour === dateRange.startHour && dateRange.endMinute < dateRange.startMinute) {
      toast({ title: "Invalid time range", description: "End time must be after start time", status: "warning", duration: 3000, isClosable: true });
      return;
    }

    const daysDiff = Math.ceil((dateRange.endDate - dateRange.startDate) / (1000 * 60 * 60 * 24));
    if (daysDiff > 62) {
      toast({ title: "Large date range", description: "For better performance, please select a date range under 2 months", status: "warning", duration: 5000, isClosable: true });
    }

    setLoading(true);
    try {
      const accountsList = isVendorReport ? accounts.vendors : accounts.customers;
      const selectedAccountObj = selectedAccount !== "all"
        ? accountsList.find((acc) => (isVendorReport ? acc.vendorCode : acc.customerCode) === selectedAccount)
        : null;

      const reportTypeMap = {
        0: "hourly-report",
        1: "margin-report",
        2: "negative-margin-report",
        3: "customer-traffic",
        4: "customer-only-traffic",
        5: "vendor-traffic",
      };

      const startPayload = utcSelectionToBackendPayload(dateRange.startDate, dateRange.startHour, dateRange.startMinute);
      const endPayload = utcSelectionToBackendPayload(dateRange.endDate, dateRange.endHour, dateRange.endMinute);

      const params = {
        startDate: startPayload.date,
        endDate: endPayload.date,
        startHour: startPayload.hour,
        startMinute: startPayload.minute,
        endHour: endPayload.hour,
        endMinute: endPayload.minute,
        accountId: selectedAccount,
        vendorReport: activeTab === 4 ? false : activeTab === 5 ? true : isVendorReport,
        trunk: selectedTrunk,
        ownerName: selectedAccountObj?.ownerName ?? "",
      };

      const result = await generateReport(reportTypeMap[activeTab], params);

      if (result.success || result.data) {
        let data = result.data ?? [];

        // Normalize costPerMin for vendor-traffic
        if (activeTab === 5) {
          data = data.map((r) => ({ ...r, costPerMin: r.costPerMin ?? 0 }));
        }

        setReportData(data);
        setPage(1);

        // Prefer server-provided summary; fall back to client-computed
        if (result.summary && !Array.isArray(result.summary)) {
          setReportSummary(result.summary);
        } else {
          const uniqueArr = (arr) => [...new Set(arr)].filter(Boolean);
          setReportSummary({
            totalAttempts: data.reduce((s, r) => s + (r.attempts ?? 0), 0),
            totalCompleted: data.reduce((s, r) => s + (r.completed ?? 0), 0),
            totalRevenue: data.reduce((s, r) => s + (r.revenue ?? 0), 0),
            totalCost: data.reduce((s, r) => s + (r.cost ?? 0), 0),
            totalMargin: data.reduce((s, r) => s + (r.margin ?? 0), 0),
            avgASR: data.length > 0 ? data.reduce((s, r) => s + (r.asr ?? 0), 0) / data.length : 0,
            avgMarginPercent: data.length > 0 ? data.reduce((s, r) => s + (r.marginPercent ?? 0), 0) / data.length : 0,
            totalCustomers: uniqueArr(data.map((r) => r.customer ?? r.accountName)).length,
            totalVendors: uniqueArr(data.map((r) => r.vendor ?? r.vendAccountCode)).length,
            negativeMarginCalls: data.filter((r) => (r.margin ?? 0) < 0).length,
            totalLoss: data.filter((r) => (r.margin ?? 0) < 0).reduce((s, r) => s + r.margin, 0),
            affectedCustomers: uniqueArr(data.filter((r) => (r.margin ?? 0) < 0).map((r) => r.customer ?? r.accountName ?? r.accountCode)).length,
            affectedDestinations: uniqueArr(data.filter((r) => (r.margin ?? 0) < 0).map((r) => r.destination)).length,
          });
        }

        toast({
          title: "Report Generated Successfully",
          description: `${data.length} records processed`,
          status: "success",
          duration: 3000,
          isClosable: true,
          position: "top-right",
        });
      } else {
        throw new Error(result.error ?? "Failed to generate report");
      }
    } catch (error) {
      console.error("Report generation error:", error);
      toast({
        title: "Error generating report",
        description: error.message,
        status: "error",
        duration: 5000,
        isClosable: true,
        position: "top-right",
      });
    } finally {
      setLoading(false);
    }
  }, [activeTab, accounts, dateRange, isVendorReport, selectedAccount, selectedTrunk, toast]);

  // BUG FIX: export filteredData (respects search/sort), not raw reportData
  const handleExport = useCallback(
    async (format) => {
      if (!filteredData.length) {
        toast({ title: "No data to export", description: "Please generate a report first", status: "warning", duration: 3000, isClosable: true });
        return;
      }
      setExporting(true);
      try {
        const fileName = `report_${Date.now()}_${formatDateAsYmd(dateRange.startDate)}_to_${formatDateAsYmd(dateRange.endDate)}`;
        await exportReport(filteredData, format, fileName);
        toast({ title: "Export Complete", description: `Exported as ${format.toUpperCase()}`, status: "success", duration: 3000, isClosable: true });
      } catch (error) {
        toast({ title: "Export Failed", description: error.message, status: "error", duration: 5000, isClosable: true });
      } finally {
        setExporting(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dateRange.endDate, dateRange.startDate, toast],
  );

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

    // BUG FIX: use correct field names for both ASR and margin filters
    data = data.filter((row) => {
      const asr = parseFloat(row.asr ?? row.ASR ?? 0);
      const margin = parseFloat(row.marginPercent ?? row.MarginPercent ?? 0);
      return (
        asr >= filters.minASR &&
        asr <= filters.maxASR &&
        margin >= filters.minMargin &&
        margin <= filters.maxMargin
      );
    });

    if (sortConfig.key) {
      data.sort((a, b) => {
        const av = a[sortConfig.key];
        const bv = b[sortConfig.key];
        const an = parseFloat(av);
        const bn = parseFloat(bv);
        const numericCompare = !isNaN(an) && !isNaN(bn);
        if (numericCompare ? an < bn : av < bv) return sortConfig.direction === "asc" ? -1 : 1;
        if (numericCompare ? an > bn : av > bv) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }

    return data;
  }, [reportData, searchTerm, sortConfig, filters]);

  const paginatedData = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    return filteredData.slice(start, start + rowsPerPage);
  }, [filteredData, page, rowsPerPage]);

  const totalPages = Math.ceil(filteredData.length / rowsPerPage);

  const dashboardMetrics = useMemo(() => {
    if (!reportData.length) return null;
    const customerMap = {};
    const destinationMap = {};
    let totalRevenue = 0, totalCost = 0, totalCalls = 0, totalMargin = 0, sumASR = 0, sumACD = 0;

    for (const row of reportData) {
      totalRevenue += parseFloat(row.revenue ?? row.Revenue ?? row.TotalRevenue ?? 0);
      totalCost += parseFloat(row.cost ?? row.Cost ?? 0);
      totalCalls += parseInt(row.attempts ?? row.Attempts ?? row.TotalCalls ?? 0);
      totalMargin += parseFloat(row.margin ?? row.Margin ?? row.TotalMargin ?? 0);
      sumASR += parseFloat(row.asr ?? row.ASR ?? 0);
      sumACD += parseFloat(row.acd ?? row.ACD ?? 0);

      const customer = row.customer ?? row.Customer ?? row.accountName ?? row.customername;
      if (customer) customerMap[customer] = (customerMap[customer] ?? 0) + parseFloat(row.revenue ?? row.Revenue ?? 0);

      const destination = row.destination ?? row.Destination ?? row.custDestination ?? row.calleeareacode;
      if (destination) destinationMap[destination] = (destinationMap[destination] ?? 0) + parseInt(row.attempts ?? row.Attempts ?? 0);
    }

    const n = reportData.length;
    return {
      totalRevenue, totalCost, totalCalls, totalMargin,
      avgASR: n > 0 ? sumASR / n : 0,
      avgACD: n > 0 ? sumACD / n : 0,
      topCustomers: Object.entries(customerMap).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, revenue]) => ({ name, revenue })),
      topDestinations: Object.entries(destinationMap).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, calls]) => ({ name, calls })),
    };
  }, [reportData]);

  // ── Summary config ─────────────────────────────────────────────────────────
  const summaryConfig = useMemo(() => ({
    0: [
      { label: "Total Attempts", value: reportSummary.totalAttempts?.toLocaleString() ?? "0", icon: FiBarChart2, color: "blue" },
      { label: "Completed Calls", value: reportSummary.totalCompleted?.toLocaleString() ?? "0", icon: CheckCircleIcon, color: "green" },
      { label: "Total Revenue", value: formatCurrency(reportSummary.totalRevenue ?? 0), icon: FiTrendingUp, color: "green" },
      { label: "Avg ASR", value: `${reportSummary.avgASR?.toFixed(2) ?? "0.00"}%`, icon: StarIcon, color: "yellow" },
    ],
    1: [
      { label: "Total Revenue", value: formatCurrency(reportSummary.totalRevenue ?? 0), icon: FiTrendingUp, color: "green" },
      { label: "Total Cost", value: formatCurrency(reportSummary.totalCost ?? 0), icon: FiTrendingDown, color: "red" },
      { label: "Total Margin", value: formatCurrency(reportSummary.totalMargin ?? 0), icon: FiBarChart2, color: "blue" },
      { label: "Avg Margin %", value: `${reportSummary.avgMarginPercent?.toFixed(2) ?? "0.00"}%`, icon: StarIcon, color: "purple" },
    ],
    2: [
      { label: "Total Loss", value: formatCurrency(Math.abs(reportSummary.totalLoss ?? 0)), icon: WarningIcon, color: "red" },
      { label: "Negative Calls", value: reportSummary.negativeMarginCalls?.toLocaleString() ?? "0", icon: CloseIcon, color: "orange" },
      { label: "Affected Customers", value: reportSummary.affectedCustomers?.toLocaleString() ?? "0", icon: InfoIcon, color: "yellow" },
      { label: "Destinations", value: reportSummary.affectedDestinations?.toLocaleString() ?? "0", icon: FiGrid, color: "cyan" },
    ],
    3: [
      { label: "Total Customers", value: reportSummary.totalCustomers?.toLocaleString() ?? "0", icon: FiList, color: "blue" },
      { label: "Total Attempts", value: reportSummary.totalAttempts?.toLocaleString() ?? "0", icon: FiBarChart2, color: "green" },
      { label: "Total Revenue", value: formatCurrency(reportSummary.totalRevenue ?? 0), icon: FiTrendingUp, color: "purple" },
      { label: "Total Cost", value: formatCurrency(reportSummary.totalCost ?? 0), icon: FiTrendingDown, color: "red" },
    ],
    4: [
      { label: "Total Customers", value: reportSummary.totalCustomers ?? 0, icon: FiGrid, color: "purple" },
      { label: "Total Attempts", value: reportSummary.totalAttempts?.toLocaleString() ?? "0", icon: FiBarChart2, color: "blue" },
      { label: "Total Revenue", value: formatCurrency(reportSummary.totalRevenue ?? 0), icon: FiTrendingUp, color: "green" },
      { label: "Avg ASR", value: `${reportSummary.avgASR?.toFixed(2) ?? "0.00"}%`, icon: StarIcon, color: "yellow" },
    ],
    5: [
      { label: "Total Vendors", value: reportSummary.totalVendors ?? 0, icon: FiGrid, color: "purple" },
      { label: "Total Attempts", value: reportSummary.totalAttempts?.toLocaleString() ?? "0", icon: FiBarChart2, color: "blue" },
      { label: "Total Revenue", value: formatCurrency(reportSummary.totalRevenue ?? 0), icon: FiTrendingUp, color: "green" },
      { label: "Total Cost", value: formatCurrency(reportSummary.totalCost ?? 0), icon: FiTrendingDown, color: "red" },
    ],
  }), [reportSummary]);

  // ── Account list for current mode ─────────────────────────────────────────
  const currentAccounts = isVendorReport ? accounts.vendors : accounts.customers;

  const ownerOptions = useMemo(() => {
    const uniqueOwners = [...new Set(
      currentAccounts
        .map((account) => String(account.ownerName || "").trim())
        .filter(Boolean),
    )].sort((a, b) => a.localeCompare(b));

    return [
      { value: "all", label: "All Owners" },
      ...uniqueOwners.map((owner) => ({ value: owner, label: owner })),
    ];
  }, [currentAccounts]);

  const ownerFilteredAccounts = useMemo(() => {
    return currentAccounts
      .filter((account) => {
        if (selectedOwner === "all") return true;
        return String(account.ownerName || "").trim() === selectedOwner;
      })
      .sort((a, b) => {
        const ownerA = String(a.ownerName || "").trim();
        const ownerB = String(b.ownerName || "").trim();
        const ownerCompare = ownerA.localeCompare(ownerB);
        if (ownerCompare !== 0) return ownerCompare;

        return String(a.accountName || "").localeCompare(String(b.accountName || ""));
      });
  }, [currentAccounts, selectedOwner]);

  // ── Time picker helpers ────────────────────────────────────────────────────
  const setStartHour = useCallback((hour) => {
    setDateRange((prev) => ({
      ...prev,
      startHour: hour,
      endHour: Math.max(hour, prev.endHour),
    }));
  }, []);

  const setEndHour = useCallback((hour) => {
    setDateRange((prev) => ({
      ...prev,
      endHour: hour,
      startHour: Math.min(hour, prev.startHour),
    }));
  }, []);

  const setStartMinute = useCallback((minute) => setDateRange((prev) => ({ ...prev, startMinute: minute })), []);
  const setEndMinute = useCallback((minute) => setDateRange((prev) => ({ ...prev, endMinute: minute })), []);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Box>
      <PageNavBar
        title="CDR Analytics Reports"
        description="Generate detailed reports and insights from CDR data"
        rightContent={
          <>
            <Button size="sm" leftIcon={<FiRefreshCw />} variant="ghost" onClick={loadAccounts} isLoading={accountsLoading}>
              Refresh
            </Button>
            <Menu>
              <MenuButton
                size="sm"
                as={Button}
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

      <Box mt={6}>
        {/* ── Report type + date controls ──────────────────────────────────── */}
        <Flex direction={{ base: "column", lg: "row" }} gap={4} align={{ base: "stretch", lg: "flex-end" }}>
          <FormControl maxW={{ base: "100%", md: "320px" }}>
            <FormLabel fontSize="sm" mb={2}>Select Report Type</FormLabel>
            <Select
              size="sm"
              value={activeTab.toString()}
              onChange={(e) => handleTabChange(parseInt(e.target.value))}
            >
              {REPORT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </Select>
          </FormControl>

          {activeTab !== 6 && (
            <Wrap spacing={4} justify="flex-start" align="flex-end">
              {/* Start Date */}
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

              {/* End Date */}
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

              {/* Time pickers – hidden for Hourly Report (tab 0) */}
              {activeTab !== 0 && (
                <>
                  <TimePickerButton
                    label="From Time (UTC)"
                    hour={dateRange.startHour}
                    minute={dateRange.startMinute}
                    onHourChange={setStartHour}
                    onMinuteChange={setStartMinute}
                    activeHour={dateRange.startHour}
                    activeMinute={dateRange.startMinute}
                  />
                  <TimePickerButton
                    label="To Time (UTC)"
                    hour={dateRange.endHour}
                    minute={dateRange.endMinute}
                    onHourChange={setEndHour}
                    onMinuteChange={setEndMinute}
                    activeHour={dateRange.endHour}
                    activeMinute={dateRange.endMinute}
                  />
                </>
              )}
              
            </Wrap>
          )}
        </Flex>

        {activeTab !== 6 ? (
          <>
            {/* ── Report controls (account selector, generate button) ───── */}
            <ReportControls
              activeTab={activeTab}
              isVendorReport={isVendorReport}
              setIsVendorReport={setIsVendorReport}
              selectedAccount={selectedAccount}
              setSelectedAccount={setSelectedAccount}
              selectedOwner={selectedOwner}
              setSelectedOwner={setSelectedOwner}
              ownerOptions={ownerOptions}
              selectedTrunk={selectedTrunk}
              setSelectedTrunk={setSelectedTrunk}
              accounts={ownerFilteredAccounts}
              accountsLoading={accountsLoading}
              marginThreshold={marginThreshold}
              setMarginThreshold={setMarginThreshold}
              loading={loading}
              dateRange={dateRange}
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

            {/* ── Summary cards ─────────────────────────────────────────── */}
            {reportSummary && Object.keys(reportSummary).length > 0 && summaryConfig[activeTab] && (
              <ReportSummaryCards
                stats={summaryConfig[activeTab]}
                cardBg={cardBg}
                borderColor={borderColor}
                mutedColor={mutedColor}
              />
            )}

            {/* ── Data table card ───────────────────────────────────────── */}
            <Card bg={cardBg} border="1px" borderColor={borderColor}>
              <CardHeader>
                <Flex justify="space-between" align={{ base: "stretch", md: "center" }} gap={4} direction={{ base: "column", md: "row" }}>
                  <VStack align="start" spacing={1}>
                    {/* BUG FIX: use REPORT_TITLES map instead of broken array index */}
                    <Heading size="md">{REPORT_TITLES[activeTab] ?? "Report"}</Heading>
                    <Text fontSize="sm" color={mutedColor}>
                      Generated on {new Date().toLocaleDateString()} | Data range:{" "}
                      {dateRange.startDate.toLocaleDateString()} to {dateRange.endDate.toLocaleDateString()}
                    </Text>
                    <Badge
                      colorScheme={selectedTrunk === "all" ? "gray" : "blue"}
                      fontSize="xs"
                      px={2}
                      py={1}
                    >
                      Trunk: {selectedTrunk === "all" ? "All Trunks" : selectedTrunk}
                    </Badge>
                  </VStack>
                  <HStack spacing={3} align="center" justify={{ base: "flex-start", md: "flex-end" }}>
                    <InputGroup w={{ base: "full", sm: "280px" }}>
                      <InputLeftElement pointerEvents="none">
                        <SearchIcon color="gray.500" />
                      </InputLeftElement>
                      <Input
                        pl={9}
                        placeholder="Search in report..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </InputGroup>
                    <Badge colorScheme="yellow" fontSize="xs" px={3} py={1} whiteSpace="nowrap">
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

const ReportControls = React.memo(({
  activeTab, isVendorReport, setIsVendorReport,
  selectedAccount, setSelectedAccount,
  selectedOwner, setSelectedOwner, ownerOptions,
  selectedTrunk, setSelectedTrunk, accounts, accountsLoading,
  marginThreshold, setMarginThreshold, loading, dateRange, onGenerate, cardBg,
}) => (
  <Box mb={4} p={4} bg={cardBg} shadow="lg" borderRadius="md">
    <VStack spacing={6} align="stretch">
      <Flex direction={{ base: "column", lg: "row" }} gap={6} align={{ base: "stretch", lg: "flex-end" }}>
        {/* Report side radio (Hourly, Margin, Customer-Vendor) */}
        {[0, 1, 3].includes(activeTab) && (
          <FormControl>
            <FormLabel display="flex" alignItems="center" gap={2}>
              <FiFileText />Report Side
            </FormLabel>
            <RadioGroup
              value={isVendorReport ? "vendor" : "customer"}
              onChange={(val) => { setIsVendorReport(val === "vendor"); setSelectedOwner("all"); setSelectedAccount("all"); }}
            >
              <HStack spacing={6}>
                <Radio value="customer">Customer</Radio>
                <Radio value="vendor">Vendor</Radio>
              </HStack>
            </RadioGroup>
          </FormControl>
        )}

        {/* Account selector */}
        <FormControl maxW={{ base: "100%", lg: "220px" }}>
          <FormLabel>Account Owner</FormLabel>
          <Select
            value={selectedOwner}
            onChange={(e) => {
              setSelectedOwner(e.target.value);
              setSelectedAccount("all");
            }}
            isDisabled={accountsLoading}
          >
            {ownerOptions.map((ownerOption) => (
              <option key={ownerOption.value} value={ownerOption.value}>
                {ownerOption.label}
              </option>
            ))}
          </Select>
        </FormControl>

        {/* Account selector */}
        <FormControl>
          <FormLabel display="flex" alignItems="center" gap={2}>
            <FiUser />{isVendorReport ? "Vendor Account" : "Customer Account"}
          </FormLabel>
          <Select
            value={selectedAccount}
            onChange={(e) => setSelectedAccount(e.target.value)}
            isDisabled={accountsLoading}
            placeholder={accountsLoading ? "Loading accounts..." : undefined}
          >
            <option value="all">All Accounts</option>
            {accounts.map((account) => (
              <option
                key={account.id ?? account._id}
                value={isVendorReport ? account.vendorCode : account.customerCode}
              >
                {account.customerCode ?? account.vendorCode} ({account.accountName})
              </option>
            ))}
          </Select>
        </FormControl>

        <FormControl maxW={{ base: "100%", lg: "180px" }}>
          <FormLabel>Trunk</FormLabel>
          <Select
            value={selectedTrunk}
            onChange={(e) => setSelectedTrunk(e.target.value)}
            isDisabled={loading}
          >
            {TRUNK_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </FormControl>

        {/* Negative margin threshold */}
        {activeTab === 2 && (
          <FormControl>
            <FormLabel fontWeight="bold" display="flex" alignItems="center" gap={2}>
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
          isDisabled={loading || accountsLoading || !dateRange.startDate || !dateRange.endDate}
          isLoading={loading}
          loadingText="Generating"
        >
          Generate Report
        </Button>
      </Flex>
    </VStack>
  </Box>
));
ReportControls.displayName = "ReportControls";

// ─── DashboardMetrics ─────────────────────────────────────────────────────────

const DashboardMetrics = React.memo(({ metrics, cardBg, borderColor, mutedColor }) => (
  <Box p={4} bg={cardBg} border="1px" borderColor={borderColor} borderRadius="md" shadow="lg" mb={2}>
    <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={6}>
      <Box>
        <Text fontSize="sm" color={mutedColor}>Profit Margin</Text>
        <Heading size="md" color={metrics.totalMargin >= 0 ? "green.500" : "red.500"}>
          {formatCurrency(metrics.totalMargin)}
        </Heading>
        <Text fontSize="xs">
          {metrics.totalRevenue > 0 ? ((metrics.totalMargin / metrics.totalRevenue) * 100).toFixed(6) : 0}% margin
        </Text>
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
));
DashboardMetrics.displayName = "DashboardMetrics";

// ─── ReportSummaryCards ────────────────────────────────────────────────────────

const ReportSummaryCards = React.memo(({ stats, cardBg, borderColor, mutedColor }) => (
  <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={4} mb={4}>
    {stats.map((stat, index) => (
      <Card
        key={index}
        bg={cardBg}
        border="1px"
        borderColor={borderColor}
        _hover={{ transform: "translateY(-2px)", boxShadow: "lg" }}
        transition="all 0.2s"
      >
        <CardBody>
          <HStack justify="space-between" mb={2}>
            <Box p={2} bg={`${stat.color}.100`} borderRadius="md">
              <Icon bg={"transparent"} as={stat.icon} color={`${stat.color}.500`} boxSize={5} />
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

const MINUTE_OPTIONS = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

const TimePickerButton = React.memo(({ label, hour, minute, onHourChange, onMinuteChange, activeHour, activeMinute }) => (
  <WrapItem>
    <Popover placement="bottom">
      <PopoverTrigger>
        <Box>
          <FormLabel fontSize="sm" display="flex" alignItems="center" gap={2} mb={2}>
            <FiClock />{label}
          </FormLabel>
          <Button
            size="sm"
            variant="outline"
            borderColor="gray.300"
            bg="white"
            _hover={{ borderColor: "blue.400", bg: "blue.50" }}
            w="120px"
            fontWeight="bold"
            color="gray.800"
          >
            {hour.toString().padStart(2, "0")}:{minute.toString().padStart(2, "0")}
          </Button>
        </Box>
      </PopoverTrigger>
      <PopoverContent w="280px">
        <PopoverArrow />
        <PopoverCloseButton />
        <PopoverBody p={4}>
          <VStack spacing={4}>
            <Box w="full">
              <Text fontSize="xs" fontWeight="bold" mb={2}>Hour</Text>
              <Grid templateColumns="repeat(6, 1fr)" gap={2}>
                {Array.from({ length: 24 }, (_, h) => (
                  <GridItem key={h}>
                    <Button
                      size="sm"
                      variant={activeHour === h ? "solid" : "outline"}
                      colorScheme={activeHour === h ? "blue" : "gray"}
                      w="100%"
                      onClick={() => onHourChange(h)}
                      fontSize="xs"
                      fontWeight="bold"
                    >
                      {h.toString().padStart(2, "0")}
                    </Button>
                  </GridItem>
                ))}
              </Grid>
            </Box>
            <Box w="full">
              <Text fontSize="xs" fontWeight="bold" mb={2}>Minute</Text>
              <Grid templateColumns="repeat(6, 1fr)" gap={2}>
                {MINUTE_OPTIONS.map((m) => (
                  <GridItem key={m}>
                    <Button
                      size="sm"
                      variant={activeMinute === m ? "solid" : "outline"}
                      colorScheme={activeMinute === m ? "blue" : "gray"}
                      w="100%"
                      onClick={() => onMinuteChange(m)}
                      fontSize="xs"
                      fontWeight="bold"
                    >
                      {m.toString().padStart(2, "0")}
                    </Button>
                  </GridItem>
                ))}
              </Grid>
            </Box>
          </VStack>
        </PopoverBody>
      </PopoverContent>
    </Popover>
  </WrapItem>
));
TimePickerButton.displayName = "TimePickerButton";

// ─── ReportTable ──────────────────────────────────────────────────────────────

const ReportTable = React.memo(({
  activeTab, paginatedData, filteredData, sortConfig, onSort,
  isVendorReport, page, setPage, totalPages, rowsPerPage, setRowsPerPage,
  borderColor, mutedColor,
}) => {
  const tableBody = useMemo(() => {
    switch (activeTab) {
      case 0: return <HourlyTableBody rows={paginatedData} />;
      case 1: return <MarginTableBody rows={paginatedData} />;
      case 2: return <NegativeMarginTableBody rows={paginatedData} />;
      case 3: return <CustomerVendorTableBody rows={paginatedData} isVendorReport={isVendorReport} />;
      case 4: return <CustomerOnlyTableBody rows={paginatedData} />;
      case 5: return <VendorOnlyTableBody rows={paginatedData} />;
      default: return null;
    }
  }, [activeTab, paginatedData, isVendorReport]);

  const tableHead = useMemo(() => {
    switch (activeTab) {
      case 0: return <HourlyTableHead sortConfig={sortConfig} onSort={onSort} />;
      case 1: return <MarginTableHead sortConfig={sortConfig} onSort={onSort} />;
      case 2: return <NegativeMarginTableHead sortConfig={sortConfig} onSort={onSort} />;
      case 3: return <CustomerVendorTableHead sortConfig={sortConfig} onSort={onSort} isVendorReport={isVendorReport} />;
      case 4: return <CustomerOnlyTableHead sortConfig={sortConfig} onSort={onSort} />;
      case 5: return <VendorOnlyTableHead sortConfig={sortConfig} onSort={onSort} />;
      default: return null;
    }
  }, [activeTab, sortConfig, onSort, isVendorReport]);

  const headBg = activeTab === 2 ? "red.50" : "gray.200";
  const tableBorderColor = activeTab === 2 ? "red.200" : borderColor;

  return (
    <>
      <Box maxH="580px" overflowY="auto" overflowX="hidden" border="1px solid" borderColor={tableBorderColor} borderRadius="md">
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
                variant={page === pageNum ? "solid" : "outline"}
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

// Smarter page number builder (1 … 4 5 6 … 10)
function buildPageNumbers(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 4) return [1, 2, 3, 4, 5, "…", total];
  if (current >= total - 3) return [1, "…", total - 4, total - 3, total - 2, total - 1, total];
  return [1, "…", current - 1, current, current + 1, "…", total];
}

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

const CustomerVendorTableHead = ({ sortConfig, onSort, isVendorReport }) => (
  <Tr>
    <SortableTh label="Account" sortKey="custAccountCode" sortConfig={sortConfig} onSort={onSort} />
    <SortableTh label="Account Owner" sortKey="accountOwner" sortConfig={sortConfig} onSort={onSort} />
    <SortableTh label="Customer" sortKey="customer" sortConfig={sortConfig} onSort={onSort} />
    <SortableTh label="Source Country" sortKey="custDestination" sortConfig={sortConfig} onSort={onSort} />
    <SortableTh label="Vendor" sortKey="vendor" sortConfig={sortConfig} onSort={onSort} />
    <SortableTh label="Attempts" sortKey="attempts" sortConfig={sortConfig} onSort={onSort} isNumeric />
    <SortableTh label="Comp" sortKey="completed" sortConfig={sortConfig} onSort={onSort} isNumeric />
    <SortableTh label="ASR%" sortKey="asr" sortConfig={sortConfig} onSort={onSort} isNumeric />
    <SortableTh label="ACD" sortKey="acd" sortConfig={sortConfig} onSort={onSort} isNumeric />
    <SortableTh label="Revenue" sortKey="revenue" sortConfig={sortConfig} onSort={onSort} isNumeric />
    <SortableTh label="Rev/min" sortKey="revenuePerMin" sortConfig={sortConfig} onSort={onSort} isNumeric />
    {isVendorReport && (
      <>
        <SortableTh label="Cost" sortKey="cost" sortConfig={sortConfig} onSort={onSort} isNumeric />
        <SortableTh label="Cost/min" sortKey="costPerMin" sortConfig={sortConfig} onSort={onSort} isNumeric />
      </>
    )}
    <SortableTh label="Margin" sortKey="margin" sortConfig={sortConfig} onSort={onSort} isNumeric />
    <SortableTh label="Margin %" sortKey="marginPercent" sortConfig={sortConfig} onSort={onSort} isNumeric />
  </Tr>
);

const CustomerOnlyTableHead = ({ sortConfig, onSort }) => (
  <Tr>
    <SortableTh label="Customer" sortKey="customer" sortConfig={sortConfig} onSort={onSort} />
    <SortableTh label="Account Owner" sortKey="accountOwner" sortConfig={sortConfig} onSort={onSort} />
    <SortableTh label="Source Country" sortKey="custDestination" sortConfig={sortConfig} onSort={onSort} />
    <SortableTh label="Attempts" sortKey="attempts" sortConfig={sortConfig} onSort={onSort} isNumeric />
    <SortableTh label="Comp" sortKey="completed" sortConfig={sortConfig} onSort={onSort} isNumeric />
    <SortableTh label="ASR%" sortKey="asr" sortConfig={sortConfig} onSort={onSort} isNumeric />
    <SortableTh label="ACD" sortKey="acd" sortConfig={sortConfig} onSort={onSort} isNumeric />
    <SortableTh label="Revenue" sortKey="revenue" sortConfig={sortConfig} onSort={onSort} isNumeric />
    <SortableTh label="Rev/min" sortKey="revenuePerMin" sortConfig={sortConfig} onSort={onSort} isNumeric />
    <SortableTh label="Margin" sortKey="margin" sortConfig={sortConfig} onSort={onSort} isNumeric />
    <SortableTh label="Margin %" sortKey="marginPercent" sortConfig={sortConfig} onSort={onSort} isNumeric />
  </Tr>
);

const VendorOnlyTableHead = ({ sortConfig, onSort }) => (
  <Tr>
    <SortableTh label="Account" sortKey="vendAccountCode" sortConfig={sortConfig} onSort={onSort} />
    <SortableTh label="Account Owner" sortKey="accountOwner" sortConfig={sortConfig} onSort={onSort} />
    <SortableTh label="Vendor" sortKey="vendor" sortConfig={sortConfig} onSort={onSort} />
    <SortableTh label="Destination Country" sortKey="vendDestination" sortConfig={sortConfig} onSort={onSort} />
    <SortableTh label="Attempts" sortKey="attempts" sortConfig={sortConfig} onSort={onSort} isNumeric />
    <SortableTh label="Comp" sortKey="completed" sortConfig={sortConfig} onSort={onSort} isNumeric />
    <SortableTh label="ASR%" sortKey="asr" sortConfig={sortConfig} onSort={onSort} isNumeric />
    <SortableTh label="ACD(Sec)" sortKey="acd" sortConfig={sortConfig} onSort={onSort} isNumeric />
    <SortableTh label="Cost" sortKey="cost" sortConfig={sortConfig} onSort={onSort} isNumeric />
    <SortableTh label="Cost/min" sortKey="costPerMin" sortConfig={sortConfig} onSort={onSort} isNumeric />
    <SortableTh label="Margin" sortKey="margin" sortConfig={sortConfig} onSort={onSort} isNumeric />
    <SortableTh label="Margin %" sortKey="marginPercent" sortConfig={sortConfig} onSort={onSort} isNumeric />
  </Tr>
);

// ─── Table Bodies ─────────────────────────────────────────────────────────────

const HourlyTableBody = React.memo(({ rows }) => (
  <>
    {rows.map((row, i) => (
      <Tr key={i}>
        <Td>{row.hour}</Td>
        <Td>{row.accountOwner ?? "-"}</Td>
        <Td isNumeric>{formatNumber(row.attempts)}</Td>
        <Td isNumeric>{formatNumber(row.completed)}</Td>
        <Td isNumeric>
          <Badge colorScheme={row.asr > 50 ? "green" : row.asr > 20 ? "yellow" : "red"}>
            {row.asr}%
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
    {rows.map((row, i) => (
      <Tr key={i}>
        <Td>{row.accountName}</Td>
        <Td>{row.accountOwner ?? "-"}</Td>
        <Td>{row.destination}</Td>
        <Td isNumeric>{formatNumber(row.attempts)}</Td>
        <Td isNumeric>{formatCurrency(row.revenue)}</Td>
        <Td isNumeric>{formatCurrency(row.cost)}</Td>
        <Td isNumeric>
          <Text color={row.margin >= 0 ? "green.500" : "red.500"} fontWeight="bold">
            {formatCurrency(row.margin)}
          </Text>
        </Td>
        <Td isNumeric>
          <Badge colorScheme={row.marginPercent >= 0 ? "green" : "red"}>{row.marginPercent}%</Badge>
        </Td>
        <Td isNumeric>{formatNumber(row.duration)}</Td>
      </Tr>
    ))}
  </>
));
MarginTableBody.displayName = "MarginTableBody";

const NegativeMarginTableBody = React.memo(({ rows }) => (
  <>
    {rows.map((row, i) => (
      <Tr key={i} bg="red.50">
        <Td>{row.accountCode}</Td>
        <Td>{row.accountName}</Td>
        <Td>{row.accountOwner ?? "-"}</Td>
        <Td>{row.destination}</Td>
        <Td isNumeric>{formatNumber(row.attempts)}</Td>
        <Td isNumeric>{formatCurrency(row.revenue)}</Td>
        <Td isNumeric>{formatCurrency(row.cost)}</Td>
        <Td isNumeric color="red.600" fontWeight="bold">{formatCurrency(row.margin)}</Td>
        <Td isNumeric><Badge colorScheme="red">{row.marginPercent}%</Badge></Td>
      </Tr>
    ))}
  </>
));
NegativeMarginTableBody.displayName = "NegativeMarginTableBody";

const CustomerVendorTableBody = React.memo(({ rows, isVendorReport }) => (
  <>
    {rows.map((row, i) => (
      <Tr key={i}>
        <Td fontSize="xs">{isVendorReport ? row.vendAccountCode ?? row.vendor : row.custAccountCode ?? row.customer}</Td>
        <Td fontSize="xs">{row.accountOwner ?? "-"}</Td>
        <Td fontSize="xs">{row.customer}</Td>
        <Td>{row.custDestination}</Td>
        <Td fontSize="xs">{row.vendor}</Td>
        <Td isNumeric>{formatNumber(row.attempts)}</Td>
        <Td isNumeric color="green.600">{formatNumber(row.completed)}</Td>
        <Td isNumeric><Badge colorScheme={row.asr > 40 ? "green" : "orange"}>{row.asr}%</Badge></Td>
        <Td isNumeric>{row.acd}</Td>
        <Td isNumeric>{formatCurrency(row.revenue)}</Td>
        <Td isNumeric>{formatCurrency(row.revenuePerMin)}</Td>
        {isVendorReport && (
          <>
            <Td isNumeric>{formatCurrency(row.cost)}</Td>
            <Td isNumeric>{formatCurrency(row.costPerMin)}</Td>
          </>
        )}
        <Td isNumeric color={row.margin >= 0 ? "green.600" : "red.500"}>{formatCurrency(row.margin)}</Td>
        <Td isNumeric>{row.marginPercent}%</Td>
      </Tr>
    ))}
  </>
));
CustomerVendorTableBody.displayName = "CustomerVendorTableBody";

const CustomerOnlyTableBody = React.memo(({ rows }) => (
  <>
    {rows.map((row, i) => (
      <Tr key={i}>
        <Td fontSize="xs">{row.customer}</Td>
        <Td fontSize="xs">{row.accountOwner ?? "-"}</Td>
        <Td>{row.custDestination}</Td>
        <Td isNumeric>{formatNumber(row.attempts)}</Td>
        <Td isNumeric color="green.600">{formatNumber(row.completed)}</Td>
        <Td isNumeric><Badge colorScheme={row.asr > 40 ? "green" : "orange"}>{row.asr}%</Badge></Td>
        <Td isNumeric>{row.acd}</Td>
        <Td isNumeric>{formatCurrency(row.revenue)}</Td>
        <Td isNumeric>{formatCurrency(row.revenuePerMin)}</Td>
        <Td isNumeric color={row.margin >= 0 ? "green.600" : "red.500"}>{formatCurrency(row.margin)}</Td>
        <Td isNumeric>{row.marginPercent}%</Td>
      </Tr>
    ))}
  </>
));
CustomerOnlyTableBody.displayName = "CustomerOnlyTableBody";

const VendorOnlyTableBody = React.memo(({ rows }) => (
  <>
    {rows.map((row, i) => (
      <Tr key={i}>
        <Td fontSize="xs">{row.vendAccountCode ?? row.vendor}</Td>
        <Td fontSize="xs">{row.accountOwner ?? "-"}</Td>
        <Td fontSize="xs">{row.vendor}</Td>
        <Td>{row.vendDestination}</Td>
        <Td isNumeric>{formatNumber(row.attempts)}</Td>
        <Td isNumeric color="green.600">{formatNumber(row.completed)}</Td>
        <Td isNumeric><Badge colorScheme={row.asr > 40 ? "green" : "orange"}>{row.asr}%</Badge></Td>
        <Td isNumeric>{row.acd}</Td>
        <Td isNumeric>{formatCurrency(row.cost)}</Td>
        <Td isNumeric>{formatCurrency(row.costPerMin)}</Td>
        <Td isNumeric color={row.margin >= 0 ? "green.600" : "red.500"}>{formatCurrency(row.margin)}</Td>
        <Td isNumeric>{row.marginPercent}%</Td>
      </Tr>
    ))}
  </>
));
VendorOnlyTableBody.displayName = "VendorOnlyTableBody";

export default Reports;