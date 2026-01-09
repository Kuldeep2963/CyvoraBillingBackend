// import React, { useState } from 'react';
// import {
//   Box,
//   Container,
//   Heading,
//   Text,
//   Button,
//   Flex,
//   VStack,
//   HStack,
//   Card,
//   CardBody,
//   CardHeader,
//   SimpleGrid,
//   FormControl,
//   FormLabel,
//   Input,
//   Select,
//   Switch,
//   Textarea,
//   Divider,
//   Tabs,
//   TabList,
//   TabPanels,
//   Tab,
//   TabPanel,
//   Badge,
//   Alert,
//   AlertIcon,
//   AlertTitle,
//   AlertDescription,
//   Table,
//   Thead,
//   Tbody,
//   Tr,
//   Th,
//   Td,
//   IconButton,
//   Menu,
//   MenuButton,
//   MenuList,
//   MenuItem,
//   Modal,
//   ModalOverlay,
//   ModalContent,
//   ModalHeader,
//   ModalFooter,
//   ModalBody,
//   ModalCloseButton,
//   useDisclosure,
//   useToast,
//   Tag,
//   TagLabel,
//   TagCloseButton,
//   Accordion,
//   AccordionItem,
//   AccordionButton,
//   AccordionPanel,
//   AccordionIcon,
//   NumberInput,
//   NumberInputField,
//   NumberInputStepper,
//   NumberIncrementStepper,
//   NumberDecrementStepper,
//   RadioGroup,
//   Radio,
//   Stack,
//   Avatar,
//   Breadcrumb,
//   BreadcrumbItem,
//   BreadcrumbLink,
//   Progress,
//   Tooltip,
//   useColorModeValue,
//   useColorMode,
//   Code,
//   List,
//   ListItem,
//   ListIcon,
//   Icon
// } from '@chakra-ui/react';
// import {
//   ChevronRightIcon,
//   // ChevronDownIcon,
//   SettingsIcon,
//   BellIcon,
//   // LockIcon,
//   EmailIcon,
//   DownloadIcon,
//   // UploadIcon,
//   CopyIcon,
//   DeleteIcon,
//   EditIcon,
//   // ViewIcon,
//   AddIcon,
//   // CheckIcon,
//   // WarningIcon,
//   // InfoIcon,
//   // TimeIcon,
//   // CalendarIcon,
//   // AttachmentIcon,
//   // UsersIcon,
//   // CreditCardIcon,
//   // GlobeIcon,
//   // MoonIcon,
//   // SunIcon,
//   // KeyIcon,
//   // DatabaseIcon,
//   // ShieldIcon,
//   // RefreshIcon
// } from '@chakra-ui/icons';
// import { FaCreditCard, FaDatabase, FaServer, FaUserShield } from 'react-icons/fa';

// const Settings = () => {
//   const { colorMode, toggleColorMode } = useColorMode();
//   const toast = useToast();
//   const { isOpen, onOpen, onClose } = useDisclosure();
//   const [activeTab, setActiveTab] = useState(0);
  
//   // State for settings
//   const [companySettings, setCompanySettings] = useState({
//     name: 'NeonSoft CDR Platform',
//     email: 'billing@neonsoft.com',
//     phone: '+1 (555) 123-4567',
//     address: '123 Tech Street, San Francisco, CA 94107',
//     currency: 'USD',
//     timezone: 'America/Los_Angeles',
//     dateFormat: 'MM/DD/YYYY',
//     taxRate: 0.0,
//     taxNumber: 'US123456789'
//   });

//   const [billingSettings, setBillingSettings] = useState({
//     invoicePrefix: 'INV',
//     nextInvoiceNumber: '2023-00125',
//     dueDays: 30,
//     lateFeePercentage: 2.0,
//     paymentMethods: ['Bank Transfer', 'Credit Card', 'PayPal'],
//     autoGenerateInvoices: true,
//     sendReminders: true,
//     reminderDays: [7, 3, 1]
//   });

//   const [cdrSettings, setCdrSettings] = useState({
//     cdrRetentionDays: 365,
//     autoProcessCDR: true,
//     fileFormats: ['CSV', 'Excel', 'JSON'],
//     maxFileSize: 50, // MB
//     defaultRatePerMinute: 0.05,
//     defaultDataRate: 200, // per GB
//     timezone: 'UTC',
//     peakHoursStart: '09:00',
//     peakHoursEnd: '17:00'
//   });

//   const [notificationSettings, setNotificationSettings] = useState({
//     emailNotifications: true,
//     invoiceCreated: true,
//     paymentReceived: true,
//     paymentOverdue: true,
//     newCDRUploaded: true,
//     systemAlerts: true,
//     dailySummary: false,
//     weeklyReport: true,
//     recipients: ['admin@neonsoft.com', 'billing@neonsoft.com']
//   });

//   const [users, setUsers] = useState([
//     { id: 1, name: 'John Doe', email: 'john@neonsoft.com', role: 'Admin', status: 'active', lastLogin: '2 hours ago' },
//     { id: 2, name: 'Jane Smith', email: 'jane@neonsoft.com', role: 'Billing Manager', status: 'active', lastLogin: '1 day ago' },
//     { id: 3, name: 'Bob Johnson', email: 'bob@neonsoft.com', role: 'CDR Analyst', status: 'active', lastLogin: '3 days ago' },
//     { id: 4, name: 'Alice Brown', email: 'alice@neonsoft.com', role: 'Viewer', status: 'inactive', lastLogin: '2 weeks ago' }
//   ]);

//   const [apiKeys, setApiKeys] = useState([
//     { id: 1, name: 'Production API', key: 'sk_live_1234567890abcdef', created: '2023-10-15', lastUsed: 'Today', permissions: ['read', 'write'] },
//     { id: 2, name: 'Development API', key: 'sk_test_abcdef1234567890', created: '2023-10-10', lastUsed: '2 days ago', permissions: ['read'] }
//   ]);

//   const [auditLogs, setAuditLogs] = useState([
//     { id: 1, user: 'John Doe', action: 'Updated company settings', timestamp: '2023-11-15 14:30', ip: '192.168.1.100' },
//     { id: 2, user: 'Jane Smith', action: 'Generated invoice report', timestamp: '2023-11-15 13:45', ip: '192.168.1.101' },
//     { id: 3, user: 'System', action: 'Auto-processed CDR files', timestamp: '2023-11-15 12:00', ip: 'System' },
//     { id: 4, user: 'Bob Johnson', action: 'Added new user', timestamp: '2023-11-15 10:15', ip: '192.168.1.102' }
//   ]);

