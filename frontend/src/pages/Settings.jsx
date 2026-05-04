import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Badge,
  Box,
  Button,
  Card,
  CardBody,
  Divider,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Grid,
  GridItem,
  HStack,
  NumberInput,
  NumberInputField,
  Spinner,
  Switch,
  Text,
  VStack,
} from '@chakra-ui/react';
import useNotify from '../utils/notify';
import { MemoizedInput as Input, MemoizedSelect as Select } from '../components/memoizedinput/memoizedinput';
import { FiBell, FiDatabase, FiRefreshCw, FiSave, FiSettings, FiUpload } from 'react-icons/fi';
import {
  createTestNotification,
  fetchCDRCount,
  fetchNotifications,
  getGlobalSettings,
  markAllNotificationsRead,
  markNotificationRead,
  runRetentionCleanup,
  addCountryCode,
  deleteCountryCode,
  fetchCountryCodes,
  uploadCountryCodes,
  updateGlobalSettings,
} from '../utils/api';
import { formatNotificationTime } from '../utils/notificationTime';
import PageNavBar from '../components/PageNavBar';
import DataTable from '../components/DataTable';

// ─── Constants ───────────────────────────────────────────────────────────────

const DEFAULT_SETTINGS = {
  systemName: 'CDR Billing System',
  currency: 'USD',
  timezone: 'UTC',
  dataRetentionDays: 60,
  notificationPollingSeconds: 10,
  lastProcessedCdrFilename: '',
  lastProcessedCdrTimestampUtc: '',
  emailNotifications: true,
  notifyInvoiceGenerated: true,
  notifyPaymentDue: true,
  notifyDisputes: true,
  notifyErrors: true,
  notifyPaymentReceived: true,
  notificationEmail: '',
};

const SETTINGS_KEYS = Object.keys(DEFAULT_SETTINGS);
const RETENTION_MIN = 2;
const RETENTION_MAX = 90;
const POLLING_MIN = 5;
const POLLING_MAX = 3600;

// ─── Helpers ─────────────────────────────────────────────────────────────────

const normalizeSettingsShape = (raw = {}) => {
  const source = raw && typeof raw === 'object' ? raw : {};
  const mapped = {
    ...source,
    dataRetentionDays: source.dataRetentionDays ?? source.dataretentiondays,
    notificationPollingSeconds:
      source.notificationPollingSeconds ?? source.notificationpollingseconds,
  };
  return SETTINGS_KEYS.reduce((acc, key) => {
    if (mapped[key] !== undefined) acc[key] = mapped[key];
    return acc;
  }, {});
};

const validateNumericInput = (rawValue, label, min, max) => {
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed))
    return { valid: false, value: null, message: `${label} must be a number.` };
  if (parsed < min || parsed > max)
    return { valid: false, value: null, message: `${label} must be between ${min} and ${max}.` };
  return { valid: true, value: parsed, message: '' };
};

// ─── Shared design tokens (applied via sx / style props) ─────────────────────

const CARD_PROPS = {
  bg: 'white',
  borderWidth: '0.5px',
  borderColor: 'gray.200',
  borderRadius: '10px',
  boxShadow: 'none',
};

const SECTION_LABEL = {
  fontSize: '10px',
  fontWeight: '600',
  textTransform: 'uppercase',
  letterSpacing: '0.07em',
  color: 'gray.400',
};

const INPUT_PROPS = {
  borderWidth: '0.5px',
  borderColor: 'gray.200',
  bg: 'gray.50',
  fontSize: '13px',
  height: '34px',
  borderRadius: '8px',
  _hover: { borderColor: 'gray.300' },
  _focus: { borderColor: 'gray.400', boxShadow: 'none' },
};

const FORM_LABEL_PROPS = {
  fontSize: '12px',
  fontWeight: '500',
  color: 'gray.600',
  mb: 1,
};

// ─── SectionHeader ───────────────────────────────────────────────────────────

const SectionHeader = ({ children }) => (
  <Text {...SECTION_LABEL} mb={3}>
    {children}
  </Text>
);

// ─── ToggleRow ────────────────────────────────────────────────────────────────

const ToggleRow = ({ label, isChecked, onChange }) => (
  <HStack justify="space-between" py={3} borderBottomWidth="0.5px" borderColor="gray.100">
    <Text fontSize="13px" color="gray.700">
      {label}
    </Text>
    <Switch
      size="sm"
      colorScheme="gray"
      isChecked={isChecked}
      onChange={onChange}
      sx={{
        '& .chakra-switch__track[data-checked]': { bg: 'gray.800' },
      }}
    />
  </HStack>
);

// ─── Tab navigation ───────────────────────────────────────────────────────────

const TABS = [
  { id: 'general',    label: 'General',       icon: FiSettings },
  { id: 'retention',  label: 'Data Retention', icon: FiDatabase },
  { id: 'codes',      label: 'Country Codes',  icon: FiUpload },
  { id: 'notifs',     label: 'Notifications',  icon: FiBell },
];

