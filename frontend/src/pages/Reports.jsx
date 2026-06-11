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
  Text,
  useColorModeValue,
  VStack,
  Wrap,
  WrapItem,
} from "@chakra-ui/react";
import { MemoizedInput as Input, MemoizedSelect as Select } from "../components/memoizedinput/memoizedinput";
import PageNavBar from "../components/PageNavBar";
import DataTable from "../components/DataTable";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CalendarIcon,
  CheckCircleIcon,
  ChevronDownIcon,
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
  FiFileText,
  FiGrid,
  FiList,
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

const formatCurrency = (value, fractionDigits = 4) => {
  const parsed = parseFloat(value);
  if (value === undefined || value === null || isNaN(parsed)) return "$0.00";
  return new Intl.NumberFormat("en-US", {
    style:                 "currency",
    currency:              "USD",
    minimumFractionDigits: 4,
    maximumFractionDigits: fractionDigits,
  }).format(parsed);
};

const formatCurrencyRate = (value) => formatCurrency(value, 4);

const formatNumber = (value) => {
  const parsed = parseFloat(value);
  if (value === undefined || value === null || isNaN(parsed)) return "0";
  return new Intl.NumberFormat("en-US").format(parsed);
};

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

// ─── Column definitions ───────────────────────────────────────────────────────

const buildHourlyColumns = () => [
  {
    key:      "hour",
    header:   "Hour",
    minWidth: "80px",
  },
  {
    key:       "attempts",
    header:    "Attempts",
    isNumeric: true,
    minWidth:  "100px",
    render:    (value) => formatNumber(value),
  },
  {
    key:       "completed",
    header:    "Completed",
    isNumeric: true,
    minWidth:  "110px",
    render:    (value) => formatNumber(value),
  },
  {
    key:       "asr",
    header:    "ASR %",
    isNumeric: true,
    minWidth:  "100px",
    render:    (value) => (
      <Badge
        borderRadius="full"
        px="8px" py="2px"
        fontWeight="500" fontSize="11px"
        colorScheme={value > 50 ? "green" : value > 20 ? "yellow" : "red"}
      >
        {formatPercentage(value)}
      </Badge>
    ),
  },
  {
    key:       "acd",
    header:    "ACD (sec)",
    isNumeric: true,
    minWidth:  "110px",
  },
  {
    key:       "duration",
    header:    "Duration (sec)",
    isNumeric: true,
    minWidth:  "130px",
    render:    (value) => formatNumber(value),
  },
  {
    key:       "revenue",
    header:    "Revenue",
    isNumeric: true,
    minWidth:  "120px",
    render:    (value) => formatCurrency(value),
  },
  {
    key:       "cost",
    header:    "Cost",
    isNumeric: true,
    minWidth:  "120px",
    render:    (value) => formatCurrency(value),
  },
  {
    key:       "margin",
    header:    "Margin",
    isNumeric: true,
    minWidth:  "120px",
    render:    (value) => (
      <Text fontWeight="semibold" color={value >= 0 ? "green.600" : "red.500"}>
        {formatCurrency(value)}
      </Text>
    ),
  },
];

const buildMarginColumns = () => [
  {
    key:      "accountName",
    header:   "Customer",
    minWidth: "160px",
  },
  {
    key:      "accountOwner",
    header:   "Account Owner",
    minWidth: "140px",
    render:   (value) => value ?? "—",
  },
  {
    key:      "destination",
    header:   "Destination",
    minWidth: "140px",
  },
  {
    key:       "attempts",
    header:    "Attempts",
    isNumeric: true,
    minWidth:  "100px",
    render:    (value) => formatNumber(value),
  },
  {
    key:       "revenue",
    header:    "Revenue",
    isNumeric: true,
    minWidth:  "120px",
    render:    (value) => formatCurrency(value),
  },
  {
    key:       "cost",
    header:    "Cost",
    isNumeric: true,
    minWidth:  "120px",
    render:    (value) => formatCurrency(value),
  },
  {
    key:       "margin",
    header:    "Margin",
    isNumeric: true,
    minWidth:  "120px",
    render:    (value) => (
      <Text color={value >= 0 ? "green.600" : "red.500"} fontWeight="bold">
        {formatCurrency(value)}
      </Text>
    ),
  },
  {
    key:       "marginPercent",
    header:    "Margin %",
    isNumeric: true,
    minWidth:  "110px",
    render:    (value) => (
      <Badge
        borderRadius="full"
        px="8px" py="2px"
        fontWeight="500" fontSize="11px"
        colorScheme={value >= 0 ? "green" : "red"}
      >
        {formatPercentage(value)}
      </Badge>
    ),
  },
  {
    key:       "duration",
    header:    "Duration (Sec)",
    isNumeric: true,
    minWidth:  "130px",
    render:    (value) => formatNumber(value),
  },
];

