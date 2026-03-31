import React, { useState, useEffect } from "react";
import {
  Box,
  Container,
  Heading,
  InputLeftElement, InputRightElement,
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
import { SearchIcon, CloseIcon } from "@chakra-ui/icons";
import { MemoizedInput as Input, MemoizedSelect as Select } from "../components/memoizedinput/memoizedinput";
import PageNavBar from "../components/PageNavBar";
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
import TablePagination from "../components/TablePagination";
import ExportButton from "../components/ExportButton";
import ViewInvoiceModal from "../components/modals/ViewInvoiceModal";
import GenerateInvoiceModal from "../components/modals/GenerateInvoiceModal";
import RecordPaymentModal from "../components/modals/RecordPaymentModal";
import ConfirmDialog from "../components/ConfirmDialog";
import {
  fetchInvoiceItems,
  fetchInvoices,
  searchInvoicesByAccountName,
  generateInvoice as apiGenerateInvoice,
  fetchReportAccounts,
  deleteInvoice as apiDeleteInvoice,
  updateInvoiceStatus,
  recordPayment,
  downloadInvoice,
  sendInvoiceEmail,
  fetchVendorUsage,
  runBillingAutomation,
  getAllDisputes,
} from "../utils/api";
import { format, differenceInDays, isBefore, subDays } from "date-fns";

// ── CardFooter component ──────────────────────────────────────
const CardFooter = ({ children, ...props }) => (
  <Box as="footer" {...props}>
    {children}
  </Box>
);

const Invoices = () => {
  const [invoices, setInvoices] = useState([]);
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [disputes, setDisputes] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [invoiceTypeFilter, setInvoiceTypeFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 25,
    totalPages: 1,
  });
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [isGeneratingInvoice, setIsGeneratingInvoice] = useState(false);
  const [generateForm, setGenerateForm] = useState({
    invoiceType: "customer",
    customerId: "",
    periodStart: format(new Date().setDate(1), "yyyy-MM-dd"),
    periodEnd: format(new Date(), "yyyy-MM-dd"),
    billingCycle: "monthly",
  });
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isRecordingPayment, setIsRecordingPayment] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    customerId: "",
    paymentSource: "new_payment",
    amount: "",
    paymentDate: format(new Date(), "yyyy-MM-dd"),
    paymentMethod: "bank_transfer",
    transactionId: "",
    referenceNumber: "",
    notes: "",
    invoiceId: "",
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

  const toast = useToast();
  const bgColor = useColorModeValue("white", "gray.800");
  const borderColor = useColorModeValue("gray.200", "gray.700");

  // Helper function to check if invoice has a dispute
  const getInvoiceDispute = (invoiceNumber) => {
    if (!disputes.length) return null;
    return disputes.find((d) =>
      d.invoiceNumber?.includes(invoiceNumber)
    );
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedSearch(searchTerm.trim());
      setPage(1);
    }, 800);

    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  useEffect(() => {
    loadData();
  }, [debouncedSearch, statusFilter, invoiceTypeFilter, page, pageSize]);

  useEffect(() => {
    calculateDashboardStats();
  }, [invoices]);

  const loadData = async () => {
    try {
      const normalizedSearch = debouncedSearch;
      const invoiceQueryParams = {
        page,
        limit: pageSize,
      };
      if (statusFilter !== "all") {
        invoiceQueryParams.status = statusFilter;
      }
      if (invoiceTypeFilter !== "all") {
        invoiceQueryParams.invoiceType = invoiceTypeFilter;
      }

      const invoicesRequest = normalizedSearch
        ? searchInvoicesByAccountName(normalizedSearch, invoiceQueryParams)
        : fetchInvoices(invoiceQueryParams);

      const [invoicesRes, customersData, disputesRes] = await Promise.all([
        invoicesRequest,
        fetchReportAccounts(),
        getAllDisputes(),
      ]);

      const invoicesData = invoicesRes.success ? invoicesRes.data : [];
      setInvoices(invoicesData);
      setSelectedInvoiceIds([]);
      setPagination(
        invoicesRes.pagination || {
          total: invoicesData.length,
          page,
          limit: pageSize,
          totalPages: 1,
        },
      );

      const disputesData = disputesRes.success ? disputesRes.data : [];
      setDisputes(disputesData);

      if (customersData.success) {
        const uniqueAccounts = Array.from(
          new Map([
            ...customersData.customers.map((c) => [c.accountId, c]),
            ...customersData.vendors.map((v) => [v.accountId, v]),
          ]).values(),
        );
        setCustomers(uniqueAccounts);
      } else {
        setCustomers([]);
      }
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
    if (isGeneratingInvoice) return;
    setIsGeneratingInvoice(true);
    try {
      const isVendor = generateForm.invoiceType === "vendor";
      const customer = customers.find(
        (c) =>
          c.gatewayId === generateForm.customerId ||
          c.customerCode === generateForm.customerId ||
          c.vendorCode === generateForm.customerId ||
          c.accountId === generateForm.customerId,
      );
      if (!customer) {
        toast({
          title: `${isVendor ? "Vendor" : "Customer"} not found`,
          description: `Please select a valid ${isVendor ? "vendor" : "customer"}`,
          status: "error",
          duration: 3000,
          isClosable: true,
        });
        return;
      }

      let response;
      if (isVendor) {
        response = await apiGenerateInvoice({
          invoiceType: "vendor",
          customerId: generateForm.customerId,
          billingPeriodStart: generateForm.periodStart,
          billingPeriodEnd: generateForm.periodEnd,
        });
      } else {
        response = await apiGenerateInvoice({
          invoiceType: generateForm.invoiceType,
          customerId: generateForm.customerId,
          billingPeriodStart: generateForm.periodStart,
          billingPeriodEnd: generateForm.periodEnd,
        });
      }

      if (response.success) {
        toast({
          title: "Invoice generated",
          description: isVendor
            ? `Vendor usage report for ${customer.accountName} has been generated`
            : `Invoice ${response.invoice.invoiceNumber} has been generated successfully`,
          status: "success",
          duration: 3000,
          isClosable: true,
        });

        loadData();
        setIsGenerateModalOpen(false);
        setGenerateForm({
          invoiceType: "customer",
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
    } finally {
      setIsGeneratingInvoice(false);
    }
  };

  const handleViewInvoice = (invoice) => {
    setSelectedInvoice(invoice);
    setIsViewModalOpen(true);
  };

  const onRecordPaymentClick = (invoice) => {
    setPaymentForm({
      ...paymentForm,
      customerId: invoice.customerCode || invoice.customerGatewayId,
      paymentSource: "new_payment",
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
      });

      await downloadInvoice(invoice.id, invoice.invoiceNumber);

      toast({
        title: "Download Started",
        description: "Your invoice PDF is downloading",
        status: "success",
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      console.error("Error downloading PDF:", error);
      toast({
        title: "Download Failed",
        description: error.message || "Failed to download invoice PDF",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    }
  };

  const formatDuration = (seconds) => {
    if (!seconds) return "0:00";
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}:${minutes.toString().padStart(2, "0")}`;
  };

  const formatTotalDuration = (seconds) => {
    if (!seconds) return "0:00";
    const totalMinutes = Math.floor(seconds / 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}:${minutes.toString().padStart(2, "0")}`;
  };

  const handleSendEmail = async (invoice) => {
    try {
      toast({
        title: "Sending email",
        description: `Preparing to send invoice ${invoice.invoiceNumber}`,
        status: "info",
        duration: 2000,
        isClosable: true,
      });

      const response = await sendInvoiceEmail(invoice.id);

      if (response.success) {
        toast({
          title: "Email sent",
          description: `Invoice ${invoice.invoiceNumber} has been sent to ${invoice.customerEmail || "customer"}`,
          status: "success",
          duration: 3000,
          isClosable: true,
        });
        loadData(); // Refresh to update status to 'sent'
      }
    } catch (error) {
      console.error("Error sending email:", error);
      toast({
        title: "Error sending email",
        description: error.message,
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    }
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

  // deletion flow using confirmation dialog instead of window.confirm
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState(null);

  const handleDeleteInvoice = (invoice) => {
    setInvoiceToDelete(invoice);
    setIsDeleteOpen(true);
  };

  const confirmDelete = async () => {
    if (!invoiceToDelete) return;
    setIsDeleteOpen(false);

    try {
      await apiDeleteInvoice(invoiceToDelete.id);
      loadData();
      toast({
        title: "Invoice deleted",
        description: "Invoice has been deleted successfully",
        status: "success",
        duration: 3000,
        isClosable: true,
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
    setInvoiceToDelete(null);
  };

  const handleRecordPayment = async () => {
    if (isRecordingPayment) return;
    setIsRecordingPayment(true);
    try {
      const paymentData = {
        customerId: paymentForm.customerId,
        paymentSource: paymentForm.paymentSource,
        amount: parseFloat(paymentForm.amount),
        paymentDate: paymentForm.paymentDate,
        paymentMethod: paymentForm.paymentMethod,
        transactionId: paymentForm.transactionId,
        referenceNumber: paymentForm.referenceNumber,
        notes: paymentForm.notes,
      };

      if (paymentForm.invoiceId) {
        paymentData.invoiceAllocations = [
          { invoiceId: paymentForm.invoiceId, amount: parseFloat(paymentForm.amount) },
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
        });

        loadData();
        setIsPaymentModalOpen(false);
        setPaymentForm({
          customerId: "",
          paymentSource: "new_payment",
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
    } finally {
      setIsRecordingPayment(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "paid":       return "green";
      case "overdue":    return "red";
      case "sent":       return "orange";
      case "generated":  return "blue";
      case "cancelled":  return "gray";
      default:           return "gray";
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "paid":       return FiCheckCircle;
      case "overdue":    return FiAlertTriangle;
      case "sent":       return FiSend;
      case "generated":  return FiFileText;
      case "cancelled":  return FiXCircle;
      default:           return FiFileText;
    }
  };

  const handleAutoGenerateInvoices = async () => {
    try {
      toast({
        title: "Auto-generate initiated",
        description: "Auto-generating invoices for all due customers",
        status: "info",
        duration: 3000,
        isClosable: true,
      });

      const response = await runBillingAutomation();

      if (response.success) {
        const { processed, succeeded, failed, skipped } = response.results;
        toast({
          title: "Automation completed",
          description: `Processed: ${processed}, Succeeded: ${succeeded}, Failed: ${failed}, Skipped: ${skipped}`,
          status: "success",
          duration: 5000,
          isClosable: true,
        });
        loadData();
      }
    } catch (error) {
      console.error("Error running automation:", error);
      toast({
        title: "Automation failed",
        description: error.message,
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    }
  };

  const handleSendBulkEmail = async () => {
    const unsentInvoices = invoices.filter(inv => ['generated', 'pending'].includes(inv.status));
    
    if (unsentInvoices.length === 0) {
      toast({
        title: "No invoices to send",
        description: "All invoices have already been sent or are in a status that doesn't allow sending",
        status: "info",
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    if (!window.confirm(`Are you sure you want to send ${unsentInvoices.length} invoices?`)) return;

    toast({
      title: "Sending bulk emails",
      description: `Processing ${unsentInvoices.length} invoices...`,
      status: "info",
      duration: null, // Keep open until done
      isClosable: false,
      id: "bulk-email-toast",
    });

    try {
      let successCount = 0;
      let errorCount = 0;

      for (const inv of unsentInvoices) {
        try {
          await sendInvoiceEmail(inv.id);
          successCount++;
        } catch (err) {
          console.error(`Error sending invoice ${inv.invoiceNumber}:`, err);
          errorCount++;
        }
      }

      toast.close("bulk-email-toast");
      loadData();

      toast({
        title: "Bulk email complete",
        description: `Successfully sent ${successCount} invoices.${errorCount > 0 ? ` Failed to send ${errorCount} invoices.` : ""}`,
        status: successCount > 0 ? "success" : "error",
        duration: 5000,
        isClosable: true,
      });
    } catch (error) {
      toast.close("bulk-email-toast");
      toast({
        title: "Error in bulk email",
        description: error.message,
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    }
  };

  const handleSendSelectedInvoices = async () => {
    if (selectedInvoiceIds.length === 0) {
      toast({
        title: "No invoices selected",
        status: "warning",
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    if (!window.confirm(`Are you sure you want to send ${selectedInvoiceIds.length} selected invoices?`)) return;

    toast({
      title: "Sending selected invoices",
      description: `Processing ${selectedInvoiceIds.length} invoices...`,
      status: "info",
      duration: null,
      isClosable: false,
      id: "selected-email-toast",
    });

    try {
      let successCount = 0;
      let errorCount = 0;

      for (const id of selectedInvoiceIds) {
        try {
          await sendInvoiceEmail(id);
          successCount++;
        } catch (err) {
          console.error(`Error sending invoice ${id}:`, err);
          errorCount++;
        }
      }

      toast.close("selected-email-toast");
      setSelectedInvoiceIds([]);
      loadData();

      toast({
        title: "Process complete",
        description: `Successfully sent ${successCount} invoices.${errorCount > 0 ? ` Failed to send ${errorCount} invoices.` : ""}`,
        status: successCount > 0 ? "success" : "error",
        duration: 5000,
        isClosable: true,
      });
    } catch (error) {
      toast.close("selected-email-toast");
      toast({
        title: "Error sending selected invoices",
        description: error.message,
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    }
  };

  const handleDownloadSelected = () => {
    toast({ title: "Download initiated", description: "Preparing selected invoices for download", status: "info", duration: 3000, isClosable: true });
  };

  const handleExportToSage = () => {
    toast({ title: "Sage export initiated", description: "Exporting invoices to Sage accounting software", status: "info", duration: 3000, isClosable: true });
  };

  const handleBulkStatusChange = async (status) => {
    if (selectedInvoiceIds.length === 0) {
      toast({ title: "No invoices selected", status: "warning", duration: 3000, isClosable: true });
      return;
    }
    try {
      await Promise.all(selectedInvoiceIds.map((id) => updateInvoiceStatus(id, { status })));
      loadData();
      setSelectedInvoiceIds([]);
      toast({ title: "Bulk status update complete", description: `Marked ${selectedInvoiceIds.length} invoices as ${status}`, status: "success", duration: 3000, isClosable: true });
    } catch (error) {
      toast({ title: "Error in bulk update", description: error.message, status: "error", duration: 3000, isClosable: true });
    }
  };

  const handleRegenerateSelected = () => {
    toast({ title: "Regenerate selected", description: "Regenerating selected invoices", status: "info", duration: 3000, isClosable: true });
  };

  const handleDeleteSelected = async () => {
    if (selectedInvoiceIds.length === 0) {
      toast({ title: "No invoices selected", status: "warning", duration: 3000, isClosable: true });
      return;
    }
    if (!window.confirm(`Are you sure you want to delete ${selectedInvoiceIds.length} invoices?`)) return;

    try {
      await Promise.all(selectedInvoiceIds.map((id) => apiDeleteInvoice(id)));
      loadData();
      setSelectedInvoiceIds([]);
      toast({ title: "Invoices deleted", description: `Successfully deleted ${selectedInvoiceIds.length} invoices`, status: "success", duration: 3000, isClosable: true });
    } catch (error) {
      toast({ title: "Error deleting invoices", description: error.message, status: "error", duration: 3000, isClosable: true });
    }
  };

  // ── Shared checkbox sx ────────────────────────────────────────
  const checkboxSx = {
    "& .chakra-checkbox__control": {
      borderRadius: "6px",
      border: "2px solid",
      borderColor: "blue.500",
      _checked: { bg: "blue.500", borderColor: "blue.500" },
    },
  };

  return (
    <Box>
      {/* ── Header ─────────────────────────────────────────────── */}
      <PageNavBar
       mb={6}
        title="Invoice Management"
        description="Manage customer invoices, track payments, and generate reports"
        rightContent={
          <Flex gap={3}>
            <Menu>
              <MenuButton
                as={Button} leftIcon={<FiPlus />} borderRadius="md"
                colorScheme="green" size="sm" px={2}
                _hover={{ transform: "translateY(-2px)", boxShadow: "lg" }}
                transition="all 0.2s"
              >
                Generate Invoice
              </MenuButton>
              <MenuList>
                <MenuItem icon={<FiFileText />} onClick={() => setIsGenerateModalOpen(true)}>
                  Manual Invoice
                  <Text fontSize="xs" color="gray.500">Generate invoice for specific customer/period</Text>
                </MenuItem>
                <MenuItem icon={<FiRefreshCw />} onClick={handleAutoGenerateInvoices}>
                  Automatic Invoices
                  <Text fontSize="xs" color="gray.500">Generate invoices for all due customers</Text>
                </MenuItem>
              </MenuList>
            </Menu>

            <Menu>
              <MenuButton as={Button} colorScheme="blue" leftIcon={<FiSettings />} variant="solid" size="sm">
                Actions
              </MenuButton>
              <MenuList>
                <MenuItem icon={<FiCreditCard />} onClick={() => setIsPaymentModalOpen(true)}>Record Payment</MenuItem>
                <MenuDivider />
                <MenuItem icon={<FiMail />} onClick={handleSendBulkEmail}>Send Bulk Email</MenuItem>
                <MenuItem icon={<FiSend />} onClick={handleSendSelectedInvoices}>Send Selected Invoices</MenuItem>
                <MenuDivider />
                <MenuItem icon={<FiDownload />} onClick={handleDownloadSelected}>Download Selected</MenuItem>
                <MenuItem icon={<FiFile />} onClick={handleExportToSage}>
                  <Box><Text>Sage Export</Text><Text fontSize="xs" color="gray.500">Export to accounting software</Text></Box>
                </MenuItem>
                <MenuDivider />
                <MenuGroup title="Change Status">
                  <MenuItem icon={<FiCheckCircle />} onClick={() => handleBulkStatusChange("paid")}>Mark as Paid</MenuItem>
                  <MenuItem icon={<FiClock />} onClick={() => handleBulkStatusChange("sent")}>Mark as Sent</MenuItem>
                  <MenuItem icon={<FiAlertTriangle />} onClick={() => handleBulkStatusChange("overdue")}>Mark as Overdue</MenuItem>
                  {/* <MenuItem icon={<FiXCircle />} onClick={() => handleBulkStatusChange("cancelled")}>Mark as Cancelled</MenuItem> */}
                </MenuGroup>
                <MenuDivider />
                <MenuItem icon={<FiEdit />} onClick={handleRegenerateSelected}>Regenerate Selected</MenuItem>
                <MenuItem icon={<FiTrash2 />} onClick={handleDeleteSelected} color="red.500">Delete Selected</MenuItem>
              </MenuList>
            </Menu>
          </Flex>
        }
      />

      {/* ── Dashboard Stats ─────────────────────────────────────── */}
      {/* <Grid templateColumns={{ base: "1fr", md: "2fr 1fr" }} gap={4} mt={4} mb={4}>
        <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={4}>
          {[
            { label: "Total Revenue",        value: `$${dashboardStats.totalRevenue.toFixed(2)}`,   color: "green.600",  helper: <><StatArrow type="increase" />12.5% from last month</> },
            { label: "Pending Revenue",      value: `$${dashboardStats.pendingRevenue.toFixed(2)}`, color: "orange.600", helper: `${dashboardStats.pendingInvoices} invoices pending` },
            { label: "Overdue Amount",       value: `$${dashboardStats.overdueAmount.toFixed(2)}`,  color: "red.600",    helper: `${dashboardStats.overdueInvoices} overdue invoices` },
            { label: "Collection Percentage",value: `${dashboardStats.collectionRate.toFixed(1)}%`, color: "blue.600",   helper: <Progress value={dashboardStats.collectionRate} size="sm" colorScheme="blue" /> },
          ].map(({ label, value, color, helper }) => (
            <Box key={label} display="flex" justifyContent="center" alignItems="center"
              textAlign="left" bg={bgColor} p={2} pl={4} boxShadow="md" borderRadius="md" borderColor={borderColor}>
              <Stat>
                <StatLabel color="gray.600" fontSize="sm">{label}</StatLabel>
                <StatNumber color={color} fontSize="2xl">{value}</StatNumber>
                <StatHelpText>{helper}</StatHelpText>
              </Stat>
            </Box>
          ))}
        </SimpleGrid>

        <Box p={2} pl={3} bg="white" boxShadow="md" borderRadius="md">
          <VStack align="stretch" spacing={2}>
            {[
              { label: "Average Invoice Value:", value: `$${dashboardStats.averageInvoice.toFixed(2)}`, scheme: "blue" },
              { label: "Paid Invoices:",          value: dashboardStats.paidInvoices,                   scheme: "green" },
              { label: "Recent Invoices (30 Days):", value: dashboardStats.recentInvoices,              scheme: "yellow" },
            ].map(({ label, value, scheme }) => (
              <Flex key={label} justify="space-between" align="center">
                <Text color="gray.700" fontWeight="bold" fontSize="sm">{label}</Text>
                <Badge fontSize="sm" px={2} borderRadius="md" colorScheme={scheme}>{value}</Badge>
              </Flex>
            ))}
          </VStack>
        </Box>
      </Grid> */}

      <Flex px={3} borderRadius="12px" alignItems="center" gap={8} mb={3} wrap="wrap">
        <HStack spacing={2}>
        <Text  color="gray.600">Invoice Type:</Text>
        <Select
          maxW="220px"
          borderRadius="8px"
          value={invoiceTypeFilter}
          size="sm"
          onChange={(e) => {
            setInvoiceTypeFilter(e.target.value);
            setPage(1);
          }}
        >
          <option value="all">All Types</option>
          <option value="customer">Customer</option>
          <option value="vendor">Vendor</option>
        </Select>
        </HStack>
        <HStack spacing={2}>
        <Text  color="gray.600">Status:</Text>
        <Select
          maxW="220px"
          borderRadius="8px"
          value={statusFilter}
          size="sm"
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
        >
          <option value="all">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="sent">Sent</option>
          <option value="paid">Paid</option>
          <option value="overdue">Overdue</option>
        </Select>
        </HStack>
        <InputGroup maxW="360px" w="100%" ml={{ base: 0, md: "auto" }} size="sm">
  <InputLeftElement pointerEvents="none">
    <SearchIcon color="gray.400" />
  </InputLeftElement>
  <Input
  pl={8}
    placeholder="Search by account name or invoice number..."
    value={searchTerm}
    onChange={(e) => setSearchTerm(e.target.value)}
  />
  {searchTerm && (
    <InputRightElement cursor="pointer" onClick={() => setSearchTerm("")}>
      <CloseIcon color="gray.400" boxSize={3} />
    </InputRightElement>
  )}
</InputGroup>
      </Flex>

      {/* ── Table Card ─────────────────────────────────────────── */}
      <Card shadow="lg" borderWidth="1px" borderColor={borderColor}>
        {/* FIX: TableContainer height only applied when there are rows.
            Empty state lives inside <Tbody> as a <Tr> so the card
            naturally shrinks to fit the content — no stacked boxes. */}
        <TableContainer
          h={invoices.length > 0 ? "calc(100vh - 240px)" : "auto"}
          maxH={invoices.length > 0 ? "calc(100vh - 240px)" : "auto"}
          overflowY="auto"
        >
          <Table variant="simple" size="md">
            <Thead bg="gray.200" position="sticky" top={0} zIndex={1}>
              <Tr>
                <Th width="40px">
                  <Checkbox
                    sx={checkboxSx}
                    isChecked={
                      selectedInvoiceIds.length === invoices.length &&
                      invoices.length > 0
                    }
                    isIndeterminate={
                      selectedInvoiceIds.length > 0 &&
                      selectedInvoiceIds.length < invoices.length
                    }
                    onChange={(e) => {
                      setSelectedInvoiceIds(
                        e.target.checked ? invoices.map((inv) => inv.id) : [],
                      );
                    }}
                  />
                </Th>
                <Th color="gray.700">Invoice No.</Th>
                <Th color="gray.700">Invoice Type</Th>
                <Th color="gray.700">Customer</Th>
                <Th color="gray.700">Period</Th>
                <Th color="gray.700">Amount</Th>
                <Th color="gray.700">Due Date</Th>
                <Th color="gray.700">Status</Th>
                <Th color="gray.700">Actions</Th>
              </Tr>
            </Thead>
            <Tbody>
              {/* FIX: empty state inside <Tbody> so card height is natural */}
              {invoices.length === 0 ? (
                <Tr>
                  <Td colSpan={9} border="none">
                    <Box
                      py={12}
                      textAlign="center"
                      display="flex"
                      flexDirection="column"
                      justifyContent="center"
                      alignItems="center"
                    >
                      <FiFileText size={45} color="#CBD5E0" style={{ marginBottom: "16px" }} />
                      <Text color="gray.500" fontSize="md">No invoices found</Text>
                      <Text color="gray.400" fontSize="xs" mt={1}>
                        {searchTerm || statusFilter !== "all"
                          ? "Try adjusting your search or filter criteria"
                          : "Generate your first invoice to get started"}
                      </Text>
                    </Box>
                  </Td>
                </Tr>
              ) : (
                invoices.map((invoice) => {
                  const StatusIcon = getStatusIcon(invoice.status);
                  const isOverdue =
                    invoice.status === "overdue" ||
                    (invoice.status === "sent" &&
                      differenceInDays(new Date(), new Date(invoice.dueDate)) > 0);

                  return (
                    <Tr key={invoice.id} _hover={{ bg: "gray.50" }} transition="background-color 0.2s">
                      <Td>
                        <Checkbox
                          sx={checkboxSx}
                          isChecked={selectedInvoiceIds.includes(invoice.id)}
                          onChange={(e) => {
                            setSelectedInvoiceIds(
                              e.target.checked
                                ? [...selectedInvoiceIds, invoice.id]
                                : selectedInvoiceIds.filter((id) => id !== invoice.id),
                            );
                          }}
                        />
                      </Td>
                      
                      <Td>
                        <VStack align="start" spacing={0}>
                          
                            <Text fontWeight="bold" color="blue.600">{invoice.invoiceNumber}</Text>
                            
                         <HStack spacing={2}>
                          <Text fontSize="xs" color="gray.500">
                            {format(new Date(parseInt(invoice.invoiceDate)), "MMM dd, yyyy")}
                          </Text>
                          {getInvoiceDispute(invoice.invoiceNumber) && (
                              <Badge colorScheme="red" fontSize="10px">
                                Disputed
                              </Badge>
                            )}
                            </HStack>
                        </VStack>
                      </Td>
                      <Td>
                        <Badge
                          colorScheme="gray"
                          px={3} py={0} borderRadius="full"
                        >
                          {invoice.invoiceType}
                        </Badge>
                      </Td>
                      <Td maxW="170px" overflowX="auto"
                        sx={{ "&::-webkit-scrollbar": { display: "none" }, msOverflowStyle: "none", scrollbarWidth: "none" }}>
                        <HStack>
                          <Box>
                            <Text fontWeight="medium">{invoice.customerName}</Text>
                            <Text fontSize="sm" color="gray.600">{invoice.customerGatewayId || invoice.customerCode}</Text>
                          </Box>
                        </HStack>
                      </Td>
                      <Td>
                        <VStack align="start" spacing={0}>
                          <Text fontSize="sm">{format(new Date(parseInt(invoice.billingPeriodStart)), "MMM dd")}</Text>
                          <Text fontSize="xs" color="gray.500">
                            to {format(new Date(parseInt(invoice.billingPeriodEnd)), "MMM dd, yyyy")}
                          </Text>
                        </VStack>
                      </Td>
                      <Td>
                        <VStack align="start" spacing={0}>
                          <Text fontWeight="medium" color="green.700" fontSize="md">
                            ${parseFloat(invoice.totalAmount || 0).toFixed(4)}
                          </Text>
                          <Text fontSize="xs" color="gray.500">{invoice.items?.length || 0} destinations</Text>
                        </VStack>
                      </Td>
                      <Td>
                        <VStack align="start" spacing={1}>
                          <Text color={isOverdue ? "red.500" : "inherit"}>
                            {format(new Date(parseInt(invoice.dueDate)), "MMM dd, yyyy")}
                          </Text>
                          {isOverdue && (
                            <Badge colorScheme="red" variant="subtle" size="sm">
                              {differenceInDays(new Date(), new Date(parseInt(invoice.dueDate)))}d overdue
                            </Badge>
                          )}
                        </VStack>
                      </Td>
                      <Td>
                        <Badge
                          colorScheme={getStatusColor(invoice.status)}
                          display="flex" alignItems="center" gap={2}
                          px={3} py={0} borderRadius="full"
                        >
                          <StatusIcon />
                          {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                        </Badge>
                      </Td>
                      
                      <Td>
                        <HStack spacing={2} justify="end">
                        <Menu>
                          <MenuButton
                            as={IconButton}
                            icon={<FiMoreVertical />}
                            size="sm" variant="ghost" color="gray.400"
                            _hover={{ color: "gray.700", bg: "gray.100" }}
                            borderRadius="6px"
                          />
                          <MenuList fontSize="sm" minW="160px" shadow="lg">
                            <MenuItem icon={<FiEye />} fontSize="13px" onClick={() => handleViewInvoice(invoice)}>View Details</MenuItem>
                            <MenuItem icon={<FiDownload />} fontSize="13px" onClick={() => handleDownloadInvoice(invoice)}>Download</MenuItem>
                            <MenuItem icon={<FiMail />} fontSize="13px" onClick={() => handleSendEmail(invoice)}>Send Email</MenuItem>
                            <MenuItem icon={<FiEdit />} fontSize="13px" onClick={() => handleViewInvoice(invoice)}>Edit Invoice</MenuItem>
                            <MenuDivider />
                            <MenuItem icon={<FiCheckCircle />} fontSize="13px" onClick={() => handleUpdateStatus(invoice.id, "paid")}>Mark as Paid</MenuItem>
                            <MenuItem icon={<FiClock />} fontSize="13px" onClick={() => handleUpdateStatus(invoice.id, "sent")}>Mark as Sent</MenuItem>
                            <MenuItem icon={<FiAlertTriangle />} fontSize="13px" onClick={() => handleUpdateStatus(invoice.id, "overdue")}>Mark as Overdue</MenuItem>
                            <MenuDivider />
                            <MenuItem icon={<FiTrash2 />} fontSize="13px" color="red.500" onClick={() => handleDeleteInvoice(invoice)}>Delete Invoice</MenuItem>
                          </MenuList>
                        </Menu>
                            <IconButton bg={"transparent"} icon={<FiEye />} fontSize="13px" onClick={() => handleViewInvoice(invoice)}/>
                        </HStack>
                      </Td>
                    </Tr>
                  );
                })
              )}
            </Tbody>
          </Table>
        </TableContainer>

        {/* FIX: Footer only renders when there are invoices — no extra
            height added when the table is empty */}
        {invoices.length > 0 && (
          <TablePagination
            page={pagination.page || page}
            pageSize={pagination.limit || pageSize}
            total={pagination.total || 0}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
          />
        )}
      </Card>

      {/* ── Modals ─────────────────────────────────────────────── */}
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
        isSubmitting={isGeneratingInvoice}
      />

      <RecordPaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        paymentForm={paymentForm}
        setPaymentForm={setPaymentForm}
        customers={customers}
        onRecordPayment={handleRecordPayment}
        isSubmitting={isRecordingPayment}
      />

      {/* delete confirmation */}
      <ConfirmDialog
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={confirmDelete}
        title="Delete Invoice"
        message={`Are you sure you want to delete invoice ${invoiceToDelete?.invoiceNumber}? This action cannot be undone.`}
        confirmText="Delete Invoice"
        type="danger"
      />
    </Box>
  );
};

export default Invoices;