const TabNav = ({ active, onChange }) => (
  <HStack
    spacing={0}
    borderBottomWidth="0.5px"
    borderColor="gray.200"
    mb={5}
    overflowX="auto"
  >
    {TABS.map(({ id, label, icon: Icon }) => {
      const isActive = active === id;
      return (
        <Box
          key={id}
          as="button"
          onClick={() => onChange(id)}
          px={5}
          py={3}
          display="flex"
          alignItems="center"
          gap={2}
          fontSize="13px"
          fontWeight={isActive ? '600' : '500'}
          color={isActive ? 'gray.800' : 'gray.500'}
          borderBottomWidth="2px"
          borderBottomColor={isActive ? 'gray.800' : 'transparent'}
          bg="transparent"
          cursor="pointer"
          whiteSpace="nowrap"
          transition="all 0.15s"
          _hover={{ color: 'gray.700' }}
          mb="-0.5px"
        >
          <Icon size={13} />
          {label}
        </Box>
      );
    })}
  </HStack>
);

// ─── GeneralTab ───────────────────────────────────────────────────────────────

const GeneralTab = ({ settings, updateSetting }) => (
  <VStack spacing={5} align="stretch">
    <Card {...CARD_PROPS}>
      <CardBody px={5} py={5}>
        <SectionHeader>System</SectionHeader>
        <Grid templateColumns={{ base: '1fr', md: '1fr 1fr' }} gap={4}>
          <FormControl>
            <FormLabel {...FORM_LABEL_PROPS}>System Name</FormLabel>
            <Input
              {...INPUT_PROPS}
              value={settings.systemName || ''}
              onChange={(e) => updateSetting('systemName', e.target.value)}
            />
          </FormControl>
          <FormControl>
            <FormLabel {...FORM_LABEL_PROPS}>Notification Email</FormLabel>
            <Input
              {...INPUT_PROPS}
              type="email"
              value={settings.notificationEmail || ''}
              onChange={(e) => updateSetting('notificationEmail', e.target.value)}
            />
          </FormControl>
          <FormControl>
            <FormLabel {...FORM_LABEL_PROPS}>Currency</FormLabel>
            <Select
              {...INPUT_PROPS}
              value={settings.currency || 'USD'}
              onChange={(e) => updateSetting('currency', e.target.value)}
            >
              <option value="USD">USD — US Dollar</option>
              <option value="EUR">EUR — Euro</option>
              <option value="GBP">GBP — British Pound</option>
              <option value="INR">INR — Indian Rupee</option>
            </Select>
          </FormControl>
          <FormControl>
            <FormLabel {...FORM_LABEL_PROPS}>Timezone</FormLabel>
            <Select
              {...INPUT_PROPS}
              value={settings.timezone || 'UTC'}
              onChange={(e) => updateSetting('timezone', e.target.value)}
            >
              <option value="UTC">UTC</option>
              <option value="EST">EST — Eastern</option>
              <option value="PST">PST — Pacific</option>
              <option value="IST">IST — India</option>
            </Select>
          </FormControl>
        </Grid>
      </CardBody>
    </Card>

    <Card {...CARD_PROPS}>
      <CardBody px={5} py={5}>
        <SectionHeader>Email Preferences</SectionHeader>
        <Box>
          <ToggleRow
            label="Email notifications enabled"
            isChecked={settings.emailNotifications !== false}
            onChange={(e) => updateSetting('emailNotifications', e.target.checked)}
          />
        </Box>
      </CardBody>
    </Card>
  </VStack>
);

// ─── DataRetentionTab ────────────────────────────────────────────────────────

