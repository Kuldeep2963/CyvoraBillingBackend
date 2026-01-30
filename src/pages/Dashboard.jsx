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
  Center,
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
import { fetchCDRs, fetchCustomers } from "../utils/api";
import { useNavigate } from "react-router-dom";

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [chartData, setChartData] = useState({});
  const [recentActivity, setRecentActivity] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState("today");
  const navigate = useNavigate();
  const toast = useToast();

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
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [cdrsData, customersData] = await Promise.all([
        fetchCDRs(),
        fetchCustomers(),
      ]);

      setCustomers(customersData);
      calculateDashboardStats(cdrsData);
      prepareChartData(cdrsData);
      prepareRecentActivity(cdrsData);
    } catch (error) {
      console.error("Error loading dashboard data:", error);
      toast({
        title: "Error loading data",
        description: "Failed to fetch CDR data from server.",
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
    answeredCalls: 0,
    successRate: 0,
    totalDuration: 0,
    totalRevenue: 0,
    totalTax: 0,
    uniqueCustomers: 0,
    todayCalls: 0,
    todayRevenue: 0,
    totalCustomers: 0,
    avgCallDuration: 0,
    avgCallRevenue: 0,
    totalAgents: 0,
    totalIncomeFee: 0,
    totalAgentFee: 0,
  });

  const calculateDashboardStats = (cdrs) => {
    if (!cdrs || cdrs.length === 0) {
      setStats(getDefaultStats());
      return;
    }

    const totalCalls = cdrs.length;
    
    // Calculate answered calls based on endreason (0 = successful call)
    const answeredCalls = cdrs.filter((c) => parseInt(c.endreason) === 0).length;
    
    // Calculate total duration from feetime (in seconds)
    const totalDuration = cdrs.reduce(
      (sum, c) => sum + (parseInt(c.feetime) || 0),
      0
    );
    
    // Calculate revenue from fee field
    const totalRevenue = cdrs.reduce(
      (sum, c) => sum + (parseFloat(c.fee) || 0),
      0
    );
    
    // Calculate tax from tax field
    const totalTax = cdrs.reduce(
      (sum, c) => sum + (parseFloat(c.tax) || 0),
      0
    );
    
    // Calculate total income from incomefee field
    const totalIncomeFee = cdrs.reduce(
      (sum, c) => sum + (parseFloat(c.incomefee) || 0),
      0
    );
    
    // Calculate total agent fee from agentfee field
    const totalAgentFee = cdrs.reduce(
      (sum, c) => sum + (parseFloat(c.agentfee) || 0),
      0
    );
    
    // Get unique customers from customername field
    const uniqueCustomers = [...new Set(cdrs.map((c) => c.customername || c.customeraccount).filter(Boolean))].length;
    
    // Calculate unique agents from agentname field
    const uniqueAgents = [...new Set(cdrs.map((c) => c.agentname).filter(Boolean))].length;
    
    // Filter today's calls
    const today = new Date().toDateString();
    const todayCalls = cdrs.filter(
      (c) => {
        const cdrDate = new Date(parseInt(c.starttime));
        return cdrDate.toDateString() === today;
      }
    ).length;
    
    // Calculate today's revenue
    const todayRevenue = cdrs
      .filter((c) => {
        const cdrDate = new Date(parseInt(c.starttime));
        return cdrDate.toDateString() === today;
      })
      .reduce((sum, c) => sum + (parseFloat(c.fee) || 0), 0);

    setStats({
      totalCalls,
      answeredCalls,
      successRate: totalCalls > 0 ? ((answeredCalls / totalCalls) * 100).toFixed(1) : 0,
      totalDuration,
      totalRevenue,
      totalTax,
      totalIncomeFee,
      totalAgentFee,
      uniqueCustomers,
      uniqueAgents,
      todayCalls,
      todayRevenue,
      avgCallDuration: totalCalls > 0 ? Math.floor(totalDuration / totalCalls) : 0,
      avgCallRevenue: totalCalls > 0 ? (totalRevenue / totalCalls).toFixed(4) : 0,
    });
  };

  const prepareChartData = (cdrs) => {
    if (!cdrs || cdrs.length === 0) {
      setChartData({
        callTypes: [],
        hourlyCalls: [],
        topCustomers: [],
        dailyTrend: [],
        gatewayDistribution: [],
      });
      return;
    }

    // Gateway distribution
    const gatewayData = {};
    const customerRevenueMap = {};
    
    cdrs.forEach((cdr) => {
      // Group by originating gateway
      const gateway = cdr.callergatewayid || "Unknown Gateway";
      gatewayData[gateway] = (gatewayData[gateway] || 0) + 1;
      
      // Calculate customer revenue
      const customer = cdr.customername || cdr.customeraccount;
      if (customer) {
        customerRevenueMap[customer] = (customerRevenueMap[customer] || 0) + (parseFloat(cdr.fee) || 0);
      }
    });

    // Prepare gateway distribution for pie chart
    const gatewayDistribution = Object.entries(gatewayData)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);

    // Hourly call volume
    const hourlyData = Array(24)
      .fill(0)
      .map((_, hour) => ({
        hour: `${hour}:00`,
        calls: 0,
        revenue: 0,
        duration: 0,
      }));

    cdrs.forEach((cdr) => {
      const hour = new Date(parseInt(cdr.starttime)).getHours();
      if (hourlyData[hour]) {
        hourlyData[hour].calls++;
        hourlyData[hour].revenue += parseFloat(cdr.fee) || 0;
        hourlyData[hour].duration += parseInt(cdr.feetime) || 0;
      }
    });

    // Top customers by revenue
    const topCustomers = Object.entries(customerRevenueMap)
      .map(([name, revenue]) => ({
        name,
        revenue: parseFloat(revenue.toFixed(2)),
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8);

    // Last 7 days trend
    const last7Days = Array(7)
      .fill(0)
      .map((_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - i);
        return {
          date: date.toLocaleDateString("en-US", { weekday: "short" }),
          calls: 0,
          revenue: 0,
        };
      })
      .reverse();

    cdrs.forEach((cdr) => {
      const cdrDate = new Date(parseInt(cdr.starttime));
      const dayDiff = Math.floor((new Date() - cdrDate) / (1000 * 60 * 60 * 24));
      if (dayDiff >= 0 && dayDiff < 7) {
        const index = 6 - dayDiff;
        if (last7Days[index]) {
          last7Days[index].calls++;
          last7Days[index].revenue += parseFloat(cdr.fee) || 0;
        }
      }
    });

    // Call status distribution
    const statusData = cdrs.reduce((acc, cdr) => {
      const status = parseInt(cdr.endreason) === 0 ? "SUCCESS" : "FAILED";
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});

    const statusDistribution = Object.entries(statusData)
      .map(([name, value]) => ({ name, value }));

    setChartData({
      gatewayDistribution,
      hourlyCalls: hourlyData,
      topCustomers,
      dailyTrend: last7Days,
      statusDistribution,
    });
  };

  const prepareRecentActivity = (cdrs) => {
    if (!cdrs || cdrs.length === 0) {
      setRecentActivity([]);
      return;
    }

    const sortedCdrs = [...cdrs]
      .sort((a, b) => parseInt(b.starttime) - parseInt(a.starttime))
      .slice(0, 5)
      .map(cdr => ({
        ...cdr,
        starttime: new Date(parseInt(cdr.starttime)).toLocaleString(),
        status: parseInt(cdr.endreason) === 0 ? "ANSWERED" : "FAILED",
      }));

    setRecentActivity(sortedCdrs);
  };

  const refreshData = () => {
    loadDashboardData();
    toast({
      title: "Refreshing data",
      description: "Dashboard data is being refreshed...",
      status: "info",
      duration: 2000,
      isClosable: true,
    });
  };

  const formatDuration = (seconds) => {
    if (!seconds) return "0s";
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${secs}s`;
    return `${secs}s`;
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
      <VStack spacing={8} align="stretch">
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
          <Button
            leftIcon={<FiRefreshCw />}
            colorScheme="purple"
            variant="outline"
            onClick={refreshData}
            size="sm"
            _hover={{
              bg: "purple.50",
              transform: "translateX(-10px)",
              transition: "transform 0.3s",
            }}
            transition="all 0.3s"
          >
            Refresh Data
          </Button>
        </Flex>

        {/* Main Stats Grid */}
        <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={6}>
          <StatCard
            title="Total Calls"
            value={stats.totalCalls.toLocaleString()}
            change={`${stats.successRate}% success`}
            icon={FiPhoneCall}
            color={COLORS.primary}
            helpText={`${stats.answeredCalls} answered calls`}
            trend="up"
            bgGradient="linear(to-br, purple.50, blue.50)"
          />
          <StatCard
            title="Total Revenue"
            value={`$${stats.totalRevenue.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}`}
            change={`$${stats.todayRevenue.toFixed(2)} today`}
            icon={FiDollarSign}
            color={COLORS.success}
            helpText={`${stats.totalIncomeFee.toFixed(2)} income fee`}
            trend="up"
            bgGradient="linear(to-br, green.50, teal.50)"
          />
          <StatCard
            title="Active Customers"
            value={stats.uniqueCustomers}
            change={`${stats.uniqueAgents} agents`}
            icon={FiUsers}
            color={COLORS.secondary}
            helpText={`${stats.todayCalls} calls today`}
            trend="up"
            bgGradient="linear(to-br, purple.50, pink.50)"
          />
          <StatCard
            title="Total Duration"
            value={formatDuration(stats.totalDuration)}
            change={`${stats.avgCallDuration}s avg call`}
            icon={FiClock}
            color={COLORS.warning}
            helpText={`${stats.avgCallRevenue}/call avg revenue`}
            trend="up"
            bgGradient="linear(to-br, orange.50, yellow.50)"
          />
        </SimpleGrid>

        {/* Detailed Charts Grid */}
        <Grid templateColumns={{ base: "1fr", lg: "repeat(2, 1fr)" }} gap={6}>
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
                  <Box
                    p={2}
                    bgGradient="linear(to-r, blue.100, cyan.100)"
                    borderRadius="lg"
                  >
                    <Icon as={FiActivity} w={5} h={5} color="blue.600" />
                  </Box>
                  <VStack align="start" spacing={0}>
                    <Heading size="md" color="gray.800" fontWeight="semibold">
                      Hourly Call Distribution
                    </Heading>
                    <Text fontSize="sm" color="gray.500">
                      24-hour call volume
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

                <HStack
                  justify="space-between"
                  mt={4}
                  pt={4}
                  borderTop="1px solid"
                  borderColor="gray.100"
                >
                  <VStack align="start" spacing={1}>
                    <Text fontSize="xs" color="gray.500" fontWeight="medium">
                      Peak Hour
                    </Text>
                    <Text fontSize="sm" fontWeight="semibold" color="gray.800">
                      {chartData.hourlyCalls?.reduce(
                        (max, hour) => (hour.calls > max.calls ? hour : max),
                        { calls: 0, hour: "N/A" }
                      ).hour}
                    </Text>
                  </VStack>
                  <VStack align="start" spacing={1}>
                    <Text fontSize="xs" color="gray.500" fontWeight="medium">
                      Total Hours
                    </Text>
                    <Text fontSize="sm" fontWeight="semibold" color="gray.800">
                      {chartData.hourlyCalls?.reduce(
                        (sum, hour) => sum + hour.calls,
                        0
                      )}
                    </Text>
                  </VStack>
                </HStack>
              </CardBody>
            </Card>
          </GridItem>

          {/* Gateway Distribution */}
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
                  <Box
                    p={2}
                    bgGradient="linear(to-r, purple.100, pink.100)"
                    borderRadius="lg"
                  >
                    <Icon as={FiServer} w={5} h={5} color="purple.600" />
                  </Box>
                  <VStack align="start" spacing={0}>
                    <Heading size="md" color="gray.800" fontWeight="semibold">
                      Gateway Distribution
                    </Heading>
                    <Text fontSize="sm" color="gray.500">
                      Calls by originating gateway
                    </Text>
                  </VStack>
                </HStack>

                <Box position="relative" height="300px">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartData.gatewayDistribution || []}
                        cx="50%"
                        cy="50%"
                        innerRadius={70}
                        outerRadius={110}
                        paddingAngle={2}
                        dataKey="value"
                        nameKey="name"
                        label={({ name, percent }) =>
                          `${name.substring(2,10)}.. :- ${(percent * 100).toFixed(0)}%`
                        }
                        labelLine={false}
                      >
                        {(chartData.gatewayDistribution || []).map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={CHART_COLORS[index % CHART_COLORS.length]}
                            stroke="#fff"
                            strokeWidth={2}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value, name, props) => [
                          value,
                          props.payload.name,
                        ]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </Box>

                <Box mt={6} pt={6} borderTop="1px solid" borderColor="gray.100" maxH={"200px"} overflowY={"auto"}>
                  <VStack align="stretch" spacing={2}>
                    {(chartData.gatewayDistribution || []).map((item, index) => (
                      <HStack key={index} justify="space-between">
                        <HStack spacing={2}>
                          <Box
                            w={3}
                            h={3}
                            borderRadius="sm"
                            bg={CHART_COLORS[index % CHART_COLORS.length]}
                          />
                          <Text fontSize="sm" color="gray.700">
                            {item.name.length > 20
                              ? `${item.name}`
                              : item.name}
                          </Text>
                        </HStack>
                        <HStack spacing={4}>
                          <Text fontSize="sm" fontWeight="semibold" color="gray.800">
                            {item.value}
                          </Text>
                          <Text fontSize="xs" color="gray.500" minW="40px" textAlign="right">
                            {(
                              (item.value /
                                (chartData.gatewayDistribution?.reduce(
                                  (a, b) => a + b.value,
                                  0
                                ) || 1)) *
                              100
                            ).toFixed(2)}
                            %
                          </Text>
                        </HStack>
                      </HStack>
                    ))}
                  </VStack>
                </Box>
              </CardBody>
            </Card>
          </GridItem>

          {/* Financial Metrics Card */}
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
                  <Box
                    p={2}
                    bgGradient="linear(to-r, green.100, teal.100)"
                    borderRadius="lg"
                  >
                    <Icon as={FiDollarSign} w={5} h={5} color="green.600" />
                  </Box>
                  <VStack align="start" spacing={0}>
                    <Heading size="md" color="gray.800" fontWeight="semibold">
                      Financial Summary
                    </Heading>
                    <Text fontSize="sm" color="gray.500">
                      Revenue & cost breakdown
                    </Text>
                  </VStack>
                </HStack>

                <VStack spacing={4} align="stretch">
                  <MetricItem
                    label="Total Revenue"
                    value={`$${stats.totalRevenue.toFixed(2)}`}
                    icon={FiDollarSign}
                    color="green"
                    subtext="From all calls"
                  />

                  <Divider />

                  <MetricItem
                    label="Tax Collected"
                    value={`$${stats.totalTax.toFixed(2)}`}
                    icon={FiPercent}
                    color="purple"
                    subtext="Total tax amount"
                  />

                  <Divider />

                  <MetricItem
                    label="Income Fee"
                    value={`$${stats.totalIncomeFee.toFixed(2)}`}
                    icon={FiTrendingUp}
                    color="blue"
                    subtext="Service income"
                  />

                  <Divider />

                  <MetricItem
                    label="Agent Fees"
                    value={`$${stats.totalAgentFee.toFixed(2)}`}
                    icon={FiUsers}
                    color="orange"
                    subtext="Total agent commission"
                  />
                </VStack>
              </CardBody>
            </Card>
          </GridItem>

          
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
                  <Box
                    p={2}
                    bgGradient="linear(to-r, orange.100, red.100)"
                    borderRadius="lg"
                  >
                    <Icon as={FiUsers} w={5} h={5} color="orange.600" />
                  </Box>
                  <VStack align="start" spacing={0}>
                    <Heading size="md" color="gray.800" fontWeight="semibold">
                      Top Customers
                    </Heading>
                    <Text fontSize="sm" color="gray.500">
                      By revenue generated
                    </Text>
                  </VStack>
                </HStack>

                <VStack spacing={3} align="stretch">
                  {chartData.topCustomers && chartData.topCustomers.length > 0 ? (
                    chartData.topCustomers.slice(0, 4).map((customer, index) => (
                      <HStack
                        key={customer.name}
                        justify="space-between"
                        p={3}
                        _hover={{ bg: "gray.50" }}
                        borderRadius="md"
                        align="start"
                      >
                        <HStack spacing={3} flex="1">
                          <Avatar
                            size="md"
                            name={customer.name}
                            bg={CHART_COLORS[index % CHART_COLORS.length]}
                          />
                          <VStack align="start" spacing={0} flex="1">
                            <Text fontWeight="semibold" fontSize="sm" color="gray.800">
                              {customer.name}
                            </Text>
                            <Text fontSize="xs" color="gray.500">
                              Customer Account
                            </Text>
                          </VStack>
                        </HStack>
                        <VStack align="end" spacing={0}>
                          <Text fontWeight="bold" color="green.600" fontSize="md">
                            ${customer.revenue.toFixed(2)}
                          </Text>
                          <Text fontSize="xs" color="gray.500">
                            revenue
                          </Text>
                        </VStack>
                      </HStack>
                    ))
                  ) : (
                    <Text color="gray.500" textAlign="center" py={4}>
                      No customer data available
                    </Text>
                  )}

                  <Button
                    rightIcon={<FiChevronRight />}
                    variant="ghost"
                    onClick={() => navigate('/accounts')}
                    size="sm"
                    colorScheme="purple"
                    mt={2}
                  >
                    View All Customers
                  </Button>
                </VStack>
              </CardBody>
            </Card>
          </GridItem>
        </Grid>

        {/* Additional Cards Grid */}
        {/* <Grid templateColumns={{ base: "1fr", lg: "repeat(2, 1fr)" }} gap={6}>
         
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
                  <Box
                    p={2}
                    bgGradient="linear(to-r, pink.100, rose.100)"
                    borderRadius="lg"
                  >
                    <Icon as={FiActivity} w={5} h={5} color="pink.600" />
                  </Box>
                  <VStack align="start" spacing={0}>
                    <Heading size="md" color="gray.800" fontWeight="semibold">
                      Recent Activity
                    </Heading>
                    <Text fontSize="sm" color="gray.500">
                      Latest CDR entries
                    </Text>
                  </VStack>
                </HStack>

                <VStack spacing={3} align="stretch">
                  {recentActivity.length > 0 ? (
                    recentActivity.map((cdr, index) => (
                      <HStack
                        key={index}
                        justify="space-between"
                        p={2}
                        _hover={{ bg: "gray.50" }}
                        borderRadius="md"
                      >
                        <HStack spacing={3}>
                          <Icon as={FiPhoneCall} color="blue.500" />
                          <Box>
                            <Text fontWeight="medium" fontSize="sm" color="gray.800">
                              {cdr.callere164} → {cdr.calleee164}
                            </Text>
                            <Text fontSize="xs" color="gray.500">
                              {cdr.starttime}
                            </Text>
                            <Text fontSize="xs" color="gray.500">
                              {cdr.customername || cdr.customeraccount}
                            </Text>
                          </Box>
                        </HStack>
                        <VStack align="end" spacing={0}>
                          <Badge
                            colorScheme={cdr.status === "ANSWERED" ? "green" : "red"}
                            variant="subtle"
                            size="sm"
                            borderRadius="full"
                            px={2}
                          >
                            {cdr.status}
                          </Badge>
                          <Text fontSize="xs" fontWeight="bold" color="green.600">
                            ${parseFloat(cdr.fee || 0).toFixed(2)}
                          </Text>
                          <Text fontSize="xs" color="gray.500">
                            {parseInt(cdr.feetime || 0)}s
                          </Text>
                        </VStack>
                      </HStack>
                    ))
                  ) : (
                    <Text color="gray.500" textAlign="center" py={4}>
                      No recent activity
                    </Text>
                  )}
                </VStack>
              </CardBody>
            </Card>
          </GridItem>
        </Grid> */}
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