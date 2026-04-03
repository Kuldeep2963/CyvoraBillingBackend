import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Avatar,
  Badge,
  Box,
  Card,
  CardBody,
  CardHeader,
  Center,
  Divider,
  Flex,
  Grid,
  GridItem,
  HStack,
  Icon,
  SimpleGrid,
  Spinner,
  StackDivider,
  Table,
  TableContainer,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  VStack,
  useToast,
} from "@chakra-ui/react";
import { MemoizedSelect as Select } from "../components/memoizedinput/memoizedinput";
import PageNavBar from "../components/PageNavBar";
import DestinationMap from "../components/DestinationMap";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  FiActivity,
  FiCalendar,
  FiClock,
  FiDollarSign,
  FiGlobe,
  FiPercent,
  FiPhoneCall,
  FiTrendingDown,
  FiTrendingUp,
  FiUsers,
} from "react-icons/fi";
import { format } from "date-fns";
import { BlinkBlur } from "react-loading-indicators";
import { formatInTimeZone } from "date-fns-tz";
import {
  fetchDashboardStats,
  fetchTopDestinations,
  getGlobalSettings,
} from "../utils/api";

const formatDuration = (minutes) => {
  if (!minutes) return "0m";
  const hours = Math.floor(minutes / 60);
  const mins = Math.floor(minutes % 60);
  return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
};

const formatACD = (decimalMinutes) => {
  if (!decimalMinutes) return "0:00";
  const totalSeconds = Math.floor(decimalMinutes * 60);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

const withTrend = (data = []) => {
  const maxCalls = data.reduce(
    (max, item) => Math.max(max, Number(item.calls) || 0),
    0,
  );
  const visualOffset = Math.max(1, Math.round(maxCalls * 0.03));
  return data.map((d, i, arr) => {
    const slice = arr.slice(Math.max(0, i - 2), i + 1);
    const avg = slice.reduce((s, x) => s + (x.calls || 0), 0) / slice.length;
    return {
      ...d,
      trend: Math.round(Math.max(avg, Number(d.calls) || 0) + visualOffset),
    };
  });
};

const parseFilenameUtc = (filename = "") => {
  const match = String(filename).match(
    /^cdr_(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})\.csv$/i,
  );
  if (!match) return null;
  const [, year, month, day, hour, minute, second] = match;
  const utcDate = new Date(
    Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second),
    ),
  );
  return Number.isNaN(utcDate.getTime()) ? null : utcDate;
};

