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
  Heading,
  HStack,
  NumberInput,
  NumberInputField,
  Spinner,
  Stack,
  Switch,
  Table,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
  TableContainer,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Text,
  useToast,
  VStack,
} from '@chakra-ui/react';
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

const normalizeSettingsShape = (raw = {}) => {
  const source = raw && typeof raw === 'object' ? raw : {};
  const mapped = {
    ...source,
    dataRetentionDays: source.dataRetentionDays ?? source.dataretentiondays,
    notificationPollingSeconds:
      source.notificationPollingSeconds ?? source.notificationpollingseconds,
  };

  return SETTINGS_KEYS.reduce((acc, key) => {
    if (mapped[key] !== undefined) {
      acc[key] = mapped[key];
    }
    return acc;
  }, {});
};

const RETENTION_MIN = 2;
const RETENTION_MAX = 90;
const POLLING_MIN = 5;
const POLLING_MAX = 3600;

const validateNumericInput = (rawValue, label, min, max) => {
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed)) {
    return { valid: false, value: null, message: `${label} must be a number.` };
  }
  if (parsed < min || parsed > max) {
    return { valid: false, value: null, message: `${label} must be between ${min} and ${max}.` };
  }
  return { valid: true, value: parsed, message: '' };
};

// ─────────────────────────────────────────────────────────────────────────────
// DataRetentionTab — mounts only when the Data Retention tab is first visited
// (isLazy on the parent <Tabs> defers the mount).  System info is fetched here
// so it doesn't fire on the initial page load.
// ─────────────────────────────────────────────────────────────────────────────
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
  const toast = useToast();
  const isMounted = useRef(true);

  const [retentionRunning, setRetentionRunning] = useState(false);
  const [systemInfo, setSystemInfo] = useState({ cdrs: 0 });

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  // Fetch system counts when this tab first mounts
  const loadSystemInfo = useCallback(async () => {
    try {
      const cdrCount = await fetchCDRCount();
      if (!isMounted.current) return;
      setSystemInfo({
        cdrs: Number(cdrCount || 0),
      });
    } catch (error) {
      console.error('Failed to load system counts', error);
    }
  }, []);

  useEffect(() => {
    loadSystemInfo();
  }, [loadSystemInfo]);

  const handleRunRetention = async () => {
    setRetentionRunning(true);
    try {
      const result = await runRetentionCleanup();
      if (!isMounted.current) return;
      await loadNotifications(true);
      await loadSystemInfo();
      toast({
        title: 'Retention cleanup completed',
        description: `${result.deletedCount} CDRs removed (policy: ${result.retentionDays} days).`,
        status: 'success',
        duration: 3500,
        isClosable: true,
      });
    } catch (error) {
      if (!isMounted.current) return;
      toast({
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
    <Card>
      <CardBody>
        <VStack spacing={5} align="stretch">
          <FormControl isInvalid={Boolean(retentionError)}>
            <FormLabel>CDR Data Retention (days)</FormLabel>
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
                if (Number.isFinite(parsed)) {
                  updateSetting('dataRetentionDays', parsed);
                }
              }}
              onBlur={() => {
                const result = validateNumericInput(
                  retentionDisplay,
                  'CDR data retention (days)',
                  RETENTION_MIN,
                  RETENTION_MAX,
                );
                setRetentionError(result.message);
                if (result.valid) {
                  updateSetting('dataRetentionDays', result.value);
                }
              }}
            >
              <NumberInputField />
            </NumberInput>
            <FormErrorMessage>{retentionError}</FormErrorMessage>
            <Text fontSize="sm" color="gray.600" mt={1}>
              Set to <b>60</b> for 2-month retention. Min {RETENTION_MIN}, max {RETENTION_MAX} days.
            </Text>
          </FormControl>

          <FormControl isInvalid={Boolean(pollingError)}>
            <FormLabel>Realtime Notification Refresh (seconds)</FormLabel>
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
                if (Number.isFinite(parsed)) {
                  updateSetting('notificationPollingSeconds', parsed);
                }
              }}
              onBlur={() => {
                const result = validateNumericInput(
                  pollingDisplay,
                  'Notification refresh (seconds)',
                  POLLING_MIN,
                  POLLING_MAX,
                );
                setPollingError(result.message);
                if (result.valid) {
                  updateSetting('notificationPollingSeconds', result.value);
                }
              }}
            >
              <NumberInputField />
            </NumberInput>
            <FormErrorMessage>{pollingError}</FormErrorMessage>
            <Text fontSize="sm" color="gray.600" mt={1}>
              Min {POLLING_MIN} s, max {POLLING_MAX} s. Changes apply on the next poll tick — no reload needed.
            </Text>
          </FormControl>

          <HStack flexWrap="wrap" spacing={3}>
            <Button
              leftIcon={<FiRefreshCw />}
              onClick={handleRunRetention}
              isLoading={retentionRunning}
              isDisabled={retentionRunning}
              colorScheme="red"
              variant="outline"
              size="sm"
            >
              Run Retention Cleanup Now
            </Button>
            <Button
              leftIcon={<FiRefreshCw />}
              onClick={loadSystemInfo}
              variant="ghost"
            >
              Refresh Counts
            </Button>
          </HStack>

          <Grid templateColumns={{ base: '1fr', md: '1fr' }} gap={3}>
            <Badge maxW={"200px"} p={3} borderRadius="md" fontSize={"15px"}  colorScheme="gray" justifyContent={"center"}>
              CDRs: {systemInfo.cdrs.toLocaleString()}
            </Badge>
          </Grid>
        </VStack>
      </CardBody>
    </Card>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// CountryCodesTab — mounts only when the Country Codes tab is first visited.
