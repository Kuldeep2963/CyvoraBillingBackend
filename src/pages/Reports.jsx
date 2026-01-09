import React, { useState } from 'react';
import {
  Box,
  Container,
  Heading,
  Text,
  Button,
  Flex,
  Grid,
  GridItem,
  Card,
  CardBody,
  CardHeader,
  SimpleGrid,
  Select,
  Input,
  InputGroup,
  InputLeftElement,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Badge,
  HStack,
  VStack,
  Progress,
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
  StatHelpText,
  StatArrow,
  useColorModeValue,
  FormControl,
  FormLabel,
  Switch,
  Divider,
  Stack,
  Tooltip,
  useToast
} from '@chakra-ui/react';
import {
  DownloadIcon,
  CalendarIcon,
  // SearchIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ViewIcon,
  EditIcon,
  DeleteIcon,
  
  // FilterIcon,
  // RefreshIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  // InfoOutlineIcon,
  SettingsIcon,
  AttachmentIcon,
  // ChartBarIcon,
  // ChartLineIcon,
  // ChartPieIcon
} from '@chakra-ui/icons';
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
  Area
} from 'recharts';

const Reports = () => {
  const [dateRange, setDateRange] = useState('last30days');
  const [reportType, setReportType] = useState('revenue');
  const [activeTab, setActiveTab] = useState(0);
  
  const toast = useToast();
  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');

  // Sample data for charts
  const revenueData = [
    { month: 'Jan', revenue: 12500, calls: 2450, data: 125 },
    { month: 'Feb', revenue: 13800, calls: 2780, data: 142 },
    { month: 'Mar', revenue: 15200, calls: 3120, data: 156 },
    { month: 'Apr', revenue: 14500, calls: 2890, data: 148 },
    { month: 'May', revenue: 16800, calls: 3350, data: 168 },
    { month: 'Jun', revenue: 18200, calls: 3640, data: 182 },
    { month: 'Jul', revenue: 19500, calls: 3900, data: 195 }
  ];

  const serviceTypeData = [
    { name: 'Voice Calls', value: 45, color: '#3182CE' },
    { name: 'Data Usage', value: 30, color: '#38A169' },
    { name: 'SMS Services', value: 15, color: '#D69E2E' },
    { name: 'Monthly Fees', value: 10, color: '#805AD5' }
  ];

  const customerRevenueData = [
    { customer: 'ABC Telecom', revenue: 12500, growth: 12.5, status: 'active' },
    { customer: 'XYZ Mobile', revenue: 9800, growth: 8.2, status: 'active' },
    { customer: 'Global Comm', revenue: 15600, growth: -2.5, status: 'warning' },
    { customer: 'Telecom Plus', revenue: 7500, growth: 15.8, status: 'active' },
    { customer: 'Connect World', revenue: 5200, growth: 5.4, status: 'active' },
    { customer: 'Net Solutions', revenue: 3400, growth: -8.1, status: 'critical' }
  ];

  const topCDRReports = [
    { id: 'CDR-001', type: 'Voice Usage', period: 'Oct 2023', records: 2450, size: '2.4MB', status: 'processed' },
    { id: 'CDR-002', type: 'Data Usage', period: 'Oct 2023', records: 1250, size: '1.8MB', status: 'processing' },
    { id: 'CDR-003', type: 'SMS Traffic', period: 'Sep 2023', records: 890, size: '0.9MB', status: 'processed' },
    { id: 'CDR-004', type: 'Voice Usage', period: 'Sep 2023', records: 2120, size: '2.1MB', status: 'processed' },
    { id: 'CDR-005', type: 'Combined', period: 'Aug 2023', records: 3560, size: '3.5MB', status: 'processed' }
  ];

  const reportTemplates = [
    { id: 1, name: 'Monthly Revenue', type: 'Financial', frequency: 'Monthly', lastRun: '2 days ago' },
    { id: 2, name: 'CDR Usage Summary', type: 'Usage', frequency: 'Weekly', lastRun: '1 day ago' },
    { id: 3, name: 'Customer Billing', type: 'Billing', frequency: 'Monthly', lastRun: '3 days ago' },
    { id: 4, name: 'Service Performance', type: 'Performance', frequency: 'Daily', lastRun: 'Today' }
  ];

  // Statistics data
  const stats = [
    { label: 'Total Revenue', value: '$127,500', change: '+12.5%', trend: 'up' },
    { label: 'Active Customers', value: '48', change: '+5', trend: 'up' },
    { label: 'Total CDR Records', value: '15,240', change: '+8.2%', trend: 'up' },
    { label: 'Avg Invoice Value', value: '$2,650', change: '+3.4%', trend: 'up' }
  ];

  const handleExportReport = (format) => {
    toast({
      title: 'Export Started',
      description: `Exporting report in ${format} format...`,
      status: 'info',
      duration: 2000,
      isClosable: true
    });
    
    // Simulate export delay
    setTimeout(() => {
      toast({
        title: 'Export Complete',
        description: `Report downloaded in ${format} format`,
        status: 'success',
        duration: 3000,
        isClosable: true
      });
    }, 1500);
  };

  const handleRunReport = () => {
    toast({
      title: 'Generating Report',
      description: 'Processing report data...',
      status: 'info',
      duration: 2000,
      isClosable: true
    });
    
    setTimeout(() => {
      toast({
        title: 'Report Generated',
        description: 'New report is ready to view',
        status: 'success',
        duration: 3000,
        isClosable: true
      });
    }, 2000);
  };

  return (
    <Container maxW="container.xl" py={8}>
      {/* Header */}
      <Flex justify="space-between" align="center" mb={8}>
        <Box>
          <Heading size="lg" mb={2}>Analytics & Reports</Heading>
          <Text color="gray.600">Comprehensive insights and analytics from your CDR data</Text>
        </Box>
        
        <HStack spacing={3}>
          <Menu>
            <MenuButton as={Button} rightIcon={<ChevronDownIcon />} variant="outline">
              <CalendarIcon mr={2} />
              Last 30 Days
            </MenuButton>
            <MenuList>
              <MenuItem onClick={() => setDateRange('today')}>Today</MenuItem>
              <MenuItem onClick={() => setDateRange('last7days')}>Last 7 Days</MenuItem>
              <MenuItem onClick={() => setDateRange('last30days')}>Last 30 Days</MenuItem>
              <MenuItem onClick={() => setDateRange('lastquarter')}>Last Quarter</MenuItem>
              <MenuItem onClick={() => setDateRange('custom')}>Custom Range</MenuItem>
            </MenuList>
          </Menu>
          
          <Button
            leftIcon={<DownloadIcon />}
            colorScheme="blue"
            onClick={() => handleExportReport('PDF')}
          >
            Export
          </Button>
        </HStack>
      </Flex>

      {/* Quick Stats */}
      <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={6} mb={8}>
        {stats.map((stat, index) => (
          <Card key={index} bg={cardBg} border="1px" borderColor={borderColor}>
            <CardBody>
              <Stat>
                <StatLabel color="gray.600">{stat.label}</StatLabel>
                <StatNumber fontSize="2xl">{stat.value}</StatNumber>
                <StatHelpText>
                  <StatArrow type={stat.trend === 'up' ? 'increase' : 'decrease'} />
                  {stat.change}
                </StatHelpText>
              </Stat>
            </CardBody>
          </Card>
        ))}
      </SimpleGrid>

      {/* Main Content Tabs */}
      <Tabs variant="enclosed" colorScheme="blue" mb={8}>
        <TabList>
          <Tab>Overview</Tab>
          <Tab>Revenue Analytics</Tab>
          <Tab>CDR Reports</Tab>
          <Tab>Customer Reports</Tab>
          <Tab>Scheduled Reports</Tab>
        </TabList>

        <TabPanels>
          {/* Overview Tab */}
          <TabPanel px={0}>
            <Grid templateColumns={{ base: '1fr', lg: '2fr 1fr' }} gap={6}>
              {/* Revenue Chart */}
              <Card bg={cardBg} border="1px" borderColor={borderColor}>
                <CardHeader>
                  <Flex justify="space-between" align="center">
                    <Heading size="md">Revenue Trend</Heading>
                    <Select size="sm" width="150px" defaultValue="monthly">
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                    </Select>
                  </Flex>
                </CardHeader>
                <CardBody>
                  <Box height="300px">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={revenueData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="month" />
                        <YAxis />
                        <RechartsTooltip />
                        <Legend />
                        <Area 
                          type="monotone" 
                          dataKey="revenue" 
                          name="Revenue ($)" 
                          stroke="#3182CE" 
                          fill="#3182CE" 
                          fillOpacity={0.2}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </Box>
                </CardBody>
              </Card>

              {/* Service Distribution */}
              <Card bg={cardBg} border="1px" borderColor={borderColor}>
                <CardHeader>
                  <Heading size="md">Service Distribution</Heading>
                </CardHeader>
                <CardBody>
                  <Box height="300px">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={serviceTypeData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {serviceTypeData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <RechartsTooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </Box>
                </CardBody>
              </Card>
            </Grid>

            {/* Top Customers */}
            <Card bg={cardBg} border="1px" borderColor={borderColor} mt={6}>
              <CardHeader>
                <Flex justify="space-between" align="center">
                  <Heading size="md">Top Customers by Revenue</Heading>
                  <Button size="sm" variant="ghost" rightIcon={<ChevronRightIcon />}>
                    View All
                  </Button>
                </Flex>
              </CardHeader>
              <CardBody>
                <Table variant="simple">
                  <Thead>
                    <Tr bg={"gray.200"}>
                      <Th color={"gray.800"}>Customer</Th>
                      <Th color={"gray.800"}>Revenue</Th>
                      <Th color={"gray.800"}>Growth</Th>
                      <Th color={"gray.800"}>Status</Th>
                      <Th color={"gray.800"}>Actions</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {customerRevenueData.map((customer, index) => (
                      <Tr key={index}>
                        <Td>
                          <Text fontWeight="medium">{customer.customer}</Text>
                        </Td>
                        <Td>
                          <Text fontWeight="bold">${customer.revenue.toLocaleString()}</Text>
                        </Td>
                        <Td>
                          <HStack>
                            {customer.growth > 0 ? (
                              <ArrowUpIcon color="green.500" />
                            ) : (
                              <ArrowDownIcon color="red.500" />
                            )}
                            <Text color={customer.growth > 0 ? 'green.500' : 'red.500'}>
                              {Math.abs(customer.growth)}%
                            </Text>
                          </HStack>
                        </Td>
                        <Td>
                          <Badge
                            colorScheme={
                              customer.status === 'active' ? 'green' :
                              customer.status === 'warning' ? 'yellow' : 'red'
                            }
                          >
                            {customer.status}
                          </Badge>
                        </Td>
                        <Td>
                          <IconButton
                            aria-label="View details"
                            icon={<ViewIcon />}
                            size="sm"
                            variant="ghost"
                          />
                        </Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </CardBody>
            </Card>
          </TabPanel>

          {/* Revenue Analytics Tab */}
          <TabPanel px={0}>
            <Grid templateColumns={{ base: '1fr', lg: '3fr 1fr' }} gap={6}>
              <Card bg={cardBg} border="1px" borderColor={borderColor}>
                <CardHeader>
                  <Heading size="md">Detailed Revenue Analysis</Heading>
                </CardHeader>
                <CardBody>
                  <Tabs size="sm" variant="line">
                    <TabList>
                      <Tab>Revenue vs Calls</Tab>
                      <Tab>Monthly Breakdown</Tab>
                      <Tab>Year-over-Year</Tab>
                    </TabList>
                    <TabPanels>
                      <TabPanel px={0}>
                        <Box height="400px">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={revenueData}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="month" />
                              <YAxis yAxisId="left" />
                              <YAxis yAxisId="right" orientation="right" />
                              <RechartsTooltip />
                              <Legend />
                              <Line
                                yAxisId="left"
                                type="monotone"
                                dataKey="revenue"
                                name="Revenue ($)"
                                stroke="#3182CE"
                                strokeWidth={2}
                              />
                              <Line
                                yAxisId="right"
                                type="monotone"
                                dataKey="calls"
                                name="Calls Count"
                                stroke="#38A169"
                                strokeWidth={2}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </Box>
                      </TabPanel>
                      <TabPanel>
                        <Box height="400px">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={revenueData}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="month" />
                              <YAxis />
                              <RechartsTooltip />
                              <Legend />
                              <Bar dataKey="revenue" name="Revenue" fill="#3182CE" />
                              <Bar dataKey="data" name="Data (GB)" fill="#38A169" />
                            </BarChart>
                          </ResponsiveContainer>
                        </Box>
                      </TabPanel>
                    </TabPanels>
                  </Tabs>
                </CardBody>
              </Card>

              {/* Filters Sidebar */}
              <Card bg={cardBg} border="1px" borderColor={borderColor} height="fit-content">
                <CardHeader>
                  <Heading size="md">Filters</Heading>
                </CardHeader>
                <CardBody>
                  <VStack spacing={4} align="stretch">
                    <FormControl>
                      <FormLabel fontSize="sm">Report Type</FormLabel>
                      <Select size="sm">
                        <option>Revenue Summary</option>
                        <option>Detailed Billing</option>
                        <option>Tax Report</option>
                        <option>Collection Report</option>
                      </Select>
                    </FormControl>

                    <FormControl>
                      <FormLabel fontSize="sm">Service Type</FormLabel>
                      <Select size="sm">
                        <option>All Services</option>
                        <option>Voice Calls Only</option>
                        <option>Data Usage Only</option>
                        <option>SMS Only</option>
                      </Select>
                    </FormControl>

                    <FormControl>
                      <FormLabel fontSize="sm">Customer Group</FormLabel>
                      <Select size="sm">
                        <option>All Customers</option>
                        <option>Enterprise</option>
                        <option>SMB</option>
                        <option>Individual</option>
                      </Select>
                    </FormControl>

                    <FormControl display="flex" alignItems="center">
                      <FormLabel mb={0} fontSize="sm">Include Tax</FormLabel>
                      <Switch colorScheme="blue" defaultChecked />
                    </FormControl>

                    <FormControl display="flex" alignItems="center">
                      <FormLabel mb={0} fontSize="sm">Show Projections</FormLabel>
                      <Switch colorScheme="blue" />
                    </FormControl>

                    <Button
                      colorScheme="blue"
                      size="sm"
                      width="full"
                      onClick={handleRunReport}
                    >
                      Generate Report
                    </Button>
                  </VStack>
                </CardBody>
              </Card>
            </Grid>
          </TabPanel>

          {/* CDR Reports Tab */}
          <TabPanel px={0}>
            <Card bg={cardBg} border="1px" borderColor={borderColor} mb={6}>
              <CardHeader>
                <Flex justify="space-between" align="center">
                  <Heading size="md">CDR Report History</Heading>
                  <Button
                    // leftIcon={<FilterIcon />}
                    size="sm"
                    variant="outline"
                  >
                    Filter Reports
                  </Button>
                </Flex>
              </CardHeader>
              <CardBody>
                <Table variant="simple">
                  <Thead>
                    <Tr>
                      <Th>Report ID</Th>
                      <Th>Type</Th>
                      <Th>Period</Th>
                      <Th>Records</Th>
                      <Th>File Size</Th>
                      <Th>Status</Th>
                      <Th>Actions</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {topCDRReports.map((report) => (
                      <Tr key={report.id}>
                        <Td>
                          <HStack>
                            <AttachmentIcon color="blue.500" />
                            <Text fontWeight="medium">{report.id}</Text>
                          </HStack>
                        </Td>
                        <Td>{report.type}</Td>
                        <Td>{report.period}</Td>
                        <Td>{report.records.toLocaleString()}</Td>
                        <Td>{report.size}</Td>
                        <Td>
                          <Badge
                            colorScheme={
                              report.status === 'processed' ? 'green' :
                              report.status === 'processing' ? 'yellow' : 'gray'
                            }
                          >
                            {report.status}
                          </Badge>
                        </Td>
                        <Td>
                          <HStack spacing={2}>
                            <Tooltip label="Download Report">
                              <IconButton
                                aria-label="Download"
                                icon={<DownloadIcon />}
                                size="sm"
                                variant="ghost"
                              />
                            </Tooltip>
                            <Tooltip label="View Details">
                              <IconButton
                                aria-label="View"
                                icon={<ViewIcon />}
                                size="sm"
                                variant="ghost"
                              />
                            </Tooltip>
                            <Tooltip label="Regenerate">
                              <IconButton
                                aria-label="Refresh"
                                // icon={<RefreshIcon />}
                                size="sm"
                                variant="ghost"
                              />
                            </Tooltip>
                          </HStack>
                        </Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </CardBody>
            </Card>

            {/* Generate New Report */}
            <Card bg={cardBg} border="1px" borderColor={borderColor}>
              <CardHeader>
                <Heading size="md">Generate New CDR Report</Heading>
              </CardHeader>
              <CardBody>
                <Grid templateColumns={{ base: '1fr', md: 'repeat(3, 1fr)' }} gap={6}>
                  <FormControl>
                    <FormLabel>Report Type</FormLabel>
                    <Select>
                      <option>Voice Call Summary</option>
                      <option>Data Usage Report</option>
                      <option>SMS Traffic Report</option>
                      <option>Complete CDR Export</option>
                      <option>Custom Report</option>
                    </Select>
                  </FormControl>

                  <FormControl>
                    <FormLabel>Date Range</FormLabel>
                    <InputGroup>
                      <InputLeftElement pointerEvents="none">
                        <CalendarIcon color="gray.400" />
                      </InputLeftElement>
                      <Input type="date" />
                    </InputGroup>
                  </FormControl>

                  <FormControl>
                    <FormLabel>Customer</FormLabel>
                    <Select>
                      <option>All Customers</option>
                      <option>ABC Telecom</option>
                      <option>XYZ Mobile</option>
                      <option>Global Comm</option>
                    </Select>
                  </FormControl>

                  <FormControl>
                    <FormLabel>Format</FormLabel>
                    <Select>
                      <option>CSV</option>
                      <option>Excel</option>
                      <option>PDF</option>
                      <option>JSON</option>
                    </Select>
                  </FormControl>

                  <FormControl>
                    <FormLabel>Service Type</FormLabel>
                    <Select>
                      <option>All Services</option>
                      <option>Voice Only</option>
                      <option>Data Only</option>
                      <option>SMS Only</option>
                    </Select>
                  </FormControl>

                  <Flex align="flex-end">
                    <Button
                      colorScheme="blue"
                      width="full"
                      onClick={handleRunReport}
                      // leftIcon={<ChartBarIcon />}
                    >
                      Generate Report
                    </Button>
                  </Flex>
                </Grid>
              </CardBody>
            </Card>
          </TabPanel>

          {/* Customer Reports Tab */}
          <TabPanel px={0}>
            <Grid templateColumns={{ base: '1fr', lg: '2fr 1fr' }} gap={6}>
              <Card bg={cardBg} border="1px" borderColor={borderColor}>
                <CardHeader>
                  <Heading size="md">Customer Performance Metrics</Heading>
                </CardHeader>
                <CardBody>
                  <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6}>
                    <Box>
                      <Text fontWeight="medium" mb={4}>Revenue Distribution</Text>
                      <VStack spacing={4} align="stretch">
                        {customerRevenueData.slice(0, 4).map((customer, index) => (
                          <Box key={index}>
                            <Flex justify="space-between" mb={1}>
                              <Text fontSize="sm">{customer.customer}</Text>
                              <Text fontSize="sm" fontWeight="medium">
                                ${customer.revenue.toLocaleString()}
                              </Text>
                            </Flex>
                            <Progress
                              value={(customer.revenue / 20000) * 100}
                              colorScheme="blue"
                              size="sm"
                              borderRadius="md"
                            />
                          </Box>
                        ))}
                      </VStack>
                    </Box>
                    
                    <Box>
                      <Text fontWeight="medium" mb={4}>Usage Statistics</Text>
                      <VStack spacing={4} align="stretch">
                        <Card variant="outline" p={3}>
                          <Text fontSize="sm" color="gray.600">Avg. Monthly Calls</Text>
                          <Text fontSize="lg" fontWeight="bold">3,240</Text>
                        </Card>
                        <Card variant="outline" p={3}>
                          <Text fontSize="sm" color="gray.600">Avg. Data Usage</Text>
                          <Text fontSize="lg" fontWeight="bold">156 GB</Text>
                        </Card>
                        <Card variant="outline" p={3}>
                          <Text fontSize="sm" color="gray.600">Avg. Invoice Value</Text>
                          <Text fontSize="lg" fontWeight="bold">$2,650</Text>
                        </Card>
                      </VStack>
                    </Box>
                  </SimpleGrid>
                </CardBody>
              </Card>

              <Card bg={cardBg} border="1px" borderColor={borderColor}>
                <CardHeader>
                  <Heading size="md">Report Templates</Heading>
                </CardHeader>
                <CardBody>
                  <VStack spacing={4} align="stretch">
                    {reportTemplates.map((template) => (
                      <Card key={template.id} variant="outline" p={3} cursor="pointer"
                        _hover={{ borderColor: 'blue.500', bg: 'blue.50' }}
                      >
                        <Flex justify="space-between" align="start">
                          <Box>
                            <Text fontWeight="medium">{template.name}</Text>
                            <Text fontSize="sm" color="gray.600">
                              {template.type} • {template.frequency}
                            </Text>
                            <Text fontSize="xs" color="gray.500">
                              Last run: {template.lastRun}
                            </Text>
                          </Box>
                          <Button size="sm" variant="ghost">
                            Run
                          </Button>
                        </Flex>
                      </Card>
                    ))}
                  </VStack>
                </CardBody>
              </Card>
            </Grid>
          </TabPanel>

          {/* Scheduled Reports Tab */}
          <TabPanel px={0}>
            <Card bg={cardBg} border="1px" borderColor={borderColor}>
              <CardHeader>
                <Flex justify="space-between" align="center">
                  <Heading size="md">Scheduled Reports</Heading>
                  <Button
                    leftIcon={<CalendarIcon />}
                    colorScheme="blue"
                    size="sm"
                  >
                    Schedule New Report
                  </Button>
                </Flex>
              </CardHeader>
              <CardBody>
                <Table variant="simple">
                  <Thead>
                    <Tr>
                      <Th>Report Name</Th>
                      <Th>Frequency</Th>
                      <Th>Next Run</Th>
                      <Th>Recipients</Th>
                      <Th>Format</Th>
                      <Th>Status</Th>
                      <Th>Actions</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    <Tr>
                      <Td>Monthly Revenue Report</Td>
                      <Td>Monthly (1st)</Td>
                      <Td>Dec 1, 2023</Td>
                      <Td>5 recipients</Td>
                      <Td>PDF, Excel</Td>
                      <Td>
                        <Badge colorScheme="green">Active</Badge>
                      </Td>
                      <Td>
                        <HStack spacing={2}>
                          <IconButton aria-label="Edit" icon={<EditIcon />} size="sm" />
                          <IconButton aria-label="Delete" icon={<DeleteIcon />} size="sm" />
                        </HStack>
                      </Td>
                    </Tr>
                    <Tr>
                      <Td>Weekly CDR Summary</Td>
                      <Td>Weekly (Monday)</Td>
                      <Td>Nov 27, 2023</Td>
                      <Td>3 recipients</Td>
                      <Td>CSV</Td>
                      <Td>
                        <Badge colorScheme="green">Active</Badge>
                      </Td>
                      <Td>
                        <HStack spacing={2}>
                          <IconButton aria-label="Edit" icon={<EditIcon />} size="sm" />
                          <IconButton aria-label="Delete" icon={<DeleteIcon />} size="sm" />
                        </HStack>
                      </Td>
                    </Tr>
                    <Tr>
                      <Td>Daily Performance</Td>
                      <Td>Daily</Td>
                      <Td>Tomorrow</Td>
                      <Td>2 recipients</Td>
                      <Td>PDF</Td>
                      <Td>
                        <Badge colorScheme="yellow">Paused</Badge>
                      </Td>
                      <Td>
                        <HStack spacing={2}>
                          <IconButton aria-label="Edit" icon={<EditIcon />} size="sm" />
                          <IconButton aria-label="Delete" icon={<DeleteIcon />} size="sm" />
                        </HStack>
                      </Td>
                    </Tr>
                  </Tbody>
                </Table>
              </CardBody>
            </Card>
          </TabPanel>
        </TabPanels>
      </Tabs>

      {/* Quick Actions Footer */}
      <Flex justify="space-between" align="center" mt={8} pt={6} borderTop="1px" borderColor={borderColor}>
        <Text color="gray.600" fontSize="sm">
          Last updated: Today at 14:30 • Data refresh every 15 minutes
        </Text>
        
        <HStack spacing={3}>
          <Button
            // leftIcon={<RefreshIcon />}
            variant="outline"
            size="sm"
            onClick={() => window.location.reload()}
          >
            Refresh Data
          </Button>
          <Menu>
            <MenuButton as={Button} size="sm" variant="outline" rightIcon={<ChevronDownIcon />}>
              <SettingsIcon mr={2} />
              Settings
            </MenuButton>
            <MenuList>
              <MenuItem>Data Retention Settings</MenuItem>
              <MenuItem>Export Preferences</MenuItem>
              <MenuItem>Notification Settings</MenuItem>
              <MenuItem>API Access</MenuItem>
            </MenuList>
          </Menu>
        </HStack>
      </Flex>
    </Container>
  );
};

export default Reports;