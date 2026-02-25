import React, { useState, useEffect } from "react";
import {
  Box,
  Container,
  Heading,
  SimpleGrid,
  Card,
  CardBody,
  Text,
  VStack,
  HStack,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  Badge,
  Center,
  Icon,
  useColorModeValue,
  useToast,
  Flex,
  Grid,
  GridItem,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  TableContainer,
  StackDivider,
  ButtonGroup,
  Avatar,
  AvatarGroup,
  Button,
  Spinner,
  Divider,
  Select,
  CardHeader,
} from "@chakra-ui/react";
import {
  FiPhoneCall,
  FiDollarSign,
  FiUsers,
  FiClock,
  FiTrendingUp,
  FiPieChart,
  FiTrendingDown,
  FiActivity,
  FiBarChart2,
  FiGlobe,
  FiCalendar,
  FiRefreshCw,
  FiChevronRight,
  FiMessageSquare,
  FiTarget,
  FiPercent,
  FiArchive,
  FiDatabase,
  FiServer,
} from "react-icons/fi";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  ComposedChart,
  Area,
  LineChart,
  Line,
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
} from "recharts";
import { fetchDashboardStats, fetchTopDestinations } from "../utils/api";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { BlinkBlur, Slab } from "react-loading-indicators";

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [chartData, setChartData] = useState({});
  const [financialData, setFinancialData] = useState({});
  const [loading, setLoading] = useState(true);
  const [topDestLoading, setTopDestLoading] = useState(false);
  const [timeRange, setTimeRange] = useState("today");
  const [topDestSort, setTopDestSort] = useState("cost");
  const [topDestinations, setTopDestinations] = useState([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  // Modern color palette
  const COLORS = {
    primary: "#6366F1",
    secondary: "#8B5CF6",
    success: "#10B981",
    warning: "#F59E0B",
    danger: "#EF4444",
    info: "#3B82F6",
    dark: "#1F2937",
    light: "#F9FAFB",
  };

  const navigate = useNavigate();
  const toast = useToast();

  // Clock timer
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const loadTopDestinations = async (range = "today", sortBy = "cost") => {
    try {
      setTopDestLoading(true);
      const response = await fetchTopDestinations({ range, sortBy });
      if (response.success) {
        setTopDestinations(response.data);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setTopDestLoading(false);
    }
  };

  const loadDashboardData = async (range = "today") => {
    try {
      setLoading(true);

      const dashData = await fetchDashboardStats({ range });

      if (dashData.success) {
        const {
          stats: s,
          hourlyDistribution,
          customerDistribution,
          financialSummary,
        } = dashData.data;

        setStats(s);
        setFinancialData(financialSummary);

        setChartData({
          hourlyCalls: hourlyDistribution.map((h) => ({
            hour: `${h.hour}:00`,
            calls: h.callsCount,
          })),
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
      setLoading(false);
    }
  };

  const refreshData = () => {
    loadDashboardData(timeRange);
    loadTopDestinations(timeRange, topDestSort);
  };
  useEffect(() => {
    // initial load
    refreshData();

    const interval = setInterval(
      () => {
        refreshData();
      },
      10 * 60 * 1000,
    ); // 15 minutes

    return () => clearInterval(interval); // cleanup on unmount
  }, [timeRange, topDestSort]);

  const formatDuration = (minutes) => {
    if (!minutes) return "0m";
    const hours = Math.floor(minutes / 60);
    const mins = Math.floor(minutes % 60);
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const formatACD = (decimalMinutes) => {
  if (!decimalMinutes || decimalMinutes === 0) return "0:00";
  
  const totalSeconds = Math.floor(decimalMinutes * 60);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

  // ✅ SAFE early return (no hooks inside)
  if (loading || !stats) {
    return (
      <Box w={"full"}>
        <Center height="90vh">
          <VStack spacing={4} width="full">
            <BlinkBlur color="#3182ce" />
            <Text
              fontSize="lg"
              fontStyle={"italic"}
              color={"gray.500"}
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
    <Box>
      <VStack spacing={4} align="stretch">
        <Flex
          justify="space-between"
          align="center"
          bgGradient="linear(to-r,blue.100,blue.200,blue.300)"
          px={4}
          py={2}
          borderRadius={"12px"}
        >
          <Box>
            <Heading size="xl" fontWeight="700" color={"gray.600"}>
              CDR Analytics Dashboard
            </Heading>
            <Text color="gray.500" fontSize="sm">
              Real-time insights into call data records, destinations and
              customers
            </Text>
          </Box>
          <HStack spacing={4}>
            <Box
              px={4}
              py={1}
              bg="gray.200"
              borderRadius="md"
              border="1px solid"
              borderColor="gray.100"
              boxShadow="sm"
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
                  <Text
                    fontSize="sm"
                    fontWeight="bold"
                    color="gray.700"
                    minW="80px"
                  >
                    {format(currentTime, "HH:mm:ss")}
                  </Text>
                </HStack>
              </HStack>
            </Box>
            <Select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              width="150px"
              size="sm"
              borderRadius="md"
              border={"1px solid gray"}
              bg="gray.200"
            >
              <option value="today">Today</option>
              <option value="week">Weekly</option>
              <option value="biweekly">Biweekly</option>
              <option value="monthly">Monthly</option>
              <option value="3month">3 Months</option>
            </Select>
            {/* <Button
              leftIcon={<FiRefreshCw />}
              colorScheme="purple"
              variant="outline"
              onClick={refreshData}
              size="sm"
              _hover={{
                bg: "purple.50",
                transform: "translateX(-3px)",
                transition: "transform 0.3s",
              }}
              transition="all 0.3s"
            >
              Refresh Data
            </Button> */}
          </HStack>
        </Flex>

        {/* Main Stats Grid */}
        <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={4}>
          <StatCard
            title="Total Calls"
            value={stats.totalCalls.toLocaleString()}
            change={`Live`}
            icon={FiPhoneCall}
            color={COLORS.primary}
            helpText={`Total calls processed`}
            trend="up"
            bgGradient="linear(to-br, purple.50, blue.50)"
            boxShadow="md"
          />
          <StatCard
            title="Total Revenue"
            value={`$${stats.totalRevenue.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}`}
            change={`Cumulative`}
            icon={FiDollarSign}
            color={COLORS.success}
            helpText={`Total billing revenue`}
            trend="up"
            bgGradient="linear(to-br, green.50, teal.50)"
          />
          <StatCard
            title="Active Customers"
            value={stats.activeCustomers}
            change={`Unique`}
            icon={FiUsers}
            color={COLORS.secondary}
            helpText={`Customer accounts`}
            trend="up"
            bgGradient="linear(to-br, purple.50, pink.50)"
          />
          <StatCard
            title="Total Duration"
            value={formatDuration(stats.totalDuration)}
            change={`Total Minutes`}
            icon={FiClock}
            color={COLORS.warning}
            helpText={`Call time aggregate`}
            trend="up"
            bgGradient="linear(to-br, orange.50, yellow.50)"
          />
        </SimpleGrid>

        {/* Detailed Charts Grid */}
        <Grid templateColumns={{ base: "1fr", lg: "3fr 1fr" }} gap={4}>
          {/* Top Destinations Table */}
          <GridItem>
            <Card
              h={"460px"}
              bg="white"
              border="1px solid"
              borderColor="gray.100"
              borderRadius="lg"
              boxShadow="md"
              overflow="hidden"
            >
              <CardHeader py={2} bg={"blue.200"}>
                {" "}
                <HStack justify="space-between">
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
                  <HStack spacing={2}>
                    <Text fontSize="sm" fontWeight={"bold"} color="gray.800">
                      Sort by:
                    </Text>

                    <Select
                      borderRadius={"md"}
                      bg={"white"}
                      size="sm"
                      w="150px"
                      value={topDestSort}
                      onChange={(e) => setTopDestSort(e.target.value)}
                    >
                      {/* <option value="revenue">Revenue</option> */}
                      <option value="cost">Cost</option>
                      <option value="completedCalls">Calls</option>
                      <option value="minutes">Minutes</option>
                    </Select>
                  </HStack>
                </HStack>
              </CardHeader>
              <CardBody p={0}>
                <TableContainer>
                  <Table variant="simple" size="sm">
                    <Thead bg="gray.200" h={"30px"}>
                      <Tr>
                        <Th color={"black"} fontWeight={"bold"}>
                          Destination
                        </Th>
                        <Th color={"black"} fontWeight={"bold"}>
                          Trunk
                        </Th>
                        <Th
                          color={"black"}
                          fontWeight={"bold"}
                          maxW={"100px"}
                          isNumeric
                        >
                          total Calls
                        </Th>
                        <Th
                          color={"black"}
                          fontWeight={"bold"}
                          maxW={"100px"}
                          isNumeric
                        >
                          Cmpt. Calls
                        </Th>
                        <Th color={"black"} fontWeight={"bold"} isNumeric>
                          Minutes
                        </Th>
                        <Th color={"black"} fontWeight={"bold"} isNumeric>
                          ASR (%)
                        </Th>
                        <Th color={"black"} fontWeight={"bold"} isNumeric>
                          ACD (m)
                        </Th>
                        {/* <Th color={"black"} fontWeight={"bold"} isNumeric>
                          Revenue
                        </Th> */}
                        <Th color={"black"} fontWeight={"bold"} isNumeric>
                          Cost
                        </Th>
                        <Th color={"black"} fontWeight={"bold"} isNumeric>
                          Margin
                        </Th>
                        <Th color={"black"} fontWeight={"bold"} isNumeric>
                          Margin (%)
                        </Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {topDestLoading ? (
                        <Tr>
                          <Td colSpan={10} textAlign="center" py={10}>
                            <Box
                              display="flex"
                              justifyContent="center"
                              alignItems="center"
                            >
                              <Slab color="#3182ce" />
                            </Box>
                          </Td>
                        </Tr>
                      ) : topDestinations?.length > 0 ? (
                        topDestinations.map((d, i) => (
                          <Tr key={i} _hover={{ bg: "gray.100" }} transition="background 0.15s" bg={d.margin < 0 && "red.200"}>
                            <Td
                              maxW="170px"
                              overflowX="auto"
                              sx={{
                                "&::-webkit-scrollbar": { display: "none" },
                                msOverflowStyle: "none",
                                scrollbarWidth: "none",
                              }}
                              fontWeight="medium"
                            >
                              {d.destination}
                            </Td>
                            <Td>
                              <Badge
                                colorScheme="purple"
                                variant="subtle"
                                fontSize="2xs"
                              >
                                {d.trunk}
                              </Badge>
                            </Td>
                            <Td isNumeric>{d.totalCalls}</Td>
                            <Td color={"green.700"} isNumeric>
                              {d.completedCalls}
                            </Td>
                            <Td isNumeric>{d.minutes}</Td>
                            <Td isNumeric>
                              <Badge px={2}
                                colorScheme={d.ASR > 50 ? "green" : "orange"}
                              >
                                {d.ASR}%
                              </Badge>
                            </Td>
                            <Td isNumeric>{formatACD(d.ACD)}</Td>
                            {/* <Td
                              isNumeric
                              fontWeight="semibold"
                              color={"green.600"}
                            >
                              ${d.revenue.toFixed(4)}
                            </Td> */}
                            <Td
                              isNumeric
                              fontWeight="semibold"
                              color={"blue.400"}
                            >
                              ${d.cost.toFixed(4)}
                            </Td>
                            <Td
                              isNumeric
                              color={d.margin >= 0 ? "green.700" : "red.700"}
                            >
                              ${d.margin.toFixed(5)}
                            </Td>
                            <Td
                              isNumeric
                              color={
                                d.marginPercentage >= 0
                                  ? "green.700"
                                  : "red.700"
                              }
                            >
                              {d.marginPercentage.toFixed(4)}%
                            </Td>
                          </Tr>
                        ))
                      ) : (
                        <Tr>
                          <Td colSpan={9} textAlign="center" py={10}>
                            No data available
                          </Td>
                        </Tr>
                      )}
                    </Tbody>
                  </Table>
                </TableContainer>
              </CardBody>
            </Card>
          </GridItem>
          {/* Financial Metrics Card */}
          <GridItem>
            <Card
              // w={{ base: "full", lg: "170px" }}
              bg="white"
              border="1px solid"
              borderColor="gray.100"
              borderRadius="lg"
              boxShadow="lg"
              overflow="hidden"
              _hover={{ boxShadow: "0 20px 60px rgba(0, 0, 0, 0.08)" }}
              transition="all 0.3s ease"
            >
              <CardHeader bg={"blue.200"} mb={6} py={2}>
                {" "}
                <HStack spacing={2}>
                  <Icon as={FiDollarSign} w={5} h={5} color="green.600" />

                  <VStack align="start" spacing={0}>
                    <Heading size="md" color="gray.800" fontWeight="semibold">
                      Financial Summary
                    </Heading>
                  </VStack>
                </HStack>
              </CardHeader>
              <CardBody py={2} px={4}>
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

        <Grid templateColumns={{ base: "1fr", lg: "2fr 1fr" }} gap={4}>
          {/* Hourly Call Volume - Area Chart */}
          <GridItem>
            <Card
              bg="white"
              border="1px solid"
              borderColor="gray.100"
              borderRadius="lg"
              boxShadow="lg"
              overflow="hidden"
              _hover={{ boxShadow: "0 20px 60px rgba(0, 0, 0, 0.08)" }}
              transition="all 0.3s ease"
            >
              <CardHeader bg={"blue.200"} py={2}>
                <HStack spacing={3}>
                  <Icon as={FiActivity} w={5} h={5} color="blue" />
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
              <CardBody p={6}>
                <Box height="300px">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData.hourlyCalls}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                      <XAxis dataKey="hour" stroke="#6B7280" fontSize={12} />
                      <YAxis yAxisId="left" stroke="#6B7280" fontSize={12} />
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        stroke="#6B7280"
                        fontSize={12}
                      />
                      <Tooltip />
                      <Legend />
                      <Bar
                        yAxisId="left"
                        dataKey="calls"
                        fill="#039b68"
                        radius={[4, 4, 0, 0]}
                        name="Call Volume"
                      />
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="calls"
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

          {/* Top Customers - Pie Chart */}
          <GridItem>
            <Card
              bg="white"
              border="1px solid"
              borderColor="gray.100"
              borderRadius="lg"
              boxShadow="lg"
              overflow="hidden"
              _hover={{ boxShadow: "0 20px 60px rgba(0, 0, 0, 0.08)" }}
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
                  {/* Sticky Header */}
                  <HStack
                    justify="space-between"
                    px={6}
                    py={2}
                    bg="gray.200"
                    borderBottom="1px solid"
                    borderColor="gray.200"
                    position="sticky"
                    top={0}
                    zIndex={1}
                  >
                    <Text
                      fontSize="xs"
                      fontWeight="bold"
                      color="gray.800"
                      letterSpacing="wide"
                    >
                      CUSTOMER
                    </Text>
                    <Text
                      fontSize="xs"
                      fontWeight="bold"
                      color="gray.800"
                      letterSpacing="wide"
                    >
                      TOTAL CALLS
                    </Text>
                  </HStack>

                  {/* Scrollable Rows Container */}
                  <Box
                    maxH="300px"
                    overflowY="auto"
                    sx={{
                      "&::-webkit-scrollbar": {
                        width: "4px",
                      },
                      "&::-webkit-scrollbar-track": {
                        width: "6px",
                        background: "gray.100",
                      },
                      "&::-webkit-scrollbar-thumb": {
                        background: "gray.400",
                        borderRadius: "24px",
                      },
                    }}
                  >
                    <VStack
                      spacing={0}
                      align="stretch"
                      divider={<StackDivider borderColor="gray.100" />}
                    >
                      {chartData.customerDistribution?.map((item, index) => (
                        <HStack
                          key={index}
                          justify="space-between"
                          px={3}
                          py={3}
                          _hover={{ bg: "gray.50" }}
                          transition="background 0.2s ease"
                        >
                          <HStack spacing={3}>
                            <Box
                              w={2.5}
                              h={2.5}
                              borderRadius="full"
                              boxShadow="sm"
                            />
<Avatar bg="green.500" size="xs" name={item.name} />
                            <Text
                              fontSize="sm"
                              fontWeight="500"
                              color="gray.700"
                            >
                              {item.name}
                            </Text>
                          </HStack>

                          <HStack spacing={2}>
                            <Text
                              fontSize="sm"
                              fontWeight="600"
                              color="gray.900"
                            >
                              {item.value}
                            </Text>
                            <Text fontSize="xs" color="gray.500">
                              calls
                            </Text>
                          </HStack>
                        </HStack>
                      ))}
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

const StatCard = ({
  title,
  value,
  change,
  icon: Icon,
  color,
  helpText,
  trend,
  bgGradient,
}) => {
  return (
    <Card
      bgGradient="linear(to-tr,blue.200, rgba(255, 255, 255, 0.8), rgba(240, 245, 255, 0.5))"
      backdropFilter="blur(10px)"
      border="1px solid"
      borderColor="gray.100"
      borderRadius="lg"
      boxShadow="md"
      overflow="hidden"
      _hover={{
        transform: "translateY(-4px)",
        boxShadow: "0 12px 40px rgba(0, 0, 0, 0.1)",
        transition: "all 0.3s ease",
      }}
      transition="all 0.3s ease"
    >
      <CardBody p={6}>
        <Flex direction="column" height="100%">
          <Flex justify="space-between" align="start" mb={4}>
            <Box flex="1">
              <Text color="gray.700" fontSize="sm" fontWeight="medium" mb={1}>
                {title}
              </Text>
              <Text fontSize="2xl" fontWeight="bold" color="gray.700">
                {value}
              </Text>
            </Box>
            <Box
              p={3}
              bgGradient={
                bgGradient || `linear(to-br, ${color}.50, ${color}.100)`
              }
              borderRadius="lg"
            >
              <Icon as={Icon} size={24} color={`${color}.600`} />
            </Box>
          </Flex>

          <Box mt="auto">
            <HStack spacing={2}>
              <Icon
                as={trend === "up" ? FiTrendingUp : FiTrendingDown}
                color={trend === "up" ? "green.500" : "red.500"}
                size={16}
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
          </Box>
        </Flex>
      </CardBody>
    </Card>
  );
};

const MetricItem = ({ label, value, icon: Icon, color, subtext }) => {
  return (
    <Box>
      <HStack spacing={3}>
        <Icon as={Icon} color={`${color}.500`} />
        <Box flex="1">
          <Text fontSize="sm" color="gray.600" fontWeight="medium">
            {label}
          </Text>
          <Text fontSize="lg" fontWeight="bold" color="gray.800">
            {value}
          </Text>
          {subtext && (
            <Text fontSize="xs" color="gray.500" mt={1}>
              {subtext}
            </Text>
          )}
        </Box>
      </HStack>
    </Box>
  );
};

export default Dashboard;