const DataRetentionTab = ({
  settings,
  retentionDisplay,
  setRetentionDisplay,
  retentionError,
  setRetentionError,
  pollingDisplay,
  setPollingDisplay,
  pollingError,
  setPollingError,
  updateSetting,
  setIsDirty,
  loadNotifications,
}) => {
  const notify = useNotify();
  const isMounted = useRef(true);

  const [retentionRunning, setRetentionRunning] = useState(false);
  const [systemInfo, setSystemInfo] = useState({ cdrs: 0 });

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  const loadSystemInfo = useCallback(async () => {
    try {
      const cdrCount = await fetchCDRCount();
      if (!isMounted.current) return;
      setSystemInfo({ cdrs: Number(cdrCount || 0) });
    } catch (error) {
      console.error('Failed to load system counts', error);
    }
  }, []);

  useEffect(() => { loadSystemInfo(); }, [loadSystemInfo]);

  const handleRunRetention = async () => {
    setRetentionRunning(true);
    try {
      const result = await runRetentionCleanup();
      if (!isMounted.current) return;
      await loadNotifications(true);
      await loadSystemInfo();
      notify({
        title: 'Retention cleanup completed',
        description: `${result.deletedCount} CDRs removed (policy: ${result.retentionDays} days).`,
        status: 'success',
        duration: 3500,
        isClosable: true,
      });
    } catch (error) {
      if (!isMounted.current) return;
      notify({
        title: 'Retention cleanup failed',
        description: error.message,
        status: 'error',
        duration: 4000,
        isClosable: true,
      });
    } finally {
      if (isMounted.current) setRetentionRunning(false);
    }
  };

  return (
    <VStack spacing={5} align="stretch">
      {/* CDR count stat */}
      <Card {...CARD_PROPS}>
        <CardBody px={5} py={4}>
          <HStack justify="space-between" align="center">
            <Box>
              <Text {...SECTION_LABEL} mb={1}>Total CDR Records</Text>
              <Text fontSize="22px" fontWeight="500" color="gray.800" fontVariantNumeric="tabular-nums">
                {systemInfo.cdrs.toLocaleString()}
              </Text>
            </Box>
            <Button
              size="sm"
              variant="ghost"
              leftIcon={<FiRefreshCw size={12} />}
              onClick={loadSystemInfo}
              color="gray.400"
              fontSize="12px"
              fontWeight="400"
              _hover={{ color: 'gray.700', bg: 'gray.50' }}
            >
              Refresh
            </Button>
          </HStack>
        </CardBody>
      </Card>

      {/* Settings fields */}
      <Card {...CARD_PROPS}>
        <CardBody px={5} py={5}>
          <SectionHeader>Retention Policy</SectionHeader>
          <VStack spacing={5} align="stretch">
            <FormControl isInvalid={Boolean(retentionError)}>
              <FormLabel {...FORM_LABEL_PROPS}>CDR Data Retention (days)</FormLabel>
              <NumberInput
                min={RETENTION_MIN}
                max={RETENTION_MAX}
                value={retentionDisplay}
                keepWithinRange={false}
                clampValueOnBlur={false}
                onChange={(valueString) => {
                  setRetentionDisplay(valueString);
                  setRetentionError('');
                  setIsDirty(true);
                  const parsed = Number(valueString);
                  if (Number.isFinite(parsed)) updateSetting('dataRetentionDays', parsed);
                }}
                onBlur={() => {
                  const result = validateNumericInput(retentionDisplay, 'CDR data retention (days)', RETENTION_MIN, RETENTION_MAX);
                  setRetentionError(result.message);
                  if (result.valid) updateSetting('dataRetentionDays', result.value);
                }}
              >
                <NumberInputField {...INPUT_PROPS} />
              </NumberInput>
              <FormErrorMessage fontSize="11px">{retentionError}</FormErrorMessage>
              <Text fontSize="11px" color="gray.400" mt={1}>
                Min {RETENTION_MIN} days · Max {RETENTION_MAX} days · Default 60 for 2-month retention
              </Text>
            </FormControl>

            <FormControl isInvalid={Boolean(pollingError)}>
              <FormLabel {...FORM_LABEL_PROPS}>Notification Poll Interval (seconds)</FormLabel>
              <NumberInput
                min={POLLING_MIN}
                max={POLLING_MAX}
                value={pollingDisplay}
                keepWithinRange={false}
                clampValueOnBlur={false}
                onChange={(valueString) => {
                  setPollingDisplay(valueString);
                  setPollingError('');
                  setIsDirty(true);
                  const parsed = Number(valueString);
                  if (Number.isFinite(parsed)) updateSetting('notificationPollingSeconds', parsed);
                }}
                onBlur={() => {
                  const result = validateNumericInput(pollingDisplay, 'Notification refresh (seconds)', POLLING_MIN, POLLING_MAX);
                  setPollingError(result.message);
                  if (result.valid) updateSetting('notificationPollingSeconds', result.value);
                }}
              >
                <NumberInputField {...INPUT_PROPS} />
              </NumberInput>
              <FormErrorMessage fontSize="11px">{pollingError}</FormErrorMessage>
              <Text fontSize="11px" color="gray.400" mt={1}>
                Min {POLLING_MIN}s · Max {POLLING_MAX}s · Changes apply on next poll tick
              </Text>
            </FormControl>
          </VStack>
        </CardBody>
      </Card>

      {/* Danger zone */}
      <Card {...CARD_PROPS} borderColor="red.100">
        <CardBody px={5} py={4}>
          <HStack justify="space-between" align="center" flexWrap="wrap" gap={3}>
            <Box>
              <Text fontSize="13px" fontWeight="500" color="gray.700" mb="2px">
                Run Retention Cleanup
              </Text>
              <Text fontSize="11px" color="gray.400">
                Immediately deletes CDRs older than the configured retention window.
              </Text>
            </Box>
            <Button
              size="sm"
              leftIcon={<FiRefreshCw size={12} />}
              onClick={handleRunRetention}
              isLoading={retentionRunning}
              isDisabled={retentionRunning}
              bg="red.50"
              color="red.600"
              borderWidth="0.5px"
              borderColor="red.200"
              fontWeight="500"
              fontSize="12px"
              borderRadius="8px"
              _hover={{ bg: 'red.100' }}
              boxShadow="none"
            >
              Run Now
            </Button>
          </HStack>
        </CardBody>
      </Card>
    </VStack>
  );
};

// ─── CountryCodesTab ──────────────────────────────────────────────────────────