// ─────────────────────────────────────────────────────────────────────────────
const CountryCodesTab = ({ loadNotifications }) => {
  const toast = useToast();
  const isMounted = useRef(true);

  const [countryCodeFile, setCountryCodeFile]             = useState(null);
  const [replaceCountryCodes, setReplaceCountryCodes]     = useState(false);
  const [uploadingCountryCodes, setUploadingCountryCodes] = useState(false);
  const [countryCodeInputKey, setCountryCodeInputKey]     = useState(0);
  const [countryCodes, setCountryCodes]                   = useState([]);
  const [loadingCountryCodes, setLoadingCountryCodes]     = useState(false);
  const [countryCodesLoaded, setCountryCodesLoaded]       = useState(false);
  const [countryCodeSearch, setCountryCodeSearch]         = useState('');
  const [singleCountryCode, setSingleCountryCode]         = useState('');
  const [singleCountryName, setSingleCountryName]         = useState('');
  const [addingCountryCode, setAddingCountryCode]         = useState(false);
  const [deletingCountryCode, setDeletingCountryCode]     = useState('');

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  const filteredCountryCodes = useMemo(() => {
    const query = countryCodeSearch.trim().toLowerCase();
    if (!query) return countryCodes;
    return countryCodes.filter((item) => {
      const code        = String(item?.code        || '').toLowerCase();
      const countryName = String(item?.country_name || '').toLowerCase();
      return code.includes(query) || countryName.includes(query);
    });
  }, [countryCodes, countryCodeSearch]);

  const handleFetchCountryCodes = useCallback(async () => {
    setLoadingCountryCodes(true);
    try {
      const response = await fetchCountryCodes();
      if (!isMounted.current) return;
      setCountryCodes(Array.isArray(response?.countryCodes) ? response.countryCodes : []);
      setCountryCodesLoaded(true);
    } catch (error) {
      if (!isMounted.current) return;
      toast({
        title: 'Failed to load country codes',
        description: error.message,
        status: 'error',
        duration: 4000,
        isClosable: true,
      });
    } finally {
      if (isMounted.current) setLoadingCountryCodes(false);
    }
  }, [toast]);

  const handleUploadCountryCodes = async () => {
    if (!countryCodeFile) {
      toast({
        title: 'CSV file required',
        description: 'Please choose a country code CSV file first.',
        status: 'warning',
        duration: 3000,
        isClosable: true,
      });
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
      toast({
        title: 'Country codes uploaded',
        description: `Uploaded ${result.uploadedCount} record(s).${
          result.replaceExisting ? ` Replaced ${result.deletedCount} existing record(s).` : ''
        }`,
        status: 'success',
        duration: 4000,
        isClosable: true,
      });
      await loadNotifications(true);
      if (countryCodesLoaded) await handleFetchCountryCodes();
    } catch (error) {
      if (!isMounted.current) return;
      toast({
        title: 'Upload failed',
        description: error.message,
        status: 'error',
        duration: 4000,
        isClosable: true,
      });
    } finally {
      if (isMounted.current) setUploadingCountryCodes(false);
    }
  };

  const handleAddCountryCode = async () => {
    const code         = singleCountryCode.trim();
    const country_name = singleCountryName.trim();
    if (!code || !country_name) {
      toast({
        title: 'Fields required',
        description: 'Please enter both code and country name.',
        status: 'warning',
        duration: 3000,
        isClosable: true,
      });
      return;
    }
    setAddingCountryCode(true);
    try {
      const result = await addCountryCode({ code, country_name });
      if (!isMounted.current) return;
      setSingleCountryCode('');
      setSingleCountryName('');
      toast({
        title: result.updated ? 'Country code updated' : 'Country code added',
        description: `${result.countryCode.code} - ${result.countryCode.country_name}`,
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      await loadNotifications(true);
      if (countryCodesLoaded) await handleFetchCountryCodes();
    } catch (error) {
      if (!isMounted.current) return;
      toast({
        title: 'Failed to save country code',
        description: error.message,
        status: 'error',
        duration: 4000,
        isClosable: true,
      });
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
      setCountryCodes((prev) => prev.filter((row) => String(row?.code || '') !== code));
      toast({
        title: 'Country code deleted',
        description: `${code} removed successfully.`,
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      await loadNotifications(true);
    } catch (error) {
      if (!isMounted.current) return;
      toast({
        title: 'Failed to delete country code',
        description: error.message,
        status: 'error',
        duration: 4000,
        isClosable: true,
      });
    } finally {
      if (isMounted.current) setDeletingCountryCode('');
    }
  };

  return (
    <Card>
      <CardBody>
        <VStack spacing={4} align="stretch">
          
          <Text fontSize="sm" color="gray.600">
            Supported formats: with header (<code>code,country_name</code>) or without header (first column code, second column country name).
          </Text>

          <Box p={4} borderWidth="1px" borderRadius="md" bg="gray.50">
            <Text fontWeight="600" mb={3}>Add Single Country Code</Text>
            <Grid templateColumns={{ base: '1fr', md: '1fr 2fr auto' }} gap={4} alignItems={"center"}>
              <FormControl>
                <FormLabel>Code</FormLabel>
                <Input
                  placeholder="e.g. 91"
                  value={singleCountryCode}
                  onChange={(e) => setSingleCountryCode(e.target.value)}
                />
              </FormControl>
              <FormControl>
                <FormLabel>Country Name</FormLabel>
                <Input
                  placeholder="e.g. India"
                  value={singleCountryName}
                  onChange={(e) => setSingleCountryName(e.target.value)}
                />
              </FormControl>
              <FormControl alignSelf="end">
                <Button
                  colorScheme="teal"
                  onClick={handleAddCountryCode}
                  isLoading={addingCountryCode}
                  isDisabled={addingCountryCode}
                  w={{ base: '100%', md: 'auto' }}
                  leftIcon={<FiSave />}
                  size={"sm"}
                >
                  Save Code
                </Button>
              </FormControl>
            </Grid>
          </Box>

          <FormControl>
            <FormLabel>Country Code CSV</FormLabel>
            <Input
              key={countryCodeInputKey}
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => setCountryCodeFile(e.target.files?.[0] || null)}
            />
          </FormControl>

          <FormControl display="flex" alignItems="center">
            <FormLabel mb={0}>Replace existing country codes</FormLabel>
            <Switch
              colorScheme="green"
              isChecked={replaceCountryCodes}
              onChange={(e) => setReplaceCountryCodes(e.target.checked)}
            />
          </FormControl>

          <HStack justify="flex-start" flexWrap="wrap" spacing={3}>
            <Button
              leftIcon={<FiUpload />}
              size="sm"
              colorScheme="blue"
              onClick={handleUploadCountryCodes}
              isLoading={uploadingCountryCodes}
              isDisabled={uploadingCountryCodes || !countryCodeFile}
            >
              Upload Country Codes
            </Button>
            {countryCodeFile && (
              <Text fontSize="sm" color="gray.600">
                Selected: {countryCodeFile.name}
              </Text>
            )}
          </HStack>

          <Divider />

          <HStack justify="space-between" align="center" flexWrap="wrap" spacing={3}>
            <Text fontWeight="600">View Country Code Table</Text>
            <Button
              colorScheme="teal"
              variant="outline"
              size="sm"
              onClick={handleFetchCountryCodes}
              isLoading={loadingCountryCodes}
              isDisabled={loadingCountryCodes}
            >
              {countryCodesLoaded ? 'Refresh Country Codes' : 'Show Country Codes'}
            </Button>
          </HStack>

          {countryCodesLoaded && (
            <Box borderWidth="1px" borderRadius="md" overflow="hidden">
              <Box p={3} flexDirection="row" borderBottomWidth="1px" bg="gray.50">
                <Input
                  bg="gray.200"
                  placeholder="Search by code or country name"
                  value={countryCodeSearch}
                  onChange={(e) => setCountryCodeSearch(e.target.value)}
                />
                <Text mt={2} fontSize="sm" color="gray.600">
                  Showing {filteredCountryCodes.length} of {countryCodes.length} record(s)
                </Text>
              </Box>
              <TableContainer maxH="300px" overflowY="auto" maxW="600px" mt={3}>
                <Table size="sm" variant="simple" colorScheme="gray">
                  <Thead position="sticky" top={0} bg="gray.200" zIndex={1}>
                    <Tr>
                      <Th color="gray.700">Code</Th>
                      <Th color="gray.700">Country</Th>
                      <Th color="gray.700">Action</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {filteredCountryCodes.length === 0 ? (
                      <Tr>
                        <Td colSpan={3} textAlign="center" color="gray.500">
                          {countryCodes.length === 0
                            ? 'No country codes found.'
                            : 'No matching country codes found.'}
                        </Td>
                      </Tr>
                    ) : (
                      filteredCountryCodes.map((item, idx) => (
                        <Tr key={`${item.code}-${item.country_name}-${idx}`}>
                          <Td>{item.code}</Td>
                          <Td>{item.country_name}</Td>
                          <Td>
                            <Button
                              size="xs"
                              colorScheme="red"
                              variant="ghost"
                              onClick={() => handleDeleteCountryCode(item)}
                              isLoading={deletingCountryCode === String(item.code)}
                              isDisabled={Boolean(deletingCountryCode) && deletingCountryCode !== String(item.code)}
                            >
                              Delete
                            </Button>
                          </Td>
                        </Tr>
                      ))
                    )}
                  </Tbody>
                </Table>
              </TableContainer>
            </Box>
          )}
        </VStack>
      </CardBody>
    </Card>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// NotificationsTab — mounts only when the Notifications tab is first visited.
// Owns its own fetch + polling so the top-level component no longer needs to
// pre-fetch notifications on mount.
// ─────────────────────────────────────────────────────────────────────────────
const NotificationsTab = ({ settings, updateSetting }) => {
  const toast = useToast();
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

  // Initial fetch when this tab first mounts
  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const pollingMs = useMemo(() => {
    const seconds = Number(settings.notificationPollingSeconds) || 10;
    return Math.max(5, Math.min(3600, seconds)) * 1000;
  }, [settings.notificationPollingSeconds]);

  // Polling — scoped to this tab so it only runs while the tab is mounted.
  useEffect(() => {
    const timer = setInterval(() => {
      loadNotifications(true);
    }, pollingMs);
    return () => clearInterval(timer);
  }, [loadNotifications, pollingMs]);

  const handleMarkRead = async (id) => {
    try {
      await markNotificationRead(id);
      if (!isMounted.current) return;
      await loadNotifications();
    } catch (error) {
      toast({ title: 'Failed to update notification', description: error.message, status: 'error' });
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
      if (!isMounted.current) return;
      await loadNotifications();
    } catch (error) {
      toast({ title: 'Failed to mark all read', description: error.message, status: 'error' });
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
      toast({ title: 'Test notification created', status: 'success', duration: 2000 });
    } catch (error) {
      toast({ title: 'Failed to create test notification', description: error.message, status: 'error' });
    }
  };

  return (
    <Card>
      <CardBody>
        <VStack spacing={4} align="stretch">
          <Grid templateColumns={{ base: '1fr', md: '1fr 1fr 1fr 1fr 1fr' }} gap={3}>
            <FormControl display="flex" alignItems="center">
              <FormLabel mb={0}>Invoice Generated</FormLabel>
              <Switch
                colorScheme="green"
                isChecked={settings.notifyInvoiceGenerated !== false}
                onChange={(e) => updateSetting('notifyInvoiceGenerated', e.target.checked)}
              />
            </FormControl>
            <FormControl display="flex" alignItems="center">
              <FormLabel mb={0}>Payment Due</FormLabel>
              <Switch
                colorScheme="green"
                isChecked={settings.notifyPaymentDue !== false}
                onChange={(e) => updateSetting('notifyPaymentDue', e.target.checked)}
              />
            </FormControl>
            <FormControl display="flex" alignItems="center">
              <FormLabel mb={0}>Payment Received</FormLabel>
              <Switch
                colorScheme="green"
                isChecked={settings.notifyPaymentReceived !== false}
                onChange={(e) => updateSetting('notifyPaymentReceived', e.target.checked)}
              />
            </FormControl>
            <FormControl display="flex" alignItems="center">
              <FormLabel mb={0}>Dispute Alerts</FormLabel>
              <Switch
                colorScheme="green"
                isChecked={settings.notifyDisputes !== false}
                onChange={(e) => updateSetting('notifyDisputes', e.target.checked)}
              />
            </FormControl>
            <FormControl display="flex" alignItems="center">
              <FormLabel mb={0}>System Errors</FormLabel>
              <Switch
                colorScheme="green"
                isChecked={settings.notifyErrors !== false}
                onChange={(e) => updateSetting('notifyErrors', e.target.checked)}
              />
            </FormControl>
          </Grid>

          <Divider />

          <HStack justify="space-between" flexWrap="wrap" spacing={3}>
            <Heading size="sm">Live Notification Box</Heading>
            <HStack spacing={2}>
              <Button size="sm" onClick={handleCreateTestNotification} variant="outline">
                Send Test Notification
              </Button>
              <Button
                size="sm"
                onClick={handleMarkAllRead}
                variant="ghost"
                isDisabled={unreadCount === 0}
              >
                Mark All Read
              </Button>
            </HStack>
          </HStack>

          {loadingNotifications ? (
            <Spinner size="sm" />
          ) : (
            <VStack align="stretch" spacing={2} maxH="340px" overflowY="auto">
              {notifications.length === 0 && (
                <Text color="gray.500">No notifications yet.</Text>
              )}
              {notifications.map((item) => (
                <Box
                  key={item.id}
                  p={3}
                  borderWidth="1px"
                  borderRadius="md"
                  bg={item.isRead ? 'gray.50' : 'blue.50'}
                >
                  <HStack justify="space-between" align="start">
                    <Box flex={1} minW={0}>
                      <Text fontWeight="600" noOfLines={1}>{item.title}</Text>
                      <Text fontSize="sm" color="gray.700">{item.message}</Text>
                      <Text fontSize="xs" color="gray.500" mt={1}>
                        {formatNotificationTime(item.createdAt)}
                      </Text>
                    </Box>
                    {!item.isRead && (
                      <Button size="xs" flexShrink={0} onClick={() => handleMarkRead(item.id)}>
                        Mark Read
                      </Button>
                    )}
                  </HStack>
                </Box>
              ))}
            </VStack>
          )}

          <Text fontSize="sm" color="gray.600">
            Unread notifications: <b>{unreadCount}</b>
          </Text>
        </VStack>
      </CardBody>
    </Card>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Settings (root) — now only fetches settings on mount.
// System info, country codes, and notifications are deferred to their tabs.
// ─────────────────────────────────────────────────────────────────────────────
const Settings = () => {
  const toast = useToast();

  const [settings, setSettings]   = useState(DEFAULT_SETTINGS);
  const [saving, setSaving]       = useState(false);
  const [loading, setLoading]     = useState(true);
  const [isDirty, setIsDirty]     = useState(false);

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
      toast({
        title: 'Failed to load settings',
        description: error.message,
        status: 'error',
        duration: 4000,
        isClosable: true,
      });
    } finally {
      if (isMounted.current) setLoading(false);
    }
  }, [toast, applySettings]);

  // Only load settings on mount — everything else is deferred to its tab
  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

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

  const handleSave = async () => {
    const retentionValidation = validateNumericInput(
      retentionDisplay,
      'CDR data retention (days)',
      RETENTION_MIN,
      RETENTION_MAX,
    );
    const pollingValidation = validateNumericInput(
      pollingDisplay,
      'Notification refresh (seconds)',
      POLLING_MIN,
      POLLING_MAX,
    );

    setRetentionError(retentionValidation.message);
    setPollingError(pollingValidation.message);

    if (!retentionValidation.valid || !pollingValidation.valid) {
      toast({
        title: 'Please fix validation errors',
        description: 'Settings were not saved because one or more values are out of range.',
        status: 'warning',
        duration: 3500,
        isClosable: true,
      });
      return;
    }

    const settingsToSave = {
      ...settings,
      dataRetentionDays: retentionValidation.value,
      notificationPollingSeconds: pollingValidation.value,
    };

    setSaving(true);
    try {
      const payload = {
        ...DEFAULT_SETTINGS,
        ...normalizeSettingsShape(settingsToSave),
      };

      const saved  = await updateGlobalSettings(payload);
      if (!isMounted.current) return;
      const merged = { ...DEFAULT_SETTINGS, ...normalizeSettingsShape(saved) };
      applySettings(merged);
      window.dispatchEvent(new CustomEvent('settings-updated', { detail: saved }));
      toast({
        title: 'Settings saved',
        description: 'Global settings were updated and applied project-wide.',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      if (!isMounted.current) return;
      toast({
        title: 'Save failed',
        description: error.message,
        status: 'error',
        duration: 4000,
        isClosable: true,
      });
    } finally {
      if (isMounted.current) setSaving(false);
    }
  };

  // A lightweight loadNotifications passed to child tabs that need to trigger
  // a silent refresh after mutations (upload, add, delete, retention cleanup).
  // It does nothing at the root level — the NotificationsTab manages its own
  // state. We keep a ref to the tab's loader via a callback ref pattern, but
  // the simplest approach is to just re-export a no-op and let each tab manage
  // its own refresh independently (which they already do via their own calls).
  const noopLoadNotifications = useCallback(async () => {}, []);

  if (loading) {
    return (
      <Box p={10} textAlign="center">
        <Spinner size="lg" />
        <Text mt={3}>Loading settings...</Text>
      </Box>
    );
  }

  return (
    <VStack spacing={6} align="stretch">
      <PageNavBar
        title="Settings"
        description="Project-wide controls for CDR retention, notifications, and system defaults."
        rightContent={(
          <HStack spacing={3}>
            {isDirty && (
              <Text fontSize="sm" color="orange.500" fontWeight="medium">
                Unsaved changes
              </Text>
            )}
            <Button
              leftIcon={<FiSave />}
              colorScheme="green"
              onClick={handleSave}
              isLoading={saving}
              isDisabled={saving}
              size="sm"
            >
              Save Settings
            </Button>
          </HStack>
        )}
      />

      {/*
        isLazy now works as intended:
        - General tab renders immediately (default tab, needed for settings state).
        - DataRetentionTab mounts (and fetches system info) only on first visit.
        - CountryCodesTab mounts only on first visit.
        - NotificationsTab mounts (and starts polling) only on first visit.
      */}
      <Tabs colorScheme="blue" variant="line" isLazy>
        <TabList gap={6}>
          <Tab><HStack><FiSettings /><Text>General</Text></HStack></Tab>
          <Tab><HStack><FiDatabase /><Text>Data Retention</Text></HStack></Tab>
          <Tab><HStack><FiUpload /><Text>Country Codes</Text></HStack></Tab>
          <Tab><HStack><FiBell /><Text>Notifications</Text></HStack></Tab>
        </TabList>

        <TabPanels>

          {/* ── General ──────────────────────────────────────── */}
          <TabPanel px={0}>
            <Card>
              <CardBody>
                <Grid templateColumns={{ base: '1fr', md: '1fr 1fr' }} gap={4}>
                  <GridItem>
                    <FormControl>
                      <FormLabel>System Name</FormLabel>
                      <Input
                        value={settings.systemName || ''}
                        onChange={(e) => updateSetting('systemName', e.target.value)}
                      />
                    </FormControl>
                  </GridItem>
                  <GridItem>
                    <FormControl>
                      <FormLabel>Notification Email</FormLabel>
                      <Input
                        type="email"
                        value={settings.notificationEmail || ''}
                        onChange={(e) => updateSetting('notificationEmail', e.target.value)}
                      />
                    </FormControl>
                  </GridItem>
                  <GridItem>
                    <FormControl>
                      <FormLabel>Currency</FormLabel>
                      <Select
                        value={settings.currency || 'USD'}
                        onChange={(e) => updateSetting('currency', e.target.value)}
                      >
                        <option value="USD">USD</option>
                        <option value="EUR">EUR</option>
                        <option value="GBP">GBP</option>
                        <option value="INR">INR</option>
                      </Select>
                    </FormControl>
                  </GridItem>
                  <GridItem>
                    <FormControl>
                      <FormLabel>Timezone</FormLabel>
                      <Select
                        value={settings.timezone || 'UTC'}
                        onChange={(e) => updateSetting('timezone', e.target.value)}
                      >
                        <option value="UTC">UTC</option>
                        <option value="EST">EST</option>
                        <option value="PST">PST</option>
                        <option value="IST">IST</option>
                      </Select>
                    </FormControl>
                  </GridItem>
                </Grid>

                <Divider my={5} />

                <Stack direction={{ base: 'column', md: 'row' }} spacing={6}>
                  <FormControl display="flex" alignItems="center">
                    <FormLabel mb={0}>Email Notifications</FormLabel>
                    <Switch
                      colorScheme="green"
                      isChecked={settings.emailNotifications !== false}
                      onChange={(e) => updateSetting('emailNotifications', e.target.checked)}
                    />
                  </FormControl>
                </Stack>
              </CardBody>
            </Card>
          </TabPanel>

          {/* ── Data Retention ───────────────────────────────── */}
          <TabPanel px={0}>
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
          </TabPanel>

          {/* ── Country Codes ────────────────────────────────── */}
          <TabPanel px={0}>
            <CountryCodesTab loadNotifications={noopLoadNotifications} />
          </TabPanel>

          {/* ── Notifications ────────────────────────────────── */}
          <TabPanel px={0}>
            <NotificationsTab
              settings={settings}
              updateSetting={updateSetting}
            />
          </TabPanel>

        </TabPanels>
      </Tabs>
    </VStack>
  );
};

export default Settings;