//   const cardBg = useColorModeValue('white', 'gray.800');
//   const borderColor = useColorModeValue('gray.200', 'gray.700');

//   const handleSaveSettings = (category) => {
//     toast({
//       title: 'Settings Updated',
//       description: `${category} settings have been saved successfully`,
//       status: 'success',
//       duration: 3000,
//       isClosable: true,
//     });
//   };

//   const handleAddUser = () => {
//     // Implementation for adding user
//     onOpen();
//   };

//   const handleGenerateApiKey = () => {
//     const newKey = {
//       id: apiKeys.length + 1,
//       name: 'New API Key',
//       key: 'sk_' + Math.random().toString(36).substr(2, 24),
//       created: new Date().toISOString().split('T')[0],
//       lastUsed: 'Never',
//       permissions: ['read']
//     };
    
//     setApiKeys([...apiKeys, newKey]);
    
//     toast({
//       title: 'API Key Generated',
//       description: 'New API key has been created',
//       status: 'success',
//       duration: 3000,
//       isClosable: true,
//     });
//   };

//   const handleCopyApiKey = (key) => {
//     navigator.clipboard.writeText(key);
//     toast({
//       title: 'Copied to Clipboard',
//       description: 'API key copied successfully',
//       status: 'info',
//       duration: 2000,
//       isClosable: true,
//     });
//   };

//   const handleExportSettings = () => {
//     toast({
//       title: 'Export Started',
//       description: 'Settings export has been initiated',
//       status: 'info',
//       duration: 2000,
//       isClosable: true,
//     });
//   };

//   const handleImportSettings = () => {
//     toast({
//       title: 'Import Settings',
//       description: 'Select a settings file to import',
//       status: 'info',
//       duration: 2000,
//       isClosable: true,
//     });
//   };

//   const handleResetSettings = () => {
//     toast({
//       title: 'Reset Settings',
//       description: 'Are you sure you want to reset all settings?',
//       status: 'warning',
//       duration: 3000,
//       isClosable: true,
//     });
//   };

//   return (
//     <Container maxW="container.xl" py={8}>
//       {/* Header */}
//       <Flex justify="space-between" align="center" mb={8}>
//         <Box justifyContent={"left"}>
//           <Breadcrumb spacing="8px" separator={<ChevronRightIcon color="gray.500" />} mb={2}>
//             <BreadcrumbItem>
//               <BreadcrumbLink href="/">Dashboard</BreadcrumbLink>
//             </BreadcrumbItem>
//             <BreadcrumbItem isCurrentPage>
//               <BreadcrumbLink>Settings</BreadcrumbLink>
//             </BreadcrumbItem>
//           </Breadcrumb>
//           <Heading mb={1} size="lg">System Settings</Heading>
//           <Text color="gray.600">Configure your CDR billing platform settings</Text>
//         </Box>
        
//         <VStack spacing={2}>
//           <Button
//             leftIcon={<DownloadIcon />}
//             variant="outline"
//             onClick={handleExportSettings}
//           >
//             Export
//           </Button>
//           <Button
//             // leftIcon={<UploadIcon />}
//             variant="outline"
//             onClick={handleImportSettings}
//           >
//             Import
//           </Button>
//           <Button
//             colorScheme="blue"
//             onClick={() => handleSaveSettings('All')}
//           >
//             Save All Changes
//           </Button>
//         </VStack>
//       </Flex>

//       {/* Settings Tabs */}
//       <Tabs variant={{base:"line",md:"soft-rounded"}}  w="full" colorScheme="blue" mb={4}>
//         <TabList overflowX="auto" flexWrap="nowrap" gap={5}>
//           <Tab>
//             <SettingsIcon mr={2} />
//             General
//           </Tab>
//           <Tab>
//             {/* <CreditCardIcon mr={2} /> */}
//             Billing
//           </Tab>
//           <Tab>
//             {/* <DatabaseIcon mr={2} /> */}
//             CDR Processing
//           </Tab>
//           <Tab>
//             <BellIcon mr={2} />
//             Notifications
//           </Tab>
//           <Tab>
//             {/* <UsersIcon mr={2} /> */}
//             Users & Roles
//           </Tab>
//           <Tab>
//             {/* <KeyIcon mr={2} /> */}
//             API & Integrations
//           </Tab>
//           <Tab>
//             {/* <ShieldIcon mr={2} /> */}
//             Security
//           </Tab>
//           {/* <Tab>
//             <FaServer style={{ marginRight: '8px' }} />
//             System
//           </Tab> */}
//         </TabList>

//         <TabPanels>
//           {/* General Settings */}
//           <TabPanel px={0}>
//             <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={6}>
//               <Card bg={cardBg} border="1px" borderColor={borderColor}>
//                 <CardHeader>
//                   <Heading size="md">Company Information</Heading>
//                 </CardHeader>
//                 <CardBody>
//                   <VStack spacing={4}>
//                     <FormControl>
//                       <FormLabel>Company Name</FormLabel>
//                       <Input
//                         value={companySettings.name}
//                         onChange={(e) => setCompanySettings({...companySettings, name: e.target.value})}
//                       />
//                     </FormControl>
                    
//                     <FormControl>
//                       <FormLabel>Email Address</FormLabel>
//                       <Input
//                         type="email"
//                         value={companySettings.email}
//                         onChange={(e) => setCompanySettings({...companySettings, email: e.target.value})}
//                       />
//                     </FormControl>
                    
//                     <FormControl>
//                       <FormLabel>Phone Number</FormLabel>
//                       <Input
//                         value={companySettings.phone}
//                         onChange={(e) => setCompanySettings({...companySettings, phone: e.target.value})}
//                       />
//                     </FormControl>
                    
//                     <FormControl>
//                       <FormLabel>Address</FormLabel>
//                       <Textarea
//                         value={companySettings.address}
//                         onChange={(e) => setCompanySettings({...companySettings, address: e.target.value})}
//                         rows={3}
//                       />
//                     </FormControl>
                    
//                     <FormControl>
//                       <FormLabel>Tax ID / VAT Number</FormLabel>
//                       <Input
//                         value={companySettings.taxNumber}
//                         onChange={(e) => setCompanySettings({...companySettings, taxNumber: e.target.value})}
//                       />
//                     </FormControl>
//                   </VStack>
//                 </CardBody>
//               </Card>

