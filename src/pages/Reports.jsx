import React, { useState, useEffect, useMemo } from "react";
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
  Select,
  Input,
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
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Stat,
  StatLabel,
  StatNumber,
  useColorModeValue,
  FormControl,
  FormLabel,
  Switch,
  useToast,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  Spinner,
  Center,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  NumberIncrementStepper,
  NumberDecrementStepper,
  Tag,
  Tooltip,
  Progress,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  InputGroup,
  InputLeftElement,
  Icon,
  Divider,
  Wrap,
  WrapItem,
  Slider,
  SliderTrack,
  SliderFilledTrack,
  SliderThumb,
  SliderMark,
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
} from "@chakra-ui/react";
import {
  DownloadIcon,
  CalendarIcon,
  ChevronDownIcon,
  ViewIcon,
  EditIcon,
  DeleteIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  SettingsIcon,
  AttachmentIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  SearchIcon,
  TimeIcon,
  WarningIcon,
  CheckCircleIcon,
  CloseIcon,
  StarIcon,
  InfoIcon,
  ChevronRightIcon as ChevronRight,
} from "@chakra-ui/icons";
import {
  FiFilter,
  FiBarChart2,
  FiTrendingUp,
  FiTrendingDown,
  FiPieChart,
  FiGrid,
  FiList,
  FiRefreshCw,
  FiEye,
  FiEyeOff,
} from "react-icons/fi";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
  ScatterChart,
  Scatter,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Treemap,
} from "recharts";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import {
  fetchReportAccounts,
  generateReport,
  exportReport,
} from "../utils/api";