const buildNegativeMarginColumns = () => [
  {
    key:      "accountCode",
    header:   "Account ID",
    minWidth: "120px",
  },
  {
    key:      "accountName",
    header:   "Customer",
    minWidth: "160px",
  },
  {
    key:      "accountOwner",
    header:   "Account Owner",
    minWidth: "140px",
    render:   (value) => value ?? "—",
  },
  {
    key:      "destination",
    header:   "Destination",
    minWidth: "140px",
  },
  {
    key:       "attempts",
    header:    "Attempts",
    isNumeric: true,
    minWidth:  "100px",
    render:    (value) => formatNumber(value),
  },
  {
    key:       "revenue",
    header:    "Revenue",
    isNumeric: true,
    minWidth:  "120px",
    render:    (value) => formatCurrency(value),
  },
  {
    key:       "cost",
    header:    "Cost",
    isNumeric: true,
    minWidth:  "120px",
    render:    (value) => formatCurrency(value),
  },
  {
    key:       "margin",
    header:    "Margin",
    isNumeric: true,
    minWidth:  "120px",
    render:    (value) => (
      <Text color="red.600" fontWeight="bold">{formatCurrency(value)}</Text>
    ),
  },
  {
    key:       "marginPercent",
    header:    "Margin %",
    isNumeric: true,
    minWidth:  "110px",
    render:    (value) => (
      <Badge
        borderRadius="full"
        px="8px" py="2px"
        fontWeight="500" fontSize="11px"
        colorScheme="red"
      >
        {formatPercentage(value)}
      </Badge>
    ),
  },
];

const buildCustomerVendorColumns = (isVendorReport) => [
  {
    key:      "accountOwner",
    header:   "Account Owner",
    minWidth: "130px",
  },
  {
    key:      "customer",
    header:   "Customer",
    minWidth: "130px",
    render:   (value) => <Text fontSize="xs">{value}</Text>,
  },
  {
    key:      "vendDestination",
    header:   "Destination",
    minWidth: "130px",
  },
  {
    key:      "vendor",
    header:   "Vendor",
    minWidth: "130px",
    render:   (value) => <Text fontSize="xs">{value}</Text>,
  },
  {
    key:       "attempts",
    header:    "Attempts",
    isNumeric: true,
    minWidth:  "100px",
    render:    (value) => formatNumber(value),
  },
  {
    key:       "completed",
    header:    "Comp",
    isNumeric: true,
    minWidth:  "80px",
    render:    (value) => <Text color="green.600">{formatNumber(value)}</Text>,
  },
  {
    key:       "asr",
    header:    "ASR%",
    isNumeric: true,
    minWidth:  "90px",
    render:    (value) => (
      <Badge
        borderRadius="full"
        px="8px" py="2px"
        fontWeight="500" fontSize="11px"
        colorScheme={value > 40 ? "green" : "orange"}
      >
        {formatPercentage(value)}
      </Badge>
    ),
  },
  {
    key:       "acd",
    header:    "ACD",
    isNumeric: true,
    minWidth:  "80px",
  },
  {
    key:       "revenue",
    header:    "Revenue",
    isNumeric: true,
    minWidth:  "120px",
    render:    (value) => formatCurrency(value),
  },
  {
    key:       "revenuePerMin",
    header:    "Rev/min",
    isNumeric: true,
    minWidth:  "110px",
    render:    (value) => formatCurrencyRate(value),
  },
  ...(isVendorReport
    ? [
        {
          key:       "cost",
          header:    "Cost",
          isNumeric: true,
          minWidth:  "120px",
          render:    (value) => formatCurrency(value),
        },
        {
          key:       "costPerMin",
          header:    "Cost/min",
          isNumeric: true,
          minWidth:  "110px",
          render:    (value) => formatCurrencyRate(value),
        },
      ]
    : []),
  {
    key:       "margin",
    header:    "Margin",
    isNumeric: true,
    minWidth:  "120px",
    render:    (value) => (
      <Text color={value >= 0 ? "green.600" : "red.500"}>{formatCurrency(value)}</Text>
    ),
  },
  {
    key:       "marginPercent",
    header:    "Margin %",
    isNumeric: true,
    minWidth:  "110px",
    render:    (value) => formatPercentage(value),
  },
];