//               <Card bg={cardBg} border="1px" borderColor={borderColor}>
//                 <CardHeader>
//                   <Heading size="md">Regional Settings</Heading>
//                 </CardHeader>
//                 <CardBody>
//                   <VStack spacing={4}>
//                     <FormControl>
//                       <FormLabel>Default Currency</FormLabel>
//                       <Select
//                         value={companySettings.currency}
//                         onChange={(e) => setCompanySettings({...companySettings, currency: e.target.value})}
//                       >
//                         <option value="USD">US Dollar ($)</option>
//                         <option value="EUR">Euro (€)</option>
//                         <option value="GBP">British Pound (£)</option>
//                         <option value="JPY">Japanese Yen (¥)</option>
//                       </Select>
//                     </FormControl>
                    
//                     <FormControl>
//                       <FormLabel>Time Zone</FormLabel>
//                       <Select
//                         value={companySettings.timezone}
//                         onChange={(e) => setCompanySettings({...companySettings, timezone: e.target.value})}
//                       >
//                         <option value="America/New_York">Eastern Time (ET)</option>
//                         <option value="America/Chicago">Central Time (CT)</option>
//                         <option value="America/Denver">Mountain Time (MT)</option>
//                         <option value="America/Los_Angeles">Pacific Time (PT)</option>
//                         <option value="UTC">UTC</option>
//                       </Select>
//                     </FormControl>
                    
//                     <FormControl>
//                       <FormLabel>Date Format</FormLabel>
//                       <Select
//                         value={companySettings.dateFormat}
//                         onChange={(e) => setCompanySettings({...companySettings, dateFormat: e.target.value})}
//                       >
//                         <option value="MM/DD/YYYY">MM/DD/YYYY</option>
//                         <option value="DD/MM/YYYY">DD/MM/YYYY</option>
//                         <option value="YYYY-MM-DD">YYYY-MM-DD</option>
//                       </Select>
//                     </FormControl>
                    
//                     <FormControl>
//                       <FormLabel>Tax Rate (%)</FormLabel>
//                       <NumberInput
//                         value={companySettings.taxRate}
//                         onChange={(value) => setCompanySettings({...companySettings, taxRate: parseFloat(value)})}
//                         min={0}
//                         max={100}
//                         step={0.1}
//                       >
//                         <NumberInputField />
//                         <NumberInputStepper>
//                           <NumberIncrementStepper />
//                           <NumberDecrementStepper />
//                         </NumberInputStepper>
//                       </NumberInput>
//                     </FormControl>
                    
//                     <FormControl display="flex" alignItems="center">
//                       <FormLabel mb={0}>Dark Mode</FormLabel>
//                       <Switch
//                         isChecked={colorMode === 'dark'}
//                         onChange={toggleColorMode}
//                         colorScheme="blue"
//                         ml="auto"
//                       />
//                     </FormControl>
//                   </VStack>
//                 </CardBody>
//               </Card>
//             </SimpleGrid>
            
//             <Flex justify="flex-end" mt={6}>
//               <Button
//                 colorScheme="blue"
//                 onClick={() => handleSaveSettings('General')}
//               >
//                 Save General Settings
//               </Button>
//             </Flex>
//           </TabPanel>

//           {/* Billing Settings */}
//           <TabPanel px={0}>
//             <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={6}>
//               <Card bg={cardBg} border="1px" borderColor={borderColor}>
//                 <CardHeader>
//                   <Heading size="md">Invoice Settings</Heading>
//                 </CardHeader>
//                 <CardBody>
//                   <VStack spacing={4}>
//                     <FormControl>
//                       <FormLabel>Invoice Prefix</FormLabel>
//                       <Input
//                         value={billingSettings.invoicePrefix}
//                         onChange={(e) => setBillingSettings({...billingSettings, invoicePrefix: e.target.value})}
//                         maxLength={10}
//                       />
//                     </FormControl>
                    
//                     <FormControl>
//                       <FormLabel>Next Invoice Number</FormLabel>
//                       <Input
//                         value={billingSettings.nextInvoiceNumber}
//                         onChange={(e) => setBillingSettings({...billingSettings, nextInvoiceNumber: e.target.value})}
//                       />
//                     </FormControl>
                    
//                     <FormControl>
//                       <FormLabel>Payment Due Days</FormLabel>
//                       <NumberInput
//                         value={billingSettings.dueDays}
//                         onChange={(value) => setBillingSettings({...billingSettings, dueDays: parseInt(value)})}
//                         min={1}
//                         max={90}
//                       >
//                         <NumberInputField />
//                         <NumberInputStepper>
//                           <NumberIncrementStepper />
//                           <NumberDecrementStepper />
//                         </NumberInputStepper>
//                       </NumberInput>
//                     </FormControl>
                    
//                     <FormControl>
//                       <FormLabel>Late Fee Percentage</FormLabel>
//                       <NumberInput
//                         value={billingSettings.lateFeePercentage}
//                         onChange={(value) => setBillingSettings({...billingSettings, lateFeePercentage: parseFloat(value)})}
//                         min={0}
//                         max={100}
//                         step={0.1}
//                       >
//                         <NumberInputField />
//                         <NumberInputStepper>
//                           <NumberIncrementStepper />
//                           <NumberDecrementStepper />
//                         </NumberInputStepper>
//                       </NumberInput>
//                     </FormControl>
//                   </VStack>
//                 </CardBody>
//               </Card>

//               <Card bg={cardBg} border="1px" borderColor={borderColor}>
//                 <CardHeader>
//                   <Heading size="md">Payment & Automation</Heading>
//                 </CardHeader>
//                 <CardBody>
//                   <VStack spacing={4}>
//                     <FormControl>
//                       <FormLabel>Accepted Payment Methods</FormLabel>
//                       <HStack spacing={2} wrap="wrap">
//                         {billingSettings.paymentMethods.map((method, index) => (
//                           <Tag key={index} size="md" variant="subtle" colorScheme="blue">
//                             <TagLabel>{method}</TagLabel>
//                             <TagCloseButton onClick={() => {
//                               const newMethods = billingSettings.paymentMethods.filter((_, i) => i !== index);
//                               setBillingSettings({...billingSettings, paymentMethods: newMethods});
//                             }} />
//                           </Tag>
//                         ))}
//                         <Button
//                           size="sm"
//                           leftIcon={<AddIcon />}
//                           onClick={() => {
//                             const newMethod = prompt('Enter new payment method:');
//                             if (newMethod) {
//                               setBillingSettings({
//                                 ...billingSettings,
//                                 paymentMethods: [...billingSettings.paymentMethods, newMethod]
//                               });
//                             }
//                           }}
//                         >
//                           Add
//                         </Button>
//                       </HStack>
//                     </FormControl>
                    
