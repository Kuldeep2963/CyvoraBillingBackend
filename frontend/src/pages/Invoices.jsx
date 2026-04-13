import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Box,
  VStack,
  Text,
  Button,
  useToast,
  HStack,
  Badge,
  IconButton,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  MenuDivider,
  MenuGroup,
  Flex,
  Stat,
  StatLabel,
  StatNumber,
  Divider,
  Tooltip,
  useColorModeValue,
  InputGroup,
  InputLeftElement,
  InputRightElement,
  Checkbox,
  SimpleGrid,
  Progress,
} from "@chakra-ui/react";
import { SearchIcon, CloseIcon } from "@chakra-ui/icons";
import {
  MemoizedInput as Input,
  MemoizedSelect as Select,
} from "../components/memoizedinput/memoizedinput";
import PageNavBar from "../components/PageNavBar";
import DataTable from "../components/DataTable";
import {
  FiFileText,
  FiDownload,
  FiEye,
  FiMail,
  FiPlus,
  FiSend,
  FiFile,
  FiEdit,
  FiClock,
  FiCheckCircle,
  FiAlertTriangle,
  FiXCircle,
  FiTrash2,
  FiDollarSign,
  FiRefreshCw,
  FiCalendar,
  FiChevronDown,
  FiTrendingUp,
  FiTrendingDown,
  FiCreditCard,
  FiMoreVertical,
  FiSettings,
} from "react-icons/fi";
import ViewInvoiceModal from "../components/modals/ViewInvoiceModal";
import GenerateInvoiceModal from "../components/modals/GenerateInvoiceModal";
import RecordPaymentModal from "../components/modals/RecordPaymentModal";
import ConfirmDialog from "../components/ConfirmDialog";
import {
  fetchInvoices,
  searchInvoicesByAccountName,
  generateInvoice as apiGenerateInvoice,
  fetchReportAccounts,
  deleteInvoice as apiDeleteInvoice,
  recordPayment,
  downloadInvoice,
  sendInvoiceEmail,
  runBillingAutomation,
  getAllDisputes,
} from "../utils/api";
import { format, differenceInDays, subDays } from "date-fns";

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  paid:      { color: "green",  icon: FiCheckCircle  },
  overdue:   { color: "red",    icon: FiAlertTriangle },
  sent:      { color: "orange", icon: FiSend         },
  generated: { color: "blue",   icon: FiFileText     },
  cancelled: { color: "gray",   icon: FiXCircle      },
};

const DEFAULT_PAGINATION = { total: 0, page: 1, limit: 25, totalPages: 1 };

const DEFAULT_GENERATE_FORM = {
  customerId: "",
  periodStart: format(new Date(new Date().setDate(1)), "yyyy-MM-dd"),
  periodEnd: format(new Date(), "yyyy-MM-dd"),
  billingCycle: "monthly",
};

const DEFAULT_PAYMENT_FORM = {
  customerId: "",
  paymentSource: "new_payment",
  amount: "",
  paymentDate: format(new Date(), "yyyy-MM-dd"),
  paymentMethod: "bank_transfer",
  transactionId: "",
  referenceNumber: "",
  notes: "",
  invoiceId: "",
};

// Max concurrent API calls for bulk operations
const BULK_CONCURRENCY = 5;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Safely parse a date value that may be:
 *  - a Unix timestamp in ms as a number or numeric string  → new Date(Number)
 *  - an ISO string                                         → new Date(string)
 *  - already a Date                                        → returned as-is
 * Returns `null` if the result is invalid so callers can handle gracefully.
 */
const safeParseDateValue = (value) => {
  if (!value) return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  const asNum = Number(value);
  const d = !isNaN(asNum) ? new Date(asNum) : new Date(value);
  return isNaN(d.getTime()) ? null : d;
};

const safeFormat = (value, fmt, fallback = "—") => {
  const d = safeParseDateValue(value);
  return d ? format(d, fmt) : fallback;
};

const getStatusColor = (status) => STATUS_CONFIG[status]?.color ?? "gray";
const getStatusIcon  = (status) => STATUS_CONFIG[status]?.icon  ?? FiFileText;

/**
 * Run an array of async tasks with a max concurrency limit.
 * Returns the same shape as Promise.allSettled.
 */
