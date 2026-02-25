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
  Checkbox,
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
  FiChevronLeft,
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
  FiChevronsLeft,
} from "react-icons/fi";
import DataTable from "../components/DataTable";
import ExportButton from "../components/ExportButton";
import ViewInvoiceModal from "../components/modals/ViewInvoiceModal";
import GenerateInvoiceModal from "../components/modals/GenerateInvoiceModal";
import RecordPaymentModal from "../components/modals/RecordPaymentModal";
import {
  fetchInvoiceItems,
  fetchInvoices,
  generateInvoice as apiGenerateInvoice,
  fetchReportAccounts,
  deleteInvoice as apiDeleteInvoice,
  updateInvoiceStatus,
  recordPayment,
  downloadInvoice,
} from "../utils/api";
import { format, differenceInDays, isBefore, subDays } from "date-fns";

const Invoices = () => {
  const [invoices, setInvoices] = useState([]);
  const [filteredInvoices, setFilteredInvoices] = useState([]);
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [generateForm, setGenerateForm] = useState({
    // invoiceType: "customer",
    customerId: "",
    periodStart: format(new Date().setDate(1), "yyyy-MM-dd"),
    periodEnd: format(new Date(), "yyyy-MM-dd"),
    billingCycle: "monthly",
  });
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    customerId: "",
    amount: "",
    paymentDate: format(new Date(), "yyyy-MM-dd"),
    paymentMethod: "bank_transfer",
    transactionId: "",
    referenceNumber: "",
    notes: "",
    invoiceId: "", // Optional, if recording for a specific invoice
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

  const loadData = async () => {
    try {
      const [invoicesRes, customersData] = await Promise.all([
        fetchInvoices(),
        fetchReportAccounts(),
      ]);

      const invoicesData = invoicesRes.success ? invoicesRes.data : [];
      setInvoices(invoicesData);
      setFilteredInvoices(invoicesData);
      setCustomers(customersData.success ? customersData.customers : []);
    } catch (error) {
      console.error("Error loading data:", error);
      toast({
        title: "Error loading data",
        description: error.message,
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const filterInvoices = () => {
    let filtered = [...invoices];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (invoice) =>
          invoice.invoiceNumber?.toLowerCase().includes(term) ||
          invoice.customerName?.toLowerCase().includes(term) ||
          invoice.customerId?.toLowerCase().includes(term),
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

    const paidInvoices = invoices.filter((inv) => inv.status === "paid");
    const sentInvoices = invoices.filter((inv) => inv.status === "sent");
    const pendingInvoices = invoices.filter((inv) =>
      ["generated", "pending", "partial"].includes(inv.status),
    );
    const overdueInvoices = invoices.filter((inv) => inv.status === "overdue");

    const totalRevenue = invoices.reduce(
      (sum, inv) => sum + parseFloat(inv.totalAmount || 0),
      0,
    );
    const pendingRevenue = invoices
      .filter((inv) =>
        ["sent", "generated", "pending", "partial", "overdue"].includes(
          inv.status,
        ),
      )
      .reduce((sum, inv) => sum + parseFloat(inv.balanceAmount || 0), 0);
    const collectedRevenue = invoices.reduce(
      (sum, inv) => sum + parseFloat(inv.paidAmount || 0),
      0,
    );
    const overdueAmount = overdueInvoices.reduce(
      (sum, inv) => sum + parseFloat(inv.balanceAmount || 0),
      0,
    );

    const totalCalls = invoices.reduce((sum, inv) => {
      return sum + (parseInt(inv.totalCalls) || 0);
    }, 0);

    const averageInvoice =
      invoices.length > 0 ? totalRevenue / invoices.length : 0;
    const collectionRate =
      totalRevenue > 0 ? (collectedRevenue / totalRevenue) * 100 : 0;

    // Recent activity (last 30 days)
    const recentInvoices = invoices.filter(
      (inv) => new Date(parseInt(inv.invoiceDate)) >= thirtyDaysAgo,
    );

    setDashboardStats({
      totalRevenue,
      pendingRevenue,
      collectedRevenue,
      overdueAmount,
      totalCalls,
      averageInvoice,
      paidInvoices: paidInvoices.length,
      sentInvoices: sentInvoices.length,
      pendingInvoices: pendingInvoices.length,
      overdueInvoices: overdueInvoices.length,
      collectionRate,
      recentInvoices: recentInvoices.length,
    });
  };

  const handleGenerateInvoice = async () => {
    try {
      const customer = customers.find(
        (c) =>
          c.gatewayId === generateForm.customerId ||
          c.customerCode === generateForm.customerId ||
          c.accountId === generateForm.customerId,
      );
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

      const response = await apiGenerateInvoice({
        // invoiceType: generateForm.invoiceType,
        customerId: generateForm.customerId,
        billingPeriodStart: generateForm.periodStart,
        billingPeriodEnd: generateForm.periodEnd,
      });

      if (response.success) {
        toast({
          title: "Invoice generated",
          description: `Invoice ${response.invoice.invoiceNumber} has been generated successfully`,
          status: "success",
          duration: 3000,
          isClosable: true,
          position: "top-right",
        });

        loadData();
        setIsGenerateModalOpen(false);
        setGenerateForm({
          // invoiceType: "customer",
          customerId: "",
          periodStart: format(new Date().setDate(1), "yyyy-MM-dd"),
          periodEnd: format(new Date(), "yyyy-MM-dd"),
          billingCycle: "monthly",
        });
      }
    } catch (error) {
      console.error("Error generating invoice:", error);
      toast({
        title: "Error generating invoice",
        description: error.message,
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const handleViewInvoice = (invoice) => {
    setSelectedInvoice(invoice);
    setIsViewModalOpen(true);
  };

  const onRecordPaymentClick = (invoice) => {
    setPaymentForm({
      ...paymentForm,
      customerId: invoice.customerGatewayId || invoice.customerCode,
      invoiceId: invoice.id,
      amount: invoice.balanceAmount,
    });
    setIsPaymentModalOpen(true);
  };

  const handleDownloadInvoice = async (invoice) => {
    try {
      toast({
        title: "Preparing Download",
        description: "Your invoice PDF is being generated...",
        status: "info",
        duration: 2000,
        isClosable: true,
        position: "top-right",
      });

      await downloadInvoice(invoice.id, invoice.invoiceNumber);

      toast({
        title: "Download Started",
        description: "Your invoice PDF is downloading",
        status: "success",
        duration: 3000,
        isClosable: true,
        position: "top-right",
      });
    } catch (error) {
      console.error("Error downloading PDF:", error);
      toast({
        title: "Download Failed",
        description: error.message || "Failed to download invoice PDF",
        status: "error",
        duration: 5000,
        isClosable: true,
        position: "top-right",
      });
    }
  };

  // Helper function to format duration
  const formatDuration = (seconds) => {
    if (!seconds) return "0:00";
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}:${minutes.toString().padStart(2, "0")}`;
  };

  // Helper function to format total duration
  const formatTotalDuration = (seconds) => {
    if (!seconds) return "0:00";
    const totalMinutes = Math.floor(seconds / 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}:${minutes.toString().padStart(2, "0")}`;
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
    }.\n\nTotal Amount: $${parseFloat(invoice.totalAmount).toFixed(4)}\nDue Date: ${format(
      new Date(parseInt(invoice.dueDate)),
      "dd/MM/yyyy",
    )}\n\nThank you for your business!\n\nThis is a test email from the CDR Billing System.`;

    const mailtoLink = `mailto:${customer.email}?subject=${encodeURIComponent(
      subject,
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

  const handleUpdateStatus = async (invoiceId, newStatus) => {
    try {
      await updateInvoiceStatus(invoiceId, { status: newStatus });
      loadData();

      toast({
        title: "Status updated",
        description: `Invoice status updated to ${newStatus}`,
        status: "success",
        duration: 3000,
        isClosable: true,
        position: "top-right",
      });
    } catch (error) {
      console.error("Error updating status:", error);
      toast({
        title: "Error updating status",
        description: error.message,
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const handleDeleteInvoice = async (invoiceId) => {
    if (!window.confirm("Are you sure you want to delete this invoice?"))
      return;

    try {
      await apiDeleteInvoice(invoiceId);
      loadData();
      toast({
        title: "Invoice deleted",
        description: "Invoice has been deleted successfully",
        status: "success",
        duration: 3000,
        isClosable: true,
        position: "top-right",
      });
      if (isViewModalOpen) setIsViewModalOpen(false);
    } catch (error) {
      console.error("Error deleting invoice:", error);
      toast({
        title: "Error deleting invoice",
        description: error.message,
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const handleRecordPayment = async () => {
    try {
      const paymentData = {
        customerId: paymentForm.customerId,
        amount: parseFloat(paymentForm.amount),
        paymentDate: paymentForm.paymentDate,
        paymentMethod: paymentForm.paymentMethod,
        transactionId: paymentForm.transactionId,
        referenceNumber: paymentForm.referenceNumber,
        notes: paymentForm.notes,
      };

      if (paymentForm.invoiceId) {
        paymentData.invoiceAllocations = [
          {
            invoiceId: paymentForm.invoiceId,
            amount: parseFloat(paymentForm.amount),
          },
        ];
      }

      const response = await recordPayment(paymentData);

      if (response.success) {
        toast({
          title: "Payment recorded",
          description: `Payment ${response.payment.paymentNumber} has been recorded successfully`,
          status: "success",
          duration: 3000,
          isClosable: true,
          position: "top-right",
        });

        loadData();
        setIsPaymentModalOpen(false);
        setPaymentForm({
          customerId: "",
          amount: "",
          paymentDate: format(new Date(), "yyyy-MM-dd"),
          paymentMethod: "bank_transfer",
          transactionId: "",
          referenceNumber: "",
          notes: "",
          invoiceId: "",
        });
      }
    } catch (error) {
      console.error("Error recording payment:", error);
      toast({
        title: "Error recording payment",
        description: error.message,
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    }
  };

  // Get status color
  const getStatusColor = (status) => {
    switch (status) {
      case "paid":
        return "green";
      case "overdue":
        return "red";
      case "sent":
        return "orange";
      case "generated":
        return "blue";
      case "cancelled":
        return "gray";
      default:
        return "gray";
    }
  };

  // Get status icon
  const getStatusIcon = (status) => {
    switch (status) {
      case "paid":
        return FiCheckCircle;
      case "overdue":
        return FiAlertTriangle;
      case "sent":
        return FiSend;
      case "generated":
        return FiFileText;
      case "cancelled":
        return FiXCircle;
      default:
        return FiFileText;
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

  const handleBulkStatusChange = async (status) => {
    if (selectedInvoiceIds.length === 0) {
      toast({
        title: "No invoices selected",
        status: "warning",
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    try {
      await Promise.all(
        selectedInvoiceIds.map((id) => updateInvoiceStatus(id, { status })),
      );
      loadData();
      setSelectedInvoiceIds([]);
      toast({
        title: "Bulk status update complete",
        description: `Marked ${selectedInvoiceIds.length} invoices as ${status}`,
        status: "success",
        duration: 3000,
        isClosable: true,
        position: "top-right",
      });
    } catch (error) {
      console.error("Error in bulk status update:", error);
      toast({
        title: "Error in bulk update",
        description: error.message,
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    }
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

  const handleDeleteSelected = async () => {
    if (selectedInvoiceIds.length === 0) {
      toast({
        title: "No invoices selected",
        status: "warning",
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    if (
      !window.confirm(
        `Are you sure you want to delete ${selectedInvoiceIds.length} invoices?`,
      )
    )
      return;

    try {
      await Promise.all(selectedInvoiceIds.map((id) => apiDeleteInvoice(id)));
      loadData();
      setSelectedInvoiceIds([]);
      toast({
        title: "Invoices deleted",
        description: `Successfully deleted ${selectedInvoiceIds.length} invoices`,
        status: "success",
        duration: 3000,
        isClosable: true,
        position: "top-right",
      });
    } catch (error) {
      console.error("Error deleting selected invoices:", error);
      toast({
        title: "Error deleting invoices",
        description: error.message,
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    }
  };

  return (
    <Box>

      {/* Header Section */}
      <Flex justify="space-between" align="center" bgGradient="linear(to-r,blue.100,blue.200,blue.300)" px={4} py={2} borderRadius={"12px"} mb={6}>
        <Box>
          <Heading size="xl" color="gray.600">
            Invoice Management
          </Heading>
          <Text color="gray.600" fontSize="sm">
            Manage customer invoices, track payments, and generate reports
          </Text>
        </Box>
        <HStack spacing={4}>
          {/* Keep your existing Generate Invoice menu */}
          <Menu>
            <MenuButton
              as={Button}
              leftIcon={<FiPlus />}
              borderRadius={"md"}
              colorScheme="green"
              size="sm"
              px={2}
              _hover={{ transform: "translateY(-2px)", boxShadow: "lg" }}
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
              colorScheme="black"
              leftIcon={<FiSettings />}
              variant="outline"
              size="sm"
            >
              Actions
            </MenuButton>
            <MenuList>
              <MenuItem
                icon={<FiCreditCard />}
                onClick={() => setIsPaymentModalOpen(true)}
              >
                Record Payment
              </MenuItem>
              <MenuDivider />
              {/* Send Invoice Section */}
              <MenuItem icon={<FiMail />} onClick={handleSendBulkEmail}>
                Send Bulk Email
              </MenuItem>
              <MenuItem icon={<FiSend />} onClick={handleSendSelectedInvoices}>
                Send Selected Invoices
              </MenuItem>

              <MenuDivider />

              {/* Download & Export Section */}
              <MenuItem icon={<FiDownload />} onClick={handleDownloadSelected}>
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
              <MenuItem icon={<FiEdit />} onClick={handleRegenerateSelected}>
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
      <Grid templateColumns={{ base: "1fr", md: "2fr 1fr" }} gap={4} mb={8}>
        {/* Main Stats Cards */}
        <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={4}>
          <Box
            display="flex"
            justifyContent="center"
            alignItems="center"
            textAlign="left"
            bg={bgColor}
            p={2}
            pl={4}
            boxShadow={"md"}
            borderRadius={"md"}
            borderColor={borderColor}
          >
            <Stat>
              <StatLabel color="gray.600" fontSize="sm">
                Total Revenue
              </StatLabel>
              <StatNumber color="green.600" fontSize="2xl">
                ${dashboardStats.totalRevenue.toFixed(2)}
              </StatNumber>
              <StatHelpText>
                <StatArrow type="increase" />
                12.5% from last month
              </StatHelpText>
            </Stat>
          </Box>

          <Box
            display="flex"
            justifyContent="center"
            alignItems="center"
            textAlign="left"
            bg={bgColor}
            p={2}
            pl={4}
            boxShadow={"md"}
            borderRadius={"md"}
            borderColor={borderColor}
          >
            <Stat>
              <StatLabel color="gray.600" fontSize="sm">
                Pending Revenue
              </StatLabel>
              <StatNumber color="orange.600" fontSize="2xl">
                ${dashboardStats.pendingRevenue.toFixed(2)}
              </StatNumber>
              <StatHelpText>
                {dashboardStats.pendingInvoices} invoices pending
              </StatHelpText>
            </Stat>
          </Box>

          <Box
            display="flex"
            justifyContent="center"
            alignItems="center"
            textAlign="left"
            bg={bgColor}
            p={2}
            pl={4}
            boxShadow={"md"}
            borderRadius={"md"}
            borderColor={borderColor}
          >
            <Stat>
              <StatLabel color="gray.600" fontSize="sm">
                Overdue Amount
              </StatLabel>
              <StatNumber color="red.600" fontSize="2xl">
                ${dashboardStats.overdueAmount.toFixed(2)}
              </StatNumber>
              <StatHelpText>
                {dashboardStats.overdueInvoices} overdue invoices
              </StatHelpText>
            </Stat>
          </Box>

          <Box
            display="flex"
            justifyContent="center"
            alignItems="center"
            textAlign="left"
            bg={bgColor}
            p={2}
            pl={4}
            boxShadow={"md"}
            borderRadius={"md"}
            borderWidth="1px"
            borderColor={borderColor}
          >
            <Stat>
              <StatLabel color="gray.600" fontSize="sm">
                Collection Percentage
              </StatLabel>
              <StatNumber color="blue.600" fontSize="2xl">
                {dashboardStats.collectionRate.toFixed(1)}%
              </StatNumber>
              <StatHelpText>
                <Progress
                  value={dashboardStats.collectionRate}
                  size="sm"
                  colorScheme="blue"
                />
              </StatHelpText>
            </Stat>
          </Box>
        </SimpleGrid>

        {/* Quick Insights Panel */}
        <Box p={2} pl={3} bg={"white"} boxShadow={"md"} borderRadius={"md"}>
          <VStack align="stretch" spacing={2}>
            
            <VStack align="stretch" spacing={1}>
              <Flex justify="space-between"  align="center">
                <Text color={"gray.700"} fontWeight={"bold"} fontSize="sm">Average Invoice Value:</Text>
                <Badge fontSize={"sm"} px={2} borderRadius={"md"} colorScheme="blue">
                  ${dashboardStats.averageInvoice.toFixed(2)}
                </Badge>
              </Flex>
              <Flex justify="space-between" align="center">
                <Text color={"gray.700"} fontWeight={"bold"} fontSize="sm">Paid Invoices:</Text>
                <Badge fontSize={"sm"} px={2} borderRadius={"md"} colorScheme="green">{dashboardStats.paidInvoices}</Badge>
              </Flex>
              <Flex justify="space-between" align="center">
                <Text color={"gray.700"} fontWeight={"bold"} fontSize="sm">Recent Invoices (30 Days): </Text>
                <Badge fontSize={"sm"} px={2} borderRadius={"md"} colorScheme="yellow">
                  {dashboardStats.recentInvoices}
                </Badge>
              </Flex>
            </VStack>
           
          </VStack>
        </Box>
      </Grid>

      {/* Tabs for Invoice Categories */}
      <Tabs
        variant="line"
        colorScheme="blue"
        mb={6}
        onChange={(index) => {
          const tabs = ["all", "pending", "sent", "paid", "overdue"];
          setStatusFilter(tabs[index] || "all");
        }}
      >
        <TabList gap={8}>
          <Tab>
            <FiFileText style={{ marginRight: "8px" }} />
            <HStack spacing={2}>
              <Text> All Invoices</Text>{" "}
              <Badge borderRadius={"full"} colorScheme={"blue"}>
                {invoices.length}
              </Badge>
            </HStack>
          </Tab>
          <Tab>
            <FiClock style={{ marginRight: "8px" }} />
            <HStack>
              <Text>Pending</Text>{" "}
              <Badge borderRadius={"full"} colorScheme="yellow">
                {dashboardStats.pendingInvoices}
              </Badge>
            </HStack>
          </Tab>
          <Tab>
            <FiClock style={{ marginRight: "8px" }} />
            <HStack>
              <Text>Sent</Text>{" "}
              <Badge borderRadius={"full"} colorScheme="orange">
                {dashboardStats.sentInvoices}
              </Badge>
            </HStack>
          </Tab>
          <Tab>
            <FiCheckCircle style={{ marginRight: "8px" }} />
            <HStack>
              <Text>Paid</Text>
              <Badge borderRadius={"full"} colorScheme="green">
                {dashboardStats.paidInvoices}
              </Badge>
            </HStack>
          </Tab>
          <Tab>
            <FiAlertTriangle style={{ marginRight: "8px" }} />
            <HStack>
              <Text> Overdue</Text>{" "}
              <Badge borderRadius={"full"} colorScheme="red">
                {dashboardStats.overdueInvoices}
              </Badge>
            </HStack>
          </Tab>
        </TabList>
      </Tabs>
      <Card shadow="lg" borderWidth="1px" borderColor={borderColor}>
        <TableContainer maxH={"400px"} overflowY={"auto"}>
          <Table variant="simple">
            <Thead bg="gray.200" position={"sticky"} top={0} zIndex={1}>
              <Tr>
                <Th width="40px">
                  <Checkbox
                    sx={{
                      "& .chakra-checkbox__control": {
                        borderRadius: "6px",
                        border: "2px solid",
                        borderColor: "blue.500",
                        _checked: {
                          bg: "blue.500",
                          borderColor: "blue.500",
                        },
                      },
                      "& .chakra-checkbox__label": {
                        fontSize: "16px",
                        fontWeight: "medium",
                      },
                    }}
                    isChecked={
                      selectedInvoiceIds.length === filteredInvoices.length &&
                      filteredInvoices.length > 0
                    }
                    isIndeterminate={
                      selectedInvoiceIds.length > 0 &&
                      selectedInvoiceIds.length < filteredInvoices.length
                    }
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedInvoiceIds(
                          filteredInvoices.map((inv) => inv.id),
                        );
                      } else {
                        setSelectedInvoiceIds([]);
                      }
                    }}
                  />
                </Th>
                <Th color={"gray.700"}>Invoice No.</Th>
                <Th color={"gray.700"}>Customer</Th>
                <Th color={"gray.700"}>Period</Th>
                <Th color={"gray.700"}>Amount</Th>
                <Th color={"gray.700"}>Due Date</Th>
                <Th color={"gray.700"}>Status</Th>
                <Th color={"gray.700"}>Actions</Th>
              </Tr>
            </Thead>
            <Tbody>
              {filteredInvoices.map((invoice) => {
                const StatusIcon = getStatusIcon(invoice.status);
                const isOverdue =
                  invoice.status === "overdue" ||
                  (invoice.status === "sent" &&
                    differenceInDays(new Date(), new Date(invoice.dueDate)) >
                      0);

                return (
                  <Tr
                    key={invoice.id}
                    _hover={{ bg: "gray.50" }}
                    transition="background-color 0.2s"
                  >
                    <Td>
                      <Checkbox
                        sx={{
                          "& .chakra-checkbox__control": {
                            borderRadius: "6px",
                            border: "2px solid", // Use separate border properties
                            borderColor: "blue.500", // Use theme color
                            _checked: {
                              bg: "blue.500",
                              borderColor: "blue.500",
                            },
                          },
                          "& .chakra-checkbox__label": {
                            fontSize: "16px",
                            fontWeight: "medium",
                          },
                        }}
                        isChecked={selectedInvoiceIds.includes(invoice.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedInvoiceIds([
                              ...selectedInvoiceIds,
                              invoice.id,
                            ]);
                          } else {
                            setSelectedInvoiceIds(
                              selectedInvoiceIds.filter(
                                (id) => id !== invoice.id,
                              ),
                            );
                          }
                        }}
                      />
                    </Td>
                    <Td>
                      <VStack align="start" spacing={1}>
                        <Text fontWeight="bold" color="blue.600">
                          {invoice.invoiceNumber}
                        </Text>
                        <Text fontSize="xs" color="gray.500">
                          {format(
                            new Date(parseInt(invoice.invoiceDate)),
                            "MMM dd, yyyy",
                          )}
                        </Text>
                      </VStack>
                    </Td>
                    <Td
                      maxW="170px"
                      overflowX="auto"
                      sx={{
                        "&::-webkit-scrollbar": { display: "none" },
                        msOverflowStyle: "none",
                        scrollbarWidth: "none",
                      }}
                    >
                      <HStack>
                        <Box>
                          <Text fontWeight="medium">
                            {invoice.customerName}
                          </Text>
                          <Text fontSize="sm" color="gray.600">
                            {invoice.customerGatewayId || invoice.customerCode}
                          </Text>
                        </Box>
                      </HStack>
                    </Td>
                    <Td>
                      <VStack align="start" spacing={1}>
                        <Text fontSize="sm">
                          {format(
                            new Date(parseInt(invoice.billingPeriodStart)),
                            "MMM dd",
                          )}
                        </Text>
                        <Text fontSize="xs" color="gray.500">
                          to{" "}
                          {format(
                            new Date(parseInt(invoice.billingPeriodEnd)),
                            "MMM dd, yyyy",
                          )}
                        </Text>
                      </VStack>
                    </Td>
                    <Td>
                      <VStack align="start" spacing={1}>
                        <Text fontWeight="bold" color="green.600" fontSize="lg">
                          ${parseFloat(invoice.totalAmount || 0).toFixed(2)}
                        </Text>
                        <Text fontSize="xs" color="gray.500">
                          {invoice.items?.length || 0} destinations
                        </Text>
                      </VStack>
                    </Td>
                    <Td>
                      <VStack align="start" spacing={1}>
                        <Text color={isOverdue ? "red.500" : "inherit"}>
                          {format(
                            new Date(parseInt(invoice.dueDate)),
                            "MMM dd, yyyy",
                          )}
                        </Text>
                        {isOverdue && (
                          <Badge colorScheme="red" variant="subtle" size="sm">
                            {differenceInDays(
                              new Date(),
                              new Date(parseInt(invoice.dueDate)),
                            )}
                            d overdue
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
                        {invoice.status.charAt(0).toUpperCase() +
                          invoice.status.slice(1)}
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
                              onClick={() =>
                                handleUpdateStatus(invoice.id, "paid")
                              }
                            >
                              Mark as Paid
                            </MenuItem>
                            <MenuItem
                              icon={<FiClock />}
                              onClick={() =>
                                handleUpdateStatus(invoice.id, "sent")
                              }
                            >
                              Mark as Sent
                            </MenuItem>
                            <MenuItem
                              icon={<FiAlertTriangle />}
                              onClick={() =>
                                handleUpdateStatus(invoice.id, "overdue")
                              }
                            >
                              Mark as Overdue
                            </MenuItem>
                            <MenuDivider />
                            <MenuItem
                              icon={<FiTrash2 />}
                              color="red.500"
                              onClick={() => handleDeleteInvoice(invoice.id)}
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
            <FiFileText
              size={48}
              color="#CBD5E0"
              style={{ margin: "0 auto 16px" }}
            />
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
          <CardFooter borderTopWidth="1px" px={4} py={4}>
            <Flex justify="space-between" align="center" w="100%">
              <Text color="gray.600" fontSize="sm">
                Showing {Math.min(filteredInvoices.length, 10)} of{" "}
                {filteredInvoices.length} invoices
              </Text>
              <HStack spacing={2}>
                <Button
                  size="sm"
                  variant="outline"
                  leftIcon={<FiChevronsLeft />}
                  isDisabled
                >
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  rightIcon={<FiChevronRight />}
                >
                  Next
                </Button>
              </HStack>
            </Flex>
          </CardFooter>
        )}
      </Card>

      <ViewInvoiceModal
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
        selectedInvoice={selectedInvoice}
        getStatusColor={getStatusColor}
        onRecordPayment={onRecordPaymentClick}
        onDownload={handleDownloadInvoice}
        onSendEmail={handleSendEmail}
        onUpdateStatus={handleUpdateStatus}
      />

      <GenerateInvoiceModal
        isOpen={isGenerateModalOpen}
        onClose={() => setIsGenerateModalOpen(false)}
        generateForm={generateForm}
        setGenerateForm={setGenerateForm}
        customers={customers}
        onGenerate={handleGenerateInvoice}
      />

      <RecordPaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        paymentForm={paymentForm}
        setPaymentForm={setPaymentForm}
        customers={customers}
        onRecordPayment={handleRecordPayment}
      />
    </Box>
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
  <Box
    position="absolute"
    left="0"
    top="0"
    height="100%"
    display="flex"
    alignItems="center"
    pl="3"
    {...props}
  >
    {children}
  </Box>
);

export default Invoices;
