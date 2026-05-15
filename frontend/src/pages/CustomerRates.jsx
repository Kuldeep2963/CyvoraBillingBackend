import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardBody,
  CardHeader,
  Flex,
  FormControl,
  FormLabel,
  Thead,
  useColorModeValue,
  SimpleGrid,
  VStack,
  HStack,
  Text,
  Heading,
  Badge,
  Grid,
  Table,
  Tbody,
  Tr,
  Th,
  Td,
  TableContainer,
  Icon,
  IconButton,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  ModalFooter,
  Alert,
  AlertIcon,
  AlertDescription,
  Spinner,
  Center,
  Input,
  Divider,
  UnorderedList,
  ListItem,
  Tag,
  TagLabel,
  useDisclosure,
  InputGroup,
  InputLeftElement,
  Select as ChakraSelect,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  StatArrow,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  NumberIncrementStepper,
  NumberDecrementStepper,
} from '@chakra-ui/react';
import {
  FiUploadCloud,
  FiFile,
  FiDownload,
  FiRefreshCw,
  FiTrash2,
  FiCheck,
  FiX,
  FiEdit2,
  FiSearch,
  FiClock,
  FiAlertCircle,
  FiArrowLeft,
  FiSave,
  FiZap,
  FiFilter,
  FiInfo,
  FiChevronUp,
  FiChevronDown,
} from 'react-icons/fi';
import PageNavBar from '../components/PageNavBar';
import ConfirmDialog from '../components/ConfirmDialog';
import { MemoizedSelect as Select } from '../components/memoizedinput/memoizedinput';
import useNotify from '../utils/notify';
import {
  fetchReportAccounts,
  uploadCustomerRates,
  fetchCustomerRates,
  updateCustomerRates,
  deleteCustomerRate,
  revertCustomerRate,
  fetchCustomerRatesHistory,
} from '../utils/api';
import * as XLSX from 'xlsx';

const normalizeRateRow = (row = {}) => {
  const effectiveDate = row.effectiveDate ?? row.EffectiveDate ?? row['effective date'] ?? row['Effective Date'] ?? row.Date ?? row.date ?? '';
  const rawRate = row.rate ?? row.Rate ?? row['Rate(Minute)'] ?? row['Rate (Minute)'] ?? row['Rate/minute'] ?? row['Rate per minute'] ?? 0;
  const { Date: _excelDate, date: _excelDateLower, effectiveDate: _effectiveDate, EffectiveDate: _effectiveDateCaps, ['effective date']: _effectiveDateSpaced, ['Effective Date']: _effectiveDateSpacedCaps, ...rest } = row;

  return {
    ...rest,
    destination: row.destination ?? row.Destination ??  '',
    areaName: row.areaName ?? row['Area name'] ?? row.AreaName ?? row['Area Name'] ?? '',
    rate: typeof rawRate === 'number' ? rawRate : parseFloat(rawRate) || 0,
    currency: row.currency ?? row.Currency ?? 'USD',
    effectiveDate: typeof effectiveDate === 'number' ? XLSX.SSF.format('yyyy-mm-dd', effectiveDate) : effectiveDate,
    description: row.description ?? row.Description ?? '',
    rateType: row['Rate type'] ?? row.rateType ?? '',
    lockType: row['Lock type'] ?? row.lockType ?? '',
    areaPrefix: row['Area prefix'] ?? row.areaPrefix ?? '',
    ratePrefix: row['Rate prefix'] ?? row.ratePrefix ?? '',
  };
};

// ─── Simple Rate Row Component (Display Only) ────────────────────────────────
const RateRow = ({ rate, idx, onEdit, onDelete }) => (
  <Tr _hover={{ bg: useColorModeValue('gray.50', 'gray.700') }} transition="background 0.15s">
    <Td fontWeight="medium" fontFamily="mono" fontSize="sm">{rate.destination || '—'}</Td>
    <Td fontSize="sm">{rate['areaPrefix'] || '—'}</Td>
    <Td fontSize="sm">{rate.areaName || rate['Area name'] || rate['Area Name'] || '—'} </Td>
    <Td isNumeric>
      {/* <Badge colorScheme="teal" variant="subtle" fontFamily="mono" fontSize="xs" px={2}> */}
      <Text>
        {rate['Rate(Minute)'] || '0.0000000'}
        </Text>
      {/* </Badge> */}
    </Td>
    {/* <Td>
      <Tag size="sm" colorScheme="purple" variant="outline">
        <TagLabel>{rate.currency || 'USD'}</TagLabel>
      </Tag>
    </Td> */}
    <Td fontSize="sm" color={useColorModeValue('gray.600', 'gray.400')}>
      {rate.effectiveDate || '—'}
    </Td>
    <Td fontSize="sm" color={useColorModeValue('gray.500', 'gray.400')} maxW="200px">
      <Text noOfLines={1}>{rate['Plan billing cycle'] || '—'}/{rate['Plan billing cycle'] || '—'}</Text>
    </Td>
    <Td>
      <HStack spacing={1} justify="center">
          <IconButton
            icon={<FiEdit2 />}
            size="sm"
            variant="ghost"
            colorScheme="blue"
            aria-label="Edit"
            onClick={() => onEdit(idx)}
          />
          <IconButton
            icon={<FiTrash2 />}
            size="sm"
            variant="ghost"
            colorScheme="red"
            aria-label="Delete"
            onClick={() => onDelete(idx, rate)}
          />
      </HStack>
    </Td>
  </Tr>
);