const runWithConcurrency = async (tasks, limit = BULK_CONCURRENCY) => {
  const results = [];
  let index = 0;

  const runNext = async () => {
    while (index < tasks.length) {
      const current = index++;
      try {
        results[current] = { status: "fulfilled", value: await tasks[current]() };
      } catch (err) {
        results[current] = { status: "rejected", reason: err };
      }
    }
  };

  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, runNext));
  return results;
};

// ─── Checkbox sx (stable reference outside component) ────────────────────────

const CHECKBOX_SX = {
  "& .chakra-checkbox__control": {
    borderRadius: "6px",
    border: "2px solid",
    borderColor: "blue.500",
    _checked: { bg: "blue.500", borderColor: "blue.500" },
  },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const InvoiceEmptyState = React.memo(({ searchTerm, statusFilter }) => (
  <Tr>
    <Td colSpan={9} border="none">
      <Box py={12} textAlign="center" display="flex" flexDirection="column" alignItems="center">
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
));
InvoiceEmptyState.displayName = "InvoiceEmptyState";

const InvoiceStatusBadge = React.memo(({ status }) => {
  const Icon = getStatusIcon(status);
  return (
    <Badge
      colorScheme={getStatusColor(status)}
      display="flex"
      alignItems="center"
      gap={2}
      px={3}
      py={1}
      borderRadius="full"
    >
      <Icon />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
});
InvoiceStatusBadge.displayName = "InvoiceStatusBadge";

// ─── Dashboard stat cards ─────────────────────────────────────────────────────

const STAT_CARDS = [
  {
    key: "totalRevenue",
    label: "Total Revenue",
    getValue: (s) => `$${s.totalRevenue.toFixed(2)}`,
    color: "green.600",
    icon: FiTrendingUp,
  },
  {
    key: "pendingRevenue",
    label: "Pending Revenue",
    getValue: (s) => `$${s.pendingRevenue.toFixed(2)}`,
    subtext: (s) => `${s.pendingInvoices} invoices pending`,
    color: "orange.600",
    icon: FiClock,
  },
  {
    key: "overdueAmount",
    label: "Overdue Amount",
    getValue: (s) => `$${s.overdueAmount.toFixed(2)}`,
    subtext: (s) => `${s.overdueInvoices} overdue invoices`,
    color: "red.600",
    icon: FiAlertTriangle,
  },
  {
    key: "collectionRate",
    label: "Collection Rate",
    getValue: (s) => `${s.collectionRate.toFixed(1)}%`,
    subtext: (s) => <Progress value={s.collectionRate} size="sm" colorScheme="blue" mt={1} />,
    color: "blue.600",
    icon: FiDollarSign,
  },
];

const DashboardStatCard = React.memo(({ label, value, subtext, color, icon: Icon, bgColor, borderColor }) => (
  <Box
    bg={bgColor}
    p={4}
    boxShadow="md"
    borderRadius="md"
    borderWidth="1px"
    borderColor={borderColor}
  >
    <Stat>
      <StatLabel color="gray.600" fontSize="sm">
        <HStack spacing={1}>
          <Icon />
          <Text>{label}</Text>
        </HStack>
      </StatLabel>
      <StatNumber color={color} fontSize="2xl">{value}</StatNumber>
      {subtext && <Box mt={1} fontSize="xs" color="gray.500">{typeof subtext === "function" ? subtext() : subtext}</Box>}
    </Stat>
  </Box>
));
DashboardStatCard.displayName = "DashboardStatCard";

// ─── Main Component ───────────────────────────────────────────────────────────

const Invoices = () => {
  // ── State ──────────────────────────────────────────────────────────────────
  const [invoices, setInvoices]                     = useState([]);
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState([]);
  const [customers, setCustomers]                   = useState([]);
  const [disputes, setDisputes]                     = useState([]);
  const [searchTerm, setSearchTerm]                 = useState("");
  const [debouncedSearch, setDebouncedSearch]       = useState("");
  const [statusFilter, setStatusFilter]             = useState("all");
  const [page, setPage]                             = useState(1);
  const [pageSize, setPageSize]                     = useState(25);
  const [pagination, setPagination]                 = useState(DEFAULT_PAGINATION);
  const [isLoading, setIsLoading]                   = useState(true);
  const [selectedInvoice, setSelectedInvoice]       = useState(null);
  const [isViewModalOpen, setIsViewModalOpen]       = useState(false);
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [isGeneratingInvoice, setIsGeneratingInvoice] = useState(false);
  const [generateForm, setGenerateForm]             = useState(DEFAULT_GENERATE_FORM);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isRecordingPayment, setIsRecordingPayment] = useState(false);
  const [paymentForm, setPaymentForm]               = useState(DEFAULT_PAYMENT_FORM);
  const [dashboardStats, setDashboardStats]         = useState({
    totalRevenue: 0, pendingRevenue: 0, collectedRevenue: 0,
    overdueAmount: 0, totalCalls: 0, averageInvoice: 0,
    paidInvoices: 0, pendingInvoices: 0, overdueInvoices: 0,
    collectionRate: 0, recentInvoices: 0, sentInvoices: 0,
  });

  // Confirmation dialog state (replaces all window.confirm calls)
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: "",
    message: "",
    confirmText: "Confirm",
    type: "danger",
    onConfirm: null,
    isLoading: false,
  });

  const toast  = useToast();
  const bgColor     = useColorModeValue("white", "gray.800");

  // ── Dispute lookup map – O(1) per row instead of O(n) ─────────────────────
  // BUG FIX: was O(n²) — Array.find() inside invoices.map()
  const disputeMap = useMemo(() => {
    const map = new Map();
    for (const d of disputes) {
      if (d.invoiceNumber) {
        // A dispute's invoiceNumber may be an array or a string
        const nums = Array.isArray(d.invoiceNumber) ? d.invoiceNumber : [d.invoiceNumber];
        for (const n of nums) map.set(n, d);
      }
    }
    return map;
  }, [disputes]);

  const getInvoiceDispute = useCallback(
    (invoiceNumber) => disputeMap.get(invoiceNumber) ?? null,
    [disputeMap],
  );

  // ── Debounce search ────────────────────────────────────────────────────────
  useEffect(() => {
    const id = setTimeout(() => {
      setDebouncedSearch(searchTerm.trim());
      setPage(1);
    }, 800);
    return () => clearTimeout(id);
  }, [searchTerm]);

  // ── Data loading ────────────────────────────────────────────────────────────
  // BUG FIX: loadData wrapped in useCallback so the effect dependency is stable
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const queryParams = { page, limit: pageSize };
      if (statusFilter !== "all")      queryParams.status      = statusFilter;

      const invoicesRequest = debouncedSearch
        ? searchInvoicesByAccountName(debouncedSearch, queryParams)
        : fetchInvoices(queryParams);

      const [invoicesRes, customersData, disputesRes] = await Promise.all([
        invoicesRequest,
        fetchReportAccounts(),
        getAllDisputes(),
      ]);

      const invoicesData = invoicesRes.success ? invoicesRes.data : [];
      setInvoices(invoicesData);
      setSelectedInvoiceIds([]);
      setPagination(
        invoicesRes.pagination ?? {
          total: invoicesData.length,
          page,
          limit: pageSize,
          totalPages: 1,
        },
      );

      setDisputes(disputesRes.success ? disputesRes.data : []);

      if (customersData.success) {
        setCustomers(
          Array.from(
            new Map([
              ...customersData.customers.map((c) => [c.accountId, c]),
              ...customersData.vendors.map((v) => [v.accountId, v]),
            ]).values(),
          ),
        );
      } else {
        setCustomers([]);
      }

      // BUG FIX: pass fresh data directly — avoids stale-closure read in calculateDashboardStats
      calculateDashboardStats(invoicesData);
    } catch (error) {
      console.error("Error loading data:", error);
      toast({
        title: "Error loading data",
        description: error.message,
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  }, [debouncedSearch, statusFilter, page, pageSize, toast]);

  useEffect(() => { loadData(); }, [loadData]);

  // BUG FIX: accepts data param — no longer reads stale `invoices` from closure
  const calculateDashboardStats = (data) => {
    const now           = new Date();
    const thirtyDaysAgo = subDays(now, 30);

    const paidInvoices    = data.filter((i) => i.status === "paid");
    const sentInvoices    = data.filter((i) => i.status === "sent");
    const pendingInvoices = data.filter((i) => ["generated", "pending", "partial"].includes(i.status));
    const overdueInvoices = data.filter((i) => i.status === "overdue");

    const sum = (arr, field) => arr.reduce((s, i) => s + parseFloat(i[field] ?? 0), 0);

    const totalRevenue     = sum(data, "totalAmount");
    const pendingRevenue   = sum(
      data.filter((i) => ["sent", "generated", "pending", "partial", "overdue"].includes(i.status)),
      "balanceAmount",
    );
    const collectedRevenue = sum(data, "paidAmount");
    const overdueAmount    = sum(overdueInvoices, "balanceAmount");
    const totalCalls       = data.reduce((s, i) => s + (parseInt(i.totalCalls) || 0), 0);
    const averageInvoice   = data.length > 0 ? totalRevenue / data.length : 0;
    const collectionRate   = totalRevenue > 0 ? (collectedRevenue / totalRevenue) * 100 : 0;
    const recentInvoices   = data.filter((i) => {
      const d = safeParseDateValue(i.invoiceDate);
      return d && d >= thirtyDaysAgo;
    }).length;

    setDashboardStats({
      totalRevenue, pendingRevenue, collectedRevenue,
      overdueAmount, totalCalls, averageInvoice,
      paidInvoices:    paidInvoices.length,
      sentInvoices:    sentInvoices.length,
      pendingInvoices: pendingInvoices.length,
      overdueInvoices: overdueInvoices.length,
      collectionRate,
      recentInvoices,
    });
  };

  // ── Confirmation dialog helper ─────────────────────────────────────────────
  // BUG FIX: replaces all window.confirm() calls with the existing ConfirmDialog
  const openConfirm = useCallback(({ title, message, confirmText = "Confirm", type = "danger", onConfirm }) => {
    setConfirmDialog({ isOpen: true, title, message, confirmText, type, onConfirm });
  }, []);

  const closeConfirm = useCallback(() => {
    setConfirmDialog((prev) => ({ ...prev, isOpen: false, onConfirm: null }));
  }, []);

  // ── Invoice actions ────────────────────────────────────────────────────────
  const handleGenerateInvoice = useCallback(async () => {
    if (isGeneratingInvoice) return;
    setIsGeneratingInvoice(true);
    try {
      const customer = customers.find(
        (c) =>
          c.gatewayId      === generateForm.customerId ||
          c.customerCode   === generateForm.customerId ||
          c.accountId      === generateForm.customerId,
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
        customerId:         generateForm.customerId,
        billingPeriodStart: generateForm.periodStart,
        billingPeriodEnd:   generateForm.periodEnd,
      });

      if (response.success) {
        toast({
          title: "Invoice generated",
          description: `Invoice ${response.invoice.invoiceNumber} has been generated successfully`,
          status: "success",
          duration: 3000,
          isClosable: true,
        });
        loadData();
        setIsGenerateModalOpen(false);
        setGenerateForm(DEFAULT_GENERATE_FORM);
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
  }, [isGeneratingInvoice, generateForm, customers, toast, loadData]);

  const handleViewInvoice = useCallback((invoice) => {
    setSelectedInvoice(invoice);
    setIsViewModalOpen(true);
  }, []);

  const onRecordPaymentClick = useCallback((invoice) => {
    // BUG FIX: functional update avoids stale paymentForm closure
    setPaymentForm((prev) => ({
      ...prev,
      customerId:    invoice.customerCode ?? invoice.customerGatewayId ?? "",
      paymentSource: "new_payment",
      invoiceId:     invoice.id,
      amount:        invoice.balanceAmount,
    }));
    setIsPaymentModalOpen(true);
  }, []);

  const handleDownloadInvoice = useCallback(async (invoice) => {
    try {
      toast({ title: "Preparing Download", description: "Your invoice PDF is being generated...", status: "info", duration: 2000, isClosable: true });
      await downloadInvoice(invoice.id, invoice.invoiceNumber);
      toast({ title: "Download Started", description: "Your invoice PDF is downloading", status: "success", duration: 3000, isClosable: true });
    } catch (error) {
      console.error("Error downloading PDF:", error);
      toast({ title: "Download Failed", description: error.message ?? "Failed to download invoice PDF", status: "error", duration: 5000, isClosable: true });
    }
  }, [toast]);

  const handleSendEmail = useCallback(async (invoice) => {
    try {
      toast({ title: "Sending email", description: `Preparing to send invoice ${invoice.invoiceNumber}`, status: "info", duration: 2000, isClosable: true });
      const response = await sendInvoiceEmail(invoice.id);
      if (response.success) {
        toast({ title: "Email sent", description: `Invoice ${invoice.invoiceNumber} sent to ${invoice.customerEmail ?? "customer"}`, status: "success", duration: 3000, isClosable: true });
        loadData();
      }
    } catch (error) {
      console.error("Error sending email:", error);
      toast({ title: "Error sending email", description: error.message, status: "error", duration: 3000, isClosable: true });
    }
  }, [toast, loadData]);

  // ── Delete (single) ────────────────────────────────────────────────────────
  // BUG FIX: uses ConfirmDialog instead of window.confirm
  const handleDeleteInvoice = useCallback((invoice) => {
    openConfirm({
      title:       "Delete Invoice",
      message:     `Are you sure you want to delete invoice ${invoice.invoiceNumber}? This action cannot be undone.`,
      confirmText: "Delete Invoice",
      type:        "danger",
      onConfirm:   async () => {
        try {
          await apiDeleteInvoice(invoice.id);
          loadData();
          toast({ title: "Invoice deleted", description: "Invoice has been deleted successfully", status: "success", duration: 3000, isClosable: true });
          if (isViewModalOpen) setIsViewModalOpen(false);
        } catch (error) {
          console.error("Error deleting invoice:", error);
          toast({ title: "Error deleting invoice", description: error.message, status: "error", duration: 3000, isClosable: true });
        }
      },
    });
  }, [openConfirm, loadData, toast, isViewModalOpen]);

  const handleRecordPayment = useCallback(async () => {
    if (isRecordingPayment) return;
    setIsRecordingPayment(true);
    try {
      const paymentData = {
        customerId:      paymentForm.customerId,
        paymentSource:   paymentForm.paymentSource,
        amount:          parseFloat(paymentForm.amount),
        paymentDate:     paymentForm.paymentDate,
        paymentMethod:   paymentForm.paymentMethod,
        transactionId:   paymentForm.transactionId,
        referenceNumber: paymentForm.referenceNumber,
        notes:           paymentForm.notes,
      };
      if (paymentForm.invoiceId) {
        paymentData.invoiceAllocations = [
          { invoiceId: paymentForm.invoiceId, amount: parseFloat(paymentForm.amount) },
        ];
      }

      const response = await recordPayment(paymentData);
      if (response.success) {
        toast({ title: "Payment recorded", description: `Payment ${response.payment.paymentNumber} recorded successfully`, status: "success", duration: 3000, isClosable: true });
        loadData();
        setIsPaymentModalOpen(false);
        setPaymentForm(DEFAULT_PAYMENT_FORM);
      }
    } catch (error) {
      console.error("Error recording payment:", error);
      toast({ title: "Error recording payment", description: error.message, status: "error", duration: 3000, isClosable: true });
    } finally {
      setIsRecordingPayment(false);
    }
  }, [isRecordingPayment, paymentForm, toast, loadData]);

  const handleAutoGenerateInvoices = useCallback(async () => {
    try {
      toast({ title: "Auto-generate initiated", description: "Auto-generating invoices for all due customers", status: "info", duration: 3000, isClosable: true });
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
      toast({ title: "Automation failed", description: error.message, status: "error", duration: 5000, isClosable: true });
    }
  }, [toast, loadData]);

  // ── Bulk operations (concurrent, not sequential) ──────────────────────────
  // BUG FIX: replaced for-await loops with runWithConcurrency; uses ConfirmDialog

  const executeBulkSend = useCallback(async (ids, toastId) => {
    const tasks = ids.map((id) => () => sendInvoiceEmail(id));
    const results = await runWithConcurrency(tasks);
    const succeeded = results.filter((r) => r.status === "fulfilled").length;
    const failed    = results.length - succeeded;
    toast.close(toastId);
    loadData();
    toast({
      title:       "Bulk email complete",
      description: `Sent ${succeeded} invoice${succeeded !== 1 ? "s" : ""}.${failed > 0 ? ` Failed: ${failed}.` : ""}`,
      status:      succeeded > 0 ? "success" : "error",
      duration:    5000,
      isClosable:  true,
    });
  }, [toast, loadData]);

  const handleSendBulkEmail = useCallback(() => {
    const unsent = invoices.filter((inv) => ["generated", "pending"].includes(inv.status));
    if (unsent.length === 0) {
      toast({ title: "No invoices to send", description: "All invoices have already been sent or are in a status that doesn't allow sending", status: "info", duration: 3000, isClosable: true });
      return;
    }
    openConfirm({
      title:       "Send Bulk Emails",
      message:     `Are you sure you want to send ${unsent.length} invoices?`,
      confirmText: `Send ${unsent.length} Invoices`,
      type:        "info",
      onConfirm:   async () => {
        const toastId = "bulk-email-toast";
        toast({ id: toastId, title: "Sending bulk emails", description: `Processing ${unsent.length} invoices...`, status: "info", duration: null, isClosable: false });
        await executeBulkSend(unsent.map((i) => i.id), toastId);
      },
    });
  }, [invoices, openConfirm, toast, executeBulkSend]);

  const handleSendSelectedInvoices = useCallback(() => {
    if (selectedInvoiceIds.length === 0) {
      toast({ title: "No invoices selected", status: "warning", duration: 3000, isClosable: true });
      return;
    }
    openConfirm({
      title:       "Send Selected Invoices",
      message:     `Are you sure you want to send ${selectedInvoiceIds.length} selected invoices?`,
      confirmText: `Send ${selectedInvoiceIds.length} Invoices`,
      type:        "info",
      onConfirm:   async () => {
        const toastId = "selected-email-toast";
        toast({ id: toastId, title: "Sending selected invoices", description: `Processing ${selectedInvoiceIds.length} invoices...`, status: "info", duration: null, isClosable: false });
        await executeBulkSend(selectedInvoiceIds, toastId);
        setSelectedInvoiceIds([]);
      },
    });
  }, [selectedInvoiceIds, openConfirm, toast, executeBulkSend]);

  // BUG FIX: uses ConfirmDialog; Promise.allSettled for partial-failure handling
  const handleDeleteSelected = useCallback(() => {
    if (selectedInvoiceIds.length === 0) {
      toast({ title: "No invoices selected", status: "warning", duration: 3000, isClosable: true });
      return;
    }
    openConfirm({
      title:       "Delete Selected Invoices",
      message:     `Are you sure you want to delete ${selectedInvoiceIds.length} invoices? This action cannot be undone.`,
      confirmText: `Delete ${selectedInvoiceIds.length} Invoices`,
      type:        "danger",
      onConfirm:   async () => {
        const results = await Promise.allSettled(
          selectedInvoiceIds.map((id) => apiDeleteInvoice(id)),
        );
        const succeeded = results.filter((r) => r.status === "fulfilled").length;
        const failed    = results.length - succeeded;
        loadData();
        setSelectedInvoiceIds([]);
        toast({
          title:       "Delete complete",
          description: `Deleted ${succeeded} invoice${succeeded !== 1 ? "s" : ""}${failed > 0 ? `. Failed: ${failed}.` : ""}`,
          status:      succeeded > 0 ? "success" : "error",
          duration:    3000,
          isClosable:  true,
        });
      },
    });
  }, [selectedInvoiceIds, openConfirm, toast, loadData]);

  const handleDownloadSelected = useCallback(() => {
    toast({ title: "Download initiated", description: "Preparing selected invoices for download", status: "info", duration: 3000, isClosable: true });
  }, [toast]);

  const handleExportToSage = useCallback(() => {
    toast({ title: "Sage export initiated", description: "Exporting invoices to Sage accounting software", status: "info", duration: 3000, isClosable: true });
  }, [toast]);

  const handleRegenerateSelected = useCallback(() => {
    toast({ title: "Regenerate selected", description: "Regenerating selected invoices", status: "info", duration: 3000, isClosable: true });
  }, [toast]);

  // ── Select-all / row select ───────────────────────────────────────────────
  // BUG FIX: functional updates — no stale selectedInvoiceIds closure
  const handleSelectAll = useCallback((e) => {
    setSelectedInvoiceIds(e.target.checked ? invoices.map((inv) => inv.id) : []);
  }, [invoices]);

  const handleRowSelect = useCallback((id, checked) => {
    setSelectedInvoiceIds((prev) =>
      checked ? [...prev, id] : prev.filter((x) => x !== id),
    );
  }, []);

  const invoiceColumns = useMemo(() => {
    const isAllSelected = invoices.length > 0 && selectedInvoiceIds.length === invoices.length;
    const isIndeterminate = selectedInvoiceIds.length > 0 && selectedInvoiceIds.length < invoices.length;

    return [
      {
        key: "select",
        header: (
          <Checkbox
            sx={CHECKBOX_SX}
            isChecked={isAllSelected}
            isIndeterminate={isIndeterminate}
            onChange={handleSelectAll}
          />
        ),
        minWidth: "40px",
        render: (_, row) => (
          <Checkbox
            sx={CHECKBOX_SX}
            isChecked={selectedInvoiceIds.includes(row.id)}
            onChange={(e) => handleRowSelect(row.id, e.target.checked)}
          />
        ),
      },
      {
        key: "invoiceNumber",
        header: "Invoice No.",
        minWidth: "160px",
        render: (value, row) => {
          const invoiceDateParsed = safeParseDateValue(row.invoiceDate);
          return (
            <VStack align="start" spacing={0}>
              <Text fontWeight="bold" color="blue.600">
                {value}
              </Text>
              <HStack spacing={2}>
                <Text fontSize="xs" color="gray.500">
                  {invoiceDateParsed ? format(invoiceDateParsed, "MMM dd, yyyy") : "—"}
                </Text>
                {getInvoiceDispute(value) && (
                  <Badge colorScheme="red" fontSize="10px">
                    Disputed
                  </Badge>
                )}
              </HStack>
            </VStack>
          );
        },
      },
      {
        key: "customerName",
        header: "Customer",
        minWidth: "180px",
        render: (value, row) => (
          <Box>
            <Text fontWeight="medium">{value}</Text>
            <Text fontSize="sm" color="gray.600">
              {row.customerGatewayId ?? row.customerCode}
            </Text>
          </Box>
        ),
      },
      {
        key: "period",
        header: "Period",
        minWidth: "140px",
        render: (_, row) => {
          const periodStartParsed = safeParseDateValue(row.billingPeriodStart);
          const periodEndParsed = safeParseDateValue(row.billingPeriodEnd);
          return (
            <VStack align="start" spacing={0}>
              <Text fontSize="sm">
                {periodStartParsed ? format(periodStartParsed, "MMM dd") : "—"}
              </Text>
              <Text fontSize="xs" color="gray.500">
                to {periodEndParsed ? format(periodEndParsed, "MMM dd, yyyy") : "—"}
              </Text>
            </VStack>
          );
        },
      },
      {
        key: "totalAmount",
        header: "Amount",
        minWidth: "120px",
        isNumeric: true,
        render: (value, row) => (
          <VStack align="start" spacing={0}>
            <Text fontWeight="medium" color="green.700" fontSize="md" textAlign="right">
              ${parseFloat(value ?? 0).toFixed(4)}
            </Text>
            <Text fontSize="xs" color="gray.500">
              {row.items?.length ?? 0} destinations
            </Text>
          </VStack>
        ),
      },
      {
        key: "dueDate",
        header: "Due Date",
        minWidth: "140px",
        render: (value, row) => {
          const dueDateParsed = safeParseDateValue(value);
          const isOverdue =
            row.status === "overdue" ||
            (row.status === "sent" && dueDateParsed && differenceInDays(new Date(), dueDateParsed) > 0);
          const daysOverdue = dueDateParsed ? differenceInDays(new Date(), dueDateParsed) : 0;

          return (
            <VStack align="start" spacing={1}>
              <Text color={isOverdue ? "red.500" : "inherit"}>
                {dueDateParsed ? format(dueDateParsed, "MMM dd, yyyy") : "—"}
              </Text>
              {isOverdue && daysOverdue > 0 && (
                <Badge colorScheme="red" variant="subtle" size="sm">
                  {daysOverdue}d overdue
                </Badge>
              )}
            </VStack>
          );
        },
      },
      {
        key: "status",
        header: "Status",
        minWidth: "120px",
        render: (value) => <InvoiceStatusBadge status={value || "generated"} />,
      },
      {
        key: "actions",
        header: "Actions",
        minWidth: "160px",
        render: (_, row) => (
          <HStack spacing={2} justify="center">
            <IconButton
              bg="transparent"
              icon={<FiEye />}
              size="sm"
              aria-label="View invoice"
              onClick={() => handleViewInvoice(row)}
            />
            <Menu>
              <MenuButton
                as={IconButton}
                icon={<FiMoreVertical />}
                size="sm"
                variant="ghost"
                color="gray.400"
                _hover={{ color: "gray.700", bg: "gray.100" }}
                borderRadius="6px"
                aria-label="Invoice actions"
              />
              <MenuList fontSize="sm" minW="160px" shadow="lg">
                <MenuItem icon={<FiDownload />} fontSize="13px" onClick={() => handleDownloadInvoice(row)}>
                  Download
                </MenuItem>
                <MenuItem icon={<FiMail />} fontSize="13px" onClick={() => handleSendEmail(row)}>
                  Send Email
                </MenuItem>
                <MenuItem
                  icon={<FiCreditCard />}
                  fontSize="13px"
                  onClick={() => onRecordPaymentClick(row)}
                  isDisabled={row.status === "paid"}
                >
                  Record Payment
                </MenuItem>
                <MenuItem icon={<FiEdit />} fontSize="13px" onClick={() => handleViewInvoice(row)}>
                  Edit Invoice
                </MenuItem>
                <MenuDivider />
                <MenuItem icon={<FiTrash2 />} fontSize="13px" color="red.500" onClick={() => handleDeleteInvoice(row)}>
                  Delete Invoice
                </MenuItem>
              </MenuList>
            </Menu>
          </HStack>
        ),
      },
    ];
  }, [invoices, selectedInvoiceIds, handleSelectAll, handleRowSelect, handleViewInvoice, handleDownloadInvoice, handleSendEmail, onRecordPaymentClick, handleDeleteInvoice, getInvoiceDispute]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Box>
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <PageNavBar
        mb={6}
        title="Invoice Management"
        description="Manage customer invoices, track payments, and generate reports"
        rightContent={
          <Flex gap={3}>
            <Menu>
              <MenuButton
                as={Button}
                leftIcon={<FiPlus />}
                borderRadius="md"
                colorScheme="green"
                size="sm"
                px={2}
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
                  <Box>
                    <Text>Sage Export</Text>
                    <Text fontSize="xs" color="gray.500">Export to accounting software</Text>
                  </Box>
                </MenuItem>
                <MenuDivider />
                <MenuItem icon={<FiEdit />}   onClick={handleRegenerateSelected}>Regenerate Selected</MenuItem>
                <MenuItem icon={<FiTrash2 />} onClick={handleDeleteSelected} color="red.500">Delete Selected</MenuItem>
              </MenuList>
            </Menu>
          </Flex>
        }
      />

      {/* ── Filters ─────────────────────────────────────────────────────────── */}
      <Flex px={3} borderRadius="12px" alignItems="center" gap={8} mb={3} wrap="wrap">
        <HStack spacing={2}>
          <Text color="gray.600">Status:</Text>
          <Select
            maxW="220px"
            borderRadius="8px"
            value={statusFilter}
            size="sm"
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
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

      {/* ── Table ───────────────────────────────────────────────────────────── */}
      {isLoading ? (
        <Box textAlign="center" py={10}>
          <Text>Loading invoices...</Text>
        </Box>
      ) : (
        <DataTable
          columns={invoiceColumns}
          data={invoices}
          actions={false}
          serverPagination
          page={pagination.page ?? page}
          pageSize={pagination.limit ?? pageSize}
          total={pagination.total ?? 0}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
          striped
          height="calc(100vh - 240px)"
        />
      )}

      {/* ── Modals ──────────────────────────────────────────────────────────── */}
      <ViewInvoiceModal
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
        selectedInvoice={selectedInvoice}
        getStatusColor={getStatusColor}
        onRecordPayment={onRecordPaymentClick}
        onDownload={handleDownloadInvoice}
        onSendEmail={handleSendEmail}
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

      {/* BUG FIX: single unified ConfirmDialog replaces all window.confirm() calls */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={closeConfirm}
        onConfirm={async () => {
          if (confirmDialog.onConfirm) {
            setConfirmDialog((prev) => ({ ...prev, isLoading: true }));
            try {
              await confirmDialog.onConfirm();
            } finally {
              closeConfirm();
              setConfirmDialog((prev) => ({ ...prev, isLoading: false }));
            }
          }
        }}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText={confirmDialog.confirmText}
        type={confirmDialog.type}
        isLoading={confirmDialog.isLoading}
      />
    </Box>
  );
};

export default Invoices;