const CountryCodesTab = ({ loadNotifications }) => {
  const notify = useNotify();
  const isMounted = useRef(true);

  const [countryCodeFile, setCountryCodeFile]             = useState(null);
  const [replaceCountryCodes, setReplaceCountryCodes]     = useState(false);
  const [uploadingCountryCodes, setUploadingCountryCodes] = useState(false);
  const [countryCodeInputKey, setCountryCodeInputKey]     = useState(0);
  const [countryCodes, setCountryCodes]                   = useState([]);
  const [loadingCountryCodes, setLoadingCountryCodes]     = useState(false);
  const [countryCodesLoaded, setCountryCodesLoaded]       = useState(false);
  const [countryCodeSearch, setCountryCodeSearch]         = useState('');
  const [debouncedCountryCodeSearch, setDebouncedCountryCodeSearch] = useState('');
  const [countryCodesPage, setCountryCodesPage]           = useState(1);
  const [countryCodesPageSize, setCountryCodesPageSize]   = useState(25);
  const [countryCodesTotal, setCountryCodesTotal]         = useState(0);
  const [singleCountryCode, setSingleCountryCode]         = useState('');
  const [singleCountryName, setSingleCountryName]         = useState('');
  const [addingCountryCode, setAddingCountryCode]         = useState(false);
  const [deletingCountryCode, setDeletingCountryCode]     = useState('');

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedCountryCodeSearch(countryCodeSearch.trim());
      setCountryCodesPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [countryCodeSearch]);

  const handleFetchCountryCodes = useCallback(async () => {
    setLoadingCountryCodes(true);
    try {
      const response = await fetchCountryCodes({
        search: debouncedCountryCodeSearch,
        page: countryCodesPage,
        limit: countryCodesPageSize,
      });
      if (!isMounted.current) return;
      const nextCountryCodes = Array.isArray(response?.countryCodes) ? response.countryCodes : [];
      const nextTotal = Number(response?.total || 0);
      const nextTotalPages = Math.max(1, Number(response?.totalPages || 1));
      const requestedPage = Number(response?.page || countryCodesPage);
      const nextPage = Math.min(Math.max(1, requestedPage), nextTotalPages);
      setCountryCodes(nextCountryCodes);
      setCountryCodesTotal(nextTotal);
      setCountryCodesLoaded(true);
      setCountryCodesPage(nextPage);
    } catch (error) {
      if (!isMounted.current) return;
          notify({ title: 'Failed to load country codes', description: error.message, status: 'error', duration: 4000, isClosable: true });
    } finally {
      if (isMounted.current) setLoadingCountryCodes(false);
    }
  }, [countryCodesPage, countryCodesPageSize, debouncedCountryCodeSearch, notify]);

  useEffect(() => {
    if (!countryCodesLoaded) return;
    handleFetchCountryCodes();
  }, [countryCodesLoaded, handleFetchCountryCodes]);

  const handleUploadCountryCodes = async () => {
    if (!countryCodeFile) {
          notify({ title: 'CSV file required', description: 'Please choose a country code CSV file first.', status: 'warning', duration: 3000, isClosable: true });
      return;
    }
    setUploadingCountryCodes(true);
    try {
      const formData = new FormData();
      formData.append('file', countryCodeFile);
      formData.append('replaceExisting', String(replaceCountryCodes));
      const result = await uploadCountryCodes(formData);
      if (!isMounted.current) return;
      setCountryCodeFile(null);
      setCountryCodeInputKey((prev) => prev + 1);
          notify({ title: 'Country codes uploaded', description: `Uploaded ${result.uploadedCount} record(s).${result.replaceExisting ? ` Replaced ${result.deletedCount} existing record(s).` : ''}`, status: 'success', duration: 4000, isClosable: true });
      await loadNotifications(true);
      if (countryCodesLoaded) await handleFetchCountryCodes();
    } catch (error) {
      if (!isMounted.current) return;
          notify({ title: 'Upload failed', description: error.message, status: 'error', duration: 4000, isClosable: true });
    } finally {
      if (isMounted.current) setUploadingCountryCodes(false);
    }
  };

  const handleAddCountryCode = async () => {
    const code = singleCountryCode.trim();
    const country_name = singleCountryName.trim();
    if (!code || !country_name) {
          notify({ title: 'Fields required', description: 'Please enter both code and country name.', status: 'warning', duration: 3000, isClosable: true });
      return;
    }
    setAddingCountryCode(true);
    try {
      const result = await addCountryCode({ code, country_name });
      if (!isMounted.current) return;
      setSingleCountryCode('');
      setSingleCountryName('');
          notify({ title: result.updated ? 'Country code updated' : 'Country code added', description: `${result.countryCode.code} - ${result.countryCode.country_name}`, status: 'success', duration: 3000, isClosable: true });
      await loadNotifications(true);
      if (countryCodesLoaded) await handleFetchCountryCodes();
    } catch (error) {
      if (!isMounted.current) return;
          notify({ title: 'Failed to save country code', description: error.message, status: 'error', duration: 4000, isClosable: true });
    } finally {
      if (isMounted.current) setAddingCountryCode(false);
    }
  };

  const handleDeleteCountryCode = async (item) => {
    const code = String(item?.code || '').trim();
    if (!code) return;
    const confirmed = window.confirm(`Delete country code ${code} (${item?.country_name || ''})?`);
    if (!confirmed) return;
    setDeletingCountryCode(code);
    try {
      await deleteCountryCode(code);
      if (!isMounted.current) return;
          notify({ title: 'Country code deleted', description: `${code} removed successfully.`, status: 'success', duration: 3000, isClosable: true });
      await loadNotifications(true);
      if (countryCodesLoaded) await handleFetchCountryCodes();
    } catch (error) {
      if (!isMounted.current) return;
          notify({ title: 'Failed to delete country code', description: error.message, status: 'error', duration: 4000, isClosable: true });
    } finally {
      if (isMounted.current) setDeletingCountryCode('');
    }
  };

  const countryCodeColumns = [
    {
      key: 'code',
      header: 'Code',
      width: '120px',
      render: (value) => (
        <Text fontSize="13px" fontWeight="500" color="gray.700" fontVariantNumeric="tabular-nums">
          {value}
        </Text>
      ),
    },
    {
      key: 'country_name',
      header: 'Country Name',
      minWidth: '240px',
      render: (value) => <Text fontSize="13px" color="gray.600">{value}</Text>,
    },
    {
      key: 'action',
      header: '',
      width: '90px',
      render: (_value, item) => (
        <Button
          size="xs"
          bg="red.50"
          color="red.500"
          borderWidth="0.5px"
          borderColor="red.100"
          fontWeight="400"
          fontSize="11px"
          borderRadius="6px"
          boxShadow="none"
          _hover={{ bg: 'red.100' }}
          onClick={() => handleDeleteCountryCode(item)}
          isLoading={deletingCountryCode === String(item.code)}
          isDisabled={Boolean(deletingCountryCode) && deletingCountryCode !== String(item.code)}
        >
          Delete
        </Button>
      ),
    },
  ];

  return (
    <VStack spacing={5} align="stretch">
      {/* Add single */}
      <Card {...CARD_PROPS}>
        <CardBody px={5} py={5}>
          <SectionHeader>Add Single Entry</SectionHeader>
          <Grid templateColumns={{ base: '1fr', md: '1fr 2fr auto' }} gap={3} alignItems="end">
            <FormControl>
              <FormLabel {...FORM_LABEL_PROPS}>Code</FormLabel>
              <Input
                {...INPUT_PROPS}
                placeholder="e.g. 91"
                value={singleCountryCode}
                onChange={(e) => setSingleCountryCode(e.target.value)}
              />
            </FormControl>
            <FormControl>
              <FormLabel {...FORM_LABEL_PROPS}>Country Name</FormLabel>
              <Input
                {...INPUT_PROPS}
                placeholder="e.g. India"
                value={singleCountryName}
                onChange={(e) => setSingleCountryName(e.target.value)}
              />
            </FormControl>
            <Button
              size="sm"
              leftIcon={<FiSave size={12} />}
              onClick={handleAddCountryCode}
              isLoading={addingCountryCode}
              isDisabled={addingCountryCode}
              bg="blue.600"
              color="white"
              borderRadius="8px"
              fontWeight="500"
              fontSize="12px"
              height="34px"
              px={4}
              _hover={{ bg: 'blue.700' }}
              boxShadow="none"
            >
              Save
            </Button>
          </Grid>
        </CardBody>
      </Card>

      {/* CSV upload */}
      <Card {...CARD_PROPS}>
        <CardBody px={5} py={5}>
          <SectionHeader>Bulk Upload via CSV</SectionHeader>
          <Text fontSize="11px" color="gray.400" mb={4}>
            Accepted formats: with header <code>code,country_name</code> or headerless (col 1 = code, col 2 = name).
          </Text>
          <VStack spacing={4} align="stretch">
            <FormControl>
              <FormLabel {...FORM_LABEL_PROPS}>CSV File</FormLabel>
              <Input
                {...INPUT_PROPS}
                key={countryCodeInputKey}
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => setCountryCodeFile(e.target.files?.[0] || null)}
                height="auto"
                py={1}
              />
              {countryCodeFile && (
                <Text fontSize="11px" color="gray.400" mt={1}>
                  Selected: {countryCodeFile.name}
                </Text>
              )}
            </FormControl>

            <HStack justify="space-between" align="center" flexWrap="wrap" gap={3}>
              <HStack spacing={3}>
                <Switch
                  size="sm"
                  colorScheme="gray"
                  isChecked={replaceCountryCodes}
                  onChange={(e) => setReplaceCountryCodes(e.target.checked)}
                  sx={{ '& .chakra-switch__track[data-checked]': { bg: 'gray.800' } }}
                />
                <Text fontSize="12px" color="gray.600">Replace existing entries</Text>
              </HStack>
              <Button
                size="sm"
                leftIcon={<FiUpload size={12} />}
                onClick={handleUploadCountryCodes}
                isLoading={uploadingCountryCodes}
                isDisabled={uploadingCountryCodes || !countryCodeFile}
                bg="blue.600"
                color="white"
                borderRadius="8px"
                fontWeight="500"
                fontSize="12px"
                height="34px"
                px={4}
                _hover={{ bg: 'blue.700' }}
                boxShadow="none"
              >
                Upload
              </Button>
            </HStack>
          </VStack>
        </CardBody>
      </Card>

      {/* Table */}
      <Card {...CARD_PROPS}>
        <CardBody px={5} py={5}>
          <HStack justify="space-between" align="center" mb={3}>
            <SectionHeader>Country Code Table</SectionHeader>
            <Button
              size="sm"
              variant="ghost"
              leftIcon={<FiRefreshCw size={12} />}
              onClick={handleFetchCountryCodes}
              isLoading={loadingCountryCodes}
              isDisabled={loadingCountryCodes}
              fontSize="14px"
              color="gray.400"
              fontWeight="600"
              _hover={{ color: 'gray.700', bg: 'gray.50' }}
            >
              {countryCodesLoaded ? 'Refresh' : 'Load'}
            </Button>
          </HStack>

          {countryCodesLoaded ? (
            <>
              <Input
                {...INPUT_PROPS}
                mb={3}
                placeholder="Search by code or country name..."
                value={countryCodeSearch}
                onChange={(e) => setCountryCodeSearch(e.target.value)}
              />
              <Text fontSize="11px" color="gray.400" mb={3}>
                {countryCodes.length} of {countryCodesTotal} records
              </Text>
              <DataTable
                columns={countryCodeColumns}
                data={countryCodes}
                actions={false}
                compact
                serverPagination
                page={countryCodesPage}
                pageSize={countryCodesPageSize}
                total={countryCodesTotal}
                onPageChange={(p) => setCountryCodesPage(p)}
                onPageSizeChange={(s) => { setCountryCodesPageSize(s); setCountryCodesPage(1); }}
                isPaginationDisabled={loadingCountryCodes}
                height="320px"
              />
            </>
          ) : (
            <Box py={8} textAlign="center">
              <Text fontSize="13px" color="gray.400">
                Click Load to fetch country code records.
              </Text>
            </Box>
          )}
        </CardBody>
      </Card>
    </VStack>
  );
};

