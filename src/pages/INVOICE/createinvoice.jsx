import React, { useState } from 'react';
import {
  Box,
  Badge,
  Container,
  Heading,
  Text,
  Button,
  FormControl,
  FormLabel,
  Input,
  Select,
  Textarea,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Flex,
  VStack,
  HStack,
  Card,
  CardBody,
  IconButton,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  NumberIncrementStepper,
  NumberDecrementStepper,
  useToast,
  SimpleGrid,
  Divider
} from '@chakra-ui/react';
import {
  ArrowBackIcon,
  AddIcon,
  DeleteIcon,
  CalendarIcon,
  AttachmentIcon
} from '@chakra-ui/icons';

const CreateInvoice = () => {
  const [formData, setFormData] = useState({
    customer: '',
    invoiceDate: new Date().toISOString().split('T')[0],
    dueDate: '',
    currency: 'USD',
    notes: '',
    terms: 'Net 30 Days'
  });

  const [items, setItems] = useState([
    {
      id: 1,
      description: '',
      quantity: 1,
      rate: 0,
      amount: 0
    }
  ]);

  const [cdrOptions, setCdrOptions] = useState([
    { id: 1, label: 'Voice Calls - Domestic', rate: 0.05, unit: 'minute' },
    { id: 2, label: 'Voice Calls - International', rate: 0.15, unit: 'minute' },
    { id: 3, label: 'Data Usage', rate: 200, unit: 'GB' },
    { id: 4, label: 'SMS Services', rate: 0.01, unit: 'message' },
    { id: 5, label: 'Monthly Service Fee', rate: 3065.50, unit: 'month' }
  ]);

  const toast = useToast();

  const calculateAmount = (quantity, rate) => {
    return parseFloat(quantity) * parseFloat(rate);
  };

  const handleItemChange = (id, field, value) => {
    const updatedItems = items.map(item => {
      if (item.id === id) {
        const updatedItem = {
          ...item,
          [field]: value
        };
        
        if (field === 'quantity' || field === 'rate') {
          updatedItem.amount = calculateAmount(
            field === 'quantity' ? value : item.quantity,
            field === 'rate' ? value : item.rate
          );
        }
        
        return updatedItem;
      }
      return item;
    });
    
    setItems(updatedItems);
  };

  const addItem = () => {
    const newId = items.length > 0 ? Math.max(...items.map(item => item.id)) + 1 : 1;
    setItems([
      ...items,
      {
        id: newId,
        description: '',
        quantity: 1,
        rate: 0,
        amount: 0
      }
    ]);
  };

  const removeItem = (id) => {
    if (items.length > 1) {
      setItems(items.filter(item => item.id !== id));
    } else {
      toast({
        title: 'Cannot remove',
        description: 'At least one item is required',
        status: 'warning',
        duration: 3000,
        isClosable: true
      });
    }
  };

  const addCdrService = (cdrOption) => {
    const newId = items.length > 0 ? Math.max(...items.map(item => item.id)) + 1 : 1;
    const newItem = {
      id: newId,
      description: cdrOption.label,
      quantity: 1,
      rate: cdrOption.rate,
      amount: cdrOption.rate,
      unit: cdrOption.unit
    };
    
    setItems([...items, newItem]);
    
    toast({
      title: 'Service added',
      description: `${cdrOption.label} added to invoice`,
      status: 'success',
      duration: 2000,
      isClosable: true
    });
  };

  const calculateTotal = () => {
    return items.reduce((sum, item) => sum + (item.amount || 0), 0);
  };

  const handleSubmit = () => {
    // Validation
    if (!formData.customer) {
      toast({
        title: 'Error',
        description: 'Please select a customer',
        status: 'error',
        duration: 3000,
        isClosable: true
      });
      return;
    }

    if (items.some(item => !item.description || item.amount <= 0)) {
      toast({
        title: 'Error',
        description: 'Please fill all item details correctly',
        status: 'error',
        duration: 3000,
        isClosable: true
      });
      return;
    }

    // Submit logic here
    console.log('Invoice Data:', { formData, items, total: calculateTotal() });
    
    toast({
      title: 'Invoice Created',
      description: 'Invoice has been created successfully',
      status: 'success',
      duration: 3000,
      isClosable: true
    });

    // Redirect to invoices list
    setTimeout(() => {
      window.location.href = '/invoices';
    }, 1500);
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
            <Heading size="lg">Create New Invoice</Heading>
            <Text color="gray.600">Create invoice from CDR data</Text>
          </Box>
        </HStack>
        
        <HStack spacing={3}>
          <Button variant="outline">Save as Draft</Button>
          <Button colorScheme="blue" onClick={handleSubmit}>Create Invoice</Button>
        </HStack>
      </Flex>

      <SimpleGrid columns={{ base: 1, lg: 3 }} spacing={6}>
        {/* Left Column - Form */}
        <Box gridColumn={{ lg: 'span 2' }}>
          <Card mb={6}>
            <CardBody>
              <Heading size="md" mb={6}>Invoice Details</Heading>
              
              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6} mb={8}>
                <FormControl>
                  <FormLabel>Customer</FormLabel>
                  <Select
                    placeholder="Select customer"
                    value={formData.customer}
                    onChange={(e) => setFormData({...formData, customer: e.target.value})}
                  >
                    <option value="abc">ABC Telecom</option>
                    <option value="xyz">XYZ Mobile</option>
                    <option value="global">Global Comm</option>
                    <option value="telecom">Telecom Plus</option>
                  </Select>
                </FormControl>
                
                <FormControl>
                  <FormLabel>Currency</FormLabel>
                  <Select
                    value={formData.currency}
                    onChange={(e) => setFormData({...formData, currency: e.target.value})}
                  >
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                  </Select>
                </FormControl>
                
                <FormControl>
                  <FormLabel>Invoice Date</FormLabel>
                  <Input
                    type="date"
                    value={formData.invoiceDate}
                    onChange={(e) => setFormData({...formData, invoiceDate: e.target.value})}
                  />
                </FormControl>
                
                <FormControl>
                  <FormLabel>Due Date</FormLabel>
                  <Input
                    type="date"
                    value={formData.dueDate}
                    onChange={(e) => setFormData({...formData, dueDate: e.target.value})}
                  />
                </FormControl>
              </SimpleGrid>

              {/* Invoice Items */}
              <Box mb={8}>
                <Flex justify="space-between" align="center" mb={4}>
                  <Heading size="md">Invoice Items</Heading>
                  <Button
                    leftIcon={<AddIcon />}
                    colorScheme="green"
                    size="sm"
                    onClick={addItem}
                  >
                    Add Item
                  </Button>
                </Flex>
                
                <Box overflowX="auto">
                  <Table variant="simple">
                    <Thead>
                      <Tr>
                        <Th>Description</Th>
                        <Th>Quantity</Th>
                        <Th>Rate</Th>
                        <Th>Amount</Th>
                        <Th>Actions</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {items.map((item) => (
                        <Tr key={item.id}>
                          <Td>
                            <Input
                              value={item.description}
                              onChange={(e) => handleItemChange(item.id, 'description', e.target.value)}
                              placeholder="Item description"
                            />
                          </Td>
                          <Td>
                            <NumberInput
                              value={item.quantity}
                              onChange={(value) => handleItemChange(item.id, 'quantity', value)}
                              min={0}
                              step={0.01}
                            >
                              <NumberInputField />
                              <NumberInputStepper>
                                <NumberIncrementStepper />
                                <NumberDecrementStepper />
                              </NumberInputStepper>
                            </NumberInput>
                          </Td>
                          <Td>
                            <NumberInput
                              value={item.rate}
                              onChange={(value) => handleItemChange(item.id, 'rate', value)}
                              min={0}
                              step={0.01}
                            >
                              <NumberInputField />
                              <NumberInputStepper>
                                <NumberIncrementStepper />
                                <NumberDecrementStepper />
                              </NumberInputStepper>
                            </NumberInput>
                          </Td>
                          <Td>
                            <Text fontWeight="medium">
                              ${item.amount.toFixed(2)}
                            </Text>
                          </Td>
                          <Td>
                            <IconButton
                              aria-label="Remove item"
                              icon={<DeleteIcon />}
                              size="sm"
                              colorScheme="red"
                              variant="ghost"
                              onClick={() => removeItem(item.id)}
                            />
                          </Td>
                        </Tr>
                      ))}
                    </Tbody>
                  </Table>
                </Box>
              </Box>

              {/* Notes and Terms */}
              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6}>
                <FormControl>
                  <FormLabel>Notes</FormLabel>
                  <Textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({...formData, notes: e.target.value})}
                    placeholder="Additional notes for the customer"
                    rows={4}
                  />
                </FormControl>
                
                <FormControl>
                  <FormLabel>Payment Terms</FormLabel>
                  <Select
                    value={formData.terms}
                    onChange={(e) => setFormData({...formData, terms: e.target.value})}
                  >
                    <option value="Net 15 Days">Net 15 Days</option>
                    <option value="Net 30 Days">Net 30 Days</option>
                    <option value="Net 60 Days">Net 60 Days</option>
                    <option value="Due on Receipt">Due on Receipt</option>
                  </Select>
                </FormControl>
              </SimpleGrid>
            </CardBody>
          </Card>

          {/* Summary */}
          <Card>
            <CardBody>
              <Flex justify="space-between" align="center">
                <Box>
                  <Heading size="md">Summary</Heading>
                  <Text color="gray.600">{items.length} items in this invoice</Text>
                </Box>
                <Box textAlign="right">
                  <Text fontSize="sm" color="gray.600">Total Amount</Text>
                  <Heading size="xl">${calculateTotal().toFixed(2)}</Heading>
                </Box>
              </Flex>
            </CardBody>
          </Card>
        </Box>

        {/* Right Column - CDR Services */}
        <Box>
          <Card mb={6}>
            <CardBody>
              <Heading size="md" mb={4}>CDR Services</Heading>
              <Text mb={4} color="gray.600">
                Quick add services based on CDR data
              </Text>
              
              <VStack spacing={3} align="stretch">
                {cdrOptions.map((option) => (
                  <Card key={option.id} variant="outline" cursor="pointer"
                    onClick={() => addCdrService(option)}
                    _hover={{ borderColor: 'blue.500', transform: 'translateY(-2px)' }}
                    transition="all 0.2s"
                  >
                    <CardBody>
                      <Flex justify="space-between" align="center">
                        <Box>
                          <Text fontWeight="medium">{option.label}</Text>
                          <Text fontSize="sm" color="gray.600">
                            ${option.rate} per {option.unit}
                          </Text>
                        </Box>
                        <AddIcon color="blue.500" />
                      </Flex>
                    </CardBody>
                  </Card>
                ))}
              </VStack>
              
              <Button
                width="full"
                mt={6}
                variant="outline"
                leftIcon={<AttachmentIcon />}
                onClick={() => window.location.href = '/cdr/import'}
              >
                Import from CDR File
              </Button>
            </CardBody>
          </Card>

          {/* Recent Invoices */}
          <Card>
            <CardBody>
              <Heading size="md" mb={4}>Recent Invoices</Heading>
              <VStack spacing={3} align="stretch">
                <Flex justify="space-between">
                  <Text fontSize="sm">INV-2023-003</Text>
                  <Badge colorScheme="red">Overdue</Badge>
                </Flex>
                <Flex justify="space-between">
                  <Text fontSize="sm">INV-2023-002</Text>
                  <Badge colorScheme="yellow">Pending</Badge>
                </Flex>
                <Flex justify="space-between">
                  <Text fontSize="sm">INV-2023-001</Text>
                  <Badge colorScheme="green">Paid</Badge>
                </Flex>
              </VStack>
            </CardBody>
          </Card>
        </Box>
      </SimpleGrid>
    </Container>
  );
};

export default CreateInvoice;