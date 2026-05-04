import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Box,
  Heading,
  VStack,
  Text,
  Button,
  HStack,
  IconButton,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  FormControl,
  FormLabel,
  Switch,
  useColorModeValue,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  NumberIncrementStepper,
  NumberDecrementStepper,
  Tab,
  FormHelperText,
  Tabs,
  TabList,
  TabPanels,
  TabPanel,
  SimpleGrid,
  Divider,
  Flex,
  Badge,
} from "@chakra-ui/react";
import useNotify from "../../utils/notify";
import {
  FiUser, FiUpload, FiDownload, FiTrash2, FiFileText, FiEye,
  FiPaperclip, FiAlertCircle, FiFile,
} from "react-icons/fi";
import {
  createCustomer,
  updateCustomer,
  uploadAccountDocument,
  deleteAccountDocument,
  downloadAccountDocument,
  viewAccountDocument,
  fetchCountryCodes,
} from "../../utils/api";
import {
  MemoizedInput as Input,
  MemoizedSelect as Select,
  MemoizedSearchSelect as SearchSelect,
} from "../memoizedinput/memoizedinput";

// ─── Constants ────────────────────────────────────────────────────────────────
const DEBOUNCE_MS = 500;
const COUNTRY_FETCH_LIMIT = 50;
const ACCOUNT_DRAFT_STORAGE_KEY = "createAccountModalDraft.v1";

// ─── Helper: file extension → color + label ───────────────────────────────────
const getFileAccent = (name = "") => {
  const ext = name.split(".").pop().toLowerCase();
  const map = {
    pdf:  { color: "red",    label: "PDF"  },
    doc:  { color: "blue",   label: "DOC"  },
    docx: { color: "blue",   label: "DOCX" },
    xls:  { color: "green",  label: "XLS"  },
    xlsx: { color: "green",  label: "XLSX" },
    csv:  { color: "teal",   label: "CSV"  },
    png:  { color: "purple", label: "PNG"  },
    jpg:  { color: "purple", label: "JPG"  },
    jpeg: { color: "purple", label: "JPEG" },
    txt:  { color: "gray",   label: "TXT"  },
  };
  return map[ext] ?? { color: "gray", label: ext.toUpperCase() || "FILE" };
};

// ─── Helper: build canonical option label ─────────────────────────────────────
const buildCountryLabel = (countryName, code) =>
  countryName && code ? `${countryName} (${code})` : "";

// ─── FIX #8: Safe localStorage helpers with try/catch ────────────────────────
const loadAccountDraft = () => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(ACCOUNT_DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
};

const persistAccountDraft = (payload) => {
  if (typeof window === "undefined") return;
  try {
    // FIX #8: JSON.stringify can throw on circular references or quota exceeded
    const serialized = JSON.stringify(payload);
    window.localStorage.setItem(ACCOUNT_DRAFT_STORAGE_KEY, serialized);
    return true;
  } catch (err) {
    // Storage quota exceeded or serialization error — signal failure to caller
    if (err.name === "QuotaExceededError") {
      throw new Error("Storage is full. Please clear some browser data and try again.");
    }
    throw new Error("Could not save draft. Please try again.");
  }
};

const clearAccountDraft = () => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(ACCOUNT_DRAFT_STORAGE_KEY);
  } catch {
    // Silently ignore — clearing is best-effort
  }
};

// ─── FIX #3: Centralised human-friendly error message extractor ───────────────
/**
 * Converts raw API/JS errors into messages safe to show in toasts.
 * Avoids leaking stack traces, internal field names, or empty strings.
 */
const getFriendlyErrorMessage = (error, fallback = "Something went wrong. Please try again.") => {
  if (!error) return fallback;

  // Network-level failures
  if (error.name === "NetworkError" || error.message?.toLowerCase().includes("network")) {
    return "Network error — please check your connection and try again.";
  }
  if (error.name === "AbortError") {
    return "The request timed out. Please try again.";
  }

  // HTTP status codes from API wrappers that attach a `status` property
  if (error.status === 401 || error.status === 403) {
    return "You don't have permission to perform this action.";
  }
  if (error.status === 404) {
    return "The requested resource was not found.";
  }
  if (error.status === 409) {
    return "A conflict occurred — this record may already exist.";
  }
  if (error.status === 413) {
    return "The file is too large. Please upload a smaller file.";
  }
  if (error.status === 422) {
    return error.message || "Some fields are invalid. Please review your input.";
  }
  if (error.status >= 500) {
    return "A server error occurred. Please try again later or contact support.";
  }

  // API may return a human message — use it only if it looks safe (non-technical)
  const msg = error.message || "";
  const looksInternal = /stack|undefined|null|cannot read|typeerror|syntaxerror/i.test(msg);
  if (msg && !looksInternal) return msg;

  return fallback;
};

// ─── DocumentRow ──────────────────────────────────────────────────────────────
const DocumentRow = ({
  doc, isPending = false, isViewMode, documentBusy,
  onView, onDownload, onRemove,
}) => {
  const fileName = doc.originalName || doc.filePath || "";
  const { color, label } = getFileAccent(fileName);

  return (
    <Flex
      align="center" justify="space-between"
      px={4} py={3}
      bg={isPending ? "blue.50" : "white"}
      borderRadius="lg"
      border="1px solid"
      borderColor={isPending ? "blue.200" : "gray.200"}
      transition="all 0.15s"
      _hover={{ boxShadow: "sm", borderColor: isPending ? "blue.300" : "gray.300" }}
      gap={3}
    >
      <HStack spacing={3} minW={0} flex={1}>
        <Flex
          align="center" justify="center"
          w={10} h={10} borderRadius="md" flexShrink={0}
          bg={`${color}.50`} border="1px solid" borderColor={`${color}.200`}
        >
          <Box as={FiFile} color={`${color}.500`} boxSize="18px" />
        </Flex>
        <Box minW={0} flex={1}>
          <HStack spacing={2} mb={0.5}>
            <Text fontSize="sm" fontWeight="600" color="gray.800" isTruncated>
              {doc.title}
            </Text>
            <Badge
              colorScheme={color} fontSize="9px" px={1.5} py={0.5}
              borderRadius="sm" flexShrink={0}
            >
              {label}
            </Badge>
            {isPending && (
              <Badge colorScheme="blue" fontSize="9px" px={1.5} py={0.5} borderRadius="sm" flexShrink={0}>
                Queued
              </Badge>
            )}
          </HStack>
          <Text fontSize="xs" color="gray.500" isTruncated>{fileName || "—"}</Text>
        </Box>
      </HStack>

      <HStack spacing={1} flexShrink={0}>
        {!isPending && onView && (
          <IconButton
            size="sm" aria-label="View" icon={<FiEye size={14} />}
            variant="ghost" colorScheme="blue" onClick={onView} title="View"
          />
        )}
        {!isPending && onDownload && (
          <IconButton
            size="sm" aria-label="Download" icon={<FiDownload size={14} />}
            variant="ghost" colorScheme="gray" onClick={onDownload}
            isDisabled={documentBusy} title="Download"
          />
        )}
        {!isViewMode && (
          <IconButton
            size="sm" aria-label="Delete" icon={<FiTrash2 size={14} />}
            variant="ghost" colorScheme="red" onClick={onRemove}
            isDisabled={documentBusy} title="Delete"
          />
        )}
      </HStack>
    </Flex>
  );
};

// ─── Custom debounce hook ─────────────────────────────────────────────────────
function useDebounced(value, delay = DEBOUNCE_MS) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);

  return debounced;
}

