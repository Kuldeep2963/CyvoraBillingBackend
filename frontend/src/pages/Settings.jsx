import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  AlertDescription,
  AlertIcon,
  AlertTitle,
  Badge,
  Box,
  Button,
  Card,
  CardBody,
  Divider,
  FormControl,
  FormLabel,
  Grid,
  GridItem,
  Heading,
  HStack,
  Input,
  NumberInput,
  NumberInputField,
  Select,
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
import { FiBell, FiDatabase, FiRefreshCw, FiSave, FiSettings, FiUpload } from 'react-icons/fi';
import {
  createTestNotification,
  fetchCDRCount,
  fetchCustomers,
  fetchInvoices,
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
import PageNavBar from '../components/PageNavBar';

const DEFAULT_SETTINGS = {
  systemName: 'CDR Billing System',
  currency: 'USD',
  timezone: 'UTC',
  dataRetentionDays: 60,
  notificationPollingSeconds: 10,
  emailNotifications: true,
  notifyInvoiceGenerated: true,
  notifyPaymentDue: true,
  notifyDisputes: true,
  notifyErrors: true,
  notifyPaymentReceived: true,
  notificationEmail: '',
};

const Settings = () => {
  const toast = useToast();

  const [settings, setSettings]                       = useState(DEFAULT_SETTINGS);
  const [saving, setSaving]                           = useState(false);
  const [loading, setLoading]                         = useState(true);
  const [notifications, setNotifications]             = useState([]);
  const [unreadCount, setUnreadCount]                 = useState(0);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [retentionRunning, setRetentionRunning]       = useState(false);
  const [systemInfo, setSystemInfo]                   = useState({ cdrs: 0, customers: 0, invoices: 0 });
  const [countryCodeFile, setCountryCodeFile]         = useState(null);
  const [replaceCountryCodes, setReplaceCountryCodes] = useState(false);
  const [uploadingCountryCodes, setUploadingCountryCodes] = useState(false);
  const [countryCodeInputKey, setCountryCodeInputKey] = useState(0);
  const [countryCodes, setCountryCodes]               = useState([]);
  const [loadingCountryCodes, setLoadingCountryCodes] = useState(false);
  const [countryCodesLoaded, setCountryCodesLoaded]   = useState(false);
  const [countryCodeSearch, setCountryCodeSearch]     = useState('');
  const [singleCountryCode, setSingleCountryCode]     = useState('');
  const [singleCountryName, setSingleCountryName]     = useState('');
  const [addingCountryCode, setAddingCountryCode]     = useState(false);
  const [deletingCountryCode, setDeletingCountryCode] = useState('');

  // FIX B: Local display strings for NumberInput fields so the user can clear
  //         and retype freely without the value snapping back mid-keystroke.
  //         We commit to settings only on blur, after parsing + clamping.
  const [retentionInput, setRetentionInput]   = useState(String(DEFAULT_SETTINGS.dataRetentionDays));
  const [pollingInput, setPollingInput]       = useState(String(DEFAULT_SETTINGS.notificationPollingSeconds));

  // FIX 1: Track unsaved changes to warn user before navigating away
  const [isDirty, setIsDirty] = useState(false);
  const savedSettingsRef = useRef(DEFAULT_SETTINGS);

  // FIX 2: Ref to always hold the latest notificationPollingSeconds without
  //         recreating the poll interval every time the user tweaks the number field.
  //         The interval reads from the ref so it self-corrects on next tick without
  //         tearing down and recreating the timer on every keystroke.
  const pollMsRef = useRef(10_000);

  // FIX 3: isMounted guard — prevents setState after unmount on every async call.
  const isMounted = useRef(true);
  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  // ── derived ───────────────────────────────────────────────────────────────

  const filteredCountryCodes = useMemo(() => {
    const query = countryCodeSearch.trim().toLowerCase();
    if (!query) return countryCodes;
    return countryCodes.filter((item) => {
      const code        = String(item?.code        || '').toLowerCase();
      const countryName = String(item?.country_name || '').toLowerCase();
      return code.includes(query) || countryName.includes(query);
    });
  }, [countryCodes, countryCodeSearch]);

  // FIX 4: Keep pollMsRef in sync whenever the setting changes — no useEffect needed.
  //         This avoids the previous pattern where changing notificationPollingSeconds
  //         triggered the poll-interval useEffect, tore down the old interval, and
  //         created a new one (causing a brief gap in polling and an unnecessary render).
  const notificationPollMs = useMemo(() => {
    const seconds = Number(settings.notificationPollingSeconds) || 10;
    const ms      = Math.max(5, Math.min(3600, seconds)) * 1000;
    pollMsRef.current = ms;
    return ms;
  }, [settings.notificationPollingSeconds]);

  // ── loaders ───────────────────────────────────────────────────────────────

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const serverSettings = await getGlobalSettings();
      if (!isMounted.current) return;
      const merged = { ...DEFAULT_SETTINGS, ...serverSettings };
      setSettings(merged);
      // FIX 5: snapshot what was saved so we can detect dirty state accurately
      savedSettingsRef.current = merged;
      setIsDirty(false);
      // FIX B: keep local display strings in sync with freshly loaded server values
      setRetentionInput(String(merged.dataRetentionDays ?? 60));
      setPollingInput(String(merged.notificationPollingSeconds ?? 10));
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
  }, [toast]);

  const loadSystemInfo = useCallback(async () => {
    try {
      const [cdrCount, customers, invoices] = await Promise.all([
        fetchCDRCount(),
        fetchCustomers(),
        fetchInvoices({ page: 1, limit: 1 }),
      ]);
      if (!isMounted.current) return;
      setSystemInfo({
        cdrs:      Number(cdrCount || 0),
        customers: Array.isArray(customers) ? customers.length : 0,
        invoices:  Number(invoices?.totalRecords || invoices?.total || 0),
      });
    } catch (error) {
      console.error('Failed to load system counts', error);
    }
  }, []);

  // FIX 6: loadNotifications is now silent (no loading state change) when called
  //         from the poll interval so the UI doesn't flash a spinner every N seconds.
  //         The `silent` flag lets the initial manual load still show the spinner.
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

  // ── effects ───────────────────────────────────────────────────────────────

  useEffect(() => {
    loadSettings();
    loadSystemInfo();
    loadNotifications();
  }, [loadSettings, loadSystemInfo, loadNotifications]);

  // FIX 7: Notification poll interval no longer depends on notificationPollMs directly.
  //         It runs on a fixed 5-second meta-tick and reads pollMsRef to decide whether
  //         enough time has passed. This means changing the poll interval in the UI does
  //         NOT tear down and recreate the interval — zero gap in polling, no extra renders.
  useEffect(() => {
    let lastPoll = Date.now();

    const timer = setInterval(() => {
      if (Date.now() - lastPoll >= pollMsRef.current) {
        lastPoll = Date.now();
        loadNotifications(true); // silent = true
      }
    }, 5_000);

    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadNotifications]); // loadNotifications is stable (useCallback + no deps that change)

  // FIX 8: Warn user about unsaved changes when navigating away (browser unload)
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  // ── settings change helper ────────────────────────────────────────────────

  // FIX 9: Centralised setter that also marks the form dirty — eliminates the
  //         repetitive inline spread pattern duplicated 12+ times in the JSX.
  const updateSetting = useCallback((key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setIsDirty(true);
  }, []);

  // ── handlers ──────────────────────────────────────────────────────────────

  const handleSave = async () => {
    setSaving(true);
    try {
      const saved = await updateGlobalSettings(settings);
      if (!isMounted.current) return;
      const merged = { ...DEFAULT_SETTINGS, ...saved };
      setSettings(merged);
      savedSettingsRef.current = merged;
      setIsDirty(false);
      // FIX B: keep local display strings in sync after save
      setRetentionInput(String(merged.dataRetentionDays ?? 60));
      setPollingInput(String(merged.notificationPollingSeconds ?? 10));
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

  const handleRunRetention = async () => {
    setRetentionRunning(true);
    try {
      const result = await runRetentionCleanup();
      if (!isMounted.current) return;
      await loadNotifications();
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
          result.replaceExisting
            ? ` Replaced ${result.deletedCount} existing record(s).`
            : ''
        }`,
        status: 'success',
        duration: 4000,
        isClosable: true,
      });
      await loadNotifications();
      // FIX 10: Only refresh the table if it was already open — avoids an
      //          invisible background fetch that the user never sees.
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

  const handleFetchCountryCodes = async () => {
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
  };

  const handleAddCountryCode = async () => {
    const code = singleCountryCode.trim();
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

      await loadNotifications();
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

      await loadNotifications();
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

  // ── render ────────────────────────────────────────────────────────────────

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
            {/* FIX 11: Show unsaved-changes indicator next to the save button */}
            {isDirty && (
              <Text fontSize="sm" color="orange.500" fontWeight="medium">
                Unsaved changes
              </Text>
            )}
            <Button
              leftIcon={<FiSave />}
              colorScheme="blue"
              onClick={handleSave}
              isLoading={saving}
              // FIX 12: Disable save while already saving — prevents double-submit
              isDisabled={saving}
            >
              Save Settings
            </Button>
          </HStack>
        )}
      />

      <Alert status="info" borderRadius="md">
        <AlertIcon />
        <Box>
          <AlertTitle>Retention policy is active</AlertTitle>
          <AlertDescription>
            CDR records older than <b>{settings.dataRetentionDays}</b> days are removed automatically. Default is 60 days (2 months).
          </AlertDescription>
        </Box>
      </Alert>

      <Tabs colorScheme="blue" variant="enclosed">
        <TabList>
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
                      {/* FIX 9 applied: updateSetting() replaces every inline spread */}
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
            <Card>
              <CardBody>
                <VStack spacing={5} align="stretch">
                  <FormControl>
                    <FormLabel>CDR Data Retention (days)</FormLabel>
                    {/* FIX B: keepWithinRange+clampValueOnBlur disabled so the field
                               can be fully cleared mid-type. Clamping happens onBlur. */}
                    <NumberInput
                      min={30}
                      max={3650}
                      value={retentionInput}
                      keepWithinRange={false}
                      clampValueOnBlur={false}
                      onChange={(valueString) => setRetentionInput(valueString)}
                      onBlur={() => {
                        const parsed = Number(retentionInput);
                        const clamped = Number.isFinite(parsed) && parsed >= 30
                          ? Math.min(3650, parsed)
                          : 60;
                        setRetentionInput(String(clamped));
                        updateSetting('dataRetentionDays', clamped);
                      }}
                    >
                      <NumberInputField />
                    </NumberInput>
                    <Text fontSize="sm" color="gray.600" mt={1}>
                      Set to <b>60</b> for 2-month retention. Min 30, max 3650 days.
                    </Text>
                  </FormControl>

                  <FormControl>
                    <FormLabel>Realtime Notification Refresh (seconds)</FormLabel>
                    {/* FIX B: keepWithinRange+clampValueOnBlur disabled so the field
                               can be fully cleared mid-type. Clamping + commit on blur.
                               FIX A: max raised from 60 to 3600 to match actual intent. */}
                    <NumberInput
                      min={5}
                      max={3600}
                      value={pollingInput}
                      keepWithinRange={false}
                      clampValueOnBlur={false}
                      onChange={(valueString) => setPollingInput(valueString)}
                      onBlur={() => {
                        const parsed = Number(pollingInput);
                        const clamped = Number.isFinite(parsed) && parsed >= 5
                          ? Math.min(3600, parsed)
                          : 10;
                        setPollingInput(String(clamped));
                        updateSetting('notificationPollingSeconds', clamped);
                      }}
                    >
                      <NumberInputField />
                    </NumberInput>
                    <Text fontSize="sm" color="gray.600" mt={1}>
                      Min 5 s, max 3600 s. Changes apply on the next poll tick — no reload needed.
                    </Text>
                  </FormControl>

                  <HStack flexWrap="wrap" spacing={3}>
                    <Button
                      leftIcon={<FiRefreshCw />}
                      onClick={handleRunRetention}
                      isLoading={retentionRunning}
                      isDisabled={retentionRunning}
                      colorScheme="orange"
                      variant="outline"
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

                  <Grid templateColumns={{ base: '1fr', md: '1fr 1fr 1fr' }} gap={3}>
                    <Badge p={3} borderRadius="md" colorScheme="blue">
                      CDRs: {systemInfo.cdrs.toLocaleString()}
                    </Badge>
                    <Badge p={3} borderRadius="md" colorScheme="green">
                      Customers: {systemInfo.customers.toLocaleString()}
                    </Badge>
                    <Badge p={3} borderRadius="md" colorScheme="purple">
                      Invoices: {systemInfo.invoices.toLocaleString()}
                    </Badge>
                  </Grid>
                </VStack>
              </CardBody>
            </Card>
          </TabPanel>

          {/* ── Country Codes ────────────────────────────────── */}
          <TabPanel px={0}>
            <Card>
              <CardBody>
                <VStack spacing={4} align="stretch">
                  <Text color="gray.700">
                    Upload a CSV file with columns <b>code</b> and <b>country_name</b> to populate the country code table.
                  </Text>
                  <Text fontSize="sm" color="gray.600">
                    Supported formats: with header (<code>code,country_name</code>) or without header (first column code, second column country name).
                  </Text>

                  <Box p={4} borderWidth="1px" borderRadius="md" bg="gray.50">
                    <Text fontWeight="600" mb={3}>Add Single Country Code</Text>
                    <Grid templateColumns={{ base: '1fr', md: '1fr 2fr auto' }} gap={3}>
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
                      isChecked={replaceCountryCodes}
                      onChange={(e) => setReplaceCountryCodes(e.target.checked)}
                    />
                  </FormControl>

                  <HStack justify="flex-start" flexWrap="wrap" spacing={3}>
                    <Button
                      leftIcon={<FiUpload />}
                      size={"md"}
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
                      onClick={handleFetchCountryCodes}
                      isLoading={loadingCountryCodes}
                      isDisabled={loadingCountryCodes}
                    >
                      {countryCodesLoaded ? 'Refresh Country Codes' : 'Show Country Codes'}
                    </Button>
                  </HStack>

                  {countryCodesLoaded && (
                    <Box borderWidth="1px" borderRadius="md" overflow="hidden">
                      <Box p={3} flex={"display"} flexDirection="row" borderBottomWidth="1px" bg="gray.50">
                        <Input
                          bg={"gray.200"}
                          placeholder="Search by code or country name"
                          value={countryCodeSearch}
                          onChange={(e) => setCountryCodeSearch(e.target.value)}
                        />
                        <Text mt={2} fontSize="sm" color="gray.600">
                          Showing {filteredCountryCodes.length} of {countryCodes.length} record(s)
                        </Text>
                      </Box>
                      <TableContainer maxH="300px" overflowY="auto" maxW={"600px"}>
                        <Table size="sm" variant="simple" colorScheme="gray">
                          <Thead position="sticky" top={0} bg="gray.200" zIndex={1}>
                            <Tr>
                              <Th color={"gray.700"}>Code</Th>
                              <Th color={"gray.700"}>Country</Th>
                              <Th color={"gray.700"}>Action</Th>
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
                              // FIX 14: stable key — code alone is not guaranteed unique
                              //          (same code can appear for different trunks/regions).
                              //          Combine code + country_name for safety.
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
          </TabPanel>

          {/* ── Notifications ────────────────────────────────── */}
          <TabPanel px={0}>
            <Card>
              <CardBody>
                <VStack spacing={4} align="stretch">
                  <Grid templateColumns={{ base: '1fr', md: '1fr 1fr' }} gap={3}>
                    <FormControl display="flex" alignItems="center">
                      <FormLabel mb={0}>Invoice Generated</FormLabel>
                      <Switch
                        isChecked={settings.notifyInvoiceGenerated !== false}
                        onChange={(e) => updateSetting('notifyInvoiceGenerated', e.target.checked)}
                      />
                    </FormControl>
                    <FormControl display="flex" alignItems="center">
                      <FormLabel mb={0}>Payment Due</FormLabel>
                      <Switch
                        isChecked={settings.notifyPaymentDue !== false}
                        onChange={(e) => updateSetting('notifyPaymentDue', e.target.checked)}
                      />
                    </FormControl>
                    <FormControl display="flex" alignItems="center">
                      <FormLabel mb={0}>Payment Received</FormLabel>
                      <Switch
                        isChecked={settings.notifyPaymentReceived !== false}
                        onChange={(e) => updateSetting('notifyPaymentReceived', e.target.checked)}
                      />
                    </FormControl>
                    <FormControl display="flex" alignItems="center">
                      <FormLabel mb={0}>Dispute Alerts</FormLabel>
                      <Switch
                        isChecked={settings.notifyDisputes !== false}
                        onChange={(e) => updateSetting('notifyDisputes', e.target.checked)}
                      />
                    </FormControl>
                    <FormControl display="flex" alignItems="center">
                      <FormLabel mb={0}>System Errors</FormLabel>
                      <Switch
                        isChecked={settings.notifyErrors !== false}
                        onChange={(e) => updateSetting('notifyErrors', e.target.checked)}
                      />
                    </FormControl>
                  </Grid>

                  <Divider />

                  <HStack justify="space-between" flexWrap="wrap" spacing={3}>
                    <Heading size="sm">Live Notification Box</Heading>
                    <HStack spacing={2}>
                      <Button
                        size="sm"
                        onClick={handleCreateTestNotification}
                        variant="outline"
                      >
                        Send Test Notification
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleMarkAllRead}
                        variant="ghost"
                        // FIX 15: Disable "Mark All Read" when there's nothing unread
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
                                {new Date(item.createdAt).toLocaleString()}
                              </Text>
                            </Box>
                            {!item.isRead && (
                              <Button
                                size="xs"
                                flexShrink={0}
                                onClick={() => handleMarkRead(item.id)}
                              >
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
          </TabPanel>

        </TabPanels>
      </Tabs>
    </VStack>
  );
};

export default Settings;