//                     <FormControl display="flex" alignItems="center">
//                       <FormLabel mb={0}>Auto-generate Invoices</FormLabel>
//                       <Switch
//                         isChecked={billingSettings.autoGenerateInvoices}
//                         onChange={(e) => setBillingSettings({...billingSettings, autoGenerateInvoices: e.target.checked})}
//                         colorScheme="blue"
//                         ml="auto"
//                       />
//                     </FormControl>
                    
//                     <FormControl display="flex" alignItems="center">
//                       <FormLabel mb={0}>Send Payment Reminders</FormLabel>
//                       <Switch
//                         isChecked={billingSettings.sendReminders}
//                         onChange={(e) => setBillingSettings({...billingSettings, sendReminders: e.target.checked})}
//                         colorScheme="blue"
//                         ml="auto"
//                       />
//                     </FormControl>
                    
//                     {billingSettings.sendReminders && (
//                       <FormControl>
//                         <FormLabel>Reminder Days Before Due</FormLabel>
//                         <HStack spacing={2}>
//                           {billingSettings.reminderDays.map((day, index) => (
//                             <Tag key={index} size="md">
//                               {day} days
//                             </Tag>
//                           ))}
//                         </HStack>
//                       </FormControl>
//                     )}
//                   </VStack>
//                 </CardBody>
//               </Card>
//             </SimpleGrid>
            
//             <Flex justify="flex-end" mt={6}>
//               <Button
//                 colorScheme="blue"
//                 onClick={() => handleSaveSettings('Billing')}
//               >
//                 Save Billing Settings
//               </Button>
//             </Flex>
//           </TabPanel>

//           {/* CDR Processing Settings */}
//           <TabPanel px={0}>
//             <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={6}>
//               <Card bg={cardBg} border="1px" borderColor={borderColor}>
//                 <CardHeader>
//                   <Heading size="md">CDR Processing</Heading>
//                 </CardHeader>
//                 <CardBody>
//                   <VStack spacing={4}>
//                     <FormControl>
//                       <FormLabel>CDR Retention Period (Days)</FormLabel>
//                       <NumberInput
//                         value={cdrSettings.cdrRetentionDays}
//                         onChange={(value) => setCdrSettings({...cdrSettings, cdrRetentionDays: parseInt(value)})}
//                         min={30}
//                         max={1095}
//                       >
//                         <NumberInputField />
//                         <NumberInputStepper>
//                           <NumberIncrementStepper />
//                           <NumberDecrementStepper />
//                         </NumberInputStepper>
//                       </NumberInput>
//                     </FormControl>
                    
//                     <FormControl display="flex" alignItems="center">
//                       <FormLabel mb={0}>Auto-process CDR Files</FormLabel>
//                       <Switch
//                         isChecked={cdrSettings.autoProcessCDR}
//                         onChange={(e) => setCdrSettings({...cdrSettings, autoProcessCDR: e.target.checked})}
//                         colorScheme="blue"
//                         ml="auto"
//                       />
//                     </FormControl>
                    
//                     <FormControl>
//                       <FormLabel>Accepted File Formats</FormLabel>
//                       <HStack spacing={2} wrap="wrap">
//                         {cdrSettings.fileFormats.map((format, index) => (
//                           <Badge key={index} colorScheme="green">
//                             {format}
//                           </Badge>
//                         ))}
//                       </HStack>
//                     </FormControl>
                    
//                     <FormControl>
//                       <FormLabel>Maximum File Size (MB)</FormLabel>
//                       <NumberInput
//                         value={cdrSettings.maxFileSize}
//                         onChange={(value) => setCdrSettings({...cdrSettings, maxFileSize: parseInt(value)})}
//                         min={1}
//                         max={1000}
//                       >
//                         <NumberInputField />
//                         <NumberInputStepper>
//                           <NumberIncrementStepper />
//                           <NumberDecrementStepper />
//                         </NumberInputStepper>
//                       </NumberInput>
//                     </FormControl>
//                   </VStack>
//                 </CardBody>
//               </Card>

//               <Card bg={cardBg} border="1px" borderColor={borderColor}>
//                 <CardHeader>
//                   <Heading size="md">Rate Settings</Heading>
//                 </CardHeader>
//                 <CardBody>
//                   <VStack spacing={4}>
//                     <FormControl>
//                       <FormLabel>Default Voice Rate (per minute)</FormLabel>
//                       <NumberInput
//                         value={cdrSettings.defaultRatePerMinute}
//                         onChange={(value) => setCdrSettings({...cdrSettings, defaultRatePerMinute: parseFloat(value)})}
//                         min={0}
//                         step={0.001}
//                       >
//                         <NumberInputField />
//                         <NumberInputStepper>
//                           <NumberIncrementStepper />
//                           <NumberDecrementStepper />
//                         </NumberInputStepper>
//                       </NumberInput>
//                     </FormControl>
                    
//                     <FormControl>
//                       <FormLabel>Default Data Rate (per GB)</FormLabel>
//                       <NumberInput
//                         value={cdrSettings.defaultDataRate}
//                         onChange={(value) => setCdrSettings({...cdrSettings, defaultDataRate: parseFloat(value)})}
//                         min={0}
//                         step={1}
//                       >
//                         <NumberInputField />
//                         <NumberInputStepper>
//                           <NumberIncrementStepper />
//                           <NumberDecrementStepper />
//                         </NumberInputStepper>
//                       </NumberInput>
//                     </FormControl>
                    
//                     <FormControl>
//                       <FormLabel>Processing Timezone</FormLabel>
//                       <Select
//                         value={cdrSettings.timezone}
//                         onChange={(e) => setCdrSettings({...cdrSettings, timezone: e.target.value})}
//                       >
//                         <option value="UTC">UTC</option>
//                         <option value="America/New_York">Eastern Time</option>
//                         <option value="America/Los_Angeles">Pacific Time</option>
//                       </Select>
//                     </FormControl>
                    
//                     <SimpleGrid columns={2} spacing={4} width="full">
//                       <FormControl>
//                         <FormLabel>Peak Hours Start</FormLabel>
//                         <Input
//                           type="time"
//                           value={cdrSettings.peakHoursStart}
//                           onChange={(e) => setCdrSettings({...cdrSettings, peakHoursStart: e.target.value})}
//                         />
//                       </FormControl>
                      