const buildCustomerOnlyColumns = () => [
  {
    key:      "customer",
    header:   "Customer",
    minWidth: "150px",
    render:   (value) => <Text fontSize="xs">{value}</Text>,
  },
  {
    key:      "accountOwner",
    header:   "Account Owner",
    minWidth: "140px",
    render:   (value) => <Text fontSize="xs">{value ?? "—"}</Text>,
  },
  {
    key:      "vendDestination",
    header:   "Destination",
    minWidth: "130px",
  },
  {
    key:       "attempts",
    header:    "Attempts",
    isNumeric: true,
    minWidth:  "100px",
    render:    (value) => formatNumber(value),
  },
  {
    key:       "completed",
    header:    "Comp",
    isNumeric: true,
    minWidth:  "80px",
    render:    (value) => <Text color="green.600">{formatNumber(value)}</Text>,
  },
  {
    key:       "asr",
    header:    "ASR%",
    isNumeric: true,
    minWidth:  "90px",
    render:    (value) => (
      <Badge
        borderRadius="full"
        px="8px" py="2px"
        fontWeight="500" fontSize="11px"
        colorScheme={value > 40 ? "green" : "orange"}
      >
        {formatPercentage(value)}
      </Badge>
    ),
  },
  {
    key:       "acd",
    header:    "ACD",
    isNumeric: true,
    minWidth:  "80px",
  },
  {
    key:       "revenue",
    header:    "Revenue",
    isNumeric: true,
    minWidth:  "120px",
    render:    (value) => formatCurrency(value),
  },
  {
    key:       "revenuePerMin",
    header:    "Rev/min",
    isNumeric: true,
    minWidth:  "110px",
    render:    (value) => formatCurrencyRate(value),
  },
  {
    key:       "margin",
    header:    "Margin",
    isNumeric: true,
    minWidth:  "120px",
    render:    (value) => (
      <Text color={value >= 0 ? "green.600" : "red.500"}>{formatCurrency(value)}</Text>
    ),
  },
  {
    key:       "marginPercent",
    header:    "Margin %",
    isNumeric: true,
    minWidth:  "110px",
    render:    (value) => formatPercentage(value),
  },
];

