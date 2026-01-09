import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Heading,
  VStack,
  Text,
  Button,
  IconButton,
  useToast,
  HStack,
  Badge,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  Input,
  Select,
  FormControl,
  FormLabel,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  useDisclosure,
  SimpleGrid,
  Stat,
  StatLabel,
  StatNumber,
  Card,
  CardBody,
} from '@chakra-ui/react';
import {
  FiSearch,
  FiFilter,
  FiEdit2,
  FiTrash2,
  FiEye,
  FiDownload,
  FiRefreshCw,
  FiPlus,
  FiMoreVertical,
  FiPhone,
} from 'react-icons/fi';
import DataTable from '../components/DataTable';
import FilterBar from '../components/FilterBar';
import ExportButton from '../components/ExportButton';
import ConfirmDialog from '../components/ConfirmDialog';
import { fetchCDRs, updateCDR, deleteCDR, fetchCustomers } from '../utils/api';
import { formatCurrency, formatDuration, getCDRSummary } from '../utils/calculations';

const CDRList = () => {
  const [cdrs, setCdrs] = useState([]);
  const [filteredCdrs, setFilteredCdrs] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({});
  const [selectedCdr, setSelectedCdr] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [stats, setStats] = useState(null);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const toast = useToast();

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    filterData();
  }, [cdrs, searchTerm, filters]);

  const loadData = async () => {
    try {
      const [cdrsData, customersData] = await Promise.all([
        fetchCDRs(),
        fetchCustomers()
      ]);
      
      setCdrs(cdrsData);
      setFilteredCdrs(cdrsData);
      setCustomers(customersData);
      
      if (cdrsData.length > 0) {
        const summary = getCDRSummary(cdrsData);
        setStats(summary);
      }
    } catch (error) {
      console.error('Error loading CDR data:', error);
      toast({
        title: 'Error loading data',
        description: 'Failed to fetch CDR data from server',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  const filterData = () => {
    let filtered = [...cdrs];

    // Apply search
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(cdr =>
        cdr.callere164?.toLowerCase().includes(term) ||
        cdr.calleee164?.toLowerCase().includes(term) ||
        cdr.customer_name?.toLowerCase().includes(term) ||
        cdr.status?.toLowerCase().includes(term) ||
        (cdr.flowid && cdr.flowid.toLowerCase().includes(term))
      );
    }

    // Apply filters
    Object.entries(filters).forEach(([key, value]) => {
      if (value) {
        filtered = filtered.filter(cdr => cdr[key] === value);
      }
    });

    setFilteredCdrs(filtered);
  };

  const handleSearch = (term) => {
    setSearchTerm(term);
  };

  const handleFilterChange = (newFilters) => {
    setFilters(newFilters);
  };

  const handleEdit = (cdr) => {
    setSelectedCdr(cdr);
    setEditModalOpen(true);
  };

  const handleDelete = (cdr) => {
    setSelectedCdr(cdr);
    setDeleteConfirmOpen(true);
  };

  const handleView = (cdr) => {
    setSelectedCdr(cdr);
    onOpen();
  };

  const confirmDelete = async () => {
    if (selectedCdr) {
      try {
        await deleteCDR(selectedCdr.id);
        await loadData();
        toast({
          title: 'CDR deleted',
          description: 'Call record has been deleted successfully',
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
      } catch (error) {
        toast({
          title: 'Error deleting CDR',
          description: error.message,
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
      }
    }
    setDeleteConfirmOpen(false);
    setSelectedCdr(null);
  };

  const handleSaveEdit = async (updatedCdr) => {
    try {
      await updateCDR(selectedCdr.id, updatedCdr);
      await loadData();
      setEditModalOpen(false);
      setSelectedCdr(null);
      toast({
        title: 'CDR updated',
        description: 'Call record has been updated successfully',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      toast({
        title: 'Error updating CDR',
        description: error.message,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  // Telecom-specific columns
  const columns = [
    {
      key: 'starttime',
      header: 'Date & Time',
      render: (value) => {
        try {
          return new Date(value).toLocaleString();
        } catch (e) {
          return 'Invalid Date';
        }
      },
    },
    {
      key: 'callere164',
      header: 'Caller',
      render: (value, row) => (
        <Box>
          <Text fontWeight="medium">{value}</Text>
          {row.callerip && (
            <Text fontSize="xs" color="gray.600">IP: {row.callerip}</Text>
          )}
        </Box>
      ),
    },
    {
      key: 'calleee164',
      header: 'Callee',
      render: (value, row) => (
        <Box>
          <Text fontWeight="medium">{value}</Text>
          {row.calleeip && (
            <Text fontSize="xs" color="gray.600">IP: {row.calleeip}</Text>
          )}
        </Box>
      ),
    },
    {
      key: 'duration',
      header: 'Duration',
      render: (value) => formatDuration(value || 0),
    },
    {
      key: 'status',
      header: 'Status',
      render: (value) => (
        <Badge colorScheme={
          value === 'ANSWERED' ? 'green' :
          value === 'NO_ANSWER' ? 'yellow' :
          value === 'FAILED' ? 'red' :
          value === 'BUSY' ? 'orange' : 'gray'
        }>
          {value}
        </Badge>
      ),
    },
    {
      key: 'call_type',
      header: 'Type',
      render: (value) => (
        <Badge colorScheme="blue" variant="subtle">
          {value || 'VOICE'}
        </Badge>
      ),
    },
    {
      key: 'fee',
      header: 'Amount',
      render: (value) => formatCurrency(value || 0),
    },
    {
      key: 'customer_name',
      header: 'Customer',
      render: (value, row) => (
        <Box>
          <Text>{value || 'Unknown'}</Text>
          {row.customer_id && (
            <Text fontSize="xs" color="gray.600">{row.customer_id}</Text>
          )}
        </Box>
      ),
    },
    {
      key: 'endreason',
      header: 'End Reason',
      render: (value) => (
        <Text fontSize="sm" maxW="100px" isTruncated title={value}>
          {value || 'N/A'}
        </Text>
      ),
    },
  ];

  const filterOptions = [
    {
      key: 'status',
      label: 'Status',
      options: [
        { value: '', label: 'All Statuses' },
        { value: 'ANSWERED', label: 'Answered' },
        { value: 'NO_ANSWER', label: 'No Answer' },
        { value: 'FAILED', label: 'Failed' },
        { value: 'BUSY', label: 'Busy' },
      ],
    },
    {
      key: 'call_type',
      label: 'Call Type',
      options: [
        { value: '', label: 'All Types' },
        { value: 'VOICE', label: 'Voice' },
        { value: 'SMS', label: 'SMS' },
        { value: 'DATA', label: 'Data' },
      ],
    },
  ];

  const getUniqueCustomers = () => {
    return [...new Set(cdrs.map(cdr => cdr.customer_id).filter(Boolean))];
  };

  return (
    <Container maxW="container.xl" py={4}>
      <VStack spacing={6} align="stretch">
        {/* Header */}
        <Box>
          <Heading size="lg" mb={2}>CDR List</Heading>
          <Text color="gray.600">
            View and manage all processed Call Detail Records
          </Text>
        </Box>

        {/* Stats Cards */}
        {stats && (
          <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4}>
            <StatCard
              title="Total Calls"
              value={stats.totalCalls}
              icon={FiPhone}
              color="blue"
            />
            <StatCard
              title="Success Rate"
              value={`${stats.successRate}%`}
              icon={FiPhone}
              color="green"
            />
            <StatCard
              title="Total Revenue"
              value={`$${stats.totalRevenue.toFixed(2)}`}
              icon={FiPhone}
              color="orange"
            />
            <StatCard
              title="Avg Duration"
              value={`${Math.floor(stats.averageDuration / 60)}m`}
              icon={FiPhone}
              color="purple"
            />
          </SimpleGrid>
        )}

        {/* Filter Bar */}
        <FilterBar
          onSearch={handleSearch}
          onFilterChange={handleFilterChange}
          filters={filterOptions}
          onRefresh={loadData}
          dateRange={true}
        />

        {/* Stats and Actions */}
        <HStack justify="space-between">
          <Box>
            <Text fontSize="sm" color="gray.600">
              Showing {filteredCdrs.length} of {cdrs.length} records
            </Text>
          </Box>
          <HStack spacing={3}>
            <Button
              leftIcon={<FiRefreshCw />}
              onClick={loadData}
              variant="outline"
              size="sm"
            >
              Refresh
            </Button>
            <ExportButton
              data={filteredCdrs}
              fileName="cdrs"
              onExport={(format) => {
                toast({
                  title: `Exported as ${format.toUpperCase()}`,
                  description: `${filteredCdrs.length} records exported`,
                  status: 'success',
                  duration: 3000,
                  isClosable: true,
                });
              }}
            />
          </HStack>
        </HStack>

        {/* Data Table */}
        <Box overflowX="auto">
          <DataTable
            columns={columns}
            data={filteredCdrs}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onView={handleView}
          />
        </Box>

        {/* View Modal */}
        <Modal isOpen={isOpen} onClose={onClose} size="xl">
          <ModalOverlay />
          <ModalContent>
            <ModalHeader>CDR Details</ModalHeader>
            <ModalCloseButton />
            <ModalBody>
              {selectedCdr && (
                <VStack spacing={4} align="stretch">
                  <SimpleGrid columns={2} spacing={4}>
                    <Box>
                      <Text fontSize="sm" color="gray.600">Caller Number</Text>
                      <Text fontWeight="medium">{selectedCdr.callere164}</Text>
                      {selectedCdr.callerip && (
                        <Text fontSize="xs" color="gray.600">IP: {selectedCdr.callerip}</Text>
                      )}
                    </Box>
                    <Box>
                      <Text fontSize="sm" color="gray.600">Callee Number</Text>
                      <Text fontWeight="medium">{selectedCdr.calleee164}</Text>
                      {selectedCdr.calleeip && (
                        <Text fontSize="xs" color="gray.600">IP: {selectedCdr.calleeip}</Text>
                      )}
                    </Box>
                    <Box>
                      <Text fontSize="sm" color="gray.600">Start Time</Text>
                      <Text fontWeight="medium">
                        {new Date(selectedCdr.starttime).toLocaleString()}
                      </Text>
                    </Box>
                    <Box>
                      <Text fontSize="sm" color="gray.600">Duration</Text>
                      <Text fontWeight="medium">{formatDuration(selectedCdr.duration)}</Text>
                    </Box>
                    <Box>
                      <Text fontSize="sm" color="gray.600">Status</Text>
                      <Badge colorScheme={selectedCdr.status === 'ANSWERED' ? 'green' : 'red'}>
                        {selectedCdr.status}
                      </Badge>
                    </Box>
                    <Box>
                      <Text fontSize="sm" color="gray.600">Call Type</Text>
                      <Text fontWeight="medium">{selectedCdr.call_type || 'VOICE'}</Text>
                    </Box>
                    {selectedCdr.softswitch_id && (
                      <Box>
                        <Text fontSize="sm" color="gray.600">Softswitch</Text>
                        <Text fontWeight="medium">{selectedCdr.softswitch_id}</Text>
                      </Box>
                    )}
                    {selectedCdr.flowid && (
                      <Box>
                        <Text fontSize="sm" color="gray.600">Flow ID</Text>
                        <Text fontWeight="medium">{selectedCdr.flowid}</Text>
                      </Box>
                    )}
                  </SimpleGrid>

                  {selectedCdr.endreason && (
                    <Box p={3} bg="gray.50" borderRadius="md">
                      <Text fontSize="sm" color="gray.600">End Reason</Text>
                      <Text fontWeight="medium">{selectedCdr.endreason}</Text>
                    </Box>
                  )}

                  <Box p={4} bg="blue.50" borderRadius="md">
                    <Heading size="sm" mb={3}>Billing Information</Heading>
                    <SimpleGrid columns={3} spacing={4}>
                      <Box>
                        <Text fontSize="sm" color="gray.600">Call Fee</Text>
                        <Text fontWeight="bold" color="blue.600">
                          {formatCurrency(selectedCdr.fee || 0)}
                        </Text>
                      </Box>
                      <Box>
                        <Text fontSize="sm" color="gray.600">Tax</Text>
                        <Text fontWeight="bold" color="orange.600">
                          {formatCurrency(selectedCdr.tax || 0)}
                        </Text>
                      </Box>
                      <Box>
                        <Text fontSize="sm" color="gray.600">Total</Text>
                        <Text fontWeight="bold" color="green.600">
                          {formatCurrency(selectedCdr.total || 0)}
                        </Text>
                      </Box>
                    </SimpleGrid>
                    {selectedCdr.rate && (
                      <Text fontSize="sm" color="gray.600" mt={2}>
                        Rate: ${selectedCdr.rate}/sec
                      </Text>
                    )}
                  </Box>

                  {selectedCdr.customer_name && (
                    <Box p={3} bg="green.50" borderRadius="md">
                      <Text fontSize="sm" color="green.600">Customer</Text>
                      <Text fontWeight="medium">{selectedCdr.customer_name}</Text>
                      {selectedCdr.customer_id && (
                        <Text fontSize="xs" color="green.600">ID: {selectedCdr.customer_id}</Text>
                      )}
                    </Box>
                  )}
                </VStack>
              )}
            </ModalBody>
            <ModalFooter>
              <Button variant="ghost" mr={3} onClick={onClose}>
                Close
              </Button>
              <Button colorScheme="blue" onClick={() => {
                onClose();
                handleEdit(selectedCdr);
              }}>
                Edit Record
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>

        {/* Edit Modal */}
        <Modal isOpen={editModalOpen} onClose={() => setEditModalOpen(false)}>
          <ModalOverlay />
          <ModalContent>
            <ModalHeader>Edit CDR</ModalHeader>
            <ModalCloseButton />
            <ModalBody>
              {selectedCdr && (
                <VStack spacing={4}>
                  <FormControl>
                    <FormLabel>Caller Number</FormLabel>
                    <Input
                      value={selectedCdr.callere164 || ''}
                      onChange={(e) => setSelectedCdr({
                        ...selectedCdr,
                        callere164: e.target.value
                      })}
                    />
                  </FormControl>
                  <FormControl>
                    <FormLabel>Callee Number</FormLabel>
                    <Input
                      value={selectedCdr.calleee164 || ''}
                      onChange={(e) => setSelectedCdr({
                        ...selectedCdr,
                        calleee164: e.target.value
                      })}
                    />
                  </FormControl>
                  <FormControl>
                    <FormLabel>Duration (seconds)</FormLabel>
                    <Input
                      type="number"
                      value={selectedCdr.duration || ''}
                      onChange={(e) => setSelectedCdr({
                        ...selectedCdr,
                        duration: parseInt(e.target.value) || 0
                      })}
                    />
                  </FormControl>
                  <FormControl>
                    <FormLabel>Status</FormLabel>
                    <Select
                      value={selectedCdr.status || ''}
                      onChange={(e) => setSelectedCdr({
                        ...selectedCdr,
                        status: e.target.value
                      })}
                    >
                      <option value="ANSWERED">ANSWERED</option>
                      <option value="NO_ANSWER">NO_ANSWER</option>
                      <option value="FAILED">FAILED</option>
                      <option value="BUSY">BUSY</option>
                      <option value="CANCELLED">CANCELLED</option>
                    </Select>
                  </FormControl>
                  <FormControl>
                    <FormLabel>Call Type</FormLabel>
                    <Select
                      value={selectedCdr.call_type || ''}
                      onChange={(e) => setSelectedCdr({
                        ...selectedCdr,
                        call_type: e.target.value
                      })}
                    >
                      <option value="VOICE">VOICE</option>
                      <option value="SMS">SMS</option>
                      <option value="DATA">DATA</option>
                      <option value="VIDEO">VIDEO</option>
                    </Select>
                  </FormControl>
                  <FormControl>
                    <FormLabel>Customer</FormLabel>
                    <Select
                      value={selectedCdr.customer_id || ''}
                      onChange={(e) => {
                        const customer = customers.find(c => c.id === e.target.value);
                        setSelectedCdr({
                          ...selectedCdr,
                          customer_id: e.target.value,
                          customer_name: customer?.name || ''
                        });
                      }}
                    >
                      <option value="">Select Customer</option>
                      {customers.map(customer => (
                        <option key={customer.id} value={customer.id}>
                          {customer.name}
                        </option>
                      ))}
                    </Select>
                  </FormControl>
                  <FormControl>
                    <FormLabel>Rate per Second</FormLabel>
                    <Input
                      type="number"
                      step="0.0001"
                      value={selectedCdr.rate || 0.01}
                      onChange={(e) => setSelectedCdr({
                        ...selectedCdr,
                        rate: parseFloat(e.target.value) || 0.01
                      })}
                    />
                  </FormControl>
                </VStack>
              )}
            </ModalBody>
            <ModalFooter>
              <Button variant="ghost" mr={3} onClick={() => setEditModalOpen(false)}>
                Cancel
              </Button>
              <Button colorScheme="blue" onClick={() => handleSaveEdit(selectedCdr)}>
                Save Changes
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>

        {/* Delete Confirmation */}
        <ConfirmDialog
          isOpen={deleteConfirmOpen}
          onClose={() => setDeleteConfirmOpen(false)}
          onConfirm={confirmDelete}
          title="Delete CDR Record"
          message="Are you sure you want to delete this call detail record? This action cannot be undone."
          confirmText="Delete"
          type="danger"
        />
      </VStack>
    </Container>
  );
};

// Stat Card Component
const StatCard = ({ title, value, icon: Icon, color }) => {
  return (
    <Card>
      <CardBody>
        <Stat>
          <HStack justify="space-between" mb={2}>
            <StatLabel color="gray.600">{title}</StatLabel>
            <Icon as={Icon} color={`${color}.500`} />
          </HStack>
          <StatNumber fontSize="2xl" color={`${color}.600`}>{value}</StatNumber>
        </Stat>
      </CardBody>
    </Card>
  );
};

// SimpleGrid Component
const Simplegrid = ({ children, columns = 2, spacing = 4 }) => (
  <Box display="grid" gridTemplateColumns={`repeat(${columns}, 1fr)`} gap={spacing}>
    {children}
  </Box>
);

export default CDRList;