const toUtcHHMM = (dateObj) => {
  if (!(dateObj instanceof Date) || Number.isNaN(dateObj.getTime()))
    return "--:--";
  const hh = String(dateObj.getUTCHours()).padStart(2, "0");
  const mm = String(dateObj.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
};

const StatCard = ({
  title,
  value,
  change,
  icon: IconComp,
  color,
  helpText,
  trend,
  loading = false,
}) => (
  <Card
    bg="white"
    border="1px solid"
    borderColor="gray.100"
    borderRadius="12px"
    boxShadow="md"
  >
    <CardBody p={4}>
      <Flex justify="space-between" align="start" mb={4}>
        <Box minW={0} flex={1} mr={3}>
          <Text color="gray.500" fontSize="sm" fontWeight={600} noOfLines={1}>
            {title}
          </Text>
          {loading ? (
            <Flex h="32px" align="center">
              <Spinner size="sm" color="gray.400" />
            </Flex>
          ) : (
            <Text
              fontSize={{ base: "xl", md: "xl" }}
              fontWeight="bold"
              color="gray.600"
              isTruncated
            >
              {value}
            </Text>
          )}
        </Box>
        <Box p={2} borderRadius="lg">
          <Box as={IconComp} size={22} color={`${color}.600`} />
        </Box>
      </Flex>
      {loading ? (
        <Text fontSize="xs" color="gray.500">
          Loading...
        </Text>
      ) : (
        <HStack spacing={2}>
          <Box
            as={trend === "up" ? FiTrendingUp : FiTrendingDown}
            color={trend === "up" ? "green.600" : "red.500"}
          />
          <Text
            fontSize="sm"
            color={trend === "up" ? "green.600" : "red.600"}
            fontWeight="medium"
          >
            {change}
          </Text>
          <Text fontSize="xs" color="gray.500" ml="auto">
            {helpText}
          </Text>
        </HStack>
      )}
    </CardBody>
  </Card>
);

const MetricItem = ({ label, value, icon: IconComp, color, valueColor }) => (
  <HStack align="start" spacing={3}>
    <Box as={IconComp} color={`${color}.500`} mt={1} />
    <Box minW={0}>
      <Text fontSize="sm" color="gray.600" fontWeight="medium">
        {label}
      </Text>
      <Text fontSize="lg" color={valueColor || "gray.600"} fontWeight="bold" isTruncated>
        {value}
      </Text>
    </Box>
  </HStack>
);

const Dashboard = () => {
  const toast = useToast();

  const [stats, setStats] = useState(null);
  const [financialData, setFinancialData] = useState({});
  const [chartData, setChartData] = useState({});
  const [topDestinations, setTopDestinations] = useState([]);
  const [lastProcessedMeta, setLastProcessedMeta] = useState({
    filename: "",
    timeLabel: "--:-- UTC",
  });

  const [initialLoad, setInitialLoad] = useState(true);
  const [dashLoading, setDashLoading] = useState(false);
  const [topDestLoading, setTopDestLoading] = useState(false);

  const [timeRange, setTimeRange] = useState("today");
  const [topDestSort, setTopDestSort] = useState("cost");
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const loadTopDestinations = useCallback(async (range, sortBy) => {
    try {
      setTopDestLoading(true);
      const response = await fetchTopDestinations({ range, sortBy });
      if (response?.success)
        setTopDestinations(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error("fetchTopDestinations error:", error);
    } finally {
      setTopDestLoading(false);
    }
  }, []);

  const loadDashboardData = useCallback(
    async (range) => {
      try {
        setDashLoading(true);
        const dashData = await fetchDashboardStats({ range });
        if (dashData?.success) {
          const {
            stats: s,
            hourlyDistribution,
            customerDistribution,
            financialSummary,
          } = dashData.data;
          setStats(s || {});
          setFinancialData(financialSummary || {});
          setChartData({
            hourlyCalls: withTrend(
              (hourlyDistribution || []).map((h) => ({
                hour: `${h.hour}:00`,
                calls: h.callsCount,
              })),
            ),
            customerDistribution: (customerDistribution || []).map((c) => ({
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
        setInitialLoad(false);
      }
    },
    [toast],
  );

  const loadLastProcessedMeta = useCallback(async () => {
    try {
      const settings = await getGlobalSettings();
      const filename = settings?.lastProcessedCdrFilename || "";

      const fromSetting = settings?.lastProcessedCdrTimestampUtc
        ? new Date(settings.lastProcessedCdrTimestampUtc)
        : null;
      const fromFilename = parseFilenameUtc(filename);
      const sourceDate =
        fromSetting && !Number.isNaN(fromSetting.getTime())
          ? fromSetting
          : fromFilename;

      setLastProcessedMeta({
        filename,
        timeLabel: `${toUtcHHMM(sourceDate)} UTC`,
      });
    } catch (error) {
      console.error("Failed to load last processed CDR metadata", error);
    }
  }, []);

  useEffect(() => {
    loadDashboardData(timeRange);
    loadTopDestinations(timeRange, topDestSort);
    loadLastProcessedMeta();

    const interval = setInterval(
      () => {
        loadDashboardData(timeRange);
        loadTopDestinations(timeRange, topDestSort);
        loadLastProcessedMeta();
      },
      10 * 60 * 1000,
    );

    return () => clearInterval(interval);
  }, [
    timeRange,
    topDestSort,
    loadDashboardData,
    loadTopDestinations,
    loadLastProcessedMeta,
  ]);

  const hourlyCalls = useMemo(() => chartData.hourlyCalls || [], [chartData]);
  const customerDistribution = useMemo(
    () => chartData.customerDistribution || [],
    [chartData],
  );
  const destKey = (d) => `${d.destination}__${d.trunk}`;

  if (initialLoad) {
    return (
      <Box w="full">
        <Center h="90vh">
          <VStack spacing={4}>
            <BlinkBlur color="#3182ce" />
            <Text
              fontSize="lg"
              fontStyle="italic"
              color="gray.500"
              fontWeight="medium"
            >
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
        <Box position="sticky" top={0} zIndex={20}>
          <PageNavBar
            position="static"
            pb="70px"
            title="CDR Analytics Dashboard"
            description="Real-time insights into call data records, destinations and customers"
            rightContent={
              <HStack
                spacing={3}
                flexWrap="wrap"
                justify={{ base: "center", md: "flex-end" }}
                w="full"
              >
                <Box px={3} py={1} bg={"gray.200"} borderRadius={"md"}>
                  <HStack spacing={3} alignItems={"center"}>
                    <HStack spacing={2}>
                      <Icon as={FiCalendar} color="blue.400" />
                      <Text fontSize="13px" fontWeight="bold" color="gray.600">
                        {formatInTimeZone(currentTime, "UTC", "MMM dd, yyyy")}
                      </Text>
                    </HStack>
                    <Divider orientation="vertical" h="20px" />
                    <HStack spacing={2}>
                      <Icon as={FiClock} color="blue.400" />
                      <Text
                        fontSize="13px"
                        fontWeight="bold"
                        color="gray.600"
                        minW="72px"
                      >
                        {formatInTimeZone(currentTime, "UTC", "HH:mm:ss")} UTC
                      </Text>
                    </HStack>
                  </HStack>
                </Box>

                <Box
                  px={3}
                  py={1}
                  bg="gray.200"
                  borderRadius="md"
                  border="1px solid"
                  borderColor="gray.100"
                  boxShadow="sm"
                >
                  <VStack align="start" spacing={0}>
                    <Text fontSize="13px" color="gray.600" fontWeight="600">
                      Last CDR : {lastProcessedMeta.timeLabel}
                    </Text>
                    {/* <Text fontSize="xs" color="gray.500" maxW="240px" isTruncated title={lastProcessedMeta.filename || "No processed file yet"}>
                      {lastProcessedMeta.filename || "No processed file yet"}
                    </Text> */}
                  </VStack>
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
                </Select>
              </HStack>
            }
          />

          <SimpleGrid
            columns={{ base: 1, sm: 2, lg: 4 }}
            spacing={4}
            mt="-60px"
            zIndex={20}
            px={2}
          >
            <StatCard
              title="Completed Calls"
              value={Number(stats?.completedCalls || 0).toLocaleString()}
              change={Number(stats?.totalCalls || 0).toLocaleString()}
              icon={FiPhoneCall}
              color="purple"
              helpText="Total calls"
              trend="up"
              loading={dashLoading}
            />
            <StatCard
              title="Total Revenue"
              value={`$${Number(stats?.totalRevenue || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`}
              change="Cumulative"
              icon={FiDollarSign}
              color="green"
              helpText="Total billing revenue"
              trend="up"
              loading={dashLoading}
            />
            <StatCard
              title="Active Customers"
              value={Number(stats?.activeCustomers || 0)}
              change="Unique"
              icon={FiUsers}
              color="purple"
              helpText="Customer accounts"
              trend="up"
              loading={dashLoading}
            />
            <StatCard
              title="Total Duration"
              value={formatDuration(Number(stats?.totalDuration || 0))}
              change="Total hours"
              icon={FiClock}
              color="orange"
              helpText="Call time aggregate"
              trend="up"
              loading={dashLoading}
            />
          </SimpleGrid>
        </Box>

        <Grid
          templateColumns={{ base: "1fr", lg: "4fr 1fr" }}
          gap={4}
          w="full"
          maxW="100%"
        >
          <GridItem minW={0}>
            <DestinationMap
              destinations={topDestinations}
              loading={topDestLoading}
            />
          </GridItem>

          <GridItem minW={0}>
            <Card
              bg="white"
              border="1px solid"
              borderColor="gray.100"
              borderRadius="lg"
              boxShadow="lg"
              overflow="hidden"
              h="full"
            >
              <CardHeader bg="rgb(237, 242, 247)" py={2}>
                <HStack spacing={2}>
                  <Icon as={FiDollarSign} w={5} h={5} color="green.600" />
                  <Text size="md" color="gray.500" fontWeight={600}>
                    Financial Summary
                  </Text>
                </HStack>
              </CardHeader>
              <CardBody py={4} px={4} overflowY="auto">
                {dashLoading ? (
                  <Flex h="220px" align="center" justify="center">
                    <Spinner size="md" color="gray.400" />
                  </Flex>
                ) : (
                  <VStack
                    px={2}
                    spacing={5}
                    justify="space-between"
                    align="stretch"
                    mb={4}
                  >
                    <MetricItem
                      label="Total Revenue"
                      value={`$${Number(financialData?.totalRevenue || 0).toFixed(4)}`}
                      icon={FiDollarSign}
                      color="green"
                    />
                    <Divider />
                   <MetricItem
  label="Total Margin"
  value={`$${Number(financialData?.totalMargin || 0).toFixed(4)}`}
  icon={FiPercent}
  color="purple"
  valueColor={Number(financialData?.totalMargin || 0) < 0 ? "red.600" : "gray.600"}
/>
                    <Divider />
                    <MetricItem
                      label="Failed Calls"
                      value={`${Number(financialData?.failedCalls || 0)}`}
                      icon={FiTrendingUp}
                      color="blue"
                    />
                    <Divider />
                    <MetricItem
                      label="Total Cost"
                      value={`$${Number(financialData?.totalCost || 0).toFixed(4)}`}
                      icon={FiUsers}
                      color="orange"
                    />
                  </VStack>
                )}
              </CardBody>
            </Card>
          </GridItem>
        </Grid>

        <Grid w="full" maxW="100%">
          <GridItem minW={0}>
            <Card
              bg="white"
              border="1px solid"
              borderColor="gray.100"
              borderRadius="lg"
              boxShadow="md"
              overflow="hidden"
            >
              <CardHeader py={2} bg="rgb(237, 242, 247)">
                <Flex
                  justify="space-between"
                  align={{ base: "start", md: "center" }}
                  direction={{ base: "column", md: "row" }}
                  gap={{ base: 2, md: 0 }}
                >
                  <HStack spacing={3}>
                    <Icon as={FiGlobe} w={5} h={5} color="blue.600" />
                    <VStack align="start" spacing={0}>
                      <Text size="lg" color="gray.500" fontWeight={600}>
                        Top Destinations
                      </Text>
                      <Text fontSize="xs" color="gray.500">
                        Performance by country
                      </Text>
                    </VStack>
                  </HStack>
                  <HStack spacing={2} w={{ base: "full", md: "auto" }}>
                    <Text
                      fontSize="sm"
                      fontWeight="bold"
                      color="gray.500"
                      whiteSpace="nowrap"
                    >
                      Sort by :
                    </Text>
                    <Select
                      color="gray.500"
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

              <CardBody p={2}>
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
                            <Flex justify="center" h="300px" align="center">
                              <Spinner size="md" color="gray.400" />
                            </Flex>
                          </Td>
                        </Tr>
                      ) : topDestinations.length > 0 ? (
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
                              <Badge
                                colorScheme="purple"
                                variant="subtle"
                                fontSize="2xs"
                              >
                                {d.trunk}
                              </Badge>
                            </Td>
                            <Td isNumeric>{d.totalCalls}</Td>
                            <Td isNumeric color="green.700">
                              {d.completedCalls}
                            </Td>
                            <Td isNumeric>{d.minutes}</Td>
                            <Td isNumeric>
                              <Badge
                                px={2}
                                colorScheme={d.ASR > 50 ? "green" : "orange"}
                              >
                                {d.ASR}%
                              </Badge>
                            </Td>
                            <Td isNumeric>{formatACD(d.ACD)}</Td>
                            <Td
                              isNumeric
                              fontWeight="semibold"
                              color="blue.400"
                            >
                              ${Number(d.cost || 0).toFixed(4)}
                            </Td>
                            <Td
                              isNumeric
                              color={d.margin >= 0 ? "green.700" : "red.700"}
                            >
                              ${Number(d.margin || 0).toFixed(5)}
                            </Td>
                            <Td
                              isNumeric
                              color={
                                d.marginPercentage >= 0
                                  ? "green.700"
                                  : "red.700"
                              }
                            >
                              {Number(d.marginPercentage || 0).toFixed(4)}%
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
        </Grid>

        <Grid templateColumns={{ base: "1fr", lg: "2fr 1fr" }} gap={4}>
          <GridItem>
            <Card
              bg="white"
              border="1px solid"
              borderColor="gray.100"
              borderRadius="lg"
              boxShadow="lg"
              overflow="hidden"
            >
              <CardHeader bg="rgb(237, 242, 247)" py={2}>
                <HStack spacing={3}>
                  <Icon as={FiActivity} w={5} h={5} color="blue.600" />
                  <VStack align="start" spacing={0}>
                    <Text size="md" color="gray.500" fontWeight={600}>
                      Hourly Call Distribution
                    </Text>
                    <Text fontSize="xs" color="gray.500">
                      Call volume by hour
                    </Text>
                  </VStack>
                </HStack>
              </CardHeader>
              <CardBody p={{ base: 3, md: 6 }}>
                <Box h={{ base: "220px", md: "300px" }}>
                  {dashLoading ? (
                    <Flex h="100%" align="center" justify="center">
                      <Spinner size="md" color="gray.400" />
                    </Flex>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={hourlyCalls}>
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
                        <Tooltip />
                        <Legend wrapperStyle={{ fontSize: "12px" }} />
                        <Bar
                          yAxisId="left"
                          dataKey="calls"
                          fill="#2F855A"
                          radius={[4, 4, 0, 0]}
                          name="Call Volume"
                        />
                        <Line
                          yAxisId="left"
                          type="monotone"
                          dataKey="trend"
                          stroke="#f59e0b"
                          name="Trend Line"
                          strokeWidth={2}
                          dot={false}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  )}
                </Box>
              </CardBody>
            </Card>
          </GridItem>

          <GridItem>
            <Card
              bg="white"
              border="1px solid"
              borderColor="gray.100"
              borderRadius="lg"
              boxShadow="lg"
              overflow="hidden"
            >
              <CardHeader bg="rgb(237, 242, 247)" py={2}>
                <HStack spacing={3}>
                  <Icon as={FiUsers} w={5} h={5} color="purple.600" />
                  <VStack align="start" spacing={0}>
                    <Text size="md" color="gray.500" fontWeight={600}>
                      Top Customers
                    </Text>
                    <Text fontSize="xs" color="gray.500">
                      Distribution by Total Calls
                    </Text>
                  </VStack>
                </HStack>
              </CardHeader>

              <CardBody p={0} pb={2}>
                <VStack spacing={0} align="stretch">
                  <HStack
                    justify="space-between"
                    px={4}
                    py={2}
                    bg="rgb(244, 247, 253)"
                    borderBottom="1px solid"
                    borderColor="gray.200"
                    position="sticky"
                    top={0}
                    zIndex={1}
                  >
                    <Text
                      fontSize="xs"
                      fontWeight="bold"
                      color="rgb(141, 151, 181)"
                      letterSpacing="wide"
                    >
                      CUSTOMER
                    </Text>
                    <Text
                      fontSize="xs"
                      fontWeight="bold"
                      color="rgb(141, 151, 181)"
                      letterSpacing="wide"
                    >
                      TOTAL CALLS
                    </Text>
                  </HStack>
                  <Box maxH={{ base: "260px", md: "300px" }} overflowY="auto">
                    <VStack
                      spacing={0}
                      align="stretch"
                      divider={<StackDivider borderColor="gray.100" />}
                    >
                      {dashLoading ? (
                        <Flex py={10} justify="center" align="center">
                          <Spinner size="md" color="gray.400" />
                        </Flex>
                      ) : customerDistribution.length > 0 ? (
                        customerDistribution.map((item) => (
                          <HStack
                            key={item.name}
                            justify="space-between"
                            px={3}
                            py={3}
                            _hover={{ bg: "gray.50" }}
                          >
                            <HStack spacing={3} minW={0} flex={1}>
                              <Avatar
                                bg="green.500"
                                size="xs"
                                name={item.name}
                                flexShrink={0}
                              />
                              <Text
                                fontSize="sm"
                                fontWeight="500"
                                color="gray.700"
                                isTruncated
                                maxW={{
                                  base: "120px",
                                  sm: "160px",
                                  md: "full",
                                }}
                              >
                                {item.name}
                              </Text>
                            </HStack>
                            <HStack spacing={1} flexShrink={0}>
                              <Text
                                fontSize="md"
                                fontWeight="600"
                                color="blue.700"
                              >
                                {item.value}
                              </Text>
                              <Text fontSize="xs" color="gray.600">
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