//                       <FormControl>
//                         <FormLabel>Peak Hours End</FormLabel>
//                         <Input
//                           type="time"
//                           value={cdrSettings.peakHoursEnd}
//                           onChange={(e) => setCdrSettings({...cdrSettings, peakHoursEnd: e.target.value})}
//                         />
//                       </FormControl>
//                     </SimpleGrid>
//                   </VStack>
//                 </CardBody>
//               </Card>
//             </SimpleGrid>
            
//             <Flex justify="flex-end" mt={6}>
//               <Button
//                 colorScheme="blue"
//                 onClick={() => handleSaveSettings('CDR Processing')}
//               >
//                 Save CDR Settings
//               </Button>
//             </Flex>
//           </TabPanel>

//           {/* Notification Settings */}
//           <TabPanel px={0}>
//             <Card bg={cardBg} border="1px" borderColor={borderColor}>
//               <CardHeader>
//                 <Heading size="md">Email Notifications</Heading>
//               </CardHeader>
//               <CardBody>
//                 <VStack spacing={6} align="stretch">
//                   <FormControl display="flex" alignItems="center">
//                     <FormLabel mb={0}>Enable Email Notifications</FormLabel>
//                     <Switch
//                       isChecked={notificationSettings.emailNotifications}
//                       onChange={(e) => setNotificationSettings({...notificationSettings, emailNotifications: e.target.checked})}
//                       colorScheme="blue"
//                       ml="auto"
//                     />
//                   </FormControl>
                  
//                   {notificationSettings.emailNotifications && (
//                     <>
//                       <Divider />
                      
//                       <Heading size="sm">Notification Types</Heading>
                      
//                       <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
//                         <FormControl display="flex" alignItems="center">
//                           <FormLabel mb={0}>Invoice Created</FormLabel>
//                           <Switch
//                             isChecked={notificationSettings.invoiceCreated}
//                             onChange={(e) => setNotificationSettings({...notificationSettings, invoiceCreated: e.target.checked})}
//                             colorScheme="blue"
//                             ml="auto"
//                           />
//                         </FormControl>
                        
//                         <FormControl display="flex" alignItems="center">
//                           <FormLabel mb={0}>Payment Received</FormLabel>
//                           <Switch
//                             isChecked={notificationSettings.paymentReceived}
//                             onChange={(e) => setNotificationSettings({...notificationSettings, paymentReceived: e.target.checked})}
//                             colorScheme="blue"
//                             ml="auto"
//                           />
//                         </FormControl>
                        
//                         <FormControl display="flex" alignItems="center">
//                           <FormLabel mb={0}>Payment Overdue</FormLabel>
//                           <Switch
//                             isChecked={notificationSettings.paymentOverdue}
//                             onChange={(e) => setNotificationSettings({...notificationSettings, paymentOverdue: e.target.checked})}
//                             colorScheme="blue"
//                             ml="auto"
//                           />
//                         </FormControl>
                        
//                         <FormControl display="flex" alignItems="center">
//                           <FormLabel mb={0}>New CDR Uploaded</FormLabel>
//                           <Switch
//                             isChecked={notificationSettings.newCDRUploaded}
//                             onChange={(e) => setNotificationSettings({...notificationSettings, newCDRUploaded: e.target.checked})}
//                             colorScheme="blue"
//                             ml="auto"
//                           />
//                         </FormControl>
                        
//                         <FormControl display="flex" alignItems="center">
//                           <FormLabel mb={0}>System Alerts</FormLabel>
//                           <Switch
//                             isChecked={notificationSettings.systemAlerts}
//                             onChange={(e) => setNotificationSettings({...notificationSettings, systemAlerts: e.target.checked})}
//                             colorScheme="blue"
//                             ml="auto"
//                           />
//                         </FormControl>
                        
//                         <FormControl display="flex" alignItems="center">
//                           <FormLabel mb={0}>Daily Summary</FormLabel>
//                           <Switch
//                             isChecked={notificationSettings.dailySummary}
//                             onChange={(e) => setNotificationSettings({...notificationSettings, dailySummary: e.target.checked})}
//                             colorScheme="blue"
//                             ml="auto"
//                           />
//                         </FormControl>
                        
//                         <FormControl display="flex" alignItems="center">
//                           <FormLabel mb={0}>Weekly Report</FormLabel>
//                           <Switch
//                             isChecked={notificationSettings.weeklyReport}
//                             onChange={(e) => setNotificationSettings({...notificationSettings, weeklyReport: e.target.checked})}
//                             colorScheme="blue"
//                             ml="auto"
//                           />
//                         </FormControl>
//                       </SimpleGrid>
                      
//                       <Divider />
                      
//                       <FormControl>
//                         <FormLabel>Notification Recipients</FormLabel>
//                         <VStack spacing={2} align="stretch">
//                           {notificationSettings.recipients.map((recipient, index) => (
//                             <HStack key={index}>
//                               <Input value={recipient} readOnly />
//                               <IconButton
//                                 aria-label="Remove recipient"
//                                 icon={<DeleteIcon />}
//                                 size="sm"
//                                 colorScheme="red"
//                                 variant="ghost"
//                                 onClick={() => {
//                                   const newRecipients = notificationSettings.recipients.filter((_, i) => i !== index);
//                                   setNotificationSettings({...notificationSettings, recipients: newRecipients});
//                                 }}
//                               />
//                             </HStack>
//                           ))}
//                           <Button
//                             leftIcon={<AddIcon />}
//                             size="sm"
//                             onClick={() => {
//                               const newRecipient = prompt('Enter email address:');
//                               if (newRecipient) {
//                                 setNotificationSettings({
//                                   ...notificationSettings,
//                                   recipients: [...notificationSettings.recipients, newRecipient]
//                                 });
//                               }
//                             }}
//                           >
//                             Add Recipient
//                           </Button>
//                         </VStack>
//                       </FormControl>
                      
//                       <FormControl>
//                         <FormLabel>Test Email Configuration</FormLabel>
//                         <Button
//                           leftIcon={<EmailIcon />}
//                           variant="outline"
//                           onClick={() => {
//                             toast({
//                               title: 'Test Email Sent',
//                               description: 'A test email has been sent to your address',
//                               status: 'success',
//                               duration: 3000,
//                               isClosable: true,
//                             });
//                           }}
//                         >
//                           Send Test Email
//                         </Button>
//                       </FormControl>
//                     </>
//                   )}
//                 </VStack>
//               </CardBody>
//             </Card>
            
