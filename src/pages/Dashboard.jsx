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
  Progress,
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
  Avatar,
  AvatarGroup,
  Button,
  Spinner,
  Divider,
  Select,
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
  Area,
  LineChart,
  Line,
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
} from "recharts";
import { fetchDashboardStats, fetchCustomers } from "../utils/api";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [chartData, setChartData] = useState({});
  const [financialData, setFinancialData] = useState({});
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState("today");
  const [currentTime, setCurrentTime] = useState(new Date());
  const navigate = useNavigate();
  const toast = useToast();

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);
  
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

  const CHART_COLORS = [
    "#6366F1",
    "#8B5CF6",
    "#EC4899",
    "#10B981",
    "#F59E0B",
    "#EF4444",
    "#3B82F6",
    "#06B6D4",
  ];

  useEffect(() => {
    loadDashboardData(timeRange);
  }, [timeRange]);

  const loadDashboardData = async (range = "today") => {
    try {
      setLoading(true);
      const [dashData, customersData] = await Promise.all([
        fetchDashboardStats({ range }),
        fetchCustomers(),
      ]);

      setCustomers(customersData);

      if (dashData.success) {
        const {
          stats: s,
          hourlyDistribution,
          topDestinations,
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
          topDestinations: topDestinations,
        });
      }
    } catch (error) {
      console.error("Error loading dashboard data:", error);
      toast({
        title: "Error loading data",
        description: "Failed to fetch dashboard data from server.",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
      setStats(getDefaultStats());
    } finally {
      setLoading(false);
    }
  };

  const getDefaultStats = () => ({
    totalCalls: 0,
    totalRevenue: 0,
    totalDuration: 0,
    activeCustomers: 0,
  });

  const refreshData = () => {
    loadDashboardData(timeRange);
    toast({
      title: "Refreshing data",
      description: "Dashboard data is being refreshed...",
      status: "info",
      duration: 2000,
      isClosable: true,
    });
  };

  const formatDuration = (minutes) => {
    if (!minutes) return "0m";
    const hours = Math.floor(minutes / 60);
    const mins = Math.floor(minutes % 60);

    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  if (loading || !stats) {
    return (
      <Container maxW="container.xl" py={8}>
        <Center height="60vh">
          <VStack spacing={6}>
            <Spinner size="xl" color={COLORS.primary} thickness="3px" />
            <Text color="gray.600" fontSize="lg">
              Loading dashboard analytics...
            </Text>
            <Progress size="xs" isIndeterminate width="200px" />
          </VStack>
        </Center>
      </Container>
    );
  }

  return (
    <Container maxW="container.xl" py={2}>
      <VStack spacing={4} align="stretch">
        {/* Header with title and refresh */}
        <Flex justify="space-between" align="center">
          <Box>
            <Heading
              size="xl"
              mb={2}
              fontWeight="700"
              bgGradient="linear(to-r, purple.600, blue.500)"
              bgClip="text"
            >
              CDR Analytics Dashboard
            </Heading>
            <Text color="gray.600" fontSize="md">
              Real-time insights into call data records and billing
            </Text>
          </Box>
          <HStack spacing={4}>
            <Box
              px={4}
              py={2}
              bg="white"
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
              bg="white"
            >
              <option value="today">Today</option>
              <option value="week">Weekly</option>
              <option value="biweekly">Biweekly</option>
              <option value="monthly">Monthly</option>
              <option value="3month">3 Months</option>
            </Select>
            <Button
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
            </Button>
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
              h={"490px"}
              bg="white"
              border="1px solid"
              borderColor="gray.100"
              borderRadius="2xl"
              boxShadow="0 10px 40px rgba(0, 0, 0, 0.05)"
              overflow="hidden"
            >
              <CardBody p={6}>
                <HStack
                  spacing={3}
                  mb={6}
                  pb={4}
                  borderBottom="1px solid"
                  borderColor="gray.100"
                >
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

                <TableContainer>
                  <Table variant="simple" size="sm">
                    <Thead bg="gray.100">
                      <Tr>
                        <Th>Destination</Th>
                        <Th>Trunk</Th>
                        <Th isNumeric>Calls</Th>
                        <Th isNumeric>Minutes</Th>
                        <Th isNumeric>ASR (%)</Th>
                        <Th isNumeric>ACD (m)</Th>
                        <Th isNumeric>Revenue</Th>
                        <Th isNumeric>Margin</Th>
                        <Th isNumeric>Margin (%)</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {chartData.topDestinations?.map((d, i) => (
                        <Tr key={i}>
                          <Td maxW="170px" overflowX="auto" sx={{
                      '&::-webkit-scrollbar': { display: 'none' },
                      msOverflowStyle: 'none',
                      scrollbarWidth: 'none'
                    }} fontWeight="medium">{d.destination}</Td>
                          <Td>
                            <Badge colorScheme="purple" variant="subtle" fontSize="2xs">
                              {d.trunk}
                            </Badge>
                          </Td>
                          <Td isNumeric>{d.totalCalls}</Td>
                          <Td isNumeric>{d.minutes}</Td>
                          <Td isNumeric>
                            <Badge
                              colorScheme={d.ASR > 50 ? "green" : "orange"}
                            >
                              {d.ASR}%
                            </Badge>
                          </Td>
                          <Td isNumeric>{d.ACD}</Td>
                          <Td isNumeric fontWeight="semibold">
                            ${d.revenue.toFixed(2)}
                          </Td>
                          <Td
                            isNumeric
                            color={d.margin >= 0 ? "green.600" : "red.600"}
                          >
                            ${d.margin.toFixed(2)}
                          </Td>
                          <Td
                            isNumeric
                            color={
                              d.marginPercentage >= 0 ? "green.600" : "red.600"
                            }
                          >
                            {d.marginPercentage}%
                          </Td>
                        </Tr>
                      ))}
                    </Tbody>
                  </Table>
                </TableContainer>
              </CardBody>
            </Card>
          </GridItem>
          {/* Financial Metrics Card */}
          <GridItem>
            <Card
              w={{ base: "full", lg: "100%" }}
              bg="white"
              border="1px solid"
              borderColor="gray.100"
              borderRadius="2xl"
              boxShadow="0 10px 40px rgba(0, 0, 0, 0.05)"
              overflow="hidden"
              _hover={{ boxShadow: "0 20px 60px rgba(0, 0, 0, 0.08)" }}
              transition="all 0.3s ease"
            >
              <CardBody p={6}>
                <HStack
                  spacing={3}
                  mb={6}
                  pb={4}
                  borderBottom="1px solid"
                  borderColor="gray.100"
                >
                    <Icon as={FiDollarSign} w={5} h={5} color="green.600" />
                 
                  <VStack align="start" spacing={0}>
                    <Heading size="md" color="gray.800" fontWeight="semibold">
                      Financial Summary
                    </Heading>
                    <Text fontSize="xs" color="gray.500">
                      Revenue & cost breakdown
                    </Text>
                  </VStack>
                </HStack>

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
                    subtext="Total agent commission"
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
              borderRadius="2xl"
              boxShadow="0 10px 40px rgba(0, 0, 0, 0.05)"
              overflow="hidden"
              _hover={{ boxShadow: "0 20px 60px rgba(0, 0, 0, 0.08)" }}
              transition="all 0.3s ease"
            >
              <CardBody p={6}>
                <HStack
                  spacing={3}
                  mb={6}
                  pb={4}
                  borderBottom="1px solid"
                  borderColor="gray.100"
                >
                    <Icon as={FiActivity} w={5} h={5} color="blue.600" />
                  <VStack align="start" spacing={0}>
                    <Heading size="md" color="gray.800" fontWeight="semibold">
                      Hourly Call Distribution
                    </Heading>
                    <Text fontSize="xs" color="gray.500">
                      Call volume by hour
                    </Text>
                  </VStack>
                </HStack>

                <Box height="300px">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData.hourlyCalls}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                      <XAxis dataKey="hour" stroke="#6B7280" fontSize={12} />
                      <YAxis stroke="#6B7280" fontSize={12} />
                      <Tooltip
                        formatter={(value) => [value, "Calls"]}
                        contentStyle={{
                          backgroundColor: "white",
                          border: "1px solid #E5E7EB",
                          borderRadius: "8px",
                          boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                        }}
                      />
                      <Bar
                        dataKey="calls"
                        fill="#6366F1"
                        radius={[4, 4, 0, 0]}
                        name="Calls"
                      />
                    </BarChart>
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
              borderRadius="2xl"
              boxShadow="0 10px 40px rgba(0, 0, 0, 0.05)"
              overflow="hidden"
              _hover={{ boxShadow: "0 20px 60px rgba(0, 0, 0, 0.08)" }}
              transition="all 0.3s ease"
            >
              <CardBody p={6}>
                <HStack
                  spacing={3}
                  mb={6}
                  pb={2}
                  borderBottom="1px solid"
                  borderColor="gray.100"
                >
                    <Icon as={FiUsers} w={5} h={5} color="purple.600" />
                  <VStack align="start" spacing={0}>
                    <Heading size="md" color="gray.800" fontWeight="semibold">
                      Top Customers
                    </Heading>
                    <Text fontSize="xs" color="gray.500">
                      Distribution by Total Calls
                    </Text>
                  </VStack>
                </HStack>

                <Box position="relative" height="200px">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartData.customerDistribution || []}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="value"
                        nameKey="name"
                      >
                        {(chartData.customerDistribution || []).map(
                          (entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={CHART_COLORS[index % CHART_COLORS.length]}
                            />
                          ),
                        )}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </Box>

                <VStack
                  mt={6}
                  spacing={2}
                  align="stretch"
                  maxH="200px"
                  overflowY="auto"
                >
                  {/* Sticky Header */}
                  <HStack
                    justify="space-between"
                    p={2}
                    position="sticky"
                    top={0}
                    bg="white" // or gray.100 / your theme bg
                    zIndex={1}
                    borderBottom="1px solid"
                    borderColor="gray.200"
                  >
                    <Text fontSize="sm" fontWeight="bold">
                      CUSTOMER
                    </Text>
                    <Text fontSize="sm" fontWeight="bold">
                      CALLS
                    </Text>
                  </HStack>

                  {/* Scrollable Rows */}
                  {chartData.customerDistribution?.map((item, index) => (
                    <HStack
                      key={index}
                      justify="space-between"
                      borderRadius="md"
                      _hover={{ bg: "gray.50" }}
                    >
                      <HStack spacing={3}>
                        <Box
                          w={3}
                          h={3}
                          borderRadius="full"
                          bg={CHART_COLORS[index % CHART_COLORS.length]}
                        />
                        <Text
                          fontSize="sm"
                          fontWeight="medium"
                          color="gray.700"
                        >
                          {item.name}
                        </Text>
                      </HStack>
                      <Text fontSize="sm" fontWeight="bold" color="gray.800">
                        {item.value} calls
                      </Text>
                    </HStack>
                  ))}
                </VStack>
              </CardBody>
            </Card>
          </GridItem>
        </Grid>
      </VStack>
    </Container>
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
      bg="white"
      border="1px solid"
      borderColor="gray.100"
      borderRadius="2xl"
      boxShadow="0 4px 20px rgba(0, 0, 0, 0.05)"
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
              <Text color="gray.500" fontSize="sm" fontWeight="medium" mb={1}>
                {title}
              </Text>
              <Text fontSize="2xl" fontWeight="bold" color="gray.800">
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