// ─── NotificationsTab ─────────────────────────────────────────────────────────

const NotificationsTab = ({ settings, updateSetting }) => {
  const notify = useNotify();
  const isMounted = useRef(true);

  const [notifications, setNotifications]               = useState([]);
  const [unreadCount, setUnreadCount]                   = useState(0);
  const [loadingNotifications, setLoadingNotifications] = useState(false);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  const loadNotifications = useCallback(async (silent = false) => {
    if (!silent && isMounted.current) setLoadingNotifications(true);
    try {
      const data = await fetchNotifications({ limit: 20 });
      if (!isMounted.current) return;
      setNotifications(data.notifications || []);
      setUnreadCount(Number(data.unreadCount || 0));
    } catch (error) {
      console.error('Failed to load notifications', error);
    } finally {
      if (!silent && isMounted.current) setLoadingNotifications(false);
    }
  }, []);

  useEffect(() => { loadNotifications(); }, [loadNotifications]);

  const pollingMs = useMemo(() => {
    const seconds = Number(settings.notificationPollingSeconds) || 10;
    return Math.max(5, Math.min(3600, seconds)) * 1000;
  }, [settings.notificationPollingSeconds]);

  useEffect(() => {
    const timer = setInterval(() => loadNotifications(true), pollingMs);
    return () => clearInterval(timer);
  }, [loadNotifications, pollingMs]);

  const handleMarkRead = async (id) => {
    try {
      await markNotificationRead(id);
      if (!isMounted.current) return;
      await loadNotifications();
    } catch (error) {
      notify({ title: 'Failed to update notification', description: error.message, status: 'error' });
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
      if (!isMounted.current) return;
      await loadNotifications();
    } catch (error) {
      notify({ title: 'Failed to mark all read', description: error.message, status: 'error' });
    }
  };

  const handleCreateTestNotification = async () => {
    try {
      await createTestNotification({
        title: 'Realtime notification check',
        message: 'If you see this in the sidebar bell immediately, realtime polling is working.',
        type: 'info',
      });
      if (!isMounted.current) return;
      await loadNotifications();
      notify({ title: 'Test notification sent', status: 'success', duration: 2000 });
    } catch (error) {
      notify({ title: 'Failed to create test notification', description: error.message, status: 'error' });
    }
  };

  const NOTIFY_TOGGLES = [
    { key: 'notifyInvoiceGenerated', label: 'Invoice Generated' },
    { key: 'notifyPaymentDue',       label: 'Payment Due' },
    { key: 'notifyPaymentReceived',  label: 'Payment Received' },
    { key: 'notifyDisputes',         label: 'Dispute Alerts' },
    { key: 'notifyErrors',           label: 'System Errors' },
  ];

  return (
    <VStack spacing={5} align="stretch">
      {/* Notification event toggles */}
      <Card {...CARD_PROPS}>
        <CardBody px={5} py={5}>
          <SectionHeader>Event Triggers</SectionHeader>
          <Box>
            {NOTIFY_TOGGLES.map(({ key, label }) => (
              <ToggleRow
                key={key}
                label={label}
                isChecked={settings[key] !== false}
                onChange={(e) => updateSetting(key, e.target.checked)}
              />
            ))}
          </Box>
        </CardBody>
      </Card>

      {/* Live inbox */}
      <Card {...CARD_PROPS}>
        <CardBody px={5} py={5}>
          <HStack justify="space-between" align="center" mb={4} flexWrap="wrap" gap={3}>
            <Box>
              <SectionHeader>Live Inbox</SectionHeader>
              {unreadCount > 0 && (
                <Text fontSize="11px" color="gray.400" mt={1}>
                  {unreadCount} unread
                </Text>
              )}
            </Box>
            <HStack spacing={2}>
              <Button
                size="sm"
                onClick={handleCreateTestNotification}
                fontSize="12px"
                fontWeight="400"
                color="gray.500"
                borderWidth="0.5px"
                borderColor="gray.200"
                bg="white"
                borderRadius="8px"
                height="30px"
                px={3}
                _hover={{ bg: 'gray.50' }}
                boxShadow="none"
              >
                Send test
              </Button>
              {unreadCount > 0 && (
                <Button
                  size="sm"
                  onClick={handleMarkAllRead}
                  fontSize="12px"
                  fontWeight="400"
                  color="gray.500"
                  variant="ghost"
                  height="30px"
                  px={3}
                  _hover={{ bg: 'gray.50' }}
                >
                  Mark all read
                </Button>
              )}
            </HStack>
          </HStack>

          {loadingNotifications ? (
            <Box py={8} textAlign="center">
              <Spinner size="sm" color="gray.300" />
            </Box>
          ) : (
            <VStack align="stretch" spacing={2} maxH="360px" overflowY="auto">
              {notifications.length === 0 && (
                <Box py={8} textAlign="center">
                  <Text fontSize="13px" color="gray.400">No notifications yet.</Text>
                </Box>
              )}
              {notifications.map((item) => (
                <Box
                  key={item.id}
                  px={4}
                  py={3}
                  borderWidth="0.5px"
                  borderRadius="8px"
                  bg={item.isRead ? 'white' : 'gray.50'}
                  borderColor={item.isRead ? 'gray.100' : 'gray.200'}
                >
                  <HStack justify="space-between" align="start" gap={3}>
                    <Box flex={1} minW={0}>
                      <HStack spacing={2} mb={1}>
                        {!item.isRead && (
                          <Box w="5px" h="5px" borderRadius="full" bg="gray.700" flexShrink={0} mt="1px" />
                        )}
                        <Text fontSize="13px" fontWeight="500" color="gray.800" noOfLines={1}>
                          {item.title}
                        </Text>
                      </HStack>
                      <Text fontSize="12px" color="gray.500" pl={!item.isRead ? '13px' : '0'}>
                        {item.message}
                      </Text>
                      <Text fontSize="11px" color="gray.400" mt={1} pl={!item.isRead ? '13px' : '0'}>
                        {formatNotificationTime(item.createdAt)}
                      </Text>
                    </Box>
                    {!item.isRead && (
                      <Button
                        size="xs"
                        flexShrink={0}
                        onClick={() => handleMarkRead(item.id)}
                        fontSize="11px"
                        fontWeight="400"
                        color="gray.400"
                        variant="ghost"
                        height="24px"
                        px={2}
                        _hover={{ color: 'gray.700', bg: 'gray.100' }}
                      >
                        Read
                      </Button>
                    )}
                  </HStack>
                </Box>
              ))}
            </VStack>
          )}
        </CardBody>
      </Card>
    </VStack>
  );
};