//             <Flex justify="flex-end" mt={6}>
//               <Button
//                 colorScheme="blue"
//                 onClick={() => handleSaveSettings('Notifications')}
//               >
//                 Save Notification Settings
//               </Button>
//             </Flex>
//           </TabPanel>

//           {/* Users & Roles */}
//           <TabPanel px={0}>
//             <Card bg={cardBg} border="1px" borderColor={borderColor} mb={6}>
//               <CardHeader>
//                 <Flex justify="space-between" align="center">
//                   <Heading size="md">Users & Permissions</Heading>
//                   <Button
//                     leftIcon={<AddIcon />}
//                     colorScheme="blue"
//                     onClick={handleAddUser}
//                   >
//                     Add User
//                   </Button>
//                 </Flex>
//               </CardHeader>
//               <CardBody>
//                 <Box overflowX={"auto"}>
//                 <Table variant="simple">
//                   <Thead>
//                     <Tr>
//                       <Th>Name</Th>
//                       <Th>Email</Th>
//                       <Th>Role</Th>
//                       <Th>Status</Th>
//                       <Th>Last Login</Th>
//                       <Th>Actions</Th>
//                     </Tr>
//                   </Thead>
//                   <Tbody>
//                     {users.map((user) => (
//                       <Tr key={user.id}>
//                         <Td>
//                           <HStack>
//                             <Avatar size="sm" name={user.name} />
//                             <Text fontWeight="medium">{user.name}</Text>
//                           </HStack>
//                         </Td>
//                         <Td>{user.email}</Td>
//                         <Td>
//                           <Badge
//                             colorScheme={
//                               user.role === 'Admin' ? 'red' :
//                               user.role === 'Billing Manager' ? 'blue' :
//                               user.role === 'CDR Analyst' ? 'green' : 'gray'
//                             }
//                           >
//                             {user.role}
//                           </Badge>
//                         </Td>
//                         <Td>
//                           <Badge
//                             colorScheme={user.status === 'active' ? 'green' : 'gray'}
//                           >
//                             {user.status}
//                           </Badge>
//                         </Td>
//                         <Td>{user.lastLogin}</Td>
//                         <Td>
//                           <HStack spacing={2}>
//                             <IconButton
//                               aria-label="Edit user"
//                               icon={<EditIcon />}
//                               size="sm"
//                               variant="ghost"
//                             />
//                             <IconButton
//                               aria-label="Delete user"
//                               icon={<DeleteIcon />}
//                               size="sm"
//                               variant="ghost"
//                               colorScheme="red"
//                             />
//                           </HStack>
//                         </Td>
//                       </Tr>
//                     ))}
//                   </Tbody>
//                 </Table>
//                 </Box>
//               </CardBody>
//             </Card>
//           </TabPanel>

//           {/* API & Integrations */}
//           <TabPanel px={0}>
//             <Card bg={cardBg} border="1px" borderColor={borderColor} mb={6}>
//               <CardHeader>
//                 <Flex justify="space-between" align="center">
//                   <Heading size="md">API Keys</Heading>
//                   <Button
//                     // leftIcon={<KeyIcon />}
//                     colorScheme="blue"
//                     onClick={handleGenerateApiKey}
//                   >
//                     Generate New Key
//                   </Button>
//                 </Flex>
//               </CardHeader>
//               <CardBody>
//                 <Alert status="warning" mb={6}>
//                   <AlertIcon />
//                   <Box>
//                     <AlertTitle>Security Warning</AlertTitle>
//                     <AlertDescription>
//                       Keep your API keys secure. Do not share them in client-side code or public repositories.
//                     </AlertDescription>
//                   </Box>
//                 </Alert>
                
//                 <Table variant="simple">
//                   <Thead>
//                     <Tr>
//                       <Th>Name</Th>
//                       <Th>API Key</Th>
//                       <Th>Created</Th>
//                       <Th>Last Used</Th>
//                       <Th>Permissions</Th>
//                       <Th>Actions</Th>
//                     </Tr>
//                   </Thead>
//                   <Tbody>
//                     {apiKeys.map((apiKey) => (
//                       <Tr key={apiKey.id}>
//                         <Td>{apiKey.name}</Td>
//                         <Td>
//                           <Code fontSize="xs">{apiKey.key.substring(0, 12)}...</Code>
//                         </Td>
//                         <Td>{apiKey.created}</Td>
//                         <Td>{apiKey.lastUsed}</Td>
//                         <Td>
//                           <HStack spacing={2}>
//                             {apiKey.permissions.map((perm, index) => (
//                               <Badge key={index} colorScheme="blue">
//                                 {perm}
//                               </Badge>
//                             ))}
//                           </HStack>
//                         </Td>
//                         <Td>
//                           <HStack spacing={2}>
//                             <Tooltip label="Copy API Key">
//                               <IconButton
//                                 aria-label="Copy key"
//                                 icon={<CopyIcon />}
//                                 size="sm"
//                                 variant="ghost"
//                                 onClick={() => handleCopyApiKey(apiKey.key)}
//                               />
//                             </Tooltip>
//                             <IconButton
//                               aria-label="Delete key"
//                               icon={<DeleteIcon />}
//                               size="sm"
//                               variant="ghost"
//                               colorScheme="red"
//                             />
//                           </HStack>
//                         </Td>
//                       </Tr>
//                     ))}
//                   </Tbody>
//                 </Table>
//               </CardBody>
//             </Card>

//             <Card bg={cardBg} border="1px" borderColor={borderColor}>
//               <CardHeader>
//                 <Heading size="md">Webhooks</Heading>
//               </CardHeader>
//               <CardBody>
//                 <Text mb={4}>Configure webhooks to receive real-time notifications.</Text>
//                 <Button
//                   leftIcon={<AddIcon />}
//                   variant="outline"
//                 >
//                   Add Webhook Endpoint
//                 </Button>
//               </CardBody>
//             </Card>
//           </TabPanel>

