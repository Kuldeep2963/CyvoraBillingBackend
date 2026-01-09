import React from 'react';
import {
  Box,
  Container,
  Heading,
  Text,
  Button,
  Flex,
  VStack,
  HStack,
  SimpleGrid,
  Card,
  CardBody,
  Badge,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Divider,
  IconButton,
  useColorModeValue,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  Stack
} from '@chakra-ui/react';
import {
  ArrowBackIcon,
  DownloadIcon,
  EditIcon,
  EmailIcon,
  AttachmentIcon,
  CheckCircleIcon,
  TimeIcon,
  WarningIcon
} from '@chakra-ui/icons';

const InvoiceDetail = () => {
  const invoice = {
    id: 'INV-2023-001',
    customer: {
      name: 'ABC Telecom',
      address: '123 Business St, New York, NY 10001',
      email: 'billing@abctelecom.com',
      phone: '+1 (555) 123-4567',
      vat: 'US123456789'
    },
    date: '2023-10-15',
    dueDate: '2023-11-15',
    status: 'paid',
    items: [
      {
        id: 1,
        description: 'Voice Calls - Domestic',
        quantity: 150,
        rate: 0.05,
        amount: 7500.00
      },
      {
        id: 2,
        description: 'Voice Calls - International',
        quantity: 95,
        rate: 0.15,
        amount: 1425.00
      },
      {
        id: 3,
        description: 'Data Usage',
        quantity: 2.5,
        rate: 200,
        amount: 500.00
      },
      {
        id: 4,
        description: 'SMS Services',
        quantity: 1000,
        rate: 0.01,
        amount: 10.00
      },
      {
        id: 5,
        description: 'Monthly Service Fee',
        quantity: 1,
        rate: 3065.50,
        amount: 3065.50
      }
    ],
    subtotal: 12500.50,
    tax: 0,
    total: 12500.50,
    cdrSummary: {
      totalCalls: 245,
      totalDuration: '3h 29m 20s',
      totalData: '2.5 GB',
      peakHours: 156,
      offPeak: 89
    },
    payment: {
      method: 'Bank Transfer',
      reference: 'REF-2023-001-ABCD',
      date: 'November 14, 2023'
    }
  };

  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');

  const getStatusIcon = (status) => {
    switch(status) {
      case 'paid': return <CheckCircleIcon color="green.500" boxSize={6} />;
      case 'pending': return <TimeIcon color="yellow.500" boxSize={6} />;
      case 'overdue': return <WarningIcon color="red.500" boxSize={6} />;
      default: return <AttachmentIcon color="gray.500" boxSize={6} />;
    }
  };

  return (
    <Container maxW="container.xl" py={8}>
      {/* Header */}
      <Flex justify="space-between" align="center" mb={8}>
        <HStack spacing={4}>
          <IconButton
            aria-label="Go back"
            icon={<ArrowBackIcon />}
            variant="ghost"
            onClick={() => window.history.back()}
          />
          <Box>
            <Heading size="lg">Invoice {invoice.id}</Heading>
            <Text color="gray.600">Details and breakdown</Text>
          </Box>
        </HStack>
        
        <HStack spacing={3}>
          <Button leftIcon={<EditIcon />} variant="outline">
            Edit
          </Button>
          <Button leftIcon={<EmailIcon />} variant="outline">
            Send
          </Button>
          <Button leftIcon={<DownloadIcon />} colorScheme="blue">
            Download PDF
          </Button>
        </HStack>
      </Flex>

      <SimpleGrid columns={{ base: 1, lg: 3 }} spacing={6}>
        {/* Left Column - Invoice Details */}
        <Box gridColumn={{ lg: 'span 2' }}>
          <Card bg={cardBg} border="1px" borderColor={borderColor} mb={6}>
            <CardBody>
              {/* Status Banner */}
              <Flex
                justify="space-between"
                align="center"
                p={4}
                bg="green.50"
                borderRadius="md"
                mb={6}
              >
                <HStack>
                  {getStatusIcon(invoice.status)}
                  <Box>
                    <Text fontWeight="bold" color="green.800">Invoice Paid</Text>
                    <Text fontSize="sm" color="green.600">Paid on November 14, 2023</Text>
                  </Box>
                </HStack>
                <Box textAlign="right">
                  <Heading size="lg">${invoice.total.toLocaleString()}</Heading>
                  <Text fontSize="sm" color="gray.600">Total Amount</Text>
                </Box>
              </Flex>

              {/* Customer and Invoice Info */}
              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6} mb={8}>
                <Box>
                  <Heading size="sm" mb={3}>Bill To</Heading>
                  <Card bg="gray.50" p={4}>
                    <VStack align="stretch" spacing={2}>
                      <Text fontWeight="medium">{invoice.customer.name}</Text>
                      <Text fontSize="sm" color="gray.600">{invoice.customer.address}</Text>
                      <Text fontSize="sm" color="gray.600">{invoice.customer.email}</Text>
                      <Text fontSize="sm" color="gray.600">{invoice.customer.phone}</Text>
                      <Text fontSize="sm" color="gray.600">VAT: {invoice.customer.vat}</Text>
                    </VStack>
                  </Card>
                </Box>
                
                <Box>
                  <Heading size="sm" mb={3}>Invoice Details</Heading>
                  <Card bg="gray.50" p={4}>
                    <VStack align="stretch" spacing={2}>
                      <Flex justify="space-between">
                        <Text color="gray.600">Invoice Number:</Text>
                        <Text fontWeight="medium">{invoice.id}</Text>
                      </Flex>
                      <Flex justify="space-between">
                        <Text color="gray.600">Issue Date:</Text>
                        <Text>{invoice.date}</Text>
                      </Flex>
                      <Flex justify="space-between">
                        <Text color="gray.600">Due Date:</Text>
                        <Text>{invoice.dueDate}</Text>
                      </Flex>
                      <Flex justify="space-between">
                        <Text color="gray.600">Payment Terms:</Text>
                        <Text>Net 30</Text>
                      </Flex>
                    </VStack>
                  </Card>
                </Box>
              </SimpleGrid>

              {/* Items Table */}
              <Box mb={8}>
                <Heading size="sm" mb={4}>Charges Breakdown</Heading>
                <Box overflowX="auto">
                  <Table variant="simple">
                    <Thead bg="gray.50">
                      <Tr>
                        <Th>Description</Th>
                        <Th>Quantity</Th>
                        <Th>Rate</Th>
                        <Th>Amount</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {invoice.items.map((item) => (
                        <Tr key={item.id}>
                          <Td>{item.description}</Td>
                          <Td>{item.quantity}</Td>
                          <Td>${item.rate.toFixed(2)}</Td>
                          <Td fontWeight="medium">${item.amount.toFixed(2)}</Td>
                        </Tr>
                      ))}
                    </Tbody>
                  </Table>
                </Box>
              </Box>

              {/* Totals */}
              <Flex justify="flex-end">
                <Box width={{ base: '100%', md: '300px' }}>
                  <VStack spacing={3} align="stretch">
                    <Flex justify="space-between">
                      <Text color="gray.600">Subtotal:</Text>
                      <Text>${invoice.subtotal.toFixed(2)}</Text>
                    </Flex>
                    <Flex justify="space-between">
                      <Text color="gray.600">Tax (0%):</Text>
                      <Text>${invoice.tax.toFixed(2)}</Text>
                    </Flex>
                    <Divider />
                    <Flex justify="space-between" fontWeight="bold" fontSize="lg">
                      <Text>Total:</Text>
                      <Text>${invoice.total.toFixed(2)}</Text>
                    </Flex>
                  </VStack>
                </Box>
              </Flex>
            </CardBody>
          </Card>
        </Box>

        {/* Right Column - Sidebar */}
        <Box>
          {/* CDR Summary */}
          <Card bg={cardBg} border="1px" borderColor={borderColor} mb={6}>
            <CardBody>
              <Heading size="sm" mb={4}>CDR Summary</Heading>
              <VStack spacing={4} align="stretch">
                <Flex justify="space-between">
                  <Text color="gray.600">Total Calls:</Text>
                  <Text fontWeight="medium">{invoice.cdrSummary.totalCalls}</Text>
                </Flex>
                <Flex justify="space-between">
                  <Text color="gray.600">Total Duration:</Text>
                  <Text fontWeight="medium">{invoice.cdrSummary.totalDuration}</Text>
                </Flex>
                <Flex justify="space-between">
                  <Text color="gray.600">Total Data:</Text>
                  <Text fontWeight="medium">{invoice.cdrSummary.totalData}</Text>
                </Flex>
                <Flex justify="space-between">
                  <Text color="gray.600">Peak Hours:</Text>
                  <Text fontWeight="medium">{invoice.cdrSummary.peakHours} calls</Text>
                </Flex>
                <Flex justify="space-between">
                  <Text color="gray.600">Off-Peak:</Text>
                  <Text fontWeight="medium">{invoice.cdrSummary.offPeak} calls</Text>
                </Flex>
                <Button
                  colorScheme="blue"
                  variant="outline"
                  mt={4}
                  onClick={() => window.location.href = `/cdr/report/${invoice.id}`}
                >
                  View Detailed CDR Report
                </Button>
              </VStack>
            </CardBody>
          </Card>

          {/* Payment Information */}
          <Card bg={cardBg} border="1px" borderColor={borderColor} mb={6}>
            <CardBody>
              <Heading size="sm" mb={4}>Payment Information</Heading>
              <VStack spacing={4} align="stretch">
                <Box>
                  <Text fontSize="sm" color="gray.600">Payment Method</Text>
                  <Text fontWeight="medium">{invoice.payment.method}</Text>
                </Box>
                <Box>
                  <Text fontSize="sm" color="gray.600">Reference Number</Text>
                  <Text fontWeight="medium">{invoice.payment.reference}</Text>
                </Box>
                <Box>
                  <Text fontSize="sm" color="gray.600">Payment Date</Text>
                  <Text fontWeight="medium">{invoice.payment.date}</Text>
                </Box>
              </VStack>
            </CardBody>
          </Card>

          {/* Quick Actions */}
          <Card bg={cardBg} border="1px" borderColor={borderColor}>
            <CardBody>
              <Heading size="sm" mb={4}>Quick Actions</Heading>
              <Stack spacing={3}>
                <Button variant="outline" width="full">
                  Create Credit Note
                </Button>
                <Button variant="outline" width="full">
                  Send Reminder
                </Button>
                <Button variant="outline" width="full">
                  Duplicate Invoice
                </Button>
              </Stack>
            </CardBody>
          </Card>
        </Box>
      </SimpleGrid>
    </Container>
  );
};

export default InvoiceDetail;