import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Box,
  Heading,
  SimpleGrid,
  Card,
  CardBody,
  Text,
  VStack,
  HStack,
  Badge,
  Icon,
  useToast,
  Flex,
  Grid,
  GridItem,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  TableContainer,
  StackDivider,
  Avatar,
  Divider,
  Select,
  CardHeader,
  Center,
  Spinner,
} from "@chakra-ui/react";
import PageNavBar from "../components/PageNavBar";
import {
  FiPhoneCall,
  FiDollarSign,
  FiUsers,
  FiClock,
  FiTrendingUp,
  FiTrendingDown,
  FiActivity,
  FiGlobe,
  FiCalendar,
  FiPercent,
} from "react-icons/fi";
import {
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Line,
} from "recharts";
import { fetchDashboardStats, fetchTopDestinations } from "../utils/api";
import { format } from "date-fns";
import { BlinkBlur, Slab } from "react-loading-indicators";

// ── helpers ───────────────────────────────────────────────────
const formatDuration = (minutes) => {
  if (!minutes) return "0m";
  const hours = Math.floor(minutes / 60);
  const mins  = Math.floor(minutes % 60);
  return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
};

const formatACD = (decimalMinutes) => {
  if (!decimalMinutes || decimalMinutes === 0) return "0:00";
  const totalSeconds = Math.floor(decimalMinutes * 60);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

// Rolling 3-point average for trend line — avoids flat-line-over-bar visual
const withTrend = (data = []) =>
  data.map((d, i, arr) => {
    const slice = arr.slice(Math.max(0, i - 2), i + 1);
    const avg   = slice.reduce((s, x) => s + (x.calls || 0), 0) / slice.length;
    return { ...d, trend: Math.round(avg) };
  });

// ── StatCard ──────────────────────────────────────────────────
const StatCard = ({ title, value, change, icon: IconComp, color, helpText, trend, bgGradient }) => (
  <Card
    bgGradient="linear(to-tr, blue.200, rgba(255,255,255,0.8), rgba(240,245,255,0.5))"
    backdropFilter="blur(10px)"
    border="1px solid"
    borderColor="gray.100"
    borderRadius="lg"
    boxShadow="md"
    overflow="hidden"
    _hover={{ transform: "translateY(-4px)", boxShadow: "0 12px 40px rgba(0,0,0,0.1)" }}
    transition="all 0.3s ease"
  >
    <CardBody p={4}>
      <Flex direction="column" height="100%">
        <Flex justify="space-between" align="start" mb={4}>
          <Box flex="1" minW={0} mr={3}>
            <Text color="gray.700" fontSize="sm" fontWeight="medium" mb={1} noOfLines={1}>
              {title}
            </Text>
            <Text fontSize={{ base: "xl", md: "2xl" }} fontWeight="bold" color="gray.700" isTruncated>
              {value}
            </Text>
          </Box>
          <Box
            p={3}
            bgGradient={bgGradient || `linear(to-br, ${color}.50, ${color}.100)`}
            borderRadius="lg"
            flexShrink={0}
          >
            <Box as={IconComp} size={24} color={`${color}.600`} />
          </Box>
        </Flex>
        <Box mt="auto">
          <HStack spacing={2} flexWrap="wrap">
            <Box
              as={trend === "up" ? FiTrendingUp : FiTrendingDown}
              color={trend === "up" ? "green.500" : "red.500"}
              size={16}
            />
            <Text fontSize="sm" color={trend === "up" ? "green.600" : "red.600"} fontWeight="medium">
              {change}
            </Text>
            <Text fontSize="xs" color="gray.500" ml="auto">
              {helpText}
            </Text>
          </HStack>
        </Box>
      </Flex>
    </CardBody>
  </Card>
);

// ── MetricItem ────────────────────────────────────────────────
const MetricItem = ({ label, value, icon: IconComp, color, subtext }) => (
  <Box>
    <HStack spacing={3} align="start">
      <Box as={IconComp} color={`${color}.500`} mt={1} flexShrink={0} />
      <Box flex="1" minW={0}>
        <Text fontSize="sm" color="gray.600" fontWeight="medium">
          {label}
        </Text>
        <Text fontSize="lg" fontWeight="bold" color="gray.800" isTruncated>
          {value}
        </Text>
        {subtext && (
          <Text fontSize="xs" color="gray.500" mt={0.5}>
            {subtext}
          </Text>
        )}
      </Box>
    </HStack>
  </Box>
);

// ── Main Dashboard ────────────────────────────────────────────
const Dashboard = () => {
  const [stats, setStats]                     = useState(null);
  const [chartData, setChartData]             = useState({});
  const [financialData, setFinancialData]     = useState({});

  // FIX: two completely separate loading states.
  // `initialLoad`   — true only on the very first mount; shows full-page spinner.
  // `dashLoading`   — true while re-fetching dashboard stats (timeRange change / auto-refresh).
  //                   Does NOT unmount the page — shows a subtle inline indicator instead.
  // `topDestLoading`— scoped to the top-destinations card only.
  const [initialLoad, setInitialLoad]         = useState(true);
  const [dashLoading, setDashLoading]         = useState(false);
  const [topDestLoading, setTopDestLoading]   = useState(false);

  const [timeRange, setTimeRange]             = useState("today");
  const [topDestSort, setTopDestSort]         = useState("cost");
  const [topDestinations, setTopDestinations] = useState([]);
  const [currentTime, setCurrentTime]         = useState(new Date());

  const toast = useToast();

  // ── live clock ────────────────────────────────────────────
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // ── data loaders ──────────────────────────────────────────

  const loadTopDestinations = useCallback(async (range, sortBy) => {
    try {
      setTopDestLoading(true);
      const response = await fetchTopDestinations({ range, sortBy });
      if (response.success) setTopDestinations(response.data);
    } catch (error) {
      console.error("fetchTopDestinations error:", error);
    } finally {
      setTopDestLoading(false);
    }
  }, []);

  const loadDashboardData = useCallback(async (range) => {
    try {
      setDashLoading(true);
      const dashData = await fetchDashboardStats({ range });
      if (dashData.success) {
        const { stats: s, hourlyDistribution, customerDistribution, financialSummary } =
          dashData.data;
        setStats(s);
        setFinancialData(financialSummary);
        setChartData({
          hourlyCalls: withTrend(
            hourlyDistribution.map((h) => ({ hour: `${h.hour}:00`, calls: h.callsCount }))
          ),
          customerDistribution: customerDistribution.map((c) => ({
            name: c.customerName,
            value: c.totalCalls,
          })),
        });
      }
    } catch (error) {
      toast({
        title: "Error loading data",
        description: "Failed to fetch dashboard data.",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setDashLoading(false);
      // FIX: clear the full-page spinner after the very first successful load
      setInitialLoad(false);
    }
  }, [toast]);

  // ── FIX: SPLIT useEffects so changing topDestSort does NOT trigger loadDashboardData ──
  //
  // Before: one refreshData() called BOTH loaders. Any dep change (including topDestSort)
  // triggered setLoading(true) → full-page spinner → whole page unmounted and remounted.
  //
  // After:
  //   Effect 1 — runs on timeRange change + auto-refresh interval. Calls BOTH loaders
  //              because a range change affects everything.
  //   Effect 2 — runs ONLY on topDestSort change. Calls ONLY loadTopDestinations.
  //              The dashboard stats and charts are completely untouched.

  // Effect 1: timeRange drives everything + 10-min auto-refresh
  useEffect(() => {
    loadDashboardData(timeRange);
    loadTopDestinations(timeRange, topDestSort);

    const interval = setInterval(() => {
      loadDashboardData(timeRange);
      loadTopDestinations(timeRange, topDestSort);
    }, 10 * 60 * 1000);

    return () => clearInterval(interval);
    // topDestSort intentionally excluded — handled by Effect 2
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeRange, loadDashboardData, loadTopDestinations]);

  // Effect 2: sort-only change — only reload the destinations card
  useEffect(() => {
    // Skip on initial mount (Effect 1 already loads it with the correct sort)
    if (initialLoad) return;
    loadTopDestinations(timeRange, topDestSort);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topDestSort]);

  // ── stable helpers ────────────────────────────────────────
  const destKey = (d) => `${d.destination}__${d.trunk}`;

  const hourlyCalls          = useMemo(() => chartData.hourlyCalls         || [], [chartData]);
  const customerDistribution = useMemo(() => chartData.customerDistribution || [], [chartData]);

  // FIX: full-page spinner only on first mount — never again after that
  if (initialLoad) {
    return (
      <Box w="full">
        <Center height="90vh">
          <VStack spacing={4}>
            <BlinkBlur color="#3182ce" />
            <Text fontSize="lg" fontStyle="italic" color="gray.500" fontWeight="medium">
              Loading dashboard analytics...
            </Text>
          </VStack>
        </Center>
      </Box>
    );
  }

  return (
    <Box w="full" maxW="100%" overflowX="clip">
      <VStack spacing={4} align="stretch">

        {/* ── Header ─────────────────────────────────────────── */}
        {/* FIX: subtle inline refresh indicator — page never unmounts on timeRange change */}
        {dashLoading && (
          <Flex
            align="center" justify="center" gap={2}
            py={1} px={3}
            bg="blue.50" borderRadius="md"
            border="1px solid" borderColor="blue.100"
          >
            <Spinner size="xs" color="blue.500" />
            <Text fontSize="xs" color="blue.600" fontWeight="medium">
              Refreshing dashboard data...
            </Text>
          </Flex>
        )}
        <PageNavBar
          title="CDR Analytics Dashboard"
          description="Real-time insights into call data records, destinations and customers"
          rightContent={
            // FIX: flexWrap so clock + select stack gracefully on very small screens
            <HStack spacing={3} flexWrap="wrap" justify={{ base: "center", md: "flex-end" }} w="full">
              <Box
                px={3} py={1} bg="gray.200" borderRadius="md"
                border="1px solid" borderColor="gray.100" boxShadow="sm"
              >
                <HStack spacing={3}>
                  <HStack spacing={2}>
                    <Icon as={FiCalendar} color="purple.500" />
                    <Text fontSize="sm" fontWeight="bold" color="gray.700">
                      {format(currentTime, "MMM dd, yyyy")}
                    </Text>
                  </HStack>
                  <Divider orientation="vertical" height="20px" />
                  <HStack spacing={2}>
                    <Icon as={FiClock} color="blue.500" />
                    {/* FIX: minW keeps layout stable as seconds tick */}
                    <Text fontSize="sm" fontWeight="bold" color="gray.700" minW="72px">
                      {format(currentTime, "HH:mm:ss")}
                    </Text>
                  </HStack>
                </HStack>
              </Box>

              <Select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                w={{ base: "full", md: "150px" }}
                size="sm"
                borderRadius="md"
                border="1px solid gray"
                bg="gray.200"
              >
                <option value="today">Today</option>
                <option value="week">Weekly</option>
                <option value="biweekly">Biweekly</option>
                <option value="monthly">Monthly</option>
                <option value="3month">3 Months</option>
              </Select>
            </HStack>
          }
        />

        {/* ── Stat Cards ─────────────────────────────────────── */}
        <SimpleGrid columns={{ base: 1, sm: 2, lg: 4 }} spacing={4}>
          <StatCard
            title="Total Calls"
            value={stats.totalCalls.toLocaleString()}
            change="Live"
            icon={FiPhoneCall}
            color="purple"
            helpText="Total calls processed"
            trend="up"
            bgGradient="linear(to-br, purple.50, blue.50)"
          />
          <StatCard
            title="Total Revenue"
            value={`$${stats.totalRevenue.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}`}
            change="Cumulative"
            icon={FiDollarSign}
            color="green"
            helpText="Total billing revenue"
            trend="up"
            bgGradient="linear(to-br, green.50, teal.50)"
          />
          <StatCard
            title="Active Customers"
            value={stats.activeCustomers}
            change="Unique"
            icon={FiUsers}
            color="purple"
            helpText="Customer accounts"
            trend="up"
            bgGradient="linear(to-br, purple.50, pink.50)"
          />
          <StatCard
            title="Total Duration"
            value={formatDuration(stats.totalDuration)}
            change="Total Minutes"
            icon={FiClock}
            color="orange"
            helpText="Call time aggregate"
            trend="up"
            bgGradient="linear(to-br, orange.50, yellow.50)"
          />
        </SimpleGrid>

        {/* ── Top Destinations + Financial Summary ────────────── */}
        {/* FIX: better breakpoint ratio — md was 3fr/1fr which crushed the financial card */}
        <Grid
          templateColumns={{ base: "1fr", md: "2fr 1fr", lg: "5fr 1fr" }}
          gap={4}
          w="full"
          maxW="100%"
        >
          {/* Top Destinations */}
          <GridItem minW={0}>
            <Card
              bg="white"
              border="1px solid"
              borderColor="gray.100"
              borderRadius="lg"
              boxShadow="md"
              overflow="hidden"
            >
              <CardHeader py={2} bg="blue.200">
                <Flex
                  justify="space-between"
                  align={{ base: "start", md: "center" }}
                  direction={{ base: "column", md: "row" }}
                  gap={{ base: 2, md: 0 }}
                >
                  <HStack spacing={3}>
                    <Icon as={FiGlobe} w={5} h={5} color="blue.600" />
                    <VStack align="start" spacing={0}>
                      <Heading size="md" color="gray.800" fontWeight="semibold">
                        Top Destinations
                      </Heading>
                      <Text fontSize="xs" color="gray.500">
                        Performance by country
                      </Text>
                    </VStack>
                  </HStack>
                  <HStack spacing={2} w={{ base: "full", md: "auto" }}>
                    <Text fontSize="sm" fontWeight="bold" color="gray.800">
                      Sort by:
                    </Text>
                    <Select
                      borderRadius="md"
                      bg="white"
                      size="sm"
                      w={{ base: "full", md: "150px" }}
                      value={topDestSort}
                      onChange={(e) => setTopDestSort(e.target.value)}
                    >
                      <option value="cost">Cost</option>
                      <option value="completedCalls">Calls</option>
                      <option value="minutes">Minutes</option>
                    </Select>
                  </HStack>
                </Flex>
              </CardHeader>

              <CardBody p={0}>
                {/* FIX: minW reduced — 920px forced scroll even on wide desktops.
                         600px keeps all columns visible while allowing natural flex. */}
                <TableContainer
                  w="full"
                  maxW="100%"
                  overflowX="auto"
                  overflowY="auto"
                  maxH={{ base: "340px", md: "380px" }}
                >
                  <Table variant="simple" size="sm" minW="600px">
                    <Thead bg="gray.200" position="sticky" top={0} zIndex={1}>
                      <Tr>
                        {[
                          "Destination",
                          "Trunk",
                          "Total Calls",
                          "Cmpt. Calls",
                          "Minutes",
                          "ASR (%)",
                          "ACD (m)",
                          "Cost",
                          "Margin",
                          "Margin (%)",
                        ].map((h) => (
                          <Th
                            key={h}
                            color="black"
                            fontWeight="bold"
                            whiteSpace="nowrap"
                            isNumeric={!["Destination", "Trunk"].includes(h)}
                          >
                            {h}
                          </Th>
                        ))}
                      </Tr>
                    </Thead>
                    <Tbody>
                      {topDestLoading ? (
                        <Tr>
                          <Td colSpan={10} textAlign="center" py={10}>
                            <Flex justify="center">
                              <Slab color="#3182ce" />
                            </Flex>
                          </Td>
                        </Tr>
                      ) : topDestinations?.length > 0 ? (
                        // FIX: stable key using destination+trunk instead of array index
                        topDestinations.map((d) => (
                          <Tr
                            key={destKey(d)}
                            _hover={{ bg: "gray.100" }}
                            transition="background 0.15s"
                            bg={d.margin < 0 ? "red.100" : "transparent"}
                          >
                            <Td
                              fontWeight="medium"
                              whiteSpace="nowrap"
                              maxW="160px"
                              overflow="hidden"
                              textOverflow="ellipsis"
                            >
                              {d.destination}
                            </Td>
                            <Td whiteSpace="nowrap">
                              <Badge colorScheme="purple" variant="subtle" fontSize="2xs">
                                {d.trunk}
                              </Badge>
                            </Td>
                            <Td isNumeric>{d.totalCalls}</Td>
                            <Td isNumeric color="green.700">
                              {d.completedCalls}
                            </Td>
                            <Td isNumeric>{d.minutes}</Td>
                            <Td isNumeric>
                              <Badge px={2} colorScheme={d.ASR > 50 ? "green" : "orange"}>
                                {d.ASR}%
                              </Badge>
                            </Td>
                            <Td isNumeric>{formatACD(d.ACD)}</Td>
                            <Td isNumeric fontWeight="semibold" color="blue.400">
                              ${d.cost.toFixed(4)}
                            </Td>
                            <Td isNumeric color={d.margin >= 0 ? "green.700" : "red.700"}>
                              ${d.margin.toFixed(5)}
                            </Td>
                            <Td isNumeric color={d.marginPercentage >= 0 ? "green.700" : "red.700"}>
                              {d.marginPercentage.toFixed(4)}%
                            </Td>
                          </Tr>
                        ))
                      ) : (
                        <Tr>
                          <Td colSpan={10} textAlign="center" py={10}>
                            <Text color="gray.400" fontSize="sm">
                              No data available
                            </Text>
                          </Td>
                        </Tr>
                      )}
                    </Tbody>
                  </Table>
                </TableContainer>
              </CardBody>
            </Card>
          </GridItem>

          {/* Financial Summary */}
          {/* FIX: added maxH + overflowY to CardBody so it never overflows viewport */}
          <GridItem minW={0}>
            <Card
              bg="white"
              border="1px solid"
              borderColor="gray.100"
              borderRadius="lg"
              boxShadow="lg"
              overflow="hidden"
              _hover={{ boxShadow: "0 20px 60px rgba(0,0,0,0.08)" }}
              transition="all 0.3s ease"
              h="full"
            >
              <CardHeader bg="blue.200" py={2}>
                <HStack spacing={2}>
                  <Icon as={FiDollarSign} w={5} h={5} color="green.600" />
                  <Heading size="md" color="gray.800" fontWeight="semibold">
                    Financial Summary
                  </Heading>
                </HStack>
              </CardHeader>
              {/* FIX: constrained height with scroll so it doesn't blow out on short screens */}
              <CardBody
                py={4}
                px={4}
                overflowY="auto"
                maxH={{ base: "300px", md: "none" }}
              >
                <VStack spacing={3} align="stretch">
                  <MetricItem
                    label="Total Revenue"
                    value={`$${financialData.totalRevenue?.toFixed(2) || "0.00"}`}
                    icon={FiDollarSign}
                    color="green"
                    subtext="From all calls"
                  />
                  <Divider />
                  <MetricItem
                    label="Tax Collected"
                    value={`$${financialData.taxCollected?.toFixed(2) || "0.00"}`}
                    icon={FiPercent}
                    color="purple"
                    subtext="Total tax amount"
                  />
                  <Divider />
                  <MetricItem
                    label="Income Fee"
                    value={`$${financialData.incomeFee?.toFixed(2) || "0.00"}`}
                    icon={FiTrendingUp}
                    color="blue"
                    subtext="Service income"
                  />
                  <Divider />
                  <MetricItem
                    label="Agent Fees"
                    value={`$${financialData.agentFee?.toFixed(2) || "0.00"}`}
                    icon={FiUsers}
                    color="orange"
                    subtext="Total agent fee"
                  />
                </VStack>
              </CardBody>
            </Card>
          </GridItem>
        </Grid>

        {/* ── Hourly Chart + Top Customers ───────────────────── */}
        <Grid templateColumns={{ base: "1fr", lg: "2fr 1fr" }} gap={4}>

          {/* Hourly Call Distribution */}
          <GridItem>
            <Card
              bg="white"
              border="1px solid"
              borderColor="gray.100"
              borderRadius="lg"
              boxShadow="lg"
              overflow="hidden"
              _hover={{ boxShadow: "0 20px 60px rgba(0,0,0,0.08)" }}
              transition="all 0.3s ease"
            >
              <CardHeader bg="blue.200" py={2}>
                <HStack spacing={3}>
                  <Icon as={FiActivity} w={5} h={5} color="blue.600" />
                  <VStack align="start" spacing={0}>
                    <Heading size="md" color="gray.800" fontWeight="semibold">
                      Hourly Call Distribution
                    </Heading>
                    <Text fontSize="xs" color="gray.600">
                      Call volume by hour
                    </Text>
                  </VStack>
                </HStack>
              </CardHeader>
              <CardBody p={{ base: 3, md: 6 }}>
                <Box height={{ base: "220px", md: "300px" }}>
                  <ResponsiveContainer width="100%" height="100%">
                    {/* FIX: Bar uses "calls", Line uses "trend" (rolling avg) — visually distinct */}
                    <ComposedChart
                      data={hourlyCalls}
                      margin={{ top: 5, right: 10, left: -10, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                      <XAxis
                        dataKey="hour"
                        stroke="#6B7280"
                        fontSize={11}
                        tick={{ fontSize: 10 }}
                      />
                      <YAxis
                        yAxisId="left"
                        stroke="#6B7280"
                        fontSize={11}
                        width={40}
                      />
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        stroke="#6B7280"
                        fontSize={11}
                        width={40}
                      />
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: "12px" }} />
                      <Bar
                        yAxisId="left"
                        dataKey="calls"
                        fill="#039b68"
                        radius={[4, 4, 0, 0]}
                        name="Call Volume"
                      />
                      {/* FIX: "trend" key is the rolling average — not a duplicate of "calls" */}
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="trend"
                        stroke="#f59e0b"
                        name="Trend Line"
                        strokeWidth={2}
                        dot={false}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </Box>
              </CardBody>
            </Card>
          </GridItem>

          {/* Top Customers */}
          <GridItem>
            <Card
              bg="white"
              border="1px solid"
              borderColor="gray.100"
              borderRadius="lg"
              boxShadow="lg"
              overflow="hidden"
              _hover={{ boxShadow: "0 20px 60px rgba(0,0,0,0.08)" }}
              transition="all 0.3s ease"
            >
              <CardHeader bg="blue.200" py={2}>
                <HStack spacing={3}>
                  <Icon as={FiUsers} w={5} h={5} color="purple.600" />
                  <VStack align="start" spacing={0}>
                    <Heading size="md" color="gray.800" fontWeight="semibold">
                      Top Customers
                    </Heading>
                    <Text fontSize="xs" color="gray.600">
                      Distribution by Total Calls
                    </Text>
                  </VStack>
                </HStack>
              </CardHeader>

              <CardBody p={0} pb={2}>
                <VStack spacing={0} align="stretch">
                  {/* Sticky column headers */}
                  <HStack
                    justify="space-between"
                    px={4}
                    py={2}
                    bg="gray.200"
                    borderBottom="1px solid"
                    borderColor="gray.200"
                    position="sticky"
                    top={0}
                    zIndex={1}
                  >
                    <Text fontSize="xs" fontWeight="bold" color="gray.800" letterSpacing="wide">
                      CUSTOMER
                    </Text>
                    <Text fontSize="xs" fontWeight="bold" color="gray.800" letterSpacing="wide">
                      TOTAL CALLS
                    </Text>
                  </HStack>

                  {/* Scrollable rows */}
                  <Box
                    maxH={{ base: "260px", md: "300px" }}
                    overflowY="auto"
                    sx={{
                      "&::-webkit-scrollbar": { width: "4px" },
                      "&::-webkit-scrollbar-track": { background: "gray.100" },
                      "&::-webkit-scrollbar-thumb": { background: "gray.400", borderRadius: "24px" },
                    }}
                  >
                    <VStack
                      spacing={0}
                      align="stretch"
                      divider={<StackDivider borderColor="gray.100" />}
                    >
                      {customerDistribution.length > 0 ? (
                        // FIX: stable key using customer name instead of array index
                        customerDistribution.map((item) => (
                          <HStack
                            key={item.name}
                            justify="space-between"
                            px={3}
                            py={3}
                            _hover={{ bg: "gray.50" }}
                            transition="background 0.2s ease"
                          >
                            <HStack spacing={3} minW={0} flex={1}>
                              <Avatar bg="green.500" size="xs" name={item.name} flexShrink={0} />
                              {/* FIX: maxW capped on mobile so name doesn't push count off screen */}
                              <Text
                                fontSize="sm"
                                fontWeight="500"
                                color="gray.700"
                                isTruncated
                                maxW={{ base: "120px", sm: "160px", md: "full" }}
                              >
                                {item.name}
                              </Text>
                            </HStack>
                            <HStack spacing={1} flexShrink={0}>
                              <Text fontSize="sm" fontWeight="600" color="gray.900">
                                {item.value}
                              </Text>
                              <Text fontSize="xs" color="gray.500">
                                calls
                              </Text>
                            </HStack>
                          </HStack>
                        ))
                      ) : (
                        <Box py={10} textAlign="center">
                          <Text color="gray.400" fontSize="sm">
                            No customer data
                          </Text>
                        </Box>
                      )}
                    </VStack>
                  </Box>
                </VStack>
              </CardBody>
            </Card>
          </GridItem>
        </Grid>

      </VStack>
    </Box>
  );
};

export default Dashboard;