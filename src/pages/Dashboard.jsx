import React, { useState, useEffect } from 'react';
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
} from '@chakra-ui/react';
import {
  FiPhoneCall,
  FiDollarSign,
  FiUsers,
  FiClock,
  FiTrendingUp,
  FiTrendingDown,
} from 'react-icons/fi';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { fetchCDRs, fetchCustomers } from '../utils/api';

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [cdrsData, customersData] = await Promise.all([
        fetchCDRs(),
        fetchCustomers()
      ]);
      
      calculateDashboardStats(cdrsData, customersData);
      prepareChartData(cdrsData);
      prepareRecentActivity(cdrsData);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      toast({
        title: 'Error loading data',
        description: 'Failed to fetch CDR data from server. Please ensure the backend is running.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
      setStats({
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
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateDashboardStats = (cdrs, customers) => {
    const totalCalls = cdrs.length;
    const answeredCalls = cdrs.filter(c => c.status === 'ANSWERED').length;
    const totalDuration = cdrs.reduce((sum, c) => sum + (parseInt(c.duration) || 0), 0);
    const totalRevenue = cdrs.reduce((sum, c) => sum + (parseFloat(c.fee) || 0), 0);
    const totalTax = cdrs.reduce((sum, c) => sum + (parseFloat(c.tax) || 0), 0);
    const uniqueCustomers = new Set(cdrs.map(c => c.customer_id)).size;
    
    // Calculate today's stats
    const today = new Date().toDateString();
    const todayCalls = cdrs.filter(c => new Date(c.starttime).toDateString() === today);
    const todayRevenue = todayCalls.reduce((sum, c) => sum + (parseFloat(c.fee) || 0), 0);

    setStats({
      totalCalls,
      answeredCalls,
      successRate: totalCalls > 0 ? (answeredCalls / totalCalls * 100).toFixed(1) : 0,
      totalDuration,
      totalRevenue,
      totalTax,
      uniqueCustomers,
      todayCalls: todayCalls.length,
      todayRevenue,
      totalCustomers: customers.length,
      avgCallDuration: totalCalls > 0 ? Math.floor(totalDuration / totalCalls) : 0,
      avgCallRevenue: totalCalls > 0 ? (totalRevenue / totalCalls).toFixed(4) : 0,
    });
  };

  const prepareChartData = (cdrs) => {
    // Call type distribution
    const callTypeData = {};
    cdrs.forEach(cdr => {
      const type = cdr.call_type || 'OTHER';
      callTypeData[type] = (callTypeData[type] || 0) + 1;
    });

    const pieData = Object.entries(callTypeData).map(([name, value]) => ({
      name,
      value,
    }));

    // Hourly call volume
    const hourlyData = Array(24).fill(0).map((_, hour) => ({
      hour: `${hour}:00`,
      calls: 0,
    }));

    cdrs.forEach(cdr => {
      const hour = new Date(cdr.starttime).getHours();
      if (hourlyData[hour]) {
        hourlyData[hour].calls++;
      }
    });

    // Customer revenue
    const customerRevenue = {};
    cdrs.forEach(cdr => {
      const customer = cdr.customer_name || cdr.customer_id;
      if (customer) {
        customerRevenue[customer] = (customerRevenue[customer] || 0) + (parseFloat(cdr.fee) || 0);
      }
    });

    const topCustomers = Object.entries(customerRevenue)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, revenue]) => ({
        name: name.length > 15 ? name.substring(0, 15) + '...' : name,
        revenue: parseFloat(revenue.toFixed(2)),
      }));

    setChartData({
      callTypes: pieData.slice(0, 6),
      hourlyCalls: hourlyData,
      topCustomers,
    });
  };

  const prepareRecentActivity = (cdrs) => {
    const sortedCdrs = [...cdrs]
      .sort((a, b) => new Date(b.starttime) - new Date(a.starttime))
      .slice(0, 10);

    setRecentActivity(sortedCdrs);
  };

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

  if (loading || !stats) {
    return (
      <Container maxW="container.xl" py={8}>
        <VStack spacing={4}>
          <Text>Loading dashboard...</Text>
          <Progress size="xs" isIndeterminate width="100%" />
        </VStack>
      </Container>
    );
  }

  return (
    <Container maxW="container.xl" py={2} >
      <VStack spacing={8} align="stretch">
        <Box>
          <Heading size="lg" mb={2}>Dashboard</Heading>
          <Text color="gray.600">
            Overview of your CDR billing platform
          </Text>
        </Box>

        {/* Stats Grid */}
        <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={6}>
          <StatCard
            title="Total Calls"
            value={stats.totalCalls}
            change="+12%"
            icon={FiPhoneCall}
            color="blue"
            helpText={`${stats.todayCalls} calls today`}
          />
          <StatCard
            title="Total Revenue"
            value={`$${stats.totalRevenue.toFixed(2)}`}
            change="+8%"
            icon={FiDollarSign}
            color="green"
            helpText={`$${stats.todayRevenue.toFixed(2)} today`}
          />
          <StatCard
            title="Active Customers"
            value={stats.uniqueCustomers}
            change="+5%"
            icon={FiUsers}
            color="purple"
            helpText={`${stats.totalCustomers} total customers`}
          />
          <StatCard
            title="Success Rate"
            value={`${stats.successRate}%`}
            change="+2%"
            icon={FiTrendingUp}
            color="orange"
            helpText={`${stats.answeredCalls} answered calls`}
          />
        </SimpleGrid>

        {/* Charts Grid */}
        <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={6}>
          {/* Call Type Distribution */}
          <Card>
            <CardBody>
              <Text fontWeight="bold" mb={4}>Call Type Distribution</Text>
              <Box height="300px">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData.callTypes}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={(entry) => `${entry.name}: ${entry.value}`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {chartData.callTypes.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </Box>
            </CardBody>
          </Card>

          {/* Hourly Call Volume */}
          <Card>
            <CardBody>
              <Text fontWeight="bold" mb={4}>Call Volume by Hour</Text>
              <Box height="300px">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData.hourlyCalls}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="hour" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="calls" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </CardBody>
          </Card>
        </SimpleGrid>

        {/* Additional Stats */}
        <SimpleGrid columns={{ base: 1, md: 3 }} spacing={6}>
          <Card>
            <CardBody>
              <Stat>
                <StatLabel>Total Call Duration</StatLabel>
                <StatNumber fontSize="xl">
                  {Math.floor(stats.totalDuration / 3600)}h {Math.floor((stats.totalDuration % 3600) / 60)}m
                </StatNumber>
                <StatHelpText>
                  <Icon as={FiClock} mr={1} />
                  Avg: {stats.avgCallDuration}s per call
                </StatHelpText>
              </Stat>
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <Stat>
                <StatLabel>Average Call Revenue</StatLabel>
                <StatNumber fontSize="xl">${stats.avgCallRevenue}</StatNumber>
                <StatHelpText>
                  <Icon as={FiDollarSign} mr={1} />
                  Per call average
                </StatHelpText>
              </Stat>
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <Stat>
                <StatLabel>Tax Collected</StatLabel>
                <StatNumber fontSize="xl">${stats.totalTax.toFixed(2)}</StatNumber>
                <StatHelpText>
                  <Icon as={FiTrendingUp} mr={1} />
                  18% tax rate
                </StatHelpText>
              </Stat>
            </CardBody>
          </Card>
        </SimpleGrid>

        {/* Recent Activity */}
        {/* <Card>
          <CardBody>
            <Text fontWeight="bold" mb={4}>Recent CDR Activity</Text>
            <VStack spacing={3} align="stretch">
              {recentActivity.map((cdr, index) => (
                <HStack key={index} justify="space-between" p={2} _hover={{ bg: 'gray.50' }} borderRadius="md">
                  <HStack spacing={4}>
                    <Icon as={FiPhoneCall} color="gray.500" />
                    <Box>
                      <Text fontWeight="medium">
                        {cdr.callere164} → {cdr.calleee164}
                      </Text>
                      <Text fontSize="sm" color="gray.600">
                        {new Date(cdr.starttime).toLocaleString()}
                      </Text>
                    </Box>
                  </HStack>
                  <HStack spacing={4}>
                    <Badge colorScheme={cdr.status === 'ANSWERED' ? 'green' : 'red'}>
                      {cdr.status}
                    </Badge>
                    <Text fontWeight="bold" color="green.600">
                      ${cdr.fee ? parseFloat(cdr.fee).toFixed(4) : '0.0000'}
                    </Text>
                  </HStack>
                </HStack>
              ))}
              
              {recentActivity.length === 0 && (
                <Text color="gray.500" textAlign="center" py={4}>
                  No recent activity. Upload some CDRs to get started.
                </Text>
              )}
            </VStack>
          </CardBody>
        </Card> */}
      </VStack>
    </Container>
  );
};

const StatCard = ({ title, value, change, icon: Icon, color, helpText }) => {
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');

  return (
    <Card bg={bgColor} border="1px" borderColor={borderColor}>
      <CardBody>
        <Stat>
          <HStack justify="space-between" mb={2}>
            <StatLabel color="gray.600">{title}</StatLabel>
            <Icon as={Icon} color={`${color}.500`} />
          </HStack>
          <StatNumber fontSize="2xl">{value}</StatNumber>
          <StatHelpText>
            <HStack>
              <Icon as={change.startsWith('+') ? FiTrendingUp : FiTrendingDown} />
              <Text>{change}</Text>
              <Text ml={2} color="gray.500">{helpText}</Text>
            </HStack>
          </StatHelpText>
        </Stat>
      </CardBody>
    </Card>
  );
};

export default Dashboard;