//           {/* Security Settings */}
//           <TabPanel px={0}>
//             <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={6}>
//               <Card bg={cardBg} border="1px" borderColor={borderColor}>
//                 <CardHeader>
//                   <Heading size="md">Password Policy</Heading>
//                 </CardHeader>
//                 <CardBody>
//                   <VStack spacing={4}>
//                     <FormControl>
//                       <FormLabel>Minimum Password Length</FormLabel>
//                       <NumberInput defaultValue={8} min={6} max={32}>
//                         <NumberInputField />
//                         <NumberInputStepper>
//                           <NumberIncrementStepper />
//                           <NumberDecrementStepper />
//                         </NumberInputStepper>
//                       </NumberInput>
//                     </FormControl>
                    
//                     <FormControl display="flex" alignItems="center">
//                       <FormLabel mb={0}>Require Special Characters</FormLabel>
//                       <Switch defaultChecked colorScheme="blue" ml="auto" />
//                     </FormControl>
                    
//                     <FormControl display="flex" alignItems="center">
//                       <FormLabel mb={0}>Require Numbers</FormLabel>
//                       <Switch defaultChecked colorScheme="blue" ml="auto" />
//                     </FormControl>
                    
//                     <FormControl display="flex" alignItems="center">
//                       <FormLabel mb={0}>Require Uppercase Letters</FormLabel>
//                       <Switch defaultChecked colorScheme="blue" ml="auto" />
//                     </FormControl>
                    
//                     <FormControl>
//                       <FormLabel>Password Expiration (Days)</FormLabel>
//                       <NumberInput defaultValue={90} min={30} max={365}>
//                         <NumberInputField />
//                         <NumberInputStepper>
//                           <NumberIncrementStepper />
//                           <NumberDecrementStepper />
//                         </NumberInputStepper>
//                       </NumberInput>
//                     </FormControl>
//                   </VStack>
//                 </CardBody>
//               </Card>

//               <Card bg={cardBg} border="1px" borderColor={borderColor}>
//                 <CardHeader>
//                   <Heading size="md">Session & Access</Heading>
//                 </CardHeader>
//                 <CardBody>
//                   <VStack spacing={4}>
//                     <FormControl>
//                       <FormLabel>Session Timeout (Minutes)</FormLabel>
//                       <NumberInput defaultValue={30} min={5} max={480}>
//                         <NumberInputField />
//                         <NumberInputStepper>
//                           <NumberIncrementStepper />
//                           <NumberDecrementStepper />
//                         </NumberInputStepper>
//                       </NumberInput>
//                     </FormControl>
                    
//                     <FormControl display="flex" alignItems="center">
//                       <FormLabel mb={0}>Enable Two-Factor Authentication</FormLabel>
//                       <Switch colorScheme="blue" ml="auto" />
//                     </FormControl>
                    
//                     <FormControl display="flex" alignItems="center">
//                       <FormLabel mb={0}>Force HTTPS</FormLabel>
//                       <Switch defaultChecked colorScheme="blue" ml="auto" />
//                     </FormControl>
                    
//                     <FormControl display="flex" alignItems="center">
//                       <FormLabel mb={0}>IP Whitelisting</FormLabel>
//                       <Switch colorScheme="blue" ml="auto" />
//                     </FormControl>
                    
//                     <FormControl>
//                       <FormLabel>Maximum Login Attempts</FormLabel>
//                       <NumberInput defaultValue={5} min={3} max={10}>
//                         <NumberInputField />
//                         <NumberInputStepper>
//                           <NumberIncrementStepper />
//                           <NumberDecrementStepper />
//                         </NumberInputStepper>
//                       </NumberInput>
//                     </FormControl>
//                   </VStack>
//                 </CardBody>
//               </Card>
//             </SimpleGrid>
            
//             <Card bg={cardBg} border="1px" borderColor={borderColor} mt={6}>
//               <CardHeader>
//                 <Heading size="md">Audit Log</Heading>
//               </CardHeader>
//               <CardBody>
//                 <Table variant="simple" size="sm">
//                   <Thead>
//                     <Tr>
//                       <Th>Timestamp</Th>
//                       <Th>User</Th>
//                       <Th>Action</Th>
//                       <Th>IP Address</Th>
//                     </Tr>
//                   </Thead>
//                   <Tbody>
//                     {auditLogs.map((log) => (
//                       <Tr key={log.id}>
//                         <Td>{log.timestamp}</Td>
//                         <Td>{log.user}</Td>
//                         <Td>{log.action}</Td>
//                         <Td>{log.ip}</Td>
//                       </Tr>
//                     ))}
//                   </Tbody>
//                 </Table>
//               </CardBody>
//             </Card>
//           </TabPanel>

//           {/* System Settings */}
//           {/* <TabPanel px={0}>
//             <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={6}>
//               <Card bg={cardBg} border="1px" borderColor={borderColor}>
//                 <CardHeader>
//                   <Heading size="md">System Information</Heading>
//                 </CardHeader>
//                 <CardBody>
//                   <VStack spacing={4} align="stretch">
//                     <Box>
//                       <Text fontWeight="medium" color="gray.600">Platform Version</Text>
//                       <Text>v2.1.4</Text>
//                     </Box>
                    
//                     <Box>
//                       <Text fontWeight="medium" color="gray.600">Database</Text>
//                       <Text>PostgreSQL 14.5</Text>
//                     </Box>
                    
//                     <Box>
//                       <Text fontWeight="medium" color="gray.600">Last Backup</Text>
//                       <Text>2023-11-15 02:00 UTC</Text>
//                     </Box>
                    
//                     <Box>
//                       <Text fontWeight="medium" color="gray.600">System Uptime</Text>
//                       <Text>45 days, 12 hours</Text>
//                     </Box>
                    
//                     <Box>
//                       <Text fontWeight="medium" color="gray.600">Storage Usage</Text>
//                       <Progress value={65} colorScheme="blue" size="sm" mt={2} />
//                       <Text fontSize="sm" color="gray.600">15.2 GB / 25 GB used</Text>
//                     </Box>
//                   </VStack>
//                 </CardBody>
//               </Card>

//               <Card bg={cardBg} border="1px" borderColor={borderColor}>
//                 <CardHeader>
//                   <Heading size="md">Maintenance</Heading>
//                 </CardHeader>
//                 <CardBody>
//                   <VStack spacing={4}>
//                     <Button
//                       // leftIcon={<RefreshIcon />}
//                       colorScheme="blue"
//                       width="full"
//                       onClick={() => {
//                         toast({
//                           title: 'Cache Cleared',
//                           description: 'System cache has been cleared',
//                           status: 'success',
//                           duration: 3000,
//                           isClosable: true,
//                         });
//                       }}
//                     >
//                       Clear Cache
//                     </Button>
                    
