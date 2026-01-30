import React, { useState, useEffect } from "react";
import {
  Box,
  Container,
  Heading,
  VStack,
  Text,
  Button,
  useToast,
  HStack,
  Badge,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  MenuDivider,
  MenuGroup,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Input,
  Select,
  FormControl,
  FormLabel,
  Card,
  CardBody,
  SimpleGrid,
  IconButton,
  Icon,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  Spacer,
  Grid,
  Flex,
  Progress,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  StatArrow,
  Avatar,
  AvatarGroup,
  Tag,
  TagLabel,
  TagLeftIcon,
  TagRightIcon,
  Divider,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Wrap,
  WrapItem,
  Tooltip,
  useColorModeValue,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  TableContainer,
  Link,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  InputGroup,
  CardHeader,
  Accordion,
} from "@chakra-ui/react";
import {
  FiFileText,
  FiDownload,
  FiEye,
  FiMail,
  FiPrinter,
  FiPlus,
  FiSend,
  FiFile,
  FiEdit,
  FiClock,
  FiCheckCircle,
  FiAlertTriangle,
  FiXCircle,
  FiTrash2,
  FiFilter,
  FiDollarSign,
  FiRefreshCw,
  FiCalendar,
  FiUser,
  FiChevronRight,
  FiChevronDown,
  FiBarChart2,
  FiTrendingUp,
  FiTrendingDown,
  FiCreditCard,
  FiShoppingBag,
  FiBell,
  FiSearch,
  FiMoreVertical,
  FiSettings,
  FiHome,
} from "react-icons/fi";
import DataTable from "../components/DataTable";
import ExportButton from "../components/ExportButton";
import {
  getInvoices,
  saveInvoices,
  getCustomers,
  getCDRs,
} from "../utils/storage";
import { calculateInvoice } from "../utils/calculations";
import { format, differenceInDays, isBefore, subDays } from "date-fns";