// ─── Stat Card Component ──────────────────────────────────────────────────────
const StatCard = ({ label, value, icon, colorScheme = 'blue', helpText }) => {
  const bg = useColorModeValue('white', 'gray.800');
  const border = useColorModeValue('gray.100', 'gray.700');
  return (
    <Box
                  key={label}
                  p={4}
                  px={5}
                  bg="gray.50"
                  borderRadius="lg"
                  border={"1px solid"}
                  borderColor="gray.200"
                  shadow="sm"
                >
                  <Text
                    fontSize="xs"
                    fontWeight="500"
                    color="gray.600"
                    letterSpacing="wider"
                    textTransform="uppercase"
                    mb={1}
                  >
                    {label}
                  </Text>
                  <HStack spacing={2} align={"baseline"}>
                    <Text
                      fontSize="2xl"
                      fontWeight="500"
                      color="gray.700"
                      lineHeight="1"
                    >
                      {value}
                    </Text>
                    <Text fontSize="xs" color="gray.400">
                      accounts
                    </Text>
                  </HStack>
                </Box>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
const CustomerRates = () => {
  const notify = useNotify();
  const fileInputRef = useRef(null);
  const cancelDeleteRef = useRef(null);
  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const headerBg = useColorModeValue('gray.50', 'gray.750');
  const isDragging = useRef(false);

  // ── State ──────────────────────────────────────────────────────────────────
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [selectedTrunk, setSelectedTrunk] = useState(null);
  const [customerTrunks, setCustomerTrunks] = useState([]);
  const [rates, setRates] = useState([]);
  const [currentRateId, setCurrentRateId] = useState(null); // FIX: track actual rate doc id
  const [uploadedRates, setUploadedRates] = useState([]);
  const [changeTracking, setChangeTracking] = useState(null);
  const [rateHistory, setRateHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [showChangePreview, setShowChangePreview] = useState(false);
  const [changeAction, setChangeAction] = useState('replace-all');
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'destination', dir: 'asc' });
  const [pendingUploadFile, setPendingUploadFile] = useState(null);
  const [editingRateIdx, setEditingRateIdx] = useState(null);
  const [editingRateData, setEditingRateData] = useState({});
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Delete',
    type: 'danger',
    onConfirm: null,
    isLoading: false,
  });
  const { isOpen: isEditOpen, onOpen: onEditOpen, onClose: onEditClose } = useDisclosure();

  // ── Load customers on mount ───────────────────────────────────────────────
  useEffect(() => {
    loadCustomers();
  }, []);

  // ── When customer changes: load trunks (don't auto-fetch rates) ───────────
  // FIX: Removed auto-loadCustomerRates from these effects
  useEffect(() => {
    if (selectedCustomer) {
      loadCustomerTrunks();
    } else {
      setCustomerTrunks([]);
      setSelectedTrunk(null);
      setRates([]);
      setCurrentRateId(null);
    }
  }, [selectedCustomer, customers]);

  // FIX: Do NOT auto-load rates when trunk changes — user must click "Fetch Rates"
  // (removed the old useEffect that called loadCustomerRates on selectedTrunk change)

  const loadCustomers = async () => {
    try {
      setLoading(true);
      const data = await fetchReportAccounts();
      const selectableAccounts = (data.customers || []).filter((account) => {
        const role = String(account.accountRole || '').toLowerCase();
        return role === 'customer' || role === 'both';
      });
      setCustomers(selectableAccounts);
    } catch (error) {
      notify('error', `Failed to load customers: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const loadCustomerTrunks = () => {
    if (!selectedCustomer) return;
    const customer = customers.find(c => c.id === selectedCustomer);
    if (customer?.trunks) {
      const trunks = Array.isArray(customer.trunks)
        ? customer.trunks.map(t => (typeof t === 'string' ? t : t.name || t.prefix))
        : [];
      setCustomerTrunks(trunks);
      // FIX: Do NOT auto-select trunk — let user choose
      setSelectedTrunk(null);
      setRates([]);
      setCurrentRateId(null);
    } else {
      setCustomerTrunks([]);
      setSelectedTrunk(null);
      setRates([]);
      setCurrentRateId(null);
    }
  };

  // FIX: Called only on explicit button click
  const loadCustomerRates = async () => {
    if (!selectedCustomer || !selectedTrunk) {
      notify('warning', 'Please select both a customer and a trunk.');
      return;
    }
    try {
      setLoading(true);
      const data = await fetchCustomerRates({
        accountId: selectedCustomer,
        trunk: selectedTrunk,
        isActive: true,
      });
      const activeRates = (data.data || []).filter(r => r.isActive);
      if (activeRates.length > 0) {
        const latestRate = activeRates[0];
        setCurrentRateId(latestRate.id ?? latestRate._id ?? null); // FIX: store rate doc id separately
        setRates(Array.isArray(latestRate.rateData) ? latestRate.rateData.map(normalizeRateRow) : []);
      } else {
        setCurrentRateId(null);
        setRates([]);
      }
    } catch (error) {
      notify('error', `Failed to load rates: ${error.message}`);
      setRates([]);
    } finally {
      setLoading(false);
    }
  };

  const loadRateHistory = async () => {
    if (!selectedCustomer || !selectedTrunk) return;
    try {
      setLoading(true);
      const data = await fetchCustomerRatesHistory(selectedCustomer, selectedTrunk);
      setRateHistory(data.data || []);
    } catch (error) {
      notify('error', `Failed to load history: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // ── File Parsing (browser-safe) ────────────────────────────────────────────
  // FIX: Use XLSX.read() with ArrayBuffer instead of XLSX.readFile() (Node-only)
  const parseExcelFile = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const data = new Uint8Array(evt.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          const parsed = XLSX.utils.sheet_to_json(sheet);
          resolve(parsed);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });

  const handleFileUpload = async (file) => {
    if (!file) return;
    if (!selectedCustomer || !selectedTrunk) {
      notify('error', 'Please select a customer and trunk first');
      return;
    }

    const validTypes = ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel', 'text/csv'];
    if (!validTypes.includes(file.type) && !file.name.match(/\.(xlsx|xls|csv)$/i)) {
      notify('error', 'Invalid file type. Please upload XLSX, XLS, or CSV.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      notify('error', 'File size exceeds 10MB limit.');
      return;
    }

    try {
      setUploading(true);
      setPendingUploadFile(file);
      const parsedData = await parseExcelFile(file);

      const normalized = parsedData.map(normalizeRateRow);

      setUploadedRates(normalized);

      const previousRates = Array.isArray(rates) ? rates : [];
      const changeTrackingPreview = {
        added: normalized.filter(
          newRate => !previousRates.some(prev => prev.destination === newRate.destination)
        ),
        updated: normalized.filter(
          newRate => previousRates.some(
            prev => prev.destination === newRate.destination && JSON.stringify(prev) !== JSON.stringify(newRate)
          )
        ),
        removed: previousRates.filter(
          prevRate => !normalized.some(newRate => newRate.destination === prevRate.destination)
        ),
        timestamp: new Date(),
      };

      setChangeTracking(changeTrackingPreview);
      setShowChangePreview(true);
      notify('success', `${normalized.length} rates parsed. Review and apply changes.`);
    } catch (error) {
      notify('error', `Upload failed: ${error.message}`);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleInputChange = (e) => handleFileUpload(e.target.files?.[0]);

  // ── Drag & Drop ────────────────────────────────────────────────────────────
  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileUpload(file);
  }, [selectedCustomer, selectedTrunk]);

  // ── Apply Changes ──────────────────────────────────────────────────────────
  // FIX: Use currentRateId (stored separately) instead of broken spread
  const handleApplyChanges = async () => {
    if (!pendingUploadFile && !currentRateId) {
      notify('error', 'No uploaded file to apply.');
      return;
    }
    try {
      setLoading(true);
      if (currentRateId) {
        const result = await updateCustomerRates(currentRateId, {
          rateData: uploadedRates,
          action: changeAction,
        });
        if (result.success) {
          notify('success', `Rates updated successfully (${changeAction}).`);
          setShowChangePreview(false);
          setUploadedRates([]);
          setChangeTracking(null);
          setPendingUploadFile(null);
          await loadCustomerRates();
        }
      } else {
        const result = await uploadCustomerRates(selectedCustomer, selectedTrunk, pendingUploadFile);
        if (result.success) {
          notify('success', 'Rates uploaded successfully.');
          setShowChangePreview(false);
          setUploadedRates([]);
          setChangeTracking(null);
          setPendingUploadFile(null);
          if (result.data && (result.data.id || result.data._id)) {
            setCurrentRateId(result.data.id ?? result.data._id ?? null);
          }
          await loadCustomerRates();
        }
      }
    } catch (error) {
      notify('error', `Failed to apply changes: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // ── Edit Modal Handlers ───────────────────────────────────────────────────────
  const handleEditRow = (idx) => {
    setEditingRateIdx(idx);
    setEditingRateData({ ...rates[idx] });
    onEditOpen();
  };

  const handleSaveEdit = async () => {
    if (editingRateIdx === null || editingRateIdx === undefined) return;
    const updatedRates = rates.map((r, i) => (i === editingRateIdx ? editingRateData : r));
    if (!currentRateId) {
      notify('error', 'No active rate record. Load rates first.');
      return;
    }
    try {
      setLoading(true);
      const result = await updateCustomerRates(currentRateId, {
        rateData: updatedRates,
        action: 'replace-all',
      });
      if (result.success) {
        setRates(updatedRates);
        onEditClose();
        setEditingRateIdx(null);
        notify('success', 'Rate updated successfully.');
      }
    } catch (error) {
      notify('error', `Failed to save: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // ── Delete Handler ─────────────────────────────────────────────────────────
  const handleDeleteClick = (idx, rate) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Rate',
      message: `Are you sure you want to delete the rate for ${rate?.destination || 'this destination'}? This action cannot be undone.`,
      confirmText: 'Delete',
      type: 'danger',
      isLoading: false,
      onConfirm: async () => {
        try {
          setLoading(true);
          if (!currentRateId) {
            notify('error', 'No active rate record found.');
            return;
          }

          const updatedRates = rates.filter((_, i) => i !== idx);
          const result = await updateCustomerRates(currentRateId, {
            rateData: updatedRates,
            action: 'replace-all',
          });
          if (result.success) {
            setRates(updatedRates);
            notify('success', `Rate for "${rate?.destination || 'this rate'}" deleted.`);
          }
        } catch (error) {
          notify('error', `Failed to delete: ${error.message}`);
        } finally {
          setLoading(false);
          setConfirmDialog((prev) => ({ ...prev, isOpen: false, onConfirm: null, isLoading: false }));
        }
      },
    });
  };

  const handleRevertRate = async (id) => {
    try {
      setLoading(true);
      const result = await revertCustomerRate(id);
      if (result.success) {
        notify('success', 'Rates reverted successfully.');
        setShowHistoryModal(false);
        await loadCustomerRates();
      }
    } catch (error) {
      notify('error', `Failed to revert: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // ── Export ─────────────────────────────────────────────────────────────────
  const exportRatesToExcel = () => {
    if (rates.length === 0) { notify('warning', 'No rates to export.'); return; }
    const ws = XLSX.utils.json_to_sheet(rates);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Rates');
    const customer = customers.find(c => c.id === selectedCustomer);
    const filename = `${customer?.accountName || 'customer'}_${selectedTrunk}_rates_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, filename);
    notify('success', 'Rates exported.');
  };

  // ── Sort & Filter ──────────────────────────────────────────────────────────
  const toggleSort = (key) => {
    setSortConfig(prev =>
      prev.key === key
        ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: 'asc' }
    );
  };

  const filteredRates = rates
    .filter(r => {
      const q = searchFilter.toLowerCase();
      return (
        String(r.destination || r['Rate prefix'] || r['Area prefix'] || '').toLowerCase().includes(q) ||
        String(r.areaName || r['Area name'] || r['Area Name'] || '').toLowerCase().includes(q) ||
        String(r.description || '').toLowerCase().includes(q) ||
        String(r.currency || '').toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      const { key, dir } = sortConfig;
      const aVal = a[key] ?? '';
      const bVal = b[key] ?? '';
      const cmp = typeof aVal === 'number' ? aVal - bVal : String(aVal).localeCompare(String(bVal));
      return dir === 'asc' ? cmp : -cmp;
    });

  const SortIcon = ({ colKey }) => {
    if (sortConfig.key !== colKey) return <Icon as={FiFilter} fontSize="10px" opacity={0.3} ml={1} />;
    return sortConfig.dir === 'asc'
      ? <Icon as={FiChevronUp} fontSize="12px" ml={1} color="blue.400" />
      : <Icon as={FiChevronDown} fontSize="12px" ml={1} color="blue.400" />;
  };

  const SortableTh = ({ colKey, label, isNumeric }) => (
    <Th
      isNumeric={isNumeric}
      cursor="pointer"
      userSelect="none"
      _hover={{ color: 'blue.400' }}
      onClick={() => toggleSort(colKey)}
      whiteSpace="nowrap"
    >
      <HStack spacing={0} justify={isNumeric ? 'flex-end' : 'flex-start'}>
        <Text>{label}</Text>
        <SortIcon colKey={colKey} />
      </HStack>
    </Th>
  );

  const selectedCustomerName = customers.find(c => c.id === selectedCustomer)?.accountName;
  const canFetchRates = !!(selectedCustomer && selectedTrunk);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Box minH="100vh" >
      <PageNavBar
        title="Customer Rates"
        description="Manage and upload customer-specific rates per trunk."
      />

      <Box px={{ base: 4, md: 4}} py={6} >

        {/* ── Header Stats Row ── */}
        {/* <SimpleGrid columns={{ base: 2, md: 3 }} spacing={4} mb={6}>
          <StatCard
            label="Total Rates"
            value={rates.length}
            icon={FiZap}
            colorScheme="blue"
            helpText={selectedTrunk ? `for ${selectedTrunk}` : 'Select trunk'}
          />
          <StatCard
            label="Filtered"
            value={filteredRates.length}
            icon={FiFilter}
            colorScheme="teal"
            helpText={searchFilter ? `"${searchFilter}"` : 'No filter'}
          />
          <StatCard
            label="Pending Upload"
            value={uploadedRates.length}
            icon={FiUploadCloud}
            colorScheme="orange"
            helpText={uploadedRates.length > 0 ? 'Review required' : 'None'}
          />
          <StatCard
            label="Status"
            value={currentRateId ? 'Loaded' : 'No Data'}
            icon={currentRateId ? FiCheck : FiAlertCircle}
            colorScheme={currentRateId ? 'green' : 'gray'}
            helpText={selectedCustomerName || 'No customer'}
          />
        </SimpleGrid> */}

        {/* ── Selection Panel ── */}
        <Box
          bg={cardBg}
          border="1px solid"
          borderColor={borderColor}
          borderRadius="xl"
          p={4}
          mb={5}
          boxShadow="sm"
        >
          

          <SimpleGrid columns={{ base: 1, md: 3 }} spacing={5} alignItems="flex-end">
            <FormControl isRequired>
              <FormLabel fontSize="sm" fontWeight="600" color="gray.600">Customer Account</FormLabel>
              <Select
                size="sm"
                value={selectedCustomer || ''}
                onChange={(e) => {
                  setSelectedCustomer(e.target.value ? parseInt(e.target.value) : null);
                  setRates([]);
                  setCurrentRateId(null);
                }}
                placeholder="— Select customer —"
              >
                {customers.map(customer => (
                  <option key={customer.id} value={customer.id}>
                    {customer.accountName} ({customer.customerCode})
                  </option>
                ))}
              </Select>
            </FormControl>

            <FormControl isRequired isDisabled={!selectedCustomer}>
              <FormLabel fontSize="sm" fontWeight="600" color="gray.600">Trunk</FormLabel>
              <Select
                size="sm"
                value={selectedTrunk || ''}
                onChange={(e) => {
                  setSelectedTrunk(e.target.value || null);
                  setRates([]);
                  setCurrentRateId(null);
                }}
                placeholder="— Select trunk —"
              >
                {customerTrunks.map(trunk => (
                  <option key={trunk} value={trunk}>{trunk}</option>
                ))}
              </Select>
            </FormControl>

            {/* FIX: Explicit "Fetch Rates" button — no auto-fetch */}
            <Button
              leftIcon={<FiRefreshCw />}
              colorScheme="blue"
              size="sm"
              isDisabled={!canFetchRates}
              isLoading={loading}
              loadingText="Fetching..."
              onClick={loadCustomerRates}
              w="full"
              fontWeight="600"
            >
              Fetch Rates
            </Button>
          </SimpleGrid>
        </Box>

        {/* ── Upload Panel ── */}
        {canFetchRates && (
          <Box
            bg={cardBg}
            border="1px solid"
            borderColor={borderColor}
            borderRadius="xl"
            mb={5}
            boxShadow="sm"
            overflow="hidden"
          >
            <Box px={6} py={4} borderBottom="1px solid" borderColor={borderColor} bg={headerBg}>
              <Flex justify="space-between" align="center" gap={4} flexWrap="wrap">
                <HStack spacing={3} flex="1" minW="0">
                  <Box w="3px" h="18px" bg="orange.400" borderRadius="full" />
                  <Heading size="sm" color={"gray.600"} fontWeight="600" letterSpacing="tight" noOfLines={1}>
                    Upload New Rates
                  </Heading>
                  <Box
                    as="button"
                    type="button"
                    onClick={() => !uploading && fileInputRef.current?.click()}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    border="1px dashed"
                    borderColor={isDragOver ? 'blue.400' : borderColor}
                    borderRadius="md"
                    px={3}
                    py={1.5}
                    bg={isDragOver ? useColorModeValue('blue.50', 'blue.900') : 'transparent'}
                    fontSize="sm"
                    fontWeight="600"
                    color={useColorModeValue('gray.700', 'gray.200')}
                    transition="all 0.2s"
                    _hover={{ borderColor: 'blue.300', bg: useColorModeValue('blue.50', 'blue.900') }}
                    opacity={uploading ? 0.6 : 1}
                    pointerEvents={uploading ? 'none' : 'auto'}
                  >
                    {uploading ? 'Uploading...' : 'Drop / Upload File'}
                  </Box>
                </HStack>
                <HStack spacing={2} flexShrink={0}>
                    <Button
                      size="xs"
                      leftIcon={<FiDownload />}
                      variant="outline"
                      onClick={exportRatesToExcel}
                      isDisabled={rates.length === 0}
                    >
                      Export
                    </Button>
                    <Button
                      colorScheme='green'
                      size="xs"
                      leftIcon={<FiClock />}
                      variant="outline"
                      onClick={() => { setShowHistoryModal(true); loadRateHistory(); }}
                      isDisabled={!selectedCustomer || !selectedTrunk}
                    >
                      History
                    </Button>
                   
                </HStack>
              </Flex>
            </Box>
            <Input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleInputChange}
              display="none"
              disabled={uploading}
            />
          </Box>
        )}

        {/* ── Rates Table ── */}
        {canFetchRates && (
          <Box
            bg={cardBg}
            border="1px solid"
            borderColor={borderColor}
            borderRadius="xl"
            boxShadow="sm"
            overflow="hidden"
          >
            {/* Table Header */}
            <Box px={6} py={3} borderBottom="1px solid" borderColor={borderColor} bg={headerBg}>
              <Flex py={0} justify="space-between" align="center" gap={8}  flexWrap="wrap">
                <HStack spacing={2}>
                  <Box w="3px" h="18px" bg="teal.400" borderRadius="full" />
                  <Heading size="sm" color={"gray.600"} fontWeight="600" letterSpacing="tight">
                    Active Rate Schedule
                  </Heading>
                  {rates.length > 0 && (
                    <Badge colorScheme="teal" borderRadius="full" px={2}>
                      {rates.length} entries
                    </Badge>
                  )}
                </HStack>
                {rates.length > 0 && (
                  <InputGroup size="sm" maxW="260px">
                    <InputLeftElement pointerEvents="none">
                      <Icon as={FiSearch} color="gray.400" />
                    </InputLeftElement>
                    <Input
                      placeholder="Search destination, description..."
                      value={searchFilter}
                      onChange={(e) => setSearchFilter(e.target.value)}
                      borderRadius="md"
                      bg={useColorModeValue('white', 'gray.800')}
                    />
                  </InputGroup>
                )}
              </Flex>
            </Box>

            {/* Table Body */}
            {loading ? (
              <Center py={16}>
                <VStack spacing={3}>
                  <Spinner size="lg" color="blue.400" />
                  <Text color="gray.500" fontSize="sm">Loading rates...</Text>
                </VStack>
              </Center>
            ) : rates.length === 0 ? (
              <Center py={16}>
                <VStack spacing={3}>
                  <Icon as={FiInfo} fontSize="32px" color="gray.300" />
                  <Text color="gray.500" fontWeight="500">No rates loaded</Text>
                  <Text color="gray.400" fontSize="sm">
                    Select a customer and trunk, then click <strong>Fetch Rates</strong>
                  </Text>
                </VStack>
              </Center>
            ) : filteredRates.length === 0 ? (
              <Center py={16}>
                <VStack spacing={2}>
                  <Icon as={FiSearch} fontSize="28px" color="gray.300" />
                  <Text color="gray.500">No results match "{searchFilter}"</Text>
                  <Button size="sm" variant="link" onClick={() => setSearchFilter('')}>Clear filter</Button>
                </VStack>
              </Center>
            ) : (
              <TableContainer maxH={"400px"} overflowY="auto">
                <Table size="sm" variant="simple">
                  <Thead position="sticky" top={0} zIndex={1} bg={headerBg}>
                    <Tr bg={useColorModeValue('gray.50', 'gray.750')}>
                      <SortableTh colKey="destination" label="Destination" />
                      <SortableTh colKey="areaPrefix" label="Area Prefix" />
                      <SortableTh colKey="areaName" label="Area Name" />
                      <SortableTh colKey="rate" label="Rate (Minute) USD" isNumeric />
                      {/* <SortableTh colKey="currency" label="Currency" /> */}
                      <SortableTh colKey="effectiveDate" label="Effective Date" />
                      <SortableTh colKey="description" label="Plan Billing Cycle" />
                      <Th textAlign="center">Actions</Th>
                    </Tr>
                  </Thead>
                  <Tbody overflowX={"auto"}>
                    {filteredRates.map((rate, idx) => (
                      <RateRow
                        key={`${rate.destination}-${idx}`}
                        rate={rate}
                        idx={idx}
                        onEdit={handleEditRow}
                        onDelete={handleDeleteClick}
                      />
                    ))}
                  </Tbody>
                </Table>
              </TableContainer>
            )}

            {/* Table Footer */}
            {filteredRates.length > 0 && (
              <Box
                px={6}
                py={3}
                borderTop="1px solid"
                borderColor={borderColor}
                bg={headerBg}
              >
                <Text fontSize="xs" color="gray.500">
                  Showing {filteredRates.length} of {rates.length} rates
                  {searchFilter ? ` · filtered by "${searchFilter}"` : ''}
                  {' · '}Sorted by {sortConfig.key} ({sortConfig.dir})
                </Text>
              </Box>
            )}
          </Box>
        )}
      </Box>

      {/* ── Change Preview Modal ── */}
      <Modal isOpen={showChangePreview} onClose={() => setShowChangePreview(false)} size="lg" isCentered>
        <ModalOverlay backdropFilter="blur(4px)" />
        <ModalContent borderRadius="xl" overflow="hidden">
          <ModalHeader
            bg={useColorModeValue('blue.50', 'blue.900')}
            borderBottom="1px solid"
            borderColor={borderColor}
            fontSize="md"
            fontWeight="700"
          >
            Review & Apply Changes
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody py={5}>
            <VStack spacing={5} align="stretch">
              {changeTracking && (
                <SimpleGrid columns={3} spacing={4}>
                  <Box p={4} bg={useColorModeValue('green.50', 'green.900')} borderRadius="lg" textAlign="center">
                    <Text fontSize="2xl" fontWeight="700" color="green.500" fontFamily="mono">
                      {changeTracking.added?.length ?? 0}
                    </Text>
                    <Badge colorScheme="green" mt={1}>Added</Badge>
                    {changeTracking.added?.slice(0, 2).map((r, i) => (
                      <Text key={i} fontSize="xs" color="gray.500" mt={1} noOfLines={1}>{r.destination}</Text>
                    ))}
                    {(changeTracking.added?.length ?? 0) > 2 && (
                      <Text fontSize="xs" color="gray.400">+{changeTracking.added.length - 2} more</Text>
                    )}
                  </Box>
                  <Box p={4} bg={useColorModeValue('yellow.50', 'yellow.900')} borderRadius="lg" textAlign="center">
                    <Text fontSize="2xl" fontWeight="700" color="yellow.500" fontFamily="mono">
                      {changeTracking.updated?.length ?? 0}
                    </Text>
                    <Badge colorScheme="yellow" mt={1}>Updated</Badge>
                    {changeTracking.updated?.slice(0, 2).map((r, i) => (
                      <Text key={i} fontSize="xs" color="gray.500" mt={1} noOfLines={1}>{r.destination}</Text>
                    ))}
                    {(changeTracking.updated?.length ?? 0) > 2 && (
                      <Text fontSize="xs" color="gray.400">+{changeTracking.updated.length - 2} more</Text>
                    )}
                  </Box>
                  <Box p={4} bg={useColorModeValue('red.50', 'red.900')} borderRadius="lg" textAlign="center">
                    <Text fontSize="2xl" fontWeight="700" color="red.500" fontFamily="mono">
                      {changeTracking.removed?.length ?? 0}
                    </Text>
                    <Badge colorScheme="red" mt={1}>Removed</Badge>
                    {changeTracking.removed?.slice(0, 2).map((r, i) => (
                      <Text key={i} fontSize="xs" color="gray.500" mt={1} noOfLines={1}>{r.destination}</Text>
                    ))}
                    {(changeTracking.removed?.length ?? 0) > 2 && (
                      <Text fontSize="xs" color="gray.400">+{changeTracking.removed.length - 2} more</Text>
                    )}
                  </Box>
                </SimpleGrid>
              )}

              <Divider />

              <FormControl>
                <FormLabel fontSize="sm" fontWeight="600">Apply Strategy</FormLabel>
                <ChakraSelect
                  size="sm"
                  value={changeAction}
                  onChange={(e) => setChangeAction(e.target.value)}
                  borderRadius="md"
                >
                  <option value="replace-all">Replace All — Remove existing rates and load new</option>
                  <option value="update-changed">Update Changed — Keep unchanged rows, update rest</option>
                </ChakraSelect>
                <Text fontSize="xs" color="gray.400" mt={1}>
                  {changeAction === 'replace-all'
                    ? 'All current rates will be replaced. Recommended for full rate sheet uploads.'
                    : 'Only modified rows are touched. Unchanged rates remain intact.'}
                </Text>
              </FormControl>
            </VStack>
          </ModalBody>
          <ModalFooter borderTop="1px solid" borderColor={borderColor} gap={3}>
            <Button variant="ghost" onClick={() => setShowChangePreview(false)}>
              Cancel
            </Button>
            <Button
              colorScheme="blue"
              leftIcon={<FiSave />}
              onClick={handleApplyChanges}
              isLoading={loading}
              loadingText="Applying..."
              fontWeight="600"
            >
              Apply Changes
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* ── History Modal ── */}
      <Modal isOpen={showHistoryModal} onClose={() => setShowHistoryModal(false)} size="lg" isCentered>
        <ModalOverlay backdropFilter="blur(4px)" />
        <ModalContent borderRadius="xl" overflow="hidden">
          <ModalHeader
            bg={useColorModeValue('gray.50', 'gray.750')}
            borderBottom="1px solid"
            borderColor={borderColor}
            fontSize="md"
            fontWeight="700"
          >
            <HStack spacing={2}>
              <Icon as={FiClock} />
              <Text>Rate Version History</Text>
            </HStack>
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody py={4} maxH={"500px"} minH={"400px"} overflowY="auto">
            {loading ? (
              <Center py={10}><Spinner /></Center>
            ) : rateHistory.length === 0 ? (
              <Alert status="info"  colorScheme='gray' borderRadius="lg">
                <AlertIcon />
                <AlertDescription>No version history available yet.</AlertDescription>
              </Alert>
            ) : (
              <VStack spacing={3} align="stretch">
                {rateHistory.map((entry, idx) => (
                  <Box
                    key={idx}
                    p={4}
                    border="1px solid"
                    borderColor={entry.isActive ? 'blue.300' : borderColor}
                    borderRadius="lg"
                    bg={entry.isActive ? useColorModeValue('blue.50', 'blue.900') : 'transparent'}
                    position="relative"
                    overflow="hidden"
                  >
                    {entry.isActive && (
                      <Box position="absolute" top={0} left={0} w="3px" h="full" bg="blue.400" />
                    )}
                    <HStack justify="space-between" mb={2}>
                      <HStack spacing={2}>
                        <Text fontWeight="700" fontSize="sm">
                          {entry.isActive ? 'Current Version' : `Version ${rateHistory.length - idx}`}
                        </Text>
                        <Badge colorScheme={entry.isActive ? 'blue' : 'gray'} variant="subtle">
                          {entry.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </HStack>
                      <HStack spacing={2}>
                        {!entry.isActive && (
                          <Button
                            size="xs"
                            leftIcon={<FiArrowLeft />}
                            colorScheme="blue"
                            variant="outline"
                            onClick={() => handleRevertRate(entry.id)}
                            isLoading={loading}
                          >
                            Revert
                          </Button>
                        )}
                        {!entry.isActive && (
                          <Button
                            size="xs"
                            leftIcon={<FiTrash2 />}
                            colorScheme="red"
                            variant="outline"
                            onClick={() => {
                              setConfirmDialog({
                                isOpen: true,
                                title: 'Delete Rate Version',
                                message: 'Delete this rate version? This cannot be undone.',
                                confirmText: 'Delete',
                                type: 'danger',
                                isLoading: false,
                                onConfirm: async () => {
                                  try {
                                    setLoading(true);
                                    const result = await deleteCustomerRate(entry.id);
                                    if (result.success) {
                                      notify('success', 'Rate version deleted successfully.');
                                      await loadRateHistory();
                                    }
                                  } catch (error) {
                                    notify('error', `Failed to delete: ${error.message}`);
                                  } finally {
                                    setLoading(false);
                                  }
                                },
                              });
                            }}
                            isLoading={loading}
                          >
                            Delete
                          </Button>
                        )}
                      </HStack>
                    </HStack>
                    <HStack spacing={4}>
                      <Text fontSize="xs" color="gray.500">
                         {new Date(entry.uploadedAt).toLocaleString()}
                      </Text>
                      <Text fontSize="xs" color="gray.500">
                         {Array.isArray(entry.rateData) ? entry.rateData.length : 0} rates
                      </Text>
                    </HStack>
                  </Box>
                ))}
              </VStack>
            )}
          </ModalBody>
        </ModalContent>
      </Modal>

      {/* ── Edit Rate Modal ── */}
      <Modal isOpen={isEditOpen} onClose={onEditClose} size="md" isCentered>
        <ModalOverlay backdropFilter="blur(4px)" />
        <ModalContent borderRadius="xl" overflow="hidden">
          <ModalHeader
            bg={useColorModeValue('blue.50', 'blue.900')}
            borderBottom="1px solid"
            borderColor={borderColor}
            fontSize="md"
            fontWeight="700"
          >
            Edit Rate
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody py={5}>
            <VStack spacing={4} align="stretch">
              <FormControl>
                <FormLabel fontSize="sm" fontWeight="600">Destination</FormLabel>
                <Input
                  size="sm"
                  value={editingRateData.destination || ''}
                  onChange={(e) => setEditingRateData(p => ({ ...p, destination: e.target.value }))}
                  placeholder="e.g., US-001"
                />
              </FormControl>

              <FormControl>
                <FormLabel fontSize="sm" fontWeight="600">Area Name</FormLabel>
                <Input
                  size="sm"
                  value={editingRateData.areaName || ''}
                  onChange={(e) => setEditingRateData(p => ({ ...p, areaName: e.target.value }))}
                  placeholder="e.g., United States - Mobile"
                />
              </FormControl>

              <FormControl>
                <FormLabel fontSize="sm" fontWeight="600">Rate (per minute)</FormLabel>
                <NumberInput
                  size="sm"
                  value={editingRateData['Rate(Minute)'] || 0}
                  min={0}
                  precision={7}
                  onChange={(val) => setEditingRateData(p => ({ ...p, 'Rate(Minute)': parseFloat(val) || 0 }))}
                >
                  <NumberInputField />
                  <NumberInputStepper>
                    <NumberIncrementStepper />
                    <NumberDecrementStepper />
                  </NumberInputStepper>
                </NumberInput>
              </FormControl>

              <FormControl>
                <FormLabel fontSize="sm" fontWeight="600">Currency</FormLabel>
                <Input
                  size="sm"
                  value={editingRateData.currency || 'USD'}
                  onChange={(e) => setEditingRateData(p => ({ ...p, currency: e.target.value }))}
                  maxW="100px"
                  placeholder="USD"
                />
              </FormControl>

              <FormControl>
                <FormLabel fontSize="sm" fontWeight="600">Effective Date</FormLabel>
                <Input
                  size="sm"
                  type="date"
                  value={editingRateData.effectiveDate || ''}
                  onChange={(e) => setEditingRateData(p => ({ ...p, effectiveDate: e.target.value }))}
                />
              </FormControl>

              <FormControl>
                <FormLabel fontSize="sm" fontWeight="600">Description</FormLabel>
                <Input
                  size="sm"
                  value={editingRateData.description || ''}
                  onChange={(e) => setEditingRateData(p => ({ ...p, description: e.target.value }))}
                  placeholder="Additional notes"
                />
              </FormControl>
            </VStack>
          </ModalBody>
          <ModalFooter borderTop="1px solid" borderColor={borderColor} gap={3}>
            <Button variant="ghost" onClick={onEditClose}>
              Cancel
            </Button>
            <Button
              colorScheme="blue"
              leftIcon={<FiSave />}
              onClick={handleSaveEdit}
              isLoading={loading}
              loadingText="Saving..."
              fontWeight="600"
            >
              Save Changes
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false, onConfirm: null, isLoading: false }))}
        onConfirm={async () => {
          if (!confirmDialog.onConfirm || confirmDialog.isLoading) return;
          setConfirmDialog((prev) => ({ ...prev, isLoading: true }));
          try {
            await confirmDialog.onConfirm();
          } finally {
            setConfirmDialog((prev) => ({ ...prev, isLoading: false }));
          }
        }}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText={confirmDialog.confirmText}
        type={confirmDialog.type}
        isLoading={confirmDialog.isLoading || loading}
      />
    </Box>
  );
};

export default CustomerRates;