const Reports = () => {
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().setDate(new Date().getDate() - 30)),
    endDate: new Date(),
    startHour: 0,
    endHour: 23,
  });
  const [activeTab, setActiveTab] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState("all");
  const [accounts, setAccounts] = useState({ customers: [], vendors: [] });
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [isVendorReport, setIsVendorReport] = useState(false);
  const [reportData, setReportData] = useState([]);
  const [reportSummary, setReportSummary] = useState({});
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [marginThreshold, setMarginThreshold] = useState(0);
  const [chartType, setChartType] = useState("bar");
  const [timeGranularity, setTimeGranularity] = useState("hour");
  const [viewType, setViewType] = useState("table");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });
  const [selectedRows, setSelectedRows] = useState([]);
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [filters, setFilters] = useState({
    minASR: 0,
    maxASR: 100,
    minMargin: -100,
    maxMargin: 100,
  });

  const toast = useToast();
  const cardBg = useColorModeValue("white", "gray.800");
  const borderColor = useColorModeValue("gray.200", "gray.700");
  const textColor = useColorModeValue("gray.800", "white");
  const mutedColor = useColorModeValue("gray.600", "gray.400");

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    setAccountsLoading(true);
    try {
      const data = await fetchReportAccounts();
      if (data.success) {
        setAccounts(data);
      }
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
  };

  const handleGenerateReport = async () => {
    if (!dateRange.startDate || !dateRange.endDate) {
      toast({
        title: "Date range required",
        description: "Please select start and end dates",
        status: "warning",
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    if (dateRange.endDate < dateRange.startDate) {
      toast({
        title: "Invalid date range",
        description: "End date must be after start date",
        status: "warning",
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    const daysDiff = Math.ceil(
      (dateRange.endDate - dateRange.startDate) / (1000 * 60 * 60 * 24),
    );
    if (daysDiff > 90) {
      toast({
        title: "Large date range",
        description:
          "For better performance, please select a date range under 90 days",
        status: "warning",
        duration: 5000,
        isClosable: true,
      });
    }

    setLoading(true);
    try {
      let reportType = "";
      let params = {
        startDate: dateRange.startDate.toISOString().split("T")[0],
        endDate: dateRange.endDate.toISOString().split("T")[0],
        startHour: dateRange.startHour,
        endHour: dateRange.endHour,
        accountId: selectedAccount,
        vendorReport: isVendorReport,
      };

      console.log("📊 Generating report with params:", params);

      switch (activeTab) {
        case 0: // Hourly Report
          reportType = "hourly-report";
          break;
        case 1: // Margin Report
          reportType = "margin-report";
          break;
        case 2: // Negative Margin Report
          reportType = "negative-margin-report";
          break;
        case 3: // Customer Traffic Report
          reportType = "customer-traffic";
          params.vendorReport = false;
          break;
      }

      const result = await generateReport(reportType, params);
      console.log("📈 Report result:", result);

      if (result.success || result.data) {
        const data = result.data || [];
        setReportData(data);

        if (result.summary && !Array.isArray(result.summary)) {
          setReportSummary(result.summary);
        } else {
          const summary = {
            totalAttempts: data.reduce((sum, r) => sum + (r.attempts || 0), 0),
            totalCompleted: data.reduce(
              (sum, r) => sum + (r.completed || 0),
              0,
            ),
            totalRevenue: data.reduce((sum, r) => sum + (r.revenue || 0), 0),
            totalCost: data.reduce((sum, r) => sum + (r.cost || 0), 0),
            totalMargin: data.reduce((sum, r) => sum + (r.margin || 0), 0),
            avgASR:
              data.length > 0
                ? data.reduce((sum, r) => sum + (r.asr || 0), 0) / data.length
                : 0,
            avgMarginPercent:
              data.length > 0
                ? data.reduce((sum, r) => sum + (r.marginPercent || 0), 0) /
                  data.length
                : 0,
            totalCustomers: [
              ...new Set(data.map((r) => r.customer || r.accountName)),
            ].filter(Boolean).length,
            negativeMarginCalls: data.filter((r) => (r.margin || 0) < 0).length,
            totalLoss: data
              .filter((r) => (r.margin || 0) < 0)
              .reduce((sum, r) => sum + r.margin, 0),
            affectedCustomers: [
              ...new Set(
                data
                  .filter((r) => (r.margin || 0) < 0)
                  .map((r) => r.customer || r.accountName || r.accountCode),
              ),
            ].filter(Boolean).length,
            affectedDestinations: [
              ...new Set(
                data
                  .filter((r) => (r.margin || 0) < 0)
                  .map((r) => r.destination),
              ),
            ].filter(Boolean).length,
          };
          setReportSummary(summary);
        }

        setIsModalOpen(false);
        setPage(1);
        setSelectedRows([]);

        toast({
          title: "Report Generated Successfully",
          description: `${data.length} records processed`,
          status: "success",
          duration: 3000,
          isClosable: true,
          position: "top-right",
        });
      } else {
        throw new Error(result.error || "Failed to generate report");
      }
    } catch (error) {
      console.error("❌ Report generation error:", error);
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
  };

  const handleExport = async (format) => {
    if (!reportData || reportData.length === 0) {
      toast({
        title: "No data to export",
        description: "Please generate a report first",
        status: "warning",
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    setExporting(true);
    try {
      const fileName = `report_${new Date().getTime()}_${dateRange.startDate.toISOString().split("T")[0]}_to_${dateRange.endDate.toISOString().split("T")[0]}`;
      await exportReport(reportData, format, fileName);

      toast({
        title: "Export Complete",
        description: `Report exported successfully as ${format.toUpperCase()}`,
        status: "success",
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: error.message,
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setExporting(false);
    }
  };

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
    if (!seconds || seconds === 0) return "00:00";
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const filteredData = useMemo(() => {
    let data = [...reportData];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      data = data.filter((row) => {
        return Object.keys(row).some((key) => {
          const value = row[key];
          return value && value.toString().toLowerCase().includes(term);
        });
      });
    }

    data = data.filter((row) => {
      const asr = parseFloat(
        row.asr || row.ASR || row.marginPercent || row.MarginPercent || 0,
      );
      const margin = parseFloat(
        row.margin || row.Margin || row.marPercent || row.MarPercent || 0,
      );

      return (
        asr >= filters.minASR &&
        asr <= filters.maxASR &&
        margin >= filters.minMargin &&
        margin <= filters.maxMargin
      );
    });

    if (sortConfig.key) {
      data.sort((a, b) => {
        let aValue = a[sortConfig.key];
        let bValue = b[sortConfig.key];

        if (!isNaN(parseFloat(aValue)) && !isNaN(parseFloat(bValue))) {
          aValue = parseFloat(aValue);
          bValue = parseFloat(bValue);
        }

        if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }

    return data;
  }, [reportData, searchTerm, sortConfig, filters]);

  const paginatedData = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    return filteredData.slice(start, end);
  }, [filteredData, page, rowsPerPage]);

  const totalPages = Math.ceil(filteredData.length / rowsPerPage);

  const handleSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const handleRowSelect = (id) => {
    if (selectedRows.includes(id)) {
      setSelectedRows(selectedRows.filter((rowId) => rowId !== id));
    } else {
      setSelectedRows([...selectedRows, id]);
    }
  };
   
  const dashboardMetrics = useMemo(() => {
    if (!reportData.length) return null;

    const metrics = {
      totalRevenue: 0,
      totalCost: 0,
      totalCalls: 0,
      totalMargin: 0,
      avgASR: 0,
      avgACD: 0,
      topCustomers: [],
      topDestinations: [],
    };

    const customerMap = {};
    const destinationMap = {};

    reportData.forEach((row) => {
      metrics.totalRevenue += parseFloat(
        row.revenue || row.Revenue || row.TotalRevenue || 0,
      );
      metrics.totalCost += parseFloat(row.cost || row.Cost || 0);
      metrics.totalCalls += parseInt(
        row.attempts || row.Attempts || row.TotalCalls || 0,
      );
      metrics.totalMargin += parseFloat(
        row.margin || row.Margin || row.TotalMargin || 0,
      );
      metrics.avgASR += parseFloat(row.asr || row.ASR || 0);
      metrics.avgACD += parseFloat(row.acd || row.ACD || 0);

      const customer =
        row.customer || row.Customer || row.accountName || row.customername;
      if (customer) {
        if (!customerMap[customer]) customerMap[customer] = 0;
        customerMap[customer] += parseFloat(row.revenue || row.Revenue || 0);
      }

      const destination =
        row.destination ||
        row.Destination ||
        row.custDestination ||
        row.CustDestination ||
        row.calleeareacode;
      if (destination) {
        if (!destinationMap[destination]) destinationMap[destination] = 0;
        destinationMap[destination] += parseInt(
          row.attempts || row.Attempts || 0,
        );
      }
    });

    if (reportData.length > 0) {
      metrics.avgASR /= reportData.length;
      metrics.avgACD /= reportData.length;
    }

    metrics.topCustomers = Object.entries(customerMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, revenue]) => ({ name, revenue }));

    metrics.topDestinations = Object.entries(destinationMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, calls]) => ({ name, calls }));

    return metrics;
  }, [reportData]);

  const ReportSummary = () => {
    if (!reportSummary || Object.keys(reportSummary).length === 0) return null;

    const summaries = {
      0: [
        {
          label: "Total Attempts",
          value: reportSummary.totalAttempts?.toLocaleString() || "0",
          icon: FiBarChart2,
          color: "blue.500",
        },
        {
          label: "Completed Calls",
          value: reportSummary.totalCompleted?.toLocaleString() || "0",
          icon: CheckCircleIcon,
          color: "green.500",
        },
        {
          label: "Total Revenue",
          value: formatCurrency(reportSummary.totalRevenue || 0),
          icon: FiTrendingUp,
          color: "green.500",
        },
        {
          label: "Avg ASR",
          value: `${reportSummary.avgASR?.toFixed(2) || "0.00"}%`,
          icon: StarIcon,
          color: "yellow.500",
        },
      ],
      1: [
        {
          label: "Total Revenue",
          value: formatCurrency(reportSummary.totalRevenue || 0),
          icon: FiTrendingUp,
          color: "green.500",
        },
        {
          label: "Total Cost",
          value: formatCurrency(reportSummary.totalCost || 0),
          icon: FiTrendingDown,
          color: "red.500",
        },
        {
          label: "Total Margin",
          value: formatCurrency(reportSummary.totalMargin || 0),
          icon: FiBarChart2,
          color: "blue.500",
        },
        {
          label: "Avg Margin %",
          value: `${reportSummary.avgMarginPercent?.toFixed(2) || "0.00"}%`,
          icon: StarIcon,
          color: "purple.500",
        },
      ],
      2: [
        {
          label: "Total Loss",
          value: formatCurrency(Math.abs(reportSummary.totalLoss || 0)),
          icon: WarningIcon,
          color: "red.500",
        },
        {
          label: "Negative Calls",
          value: reportSummary.negativeMarginCalls?.toLocaleString() || "0",
          icon: CloseIcon,
          color: "orange.500",
        },
        {
          label: "Affected Customers",
          value: reportSummary.affectedCustomers?.toLocaleString() || "0",
          icon: InfoIcon,
          color: "yellow.500",
        },
        {
          label: "Destinations",
          value: reportSummary.affectedDestinations?.toLocaleString() || "0",
          icon: FiGrid,
          color: "cyan.500",
        },
      ],
      3: [
        {
          label: "Total Customers",
          value: reportSummary.totalCustomers?.toLocaleString() || "0",
          icon: FiList,
          color: "blue.500",
        },
        {
          label: "Total Attempts",
          value: reportSummary.totalAttempts?.toLocaleString() || "0",
          icon: FiBarChart2,
          color: "green.500",
        },
        {
          label: "Total Revenue",
          value: formatCurrency(reportSummary.totalRevenue || 0),
          icon: FiTrendingUp,
          color: "purple.500",
        },
        {
          label: "Avg ASR",
          value: `${reportSummary.avgASR?.toFixed(3) || "0.00"}%`,
          icon: StarIcon,
          color: "yellow.500",
        },
      ],
    };

    return (
      <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={4} mb={6}>
        {summaries[activeTab]?.map((stat, index) => (
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
                  <Icon
                    as={stat.icon}
                    color={`${stat.color}.500`}
                    boxSize={5}
                  />
                </Box>

                <Stat>
                  <StatLabel color={mutedColor} fontSize="sm">
                    {stat.label}
                  </StatLabel>
                  <StatNumber fontSize="xl" color={`${stat.color}`}>
                    {stat.value}
                  </StatNumber>
                </Stat>
              </HStack>
            </CardBody>
          </Card>
        ))}
      </SimpleGrid>
    );
  };

  const DashboardMetrics = () => {
    if (!dashboardMetrics) return null;

    return (
      <Box p={4} bg={cardBg} border="1px" borderRadius={"md"} shadow={"lg"} borderColor={borderColor} mb={6}>
        
          <Heading mb={2} size="md">Performance Overview
        </Heading>
        
          <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={6}>
            <Box>
              <Text fontSize="sm" color={mutedColor}>
                Profit Margin
              </Text>
              <Heading
                size="lg"
                color={
                  dashboardMetrics.totalMargin >= 0 ? "green.500" : "red.500"
                }
              >
                {formatCurrency(dashboardMetrics.totalMargin)}
              </Heading>
              <Text fontSize="xs">
                {dashboardMetrics.totalRevenue > 0
                  ? (
                      (dashboardMetrics.totalMargin /
                        dashboardMetrics.totalRevenue) *
                      100
                    ).toFixed(6)
                  : 0}
                % margin
              </Text>
            </Box>
            <Box>
              <Text fontSize="sm" color={mutedColor}>
                Call Success Rate
              </Text>
              <Heading size="lg">
                {formatPercentage(dashboardMetrics.avgASR)}
              </Heading>
              <Progress
                value={dashboardMetrics.avgASR}
                colorScheme="green"
                size="sm"
                mt={1}
              />
            </Box>
            <Box>
              <Text fontSize="sm" color={mutedColor}>
                Avg Call Duration
              </Text>
              <Heading size="lg">
                {formatDuration(dashboardMetrics.avgACD)}
              </Heading>
              <Text fontSize="xs">per call</Text>
            </Box>
            <Box>
              <Text fontSize="sm" color={mutedColor}>
                Total Calls
              </Text>
              <Heading size="lg">
                {formatNumber(dashboardMetrics.totalCalls)}
              </Heading>
              <Text fontSize="xs">in selected period</Text>
            </Box>
          </SimpleGrid>
        
      </Box>
    );
  };

  const EnhancedTableView = () => {
    const getSortIcon = (key) => {
      if (sortConfig.key !== key) return null;
      return sortConfig.direction === "asc" ? (
        <ArrowUpIcon />
      ) : (
        <ArrowDownIcon />
      );
    };

    if (loading) {
      return (
        <Center py={20}>
          <VStack spacing={4}>
            <Spinner size="xl" color="blue.500" thickness="4px" />
            <VStack spacing={1}>
              <Text fontWeight="medium">Generating Report</Text>
              <Text fontSize="sm" color={mutedColor}>
                Processing your data...
              </Text>
            </VStack>
            <Progress
              size="xs"
              width="200px"
              isIndeterminate
              colorScheme="blue"
            />
          </VStack>
        </Center>
      );
    }

    if (!reportData || reportData.length === 0) {
      return (
        <Alert
          bg={"gray.200"}
          status="info"
          borderRadius="md"
          variant="subtle"
          flexDirection="column"
          alignItems="center"
          justifyContent="center"
          textAlign="center"
          height="auto"
        >
          <HStack spacing={4} align={"center"}>
            <AlertIcon boxSize="40px" mr={0} />
            <AlertTitle mb={1} fontSize="lg">
              No Report Data
            </AlertTitle>
          </HStack>
          <AlertDescription maxWidth="lg" fontSize={"sm"}>
            Generate a report to view analytics and insights from your CDR data.
          </AlertDescription>
        </Alert>
      );
    }

    const renderTable = () => {
      switch (activeTab) {
        case 0:
          return (
            <Box
              maxH="580px"
              overflowY="auto"
              border="1px solid"
              borderColor={borderColor}
              borderRadius="md"
            >
              <Table variant="simple" size="sm">
                <Thead h={"30px"} position="sticky" top={0} zIndex={10} bg="gray.200">
                  <Tr>
                    <Th cursor="pointer" color="gray.800" onClick={() => handleSort("hour")}>
                      <HStack>
                        <Text>Time Range</Text>
                        {getSortIcon("hour")}
                      </HStack>
                    </Th>
                    <Th
                      color="gray.800"
                      isNumeric
                      cursor="pointer"
                      onClick={() => handleSort("attempts")}
                    >
                      <HStack justify="flex-end">
                        <Text>Attempts</Text>
                        {getSortIcon("attempts")}
                      </HStack>
                    </Th>
                    <Th
                      color="gray.800"
                      isNumeric
                      cursor="pointer"
                      onClick={() => handleSort("completed")}
                    >
                      <HStack justify="flex-end">
                        <Text>Completed</Text>
                        {getSortIcon("completed")}
                      </HStack>
                    </Th>
                    <Th
                      color="gray.800"
                      isNumeric
                      cursor="pointer"
                      onClick={() => handleSort("asr")}
                    >
                      <HStack justify="flex-end">
                        <Text>ASR %</Text>
                        {getSortIcon("asr")}
                      </HStack>
                    </Th>
                    <Th
                      color="gray.800"
                      isNumeric
                      cursor="pointer"
                      onClick={() => handleSort("acd")}
                    >
                      <HStack justify="flex-end">
                        <Text>ACD (sec)</Text>
                        {getSortIcon("acd")}
                      </HStack>
                    </Th>
                    <Th
                      color="gray.800"
                      isNumeric
                      cursor="pointer"
                      onClick={() => handleSort("duration")}
                    >
                      <HStack justify="flex-end">
                        <Text>Duration(sec)</Text>
                        {getSortIcon("duration")}
                      </HStack>
                    </Th>
                    <Th
                      color="gray.800"
                      isNumeric
                      cursor="pointer"
                      onClick={() => handleSort("revenue")}
                    >
                      <HStack justify="flex-end">
                        <Text>Revenue</Text>
                        {getSortIcon("revenue")}
                      </HStack>
                    </Th>
                    <Th
                      color="gray.800"
                      isNumeric
                      cursor="pointer"
                      onClick={() => handleSort("cost")}
                    >
                      <HStack justify="flex-end">
                        <Text>Cost</Text>
                        {getSortIcon("cost")}
                      </HStack>
                    </Th>
                    <Th
                      color="gray.800"
                      isNumeric
                      cursor="pointer"
                      onClick={() => handleSort("margin")}
                    >
                      <HStack justify="flex-end">
                        <Text>Margin</Text>
                        {getSortIcon("margin")}
                      </HStack>
                    </Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {paginatedData.map((row, index) => (
                    <Tr key={index}>
                      <Td>{row.hour}</Td>
                      <Td isNumeric>{formatNumber(row.attempts)}</Td>
                      <Td isNumeric>{formatNumber(row.completed)}</Td>
                      <Td isNumeric>
                        <Badge
                          colorScheme={
                            row.asr > 50
                              ? "green"
                              : row.asr > 20
                                ? "yellow"
                                : "red"
                          }
                        >
                          {row.asr}%
                        </Badge>
                      </Td>
                      <Td isNumeric>{row.acd}</Td>
                      <Td isNumeric>{formatNumber(row.duration)}</Td>
                      <Td isNumeric>{formatCurrency(row.revenue)}</Td>
                      <Td isNumeric>{formatCurrency(row.cost)}</Td>
                      <Td isNumeric>
                        <Text
                          fontWeight={"semibold"}
                          color={row.margin >= 0 ? "green.600" : "red.500"}
                        >
                          {formatCurrency(row.margin)}
                        </Text>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </Box>
          );

        case 1:
          return (
            <Box
              maxH="500px"
              overflowY="auto"
              border="1px solid"
              borderColor="gray.200"
            >
              <Table variant="simple" size="sm">
                <Thead position="sticky" top={0} zIndex={1} bg="gray.200">
                  <Tr>
                    <Th 
                      color="gray.800"
                      cursor="pointer"
                      onClick={() => handleSort("accountCode")}
                    >
                      <HStack>
                        <Text>Account ID</Text>
                        {getSortIcon("accountCode")}
                      </HStack>
                    </Th>
                    <Th
                      color="gray.800"
                      cursor="pointer"
                      onClick={() => handleSort("accountName")}
                    >
                      <HStack>
                        <Text>Customer</Text>
                        {getSortIcon("accountName")}
                      </HStack>
                    </Th>
                    <Th
                      color="gray.800"
                      cursor="pointer"
                      onClick={() => handleSort("destination")}
                    >
                      <HStack>
                        <Text>Destination</Text>
                        {getSortIcon("destination")}
                      </HStack>
                    </Th>
                    <Th
                      color="gray.800"
                      isNumeric
                      cursor="pointer"
                      onClick={() => handleSort("attempts")}
                    >
                      <HStack justify="flex-end">
                        <Text>Attempts</Text>
                        {getSortIcon("attempts")}
                      </HStack>
                    </Th>
                    <Th
                      color="gray.800"
                      isNumeric
                      cursor="pointer"
                      onClick={() => handleSort("revenue")}
                    >
                      <HStack justify="flex-end">
                        <Text>Revenue</Text>
                        {getSortIcon("revenue")}
                      </HStack>
                    </Th>
                    <Th
                      color="gray.800"
                      isNumeric
                      cursor="pointer"
                      onClick={() => handleSort("cost")}
                    >
                      <HStack justify="flex-end">
                        <Text>Cost</Text>
                        {getSortIcon("cost")}
                      </HStack>
                    </Th>
                    <Th
                      color="gray.800"
                      isNumeric
                      cursor="pointer"
                      onClick={() => handleSort("margin")}
                    >
                      <HStack justify="flex-end">
                        <Text>Margin</Text>
                        {getSortIcon("margin")}
                      </HStack>
                    </Th>
                    <Th
                      color="gray.800"
                      isNumeric
                      cursor="pointer"
                      onClick={() => handleSort("marginPercent")}
                    >
                      <HStack justify="flex-end">
                        <Text>Margin %</Text>
                        {getSortIcon("marginPercent")}
                      </HStack>
                    </Th>
                    <Th
                      color="gray.800"
                      isNumeric
                      cursor="pointer"
                      onClick={() => handleSort("duration")}
                    >
                      <HStack justify="flex-end">
                        <Text>Duration (Sec)</Text>
                        {getSortIcon("duration")}
                      </HStack>
                    </Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {paginatedData.map((row, index) => (
                    <Tr key={index}>
                      <Td>{row.accountCode}</Td>
                      <Td>{row.accountName}</Td>
                      <Td>
                        <HStack>
                          <Text>{row.destination}</Text>
                        </HStack>
                      </Td>
                      <Td isNumeric>{formatNumber(row.attempts)}</Td>
                      <Td isNumeric>{formatCurrency(row.revenue)}</Td>
                      <Td isNumeric>{formatCurrency(row.cost)}</Td>
                      <Td isNumeric>
                        <Text
                          color={row.margin >= 0 ? "green.500" : "red.500"}
                          fontWeight="bold"
                        >
                          {formatCurrency(row.margin)}
                        </Text>
                      </Td>
                      <Td isNumeric>
                        <Badge
                          colorScheme={row.marginPercent >= 0 ? "green" : "red"}
                        >
                          {row.marginPercent}%
                        </Badge>
                      </Td>
                      <Td isNumeric>{formatNumber(row.duration)}</Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </Box>
          );

        case 2:
          return (
            <Box
              maxH="500px"
              overflowY="auto"
              border="1px solid"
              borderColor="red.200"
            >
              <Table variant="simple" size="sm">
                <Thead position="sticky" top={0} zIndex={1} bg="red.50">
                  <Tr>
                    <Th
                      color="gray.800"
                      cursor="pointer"
                      onClick={() => handleSort("accountCode")}
                    >
                      <HStack>
                        <Text>Account ID</Text>
                        {getSortIcon("accountCode")}
                      </HStack>
                    </Th>
                    <Th
                      color="gray.800"
                      cursor="pointer"
                      onClick={() => handleSort("accountName")}
                    >
                      <HStack>
                        <Text>Customer</Text>
                        {getSortIcon("accountName")}
                      </HStack>
                    </Th>
                    <Th
                      color="gray.800"
                      cursor="pointer"
                      onClick={() => handleSort("destination")}
                    >
                      <HStack>
                        <Text>Destination</Text>
                        {getSortIcon("destination")}
                      </HStack>
                    </Th>
                    <Th
                      color="gray.800"
                      isNumeric
                      cursor="pointer"
                      onClick={() => handleSort("attempts")}
                    >
                      <HStack justify="flex-end">
                        <Text>Attempts</Text>
                        {getSortIcon("attempts")}
                      </HStack>
                    </Th>
                    <Th
                      color="gray.800"
                      isNumeric
                      cursor="pointer"
                      onClick={() => handleSort("revenue")}
                    >
                      <HStack justify="flex-end">
                        <Text>Revenue</Text>
                        {getSortIcon("revenue")}
                      </HStack>
                    </Th>
                    <Th
                      color="gray.800"
                      isNumeric
                      cursor="pointer"
                      onClick={() => handleSort("cost")}
                    >
                      <HStack justify="flex-end">
                        <Text>Cost</Text>
                        {getSortIcon("cost")}
                      </HStack>
                    </Th>
                    <Th
                      color="gray.800"
                      isNumeric
                      cursor="pointer"
                      onClick={() => handleSort("margin")}
                    >
                      <HStack justify="flex-end">
                        <Text>Margin</Text>
                        {getSortIcon("margin")}
                      </HStack>
                    </Th>
                    <Th
                      color="gray.800"
                      isNumeric
                      cursor="pointer"
                      onClick={() => handleSort("marginPercent")}
                    >
                      <HStack justify="flex-end">
                        <Text>Margin %</Text>
                        {getSortIcon("marginPercent")}
                      </HStack>
                    </Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {paginatedData.map((row, index) => (
                    <Tr key={index} bg="red.50">
                      <Td>{row.accountCode}</Td>
                      <Td>{row.accountName}</Td>
                      <Td>{row.destination}</Td>
                      <Td isNumeric>{formatNumber(row.attempts)}</Td>
                      <Td isNumeric>{formatCurrency(row.revenue)}</Td>
                      <Td isNumeric>{formatCurrency(row.cost)}</Td>
                      <Td isNumeric color="red.600" fontWeight="bold">
                        {formatCurrency(row.margin)}
                      </Td>
                      <Td isNumeric>
                        <Badge colorScheme="red">{row.marginPercent}%</Badge>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </Box>
          );

        case 3:
          return (
            <Box
              maxH="500px"
              overflowY="auto"
              border="1px solid"
              borderColor="gray.200"
              borderRadius="md"
            >
              <Table variant="simple" size="sm">
                <Thead h={"30px"} position="sticky" top={0} zIndex={1} bg="gray.200">
                  <Tr>
                    <Th
                      color={"gray.700"}
                      cursor="pointer"
                      onClick={() => handleSort("customer")}
                      fontSize={"12px"}
                    >
                      <HStack>
                        <Text>Customer</Text>
                        {getSortIcon("customer")}
                      </HStack>
                    </Th>
                    <Th
                      color={"gray.700"}
                      
                      cursor="pointer"
                      onClick={() => handleSort("custDestination")}
                    >
                      <HStack>
                        <Text>Dest</Text>
                        {getSortIcon("custDestination")}
                      </HStack>
                    </Th>
                    <Th 
                      color={"gray.700"}

                     cursor="pointer" onClick={() => handleSort("vendor")}>
                      <HStack>
                        <Text>Vendor</Text>
                        {getSortIcon("vendor")}
                      </HStack>
                    </Th>
                    <Th
                      color={"gray.700"}

                      isNumeric
                      cursor="pointer"
                      onClick={() => handleSort("attempts")}
                    >
                      <HStack justify="flex-end">
                        <Text>Attempts</Text>
                        {getSortIcon("attempts")}
                      </HStack>
                    </Th>
                    <Th
                      color={"gray.700"}

                      isNumeric
                      cursor="pointer"
                      onClick={() => handleSort("completed")}
                    >
                      <HStack justify="flex-end">
                        <Text>Comp</Text>
                        {getSortIcon("completed")}
                      </HStack>
                    </Th>
                    <Th
                      color={"gray.700"}

                      isNumeric
                      cursor="pointer"
                      onClick={() => handleSort("asr")}
                    >
                      <HStack justify="flex-end">
                        <Text>ASR%</Text>
                        {getSortIcon("asr")}
                      </HStack>
                    </Th>
                    <Th
                      color={"gray.700"}

                      isNumeric
                      cursor="pointer"
                      onClick={() => handleSort("acd")}
                    >
                      <HStack justify="flex-end">
                        <Text>ACD</Text>
                        {getSortIcon("acd")}
                      </HStack>
                    </Th>
                    <Th
                      color={"gray.700"}

                      isNumeric
                      cursor="pointer"
                      onClick={() => handleSort("revenue")}
                    >
                      <HStack justify="flex-end">
                        <Text>Revenue</Text>
                        {getSortIcon("revenue")}
                      </HStack>
                    </Th>
                    <Th
                      color={"gray.700"}

                      isNumeric
                      cursor="pointer"
                      onClick={() => handleSort("margin")}
                    >
                      <HStack justify="flex-end">
                        <Text>Margin</Text>
                        {getSortIcon("margin")}
                      </HStack>
                    </Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {paginatedData.map((row, index) => (
                    <Tr key={index}>
                      <Td fontSize="xs">{row.customer}</Td>
                      <Td>{row.custDestination}</Td>
                      <Td fontSize="xs">{row.vendor}</Td>
                      <Td isNumeric>{formatNumber(row.attempts)}</Td>
                      <Td color={"green"} isNumeric>
                        {formatNumber(row.completed)}
                      </Td>
                      <Td isNumeric>
                        <Badge colorScheme={row.asr > 40 ? "green" : "orange"}>
                          {row.asr}%
                        </Badge>
                      </Td>
                      <Td isNumeric>{row.acd}</Td>
                      <Td isNumeric>{formatCurrency(row.revenue)}</Td>
                      <Td
                        isNumeric
                        color={row.margin >= 0 ? "green.600" : "red.500"}
                      >
                        {formatCurrency(row.margin)}
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </Box>
          );

        default:
          return null;
      }
    };

    return (
      <>
        {renderTable()}

        <Flex justify="space-between" align="center" mt={4} py={2}>
          <HStack spacing={3}>
            <Menu>
              <MenuButton as={Button} size="sm" variant="outline">
                <HStack spacing={2}>
                  <FiEye /><Text>{rowsPerPage}</Text> 
                  <ChevronDownIcon ml={1} />
                </HStack>
              </MenuButton>
              <MenuList>
                <MenuItem onClick={() => setRowsPerPage(50)}>
                  50 per page
                </MenuItem>
                <MenuItem onClick={() => setRowsPerPage(100)}>
                  100 per page
                </MenuItem>
                <MenuItem onClick={() => setRowsPerPage(250)}>
                  250 per page
                </MenuItem>
              </MenuList>
            </Menu>
            <Text fontSize="sm" color={mutedColor}>
              Showing {(page - 1) * rowsPerPage + 1} to{" "}
              {Math.min(page * rowsPerPage, filteredData.length)} of{" "}
              {filteredData.length} entries
            </Text>
          </HStack>

          <HStack spacing={2}>
            <IconButton
              icon={<ChevronLeftIcon />}
              size="sm"
              onClick={() => setPage(Math.max(1, page - 1))}
              isDisabled={page === 1}
              aria-label="Previous page"
            />

            {[...Array(Math.min(5, totalPages))].map((_, i) => {
              let pageNum =
                totalPages <= 5
                  ? i + 1
                  : page <= 3
                    ? i + 1
                    : page >= totalPages - 2
                      ? totalPages - 4 + i
                      : page - 2 + i;

              return (
                <Button
                  key={pageNum}
                  size="sm"
                  variant={page === pageNum ? "solid" : "outline"}
                  colorScheme={page === pageNum ? "blue" : "gray"}
                  onClick={() => setPage(pageNum)}
                >
                  {pageNum}
                </Button>
              );
            })}

            <IconButton
              icon={<ChevronRightIcon />}
              size="sm"
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              isDisabled={page === totalPages}
              aria-label="Next page"
            />
          </HStack>
        </Flex>
      </>
    );
  };

  const ChartVisualization = () => {
    if (!reportData || reportData.length === 0) return null;

    const chartData = reportData.slice(0, 20).map((item) => ({
      name:
        item.hour ||
        item.customer ||
        item.Customer ||
        item.accountName ||
        item.AccountID ||
        "Unknown",
      revenue: parseFloat(
        item.revenue || item.Revenue || item.TotalRevenue || 0,
      ),
      cost: parseFloat(item.cost || item.Cost || 0),
      margin: parseFloat(item.margin || item.Margin || item.TotalMargin || 0),
      asr: parseFloat(item.asr || item.ASR || 0),
      attempts: parseInt(
        item.attempts || item.Attempts || item.TotalAttempts || 0,
      ),
    }));

    const renderChart = () => {
      switch (chartType) {
        case "bar":
          return (
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="name"
                angle={-45}
                textAnchor="end"
                height={80}
                fontSize={12}
              />
              <YAxis />
              <RechartsTooltip
                formatter={(value) => [formatCurrency(value), ""]}
                labelFormatter={(label) => `Customer: ${label}`}
              />
              <Legend />
              <Bar dataKey="revenue" name="Revenue" fill="#3182CE" />
              <Bar dataKey="cost" name="Cost" fill="#E53E3E" />
              <Bar dataKey="margin" name="Margin" fill="#38A169" />
            </BarChart>
          );

        case "line":
          return (
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="name"
                angle={-45}
                textAnchor="end"
                height={80}
                fontSize={12}
              />
              <YAxis />
              <RechartsTooltip
                formatter={(value, name) => {
                  if (name === "asr") return [`${value}%`, "ASR"];
                  return [formatCurrency(value), name];
                }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="revenue"
                stroke="#3182CE"
                strokeWidth={2}
                dot={{ r: 4 }}
              />
              <Line
                type="monotone"
                dataKey="margin"
                stroke="#38A169"
                strokeWidth={2}
                dot={{ r: 4 }}
              />
            </LineChart>
          );

        case "area":
          return (
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="name"
                angle={-45}
                textAnchor="end"
                height={80}
                fontSize={12}
              />
              <YAxis />
              <RechartsTooltip
                formatter={(value) => [formatCurrency(value), ""]}
              />
              <Legend />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#3182CE"
                fill="#3182CE"
                fillOpacity={0.3}
              />
              <Area
                type="monotone"
                dataKey="margin"
                stroke="#38A169"
                fill="#38A169"
                fillOpacity={0.3}
              />
            </AreaChart>
          );

        case "pie":
          const pieData = chartData
            .slice(0, 8)
            .map((item) => ({ name: item.name, value: item.revenue }));
          const COLORS = [
            "#0088FE",
            "#00C49F",
            "#FFBB28",
            "#FF8042",
            "#8884D8",
            "#82CA9D",
            "#FFC658",
            "#FF6B6B",
          ];

          return (
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) =>
                  `${name}: ${(percent * 100).toFixed(0)}%`
                }
                outerRadius={150}
                fill="#8884d8"
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </Pie>
              <RechartsTooltip
                formatter={(value) => [formatCurrency(value), "Revenue"]}
              />
              <Legend />
            </PieChart>
          );

        default:
          return null;
      }
    };

    return (
      <Card bg={cardBg} border="1px" borderColor={borderColor} mt={6}>
        <CardHeader>
          <Flex justify="space-between" align="center">
            <Heading size="md">Data Visualization</Heading>
            <HStack spacing={3}>
              <Select
                size="sm"
                w="150px"
                value={chartType}
                onChange={(e) => setChartType(e.target.value)}
              >
                <option value="bar">Bar Chart</option>
                <option value="line">Line Chart</option>
                <option value="area">Area Chart</option>
                <option value="pie">Pie Chart</option>
              </Select>
              <Select
                size="sm"
                w="150px"
                value={viewType}
                onChange={(e) => setViewType(e.target.value)}
              >
                <option value="table">Table View</option>
                <option value="chart">Chart View</option>
                <option value="both">Both</option>
              </Select>
            </HStack>
          </Flex>
        </CardHeader>
        <CardBody>
          <Box height="400px">
            <ResponsiveContainer width="100%" height="100%">
              {renderChart()}
            </ResponsiveContainer>
          </Box>
        </CardBody>
      </Card>
    );
  };

  return (
    <Box>
              <Flex justify="space-between" align="center" bgGradient="linear(to-r,blue.100,blue.200,blue.300)" px={4} py={2} mb={6} borderRadius={"12px"}>
      
        <Box>
          <Heading size="lg" color={"gray.600"}>
            CDR Analytics Reports
          </Heading>
          <Text color={mutedColor}>
            Generate detailed reports and insights from CDR data
          </Text>
        </Box>

        <HStack spacing={3}>
          <Button
            size="sm"
            leftIcon={<FiRefreshCw />}
            variant="ghost"
            onClick={() => loadAccounts()}
            isLoading={accountsLoading}
          >
            Refresh
          </Button>

          <Button
            size="sm"
            leftIcon={<CalendarIcon />}
            colorScheme="green"
            onClick={() => setIsModalOpen(true)}
          >
            Generate Report
          </Button>

          <Menu>
            <MenuButton
              size="sm"
              as={Button}
              rightIcon={<ChevronDownIcon />}
              colorScheme="green"
              isLoading={exporting}
              isDisabled={!reportData || reportData.length === 0}
            >
              <DownloadIcon mr={2} />
              Export
            </MenuButton>
            <MenuList>
              <MenuItem
                icon={<DownloadIcon />}
                onClick={() => handleExport("csv")}
              >
                Export as CSV
              </MenuItem>
              <MenuItem
                icon={<DownloadIcon />}
                onClick={() => handleExport("excel")}
              >
                Export as Excel
              </MenuItem>
              <Divider />
              <MenuItem icon={<SettingsIcon />} onClick={() => window.print()}>
                Print Report
              </MenuItem>
            </MenuList>
          </Menu>
        </HStack>
      </Flex>

      {dashboardMetrics && <DashboardMetrics />}

      <Tabs
        variant={{ base: "line", md: "line" }}
        colorScheme="blue"
        mb={8}
        index={activeTab}
        onChange={(index) => {
          setActiveTab(index);
          setReportData([]);
          setReportSummary({});
          setPage(1);
        }}
      >
        <TabList gap={8}>
          <Tab>
            <HStack spacing={2}>
              <TimeIcon />
              <Text>Hourly Reports</Text>
            </HStack>
          </Tab>
          <Tab>
            <HStack spacing={2}>
              <FiBarChart2 />
              <Text>Margin Reports</Text>
            </HStack>
          </Tab>
          <Tab>
            <HStack spacing={2}>
              <FiTrendingDown />
              <Text>Negative Margin</Text>
            </HStack>
          </Tab>
          <Tab>
            <HStack spacing={2}>
              <FiList />
              <Text>Customer Traffic</Text>
            </HStack>
          </Tab>
        </TabList>

        <TabPanels>
          {[0, 1, 2, 3].map((tabIndex) => (
            <TabPanel key={tabIndex} px={0}>
              <ReportSummary />

              <Box mb={4}>
                <InputGroup w={"300px"} bg={"white"}>
                  <InputLeftElement pointerEvents="none">
                    <SearchIcon color="gray.400" />
                  </InputLeftElement>
                  <Input
                    placeholder="Search in report..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </InputGroup>
              </Box>

              <Card bg={cardBg} border="1px" borderColor={borderColor}>
                <CardHeader>
                  <Flex justify="space-between" align="center">
                    <VStack align="start" spacing={1}>
                      <Heading size="md">
                        {
                          [
                            "Hourly Report",
                            "Margin Report",
                            "Negative Margin Report",
                            "Customer Traffic Report",
                          ][tabIndex]
                        }
                      </Heading>
                      <Text fontSize="sm" color={mutedColor}>
                        Generated on {new Date().toLocaleDateString()} | Data
                        range: {dateRange.startDate.toLocaleDateString()} to{" "}
                        {dateRange.endDate.toLocaleDateString()}
                      </Text>
                    </VStack>

                      <Badge colorScheme="yellow" fontSize="sm" px={3} py={1}>
                        {filteredData.length} records
                      </Badge>
                    
                  </Flex>
                </CardHeader>
                <CardBody overflowX="auto">
                  <EnhancedTableView />
                </CardBody>
              </Card>

              <ChartVisualization />
            </TabPanel>
          ))}
        </TabPanels>
      </Tabs>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        size="xl"
        isCentered
        scrollBehavior="inside"
      >
        <ModalOverlay backdropFilter="blur(4px)" />
        <ModalContent>
          <ModalHeader bg="blue.500" color="white" borderTopRadius="md">
            <HStack>
              <FiFilter />
              <Text>
                Generate{" "}
                {
                  ["Hourly", "Margin", "Negative Margin", "Customer Traffic"][
                    activeTab
                  ]
                }{" "}
                Report
              </Text>
            </HStack>
          </ModalHeader>
          <ModalCloseButton color="white" />
          <ModalBody py={6}>
            <VStack spacing={6} align="stretch">
              <Box>
                <FormLabel fontWeight="bold">Date Range</FormLabel>
                <HStack mb={3}>
                  {[
                    { label: "Today", days: 0 },
                    { label: "Yesterday", days: 1 },
                    { label: "Last 7 Days", days: 7 },
                    { label: "Last 30 Days", days: 30 },
                    { label: "Last 90 Days", days: 90 },
                  ].map((option) => (
                    <Button
                      key={option.label}
                      size="xs"
                      variant="outline"
                      onClick={() => {
                        const end = new Date();
                        const start = new Date();
                        start.setDate(start.getDate() - option.days);
                        setDateRange({
                          startDate: start,
                          endDate: end,
                          startHour: 0,
                          endHour: 23,
                        });
                      }}
                    >
                      {option.label}
                    </Button>
                  ))}
                </HStack>
                <HStack>
                  <Box flex={1}>
                    <FormLabel fontSize="sm">Start Date</FormLabel>
                    <DatePicker
                      selected={dateRange.startDate}
                      onChange={(date) =>
                        setDateRange({ ...dateRange, startDate: date })
                      }
                      selectsStart
                      startDate={dateRange.startDate}
                      endDate={dateRange.endDate}
                      dateFormat="yyyy-MM-dd"
                      customInput={<Input />}
                      isClearable
                    />
                  </Box>
                  <Box flex={1}>
                    <FormLabel fontSize="sm">End Date</FormLabel>
                    <DatePicker
                      selected={dateRange.endDate}
                      onChange={(date) =>
                        setDateRange({ ...dateRange, endDate: date })
                      }
                      selectsEnd
                      startDate={dateRange.startDate}
                      endDate={dateRange.endDate}
                      minDate={dateRange.startDate}
                      dateFormat="yyyy-MM-dd"
                      customInput={<Input />}
                      isClearable
                    />
                  </Box>
                </HStack>
                <HStack mt={4} spacing={4}>
                  <Box flex={1}>
                    <FormLabel fontSize="sm">From Hour</FormLabel>
                    <Menu>
                      <MenuButton as={Button} size="sm" variant="outline">
                        {dateRange.startHour.toString().padStart(2, "0")}:00
                      </MenuButton>
                      <MenuList maxH="200px" overflowY="auto">
                        {[...Array(24).keys()].map((hour) => (
                          <MenuItem
                            key={hour}
                            onClick={() =>
                              setDateRange({ ...dateRange, startHour: hour })
                            }
                          >
                            {hour.toString().padStart(2, "0")}:00
                          </MenuItem>
                        ))}
                      </MenuList>
                    </Menu>
                  </Box>
                  <Box flex={1}>
                    <FormLabel fontSize="sm">To Hour</FormLabel>
                    <Menu>
                      <MenuButton as={Button} size="sm" variant="outline">
                        {dateRange.endHour.toString().padStart(2, "0")}:59
                      </MenuButton>
                      <MenuList maxH="200px" overflowY="auto">
                        {[...Array(24).keys()].map((hour) => (
                          <MenuItem
                            key={hour}
                            onClick={() =>
                              setDateRange({ ...dateRange, endHour: hour })
                            }
                          >
                            {hour.toString().padStart(2, "0")}:59
                          </MenuItem>
                        ))}
                      </MenuList>
                    </Menu>
                  </Box>
                </HStack>
                <Text fontSize="xs" color="gray.500" mt={2}>
                  {Math.ceil(
                    (dateRange.endDate - dateRange.startDate) /
                      (1000 * 60 * 60 * 24),
                  )}{" "}
                  days selected
                </Text>
              </Box>

              <FormControl>
                <FormLabel fontWeight="bold">
                  {isVendorReport ? "Vendor Account" : "Customer Account"}
                </FormLabel>
                <Select
                  value={selectedAccount}
                  onChange={(e) => setSelectedAccount(e.target.value)}
                  placeholder={
                    accountsLoading
                      ? "Loading accounts..."
                      : "Select an account"
                  }
                  isDisabled={accountsLoading}
                >
                  <option value="all">All Accounts</option>
                  <option value="top10">Top 10 Accounts by Revenue</option>
                  <option value="active">Active Accounts Only</option>
                  {(isVendorReport ? accounts.vendors : accounts.customers).map(
                    (account) => (
                      <option
                        key={account.id || account._id}
                        value={
                          isVendorReport
                            ? account.vendorCode
                            : account.customerCode
                        }
                      >
                        {account.customerCode} ({account.accountName})
                      </option>
                    ),
                  )}
                </Select>
              </FormControl>

              <Accordion allowToggle>
                <AccordionItem border="none">
                  <AccordionButton px={0} py={2}>
                    <Box flex="1" textAlign="left" fontWeight="medium">
                      Advanced Options
                    </Box>
                    <AccordionIcon />
                  </AccordionButton>
                  <AccordionPanel px={0} pb={0}>
                    <VStack spacing={4} align="stretch">
                      {[0, 1].includes(activeTab) && (
                        <FormControl display="flex" alignItems="center">
                          <Switch
                            id="vendor-report"
                            isChecked={isVendorReport}
                            onChange={(e) => {
                              setIsVendorReport(e.target.checked);
                              setSelectedAccount("all");
                            }}
                            colorScheme="blue"
                            size="lg"
                          />
                          <FormLabel htmlFor="vendor-report" mb={0} ml={3}>
                            Generate Vendor Report
                          </FormLabel>
                        </FormControl>
                      )}

                      {activeTab === 3 && (
                        <FormControl display="flex" alignItems="center">
                          <Switch
                            id="vendor-traffic"
                            isChecked={isVendorReport}
                            onChange={(e) => {
                              setIsVendorReport(e.target.checked);
                              setSelectedAccount("all");
                            }}
                            colorScheme="blue"
                            size="lg"
                          />
                          <FormLabel htmlFor="vendor-traffic" mb={0} ml={3}>
                            Show Vendor Traffic instead
                          </FormLabel>
                        </FormControl>
                      )}

                      {activeTab === 2 && (
                        <FormControl>
                          <FormLabel>Negative Margin Threshold</FormLabel>
                          <HStack spacing={4}>
                            <NumberInput
                              value={marginThreshold}
                              onChange={(value) => setMarginThreshold(value)}
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
                            <Slider
                              value={marginThreshold}
                              onChange={(value) => setMarginThreshold(value)}
                              min={-100}
                              max={0}
                              step={1}
                              width="200px"
                            >
                              <SliderTrack>
                                <SliderFilledTrack bg="red.500" />
                              </SliderTrack>
                              <SliderThumb />
                            </Slider>
                          </HStack>
                          <Text fontSize="sm" color="gray.500" mt={1}>
                            Show calls with margin below: {marginThreshold}%
                          </Text>
                        </FormControl>
                      )}

                      <FormControl>
                        <FormLabel>Time Granularity</FormLabel>
                        <Select
                          value={timeGranularity}
                          onChange={(e) => setTimeGranularity(e.target.value)}
                        >
                          <option value="hour">Hourly</option>
                          <option value="day">Daily</option>
                          <option value="week">Weekly</option>
                          <option value="month">Monthly</option>
                        </Select>
                      </FormControl>

                      <FormControl>
                        <FormLabel>Result Limit</FormLabel>
                        <Select
                          value={rowsPerPage}
                          onChange={(e) =>
                            setRowsPerPage(parseInt(e.target.value))
                          }
                        >
                          <option value={50}>50 rows</option>
                          <option value={100}>100 rows</option>
                          <option value={250}>250 rows</option>
                          <option value={500}>500 rows</option>
                          <option value={1000}>1000 rows</option>
                        </Select>
                      </FormControl>
                    </VStack>
                  </AccordionPanel>
                </AccordionItem>
              </Accordion>
            </VStack>
          </ModalBody>

          <ModalFooter>
            <HStack spacing={6} width="100%">
              <Button
                size={"md"}
                variant="outline"
                onClick={() => setIsModalOpen(false)}
                flex={1}
              >
                Cancel
              </Button>
              <Button
                colorScheme="blue"
                onClick={handleGenerateReport}
                isLoading={loading}
                leftIcon={<FiFilter />}
                flex={2}
                size="md"
              >
                Generate Report
              </Button>
            </HStack>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
};

export default Reports;
