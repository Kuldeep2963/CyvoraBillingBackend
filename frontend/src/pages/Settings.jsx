import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
  uploadCountryCodes,
  updateGlobalSettings,
} from '../utils/api';

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
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [retentionRunning, setRetentionRunning] = useState(false);
  const [systemInfo, setSystemInfo] = useState({ cdrs: 0, customers: 0, invoices: 0 });
  const [countryCodeFile, setCountryCodeFile] = useState(null);
  const [replaceCountryCodes, setReplaceCountryCodes] = useState(false);
  const [uploadingCountryCodes, setUploadingCountryCodes] = useState(false);
  const [countryCodeInputKey, setCountryCodeInputKey] = useState(0);

  const notificationPollMs = useMemo(() => {
    const seconds = Number(settings.notificationPollingSeconds) || 10;
    return Math.max(5, Math.min(60, seconds)) * 1000;
  }, [settings.notificationPollingSeconds]);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const serverSettings = await getGlobalSettings();
      setSettings({ ...DEFAULT_SETTINGS, ...serverSettings });
    } catch (error) {
      toast({
        title: 'Failed to load settings',
        description: error.message,
        status: 'error',
        duration: 4000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const loadSystemInfo = useCallback(async () => {
    try {
      const [cdrCount, customers, invoices] = await Promise.all([
        fetchCDRCount(),
        fetchCustomers(),
        fetchInvoices({ page: 1, limit: 1 }),
      ]);

      setSystemInfo({
        cdrs: Number(cdrCount || 0),
        customers: Array.isArray(customers) ? customers.length : 0,
        invoices: Number(invoices?.totalRecords || invoices?.total || 0),
      });
    } catch (error) {
      console.error('Failed to load system counts', error);
    }
  }, []);

  const loadNotifications = useCallback(async () => {
    setLoadingNotifications(true);
    try {
      const data = await fetchNotifications({ limit: 20 });
      setNotifications(data.notifications || []);
      setUnreadCount(Number(data.unreadCount || 0));
    } catch (error) {
      console.error('Failed to load notifications', error);
    } finally {
      setLoadingNotifications(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
    loadSystemInfo();
    loadNotifications();
  }, [loadSettings, loadSystemInfo, loadNotifications]);

  useEffect(() => {
    const timer = setInterval(() => {
      loadNotifications();
    }, notificationPollMs);

    return () => clearInterval(timer);
  }, [notificationPollMs, loadNotifications]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const saved = await updateGlobalSettings(settings);
      setSettings({ ...DEFAULT_SETTINGS, ...saved });
      window.dispatchEvent(new CustomEvent('settings-updated', { detail: saved }));

      toast({
        title: 'Settings saved',
        description: 'Global settings were updated and applied project-wide.',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      toast({
        title: 'Save failed',
        description: error.message,
        status: 'error',
        duration: 4000,
        isClosable: true,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleMarkRead = async (id) => {
    try {
      await markNotificationRead(id);
      await loadNotifications();
    } catch (error) {
      toast({ title: 'Failed to update notification', description: error.message, status: 'error' });
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
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
      toast({
        title: 'Retention cleanup failed',
        description: error.message,
        status: 'error',
        duration: 4000,
        isClosable: true,
      });
    } finally {
      setRetentionRunning(false);
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

      setCountryCodeFile(null);
      setCountryCodeInputKey((prev) => prev + 1);

      toast({
        title: 'Country codes uploaded',
        description: `Uploaded ${result.uploadedCount} record(s).${result.replaceExisting ? ` Replaced ${result.deletedCount} existing record(s).` : ''}`,
        status: 'success',
        duration: 4000,
        isClosable: true,
      });

      await loadNotifications();
    } catch (error) {
      toast({
        title: 'Upload failed',
        description: error.message,
        status: 'error',
        duration: 4000,
        isClosable: true,
      });
    } finally {
      setUploadingCountryCodes(false);
    }
  };

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
      <Box>
        <Heading size="lg">Settings</Heading>
        <Text color="gray.600">Project-wide controls for CDR retention, notifications, and system defaults.</Text>
      </Box>

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
          <TabPanel px={0}>
            <Card>
              <CardBody>
                <Grid templateColumns={{ base: '1fr', md: '1fr 1fr' }} gap={4}>
                  <GridItem>
                    <FormControl>
                      <FormLabel>System Name</FormLabel>
                      <Input
                        value={settings.systemName || ''}
                        onChange={(e) => setSettings((prev) => ({ ...prev, systemName: e.target.value }))}
                      />
                    </FormControl>
                  </GridItem>
                  <GridItem>
                    <FormControl>
                      <FormLabel>Notification Email</FormLabel>
                      <Input
                        type="email"
                        value={settings.notificationEmail || ''}
                        onChange={(e) => setSettings((prev) => ({ ...prev, notificationEmail: e.target.value }))}
                      />
                    </FormControl>
                  </GridItem>
                  <GridItem>
                    <FormControl>
                      <FormLabel>Currency</FormLabel>
                      <Select
                        value={settings.currency || 'USD'}
                        onChange={(e) => setSettings((prev) => ({ ...prev, currency: e.target.value }))}
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
                        onChange={(e) => setSettings((prev) => ({ ...prev, timezone: e.target.value }))}
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
                      onChange={(e) => setSettings((prev) => ({ ...prev, emailNotifications: e.target.checked }))}
                    />
                  </FormControl>
                </Stack>
              </CardBody>
            </Card>
          </TabPanel>

          <TabPanel px={0}>
            <Card>
              <CardBody>
                <VStack spacing={5} align="stretch">
                  <FormControl>
                    <FormLabel>CDR Data Retention (days)</FormLabel>
                    <NumberInput
                      min={30}
                      max={3650}
                      value={settings.dataRetentionDays || 60}
                      onChange={(value) => setSettings((prev) => ({ ...prev, dataRetentionDays: Number(value) || 60 }))}
                    >
                      <NumberInputField />
                    </NumberInput>
                    <Text fontSize="sm" color="gray.600" mt={1}>
                      Set to <b>60</b> for 2-month retention.
                    </Text>
                  </FormControl>

                  <FormControl>
                    <FormLabel>Realtime Notification Refresh (seconds)</FormLabel>
                    <NumberInput
                      min={60}
                      max={1000}
                      value={settings.notificationPollingSeconds || 10}
                      onChange={(value) => setSettings((prev) => ({ ...prev, notificationPollingSeconds: Number(value) || 10 }))}
                    >
                      <NumberInputField />
                    </NumberInput>
                  </FormControl>

                  <HStack>
                    <Button
                      leftIcon={<FiRefreshCw />}
                      onClick={handleRunRetention}
                      isLoading={retentionRunning}
                      colorScheme="orange"
                      variant="outline"
                    >
                      Run Retention Cleanup Now
                    </Button>
                    <Button leftIcon={<FiRefreshCw />} onClick={loadSystemInfo} variant="ghost">
                      Refresh Counts
                    </Button>
                  </HStack>

                  <Grid templateColumns={{ base: '1fr', md: '1fr 1fr 1fr' }} gap={3}>
                    <Badge p={3} borderRadius="md" colorScheme="blue">CDRs: {systemInfo.cdrs}</Badge>
                    <Badge p={3} borderRadius="md" colorScheme="green">Customers: {systemInfo.customers}</Badge>
                    <Badge p={3} borderRadius="md" colorScheme="purple">Invoices: {systemInfo.invoices}</Badge>
                  </Grid>
                </VStack>
              </CardBody>
            </Card>
          </TabPanel>

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

                  <HStack justify="flex-start">
                    <Button
                      leftIcon={<FiUpload />}
                      colorScheme="blue"
                      onClick={handleUploadCountryCodes}
                      isLoading={uploadingCountryCodes}
                    >
                      Upload Country Codes
                    </Button>
                    {countryCodeFile && (
                      <Text fontSize="sm" color="gray.600">
                        Selected: {countryCodeFile.name}
                      </Text>
                    )}
                  </HStack>
                </VStack>
              </CardBody>
            </Card>
          </TabPanel>

          <TabPanel px={0}>
            <Card>
              <CardBody>
                <VStack spacing={4} align="stretch">
                  <Grid templateColumns={{ base: '1fr', md: '1fr 1fr' }} gap={3}>
                    <FormControl display="flex" alignItems="center">
                      <FormLabel mb={0}>Invoice Generated</FormLabel>
                      <Switch isChecked={settings.notifyInvoiceGenerated !== false} onChange={(e) => setSettings((prev) => ({ ...prev, notifyInvoiceGenerated: e.target.checked }))} />
                    </FormControl>
                    <FormControl display="flex" alignItems="center">
                      <FormLabel mb={0}>Payment Due</FormLabel>
                      <Switch isChecked={settings.notifyPaymentDue !== false} onChange={(e) => setSettings((prev) => ({ ...prev, notifyPaymentDue: e.target.checked }))} />
                    </FormControl>
                    <FormControl display="flex" alignItems="center">
                      <FormLabel mb={0}>Payment Received</FormLabel>
                      <Switch isChecked={settings.notifyPaymentReceived !== false} onChange={(e) => setSettings((prev) => ({ ...prev, notifyPaymentReceived: e.target.checked }))} />
                    </FormControl>
                    <FormControl display="flex" alignItems="center">
                      <FormLabel mb={0}>Dispute Alerts</FormLabel>
                      <Switch isChecked={settings.notifyDisputes !== false} onChange={(e) => setSettings((prev) => ({ ...prev, notifyDisputes: e.target.checked }))} />
                    </FormControl>
                    <FormControl display="flex" alignItems="center">
                      <FormLabel mb={0}>System Errors</FormLabel>
                      <Switch isChecked={settings.notifyErrors !== false} onChange={(e) => setSettings((prev) => ({ ...prev, notifyErrors: e.target.checked }))} />
                    </FormControl>
                  </Grid>

                  <Divider />

                  <HStack justify="space-between">
                    <Heading size="sm">Live Notification Box</Heading>
                    <HStack>
                      <Button size="sm" onClick={handleCreateTestNotification} variant="outline">Send Test Notification</Button>
                      <Button size="sm" onClick={handleMarkAllRead} variant="ghost">Mark All Read</Button>
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
                        <Box key={item.id} p={3} borderWidth="1px" borderRadius="md" bg={item.isRead ? 'gray.50' : 'blue.50'}>
                          <HStack justify="space-between" align="start">
                            <Box>
                              <Text fontWeight="600">{item.title}</Text>
                              <Text fontSize="sm" color="gray.700">{item.message}</Text>
                              <Text fontSize="xs" color="gray.500" mt={1}>
                                {new Date(item.createdAt).toLocaleString()}
                              </Text>
                            </Box>
                            {!item.isRead && (
                              <Button size="xs" onClick={() => handleMarkRead(item.id)}>
                                Mark Read
                              </Button>
                            )}
                          </HStack>
                        </Box>
                      ))}
                    </VStack>
                  )}

                  <Text fontSize="sm" color="gray.600">Unread notifications: <b>{unreadCount}</b></Text>
                </VStack>
              </CardBody>
            </Card>
          </TabPanel>
        </TabPanels>
      </Tabs>

      <HStack justify="flex-end">
        <Button leftIcon={<FiSave />} colorScheme="blue" onClick={handleSave} isLoading={saving}>
          Save Settings
        </Button>
      </HStack>
    </VStack>
  );
};

export default Settings;