//                     <Button
//                       // leftIcon={<DatabaseIcon />}
//                       variant="outline"
//                       width="full"
//                       onClick={() => {
//                         toast({
//                           title: 'Backup Initiated',
//                           description: 'System backup has been started',
//                           status: 'info',
//                           duration: 3000,
//                           isClosable: true,
//                         });
//                       }}
//                     >
//                       Create Backup
//                     </Button>
                    
//                     <Button
//                       leftIcon={<DeleteIcon />}
//                       variant="outline"
//                       colorScheme="red"
//                       width="full"
//                       onClick={handleResetSettings}
//                     >
//                       Reset to Defaults
//                     </Button>
//                   </VStack>
//                 </CardBody>
//               </Card>
//             </SimpleGrid>

//             <Card bg={cardBg} border="1px" borderColor={borderColor} mt={6}>
//               <CardHeader>
//                 <Heading size="md">Advanced Settings</Heading>
//               </CardHeader>
//               <CardBody>
//                 <Accordion allowMultiple>
//                   <AccordionItem>
//                     <h2>
//                       <AccordionButton>
//                         <Box flex="1" textAlign="left">
//                           <Heading size="sm">Logging Configuration</Heading>
//                         </Box>
//                         <AccordionIcon />
//                       </AccordionButton>
//                     </h2>
//                     <AccordionPanel pb={4}>
//                       <VStack spacing={4}>
//                         <FormControl>
//                           <FormLabel>Log Level</FormLabel>
//                           <Select defaultValue="info">
//                             <option value="debug">Debug</option>
//                             <option value="info">Info</option>
//                             <option value="warn">Warn</option>
//                             <option value="error">Error</option>
//                           </Select>
//                         </FormControl>
                        
//                         <FormControl display="flex" alignItems="center">
//                           <FormLabel mb={0}>Enable Audit Logging</FormLabel>
//                           <Switch defaultChecked colorScheme="blue" ml="auto" />
//                         </FormControl>
//                       </VStack>
//                     </AccordionPanel>
//                   </AccordionItem>

//                   <AccordionItem>
//                     <h2>
//                       <AccordionButton>
//                         <Box flex="1" textAlign="left">
//                           <Heading size="sm">Performance Settings</Heading>
//                         </Box>
//                         <AccordionIcon />
//                       </AccordionButton>
//                     </h2>
//                     <AccordionPanel pb={4}>
//                       <VStack spacing={4}>
//                         <FormControl>
//                           <FormLabel>CDR Processing Batch Size</FormLabel>
//                           <NumberInput defaultValue={1000} min={100} max={10000}>
//                             <NumberInputField />
//                             <NumberInputStepper>
//                               <NumberIncrementStepper />
//                               <NumberDecrementStepper />
//                             </NumberInputStepper>
//                           </NumberInput>
//                         </FormControl>
                        
//                         <FormControl display="flex" alignItems="center">
//                           <FormLabel mb={0}>Enable Query Caching</FormLabel>
//                           <Switch defaultChecked colorScheme="blue" ml="auto" />
//                         </FormControl>
//                       </VStack>
//                     </AccordionPanel>
//                   </AccordionItem>
//                 </Accordion>
//               </CardBody>
//             </Card>
//           </TabPanel> */}
//         </TabPanels>
//       </Tabs>

//       {/* Danger Zone */}
//       <Card bg="red.50" border="1px" borderColor="red.200" mt={8}>
//         <CardHeader>
//           <Heading size="md" color="red.700">Danger Zone</Heading>
//         </CardHeader>
//         <CardBody>
//           <VStack spacing={4} align="stretch">
//             <Text color="red.600">
//               These actions are irreversible. Please proceed with caution.
//             </Text>
            
//             <HStack>
//               <Button
//                 leftIcon={<DeleteIcon />}
//                 colorScheme="red"
//                 variant="outline"
//                 onClick={() => {
//                   if (window.confirm('Are you sure you want to delete all data? This action cannot be undone.')) {
//                     toast({
//                       title: 'Data Deletion',
//                       description: 'All data deletion has been initiated',
//                       status: 'warning',
//                       duration: 5000,
//                       isClosable: true,
//                     });
//                   }
//                 }}
//               >
//                 Delete All Data
//               </Button>
              
//               <Button
//                 leftIcon={<FaUserShield />}
//                 colorScheme="red"
//                 variant="solid"
//                 onClick={() => {
//                   if (window.confirm('This will permanently delete your account and all associated data.')) {
//                     toast({
//                       title: 'Account Deletion',
//                       description: 'Account deletion has been scheduled',
//                       status: 'error',
//                       duration: 5000,
//                       isClosable: true,
//                     });
//                   }
//                 }}
//               >
//                 Delete Account
//               </Button>
//             </HStack>
//           </VStack>
//         </CardBody>
//       </Card>

//       {/* Add User Modal */}
//       <Modal isOpen={isOpen} onClose={onClose} size="lg">
//         <ModalOverlay />
//         <ModalContent>
//           <ModalHeader>Add New User</ModalHeader>
//           <ModalCloseButton />
//           <ModalBody>
//             <VStack spacing={4}>
//               <FormControl>
//                 <FormLabel>Full Name</FormLabel>
//                 <Input placeholder="Enter full name" />
//               </FormControl>
              
//               <FormControl>
//                 <FormLabel>Email Address</FormLabel>
//                 <Input type="email" placeholder="Enter email address" />
//               </FormControl>
              
//               <FormControl>
//                 <FormLabel>Role</FormLabel>
//                 <Select>
//                   <option value="admin">Admin</option>
//                   <option value="billing">Billing Manager</option>
//                   <option value="analyst">CDR Analyst</option>
//                   <option value="viewer">Viewer</option>
//                 </Select>
//               </FormControl>
              
//               <FormControl>
//                 <FormLabel>Send Invitation Email</FormLabel>
//                 <Switch defaultChecked />
//               </FormControl>
//             </VStack>
//           </ModalBody>
//           <ModalFooter>
//             <Button variant="ghost" mr={3} onClick={onClose}>
//               Cancel
//             </Button>
//             <Button colorScheme="blue" onClick={onClose}>
//               Add User
//             </Button>
//           </ModalFooter>
//         </ModalContent>
//       </Modal>
//     </Container>
//   );
// };

// export default Settings;



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
    <Container maxW="container.xl" py={2}>
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
    </Container>
  );
};

export default Settings;