// ─── useCountrySearch hook ────────────────────────────────────────────────────
function useCountrySearch(searchTerm, isOpen) {
  const [options, setOptions]   = useState([]);
  const [loading, setLoading]   = useState(false);
  const debouncedTerm           = useDebounced(searchTerm, DEBOUNCE_MS);

  useEffect(() => {
    if (!isOpen || !debouncedTerm.trim()) {
      setOptions([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    fetchCountryCodes({ search: debouncedTerm.trim(), limit: COUNTRY_FETCH_LIMIT })
      .then((response) => {
        if (cancelled) return;
        setOptions(Array.isArray(response?.countryCodes) ? response.countryCodes : []);
      })
      .catch(() => {
        if (!cancelled) setOptions([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [debouncedTerm, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setOptions([]);
      setLoading(false);
    }
  }, [isOpen]);

  return { options, loading };
}

// ─── Main Modal ───────────────────────────────────────────────────────────────
const CreateAccountModal = ({
  isOpen, onClose, selectedCustomer, cdrStats,
  onSuccess, users = [], mode = "create",
}) => {
  const [loading, setLoading]   = useState(false);
  const toast                   = useNotify();
  const isViewMode              = mode === "view";

  // ── Initial form shape ──────────────────────────────────────────────────────
  const initialFormData = useMemo(() => ({
    accountRole: "customer", accountType: "prepaid", accountStatus: "active", accountId: "",
    customerauthenticationType: "ip", customerauthenticationValue: [],
    vendorauthenticationType: "ip",  vendorauthenticationValue: [],
    customerCode: "", vendorCode: "", gatewayId: "", productId: "",
    accountName: "", accountOwner: "", ownership: "None",
    contactPerson: "", contactPersonEmail: "", contactPersonPhone: "",
    phone: "", vendorFax: "", email: "", billingEmail: "", disputeEmail: "",
    nocEmail: "", soaEmail: "", ratesEmails: "",
    billingEmails: "", disputeEmails: "", nocEmails: "",
    syncContactEmailsWithRates: false,
    active: true, vatNumber: "", verificationStatus: "pending",
    resellerAccount: false, reseller: "",
    currency: "USD", nominalCode: "", creditLimit: 1000.0,
    originalCreditLimit: 1000.0, balance: 0.0, outstandingAmount: 0.0,
    timezone: "UTC", languages: "en",
    addressLine1: "", addressLine2: "", addressLine3: "",
    city: "", state: "", postalCode: "",
    country: "",
    countryCode: "",
    billingClass: "paiusa", billingType: "prepaid", billingTimezone: "UTC",
    billingStartDate: new Date().toISOString().split("T")[0],
    billingCycle: "monthly", lastbillingdate: "", nextbillingdate: "",
    sendInvoiceEmail: true, lateFeeEnabled: true, documents: [],
  }), []);

  const [formData,         setFormData]         = useState(initialFormData);
  const [documentTitle,    setDocumentTitle]     = useState("");
  const [documentFile,     setDocumentFile]      = useState(null);
  const [pendingDocuments, setPendingDocuments]  = useState([]);
  const [documentBusy,     setDocumentBusy]      = useState(false);
  const createDraftBaselineRef = useRef(null);

  // ── Country search state ────────────────────────────────────────────────────
  const [countrySearchTerm, setCountrySearchTerm] = useState("");

  const { options: countryOptions, loading: countryLoading } =
    useCountrySearch(countrySearchTerm, isOpen);

  // ── Derived ─────────────────────────────────────────────────────────────────
  const canAddDocument = !isViewMode && documentTitle.trim().length > 0 && !!documentFile;
  const totalDocs      = (formData.documents?.length ?? 0) + pendingDocuments.length;

  useEffect(() => {
    if (!formData.syncContactEmailsWithRates) return;
    setFormData((fd) => ({
      ...fd,
      ...getSyncedContactEmailValues(fd.ratesEmails),
    }));
  }, [formData.ratesEmails, formData.syncContactEmailsWithRates]); // eslint-disable-line react-hooks/exhaustive-deps

  const savedCountryLabel = useMemo(
    () => buildCountryLabel(formData.country, formData.countryCode),
    [formData.country, formData.countryCode],
  );

  const countryOptionLabels = useMemo(
    () => countryOptions.map((item) => buildCountryLabel(item.country_name, item.code)),
    [countryOptions],
  );

  // ── Normalizers ─────────────────────────────────────────────────────────────
  const normalizeListToInput = (value) => {
    if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean).join(", ");
    if (typeof value === "string") return value;
    return "";
  };

  const splitEmailList = (value = "") => {
    if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
    return String(value).split(",").map((e) => e.trim()).filter(Boolean);
  };

  const firstEmailFromList = (value = "") => splitEmailList(value)[0] ?? "";

  const getSyncedContactEmailValues = (ratesValue = "") => {
    const normalizedRates  = normalizeListToInput(ratesValue);
    const primaryRateEmail = firstEmailFromList(normalizedRates);
    return {
      billingEmails: normalizedRates,
      billingEmail:  primaryRateEmail,
      disputeEmails: normalizedRates,
      disputeEmail:  primaryRateEmail,
      nocEmails:     normalizedRates,
      nocEmail:      primaryRateEmail,
      soaEmail:      primaryRateEmail,
    };
  };

  const normalizeAuthValues = (value) => {
    if (Array.isArray(value))
      return [...new Set(value.map((item) => String(item).trim()).filter(Boolean))];
    if (typeof value === "string" && value.trim()) {
      const trimmed = value.trim();
      if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
        try {
          const parsed = JSON.parse(trimmed);
          if (Array.isArray(parsed))
            return [...new Set(parsed.map((item) => String(item).trim()).filter(Boolean))];
        } catch (_) { /* fall through */ }
      }
      return [...new Set(trimmed.split(",").map((item) => item.trim()).filter(Boolean))];
    }
    return [];
  };

  const normalizeDocuments = (input) => {
    if (!Array.isArray(input)) return [];
    return input.map((doc) => {
      if (!doc || typeof doc !== "object") return null;
      const title    = String(doc.title    || "").trim();
      const filePath = String(doc.filePath || "").trim();
      if (!title || !filePath) return null;
      return {
        id:           String(doc.id || `${Date.now()}-${Math.random().toString(36).slice(2)}`),
        title,
        filePath,
        originalName: String(doc.originalName || "").trim() || filePath.split("/").pop(),
        uploadedAt:   doc.uploadedAt ?? null,
      };
    }).filter(Boolean);
  };

  // ─── FIX #11: Safe number parser — never stores NaN ───────────────────────
  const safeParseFloat = (value, fallback = 0) => {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const sanitizeFormShape = useCallback((data) => {
    const safe = { ...data };
    Object.keys(initialFormData).forEach((key) => {
      const init = initialFormData[key];
      const curr = safe[key];
      if (typeof init === "string"  && (curr === null || curr === undefined)) safe[key] = "";
      if (typeof init === "number") {
        // FIX #11: Use safeParseFloat so NaN never enters state
        safe[key] = safeParseFloat(curr, init);
      }
      if (typeof init === "boolean" && typeof curr !== "boolean") safe[key] = init;
    });
    return safe;
  }, [initialFormData]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Reset on open / customer change ─────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;

    if (selectedCustomer) {
      createDraftBaselineRef.current = null;
      const merged = sanitizeFormShape({ ...initialFormData, ...selectedCustomer });

      const storedCountryName = merged.country    || "";
      const storedCountryCode = merged.countryCode || "";

      setFormData({
        ...merged,
        country:     storedCountryName,
        countryCode: storedCountryCode,
        customerauthenticationValue: normalizeAuthValues(merged.customerauthenticationValue),
        vendorauthenticationValue:   normalizeAuthValues(merged.vendorauthenticationValue),
        ratesEmails:   normalizeListToInput(merged.ratesEmails),
        billingEmails: normalizeListToInput(merged.billingEmails || merged.billingEmail),
        disputeEmails: normalizeListToInput(merged.disputeEmails || merged.disputeEmail),
        nocEmails:     normalizeListToInput(merged.nocEmails     || merged.nocEmail),
        documents:     normalizeDocuments(merged.documents),
        billingStartDate: merged.billingStartDate || initialFormData.billingStartDate,
        lastbillingdate:  merged.lastbillingdate  || "",
        nextbillingdate:  merged.nextbillingdate  || "",
        accountOwner:
          selectedCustomer.accountOwner ||
          (selectedCustomer.owner?.id)  || "",
      });

      setCountrySearchTerm(storedCountryName);
    } else {
      const baseFormData = {
        ...initialFormData,
        accountId:    `ACC${Math.floor(1000 + Math.random() * 9000)}`,
        customerCode: `C_${Math.floor(10000 + Math.random() * 90000)}`,
      };

      createDraftBaselineRef.current = { ...baseFormData, documents: [] };

      const draft     = loadAccountDraft();
      const draftData = draft?.data && typeof draft.data === "object" ? draft.data : null;

      if (draftData) {
        const merged = sanitizeFormShape({ ...baseFormData, ...draftData });
        setFormData({
          ...merged,
          customerauthenticationValue: normalizeAuthValues(merged.customerauthenticationValue),
          vendorauthenticationValue:   normalizeAuthValues(merged.vendorauthenticationValue),
          ratesEmails:   normalizeListToInput(merged.ratesEmails),
          billingEmails: normalizeListToInput(merged.billingEmails || merged.billingEmail),
          disputeEmails: normalizeListToInput(merged.disputeEmails || merged.disputeEmail),
          nocEmails:     normalizeListToInput(merged.nocEmails || merged.nocEmail),
          documents: [],
        });
        setCountrySearchTerm(String(merged.country || ""));

        // FIX #12: Show when the draft was saved so user knows if it's stale
        const savedAtLabel = draft.savedAt
          ? new Date(draft.savedAt).toLocaleString()
          : "unknown time";

        toast({
          title: "Draft Restored",
          description: `Your previously saved draft (from ${savedAtLabel}) has been loaded.`,
          status: "info",
          duration: 3000,
          isClosable: true,
        });
      } else {
        setFormData(baseFormData);
        setCountrySearchTerm("");
      }
    }

    setPendingDocuments([]);
    setDocumentTitle("");
    setDocumentFile(null);
  }, [selectedCustomer, isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Next billing date auto-calc ──────────────────────────────────────────────
  useEffect(() => {
    const { lastbillingdate, billingCycle } = formData;
    if (!lastbillingdate || !billingCycle) return;

    const dt = new Date(lastbillingdate);
    if (isNaN(dt.getTime())) return; // FIX: guard invalid date

    switch (billingCycle) {
      case "daily":     dt.setDate(dt.getDate() + 1);         break;
      case "weekly":    dt.setDate(dt.getDate() + 7);         break;
      case "monthly":   dt.setMonth(dt.getMonth() + 1);       break;
      case "quarterly": dt.setMonth(dt.getMonth() + 3);       break;
      case "annually":  dt.setFullYear(dt.getFullYear() + 1); break;
      default: return;
    }
    const iso = dt.toISOString().split("T")[0];
    if (iso !== formData.nextbillingdate)
      setFormData((fd) => ({ ...fd, nextbillingdate: iso }));
  }, [formData.lastbillingdate, formData.billingCycle]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Country select handlers ──────────────────────────────────────────────────
  const handleCountryInputChange = useCallback((e) => {
    const raw = typeof e === "string" ? e : e?.target?.value ?? "";
    setCountrySearchTerm(raw);
    if (!raw.trim()) {
      setFormData((fd) => ({ ...fd, country: "", countryCode: "" }));
    }
  }, []);

  const handleCountrySelect = useCallback((eventOrValue) => {
    const selectedLabel =
      typeof eventOrValue === "string"
        ? eventOrValue
        : eventOrValue?.target?.value ?? eventOrValue?.value ?? "";

    if (!selectedLabel) return;

    const matched = countryOptions.find(
      (item) => buildCountryLabel(item.country_name, item.code) === selectedLabel,
    );

    if (!matched) return;

    setFormData((fd) => ({
      ...fd,
      country:     matched.country_name,
      countryCode: matched.code,
    }));
    setCountrySearchTerm(matched.country_name);
  }, [countryOptions]);

  // ── Document handlers ────────────────────────────────────────────────────────
  const handleAddDocument = async () => {
    if (!canAddDocument || documentBusy) return;
    const title = documentTitle.trim();

    // FIX: Validate file size client-side (10 MB limit) before upload
    if (documentFile && documentFile.size > 10 * 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: "Please upload a file smaller than 10 MB.",
        status: "warning", duration: 4000, isClosable: true,
      });
      return;
    }

    if (!selectedCustomer?.id) {
      setPendingDocuments((prev) => [
        ...prev,
        {
          id: `pending-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          title,
          file: documentFile,
          originalName: documentFile.name,
        },
      ]);
      setDocumentTitle("");
      setDocumentFile(null);
      toast({
        title: "Document Queued",
        description: `"${title}" will be uploaded after the account is saved.`,
        status: "success", duration: 2500, isClosable: true,
      });
      return;
    }

    setDocumentBusy(true);
    try {
      const result = await uploadAccountDocument(selectedCustomer.id, { title, file: documentFile });
      setFormData((prev) => ({
        ...prev,
        documents: normalizeDocuments(result?.documents ?? prev.documents),
      }));
      setDocumentTitle("");
      setDocumentFile(null);
      toast({
        title: "Document Uploaded",
        description: `"${title}" was uploaded successfully.`,
        status: "success", duration: 2500, isClosable: true,
      });
    } catch (error) {
      // FIX #3: Use friendly error message
      toast({
        title: "Upload Failed",
        description: getFriendlyErrorMessage(error, "Could not upload the document. Please try again."),
        status: "error", duration: 4000, isClosable: true,
      });
    } finally {
      setDocumentBusy(false);
    }
  };

  const handleRemoveDocument = async (documentId, isPending = false) => {
    if (isViewMode || documentBusy) return;
    if (isPending) {
      setPendingDocuments((prev) => prev.filter((d) => d.id !== documentId));
      toast({
        title: "Document Removed",
        description: "The queued document has been removed.",
        status: "info", duration: 2000, isClosable: true,
      });
      return;
    }
    if (!selectedCustomer?.id) return;

    setDocumentBusy(true);
    try {
      const result = await deleteAccountDocument(selectedCustomer.id, documentId);
      // FIX #5: Guard against unexpected API response shape
      const updatedDocs = normalizeDocuments(result?.documents ?? []);
      setFormData((prev) => ({ ...prev, documents: updatedDocs }));
      toast({
        title: "Document Removed",
        description: "The document has been permanently deleted.",
        status: "success", duration: 2500, isClosable: true,
      });
    } catch (error) {
      // FIX #3: Friendly message
      toast({
        title: "Could Not Remove Document",
        description: getFriendlyErrorMessage(error, "Failed to delete the document. Please try again."),
        status: "error", duration: 3500, isClosable: true,
      });
    } finally {
      setDocumentBusy(false);
    }
  };

  const handleDownloadDocument = async (doc) => {
    if (documentBusy || !selectedCustomer?.id) return;

    // FIX #4: Safe filename — guard against undefined filePath
    const fileName =
      doc.originalName ||
      (doc.filePath ? doc.filePath.split("/").pop() : null) ||
      doc.title ||
      "document";

    setDocumentBusy(true);
    try {
      await downloadAccountDocument(selectedCustomer.id, doc.id, fileName);
      toast({
        title: "Download Started",
        description: `"${doc.title}" is being downloaded.`,
        status: "success", duration: 2000, isClosable: true,
      });
    } catch (error) {
      // FIX #3: Friendly message
      toast({
        title: "Download Failed",
        description: getFriendlyErrorMessage(error, "Could not download the document. Please try again."),
        status: "error", duration: 3500, isClosable: true,
      });
    } finally {
      setDocumentBusy(false);
    }
  };

  // FIX #15: Wrapped viewAccountDocument with error handling
  const handleViewDocument = async (customerId, docId, docTitle) => {
    try {
      await viewAccountDocument(customerId, docId);
    } catch (error) {
      toast({
        title: "Could Not Open Document",
        description: getFriendlyErrorMessage(error, `Unable to open "${docTitle}". Try downloading it instead.`),
        status: "error", duration: 3500, isClosable: true,
      });
    }
  };

  // ── Options ──────────────────────────────────────────────────────────────────
  const accountRoleOptions = [
    { value: "customer", label: "Customer"  },
    { value: "vendor",   label: "Vendor"    },
    { value: "both",     label: "Bilateral" },
  ];
  const statusOptions = [
    { value: "active",   label: "Active"   },
    { value: "inactive", label: "Inactive" },
  ];
  const authTypeOptions = [
    { value: "ip",     label: "IP Address",  description: "Match by source IP"    },
    { value: "custom", label: "Custom Field", description: "Match by custom field" },
  ];

  // ── Validation ───────────────────────────────────────────────────────────────
  const validateForm = () => {
    const errors  = [];
    const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    // FIX #13: Cap invalid email list shown in error so toast stays readable
    const validateEmailList = (rawValue, label, required = false) => {
      const emails = splitEmailList(rawValue);
      if (required && emails.length === 0) {
        errors.push(`${label} is required — please enter at least one email address.`);
        return;
      }
      const invalid = emails.filter((e) => !emailRx.test(e));
      if (invalid.length > 0) {
        const shown   = invalid.slice(0, 3).join(", ");
        const andMore = invalid.length > 3 ? ` and ${invalid.length - 3} more` : "";
        errors.push(`${label} contains invalid email address(es): ${shown}${andMore}`);
      }
    };

    if (!formData.accountName?.trim())
      errors.push("Account name is required.");
    if (!formData.email?.trim())
      errors.push("Account email is required.");
    if (formData.email?.trim() && !emailRx.test(formData.email.trim()))
      errors.push("Account email address is not valid.");
    if (formData.contactPersonEmail?.trim() && !emailRx.test(formData.contactPersonEmail.trim()))
      errors.push("Contact person email address is not valid.");

    validateEmailList(formData.ratesEmails,   "Rates Emails",   true);
    validateEmailList(formData.billingEmails,  "Billing Emails", true);
    validateEmailList(formData.disputeEmails,  "Dispute Emails", true);
    validateEmailList(formData.nocEmails,      "NOC Emails",     true);

    if (users.length > 0 && !formData.accountOwner)
      errors.push("Please select an account owner.");
    if (!formData.billingStartDate)
      errors.push("Billing Start Date is required.");

    // FIX #2: Country error uses plain language — no mention of internal field names
    if (!formData.countryCode)
      errors.push("Please select a country from the dropdown list.");

    if (formData.accountRole === "customer" || formData.accountRole === "both") {
      const vals = normalizeAuthValues(formData.customerauthenticationValue);
      if (!formData.customerauthenticationType)
        errors.push("Customer authentication type is required.");
      if (vals.length === 0)
        errors.push("At least one Customer authentication value is required (e.g. an IP address).");
    }
    if (formData.accountRole === "vendor" || formData.accountRole === "both") {
      const vals = normalizeAuthValues(formData.vendorauthenticationValue);
      if (!formData.vendorauthenticationType)
        errors.push("Vendor authentication type is required.");
      if (vals.length === 0)
        errors.push("At least one Vendor authentication value is required (e.g. an IP address).");
    }

    return errors;
  };

  // ── Save ─────────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (isViewMode) return;

    const validationErrors = validateForm();
    if (validationErrors.length > 0) {
      // FIX: Show count when many errors so user knows there's more below
      const firstFew   = validationErrors.slice(0, 4);
      const remaining  = validationErrors.length - firstFew.length;
      const description =
        firstFew.join("\n") +
        (remaining > 0 ? `\n…and ${remaining} more issue(s). Please review all fields.` : "");

      toast({
        title: `Please Fix ${validationErrors.length} Issue${validationErrors.length > 1 ? "s" : ""}`,
        description,
        status: "error",
        duration: 7000,
        isClosable: true,
      });
      return;
    }

    setLoading(true);
    try {
      const nBilling = splitEmailList(formData.billingEmails || formData.billingEmail).join(", ");
      const nDispute = splitEmailList(formData.disputeEmails || formData.disputeEmail).join(", ");
      const nNoc     = splitEmailList(formData.nocEmails     || formData.nocEmail).join(", ");
      const nRates   = splitEmailList(formData.ratesEmails).join(", ");
      const syncedContactEmails = formData.syncContactEmailsWithRates
        ? getSyncedContactEmailValues(formData.ratesEmails)
        : {};

      // FIX #10: Validate derived primary emails exist before saving
      const primaryBilling = firstEmailFromList(nBilling) || formData.billingEmail || "";
      const primaryDispute = firstEmailFromList(nDispute) || formData.disputeEmail || "";
      const primaryNoc     = firstEmailFromList(nNoc)     || formData.nocEmail     || "";

      const sanitizedData = {
        ...formData,
        ...syncedContactEmails,
        country:     (formData.countryCode || formData.country || "").trim(),
        countryCode: (formData.countryCode || "").trim(),
        ratesEmails:   splitEmailList(nRates),
        billingEmails: splitEmailList(nBilling),
        disputeEmails: splitEmailList(nDispute),
        nocEmails:     splitEmailList(nNoc),
        billingEmail:  primaryBilling,
        disputeEmail:  primaryDispute,
        nocEmail:      primaryNoc,
        customerauthenticationValue: normalizeAuthValues(formData.customerauthenticationValue),
        vendorauthenticationValue:   normalizeAuthValues(formData.vendorauthenticationValue),
        documents:     normalizeDocuments(formData.documents),
        lastbillingdate: formData.lastbillingdate || null,
        nextbillingdate: formData.nextbillingdate || null,
        billingClass:    formData.billingClass    || "paiusa",
        // FIX #11: Re-sanitize numbers one last time before API call
        creditLimit:         safeParseFloat(formData.creditLimit, 0),
        originalCreditLimit: safeParseFloat(formData.originalCreditLimit, 0),
        balance:             safeParseFloat(formData.balance, 0),
        outstandingAmount:   safeParseFloat(formData.outstandingAmount, 0),
      };

      // Clean up legacy / derived keys
      ["ratesMobileNumber", "billingPhoneNumbers", "disputePhoneNumber",
        "nocPhoneNumbers", "carrierType", "syncContactEmailsWithRates",
      ].forEach((k) => delete sanitizedData[k]);

      // Re-compute nextbillingdate
      if (sanitizedData.lastbillingdate && sanitizedData.billingCycle) {
        const dt = new Date(sanitizedData.lastbillingdate);
        if (!isNaN(dt.getTime())) {
          switch (sanitizedData.billingCycle) {
            case "daily":     dt.setDate(dt.getDate() + 1);         break;
            case "weekly":    dt.setDate(dt.getDate() + 7);         break;
            case "monthly":   dt.setMonth(dt.getMonth() + 1);       break;
            case "quarterly": dt.setMonth(dt.getMonth() + 3);       break;
            case "annually":  dt.setFullYear(dt.getFullYear() + 1); break;
            default: break;
          }
          sanitizedData.nextbillingdate = dt.toISOString().split("T")[0];
        }
      }

      const savedAccount = selectedCustomer
        ? await updateCustomer(selectedCustomer.id, sanitizedData)
        : await createCustomer(sanitizedData);

      // Upload queued documents after account creation
      if (!selectedCustomer && pendingDocuments.length > 0 && savedAccount?.id) {
        const failed   = [];
        const succeeded = [];

        for (const pending of pendingDocuments) {
          try {
            await uploadAccountDocument(savedAccount.id, {
              title: pending.title,
              file:  pending.file,
            });
            succeeded.push(pending.title);
          } catch (err) {
            // FIX #7: Distinguish errors per document with friendly messages
            failed.push(`"${pending.title}" — ${getFriendlyErrorMessage(err, "upload failed")}`);
          }
        }

        if (failed.length > 0 && succeeded.length > 0) {
          toast({
            title: `${succeeded.length} Document(s) Uploaded, ${failed.length} Failed`,
            description: failed.join("\n"),
            status: "warning", duration: 7000, isClosable: true,
          });
        } else if (failed.length > 0) {
          toast({
            title: "Documents Could Not Be Uploaded",
            description: failed.join("\n"),
            status: "error", duration: 7000, isClosable: true,
          });
        }
      }

      // FIX #15: Trim account name in toast so no stray whitespace is displayed
      const displayName = formData.accountName.trim();
      toast({
        title: selectedCustomer ? "Account Updated" : "Account Created",
        description: `"${displayName}" has been ${selectedCustomer ? "updated" : "created"} successfully.`,
        status: "success", duration: 3000, isClosable: true,
      });

      if (!selectedCustomer) clearAccountDraft();

      onSuccess?.();
      onClose();
    } catch (error) {
      // FIX #3: Friendly top-level save error
      toast({
        title: selectedCustomer ? "Could Not Update Account" : "Could Not Create Account",
        description: getFriendlyErrorMessage(
          error,
          "An unexpected error occurred while saving. Please try again or contact support.",
        ),
        status: "error", duration: 6000, isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  // ── Account role change ──────────────────────────────────────────────────────
  const handleAccountRoleChange = (role) => {
    setFormData((fd) => ({
      ...fd,
      accountRole: role,
      customerCode:
        (role === "customer" || role === "both") && !fd.customerCode
          ? `C_${Math.floor(10000 + Math.random() * 90000)}`
          : role === "vendor" ? "" : fd.customerCode,
      vendorCode:
        (role === "vendor" || role === "both") && !fd.vendorCode
          ? `P_${Math.floor(10000 + Math.random() * 90000)}`
          : role === "customer" ? "" : fd.vendorCode,
    }));
  };

  const stickyTabListBg = useColorModeValue("white", "gray.800");
  const canUseDraft     = !isViewMode && !selectedCustomer;

  const hasDraftableChanges = useMemo(() => {
    if (!canUseDraft || !createDraftBaselineRef.current) return false;
    const normalize = (value) => ({ ...value, documents: [] });
    try {
      return JSON.stringify(normalize(formData)) !== JSON.stringify(normalize(createDraftBaselineRef.current));
    } catch {
      return false;
    }
  }, [canUseDraft, formData]);

  const showDraftActions = canUseDraft && hasDraftableChanges;

  // FIX #9: handleSaveDraft wrapped in try/catch with user-facing toast on storage errors
  const handleSaveDraft = useCallback(() => {
    if (!showDraftActions) return;
    try {
      persistAccountDraft({
        savedAt: new Date().toISOString(),
        data: { ...formData, documents: [] },
      });
      toast({
        title: "Draft Saved",
        description: "Your progress has been saved locally. It will be restored next time you open this form.",
        status: "success",
        duration: 2500,
        isClosable: true,
      });
    } catch (err) {
      toast({
        title: "Could Not Save Draft",
        description: err.message || "Unable to save draft to your browser. Please try again.",
        status: "error",
        duration: 4000,
        isClosable: true,
      });
    }
  }, [formData, showDraftActions, toast]);

  const handleClearDraft = useCallback(() => {
    clearAccountDraft();
    if (!canUseDraft) return;

    const resetData = {
      ...initialFormData,
      accountId:    `ACC${Math.floor(1000 + Math.random() * 9000)}`,
      customerCode: `C_${Math.floor(10000 + Math.random() * 90000)}`,
    };

    createDraftBaselineRef.current = { ...resetData, documents: [] };

    setFormData(resetData);
    setCountrySearchTerm("");
    setPendingDocuments([]);
    setDocumentTitle("");
    setDocumentFile(null);

    toast({
      title: "Draft Cleared",
      description: "Your saved draft has been removed and the form has been reset.",
      status: "info",
      duration: 2000,
      isClosable: true,
    });
  }, [canUseDraft, initialFormData, toast]);

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <Modal
      isOpen={isOpen}
      onClose={() => !loading && onClose()}
      size={{ base: "sm", md: "4xl", lg: "6xl" }}
      closeOnOverlayClick={!loading}
    >
      <ModalOverlay />
      <ModalContent my={6} borderRadius="8px" maxH="90vh">

        {/* Header */}
        <ModalHeader
          borderTopRadius="8px" bgColor="blue.500" color="white"
          position="sticky" top={0} zIndex={1}
          borderBottom="1px" borderColor="gray.200"
        >
          <VStack align="start" spacing={1}>
            <Heading size="md" fontWeight="semibold" color="white">
              {isViewMode
                ? "View Account Details"
                : selectedCustomer ? "Edit Account" : "Account Creation"}
              {formData.accountName ? ` — ${formData.accountName.trim()}` : ""}
            </Heading>
            {selectedCustomer && (
              <Text fontSize="sm" color="white">
                Account ID: {selectedCustomer.accountId}
              </Text>
            )}
          </VStack>
          <ModalCloseButton color="white" top={4} right={4} isDisabled={loading} />
        </ModalHeader>

        <ModalBody overflowY="auto" maxH="calc(90vh - 150px)">
          <VStack spacing={6} align="stretch" pb={4}>
            <Tabs variant="line" colorScheme="blue" isFitted>
              <TabList
                position="sticky" zIndex={1} top={0}
                bg={stickyTabListBg}
                borderBottom="1px" borderColor="gray.200"
              >
                <Tab>Account Information</Tab>
                <Tab>Billing &amp; Authentication</Tab>
                <Tab>Documents</Tab>
                {selectedCustomer && <Tab>Usage Statistics</Tab>}
              </TabList>

              <Box as="fieldset" disabled={isViewMode} border="0" p={0} m={0} minW="100%">
                <TabPanels>

                  {/* ── Tab 1: Account Information ── */}
                  <TabPanel>
                    <VStack spacing={4} align="stretch">
                      <Box>
                        <Heading size="sm" mb={2}>Account Information</Heading>
                        <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={4}>
                          <FormControl isRequired>
                            <FormLabel>Account Role</FormLabel>
                            <Select
                              value={formData.accountRole}
                              onChange={(e) => handleAccountRoleChange(e.target.value)}
                              isDisabled={!!selectedCustomer || isViewMode}
                            >
                              {accountRoleOptions.map((o) => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                              ))}
                            </Select>
                            <FormHelperText>Determines billing and CDR mapping</FormHelperText>
                          </FormControl>

                          <FormControl>
                            <FormLabel>Billing Type</FormLabel>
                            <Select
                              value={formData.billingType}
                              onChange={(e) =>
                                setFormData((fd) => ({
                                  ...fd,
                                  billingType: e.target.value,
                                  ...(e.target.value === "prepaid"
                                    ? { creditLimit: 0, originalCreditLimit: 0 }
                                    : {}),
                                }))
                              }
                              isDisabled={isViewMode}
                            >
                              <option value="prepaid">Prepaid</option>
                              <option value="postpaid">Postpaid</option>
                            </Select>
                          </FormControl>

                          <FormControl isRequired>
                            <FormLabel>Account Name</FormLabel>
                            <Input
                              value={formData.accountName}
                              onChange={(e) => setFormData((fd) => ({ ...fd, accountName: e.target.value }))}
                              placeholder="Company Name"
                              isDisabled={isViewMode}
                            />
                          </FormControl>

                          <FormControl>
                            <FormLabel>Contact Person</FormLabel>
                            <Input
                              value={formData.contactPerson}
                              onChange={(e) => setFormData((fd) => ({ ...fd, contactPerson: e.target.value }))}
                              placeholder="Contact Person"
                              isDisabled={isViewMode}
                            />
                          </FormControl>

                          <FormControl>
                            <FormLabel>Contact Person Email</FormLabel>
                            <Input
                              value={formData.contactPersonEmail}
                              onChange={(e) => setFormData((fd) => ({ ...fd, contactPersonEmail: e.target.value }))}
                              placeholder="contact@example.com"
                              isDisabled={isViewMode}
                            />
                          </FormControl>

                          <FormControl>
                            <FormLabel>Contact Person Phone</FormLabel>
                            <Input
                              value={formData.contactPersonPhone}
                              onChange={(e) => setFormData((fd) => ({ ...fd, contactPersonPhone: e.target.value }))}
                              placeholder="+1234567890"
                              isDisabled={isViewMode}
                            />
                          </FormControl>

                          <FormControl>
                            <FormLabel>Account Owner</FormLabel>
                            {users.length > 0 ? (
                              <Select
                                placeholder="Select owner"
                                value={formData.accountOwner || ""}
                                onChange={(e) => setFormData((fd) => ({ ...fd, accountOwner: e.target.value }))}
                                isDisabled={isViewMode}
                              >
                                {users.map((u) => (
                                  <option key={u.id} value={u.id}>
                                    {u.first_name} {u.last_name} ({u.role})
                                  </option>
                                ))}
                              </Select>
                            ) : (
                              <Input
                                value={formData.accountOwner}
                                onChange={(e) => setFormData((fd) => ({ ...fd, accountOwner: e.target.value }))}
                                placeholder="Sales Rep Name"
                                isDisabled={isViewMode}
                              />
                            )}
                          </FormControl>

                          <FormControl isRequired>
                            <FormLabel>Account Email</FormLabel>
                            <Input
                              type="email"
                              value={formData.email}
                              onChange={(e) => setFormData((fd) => ({ ...fd, email: e.target.value }))}
                              placeholder="account@example.com"
                              isDisabled={isViewMode}
                            />
                          </FormControl>
                        </SimpleGrid>
                      </Box>

                      <Divider />

                      <Box>
                        <Heading size="sm" mb={2}>Contact Information</Heading>
                        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                          <FormControl>
                            <FormLabel>Rates Emails</FormLabel>
                            <Input
                              value={formData.ratesEmails}
                              onChange={(e) => setFormData((fd) => ({ ...fd, ratesEmails: e.target.value }))}
                              placeholder="rates1@example.com, rates2@example.com"
                              isDisabled={isViewMode}
                            />
                            <FormHelperText>Comma-separated emails</FormHelperText>
                          </FormControl>

                          <FormControl>
                            <HStack justify="space-between" align="center" spacing={4}>
                              <Box>
                                <FormLabel mb={0}>Same as Rates Emails</FormLabel>
                                <FormHelperText mt={1}>
                                  Mirror the rates email value into all contact email fields.
                                </FormHelperText>
                              </Box>
                              <Switch
                                isChecked={formData.syncContactEmailsWithRates}
                                onChange={(e) => {
                                  const checked = e.target.checked;
                                  setFormData((fd) => ({
                                    ...fd,
                                    syncContactEmailsWithRates: checked,
                                    ...(checked ? getSyncedContactEmailValues(fd.ratesEmails) : {}),
                                  }));
                                }}
                                isDisabled={isViewMode}
                                colorScheme="blue"
                              />
                            </HStack>
                          </FormControl>

                          <FormControl>
                            <FormLabel>Billing Emails</FormLabel>
                            <Input
                              value={formData.billingEmails}
                              onChange={(e) => setFormData((fd) => ({ ...fd, billingEmails: e.target.value }))}
                              placeholder="billing1@example.com, billing2@example.com"
                              isDisabled={isViewMode || formData.syncContactEmailsWithRates}
                            />
                            <FormHelperText>Comma-separated emails</FormHelperText>
                          </FormControl>

                          <FormControl>
                            <FormLabel>Dispute Emails</FormLabel>
                            <Input
                              value={formData.disputeEmails}
                              onChange={(e) => setFormData((fd) => ({ ...fd, disputeEmails: e.target.value }))}
                              placeholder="dispute@example.com"
                              isDisabled={isViewMode || formData.syncContactEmailsWithRates}
                            />
                            <FormHelperText>Comma-separated emails</FormHelperText>
                          </FormControl>

                          <FormControl>
                            <FormLabel>NOC Emails</FormLabel>
                            <Input
                              value={formData.nocEmails}
                              onChange={(e) => setFormData((fd) => ({ ...fd, nocEmails: e.target.value }))}
                              placeholder="noc@example.com"
                              isDisabled={isViewMode || formData.syncContactEmailsWithRates}
                            />
                            <FormHelperText>Comma-separated emails</FormHelperText>
                          </FormControl>

                          <FormControl>
                            <FormLabel>SOA Email</FormLabel>
                            <Input
                              type="email"
                              value={formData.soaEmail}
                              onChange={(e) => setFormData((fd) => ({ ...fd, soaEmail: e.target.value }))}
                              placeholder="soa@example.com"
                              isDisabled={isViewMode || formData.syncContactEmailsWithRates}
                            />
                          </FormControl>

                          <FormControl>
                            <FormLabel>Primary Phone</FormLabel>
                            <Input
                              value={formData.phone}
                              onChange={(e) => setFormData((fd) => ({ ...fd, phone: e.target.value }))}
                              placeholder="+1234567890"
                              isDisabled={isViewMode}
                            />
                          </FormControl>
                        </SimpleGrid>
                      </Box>

                      <Divider />

                      <Box>
                        <Heading size="sm" mb={4}>Account Status</Heading>
                        <FormControl isRequired>
                          <FormLabel>Account Status</FormLabel>
                          <Select
                            value={formData.accountStatus}
                            onChange={(e) =>
                              setFormData((fd) => ({
                                ...fd,
                                accountStatus: e.target.value,
                                active: e.target.value === "active",
                              }))
                            }
                            isDisabled={isViewMode}
                          >
                            {statusOptions.map((o) => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </Select>
                        </FormControl>
                      </Box>

                      <Divider />

                      <Box>
                        <Heading size="sm" mb={2}>Address Information</Heading>
                        <VStack spacing={3}>
                          <FormControl>
                            <FormLabel>Address Line 1</FormLabel>
                            <Input
                              value={formData.addressLine1}
                              onChange={(e) => setFormData((fd) => ({ ...fd, addressLine1: e.target.value }))}
                              placeholder="Street address"
                              isDisabled={isViewMode}
                            />
                          </FormControl>
                          <FormControl>
                            <FormLabel>Address Line 2</FormLabel>
                            <Input
                              value={formData.addressLine2}
                              onChange={(e) => setFormData((fd) => ({ ...fd, addressLine2: e.target.value }))}
                              placeholder="Apartment, suite, etc."
                              isDisabled={isViewMode}
                            />
                          </FormControl>
                          <FormControl>
                            <FormLabel>Address Line 3</FormLabel>
                            <Input
                              value={formData.addressLine3}
                              onChange={(e) => setFormData((fd) => ({ ...fd, addressLine3: e.target.value }))}
                              placeholder="Additional address"
                              isDisabled={isViewMode}
                            />
                          </FormControl>

                          <SimpleGrid columns={2} spacing={4} w="full">
                            <FormControl>
                              <FormLabel>City</FormLabel>
                              <Input
                                value={formData.city}
                                onChange={(e) => setFormData((fd) => ({ ...fd, city: e.target.value }))}
                                placeholder="City"
                                isDisabled={isViewMode}
                              />
                            </FormControl>
                            <FormControl>
                              <FormLabel>State / Province</FormLabel>
                              <Input
                                value={formData.state}
                                onChange={(e) => setFormData((fd) => ({ ...fd, state: e.target.value }))}
                                placeholder="State"
                                isDisabled={isViewMode}
                              />
                            </FormControl>
                            <FormControl>
                              <FormLabel>Postal Code</FormLabel>
                              <Input
                                value={formData.postalCode}
                                onChange={(e) => setFormData((fd) => ({ ...fd, postalCode: e.target.value }))}
                                placeholder="ZIP / Postal code"
                                isDisabled={isViewMode}
                              />
                            </FormControl>

                            <FormControl isRequired>
                              <FormLabel>Country</FormLabel>
                              <SearchSelect
                                data={savedCountryLabel}
                                options={countryOptionLabels}
                                placeholder="Type to search country…"
                                disabled={isViewMode}
                                onChange={handleCountryInputChange}
                                onSelect={handleCountrySelect}
                              />
                              <FormHelperText>
                                {countryLoading
                                  ? "Searching…"
                                  : countryOptions.length > 0
                                  ? `${countryOptions.length} result(s) found`
                                  : countrySearchTerm.trim()
                                  ? "No matches — try a different term"
                                  : "Start typing to search"}
                              </FormHelperText>
                            </FormControl>
                          </SimpleGrid>
                        </VStack>
                      </Box>

                      <Divider />

                      <Box>
                        <Heading size="sm" mb={2}>Localization</Heading>
                        <SimpleGrid columns={2} spacing={4}>
                          <FormControl>
                            <FormLabel>Timezone</FormLabel>
                            <Select
                              value={formData.timezone}
                              onChange={(e) => setFormData((fd) => ({ ...fd, timezone: e.target.value }))}
                              isDisabled={isViewMode}
                            >
                              {["UTC","EST","CST","PST","GMT","IST","HST","AEST"].map((tz) => (
                                <option key={tz} value={tz}>{tz}</option>
                              ))}
                            </Select>
                          </FormControl>
                          <FormControl>
                            <FormLabel>Preferred Language</FormLabel>
                            <Select
                              value={formData.languages}
                              onChange={(e) => setFormData((fd) => ({ ...fd, languages: e.target.value }))}
                              isDisabled={isViewMode}
                            >
                              {[
                                ["en","English"],["es","Spanish"],["fr","French"],
                                ["de","German"],["it","Italian"],["pt","Portuguese"],
                                ["zh","Chinese"],["ja","Japanese"],["hi","Hindi"],
                              ].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                            </Select>
                          </FormControl>
                        </SimpleGrid>
                      </Box>

                      <Divider />

                      <Box>
                        <Heading size="sm" mb={2}>Financial Information</Heading>
                        <SimpleGrid columns={2} spacing={4}>
                          <FormControl>
                            <FormLabel>Currency</FormLabel>
                            <Select
                              value={formData.currency}
                              onChange={(e) => setFormData((fd) => ({ ...fd, currency: e.target.value }))}
                              isDisabled={isViewMode}
                            >
                              {["USD","EUR","GBP","INR","AUD","CAD"].map((c) => (
                                <option key={c} value={c}>{c}</option>
                              ))}
                            </Select>
                          </FormControl>
                          <FormControl>
                            <FormLabel>VAT Number</FormLabel>
                            <Input
                              value={formData.vatNumber}
                              onChange={(e) => setFormData((fd) => ({ ...fd, vatNumber: e.target.value }))}
                              placeholder="VAT / Tax ID"
                              isDisabled={isViewMode}
                            />
                          </FormControl>
                          <FormControl>
                            <FormLabel>Nominal Code</FormLabel>
                            <Input
                              value={formData.nominalCode}
                              onChange={(e) => setFormData((fd) => ({ ...fd, nominalCode: e.target.value }))}
                              placeholder="Accounting code"
                              isDisabled={isViewMode}
                            />
                          </FormControl>
                          <FormControl>
                            <FormLabel>Verification Status</FormLabel>
                            <Select
                              value={formData.verificationStatus}
                              onChange={(e) => setFormData((fd) => ({ ...fd, verificationStatus: e.target.value }))}
                              isDisabled={isViewMode}
                            >
                              <option value="pending">Pending</option>
                              <option value="verified">Verified</option>
                              <option value="unverified">Not Verified</option>
                            </Select>
                          </FormControl>
                        </SimpleGrid>
                      </Box>
                    </VStack>
                  </TabPanel>

                  {/* ── Tab 2: Billing & Authentication ── */}
                  <TabPanel>
                    <VStack spacing={4} align="stretch">
                      <Heading size="sm" mb={2}>Billing Settings</Heading>
                      <SimpleGrid columns={3} spacing={4}>
                        <FormControl>
                          <FormLabel>Billing Class</FormLabel>
                          <Select
                            placeholder="Select class"
                            value={formData.billingClass}
                            onChange={(e) => setFormData((fd) => ({ ...fd, billingClass: e.target.value }))}
                            isDisabled={isViewMode}
                          >
                            <option value="cyvora">Cyvora</option>
                          </Select>
                        </FormControl>

                        <FormControl>
                          <FormLabel>Billing Timezone</FormLabel>
                          <Select value={formData.billingTimezone} isDisabled>
                            {["UTC","EST","PST","IST","GMT"].map((tz) => (
                              <option key={tz} value={tz}>{tz}</option>
                            ))}
                          </Select>
                        </FormControl>

                        <FormControl isRequired>
                          <FormLabel>Billing Start Date</FormLabel>
                          <Input
                            type="date"
                            value={formData.billingStartDate}
                            onChange={(e) => setFormData((fd) => ({ ...fd, billingStartDate: e.target.value }))}
                            isDisabled={isViewMode}
                          />
                        </FormControl>

                        <FormControl isRequired>
                          <FormLabel>Billing Cycle</FormLabel>
                          <Select
                            value={formData.billingCycle}
                            onChange={(e) => setFormData((fd) => ({ ...fd, billingCycle: e.target.value }))}
                            isDisabled={isViewMode}
                          >
                            {["daily","weekly","monthly","quarterly","annually"].map((c) => (
                              <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                            ))}
                          </Select>
                        </FormControl>

                        {selectedCustomer && (
                          <FormControl>
                            <FormLabel>Last Billing Date</FormLabel>
                            <Input
                              type="date"
                              value={formData.lastbillingdate || ""}
                              onChange={(e) => setFormData((fd) => ({ ...fd, lastbillingdate: e.target.value }))}
                              isDisabled={isViewMode}
                            />
                          </FormControl>
                        )}

                        <FormControl>
                          <FormLabel>Next Billing Date</FormLabel>
                          <Input type="date" value={formData.nextbillingdate || ""} readOnly />
                        </FormControl>

                        {/* FIX #11: Use safeParseFloat in NumberInput onChange */}
                        <FormControl isDisabled={formData.billingType === "prepaid" || isViewMode}>
                          <FormLabel>Credit Limit ($)</FormLabel>
                          <NumberInput
                            value={formData.creditLimit}
                            onChange={(v) =>
                              setFormData((fd) => ({ ...fd, creditLimit: safeParseFloat(v, 0) }))
                            }
                            min={0}
                          >
                            <NumberInputField />
                            <NumberInputStepper>
                              <NumberIncrementStepper />
                              <NumberDecrementStepper />
                            </NumberInputStepper>
                          </NumberInput>
                          <FormHelperText>Maximum credit / prepaid balance</FormHelperText>
                        </FormControl>

                        <FormControl isDisabled={formData.billingType === "prepaid" || isViewMode}>
                          <FormLabel>Original Credit Limit ($)</FormLabel>
                          <NumberInput
                            value={formData.originalCreditLimit}
                            onChange={(v) =>
                              setFormData((fd) => ({ ...fd, originalCreditLimit: safeParseFloat(v, 0) }))
                            }
                            min={0}
                          >
                            <NumberInputField />
                            <NumberInputStepper>
                              <NumberIncrementStepper />
                              <NumberDecrementStepper />
                            </NumberInputStepper>
                          </NumberInput>
                          <FormHelperText>Reset to this after payment (postpaid)</FormHelperText>
                        </FormControl>
                      </SimpleGrid>

                      <Heading size="sm" mb={2} mt={4}>Payment Settings</Heading>
                      <SimpleGrid columns={2} spacing={4}>
                        <FormControl>
                          <FormLabel>Send Invoice Email</FormLabel>
                          <Select
                            value={String(formData.sendInvoiceEmail)}
                            onChange={(e) =>
                              setFormData((fd) => ({ ...fd, sendInvoiceEmail: e.target.value === "true" }))
                            }
                            isDisabled={isViewMode}
                          >
                            <option value="true">Yes</option>
                            <option value="false">No</option>
                          </Select>
                        </FormControl>
                      </SimpleGrid>

                      <Box>
                        <Heading size="sm" mb={4}>CDR Mapping Configuration</Heading>
                        <SimpleGrid columns={2} spacing={4}>
                          <FormControl>
                            <FormLabel>Gateway ID</FormLabel>
                            <Input
                              value={formData.gatewayId}
                              onChange={(e) => setFormData((fd) => ({ ...fd, gatewayId: e.target.value }))}
                              placeholder="Gateway identifier"
                              isDisabled={isViewMode}
                            />
                            <FormHelperText>Gateway identifier for CDR routing</FormHelperText>
                          </FormControl>

                          {(formData.accountRole === "customer" || formData.accountRole === "both") && (
                            <FormControl>
                              <FormLabel>Customer Code</FormLabel>
                              <Input
                                value={formData.customerCode}
                                onChange={(e) => setFormData((fd) => ({ ...fd, customerCode: e.target.value }))}
                                placeholder="C_XXXXX"
                                isDisabled={isViewMode}
                              />
                              <FormHelperText>Optional legacy fallback</FormHelperText>
                            </FormControl>
                          )}

                          {(formData.accountRole === "vendor" || formData.accountRole === "both") && (
                            <FormControl>
                              <FormLabel>Vendor Code</FormLabel>
                              <Input
                                value={formData.vendorCode}
                                onChange={(e) => setFormData((fd) => ({ ...fd, vendorCode: e.target.value }))}
                                placeholder="P_XXXXX"
                                isDisabled={isViewMode}
                              />
                              <FormHelperText>Optional legacy fallback</FormHelperText>
                            </FormControl>
                          )}

                          {(formData.accountRole === "customer" || formData.accountRole === "both") && (
                            <Flex gap={4} flexDirection="column">
                              <FormControl isRequired>
                                <FormLabel>Customer Auth Type</FormLabel>
                                <Select
                                  value={formData.customerauthenticationType}
                                  onChange={(e) =>
                                    setFormData((fd) => ({ ...fd, customerauthenticationType: e.target.value }))
                                  }
                                  isDisabled={isViewMode}
                                >
                                  {authTypeOptions.map((o) => (
                                    <option key={o.value} value={o.value}>{o.label}</option>
                                  ))}
                                </Select>
                                <FormHelperText>
                                  {authTypeOptions.find((o) => o.value === formData.customerauthenticationType)?.description}
                                </FormHelperText>
                              </FormControl>
                              <FormControl isRequired>
                                <FormLabel>Customer Auth Value</FormLabel>
                                <Input
                                  value={
                                    Array.isArray(formData.customerauthenticationValue)
                                      ? formData.customerauthenticationValue.join(", ")
                                      : formData.customerauthenticationValue
                                  }
                                  onChange={(e) =>
                                    setFormData((fd) => ({
                                      ...fd,
                                      customerauthenticationValue: e.target.value,
                                    }))
                                  }
                                  placeholder={
                                    formData.customerauthenticationType === "ip"
                                      ? "192.168.1.1, 192.168.1.2"
                                      : "Value 1, Value 2"
                                  }
                                  isDisabled={isViewMode}
                                />
                                <FormHelperText>
                                  Comma-separated {formData.customerauthenticationType === "ip" ? "IP addresses" : "values"}
                                </FormHelperText>
                              </FormControl>
                            </Flex>
                          )}

                          {(formData.accountRole === "vendor" || formData.accountRole === "both") && (
                            <Flex gap={4} flexDirection="column">
                              <FormControl isRequired>
                                <FormLabel>Vendor Auth Type</FormLabel>
                                <Select
                                  value={formData.vendorauthenticationType}
                                  onChange={(e) =>
                                    setFormData((fd) => ({ ...fd, vendorauthenticationType: e.target.value }))
                                  }
                                  isDisabled={isViewMode}
                                >
                                  {authTypeOptions.map((o) => (
                                    <option key={o.value} value={o.value}>{o.label}</option>
                                  ))}
                                </Select>
                                <FormHelperText>
                                  {authTypeOptions.find((o) => o.value === formData.vendorauthenticationType)?.description}
                                </FormHelperText>
                              </FormControl>
                              <FormControl isRequired>
                                <FormLabel>Vendor Auth Value</FormLabel>
                                <Input
                                  value={
                                    Array.isArray(formData.vendorauthenticationValue)
                                      ? formData.vendorauthenticationValue.join(", ")
                                      : formData.vendorauthenticationValue
                                  }
                                  onChange={(e) =>
                                    setFormData((fd) => ({
                                      ...fd,
                                      vendorauthenticationValue: e.target.value,
                                    }))
                                  }
                                  placeholder={
                                    formData.vendorauthenticationType === "ip"
                                      ? "192.168.1.1, 192.168.1.2"
                                      : "Value 1, Value 2"
                                  }
                                  isDisabled={isViewMode}
                                />
                                <FormHelperText>
                                  Comma-separated {formData.vendorauthenticationType === "ip" ? "IP addresses" : "values"}
                                </FormHelperText>
                              </FormControl>
                            </Flex>
                          )}
                        </SimpleGrid>
                      </Box>
                    </VStack>
                  </TabPanel>

                  {/* ── Tab 3: Documents ── */}
                  <TabPanel px={0} pt={4}>
                    <VStack spacing={5} align="stretch">
                      <Flex align="center" justify="space-between" px={1}>
                        <Box>
                          <HStack spacing={2} mb={1}>
                            <Box as={FiPaperclip} color="blue.500" />
                            <Text fontSize="md" fontWeight="700" color="gray.800">Account Documents</Text>
                            {totalDocs > 0 && (
                              <Badge colorScheme="blue" borderRadius="full" px={2}>{totalDocs}</Badge>
                            )}
                          </HStack>
                          <Text fontSize="sm" color="gray.500">
                            Contracts, invoices, compliance certificates and other account files.
                          </Text>
                        </Box>
                      </Flex>

                      {!selectedCustomer && (
                        <HStack
                          spacing={3} px={4} py={3}
                          bg="orange.50" border="1px solid" borderColor="orange.200"
                          borderRadius="lg" mx={1}
                        >
                          <Box as={FiAlertCircle} color="orange.500" flexShrink={0} />
                          <Text fontSize="sm" color="orange.700">
                            Documents added here will be uploaded once the account is saved.
                          </Text>
                        </HStack>
                      )}

                      {/* Upload form */}
                      <Box
                        bg="gray.50" border="1px solid" borderColor="gray.200"
                        borderRadius="xl" p={5} mx={1}
                      >
                        <Text
                          fontSize="xs" fontWeight="700" color="gray.500"
                          textTransform="uppercase" letterSpacing="wide" mb={4}
                        >
                          Add New Document
                        </Text>
                        <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4} alignItems="end">
                          <FormControl>
                            <FormLabel fontSize="sm" fontWeight="600" color="gray.700" mb={1}>
                              Document Title <Text as="span" color="red.400">*</Text>
                            </FormLabel>
                            <Input
                              value={documentTitle}
                              onChange={(e) => setDocumentTitle(e.target.value)}
                              placeholder="e.g. Service Contract 2026"
                              isDisabled={isViewMode || documentBusy}
                              bg="white" borderColor="gray.300" borderRadius="lg" fontSize="sm"
                              _focus={{ borderColor: "blue.400", boxShadow: "0 0 0 3px rgba(66,153,225,0.15)" }}
                            />
                          </FormControl>

                          <FormControl>
                            <FormLabel fontSize="sm" fontWeight="600" color="gray.700" mb={1}>
                              File <Text as="span" color="red.400">*</Text>
                            </FormLabel>
                            <Box
                              position="relative" overflow="hidden"
                              borderWidth="2px" borderStyle="dashed"
                              borderColor={documentFile ? "blue.400" : "gray.300"}
                              borderRadius="lg" py={3} px={4}
                              bg={documentFile ? "blue.50" : "white"}
                              transition="all 0.2s"
                              _hover={!isViewMode && !documentBusy ? { borderColor: "blue.400", bg: "blue.50" } : {}}
                              cursor={isViewMode || documentBusy ? "not-allowed" : "pointer"}
                              opacity={isViewMode || documentBusy ? 0.6 : 1}
                            >
                              <input
                                type="file"
                                onChange={(e) => setDocumentFile(e.target.files?.[0] ?? null)}
                                disabled={isViewMode || documentBusy}
                                accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx,.csv,.txt"
                                style={{
                                  position: "absolute", inset: 0,
                                  width: "100%", height: "100%",
                                  opacity: 0, cursor: "pointer",
                                }}
                              />
                              <HStack spacing={3} pointerEvents="none">
                                <Flex
                                  align="center" justify="center" w={8} h={8}
                                  borderRadius="md"
                                  bg={documentFile ? "blue.100" : "gray.100"}
                                  flexShrink={0}
                                >
                                  <Box
                                    as={documentFile ? FiFileText : FiUpload}
                                    color={documentFile ? "blue.500" : "gray.400"}
                                    boxSize="15px"
                                  />
                                </Flex>
                                <Box minW={0}>
                                  <Text
                                    fontSize="sm" fontWeight="600" isTruncated
                                    color={documentFile ? "blue.700" : "gray.600"}
                                  >
                                    {documentFile ? documentFile.name : "Click to choose file"}
                                  </Text>
                                  <Text fontSize="xs" color="gray.400">
                                    {documentFile
                                      ? `${(documentFile.size / 1024).toFixed(1)} KB`
                                      : "PDF, Word, Excel, Image, CSV — max 10 MB"}
                                  </Text>
                                </Box>
                              </HStack>
                            </Box>
                          </FormControl>

                          <FormControl>
                            <Button
                              leftIcon={<FiUpload size={14} />}
                              colorScheme="blue"
                              onClick={handleAddDocument}
                              isLoading={documentBusy}
                              isDisabled={!canAddDocument}
                              w="full" borderRadius="lg" fontWeight="600"
                              title={
                                !documentTitle.trim()
                                  ? "Enter a document title first"
                                  : !documentFile
                                  ? "Choose a file first"
                                  : undefined
                              }
                            >
                              Add Document
                            </Button>
                          </FormControl>
                        </SimpleGrid>
                      </Box>

                      {/* Document list */}
                      <Box mx={1}>
                        {totalDocs === 0 ? (
                          <Flex
                            direction="column" align="center" justify="center"
                            py={10} borderRadius="xl"
                            border="2px dashed" borderColor="gray.200" bg="gray.50"
                            gap={2}
                          >
                            <Box as={FiPaperclip} color="gray.300" boxSize="32px" />
                            <Text fontSize="sm" color="gray.400" fontWeight="500">
                              No documents attached yet
                            </Text>
                            <Text fontSize="xs" color="gray.400">
                              Use the form above to upload your first document.
                            </Text>
                          </Flex>
                        ) : (
                          <VStack spacing={2} align="stretch">
                            {(formData.documents ?? []).map((doc) => (
                              <DocumentRow
                                key={doc.id}
                                doc={doc}
                                isPending={false}
                                isViewMode={isViewMode}
                                documentBusy={documentBusy}
                                // FIX #15: Use handler wrapper instead of calling viewAccountDocument directly
                                onView={() => handleViewDocument(selectedCustomer.id, doc.id, doc.title)}
                                onDownload={() => handleDownloadDocument(doc)}
                                onRemove={() => handleRemoveDocument(doc.id, false)}
                              />
                            ))}

                            {pendingDocuments.length > 0 && (
                              <>
                                {(formData.documents?.length ?? 0) > 0 && (
                                  <Text
                                    fontSize="xs" fontWeight="700" color="blue.500"
                                    textTransform="uppercase" letterSpacing="wide"
                                    pt={2} pb={1}
                                  >
                                    Queued for upload
                                  </Text>
                                )}
                                {pendingDocuments.map((doc) => (
                                  <DocumentRow
                                    key={doc.id}
                                    doc={doc}
                                    isPending
                                    isViewMode={isViewMode}
                                    documentBusy={documentBusy}
                                    onRemove={() => handleRemoveDocument(doc.id, true)}
                                  />
                                ))}
                              </>
                            )}
                          </VStack>
                        )}
                      </Box>
                    </VStack>
                  </TabPanel>

                  {/* ── Tab 4: Usage Statistics ── */}
                  {selectedCustomer && cdrStats && (
                    <TabPanel>
                      <VStack spacing={4} align="stretch">
                        <Heading size="sm" mb={2}>Account Usage Statistics</Heading>
                        <SimpleGrid columns={3} spacing={4}>
                          {[
                            { label: "Total Calls",       color: "blue",   sub: "All time",       fmt: () => cdrStats.totalCalls ?? "—" },
                            { label: "Total Revenue",     color: "green",  sub: "Generated",      fmt: () => `$${(cdrStats.totalRevenue   || 0).toFixed(2)}` },
                            { label: "Success Rate",      color: "purple", sub: "Answered calls", fmt: () => cdrStats.totalCalls > 0 ? `${((cdrStats.answeredCalls / cdrStats.totalCalls) * 100).toFixed(1)}%` : "0.0%" },
                            { label: "Total Duration",    color: "orange", sub: "Call time",      fmt: () => `${Math.floor((cdrStats.totalDuration || 0) / 3600)}h ${Math.floor(((cdrStats.totalDuration || 0) % 3600) / 60)}m` },
                            { label: "Total Tax",         color: "red",    sub: "Collected",      fmt: () => `$${(cdrStats.totalTax || 0).toFixed(2)}` },
                            { label: "Avg Call Duration", color: "teal",   sub: "Per call",       fmt: () => `${cdrStats.totalCalls > 0 ? Math.floor(cdrStats.totalDuration / cdrStats.totalCalls) : 0}s` },
                          ].map(({ label, color, sub, fmt }) => (
                            <Box key={label} p={4} bg={`${color}.50`} borderRadius="md" textAlign="center">
                              <Text fontSize="sm" color={`${color}.600`} fontWeight="medium">{label}</Text>
                              <Text fontSize="2xl" fontWeight="bold">{fmt()}</Text>
                              <Text fontSize="xs" color="gray.600">{sub}</Text>
                            </Box>
                          ))}
                        </SimpleGrid>
                      </VStack>
                    </TabPanel>
                  )}

                </TabPanels>
              </Box>
            </Tabs>
          </VStack>
        </ModalBody>

        {/* Footer */}
        <ModalFooter
          borderBottomRadius="8px" position="sticky" bottom={0}
          bg="white" borderTop="1px" borderColor="gray.200" py={4}
        >
          <HStack spacing={3} width="100%" justify="space-between">
            <Box>
              {selectedCustomer && (
                <Text fontSize="sm" color="gray.600">
                  Last updated: {new Date(selectedCustomer.updatedAt).toLocaleDateString()}
                </Text>
              )}
            </Box>
            <HStack>
              {showDraftActions && (
                <>
                  <Button variant="ghost" onClick={handleClearDraft} isDisabled={loading}>
                    Clear Draft
                  </Button>
                  <Button variant="outline" onClick={handleSaveDraft} isDisabled={loading}>
                    Save Draft
                  </Button>
                </>
              )}
              <Button variant="outline" onClick={onClose} isDisabled={loading}>
                {isViewMode ? "Close" : "Cancel"}
              </Button>
              {!isViewMode && (
                <Button
                  colorScheme="blue"
                  onClick={handleSave}
                  isLoading={loading}
                  leftIcon={<FiUser />}
                >
                  {selectedCustomer ? "Update Account" : "Create Account"}
                </Button>
              )}
            </HStack>
          </HStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default CreateAccountModal;