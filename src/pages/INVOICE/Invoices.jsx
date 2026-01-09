import React, { useState } from 'react';
import {
  Box,
  Container,
  Heading,
  Text,
  Button,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Badge,
  Input,
  InputGroup,
  InputLeftElement,
  Select,
  Flex,
  IconButton,
  SimpleGrid,
  Card,
  CardBody,
  Stack,
  HStack,
  VStack,
  useColorModeValue
} from '@chakra-ui/react';
import {
  SearchIcon,
  ChevronRightIcon,
  DownloadIcon,
  EditIcon,
  ViewIcon,
  DeleteIcon,
  AddIcon,
  CalendarIcon,
  AttachmentIcon
} from '@chakra-ui/icons';

const Invoices = () => {
  const [invoices, setInvoices] = useState([
    {
      id: '1',
      invoiceNumber: 'INV-2023-001',
      customer: 'ABC Telecom',
      date: '2023-10-15',
      dueDate: '2023-11-15',
      amount: 12500.50,
      status: 'paid',
      cdrCount: 245,
      totalDuration: 12560,
      totalData: 2.5
    },
    {
      id: '2',
      invoiceNumber: 'INV-2023-002',
      customer: 'XYZ Mobile',
      date: '2023-10-18',
      dueDate: '2023-11-18',
      amount: 8900.75,
      status: 'pending',
      cdrCount: 178,
      totalDuration: 8920,
      totalData: 1.8
    },
    {
      id: '3',
      invoiceNumber: 'INV-2023-003',
      customer: 'Global Comm',
      date: '2023-10-20',
      dueDate: '2023-11-20',
      amount: 15600.25,
      status: 'overdue',
      cdrCount: 312,
      totalDuration: 15680,
      totalData: 3.1
    },
    {
      id: '4',
      invoiceNumber: 'INV-2023-004',
      customer: 'Telecom Plus',
      date: '2023-10-22',
      dueDate: '2023-11-22',
      amount: 7500.00,
      status: 'draft',
      cdrCount: 120,
      totalDuration: 6450,
      totalData: 1.2
    }
  ]);

  const getStatusColor = (status) => {
    switch(status) {
      case 'paid': return 'green';
      case 'pending': return 'yellow';
      case 'overdue': return 'red';
      case 'draft': return 'gray';
      default: return 'gray';
    }
  };

  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');

  return (
    <Container maxW="container.xl" py={8}>
      {/* Header */}
      <Flex justify="space-between" align="center" mb={8}>
        <Box>
          <Heading size="lg" mb={2}>Invoices</Heading>
          <Text color="gray.600">Manage and track all customer invoices</Text>
        </Box>
        <Button
          leftIcon={<AddIcon />}
          colorScheme="blue"
          size="md"
          // variant={"ghost"}
          px={{base:8,md:4}}
          onClick={() => window.location.href = '/invoices/create'}
        >
          Create Invoice
        </Button>
      </Flex>

      {/* Filters and Search */}
      {/* <Card bg={cardBg} mb={6} border="1px" borderColor={borderColor}>
        <CardBody> */}
        <Box display={{ base: "block", md: "flex"}} alignItems="center" mb={4}>
          <Stack spacing={6}>
            <SimpleGrid columns={{ base: 1, md: 4 }} spacing={4}>
              <InputGroup bg={"white"}>
                <InputLeftElement pointerEvents="none">
                  <SearchIcon color="gray.400" />
                </InputLeftElement>
                <Input placeholder="Search invoices..." />
              </InputGroup>
              
              <Select bg={"white"} placeholder="All Status">
                <option value="paid">Paid</option>
                <option value="pending">Pending</option>
                <option value="overdue">Overdue</option>
                <option value="draft">Draft</option>
              </Select>
              
              <InputGroup bg={"white"}>
                <InputLeftElement pointerEvents="none">
                  <CalendarIcon color="gray.400" />
                </InputLeftElement>
                <Input type="date" />
              </InputGroup>
              
              <Select bg={"white"} placeholder="Customer">
                <option value="abc">ABC Telecom</option>
                <option value="xyz">XYZ Mobile</option>
                <option value="global">Global Comm</option>
              </Select>
            </SimpleGrid>
          </Stack>
          </Box>
        {/* </CardBody>
      </Card> */}

      {/* Summary Cards */}
      <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={6} mb={6}>
        <Card bg={cardBg} border="1px" borderColor={borderColor}>
          <CardBody>
            <VStack align="stretch" spacing={2}>
              <Text color="gray.500" fontSize="sm">Total Revenue</Text>
              <Heading size="lg">$37,001.50</Heading>
              <Text color="green.500" fontSize="sm">↑ 12.5% from last month</Text>
            </VStack>
          </CardBody>
        </Card>
        
        <Card bg={cardBg} border="1px" borderColor={borderColor}>
          <CardBody>
            <VStack align="stretch" spacing={2}>
              <Text color="gray.500" fontSize="sm">Pending Invoices</Text>
              <Heading size="lg">$8,900.75</Heading>
              <Text color="yellow.500" fontSize="sm">5 invoices pending</Text>
            </VStack>
          </CardBody>
        </Card>
        
        <Card bg={cardBg} border="1px" borderColor={borderColor}>
          <CardBody>
            <VStack align="stretch" spacing={2}>
              <Text color="gray.500" fontSize="sm">Overdue</Text>
              <Heading size="lg">$15,600.25</Heading>
              <Text color="red.500" fontSize="sm">3 invoices overdue</Text>
            </VStack>
          </CardBody>
        </Card>
        
        <Card bg={cardBg} border="1px" borderColor={borderColor}>
          <CardBody>
            <VStack align="stretch" spacing={2}>
              <Text color="gray.500" fontSize="sm">Avg. Days to Pay</Text>
              <Heading size="lg">28 days</Heading>
              <Text color="blue.500" fontSize="sm">↓ 2 days from last month</Text>
            </VStack>
          </CardBody>
        </Card>
      </SimpleGrid>

      {/* Invoices Table */}
      <Card bg={cardBg} border="1px" borderColor={borderColor}>
        <CardBody>
          <Box overflowX="auto">
            <Table variant="simple">
              <Thead>
                <Tr>
                  <Th>Invoice #</Th>
                  <Th>Customer</Th>
                  <Th>Date</Th>
                  <Th>Amount</Th>
                  <Th>Status</Th>
                  <Th>CDR Count</Th>
                  <Th>Actions</Th>
                </Tr>
              </Thead>
              <Tbody>
                {invoices.map((invoice) => (
                  <Tr key={invoice.id} _hover={{ bg: 'gray.50' }}>
                    <Td>
                      <HStack>
                        <AttachmentIcon color="blue.500" />
                        <Text fontWeight="medium">{invoice.invoiceNumber}</Text>
                      </HStack>
                    </Td>
                    <Td>
                      <Box>
                        <Text fontWeight="medium">{invoice.customer}</Text>
                        <Text fontSize="sm" color="gray.600">
                          {invoice.cdrCount} calls • {invoice.totalDuration}s • {invoice.totalData}GB
                        </Text>
                      </Box>
                    </Td>
                    <Td>
                      <Box>
                        <Text>Issued: {invoice.date}</Text>
                        <Text fontSize="sm" color="gray.600">Due: {invoice.dueDate}</Text>
                      </Box>
                    </Td>
                    <Td>
                      <Text fontWeight="semibold">
                        ${invoice.amount.toLocaleString()}
                      </Text>
                    </Td>
                    <Td>
                      <Badge colorScheme={getStatusColor(invoice.status)}>
                        {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                      </Badge>
                    </Td>
                    <Td>
                      <Text textAlign="center">{invoice.cdrCount}</Text>
                    </Td>
                    <Td>
                      <HStack spacing={2}>
                        <IconButton
                          aria-label="View invoice"
                          icon={<ViewIcon />}
                          size="sm"
                          variant="ghost"
                          colorScheme="blue"
                          onClick={() => window.location.href = `/invoices/${invoice.id}`}
                        />
                        
                        <IconButton
                          aria-label="Delete invoice"
                          icon={<DeleteIcon />}
                          size="sm"
                          variant="ghost"
                          colorScheme="red"
                        />
                        <IconButton
                          aria-label="Download invoice"
                          icon={<DownloadIcon />}
                          size="sm"
                          variant="ghost"
                        />
                      </HStack>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </Box>
        </CardBody>
      </Card>
    </Container>
  );
};

export default Invoices;