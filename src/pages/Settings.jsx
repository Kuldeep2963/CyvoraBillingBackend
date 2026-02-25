import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Heading,
  VStack,
  Text,
  Button,
  useToast,
  HStack,
  FormControl,
  FormLabel,
  Input,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  NumberIncrementStepper,
  NumberDecrementStepper,
  Select,
  Switch,
  Card,
  CardBody,
  Divider,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Badge,
  IconButton,
} from '@chakra-ui/react';
import {
  FiSave,
  FiRefreshCw,
  FiTrash2,
  FiDollarSign,
  FiPercent,
  FiGlobe,
  FiInfo,
  FiAlertTriangle,
} from 'react-icons/fi';
import ConfirmDialog from '../components/ConfirmDialog';
import { getSettings, saveSettings, clearAllData, exportAllData, importData } from '../utils/storage';

const Settings = () => {
  const [settings, setSettings] = useState({});
  const [activeTab, setActiveTab] = useState(0);
  const [isResetOpen, setIsResetOpen] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const toast = useToast();

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = () => {
    const savedSettings = getSettings();
    setSettings(savedSettings);
  };

  const handleSave = () => {
    saveSettings(settings);
    toast({
      title: 'Settings saved',
      description: 'Your settings have been saved successfully',
      status: 'success',
      duration: 3000,
      isClosable: true,
    });
  };

  const handleReset = () => {
    clearAllData();
    loadSettings();
    setIsResetOpen(false);
    toast({
      title: 'Data reset',
      description: 'All data has been cleared successfully',
      status: 'warning',
      duration: 3000,
      isClosable: true,
    });
  };

  const handleExport = () => {
    const data = exportAllData();
    const dataStr = JSON.stringify(data, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `cdr-billing-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: 'Data exported',
      description: 'All data has been exported successfully',
      status: 'success',
      duration: 3000,
      isClosable: true,
    });
  };

  const handleImport = () => {
    if (!importFile) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        importData(data);
        loadSettings();
        setImportFile(null);
        
        toast({
          title: 'Data imported',
          description: 'All data has been imported successfully',
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
      } catch (error) {
        toast({
          title: 'Import failed',
          description: 'Invalid file format',
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
      }
    };
    reader.readAsText(importFile);
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImportFile(file);
    }
  };

  return (
    <Box>
      <VStack spacing={6} align="stretch">
        {/* Header */}
        <Box>
          <Heading size="lg" mb={2}>Settings</Heading>
          <Text color="gray.600">
            Configure your CDR billing system settings
          </Text>
        </Box>

        {/* Tabs */}
        <Tabs index={activeTab} onChange={setActiveTab}>
          <TabList>
            <Tab>General</Tab>
            <Tab>Billing</Tab>
            <Tab>Company</Tab>
            <Tab>Data Management</Tab>
          </TabList>

          <TabPanels>
            {/* General Settings */}
            <TabPanel>
              <VStack spacing={6} align="stretch">
                <Card>
                  <CardBody>
                    <Heading size="md" mb={4}>General Settings</Heading>
                    <VStack spacing={4} align="stretch">
                      <FormControl>
                        <FormLabel>System Name</FormLabel>
                        <Input
                          value={settings.systemName || 'CDR Billing System'}
                          onChange={(e) => setSettings({ ...settings, systemName: e.target.value })}
                          placeholder="Enter system name"
                        />
                      </FormControl>

                      <FormControl>
                        <FormLabel>Default Currency</FormLabel>
                        <Select
                          value={settings.currency || 'USD'}
                          onChange={(e) => setSettings({ ...settings, currency: e.target.value })}
                        >
                          <option value="USD">US Dollar (USD)</option>
                          <option value="EUR">Euro (EUR)</option>
                          <option value="GBP">British Pound (GBP)</option>
                          <option value="INR">Indian Rupee (INR)</option>
                          <option value="JPY">Japanese Yen (JPY)</option>
                        </Select>
                      </FormControl>

                      <FormControl>
                        <FormLabel>Time Zone</FormLabel>
                        <Select
                          value={settings.timezone || 'UTC'}
                          onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
                        >
                          <option value="UTC">UTC</option>
                          <option value="EST">Eastern Time (EST)</option>
                          <option value="PST">Pacific Time (PST)</option>
                          <option value="IST">Indian Standard Time (IST)</option>
                          <option value="GMT">Greenwich Mean Time (GMT)</option>
                        </Select>
                      </FormControl>

                      <FormControl display="flex" alignItems="center">
                        <FormLabel mb={0}>Enable Email Notifications</FormLabel>
                        <Switch
                          isChecked={settings.emailNotifications !== false}
                          onChange={(e) => setSettings({ ...settings, emailNotifications: e.target.checked })}
                        />
                      </FormControl>

                      <FormControl display="flex" alignItems="center">
                        <FormLabel mb={0}>Enable Auto-billing</FormLabel>
                        <Switch
                          isChecked={settings.autoBilling === true}
                          onChange={(e) => setSettings({ ...settings, autoBilling: e.target.checked })}
                        />
                      </FormControl>
                    </VStack>
                  </CardBody>
                </Card>
              </VStack>
            </TabPanel>

            {/* Billing Settings */}
            <TabPanel>
              <VStack spacing={6} align="stretch">
                <Card>
                  <CardBody>
                    <Heading size="md" mb={4}>Billing Settings</Heading>
                    <VStack spacing={4} align="stretch">
                      <FormControl>
                        <FormLabel>Default Call Rate (per second)</FormLabel>
                        <NumberInput
                          value={settings.defaultRate || 0.01}
                          onChange={(value) => setSettings({ ...settings, defaultRate: parseFloat(value) })}
                          min={0.001}
                          step={0.001}
                          precision={4}
                        >
                          <NumberInputField />
                          <NumberInputStepper>
                            <NumberIncrementStepper />
                            <NumberDecrementStepper />
                          </NumberInputStepper>
                        </NumberInput>
                        <Text fontSize="sm" color="gray.600" mt={1}>
                          Default rate applied to new customers
                        </Text>
                      </FormControl>

                      <FormControl>
                        <FormLabel>Default Tax Rate</FormLabel>
                        <NumberInput
                          value={settings.taxRate || 0.18}
                          onChange={(value) => setSettings({ ...settings, taxRate: parseFloat(value) })}
                          min={0}
                          max={1}
                          step={0.01}
                          precision={2}
                        >
                          <NumberInputField />
                          <NumberInputStepper>
                            <NumberIncrementStepper />
                            <NumberDecrementStepper />
                          </NumberInputStepper>
                        </NumberInput>
                        <Text fontSize="sm" color="gray.600" mt={1}>
                          Tax rate as decimal (e.g., 0.18 for 18%)
                        </Text>
                      </FormControl>

                      <FormControl>
                        <FormLabel>Default Billing Cycle</FormLabel>
                        <Select
                          value={settings.billingCycle || 'monthly'}
                          onChange={(e) => setSettings({ ...settings, billingCycle: e.target.value })}
                        >
                          <option value="daily">Daily</option>
                          <option value="weekly">Weekly</option>
                          <option value="monthly">Monthly</option>
                          <option value="quarterly">Quarterly</option>
                          <option value="annually">Annually</option>
                        </Select>
                      </FormControl>

                      <FormControl>
                        <FormLabel>Payment Terms (days)</FormLabel>
                        <NumberInput
                          value={settings.paymentTerms || 30}
                          onChange={(value) => setSettings({ ...settings, paymentTerms: parseInt(value) })}
                          min={1}
                          max={90}
                        >
                          <NumberInputField />
                          <NumberInputStepper>
                            <NumberIncrementStepper />
                            <NumberDecrementStepper />
                          </NumberInputStepper>
                        </NumberInput>
                        <Text fontSize="sm" color="gray.600" mt={1}>
                          Number of days before invoice is due
                        </Text>
                      </FormControl>

                      <FormControl>
                        <FormLabel>Late Payment Fee (%)</FormLabel>
                        <NumberInput
                          value={settings.lateFee || 5}
                          onChange={(value) => setSettings({ ...settings, lateFee: parseFloat(value) })}
                          min={0}
                          max={25}
                          step={0.5}
                        >
                          <NumberInputField />
                          <NumberInputStepper>
                            <NumberIncrementStepper />
                            <NumberDecrementStepper />
                          </NumberInputStepper>
                        </NumberInput>
                        <Text fontSize="sm" color="gray.600" mt={1}>
                          Percentage added to overdue invoices
                        </Text>
                      </FormControl>
                    </VStack>
                  </CardBody>
                </Card>
              </VStack>
            </TabPanel>

            {/* Company Settings */}
            <TabPanel>
              <VStack spacing={6} align="stretch">
                <Card>
                  <CardBody>
                    <Heading size="md" mb={4}>Company Information</Heading>
                    <VStack spacing={4} align="stretch">
                      <FormControl>
                        <FormLabel>Company Name</FormLabel>
                        <Input
                          value={settings.companyName || ''}
                          onChange={(e) => setSettings({ ...settings, companyName: e.target.value })}
                          placeholder="Enter company name"
                        />
                      </FormControl>

                      <FormControl>
                        <FormLabel>Company Address</FormLabel>
                        <Input
                          value={settings.companyAddress || ''}
                          onChange={(e) => setSettings({ ...settings, companyAddress: e.target.value })}
                          placeholder="Enter company address"
                        />
                      </FormControl>

                      <FormControl>
                        <FormLabel>Company Phone</FormLabel>
                        <Input
                          value={settings.companyPhone || ''}
                          onChange={(e) => setSettings({ ...settings, companyPhone: e.target.value })}
                          placeholder="Enter company phone number"
                        />
                      </FormControl>

                      <FormControl>
                        <FormLabel>Company Email</FormLabel>
                        <Input
                          type="email"
                          value={settings.companyEmail || ''}
                          onChange={(e) => setSettings({ ...settings, companyEmail: e.target.value })}
                          placeholder="Enter company email"
                        />
                      </FormControl>

                      <FormControl>
                        <FormLabel>Tax ID / VAT Number</FormLabel>
                        <Input
                          value={settings.taxId || ''}
                          onChange={(e) => setSettings({ ...settings, taxId: e.target.value })}
                          placeholder="Enter tax identification number"
                        />
                      </FormControl>

                      <FormControl>
                        <FormLabel>Website</FormLabel>
                        <Input
                          value={settings.website || ''}
                          onChange={(e) => setSettings({ ...settings, website: e.target.value })}
                          placeholder="Enter company website"
                        />
                      </FormControl>

                      <FormControl>
                        <FormLabel>Bank Account Details</FormLabel>
                        <Input
                          value={settings.bankAccount || ''}
                          onChange={(e) => setSettings({ ...settings, bankAccount: e.target.value })}
                          placeholder="Enter bank account details"
                        />
                      </FormControl>
                    </VStack>
                  </CardBody>
                </Card>
              </VStack>
            </TabPanel>

            {/* Data Management */}
            <TabPanel>
              <VStack spacing={6} align="stretch">
                <Alert status="warning" variant="subtle">
                  <AlertIcon />
                  <Box>
                    <AlertTitle>Data Management</AlertTitle>
                    <AlertDescription>
                      These operations are irreversible. Please backup your data before proceeding.
                    </AlertDescription>
                  </Box>
                </Alert>

                <Card>
                  <CardBody>
                    <Heading size="md" mb={4}>Export Data</Heading>
                    <Text mb={4}>
                      Export all system data including CDRs, customers, invoices, and settings to a JSON file.
                    </Text>
                    <Button
                      leftIcon={<FiSave />}
                      colorScheme="blue"
                      onClick={handleExport}
                    >
                      Export All Data
                    </Button>
                  </CardBody>
                </Card>

                <Card>
                  <CardBody>
                    <Heading size="md" mb={4}>Import Data</Heading>
                    <Text mb={4}>
                      Import previously exported data from a JSON file. This will replace all current data.
                    </Text>
                    <VStack spacing={4} align="stretch">
                      <Input
                        type="file"
                        accept=".json"
                        onChange={handleFileSelect}
                      />
                      {importFile && (
                        <Alert status="info">
                          <AlertIcon />
                          Selected file: {importFile.name}
                        </Alert>
                      )}
                      <Button
                        leftIcon={<FiRefreshCw />}
                        colorScheme="orange"
                        onClick={handleImport}
                        isDisabled={!importFile}
                      >
                        Import Data
                      </Button>
                    </VStack>
                  </CardBody>
                </Card>

                <Card borderColor="red.200">
                  <CardBody>
                    <Heading size="md" mb={4} color="red.600">Danger Zone</Heading>
                    <Text mb={4}>
                      This will permanently delete all data including CDRs, customers, invoices, and settings.
                      This action cannot be undone.
                    </Text>
                    <Button
                      leftIcon={<FiTrash2 />}
                      colorScheme="red"
                      variant="outline"
                      onClick={() => setIsResetOpen(true)}
                    >
                      Reset All Data
                    </Button>
                  </CardBody>
                </Card>

                {/* System Information */}
                <Card>
                  <CardBody>
                    <Heading size="md" mb={4}>System Information</Heading>
                    <Table variant="simple" size="sm">
                      <Tbody>
                        <Tr>
                          <Th>Data Type</Th>
                          <Th>Count</Th>
                          <Th>Last Updated</Th>
                        </Tr>
                        <Tr>
                          <Td>CDR Records</Td>
                          <Td>
                            <Badge colorScheme="blue">
                              {JSON.parse(localStorage.getItem('cdrs') || '[]').length}
                            </Badge>
                          </Td>
                          <Td>-</Td>
                        </Tr>
                        <Tr>
                          <Td>Customers</Td>
                          <Td>
                            <Badge colorScheme="green">
                              {JSON.parse(localStorage.getItem('customers') || '[]').length}
                            </Badge>
                          </Td>
                          <Td>-</Td>
                        </Tr>
                        <Tr>
                          <Td>Invoices</Td>
                          <Td>
                            <Badge colorScheme="purple">
                              {JSON.parse(localStorage.getItem('invoices') || '[]').length}
                            </Badge>
                          </Td>
                          <Td>-</Td>
                        </Tr>
                        <Tr>
                          <Td>Storage Used</Td>
                          <Td colSpan={2}>
                            {Math.round(
                              JSON.stringify(localStorage).length / 1024
                            )} KB
                          </Td>
                        </Tr>
                      </Tbody>
                    </Table>
                  </CardBody>
                </Card>
              </VStack>
            </TabPanel>
          </TabPanels>
        </Tabs>

        {/* Save Button */}
        <HStack justify="flex-end">
          <Button
            leftIcon={<FiSave />}
            colorScheme="blue"
            onClick={handleSave}
          >
            Save Settings
          </Button>
        </HStack>

        {/* Reset Confirmation */}
        <ConfirmDialog
          isOpen={isResetOpen}
          onClose={() => setIsResetOpen(false)}
          onConfirm={handleReset}
          title="Reset All Data"
          message="Are you sure you want to reset all data? This will permanently delete all CDRs, customers, invoices, and settings. This action cannot be undone."
          confirmText="Reset All Data"
          type="danger"
        />
      </VStack>
    </Box>
  );
};

export default Settings;