const Invoices = () => {
  const [invoices, setInvoices] = useState([]);
  const [filteredInvoices, setFilteredInvoices] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [generateForm, setGenerateForm] = useState({
    customerId: "",
    periodStart: format(new Date().setDate(1), "yyyy-MM-dd"),
    periodEnd: format(new Date(), "yyyy-MM-dd"),
    billingCycle: "monthly",
  });
  
  const [dashboardStats, setDashboardStats] = useState({
    totalRevenue: 0,
    pendingRevenue: 0,
    collectedRevenue: 0,
    overdueAmount: 0,
    totalCalls: 0,
    averageInvoice: 0,
    paidInvoices: 0,
    pendingInvoices: 0,
    overdueInvoices: 0,
    collectionRate: 0,
  });
  
  const [activeTab, setActiveTab] = useState("all");
  const toast = useToast();
  const bgColor = useColorModeValue("white", "gray.800");
  const borderColor = useColorModeValue("gray.200", "gray.700");

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    filterInvoices();
    calculateDashboardStats();
  }, [invoices, searchTerm, statusFilter]);

  const loadData = () => {
    const storedInvoices = getInvoices();
    const storedCustomers = getCustomers();
    setInvoices(storedInvoices);
    setFilteredInvoices(storedInvoices);
    setCustomers(storedCustomers);
  };

  const filterInvoices = () => {
    let filtered = [...invoices];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (invoice) =>
          invoice.invoiceNumber?.toLowerCase().includes(term) ||
          invoice.customerName?.toLowerCase().includes(term) ||
          invoice.customerId?.toLowerCase().includes(term)
      );
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter((invoice) => invoice.status === statusFilter);
    }

    setFilteredInvoices(filtered);
  };

  const calculateDashboardStats = () => {
    const now = new Date();
    const thirtyDaysAgo = subDays(now, 30);
    
    const paidInvoices = invoices.filter(inv => inv.status === "paid");
    const pendingInvoices = invoices.filter(inv => inv.status === "sent" || inv.status === "generated");
    const overdueInvoices = invoices.filter(inv => inv.status === "overdue");
    
    const totalRevenue = invoices.reduce((sum, inv) => sum + parseFloat(inv.totalAmount || 0), 0);
    const pendingRevenue = pendingInvoices.reduce((sum, inv) => sum + parseFloat(inv.totalAmount || 0), 0);
    const collectedRevenue = paidInvoices.reduce((sum, inv) => sum + parseFloat(inv.totalAmount || 0), 0);
    const overdueAmount = overdueInvoices.reduce((sum, inv) => sum + parseFloat(inv.totalAmount || 0), 0);
    
    const totalCalls = invoices.reduce((sum, inv) => sum + (inv.totalCalls || 0), 0);
    const averageInvoice = invoices.length > 0 ? totalRevenue / invoices.length : 0;
    const collectionRate = totalRevenue > 0 ? (collectedRevenue / totalRevenue) * 100 : 0;
    
    // Recent activity (last 30 days)
    const recentInvoices = invoices.filter(inv => 
      new Date(inv.generatedDate) >= thirtyDaysAgo
    );
    
    setDashboardStats({
      totalRevenue,
      pendingRevenue,
      collectedRevenue,
      overdueAmount,
      totalCalls,
      averageInvoice,
      paidInvoices: paidInvoices.length,
      pendingInvoices: pendingInvoices.length,
      overdueInvoices: overdueInvoices.length,
      collectionRate,
      recentInvoices: recentInvoices.length,
    });
  };

  const handleGenerateInvoice = () => {
    const customer = customers.find((c) => c.id === generateForm.customerId);
    if (!customer) {
      toast({
        title: "Customer not found",
        description: "Please select a valid customer",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    const cdrs = getCDRs();
    const periodStart = new Date(generateForm.periodStart);
    const periodEnd = new Date(generateForm.periodEnd);

    const customerCdrs = cdrs.filter(
      (cdr) =>
        (cdr.customeraccount === generateForm.customerId || cdr.customer_id === generateForm.customerId) &&
        new Date(cdr.starttime) >= periodStart &&
        new Date(cdr.starttime) <= periodEnd
    );

    if (customerCdrs.length === 0) {
      toast({
        title: "No CDRs found",
        description: "No call records found for the selected customer and period",
        status: "warning",
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    const invoice = calculateInvoice(customerCdrs, customer);

    const newInvoice = {
      id: `INV${Date.now().toString().slice(-8)}`,
      invoiceNumber: `INV-${Date.now().toString().slice(-6)}`,
      ...invoice,
      periodStart: generateForm.periodStart,
      periodEnd: generateForm.periodEnd,
      generatedDate: new Date().toISOString(),
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      status: "generated",
      billingCycle: generateForm.billingCycle,
      items: customerCdrs.map((cdr) => ({
        callId: cdr.id,
        date: cdr.starttime,
        caller: cdr.callere164,
        callee: cdr.calleee164,
        duration: cdr.duration || cdr.duration_seconds,
        rate: cdr.rate || cdr.cost_per_minute,
        amount: cdr.fee || cdr.fee_amount,
      })),
    };

    const storedInvoices = getInvoices();
    const updatedInvoices = [...storedInvoices, newInvoice];
    saveInvoices(updatedInvoices);

    loadData();
    setIsGenerateModalOpen(false);
    setGenerateForm({
      customerId: "",
      periodStart: format(new Date().setDate(1), "yyyy-MM-dd"),
      periodEnd: format(new Date(), "yyyy-MM-dd"),
      billingCycle: "monthly",
    });

    toast({
      title: "Invoice generated",
      description: `Invoice ${newInvoice.invoiceNumber} has been generated successfully`,
      status: "success",
      duration: 3000,
      isClosable: true,
      position: "top-right",
    });
  };

  const handleViewInvoice = (invoice) => {
    setSelectedInvoice(invoice);
    setIsViewModalOpen(true);
  };

  const handleDownloadInvoice = (invoice) => {
    // Implementation remains the same
    const invoiceHtml = `
      <html>
        <head>
          <title>Invoice ${invoice.invoiceNumber}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 40px; }
            .header { text-align: center; margin-bottom: 40px; }
            .details { margin-bottom: 30px; }
            .details table { width: 100%; border-collapse: collapse; }
            .details td { padding: 8px; border: 1px solid #ddd; }
            .items { margin-bottom: 30px; }
            .items table { width: 100%; border-collapse: collapse; }
            .items th, .items td { padding: 12px; border: 1px solid #ddd; text-align: left; }
            .total { text-align: right; font-size: 18px; font-weight: bold; }
            .footer { margin-top: 50px; text-align: center; color: #666; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>INVOICE</h1>
            <h2>${invoice.invoiceNumber}</h2>
          </div>
          <div class="details">
            <table>
              <tr>
                <td><strong>Customer:</strong> ${invoice.customerName}</td>
                <td><strong>Invoice Date:</strong> ${format(
                  new Date(invoice.generatedDate),
                  "dd/MM/yyyy"
                )}</td>
              </tr>
              <tr>
                <td><strong>Period:</strong> ${format(
                  new Date(invoice.periodStart),
                  "dd/MM/yyyy"
                )} - ${format(new Date(invoice.periodEnd), "dd/MM/yyyy")}</td>
                <td><strong>Due Date:</strong> ${format(
                  new Date(invoice.dueDate),
                  "dd/MM/yyyy"
                )}</td>
              </tr>
            </table>
          </div>
          <div class="items">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Caller</th>
                  <th>Callee</th>
                  <th>Duration</th>
                  <th>Rate</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                ${invoice.items
                  .map(
                    (item) => `
                  <tr>
                    <td>${format(new Date(item.date), "dd/MM/yyyy HH:mm")}</td>
                    <td>${item.caller}</td>
                    <td>${item.callee}</td>
                    <td>${item.duration}s</td>
                    <td>$${item.rate}/sec</td>
                    <td>$${item.amount.toFixed(4)}</td>
                  </tr>
                `
                  )
                  .join("")}
              </tbody>
            </table>
          </div>
          <div class="total">
            <p>Subtotal: $${invoice.totalFee.toFixed(2)}</p>
            <p>Tax (${(invoice.taxRate * 100).toFixed(0)}%): $${invoice.totalTax.toFixed(2)}</p>
            <p>Total Amount: $${invoice.totalAmount.toFixed(2)}</p>
          </div>
          <div class="footer">
            <p>Thank you for your business!</p>
            <p>This is a computer-generated invoice. No signature required.</p>
          </div>
        </body>
      </html>
    `;

    const win = window.open("", "_blank");
    win.document.write(invoiceHtml);
    win.document.close();
    win.focus();

    toast({
      title: "Invoice opened",
      description: "Invoice opened in new window for printing",
      status: "success",
      duration: 3000,
      isClosable: true,
      position: "top-right",
    });
  };

  const handleSendEmail = (invoice) => {
    const customer = customers.find((c) => c.id === invoice.customerId);
    if (!customer?.email) {
      toast({
        title: "No email address",
        description: "Customer does not have an email address",
        status: "warning",
        duration: 3000,
        isClosable: true,
        position: "top-right",
      });
      return;
    }

    const subject = `Invoice ${invoice.invoiceNumber}`;
    const body = `Dear ${
      invoice.customerName
    },\n\nPlease find attached your invoice ${
      invoice.invoiceNumber
    }.\n\nTotal Amount: $${invoice.totalAmount.toFixed(2)}\nDue Date: ${format(
      new Date(invoice.dueDate),
      "dd/MM/yyyy"
    )}\n\nThank you for your business!\n\nThis is a test email from the CDR Billing System.`;

    const mailtoLink = `mailto:${customer.email}?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(body)}`;
    window.location.href = mailtoLink;

    toast({
      title: "Email opened",
      description: "Email client opened with invoice details",
      status: "info",
      duration: 3000,
      isClosable: true,
      position: "top-right",
    });
  };

  const handleUpdateStatus = (invoiceId, newStatus) => {
    const storedInvoices = getInvoices();
    const updatedInvoices = storedInvoices.map((inv) =>
      inv.id === invoiceId ? { ...inv, status: newStatus } : inv
    );
    saveInvoices(updatedInvoices);
    loadData();

    toast({
      title: "Status updated",
      description: `Invoice status updated to ${newStatus}`,
      status: "success",
      duration: 3000,
      isClosable: true,
      position: "top-right",
    });
  };

  // Get status color
  const getStatusColor = (status) => {
    switch (status) {
      case "paid": return "green";
      case "overdue": return "red";
      case "sent": return "orange";
      case "generated": return "blue";
      case "cancelled": return "gray";
      default: return "gray";
    }
  };

  // Get status icon
  const getStatusIcon = (status) => {
    switch (status) {
      case "paid": return FiCheckCircle;
      case "overdue": return FiAlertTriangle;
      case "sent": return FiSend;
      case "generated": return FiFileText;
      case "cancelled": return FiXCircle;
      default: return FiFileText;
    }
  };

  // Mock functions for menu actions (keep your existing logic)
  const handleAutoGenerateInvoices = () => {
    toast({
      title: "Auto-generate initiated",
      description: "Auto-generating invoices for all due customers",
      status: "info",
      duration: 3000,
      isClosable: true,
      position: "top-right",
    });
  };

  const handleSendBulkEmail = () => {
    toast({
      title: "Bulk email initiated",
      description: "Preparing to send bulk emails",
      status: "info",
      duration: 3000,
      isClosable: true,
      position: "top-right",
    });
  };

  const handleSendSelectedInvoices = () => {
    toast({
      title: "Sending selected invoices",
      description: "Processing selected invoices for sending",
      status: "info",
      duration: 3000,
      isClosable: true,
      position: "top-right",
    });
  };

  const handleDownloadSelected = () => {
    toast({
      title: "Download initiated",
      description: "Preparing selected invoices for download",
      status: "info",
      duration: 3000,
      isClosable: true,
      position: "top-right",
    });
  };

  const handleExportToSage = () => {
    toast({
      title: "Sage export initiated",
      description: "Exporting invoices to Sage accounting software",
      status: "info",
      duration: 3000,
      isClosable: true,
      position: "top-right",
    });
  };

  const handlePrintSelected = () => {
    toast({
      title: "Print initiated",
      description: "Preparing selected invoices for printing",
      status: "info",
      duration: 3000,
      isClosable: true,
      position: "top-right",
    });
  };

  const handleBulkStatusChange = (status) => {
    toast({
      title: "Bulk status update",
      description: `Marking selected invoices as ${status}`,
      status: "info",
      duration: 3000,
      isClosable: true,
      position: "top-right",
    });
  };

  const handleRegenerateSelected = () => {
    toast({
      title: "Regenerate selected",
      description: "Regenerating selected invoices",
      status: "info",
      duration: 3000,
      isClosable: true,
      position: "top-right",
    });
  };

  const handleDeleteSelected = () => {
    toast({
      title: "Delete selected",
      description: "Deleting selected invoices",
      status: "warning",
      duration: 3000,
      isClosable: true,
      position: "top-right",
    });
  };

  return (
    <Container maxW="100%" px={8} py={6}>
      {/* Breadcrumb Navigation */}
      <Breadcrumb spacing={2} mb={8} separator={<FiChevronRight />}>
        <BreadcrumbItem>
          <BreadcrumbLink href="/" display="flex" alignItems="center">
            <FiHome />
            <Text ml={2}>Home</Text>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbItem isCurrentPage>
          <BreadcrumbLink>Invoices</BreadcrumbLink>
        </BreadcrumbItem>
      </Breadcrumb>

      {/* Header Section */}
      <Flex justify="space-between" align="center" mb={8}>
        <Box>
          <Heading size="xl" color="gray.800" mb={2}>
            Invoice Management
          </Heading>
          <Text color="gray.600" fontSize="md">
            Manage customer invoices, track payments, and generate reports
          </Text>
        </Box>
        <HStack spacing={4}>
          {/* Keep your existing Generate Invoice menu */}
          <Menu>
            <MenuButton
              as={Button}
              leftIcon={<FiPlus />}
              colorScheme="blue"
              size="md"
              px={6}
              _hover={{ transform: 'translateY(-2px)', boxShadow: 'lg' }}
              transition="all 0.2s"
            >
              Generate Invoice
            </MenuButton>
            <MenuList>
              <MenuItem
                icon={<FiFileText />}
                onClick={() => setIsGenerateModalOpen(true)}
              >
                Manual Invoice
                <Text fontSize="xs" color="gray.500">
                  Generate invoice for specific customer/period
                </Text>
              </MenuItem>
              <MenuItem
                icon={<FiRefreshCw />}
                onClick={handleAutoGenerateInvoices}
              >
                Automatic Invoices
                <Text fontSize="xs" color="gray.500">
                  Generate invoices for all due customers
                </Text>
              </MenuItem>
            </MenuList>
          </Menu>

          {/* Keep your existing Actions menu */}
          <Menu>
            <MenuButton
              as={Button}
              leftIcon={<FiSettings />}
              variant="outline"
              size="md"
            >
              Actions
            </MenuButton>
            <MenuList>
              {/* Send Invoice Section */}
              <MenuItem
                icon={<FiMail />}
                onClick={handleSendBulkEmail}
              >
                Send Bulk Email
              </MenuItem>
              <MenuItem
                icon={<FiSend />}
                onClick={handleSendSelectedInvoices}
              >
                Send Selected Invoices
              </MenuItem>

              <MenuDivider />

              {/* Download & Export Section */}
              <MenuItem
                icon={<FiDownload />}
                onClick={handleDownloadSelected}
              >
                Download Selected
              </MenuItem>
              <MenuItem icon={<FiFile />} onClick={handleExportToSage}>
                <Box>
                  <Text>Sage Export</Text>
                  <Text fontSize="xs" color="gray.500">
                    Export to accounting software
                  </Text>
                </Box>
              </MenuItem>
              <MenuItem
                icon={<FiPrinter />}
                onClick={handlePrintSelected}
              >
                Print Selected
              </MenuItem>

              <MenuDivider />

              {/* Status Management Section */}
              <MenuGroup title="Change Status">
                <MenuItem
                  icon={<FiCheckCircle />}
                  onClick={() => handleBulkStatusChange("paid")}
                >
                  Mark as Paid
                </MenuItem>
                <MenuItem
                  icon={<FiClock />}
                  onClick={() => handleBulkStatusChange("sent")}
                >
                  Mark as Sent
                </MenuItem>
                <MenuItem
                  icon={<FiAlertTriangle />}
                  onClick={() => handleBulkStatusChange("overdue")}
                >
                  Mark as Overdue
                </MenuItem>
                <MenuItem
                  icon={<FiXCircle />}
                  onClick={() => handleBulkStatusChange("cancelled")}
                >
                  Mark as Cancelled
                </MenuItem>
              </MenuGroup>

              <MenuDivider />

              {/* Management Actions */}
              <MenuItem
                icon={<FiEdit />}
                onClick={handleRegenerateSelected}
              >
                Regenerate Selected
              </MenuItem>
              <MenuItem
                icon={<FiTrash2 />}
                onClick={handleDeleteSelected}
                color="red.500"
              >
                Delete Selected
              </MenuItem>
            </MenuList>
          </Menu>
        </HStack>
      </Flex>

      {/* Enhanced Dashboard Stats */}
      <Grid templateColumns={{ base: "1fr", md: "2fr 1fr" }} gap={8} mb={8}>
        {/* Main Stats Cards */}
        <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={6}>
          <Card bg="white" shadow="md" borderWidth="1px" borderColor={borderColor} borderRadius={"12px"}>
            <CardBody>
              <Stat>
                <StatLabel color="gray.600" fontSize="sm">Total Revenue</StatLabel>
                <StatNumber color="green.600" fontSize="2xl">
                  ${dashboardStats.totalRevenue.toFixed(2)}
                </StatNumber>
                <StatHelpText>
                  <StatArrow type="increase" />
                  12.5% from last month
                </StatHelpText>
              </Stat>
            </CardBody>
          </Card>

          <Card bg="white" shadow="md" borderWidth="1px" borderColor={borderColor} borderRadius={"12px"}>
            <CardBody>
              <Stat>
                <StatLabel color="gray.600" fontSize="sm">Pending Revenue</StatLabel>
                <StatNumber color="orange.600" fontSize="2xl">
                  ${dashboardStats.pendingRevenue.toFixed(2)}
                </StatNumber>
                <StatHelpText>
                  {dashboardStats.pendingInvoices} invoices pending
                </StatHelpText>
              </Stat>
            </CardBody>
          </Card>

          <Card bg="white" shadow="md" borderWidth="1px" borderColor={borderColor} borderRadius={"12px"}>
            <CardBody>
              <Stat>
                <StatLabel color="gray.600" fontSize="sm">Overdue Amount</StatLabel>
                <StatNumber color="red.600" fontSize="2xl">
                  ${dashboardStats.overdueAmount.toFixed(2)}
                </StatNumber>
                <StatHelpText>
                  {dashboardStats.overdueInvoices} overdue invoices
                </StatHelpText>
              </Stat>
            </CardBody>
          </Card>

          <Card bg="white" shadow="md" borderWidth="1px" borderColor={borderColor} borderRadius={"12px"}>
            <CardBody>
              <Stat>
                <StatLabel color="gray.600" fontSize="sm">Collection Rate</StatLabel>
                <StatNumber color="blue.600" fontSize="2xl">
                  {dashboardStats.collectionRate.toFixed(1)}%
                </StatNumber>
                <StatHelpText>
                  <Progress value={dashboardStats.collectionRate} size="sm" colorScheme="blue" />
                </StatHelpText>
              </Stat>
            </CardBody>
          </Card>
        </SimpleGrid>

        {/* Quick Insights Panel */}
        <Card bg="blue.50" shadow="md">
          <CardBody>
            <VStack align="stretch" spacing={4}>
              <Heading size="md" color="blue.700">Quick Insights</Heading>
              <VStack align="stretch" spacing={2}>
                <Flex justify="space-between" align="center">
                  <Text fontSize="sm">Average Invoice Value</Text>
                  <Badge colorScheme="green">${dashboardStats.averageInvoice.toFixed(2)}</Badge>
                </Flex>
                <Flex justify="space-between" align="center">
                  <Text fontSize="sm">Total Calls Billed</Text>
                  <Badge colorScheme="purple">{dashboardStats.totalCalls}</Badge>
                </Flex>
                <Flex justify="space-between" align="center">
                  <Text fontSize="sm">Paid Invoices</Text>
                  <Badge colorScheme="green">{dashboardStats.paidInvoices}</Badge>
                </Flex>
                <Flex justify="space-between" align="center">
                  <Text fontSize="sm">Recent Invoices (30d)</Text>
                  <Badge colorScheme="blue">{dashboardStats.recentInvoices}</Badge>
                </Flex>
              </VStack>
              <Button
                size="sm"
                colorScheme="blue"
                variant="outline"
                leftIcon={<FiBarChart2 />}
                mt={2}
              >
                View Full Report
              </Button>
            </VStack>
          </CardBody>
        </Card>
      </Grid>

      {/* Tabs for Invoice Categories */}
      <Tabs 
        variant="line" 
        colorScheme="blue" 
        mb={6}
        onChange={(index) => {
          const tabs = ["all", "pending", "paid", "overdue"];
          setStatusFilter(tabs[index] || "all");
        }}
      >
        <TabList gap={8}>
          <Tab>
            <FiFileText style={{ marginRight: "8px" }} />
            <HStack spacing={2}>
           <Text> All Invoices</Text> <Badge colorScheme={"blue"}>{invoices.length}</Badge>
            </HStack>
          </Tab>
          <Tab>
            <FiClock style={{ marginRight: "8px" }} />
            <HStack>
            <Text>Pending</Text> <Badge colorScheme="yellow">{dashboardStats.pendingInvoices}</Badge>
            </HStack>
          </Tab>
          <Tab>
            <FiCheckCircle style={{ marginRight: "8px" }} />
            <HStack>
            <Text>Paid</Text><Badge colorScheme="green">{dashboardStats.paidInvoices}</Badge>
            </HStack>
          </Tab>
          <Tab>
            <FiAlertTriangle style={{ marginRight: "8px" }} />
            <HStack>
            <Text> Overdue</Text> <Badge colorScheme="red">{dashboardStats.overdueInvoices}</Badge>
            </HStack>
          </Tab>
        </TabList>
      </Tabs>

      {/* Search and Filter Bar */}
      {/* <Card mb={6} shadow="sm" borderWidth="1px" borderColor={borderColor}>
        <CardBody>
          <Flex direction={{ base: "column", md: "row" }} gap={4} align="center">
            <InputGroup flex={1}>
              <InputLeftElement pointerEvents="none">
                <FiSearch color="gray.400" />
              </InputLeftElement>
              <Input
                placeholder="Search invoices by ID, customer, or amount..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                size="lg"
                borderRadius="md"
              />
            </InputGroup>
            
            <Flex gap={3} align="center" w={{ base: "100%", md: "auto" }}>
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                size="lg"
                w={{ base: "100%", md: "200px" }}
              >
                <option value="all">All Status</option>
                <option value="generated">Generated</option>
                <option value="sent">Sent</option>
                <option value="paid">Paid</option>
                <option value="overdue">Overdue</option>
                <option value="cancelled">Cancelled</option>
              </Select>
              
              <ExportButton data={filteredInvoices} fileName="invoices" />
            </Flex>
          </Flex>
        </CardBody>
      </Card>

      Enhanced Invoice Table */}
      <Card shadow="lg" borderWidth="1px" borderColor={borderColor}>
        <CardHeader bg="gray.50" borderBottomWidth="1px">
          <Flex justify="space-between" align="center">
            <Heading size="md">Invoice List ({filteredInvoices.length})</Heading>
            <Text color="gray.600" fontSize="sm">
              Showing {filteredInvoices.length} of {invoices.length} invoices
            </Text>
          </Flex>
        </CardHeader>
        
        <TableContainer>
          <Table variant="simple">
            <Thead bg="gray.200">
              <Tr>
                <Th >Invoice #</Th>
                <Th>Customer</Th>
                <Th>Period</Th>
                <Th>Amount</Th>
                <Th>Due Date</Th>
                <Th>Status</Th>
                <Th>Actions</Th>
              </Tr>
            </Thead>
            <Tbody>
              {filteredInvoices.map((invoice) => {
                const StatusIcon = getStatusIcon(invoice.status);
                const isOverdue = invoice.status === "overdue" || 
                  (invoice.status === "sent" && 
                   differenceInDays(new Date(), new Date(invoice.dueDate)) > 0);
                
                return (
                  <Tr key={invoice.id} _hover={{ bg: "gray.50" }} transition="background-color 0.2s">
                    <Td>
                      <VStack align="start" spacing={1}>
                        <Text fontWeight="bold" color="blue.600">
                          {invoice.invoiceNumber}
                        </Text>
                        <Text fontSize="xs" color="gray.500">
                          {format(new Date(invoice.generatedDate), "MMM dd, yyyy")}
                        </Text>
                      </VStack>
                    </Td>
                    <Td>
                      <HStack>
                        <Avatar size="sm" name={invoice.customerName} />
                        <Box>
                          <Text fontWeight="medium">{invoice.customerName}</Text>
                          <Text fontSize="sm" color="gray.600">{invoice.customerId}</Text>
                        </Box>
                      </HStack>
                    </Td>
                    <Td>
                      <VStack align="start" spacing={1}>
                        <Text fontSize="sm">
                          {format(new Date(invoice.periodStart), "MMM dd")}
                        </Text>
                        <Text fontSize="xs" color="gray.500">
                          to {format(new Date(invoice.periodEnd), "MMM dd, yyyy")}
                        </Text>
                      </VStack>
                    </Td>
                    <Td>
                      <VStack align="start" spacing={1}>
                        <Text fontWeight="bold" color="green.600" fontSize="lg">
                          ${parseFloat(invoice.totalAmount || 0).toFixed(2)}
                        </Text>
                        <Text fontSize="xs" color="gray.500">
                          {invoice.totalCalls || 0} calls
                        </Text>
                      </VStack>
                    </Td>
                    <Td>
                      <VStack align="start" spacing={1}>
                        <Text color={isOverdue ? "red.500" : "inherit"}>
                          {format(new Date(invoice.dueDate), "MMM dd, yyyy")}
                        </Text>
                        {isOverdue && (
                          <Badge colorScheme="red" variant="subtle" size="sm">
                            {differenceInDays(new Date(), new Date(invoice.dueDate))}d overdue
                          </Badge>
                        )}
                      </VStack>
                    </Td>
                    <Td>
                      <Badge
                        colorScheme={getStatusColor(invoice.status)}
                        display="flex"
                        alignItems="center"
                        gap={2}
                        px={3}
                        py={1}
                        borderRadius="full"
                      >
                        <StatusIcon />
                        {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                      </Badge>
                    </Td>
                    <Td>
                      <HStack spacing={2}>
                        <Tooltip label="View Details">
                          <IconButton
                            icon={<FiEye />}
                            size="sm"
                            colorScheme="blue"
                            variant="ghost"
                            onClick={() => handleViewInvoice(invoice)}
                          />
                        </Tooltip>
                        <Tooltip label="Download">
                          <IconButton
                            icon={<FiDownload />}
                            size="sm"
                            colorScheme="green"
                            variant="ghost"
                            onClick={() => handleDownloadInvoice(invoice)}
                          />
                        </Tooltip>
                        <Tooltip label="Send Email">
                          <IconButton
                            icon={<FiMail />}
                            size="sm"
                            colorScheme="orange"
                            variant="ghost"
                            onClick={() => handleSendEmail(invoice)}
                          />
                        </Tooltip>
                        <Menu>
                          <Tooltip label="More Actions">
                            <MenuButton
                              as={IconButton}
                              icon={<FiMoreVertical />}
                              size="sm"
                              variant="ghost"
                            />
                          </Tooltip>
                          <MenuList>
                            <MenuItem
                              icon={<FiEdit />}
                              onClick={() => handleViewInvoice(invoice)}
                            >
                              Edit Invoice
                            </MenuItem>
                            <MenuItem
                              icon={<FiCheckCircle />}
                              onClick={() => handleUpdateStatus(invoice.id, "paid")}
                            >
                              Mark as Paid
                            </MenuItem>
                            <MenuItem
                              icon={<FiClock />}
                              onClick={() => handleUpdateStatus(invoice.id, "sent")}
                            >
                              Mark as Sent
                            </MenuItem>
                            <MenuItem
                              icon={<FiAlertTriangle />}
                              onClick={() => handleUpdateStatus(invoice.id, "overdue")}
                            >
                              Mark as Overdue
                            </MenuItem>
                            <MenuDivider />
                            <MenuItem
                              icon={<FiTrash2 />}
                              color="red.500"
                              onClick={() => handleDeleteSelected()}
                            >
                              Delete Invoice
                            </MenuItem>
                          </MenuList>
                        </Menu>
                      </HStack>
                    </Td>
                  </Tr>
                );
              })}
            </Tbody>
          </Table>
        </TableContainer>

        {filteredInvoices.length === 0 && (
          <Box p={10} textAlign="center">
            <FiFileText size={48} color="#CBD5E0" style={{ margin: '0 auto 16px' }} />
            <Text color="gray.500" fontSize="lg" mb={2}>
              No invoices found
            </Text>
            <Text color="gray.400" fontSize="sm">
              {searchTerm || statusFilter !== "all" 
                ? "Try adjusting your search or filter criteria"
                : "Generate your first invoice to get started"}
            </Text>
          </Box>
        )}

        {/* Pagination/Footer */}
        {filteredInvoices.length > 0 && (
          <CardFooter borderTopWidth="1px" py={4}>
            <Flex justify="space-between" align="center" w="100%">
              <Text color="gray.600" fontSize="sm">
                Showing {Math.min(filteredInvoices.length, 10)} of {filteredInvoices.length} invoices
              </Text>
              <HStack spacing={2}>
                <Button size="sm" variant="outline" leftIcon={<FiChevronRight />} isDisabled>
                  Previous
                </Button>
                <Button size="sm" variant="outline" rightIcon={<FiChevronRight />}>
                  Next
                </Button>
              </HStack>
            </Flex>
          </CardFooter>
        )}
      </Card>

      {/* View Invoice Modal (Enhanced) */}
      <Modal
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
        size="6xl"
      >
        <ModalOverlay />
        <ModalContent maxH="90vh" overflow="hidden">
          <ModalHeader borderBottomWidth="1px">
            <Flex justify="space-between" align="center">
              <Box>
                <Heading size="md">Invoice Details</Heading>
                <Text color="gray.600" fontSize="sm">
                  {selectedInvoice?.invoiceNumber} • {selectedInvoice?.customerName}
                </Text>
              </Box>
              <Badge
                colorScheme={getStatusColor(selectedInvoice?.status)}
                fontSize="md"
                px={3}
                py={1}
                borderRadius="full"
              >
                {selectedInvoice?.status?.toUpperCase()}
              </Badge>
            </Flex>
          </ModalHeader>
          <ModalCloseButton />
          
          <ModalBody overflowY="auto">
            {selectedInvoice && (
              <Grid templateColumns={{ base: "1fr", lg: "2fr 1fr" }} gap={8}>
                {/* Left Column - Invoice Details */}
                <Box>
                  {/* Customer & Invoice Info */}
                  <Card mb={4}>
                    <CardBody>
                      <SimpleGrid columns={2} spacing={6}>
                        <Box>
                          <Text fontSize="sm" color="gray.600" mb={1}>Bill To</Text>
                          <Text fontSize="lg" fontWeight="bold">{selectedInvoice.customerName}</Text>
                          <Text color="gray.600">{selectedInvoice.customerId}</Text>
                        </Box>
                        <Box>
                          <Text fontSize="sm" color="gray.600" mb={1}>Invoice Details</Text>
                          <VStack align="start" spacing={1}>
                            <Text><strong>Invoice #:</strong> {selectedInvoice.invoiceNumber}</Text>
                            <Text><strong>Generated:</strong> {format(new Date(selectedInvoice.generatedDate), "MMMM dd, yyyy")}</Text>
                            <Text><strong>Due Date:</strong> {format(new Date(selectedInvoice.dueDate), "MMMM dd, yyyy")}</Text>
                            <Text><strong>Period:</strong> {format(new Date(selectedInvoice.periodStart), "MMM dd")} - {format(new Date(selectedInvoice.periodEnd), "MMM dd, yyyy")}</Text>
                          </VStack>
                        </Box>
                      </SimpleGrid>
                    </CardBody>
                  </Card>

                  {/* Call Items Table */}
                  <Card mb={4}>
                    <CardHeader bg="gray.50" borderBottomWidth="1px">
                      <Heading size="sm">Call Details</Heading>
                    </CardHeader>
                    <CardBody>
                      <TableContainer>
                        <Table size="sm">
                          <Thead>
                            <Tr>
                              <Th>Date & Time</Th>
                              <Th>From</Th>
                              <Th>To</Th>
                              <Th isNumeric>Duration</Th>
                              <Th isNumeric>Rate</Th>
                              <Th isNumeric>Amount</Th>
                            </Tr>
                          </Thead>
                          <Tbody>
                            {selectedInvoice.items?.map((item, index) => (
                              <Tr key={index} _hover={{ bg: "gray.50" }}>
                                <Td>{format(new Date(item.date), "MMM dd, HH:mm")}</Td>
                                <Td>{item.caller}</Td>
                                <Td>{item.callee}</Td>
                                <Td isNumeric>{item.duration}s</Td>
                                <Td isNumeric>${item.rate}/sec</Td>
                                <Td isNumeric>${item.amount.toFixed(4)}</Td>
                              </Tr>
                            ))}
                          </Tbody>
                        </Table>
                      </TableContainer>
                    </CardBody>
                  </Card>
                </Box>

                {/* Right Column - Summary & Actions */}
                <Box>
                  {/* Summary Card */}
                  <Card mb={4} position="sticky" top="20px">
                    <CardHeader bg="blue.50" borderBottomWidth="1px">
                      <Heading size="sm">Invoice Summary</Heading>
                    </CardHeader>
                    <CardBody>
                      <VStack spacing={3} align="stretch">
                        <Flex justify="space-between">
                          <Text color="gray.600">Subtotal</Text>
                          <Text fontWeight="bold">${selectedInvoice.totalFee.toFixed(2)}</Text>
                        </Flex>
                        <Flex justify="space-between">
                          <Text color="gray.600">Tax ({(selectedInvoice.taxRate * 100).toFixed(0)}%)</Text>
                          <Text color="orange.600">${selectedInvoice.totalTax.toFixed(2)}</Text>
                        </Flex>
                        <Flex justify="space-between">
                          <Text color="gray.600">Discount</Text>
                          <Text color="green.600">$0.00</Text>
                        </Flex>
                        <Divider />
                        <Flex justify="space-between" fontSize="xl">
                          <Text fontWeight="bold">Total Amount</Text>
                          <Text fontWeight="bold" color="green.600">
                            ${selectedInvoice.totalAmount.toFixed(2)}
                          </Text>
                        </Flex>
                      </VStack>
                    </CardBody>
                  </Card>

                  {/* Actions Card */}
                  <Card>
                    <CardHeader bg="gray.50" borderBottomWidth="1px">
                      <Heading size="sm">Quick Actions</Heading>
                    </CardHeader>
                    <CardBody>
                      <VStack spacing={3}>
                        <Button
                          leftIcon={<FiPrinter />}
                          colorScheme="blue"
                          w="100%"
                          onClick={() => handleDownloadInvoice(selectedInvoice)}
                        >
                          Print Invoice
                        </Button>
                        <Button
                          leftIcon={<FiMail />}
                          colorScheme="orange"
                          w="100%"
                          onClick={() => handleSendEmail(selectedInvoice)}
                        >
                          Send via Email
                        </Button>
                        <Button
                          leftIcon={<FiDownload />}
                          variant="outline"
                          w="100%"
                          onClick={() => handleDownloadInvoice(selectedInvoice)}
                        >
                          Download PDF
                        </Button>
                        <Menu>
                          <MenuButton
                            as={Button}
                            leftIcon={<FiMoreVertical />}
                            variant="ghost"
                            w="100%"
                          >
                            More Actions
                          </MenuButton>
                          <MenuList>
                            <MenuItem
                              icon={<FiCheckCircle />}
                              onClick={() => handleUpdateStatus(selectedInvoice.id, "paid")}
                            >
                              Mark as Paid
                            </MenuItem>
                            <MenuItem
                              icon={<FiClock />}
                              onClick={() => handleUpdateStatus(selectedInvoice.id, "sent")}
                            >
                              Mark as Sent
                            </MenuItem>
                            <MenuItem
                              icon={<FiAlertTriangle />}
                              onClick={() => handleUpdateStatus(selectedInvoice.id, "overdue")}
                            >
                              Mark as Overdue
                            </MenuItem>
                          </MenuList>
                        </Menu>
                      </VStack>
                    </CardBody>
                  </Card>
                </Box>
              </Grid>
            )}
          </ModalBody>
          <ModalFooter borderTopWidth="1px">
            <Button variant="ghost" mr={3} onClick={() => setIsViewModalOpen(false)}>
              Close
            </Button>
            <Button
              colorScheme="blue"
              onClick={() => {
                handleUpdateStatus(selectedInvoice.id, "paid");
                setIsViewModalOpen(false);
              }}
            >
              Mark as Paid & Close
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Generate Invoice Modal (Enhanced) */}
      <Modal
        isOpen={isGenerateModalOpen}
        onClose={() => setIsGenerateModalOpen(false)}
        size="xl"
      >
        <ModalOverlay />
        <ModalContent>
          <ModalHeader borderTopRadius={"md"} bg={"blue.500"} borderBottomWidth="1px">
            <Heading size="md" color={"white"}>Generate New Invoice</Heading>
          </ModalHeader>
          <ModalCloseButton color={"white"} />
          
          <ModalBody>
            <VStack spacing={6} align="stretch">
              {/* Customer Selection */}
              <FormControl isRequired>
                <FormLabel>Select Customer</FormLabel>
                <Select
                  placeholder="Choose a customer..."
                  value={generateForm.customerId}
                  onChange={(e) =>
                    setGenerateForm({
                      ...generateForm,
                      customerId: e.target.value,
                    })
                  }
                  size="md"
                >
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name} ({customer.id}) - {customer.email}
                    </option>
                  ))}
                </Select>
              </FormControl>

              {/* Billing Period */}
              <Box>
                <FormLabel>Billing Period</FormLabel>
                <HStack spacing={4}>
                  <FormControl isRequired>
                    <Input
                      type="date"
                      value={generateForm.periodStart}
                      onChange={(e) =>
                        setGenerateForm({
                          ...generateForm,
                          periodStart: e.target.value,
                        })
                      }
                      size="md"
                    />
                  </FormControl>
                  <Text>to</Text>
                  <FormControl isRequired>
                    <Input
                      type="date"
                      value={generateForm.periodEnd}
                      onChange={(e) =>
                        setGenerateForm({
                          ...generateForm,
                          periodEnd: e.target.value,
                        })
                      }
                      size="md"
                    />
                  </FormControl>
                </HStack>
              </Box>

              {/* Billing Cycle */}
              <FormControl>
                <FormLabel>Billing Cycle</FormLabel>
                <Select
                  value={generateForm.billingCycle}
                  onChange={(e) =>
                    setGenerateForm({
                      ...generateForm,
                      billingCycle: e.target.value,
                    })
                  }
                  size="md"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="annually">Annually</option>
                </Select>
              </FormControl>

              {/* Customer Preview */}
              {generateForm.customerId && (
                <Alert status="info" borderRadius="md">
                  <AlertIcon />
                  <Box>
                    <AlertTitle>Selected Customer</AlertTitle>
                    <AlertDescription>
                      {(() => {
                        const customer = customers.find(
                          (c) => c.id === generateForm.customerId
                        );
                        return customer ? (
                          <VStack align="start" spacing={1}>
                            <Text><strong>Name:</strong> {customer.name}</Text>
                            <Text><strong>Rate:</strong> ${customer.rate}/sec</Text>
                            <Text><strong>Tax Rate:</strong> {(customer.taxRate * 100).toFixed(0)}%</Text>
                            <Text><strong>Email:</strong> {customer.email}</Text>
                          </VStack>
                        ) : null;
                      })()}
                    </AlertDescription>
                  </Box>
                </Alert>
              )}
            </VStack>
          </ModalBody>
          <ModalFooter borderTopWidth="1px">
            <Button
              variant="outline"
              mr={3}
              onClick={() => setIsGenerateModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              colorScheme="blue"
              onClick={handleGenerateInvoice}
              isDisabled={!generateForm.customerId}
              leftIcon={<FiFileText />}
              size="md"
            >
              Generate Invoice
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Container>
  );
};

// Add missing CardFooter component
const CardFooter = ({ children, ...props }) => (
  <Box as="footer" {...props}>
    {children}
</Box>
);

// Add missing InputLeftElement component
const InputLeftElement = ({ children, ...props }) => (
  <Box position="absolute" left="0" top="0" height="100%" display="flex" alignItems="center" pl="3" {...props}>
    {children}
  </Box>
);

export default Invoices;