const buildVendorOnlyColumns = () => [
  {
    key:      "accountOwner",
    header:   "Account Owner",
    minWidth: "140px",
    render:   (value) => <Text fontSize="xs">{value ?? "—"}</Text>,
  },
  {
    key:      "vendor",
    header:   "Vendor",
    minWidth: "140px",
    render:   (value) => <Text fontSize="xs">{value}</Text>,
  },
  {
    key:      "vendDestination",
    header:   "Destination Country",
    minWidth: "160px",
  },
  {
    key:       "attempts",
    header:    "Attempts",
    isNumeric: true,
    minWidth:  "100px",
    render:    (value) => formatNumber(value),
  },
  {
    key:       "completed",
    header:    "Comp",
    isNumeric: true,
    minWidth:  "80px",
    render:    (value) => <Text color="green.600">{formatNumber(value)}</Text>,
  },
  {
    key:       "asr",
    header:    "ASR%",
    isNumeric: true,
    minWidth:  "90px",
    render:    (value) => (
      <Badge
        borderRadius="full"
        px="8px" py="2px"
        fontWeight="500" fontSize="11px"
        colorScheme={value > 40 ? "green" : "orange"}
      >
        {formatPercentage(value)}
      </Badge>
    ),
  },
  {
    key:       "acd",
    header:    "ACD (Sec)",
    isNumeric: true,
    minWidth:  "100px",
  },
  {
    key:       "cost",
    header:    "Cost",
    isNumeric: true,
    minWidth:  "120px",
    render:    (value) => formatCurrency(value),
  },
  {
    key:       "costPerMin",
    header:    "Cost/min",
    isNumeric: true,
    minWidth:  "110px",
    render:    (value) => formatCurrencyRate(value),
  },
  {
    key:       "margin",
    header:    "Margin",
    isNumeric: true,
    minWidth:  "120px",
    render:    (value) => (
      <Text color={value >= 0 ? "green.600" : "red.500"}>{formatCurrency(value)}</Text>
    ),
  },
  {
    key:       "marginPercent",
    header:    "Margin %",
    isNumeric: true,
    minWidth:  "110px",
    render:    (value) => formatPercentage(value),
  },
];

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
  const [activeTab,             setActiveTab]             = useState(0);
  const [selectedAccount,       setSelectedAccount]       = useState("all");
  const [accounts,              setAccounts]              = useState({ customers: [], vendors: [] });
  const [accountsLoading,       setAccountsLoading]       = useState(false);
  const [isVendorReport,        setIsVendorReport]        = useState(false);
  const [reportData,            setReportData]            = useState([]);
  const [reportSummary,         setReportSummary]         = useState({});
  const [loading,               setLoading]               = useState(false);
  const [exporting,             setExporting]             = useState(false);
  const [marginThreshold,       setMarginThreshold]       = useState(0);
  const [searchTerm,            setSearchTerm]            = useState("");
  const [sortConfig,            setSortConfig]            = useState({ key: null, direction: "asc" });
  const [page,                  setPage]                  = useState(1);
  const [rowsPerPage,           setRowsPerPage]           = useState(50);
  const [selectedTrunk,         setSelectedTrunk]         = useState("all");
  const [selectedOwner,         setSelectedOwner]         = useState("all");
  const [selectedCountry,       setSelectedCountry]       = useState("all");
  const [countryOptions,        setCountryOptions]        = useState([]);
  const [countryLoading,        setCountryLoading]        = useState(false);
  const [missingGatewayTrigger, setMissingGatewayTrigger] = useState(0);
  const [filters]                                         = useState({ minASR: 0, maxASR: 100, minMargin: -100, maxMargin: 100 });
  const [missingGatewayRows, setMissingGatewayRows] = useState([]);

  const toast       = useNotify();
  const cardBg      = useColorModeValue("white", "gray.800");
  const borderColor = useColorModeValue("gray.200", "gray.700");
  const mutedColor  = useColorModeValue("gray.600", "gray.400");

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
  useEffect(() => { setPage(1); }, [searchTerm, sortConfig, reportData]);

  // ── Data loaders ───────────────────────────────────────────────────────────

  const loadAccounts = useCallback(async () => {
    setAccountsLoading(true);
    try {
      const data = await fetchReportAccounts();
      if (data.success) setAccounts(data);
    } catch (error) {
      toast({ title: "Error loading accounts", description: error.message, status: "error", duration: 3000, isClosable: true });
    } finally {
      setAccountsLoading(false);
    }
  }, [toast]);

  const loadCountryOptions = useCallback(async () => {
    setCountryLoading(true);
    try {
      const allRows  = [];
      let pageNumber = 1;

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
          value: item.value,
          label: item.label,
          codes: Array.from(item.codes).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
        }))
        .sort((a, b) => a.label.localeCompare(b.label));

      setCountryOptions(options);
    } catch (error) {
      toast({ title: "Error loading country list", description: error.message, status: "warning", duration: 3000, isClosable: true });
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
  if (index === 4)      setIsVendorReport(false);
  else if (index === 5) setIsVendorReport(true);
  if (index !== 6) {
    setMissingGatewayTrigger(0);
    setMissingGatewayRows([]);
  }
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

    const daysDiff = Math.ceil((dateRange.endDate - dateRange.startDate) / (1000 * 60 * 60 * 24));
    if (daysDiff > 62) {
      toast({ title: "Large date range", description: "For better performance, please select a date range under 2 months", status: "warning", duration: 3000, isClosable: true });
    }

    // ── Tab 6: delegate to MissingGateways via trigger ──────────────────────
    if (activeTab === 6) {
      setMissingGatewayTrigger((prev) => prev + 1);
      return;
    }

    // ── Tabs 0-5: standard report generation ───────────────────────────────
    setLoading(true);
    try {
      const accountsList       = isVendorReport ? accounts.vendors : accounts.customers;
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
            avgASR:               data.length > 0 ? data.reduce((s, r) => s + (r.asr ?? 0), 0) / data.length : 0,
            avgMarginPercent:     data.length > 0 ? data.reduce((s, r) => s + (r.marginPercent ?? 0), 0) / data.length : 0,
            totalCustomers:       uniqueArr(data.map((r) => r.customer ?? r.accountName)).length,
            totalVendors:         uniqueArr(data.map((r) => r.vendor   ?? r.vendAccountCode)).length,
            negativeMarginCalls:  data.filter((r) => (r.margin ?? 0) < 0).length,
            totalLoss:            data.filter((r) => (r.margin ?? 0) < 0).reduce((s, r) => s + r.margin, 0),
            affectedCustomers:    uniqueArr(data.filter((r) => (r.margin ?? 0) < 0).map((r) => r.customer ?? r.accountName ?? r.accountCode)).length,
            affectedDestinations: uniqueArr(data.filter((r) => (r.margin ?? 0) < 0).map((r) => r.destination)).length,
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
        duration:    3000,
        isClosable:  true,
        position:    "top-right",
      });
    } finally {
      setLoading(false);
    }
  }, [activeTab, accounts, dateRange, isVendorReport, selectedAccount, selectedCountry, selectedTrunk, toast]);

  const handleExport = useCallback(async (format) => {
  const data = activeTab === 6 ? missingGatewayRows : filteredDataRef.current;

  if (!data.length) {
    toast({ title: "No data to export", description: "Please generate a report first", status: "warning", duration: 3000, isClosable: true });
    return;
  }
  setExporting(true);
  try {
    const fileName = `report_${Date.now()}_${formatDateAsYmd(dateRange.startDate)}_to_${formatDateAsYmd(dateRange.endDate)}`;

    const accountsList       = isVendorReport ? accounts.vendors : accounts.customers;
    const selectedAccountObj = selectedAccount !== "all"
      ? accountsList.find((acc) => (isVendorReport ? acc.vendorCode : acc.customerCode) === selectedAccount)
      : null;

    const meta = {
      title:        REPORT_TITLES[activeTab] ?? "Report",
      startDate:    formatDateAsYmd(dateRange.startDate),
      endDate:      formatDateAsYmd(dateRange.endDate),
      periodLabel:  `${dateRange.startDate.toLocaleDateString()} - ${dateRange.endDate.toLocaleDateString()}`,
      account:      selectedAccountObj ? selectedAccountObj.accountName : "All Accounts",
      accountCode:  selectedAccountObj ? (isVendorReport ? selectedAccountObj.vendorCode : selectedAccountObj.customerCode) : "all",
      trunk:        selectedTrunk,
      generatedAt:  new Date().toISOString(),
      summary:      reportSummary,
      totalRecords: data.length,
    };

    await exportReport(data, format, fileName, meta);
    toast({ title: "Export Complete", description: `Exported as ${format.toUpperCase()}`, status: "success", duration: 3000, isClosable: true });
  } catch (error) {
    toast({ title: "Export Failed", description: error.message, status: "error", duration: 3000, isClosable: true });
  } finally {
    setExporting(false);
  }
}, [activeTab, missingGatewayRows, dateRange.endDate, dateRange.startDate, accounts, isVendorReport, selectedAccount, selectedTrunk, reportSummary, toast]);

  // ── Derived data ───────────────────────────────────────────────────────────

  const filteredData = useMemo(() => {
    let data = [...reportData];

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      data = data.filter((row) =>
        Object.values(row).some((v) => v != null && v.toString().toLowerCase().includes(term)),
      );
    }

    data = data.filter((row) => {
      const asr    = parseFloat(row.asr            ?? row.ASR           ?? 0);
      const margin = parseFloat(row.marginPercent   ?? row.MarginPercent ?? 0);
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

      const customer    = row.customer ?? row.Customer ?? row.accountName ?? row.customername;
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
      avgASR:  n > 0 ? sumASR / n : 0,
      avgACD:  n > 0 ? sumACD / n : 0,
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
      { label: "Avg ASR",         value: formatPercentage(reportSummary.avgASR          ?? 0, 2), icon: StarIcon,     color: "yellow" },
    ],
    1: [
      { label: "Total Revenue",   value: formatCurrency(reportSummary.totalRevenue      ?? 0), icon: FiTrendingUp,   color: "green"  },
      { label: "Total Cost",      value: formatCurrency(reportSummary.totalCost         ?? 0), icon: FiTrendingDown, color: "red"    },
      { label: "Total Margin",    value: formatCurrency(reportSummary.totalMargin       ?? 0), icon: FiBarChart2,    color: "blue"   },
      { label: "Avg Margin %",    value: formatPercentage(reportSummary.avgMarginPercent ?? 0, 2), icon: StarIcon,   color: "purple" },
    ],
    2: [
      { label: "Total Loss",         value: formatCurrency(Math.abs(reportSummary.totalLoss            ?? 0)), icon: WarningIcon,  color: "red"    },
      { label: "Negative Calls",     value: reportSummary.negativeMarginCalls?.toLocaleString()         ?? "0", icon: CloseIcon,   color: "orange" },
      { label: "Affected Customers", value: reportSummary.affectedCustomers?.toLocaleString()           ?? "0", icon: InfoIcon,    color: "yellow" },
      { label: "Destinations",       value: reportSummary.affectedDestinations?.toLocaleString()        ?? "0", icon: FiGrid,      color: "cyan"   },
    ],
    3: [
      { label: "Total Customers", value: reportSummary.totalCustomers?.toLocaleString() ?? "0", icon: FiList,         color: "blue"   },
      { label: "Total Attempts",  value: reportSummary.totalAttempts?.toLocaleString()  ?? "0", icon: FiBarChart2,    color: "green"  },
      { label: "Total Revenue",   value: formatCurrency(reportSummary.totalRevenue      ?? 0),  icon: FiTrendingUp,   color: "purple" },
      { label: "Total Cost",      value: formatCurrency(reportSummary.totalCost         ?? 0),  icon: FiTrendingDown, color: "red"    },
    ],
    4: [
      { label: "Total Customers", value: String(reportSummary.totalCustomers            ?? 0),  icon: FiGrid,         color: "purple" },
      { label: "Total Attempts",  value: reportSummary.totalAttempts?.toLocaleString()  ?? "0", icon: FiBarChart2,    color: "blue"   },
      { label: "Total Revenue",   value: formatCurrency(reportSummary.totalRevenue      ?? 0),  icon: FiTrendingUp,   color: "green"  },
      { label: "Avg ASR",         value: formatPercentage(reportSummary.avgASR          ?? 0, 2), icon: StarIcon,     color: "yellow" },
    ],
    5: [
      { label: "Total Vendors",   value: String(reportSummary.totalVendors              ?? 0),  icon: FiGrid,         color: "purple" },
      { label: "Total Attempts",  value: reportSummary.totalAttempts?.toLocaleString()  ?? "0", icon: FiBarChart2,    color: "blue"   },
      { label: "Total Revenue",   value: formatCurrency(reportSummary.totalRevenue      ?? 0),  icon: FiTrendingUp,   color: "green"  },
      { label: "Total Cost",      value: formatCurrency(reportSummary.totalCost         ?? 0),  icon: FiTrendingDown, color: "red"    },
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

  // ── Active columns ─────────────────────────────────────────────────────────

  const tableColumns = useMemo(() => {
    switch (activeTab) {
      case 0:  return buildHourlyColumns();
      case 1:  return buildMarginColumns();
      case 2:  return buildNegativeMarginColumns();
      case 3:  return buildCustomerVendorColumns(isVendorReport);
      case 4:  return buildCustomerOnlyColumns();
      case 5:  return buildVendorOnlyColumns();
      default: return [];
    }
  }, [activeTab, isVendorReport]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Box>
      <PageNavBar
        title="CDR Analytics Reports"
        description="Generate detailed reports and insights from CDR data"
        rightContent={
  <Menu>
    <MenuButton
      as={Button}
      size="sm"
      rightIcon={<ChevronDownIcon />}
      colorScheme="green"
      isLoading={exporting}
      isDisabled={activeTab === 6 ? !missingGatewayRows.length : !filteredData.length}
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
}
      />

      <Box mt={6} px={2}>

        {/* ── Report type selector + date / time controls ───────────────────── */}
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

            {/* Time pickers — shown for all tabs including 6 */}
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
        </Flex>

        {/* ── Controls + content (shared for all tabs) ──────────────────────── */}
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

        {activeTab === 6 ? (
          /* ── Missing Gateways ─────────────────────────────────────────────── */
          <MissingGateways
    startDate={formatDateAsYmd(dateRange.startDate)}
    endDate={formatDateAsYmd(dateRange.endDate)}
    startHour={dateRange.startHour}
    startMinute={dateRange.startMinute}
    endHour={dateRange.endHour}
    endMinute={dateRange.endMinute}
    vendorReport={isVendorReport}
    searchTerm={searchTerm}
    triggerLoad={missingGatewayTrigger}
    onDataReady={setMissingGatewayRows}
  />
        ) : (
          /* ── Standard report tabs 0-5 ─────────────────────────────────────── */
          <>
            {dashboardMetrics && (
              <DashboardMetrics
                metrics={dashboardMetrics}
                cardBg={cardBg}
                borderColor={borderColor}
                mutedColor={mutedColor}
              />
            )}

            {reportSummary && Object.keys(reportSummary).length > 0 && summaryConfig[activeTab] && (
              <ReportSummaryCards
                stats={summaryConfig[activeTab]}
                cardBg={cardBg}
                borderColor={borderColor}
                mutedColor={mutedColor}
              />
            )}

            <Card bg={cardBg} border="1px" borderColor={borderColor}>
              <CardHeader>
                <Flex
                  justify="space-between"
                  align={{ base: "stretch", md: "center" }}
                  gap={4}
                  direction={{ base: "column", md: "row" }}
                >
                  <VStack align="start" spacing={1}>
                    <Heading size="md">{REPORT_TITLES[activeTab] ?? "Report"}</Heading>
                    <Text fontSize="sm" color={mutedColor}>
                      Generated on {new Date().toLocaleDateString()} | Data range:{" "}
                      {dateRange.startDate.toLocaleDateString()} to {dateRange.endDate.toLocaleDateString()}
                    </Text>
                    <Badge
                      colorScheme={selectedTrunk === "all" ? "gray" : "blue"}
                      borderRadius="full"
                      px="8px" py="2px"
                      fontWeight="500" fontSize="11px"
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
                    <Badge
                      colorScheme="yellow"
                      borderRadius="full"
                      px="8px" py="2px"
                      fontWeight="500" fontSize="11px"
                      whiteSpace="nowrap"
                    >
                      {filteredData.length} records
                    </Badge>
                  </HStack>
                </Flex>
              </CardHeader>

              <CardBody px={2}>
                <DataTable
                  isLoading={loading}
                  columns={tableColumns}
                  data={paginatedData}
                  actions={false}
                  emptyMessage={
                    reportData.length === 0
                      ? "No report data yet."
                      : "No records match your search criteria."
                  }
                  striped
                  height="500px"
                  page={page}
                  pageSize={rowsPerPage}
                  total={filteredData.length}
                  onPageChange={setPage}
                  onPageSizeChange={(size) => { setRowsPerPage(size); setPage(1); }}
                />
              </CardBody>
            </Card>
          </>
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
  selectedCountry, setSelectedCountry, countryOptions, countryLoading,
  selectedTrunk, setSelectedTrunk,
  accounts, accountsLoading,
  marginThreshold, setMarginThreshold,
  loading, startDate, endDate, onGenerate, onClearFilters, hasActiveFilters, cardBg,
}) => (
  <Box mb={4} p={4} bg={cardBg} shadow="sm" borderRadius="md">
    <VStack spacing={6} align="stretch">
      <Flex direction={{ base: "column", lg: "row" }} gap={6} align={{ base: "stretch", lg: "flex-end" }}>

        {/* Report side — tabs 0, 1, 3, 6 */}
        {[0, 1, 3, 6].includes(activeTab) && (
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

        {/* Account Owner — hidden for tab 6 */}
        {activeTab !== 6 && (
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
        )}

        {/* Account selector — hidden for tab 6 */}
        {activeTab !== 6 && (
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
        )}

        {/* Trunk — hidden for tab 6 */}
        {activeTab !== 6 && (
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
        )}

        {/* Country — hidden for tab 6 */}
        {activeTab !== 6 && (
          <CountrySearchSelect
            label="Country"
            value={selectedCountry}
            options={countryOptions}
            onChange={setSelectedCountry}
            placeholder={countryLoading ? "Loading countries…" : "All Countries"}
            loading={countryLoading || loading}
          />
        )}

        {/* Negative margin threshold — tab 2 only */}
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

const CountrySearchSelect = React.memo(({
  label,
  value,
  options,
  onChange,
  placeholder = "Search country...",
  loading = false,
}) => {
  const wrapperRef = useRef(null);

  const [query,            setQuery]            = useState("");
  const [isOpen,           setIsOpen]           = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const selectedOption = useMemo(
    () => options.find((o) => o.value === value) || null,
    [options, value],
  );

  useEffect(() => {
    if (!isOpen) setQuery(selectedOption?.label || "");
  }, [selectedOption, isOpen]);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const filteredOptions = useMemo(() => {
    const term = query.trim().toLowerCase();
    const all  = [{ value: "all", label: "All Countries", codes: [] }, ...options];
    if (!term) return all;
    return all.filter((o) =>
      `${o.label} ${(o.codes || []).join(" ")}`.toLowerCase().includes(term)
    );
  }, [options, query]);

  useEffect(() => {
    if (!isOpen) return;
    const idx = filteredOptions.findIndex((o) => o.value === value);
    if (idx >= 0) {
      setHighlightedIndex(idx);
      setTimeout(() => {
        document.getElementById(`country-option-${idx}`)?.scrollIntoView({ block: "nearest" });
      }, 0);
    }
  }, [isOpen, value, filteredOptions]);

  const handleSelect = (option) => {
    onChange(option.value);
    setQuery(option.value === "all" ? "" : option.label);
    setIsOpen(false);
  };

  const handleKeyDown = (event) => {
    if (!isOpen) return;
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setHighlightedIndex((prev) => Math.min(prev + 1, filteredOptions.length - 1));
        break;
      case "ArrowUp":
        event.preventDefault();
        setHighlightedIndex((prev) => Math.max(prev - 1, 0));
        break;
      case "Enter":
        event.preventDefault();
        if (filteredOptions[highlightedIndex]) handleSelect(filteredOptions[highlightedIndex]);
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
      <Box ref={wrapperRef} position="relative">
        <InputGroup size="sm">
          <Input
            value={query}
            placeholder={placeholder}
            disabled={loading}
            onFocus={() => setIsOpen(true)}
            onClick={() => setIsOpen(true)}
            onKeyDown={handleKeyDown}
            onChange={(e) => {
              setQuery(e.target.value);
              setIsOpen(true);
              if (!e.target.value.trim()) onChange("all");
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
                onClick={() => { setQuery(""); onChange("all"); setIsOpen(false); }}
              />
            ) : null}
          </InputRightElement>
        </InputGroup>

        {isOpen && (
          <Box
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
              filteredOptions.map((option, index) => {
                const isSelected    = option.value === value;
                const isHighlighted = index === highlightedIndex;
                return (
                  <Box
                    id={`country-option-${index}`}
                    key={option.value}
                    px={3} py={2}
                    cursor="pointer"
                    bg={isHighlighted ? "gray.100" : isSelected ? "blue.50" : "transparent"}
                    _hover={{ bg: "gray.100" }}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    onClick={() => handleSelect(option)}
                  >
                    <VStack spacing={0} align="start">
                      <Text fontSize="sm" fontWeight={isSelected ? "700" : "500"}>
                        {option.label}
                      </Text>
                      {option.codes?.length > 0 && option.value !== "all" && (
                        <Text fontSize="xs" color="gray.500">
                          {option.codes.join(", ")}
                        </Text>
                      )}
                    </VStack>
                  </Box>
                );
              })
            ) : (
              <Box px={3} py={3}>
                <Text fontSize="sm" color="gray.500">No matching countries</Text>
              </Box>
            )}
          </Box>
        )}
      </Box>
    </FormControl>
  );
});
CountrySearchSelect.displayName = "CountrySearchSelect";

export default Reports;