// ─── Settings (root) ──────────────────────────────────────────────────────────

const Settings = () => {
  const notify = useNotify();

  const [settings, setSettings]   = useState(DEFAULT_SETTINGS);
  const [saving, setSaving]       = useState(false);
  const [loading, setLoading]     = useState(true);
  const [isDirty, setIsDirty]     = useState(false);
  const [activeTab, setActiveTab] = useState('general');
  // Track which tabs have been visited (for lazy mounting)
  const [visitedTabs, setVisitedTabs] = useState(new Set(['general']));

  const [retentionDisplay, setRetentionDisplay] = useState(String(DEFAULT_SETTINGS.dataRetentionDays));
  const [pollingDisplay, setPollingDisplay]     = useState(String(DEFAULT_SETTINGS.notificationPollingSeconds));
  const [retentionError, setRetentionError]     = useState('');
  const [pollingError, setPollingError]         = useState('');

  const savedSettingsRef = useRef(DEFAULT_SETTINGS);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  const applySettings = useCallback((merged) => {
    setSettings(merged);
    savedSettingsRef.current = merged;
    setIsDirty(false);
    setRetentionDisplay(String(merged.dataRetentionDays ?? DEFAULT_SETTINGS.dataRetentionDays));
    setPollingDisplay(String(merged.notificationPollingSeconds ?? DEFAULT_SETTINGS.notificationPollingSeconds));
  }, []);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const serverSettings = await getGlobalSettings();
      if (!isMounted.current) return;
      const merged = { ...DEFAULT_SETTINGS, ...normalizeSettingsShape(serverSettings) };
      applySettings(merged);
    } catch (error) {
      if (!isMounted.current) return;
      notify({ title: 'Failed to load settings', description: error.message, status: 'error', duration: 4000, isClosable: true });
    } finally {
      if (isMounted.current) setLoading(false);
    }
  }, [notify, applySettings]);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (isDirty) { e.preventDefault(); e.returnValue = ''; }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  const updateSetting = useCallback((key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setIsDirty(true);
  }, []);

  const handleTabChange = (id) => {
    setActiveTab(id);
    setVisitedTabs((prev) => new Set([...prev, id]));
  };

  const handleSave = async () => {
    const retentionValidation = validateNumericInput(retentionDisplay, 'CDR data retention (days)', RETENTION_MIN, RETENTION_MAX);
    const pollingValidation   = validateNumericInput(pollingDisplay, 'Notification refresh (seconds)', POLLING_MIN, POLLING_MAX);
    setRetentionError(retentionValidation.message);
    setPollingError(pollingValidation.message);
    if (!retentionValidation.valid || !pollingValidation.valid) {
      notify({ title: 'Fix validation errors before saving', status: 'warning', duration: 3500, isClosable: true });
      return;
    }
    const settingsToSave = { ...settings, dataRetentionDays: retentionValidation.value, notificationPollingSeconds: pollingValidation.value };
    setSaving(true);
    try {
      const payload = { ...DEFAULT_SETTINGS, ...normalizeSettingsShape(settingsToSave) };
      const saved   = await updateGlobalSettings(payload);
      if (!isMounted.current) return;
      const merged  = { ...DEFAULT_SETTINGS, ...normalizeSettingsShape(saved) };
      applySettings(merged);
      window.dispatchEvent(new CustomEvent('settings-updated', { detail: saved }));
      notify({ title: 'Settings saved', status: 'success', duration: 3000, isClosable: true });
    } catch (error) {
      if (!isMounted.current) return;
      notify({ title: 'Save failed', description: error.message, status: 'error', duration: 4000, isClosable: true });
    } finally {
      if (isMounted.current) setSaving(false);
    }
  };

  const noopLoadNotifications = useCallback(async () => {}, []);

  if (loading) {
    return (
      <Box py={20} textAlign="center">
        <Spinner size="md" color="gray.300" thickness="2px" />
        <Text mt={3} fontSize="13px" color="gray.400">Loading settings…</Text>
      </Box>
    );
  }

  return (
    <VStack spacing={0} align="stretch">
      <PageNavBar
        title="Settings"
        description="Project-wide controls for CDR retention, notifications, and system defaults."
        mb={5}
        rightContent={(
          <HStack spacing={3}>
            {isDirty && (
              <Text fontSize="12px" color="orange.500" fontWeight="500">
                Unsaved changes
              </Text>
            )}
            <Button
              size="sm"
              leftIcon={<FiSave size={12} />}
              onClick={handleSave}
              isLoading={saving}
              isDisabled={saving}
              bg="blue.500"
              color="white"
              borderRadius="8px"
              fontWeight="500"
              fontSize="13px"
              height="34px"
              px={4}
              _hover={{ bg: 'blue.700' }}
              boxShadow="none"
            >
              Save Settings
            </Button>
          </HStack>
        )}
      />

      <TabNav active={activeTab} onChange={handleTabChange} />

      <Box>
        {/* General — always mounted */}
        <Box display={activeTab === 'general' ? 'block' : 'none'}>
          <GeneralTab settings={settings} updateSetting={updateSetting} />
        </Box>

        {/* Data Retention — lazy mount on first visit */}
        {visitedTabs.has('retention') && (
          <Box display={activeTab === 'retention' ? 'block' : 'none'}>
            <DataRetentionTab
              settings={settings}
              retentionDisplay={retentionDisplay}
              setRetentionDisplay={setRetentionDisplay}
              retentionError={retentionError}
              setRetentionError={setRetentionError}
              pollingDisplay={pollingDisplay}
              setPollingDisplay={setPollingDisplay}
              pollingError={pollingError}
              setPollingError={setPollingError}
              updateSetting={updateSetting}
              setIsDirty={setIsDirty}
              loadNotifications={noopLoadNotifications}
            />
          </Box>
        )}

        {/* Country Codes — lazy mount on first visit */}
        {visitedTabs.has('codes') && (
          <Box display={activeTab === 'codes' ? 'block' : 'none'}>
            <CountryCodesTab loadNotifications={noopLoadNotifications} />
          </Box>
        )}

        {/* Notifications — lazy mount on first visit */}
        {visitedTabs.has('notifs') && (
          <Box display={activeTab === 'notifs' ? 'block' : 'none'}>
            <NotificationsTab settings={settings} updateSetting={updateSetting} />
          </Box>
        )}
      </Box>
    </VStack>
  );
};

export default Settings;