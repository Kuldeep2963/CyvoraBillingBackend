import React, { useState, useEffect } from "react";
import {
  Box,
  Heading,
  VStack,
  Text,
  Button,
  useToast,
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
} from "../../utils/api";
import { MemoizedInput as Input, MemoizedSelect as Select } from "../memoizedinput/memoizedinput";

/* ─────────────────────────────────────────────────────────
   Helper: derive color + label from file extension
───────────────────────────────────────────────────────── */
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
  return map[ext] || { color: "gray", label: ext.toUpperCase() || "FILE" };
};

/* ─────────────────────────────────────────────────────────
   DocumentRow — single saved or queued document entry
───────────────────────────────────────────────────────── */
const DocumentRow = ({ doc, isPending = false, isViewMode, documentBusy, onView, onDownload, onRemove }) => {
  const fileName = doc.originalName || doc.filePath || "";
  const { color, label } = getFileAccent(fileName);

  return (
    <Flex
      align="center" justify="space-between"
      px={4} py={3}
      bg={isPending ? "blue.50" : "white"}
      borderRadius="lg" border="1px solid"
      borderColor={isPending ? "blue.200" : "gray.200"}
      transition="all 0.15s"
      _hover={{ boxShadow: "sm", borderColor: isPending ? "blue.300" : "gray.300" }}
      gap={3}
    >
      <HStack spacing={3} minW={0} flex={1}>
        <Flex align="center" justify="center" w={10} h={10} borderRadius="md" flexShrink={0}
          bg={`${color}.50`} border="1px solid" borderColor={`${color}.200`}>
          <Box as={FiFile} color={`${color}.500`} boxSize="18px" />
        </Flex>
        <Box minW={0} flex={1}>
          <HStack spacing={2} mb={0.5}>
            <Text fontSize="sm" fontWeight="600" color="gray.800" isTruncated>{doc.title}</Text>
            <Badge colorScheme={color} fontSize="9px" px={1.5} py={0.5} borderRadius="sm" flexShrink={0}>{label}</Badge>
            {isPending && <Badge colorScheme="blue" fontSize="9px" px={1.5} py={0.5} borderRadius="sm" flexShrink={0}>Queued</Badge>}
          </HStack>
          <Text fontSize="xs" color="gray.500" isTruncated>{fileName || "—"}</Text>
        </Box>
      </HStack>
      <HStack spacing={1} flexShrink={0}>
        {!isPending && onView && <IconButton size="sm" aria-label="View" icon={<FiEye size={14} />} variant="ghost" colorScheme="blue" onClick={onView} title="View" />}
        {!isPending && onDownload && <IconButton size="sm" aria-label="Download" icon={<FiDownload size={14} />} variant="ghost" colorScheme="gray" onClick={onDownload} isDisabled={documentBusy} title="Download" />}
        {!isViewMode && <IconButton size="sm" aria-label="Delete" icon={<FiTrash2 size={14} />} variant="ghost" colorScheme="red" onClick={onRemove} isDisabled={documentBusy} title="Delete" />}
      </HStack>
    </Flex>
  );
};

/* ─────────────────────────────────────────────────────────
   Main Modal
───────────────────────────────────────────────────────── */
const CreateAccountModal = ({ isOpen, onClose, selectedCustomer, cdrStats, onSuccess, users = [], mode = "create" }) => {
  const [loading, setLoading] = useState(false);
  const toast = useToast();
  const isViewMode = mode === "view";

  const initialFormData = {
    accountRole: "customer", accountType: "prepaid", accountStatus: "active", accountId: "",
    customerauthenticationType: "ip", customerauthenticationValue: [],
    vendorauthenticationType: "ip", vendorauthenticationValue: [],
    customerCode: "", vendorCode: "", gatewayId: "", productId: "",
    accountName: "", accountOwner: "", ownership: "None",
    contactPerson: "", contactPersonEmail: "", contactPersonPhone: "",
    phone: "", vendorFax: "", email: "", billingEmail: "", disputeEmail: "",
    nocEmail: "", soaEmail: "", ratesEmails: "", ratesMobileNumber: "",
    billingEmails: "", billingPhoneNumbers: "", disputeEmails: "",
    disputePhoneNumber: "", nocEmails: "", nocPhoneNumbers: "",
    active: true, vatNumber: "", verificationStatus: "pending", resellerAccount: false, reseller: "",
    currency: "USD", nominalCode: "", creditLimit: 1000.0, originalCreditLimit: 1000.0, balance: 0.0, outstandingAmount: 0.0,
    timezone: "UTC", languages: "en",
    addressLine1: "", addressLine2: "", addressLine3: "", city: "", state: "", postalCode: "", country: "US", countryCode: "US",
    billingClass: "paiusa", billingType: "prepaid", billingTimezone: "UTC",
    billingStartDate: new Date().toISOString().split("T")[0],
    billingCycle: "monthly", lastbillingdate: "", nextbillingdate: "",
    sendInvoiceEmail: true, lateFeeEnabled: true, documents: [],
  };

  const [formData, setFormData] = useState(initialFormData);
  const [documentTitle, setDocumentTitle]     = useState("");
  const [documentFile,  setDocumentFile]      = useState(null);
  const [pendingDocuments, setPendingDocuments] = useState([]);
  const [documentBusy, setDocumentBusy]       = useState(false);

  // KEY FIX: button only enabled when both fields are filled
  const canAddDocument = !isViewMode && documentTitle.trim().length > 0 && !!documentFile;
  const totalDocs = (formData.documents?.length || 0) + pendingDocuments.length;

  const normalizeListToInput = (value) => {
    if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean).join(", ");
    if (typeof value === "string") return value;
    return "";
  };
  const splitEmailList = (value = "") => {
    if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
    return String(value).split(",").map((e) => e.trim()).filter(Boolean);
  };
  const normalizeAuthValues = (value) => {
    if (Array.isArray(value)) return [...new Set(value.map((item) => String(item).trim()).filter(Boolean))];
    if (typeof value === "string" && value.trim()) {
      const trimmed = value.trim();
      if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
        try {
          const parsed = JSON.parse(trimmed);
          if (Array.isArray(parsed)) {
            return [...new Set(parsed.map((item) => String(item).trim()).filter(Boolean))];
          }
        } catch (_error) {
          // Fall through to comma-delimited parsing.
        }
      }
      return [...new Set(trimmed.split(",").map((item) => item.trim()).filter(Boolean))];
    }
    return [];
  };
  const firstEmailFromList = (value = "") => splitEmailList(value)[0] || "";
  const normalizeDocuments = (input) => {
    if (!Array.isArray(input)) return [];
    return input.map((doc) => {
      if (!doc || typeof doc !== "object") return null;
      const title = String(doc.title || "").trim();
      const filePath = String(doc.filePath || "").trim();
      if (!title || !filePath) return null;
      return {
        id: String(doc.id || `${Date.now()}-${Math.random().toString(36).slice(2)}`),
        title, filePath,
        originalName: String(doc.originalName || "").trim() || filePath.split("/").pop(),
        uploadedAt: doc.uploadedAt || null,
      };
    }).filter(Boolean);
  };

  const sanitizeFormShape = (data) => {
    const safe = { ...data };

    Object.keys(initialFormData).forEach((key) => {
      const initialValue = initialFormData[key];
      const currentValue = safe[key];

      if (typeof initialValue === "string" && (currentValue === null || currentValue === undefined)) {
        safe[key] = "";
      }

      if (typeof initialValue === "number") {
        const parsed = Number(currentValue);
        safe[key] = Number.isFinite(parsed) ? parsed : initialValue;
      }

      if (typeof initialValue === "boolean" && typeof currentValue !== "boolean") {
        safe[key] = initialValue;
      }
    });

    return safe;
  };

  useEffect(() => {
    if (selectedCustomer) {
      const merged = sanitizeFormShape({ ...initialFormData, ...selectedCustomer });
      setFormData({
        ...merged,
        customerauthenticationValue: normalizeAuthValues(merged.customerauthenticationValue),
        vendorauthenticationValue:   normalizeAuthValues(merged.vendorauthenticationValue),
        ratesEmails:          normalizeListToInput(merged.ratesEmails),
        billingEmails:        normalizeListToInput(merged.billingEmails || merged.billingEmail),
        disputeEmails:        normalizeListToInput(merged.disputeEmails || merged.disputeEmail),
        nocEmails:            normalizeListToInput(merged.nocEmails || merged.nocEmail),
        ratesMobileNumber:    normalizeListToInput(merged.ratesMobileNumber),
        billingPhoneNumbers:  normalizeListToInput(merged.billingPhoneNumbers),
        disputePhoneNumber:   normalizeListToInput(merged.disputePhoneNumber),
        nocPhoneNumbers:      normalizeListToInput(merged.nocPhoneNumbers),
        documents:            normalizeDocuments(merged.documents),
        billingStartDate:     merged.billingStartDate || initialFormData.billingStartDate,
        lastbillingdate:      merged.lastbillingdate || "",
        nextbillingdate:      merged.nextbillingdate || "",
        accountOwner:
          selectedCustomer.accountOwner ||
          (selectedCustomer.owner && selectedCustomer.owner.id) || "",
      });
    } else {
      setFormData({ ...initialFormData, accountId: `ACC${Math.floor(1000 + Math.random() * 9000)}`, customerCode: `C_${Math.floor(10000 + Math.random() * 90000)}` });
    }
    setPendingDocuments([]); setDocumentTitle(""); setDocumentFile(null);
  }, [selectedCustomer, isOpen]);

  useEffect(() => {
    const { lastbillingdate, billingCycle } = formData;
    if (lastbillingdate && billingCycle) {
      let dt = new Date(lastbillingdate);
      switch (billingCycle) {
        case "daily":     dt.setDate(dt.getDate() + 1);         break;
        case "weekly":    dt.setDate(dt.getDate() + 7);         break;
        case "monthly":   dt.setMonth(dt.getMonth() + 1);       break;
        case "quarterly": dt.setMonth(dt.getMonth() + 3);       break;
        case "annually":  dt.setFullYear(dt.getFullYear() + 1); break;
        default: break;
      }
      const iso = dt.toISOString().split("T")[0];
      if (iso !== formData.nextbillingdate) setFormData((fd) => ({ ...fd, nextbillingdate: iso }));
    }
  }, [formData.lastbillingdate, formData.billingCycle]);

  const handleAddDocument = async () => {
    if (!canAddDocument || documentBusy) return;
    const title = documentTitle.trim();

    if (!selectedCustomer?.id) {
      setPendingDocuments((prev) => [...prev, { id: `pending-${Date.now()}-${Math.random().toString(36).slice(2)}`, title, file: documentFile, originalName: documentFile.name }]);
      setDocumentTitle(""); setDocumentFile(null);
      toast({ title: "Document queued", description: "Uploaded after account creation.", status: "success", duration: 2500, isClosable: true });
      return;
    }
    setDocumentBusy(true);
    try {
      const result = await uploadAccountDocument(selectedCustomer.id, { title, file: documentFile });
      setFormData((prev) => ({ ...prev, documents: normalizeDocuments(result?.documents || prev.documents) }));
      setDocumentTitle(""); setDocumentFile(null);
      toast({ title: "Document uploaded", status: "success", duration: 2500, isClosable: true });
    } catch (error) {
      toast({ title: "Failed to upload document", description: error.message, status: "error", duration: 4000, isClosable: true });
    } finally { setDocumentBusy(false); }
  };

  const handleRemoveDocument = async (documentId, isPending = false) => {
    if (isViewMode || documentBusy) return;
    if (isPending) { setPendingDocuments((prev) => prev.filter((d) => d.id !== documentId)); return; }
    if (!selectedCustomer?.id) return;
    setDocumentBusy(true);
    try {
      const result = await deleteAccountDocument(selectedCustomer.id, documentId);
      setFormData((prev) => ({ ...prev, documents: normalizeDocuments(result?.documents || []) }));
      toast({ title: "Document removed", status: "success", duration: 2500, isClosable: true });
    } catch (error) {
      toast({ title: "Failed to remove document", description: error.message, status: "error", duration: 3500, isClosable: true });
    } finally { setDocumentBusy(false); }
  };

  const handleDownloadDocument = async (doc) => {
    if (documentBusy || !selectedCustomer?.id) return;
    setDocumentBusy(true);
    try {
      await downloadAccountDocument(selectedCustomer.id, doc.id, doc.originalName || doc.filePath.split("/").pop());
      toast({ title: "Download started", status: "success", duration: 2000, isClosable: true });
    } catch (error) {
      toast({ title: "Failed to download document", description: error.message, status: "error", duration: 3500, isClosable: true });
    } finally { setDocumentBusy(false); }
  };

  const accountRoleOptions = [
    { value: "customer", label: "Customer", color: "blue"   },
    { value: "vendor",   label: "Vendor",   color: "purple" },
    { value: "both",     label: "Bilateral",color: "green"  },
  ];
  const statusOptions = [
    { value: "active",    label: "Active",    color: "green"  },
    { value: "inactive",  label: "Inactive",  color: "gray"   },
    { value: "suspended", label: "Suspended", color: "red"    },
    { value: "pending",   label: "Pending",   color: "yellow" },
  ];
  const carrierTypeOptions = [
    { value: "tier1",  label: "Tier 1 Carrier"  }, { value: "tier2",  label: "Tier 2 Carrier" },
    { value: "tier3",  label: "Tier 3 Carrier"  }, { value: "mobile", label: "Mobile Operator" },
    { value: "voip",   label: "VoIP Provider"   }, { value: "other",  label: "Other"           },
  ];
  const authTypeOptions = [
    { value: "ip",     label: "IP Address",  description: "Match by source IP"    },
    { value: "custom", label: "Custom Field", description: "Match by custom field" },
  ];

  const validateForm = () => {
    const errors = [];
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const validateEmailList = (rawValue, label, isRequired = false) => {
      const emails = splitEmailList(rawValue);
      if (isRequired && emails.length === 0) { errors.push(`${label} is required`); return; }
      const invalid = emails.filter((e) => !emailRegex.test(e));
      if (invalid.length > 0) errors.push(`${label} contains invalid email(s): ${invalid.join(", ")}`);
    };
    if (!formData.accountName?.trim())       errors.push("Account name is required");
    if (!formData.email?.trim())             errors.push("Email is required");
    if (formData.email && !emailRegex.test(formData.email)) errors.push("Invalid email format");
    if (!formData.contactPersonEmail?.trim()) errors.push("Contact person email is required");
    else if (!emailRegex.test(formData.contactPersonEmail)) errors.push("Contact person email is invalid");
    if (!formData.contactPersonPhone?.trim()) errors.push("Contact person phone is required");
    validateEmailList(formData.ratesEmails,   "Rates emails",   true);
    validateEmailList(formData.billingEmails,  "Billing emails", true);
    validateEmailList(formData.disputeEmails,  "Dispute emails", true);
    validateEmailList(formData.nocEmails,      "NOC emails",     true);
    if (users.length > 0 && !formData.accountOwner) errors.push("Account owner is required");
    if (!formData.phone?.trim())               errors.push("Phone is required");
    if (!formData.ratesMobileNumber?.trim())   errors.push("Rates mobile number is required");
    if (!formData.billingPhoneNumbers?.trim()) errors.push("Billing phone numbers is required");
    if (!formData.disputePhoneNumber?.trim())  errors.push("Dispute phone number is required");
    if (!formData.nocPhoneNumbers?.trim())     errors.push("NOC phone numbers is required");
    if (!formData.addressLine1?.trim())        errors.push("Address Line 1 is required");
    if (!formData.city?.trim())                errors.push("City is required");
    if (!formData.postalCode?.trim())          errors.push("Postal Code is required");
                
    if (!formData.billingStartDate)            errors.push("Billing Start Date is required");
    if (formData.accountRole === "customer" || formData.accountRole === "both") {
      if (!formData.customerauthenticationType)            errors.push("Customer authentication type is required");
      if (!Array.isArray(formData.customerauthenticationValue) || formData.customerauthenticationValue.length === 0)   errors.push("Customer authentication value is required");
    }
    if (formData.accountRole === "vendor" || formData.accountRole === "both") {
      if (!formData.vendorauthenticationType)             errors.push("Vendor authentication type is required");
      if (!Array.isArray(formData.vendorauthenticationValue) || formData.vendorauthenticationValue.length === 0)    errors.push("Vendor authentication value is required");
    }
    return errors;
  };

  const handleSave = async () => {
    if (isViewMode) return;
    const validationErrors = validateForm();
    if (validationErrors.length > 0) {
      toast({ title: "Validation Error", description: validationErrors.join(", "), status: "error", duration: 5000, isClosable: true });
      return;
    }
    setLoading(true);
    try {
      const nBilling  = splitEmailList(formData.billingEmails  || formData.billingEmail).join(", ");
      const nDispute  = splitEmailList(formData.disputeEmails  || formData.disputeEmail).join(", ");
      const nNoc      = splitEmailList(formData.nocEmails      || formData.nocEmail).join(", ");
      const nRates    = splitEmailList(formData.ratesEmails).join(", ");

      const sanitizedData = {
        ...formData,
        ratesEmails:         splitEmailList(nRates),
        billingEmails:       splitEmailList(nBilling),
        disputeEmails:       splitEmailList(nDispute),
        nocEmails:           splitEmailList(nNoc),
        ratesMobileNumber:   splitEmailList(formData.ratesMobileNumber),
        billingPhoneNumbers: splitEmailList(formData.billingPhoneNumbers),
        disputePhoneNumber:  splitEmailList(formData.disputePhoneNumber),
        nocPhoneNumbers:     splitEmailList(formData.nocPhoneNumbers),
        billingEmail:  firstEmailFromList(nBilling)  || formData.billingEmail  || "",
        disputeEmail:  firstEmailFromList(nDispute)  || formData.disputeEmail  || "",
        nocEmail:      firstEmailFromList(nNoc)      || formData.nocEmail      || "",
        documents:     normalizeDocuments(formData.documents),
        lastbillingdate: formData.lastbillingdate || null,
        nextbillingdate: formData.nextbillingdate || null,
        billingClass:    formData.billingClass    || "paiusa",
      };

      if (sanitizedData.lastbillingdate && sanitizedData.billingCycle) {
        let dt = new Date(sanitizedData.lastbillingdate);
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

      let savedAccount = selectedCustomer
        ? await updateCustomer(selectedCustomer.id, sanitizedData)
        : await createCustomer(sanitizedData);

      if (!selectedCustomer && pendingDocuments.length > 0 && savedAccount?.id) {
        const failedUploads = [];
        for (const pending of pendingDocuments) {
          try { await uploadAccountDocument(savedAccount.id, { title: pending.title, file: pending.file }); }
          catch (error) { failedUploads.push(`${pending.title}: ${error.message}`); }
        }
        if (failedUploads.length > 0) {
          toast({ title: "Some documents failed to upload", description: failedUploads.join(" | "), status: "warning", duration: 6000, isClosable: true });
        }
      }

      toast({ title: selectedCustomer ? "Account updated" : "Account created", description: `Account ${formData.accountName} has been ${selectedCustomer ? "updated" : "created"} successfully`, status: "success", duration: 3000, isClosable: true });
      if (onSuccess && typeof onSuccess === "function") onSuccess();
      onClose();
    } catch (error) {
      toast({ title: "Error saving account", description: error.message, status: "error", duration: 5000, isClosable: true });
    } finally { setLoading(false); }
  };

  const handleAccountRoleChange = (role) => {
    setFormData({
      ...formData, accountRole: role,
      customerCode:
        (role === "customer" || role === "both") && !formData.customerCode
          ? `C_${Math.floor(10000 + Math.random() * 90000)}`
          : role === "vendor" ? "" : formData.customerCode,
      vendorCode:
        (role === "vendor" || role === "both") && !formData.vendorCode
          ? `P_${Math.floor(10000 + Math.random() * 90000)}`
          : role === "customer" ? "" : formData.vendorCode,
    });
  };

  const stickyTabListBg = useColorModeValue("white", "gray.800");

  return (
    <Modal isOpen={isOpen} onClose={() => !loading && onClose()} size={{ base: "sm", md: "4xl", lg: "6xl" }} closeOnOverlayClick={!loading}>
      <ModalOverlay />
      <ModalContent my={6} borderRadius="8px" maxH="90vh">

        {/* Header */}
        <ModalHeader borderTopRadius="8px" bgColor="blue.500" color="white" position="sticky" top={0} zIndex={1} borderBottom="1px" borderColor="gray.200">
          <VStack align="start" spacing={1}>
            <Heading size="md" fontWeight="semibold" color="white">
              {isViewMode ? "View Account Details" : selectedCustomer ? "Edit Account" : "Account Creation"}
              {formData.accountName ? ` - ${formData.accountName}` : ""}
            </Heading>
            {selectedCustomer && <Text fontSize="sm" color="white">Account ID: {selectedCustomer.accountId}</Text>}
          </VStack>
          <ModalCloseButton color="white" top={4} right={4} isDisabled={loading} />
        </ModalHeader>

        <ModalBody overflowY="auto" maxH="calc(90vh - 150px)">
          <VStack spacing={6} align="stretch" pb={4}>
            <Tabs variant="line" colorScheme="blue" isFitted>
              <TabList position="sticky" zIndex={1} top={0} bg={stickyTabListBg} borderBottom="1px" borderColor="gray.200">
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
                            <Select value={formData.accountRole} onChange={(e) => handleAccountRoleChange(e.target.value)} isDisabled={!!selectedCustomer || isViewMode}>
                              {accountRoleOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </Select>
                            <FormHelperText>Determines billing and CDR mapping</FormHelperText>
                          </FormControl>
                          <FormControl>
                            <FormLabel>Billing Type</FormLabel>
                            <Select value={formData.billingType} onChange={(e) => setFormData({ ...formData, billingType: e.target.value, ...(e.target.value === "prepaid" ? { creditLimit: 0, originalCreditLimit: 0 } : {}) })} isDisabled={isViewMode}>
                              <option value="prepaid">Prepaid</option>
                              <option value="postpaid">Postpaid</option>
                            </Select>
                          </FormControl>
                          <FormControl isRequired>
                            <FormLabel>Account Name</FormLabel>
                            <Input value={formData.accountName} onChange={(e) => setFormData({ ...formData, accountName: e.target.value })} placeholder="Company Name" isDisabled={isViewMode} />
                          </FormControl>
                          <FormControl isRequired>
                            <FormLabel>Contact Person</FormLabel>
                            <Input value={formData.contactPerson} onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })} placeholder="Contact Person" isDisabled={isViewMode} />
                          </FormControl>
                          <FormControl isRequired>
                            <FormLabel>Contact Person Email</FormLabel>
                            <Input value={formData.contactPersonEmail} onChange={(e) => setFormData({ ...formData, contactPersonEmail: e.target.value })} placeholder="Contact Person Email" isDisabled={isViewMode} />
                          </FormControl>
                          <FormControl isRequired>
                            <FormLabel>Contact Person Phone</FormLabel>
                            <Input value={formData.contactPersonPhone} onChange={(e) => setFormData({ ...formData, contactPersonPhone: e.target.value })} placeholder="+1234567890" isDisabled={isViewMode} />
                          </FormControl>
                          <FormControl>
                            <FormLabel>Account Owner</FormLabel>
                            {users.length > 0 ? (
                              <Select placeholder="Select owner" value={formData.accountOwner || ""} onChange={(e) => setFormData({ ...formData, accountOwner: e.target.value })} isDisabled={isViewMode}>
                                {users.map((u) => <option key={u.id} value={u.id}>{u.first_name} {u.last_name} ({u.role})</option>)}
                              </Select>
                            ) : (
                              <Input value={formData.accountOwner} onChange={(e) => setFormData({ ...formData, accountOwner: e.target.value })} placeholder="Sales Rep Name" isDisabled={isViewMode} />
                            )}
                          </FormControl>
                          <FormControl isRequired>
                            <FormLabel>Account Email</FormLabel>
                            <Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="account@example.com" isDisabled={isViewMode} />
                          </FormControl>
                        </SimpleGrid>
                      </Box>
                      <Divider />
                      <Box>
                        <Heading size="sm" mb={2}>Contact Information</Heading>
                        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                          <FormControl><FormLabel>Rates Emails</FormLabel><Input type="text" value={formData.ratesEmails} onChange={(e) => setFormData({ ...formData, ratesEmails: e.target.value })} placeholder="rates1@example.com, rates2@example.com" isDisabled={isViewMode} /><FormHelperText>Comma-separated emails</FormHelperText></FormControl>
                          <FormControl><FormLabel>Rates Mobile Number</FormLabel><Input value={formData.ratesMobileNumber} onChange={(e) => setFormData({ ...formData, ratesMobileNumber: e.target.value })} placeholder="+1234567890" isDisabled={isViewMode} /></FormControl>
                          <FormControl><FormLabel>Billing Emails</FormLabel><Input type="text" value={formData.billingEmails} onChange={(e) => setFormData({ ...formData, billingEmails: e.target.value })} placeholder="billing1@example.com, billing2@example.com" isDisabled={isViewMode} /><FormHelperText>Comma-separated emails</FormHelperText></FormControl>
                          <FormControl><FormLabel>Billing Phone Numbers</FormLabel><Input value={formData.billingPhoneNumbers} onChange={(e) => setFormData({ ...formData, billingPhoneNumbers: e.target.value })} placeholder="+1234567890, +1987654321" isDisabled={isViewMode} /></FormControl>
                          <FormControl><FormLabel>Dispute Emails</FormLabel><Input type="text" value={formData.disputeEmails} onChange={(e) => setFormData({ ...formData, disputeEmails: e.target.value })} placeholder="dispute1@example.com, dispute2@example.com" isDisabled={isViewMode} /><FormHelperText>Comma-separated emails</FormHelperText></FormControl>
                          <FormControl><FormLabel>Dispute Phone Number</FormLabel><Input value={formData.disputePhoneNumber} onChange={(e) => setFormData({ ...formData, disputePhoneNumber: e.target.value })} placeholder="+1234567890" isDisabled={isViewMode} /></FormControl>
                          <FormControl><FormLabel>NOC Emails</FormLabel><Input type="text" value={formData.nocEmails} onChange={(e) => setFormData({ ...formData, nocEmails: e.target.value })} placeholder="noc1@example.com, noc2@example.com" isDisabled={isViewMode} /><FormHelperText>Comma-separated emails</FormHelperText></FormControl>
                          <FormControl><FormLabel>NOC Phone Numbers</FormLabel><Input value={formData.nocPhoneNumbers} onChange={(e) => setFormData({ ...formData, nocPhoneNumbers: e.target.value })} placeholder="+1234567890, +1987654321" isDisabled={isViewMode} /></FormControl>
                          <FormControl><FormLabel>SOA Email</FormLabel><Input type="email" value={formData.soaEmail} onChange={(e) => setFormData({ ...formData, soaEmail: e.target.value })} placeholder="soa@example.com" isDisabled={isViewMode} /></FormControl>
                          <FormControl isRequired><FormLabel>Primary Phone</FormLabel><Input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} placeholder="+1234567890" isDisabled={isViewMode} /></FormControl>
                        </SimpleGrid>
                      </Box>
                      <Divider />
                      <Box>
                        <Heading size="sm" mb={4}>Account Status &amp; Carrier Type</Heading>
                        <SimpleGrid columns={2} spacing={4}>
                          <FormControl isRequired>
                            <FormLabel>Account Status</FormLabel>
                            <Select value={formData.accountStatus} onChange={(e) => setFormData({ ...formData, accountStatus: e.target.value, active: e.target.value === "active" })} isDisabled={isViewMode}>
                              {statusOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </Select>
                          </FormControl>
                          <FormControl>
                            <FormLabel>Carrier Type</FormLabel>
                            <Select value={formData.carrierType} onChange={(e) => setFormData({ ...formData, carrierType: e.target.value })} isDisabled={isViewMode}>
                              {carrierTypeOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </Select>
                          </FormControl>
                        </SimpleGrid>
                      </Box>
                      <Divider />
                      <Heading size="sm" mb={2} mt={2}>Address Information</Heading>
                      <SimpleGrid columns={1} spacing={3}>
                        <FormControl isRequired><FormLabel>Address Line 1</FormLabel><Input value={formData.addressLine1} onChange={(e) => setFormData({ ...formData, addressLine1: e.target.value })} placeholder="Street address" isDisabled={isViewMode} /></FormControl>
                        <FormControl><FormLabel>Address Line 2</FormLabel><Input value={formData.addressLine2} onChange={(e) => setFormData({ ...formData, addressLine2: e.target.value })} placeholder="Apartment, suite, etc." isDisabled={isViewMode} /></FormControl>
                        <FormControl><FormLabel>Address Line 3</FormLabel><Input value={formData.addressLine3} onChange={(e) => setFormData({ ...formData, addressLine3: e.target.value })} placeholder="Additional address" isDisabled={isViewMode} /></FormControl>
                        <SimpleGrid columns={2} spacing={4}>
                          <FormControl isRequired><FormLabel>City</FormLabel><Input value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} placeholder="City" isDisabled={isViewMode} /></FormControl>
                          <FormControl><FormLabel>State/Province</FormLabel><Input value={formData.state} onChange={(e) => setFormData({ ...formData, state: e.target.value })} placeholder="State" isDisabled={isViewMode} /></FormControl>
                          <FormControl isRequired><FormLabel>Postal Code</FormLabel><Input value={formData.postalCode} onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })} placeholder="ZIP/Postal code" isDisabled={isViewMode} /></FormControl>
                          <FormControl isRequired>
                            <FormLabel>Country</FormLabel>
                            <Select value={formData.country} onChange={(e) => setFormData({ ...formData, country: e.target.value, countryCode: e.target.value })} isDisabled={isViewMode}>
                              <option value="US">United States</option><option value="IN">India</option><option value="GB">United Kingdom</option>
                              <option value="CA">Canada</option><option value="AU">Australia</option><option value="DE">Germany</option>
                              <option value="FR">France</option><option value="JP">Japan</option><option value="SG">Singapore</option><option value="AE">UAE</option>
                            </Select>
                          </FormControl>
                        </SimpleGrid>
                      </SimpleGrid>
                      <Divider />
                      <Heading size="sm" mb={2} mt={4}>Localization</Heading>
                      <SimpleGrid columns={2} spacing={4}>
                        <FormControl>
                          <FormLabel>Timezone</FormLabel>
                          <Select value={formData.timezone} onChange={(e) => setFormData({ ...formData, timezone: e.target.value })} isDisabled={isViewMode}>
                            <option value="UTC">UTC</option><option value="EST">EST (Eastern)</option><option value="CST">CST (Central)</option>
                            <option value="PST">PST (Pacific)</option><option value="GMT">GMT</option><option value="IST">IST (India)</option>
                            <option value="HST">HST (Hawaii)</option><option value="AEST">AEST (Australia)</option>
                          </Select>
                        </FormControl>
                        <FormControl>
                          <FormLabel>Preferred Language</FormLabel>
                          <Select value={formData.languages} onChange={(e) => setFormData({ ...formData, languages: e.target.value })} isDisabled={isViewMode}>
                            <option value="en">English</option><option value="es">Spanish</option><option value="fr">French</option>
                            <option value="de">German</option><option value="it">Italian</option><option value="pt">Portuguese</option>
                            <option value="zh">Chinese</option><option value="ja">Japanese</option><option value="hi">Hindi</option>
                          </Select>
                        </FormControl>
                      </SimpleGrid>
                      <Divider />
                      <Heading size="sm" mb={2} mt={4}>Financial Information</Heading>
                      <SimpleGrid columns={2} spacing={4}>
                        <FormControl><FormLabel>Currency</FormLabel><Select value={formData.currency} onChange={(e) => setFormData({ ...formData, currency: e.target.value })} isDisabled={isViewMode}><option value="USD">USD</option><option value="EUR">EUR</option><option value="GBP">GBP</option><option value="INR">INR</option><option value="AUD">AUD</option><option value="CAD">CAD</option></Select></FormControl>
                        <FormControl><FormLabel>VAT Number</FormLabel><Input value={formData.vatNumber} onChange={(e) => setFormData({ ...formData, vatNumber: e.target.value })} placeholder="VAT/Tax ID" isDisabled={isViewMode} /></FormControl>
                        <FormControl><FormLabel>Nominal Code</FormLabel><Input value={formData.nominalCode} onChange={(e) => setFormData({ ...formData, nominalCode: e.target.value })} placeholder="Accounting code" isDisabled={isViewMode} /></FormControl>
                        <FormControl><FormLabel>Verification Status</FormLabel><Select value={formData.verificationStatus} onChange={(e) => setFormData({ ...formData, verificationStatus: e.target.value })} isDisabled={isViewMode}><option value="pending">Pending</option><option value="verified">Verified</option><option value="unverified">Not Verified</option></Select></FormControl>
                      </SimpleGrid>
                    </VStack>
                  </TabPanel>

                  {/* ── Tab 2: Billing & Payment ── */}
                  <TabPanel>
                    <VStack spacing={4} align="stretch">
                      <Heading size="sm" mb={2}>Billing Settings</Heading>
                      <SimpleGrid columns={3} spacing={4}>
                        <FormControl><FormLabel>Billing Class</FormLabel><Select placeholder="Select class" value={formData.billingClass} onChange={(e) => setFormData({ ...formData, billingClass: e.target.value })} isDisabled={isViewMode}><option value="paihk">pai HK</option><option value="paiusa">pai USA</option></Select></FormControl>
                        <FormControl><FormLabel>Billing Timezone</FormLabel><Select value={formData.billingTimezone} onChange={(e) => setFormData({ ...formData, billingTimezone: e.target.value })} isDisabled={isViewMode}><option value="UTC">UTC</option><option value="EST">EST</option><option value="PST">PST</option><option value="IST">IST</option><option value="GMT">GMT</option></Select></FormControl>
                        <FormControl isRequired><FormLabel>Billing Start Date</FormLabel><Input type="date" value={formData.billingStartDate} onChange={(e) => setFormData({ ...formData, billingStartDate: e.target.value })} isDisabled={isViewMode} /></FormControl>
                        <FormControl isRequired><FormLabel>Billing Cycle</FormLabel><Select value={formData.billingCycle} onChange={(e) => setFormData({ ...formData, billingCycle: e.target.value })} isDisabled={isViewMode}><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="annually">Annually</option></Select></FormControl>
                       {selectedCustomer && ( <FormControl ><FormLabel>Last Billing Date</FormLabel><Input type="date" value={formData.lastbillingdate || null} onChange={(e) => setFormData({ ...formData, lastbillingdate: e.target.value })} isDisabled={isViewMode} /></FormControl>)}
                        <FormControl><FormLabel>Next Billing Date</FormLabel><Input type="date" value={formData.nextbillingdate || ""} readOnly /></FormControl>
                        <FormControl isDisabled={formData.billingType === "prepaid" || isViewMode}>
                          <FormLabel>Credit Limit ($)</FormLabel>
                          <NumberInput value={formData.creditLimit} onChange={(v) => setFormData({ ...formData, creditLimit: parseFloat(v) })} min={0}>
                            <NumberInputField /><NumberInputStepper><NumberIncrementStepper /><NumberDecrementStepper /></NumberInputStepper>
                          </NumberInput>
                          <FormHelperText>Maximum credit/prepaid balance allowed</FormHelperText>
                        </FormControl>
                        <FormControl isDisabled={formData.billingType === "prepaid" || isViewMode}>
                          <FormLabel>Original Credit Limit ($)</FormLabel>
                          <NumberInput value={formData.originalCreditLimit} onChange={(v) => setFormData({ ...formData, originalCreditLimit: parseFloat(v) })} min={0}>
                            <NumberInputField /><NumberInputStepper><NumberIncrementStepper /><NumberDecrementStepper /></NumberInputStepper>
                          </NumberInput>
                          <FormHelperText>Reset to this limit after payment (for postpaid)</FormHelperText>
                        </FormControl>
                      </SimpleGrid>
                      <Heading size="sm" mb={2} mt={4}>Payment Settings</Heading>
                      <SimpleGrid columns={2} spacing={4}>
                        <FormControl><FormLabel>Send Invoice Email</FormLabel><Select value={formData.sendInvoiceEmail} onChange={(e) => setFormData({ ...formData, sendInvoiceEmail: e.target.value === "true" })} isDisabled={isViewMode}><option value="true">Yes</option><option value="false">No</option></Select></FormControl>
                      </SimpleGrid>
                      <Box>
                        <Heading size="sm" mb={4}>CDR Mapping Configuration</Heading>
                        <SimpleGrid columns={2} spacing={4}>
                          <FormControl><FormLabel>Gateway ID</FormLabel><Input value={formData.gatewayId} onChange={(e) => setFormData({ ...formData, gatewayId: e.target.value })} placeholder="Gateway identifier" isDisabled={isViewMode} /><FormHelperText>Gateway identifier for CDR routing</FormHelperText></FormControl>
                          {(formData.accountRole === "customer" || formData.accountRole === "both") && (
                            <FormControl><FormLabel>Customer Code</FormLabel><Input value={formData.customerCode} onChange={(e) => setFormData({ ...formData, customerCode: e.target.value })} placeholder="C_XXXXX" isDisabled={isViewMode} /><FormHelperText>Optional legacy fallback to customeraccount</FormHelperText></FormControl>
                          )}
                          {(formData.accountRole === "vendor" || formData.accountRole === "both") && (
                            <FormControl><FormLabel>Vendor Code</FormLabel><Input value={formData.vendorCode} onChange={(e) => setFormData({ ...formData, vendorCode: e.target.value })} placeholder="P_XXXXX" isDisabled={isViewMode} /><FormHelperText>Optional legacy fallback to agentaccount</FormHelperText></FormControl>
                          )}
                          {(formData.accountRole === "customer" || formData.accountRole === "both") && (
                            <Flex gap={4} flexDirection="column">
                              <FormControl isRequired><FormLabel>Customer Authentication Type</FormLabel><Select value={formData.customerauthenticationType} onChange={(e) => setFormData({ ...formData, customerauthenticationType: e.target.value })} isDisabled={isViewMode}>{authTypeOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</Select><FormHelperText>{authTypeOptions.find((o) => o.value === formData.customerauthenticationType)?.description}</FormHelperText></FormControl>
                              <FormControl isRequired><FormLabel>Customer Authentication Value</FormLabel><Input value={Array.isArray(formData.customerauthenticationValue) ? formData.customerauthenticationValue.join(", ") : formData.customerauthenticationValue} onChange={(e) => setFormData({ ...formData, customerauthenticationValue: normalizeAuthValues(e.target.value) })} placeholder={formData.customerauthenticationType === "ip" ? "192.168.1.100, 192.168.1.101" : "Value 1, Value 2"} isDisabled={isViewMode} /><FormHelperText>Comma-separated {formData.customerauthenticationType === "ip" ? "IP addresses" : "values"}</FormHelperText></FormControl>
                            </Flex>
                          )}
                          {(formData.accountRole === "vendor" || formData.accountRole === "both") && (
                            <Flex gap={4} flexDirection="column">
                              <FormControl isRequired><FormLabel>Vendor Authentication Type</FormLabel><Select value={formData.vendorauthenticationType} onChange={(e) => setFormData({ ...formData, vendorauthenticationType: e.target.value })} isDisabled={isViewMode}>{authTypeOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</Select><FormHelperText>{authTypeOptions.find((o) => o.value === formData.vendorauthenticationType)?.description}</FormHelperText></FormControl>
                              <FormControl isRequired><FormLabel>Vendor Authentication Value</FormLabel><Input value={Array.isArray(formData.vendorauthenticationValue) ? formData.vendorauthenticationValue.join(", ") : formData.vendorauthenticationValue} onChange={(e) => setFormData({ ...formData, vendorauthenticationValue: normalizeAuthValues(e.target.value) })} placeholder={formData.vendorauthenticationType === "ip" ? "192.168.1.100, 192.168.1.101" : "Value 1, Value 2"} isDisabled={isViewMode} /><FormHelperText>Comma-separated {formData.vendorauthenticationType === "ip" ? "IP addresses" : "values"}</FormHelperText></FormControl>
                            </Flex>
                          )}
                        </SimpleGrid>
                      </Box>
                    </VStack>
                  </TabPanel>

                  {/* ── Tab 3: Documents (redesigned) ── */}
                  <TabPanel px={0} pt={4}>
                    <VStack spacing={5} align="stretch">

                      {/* Section header */}
                      <Flex align="center" justify="space-between" px={1}>
                        <Box>
                          <HStack spacing={2} mb={1}>
                            <Box as={FiPaperclip} color="blue.500" />
                            <Text fontSize="md" fontWeight="700" color="gray.800">Account Documents</Text>
                            {totalDocs > 0 && <Badge colorScheme="blue" borderRadius="full" px={2}>{totalDocs}</Badge>}
                          </HStack>
                          <Text fontSize="sm" color="gray.500">
                            Contracts, invoices, compliance certificates and other account files.
                          </Text>
                        </Box>
                      </Flex>

                      {/* Pending-create warning */}
                      {!selectedCustomer && (
                        <HStack spacing={3} px={4} py={3} bg="orange.50" border="1px solid" borderColor="orange.200" borderRadius="lg" mx={1}>
                          <Box as={FiAlertCircle} color="orange.500" flexShrink={0} />
                          <Text fontSize="sm" color="orange.700">
                            Documents added here will be uploaded once the account is saved.
                          </Text>
                        </HStack>
                      )}

                      {/* Upload form */}
                      <Box bg="gray.50" border="1px solid" borderColor="gray.200" borderRadius="xl" p={5} mx={1}>
                        <Text fontSize="xs" fontWeight="700" color="gray.500" textTransform="uppercase" letterSpacing="wide" mb={4}>
                          Add New Document
                        </Text>
                        <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4} alignItems="end">

                          {/* Title field */}
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

                          {/* File picker */}
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
                                onChange={(e) => setDocumentFile(e.target.files?.[0] || null)}
                                disabled={isViewMode || documentBusy}
                                accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx,.csv,.txt"
                                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0, cursor: "pointer" }}
                              />
                              <HStack spacing={3} pointerEvents="none">
                                <Flex align="center" justify="center" w={8} h={8} borderRadius="md" bg={documentFile ? "blue.100" : "gray.100"} flexShrink={0}>
                                  <Box as={documentFile ? FiFileText : FiUpload} color={documentFile ? "blue.500" : "gray.400"} boxSize="15px" />
                                </Flex>
                                <Box minW={0}>
                                  <Text fontSize="sm" fontWeight="600" color={documentFile ? "blue.700" : "gray.600"} isTruncated>
                                    {documentFile ? documentFile.name : "Click to choose file"}
                                  </Text>
                                  <Text fontSize="xs" color="gray.400">
                                    {documentFile ? `${(documentFile.size / 1024).toFixed(1)} KB` : "PDF, Word, Excel, Image, CSV"}
                                  </Text>
                                </Box>
                              </HStack>
                            </Box>
                          </FormControl>

                          {/* Add button — disabled until both title + file are ready */}
                          <FormControl>
                            <Button
                              leftIcon={<FiUpload size={14} />}
                              colorScheme="blue"
                              onClick={handleAddDocument}
                              isLoading={documentBusy}
                              isDisabled={!canAddDocument}
                              w="full" borderRadius="lg" fontWeight="600"
                              title={
                                !documentTitle.trim() ? "Enter a document title first"
                                  : !documentFile ? "Choose a file first"
                                  : undefined
                              }
                            >
                              Add Document
                            </Button>
                          </FormControl>
                        </SimpleGrid>
                      </Box>

                      {/* Document list / empty state */}
                      <Box mx={1}>
                        {totalDocs === 0 ? (
                          <Flex direction="column" align="center" justify="center" py={10} borderRadius="xl" border="2px dashed" borderColor="gray.200" bg="gray.50" gap={2}>
                            <Box as={FiPaperclip} color="gray.300" boxSize="32px" />
                            <Text fontSize="sm" color="gray.400" fontWeight="500">No documents attached yet</Text>
                            <Text fontSize="xs" color="gray.400">Use the form above to upload your first document.</Text>
                          </Flex>
                        ) : (
                          <VStack spacing={2} align="stretch">
                            {(formData.documents || []).map((doc) => (
                              <DocumentRow
                                key={doc.id} doc={doc} isPending={false}
                                isViewMode={isViewMode} documentBusy={documentBusy}
                                onView={() => viewAccountDocument(selectedCustomer.id, doc.id)}
                                onDownload={() => handleDownloadDocument(doc)}
                                onRemove={() => handleRemoveDocument(doc.id, false)}
                              />
                            ))}
                            {pendingDocuments.length > 0 && (
                              <>
                                {formData.documents?.length > 0 && (
                                  <Text fontSize="xs" fontWeight="700" color="blue.500" textTransform="uppercase" letterSpacing="wide" pt={2} pb={1}>
                                    Queued for upload
                                  </Text>
                                )}
                                {pendingDocuments.map((doc) => (
                                  <DocumentRow
                                    key={doc.id} doc={doc} isPending={true}
                                    isViewMode={isViewMode} documentBusy={documentBusy}
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
                            { label: "Total Calls",       color: "blue",   sub: "All time",      fmt: () => cdrStats.totalCalls },
                            { label: "Total Revenue",     color: "green",  sub: "Generated",     fmt: () => `$${(cdrStats.totalRevenue || 0).toFixed(2)}` },
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
        <ModalFooter borderBottomRadius="8px" position="sticky" bottom={0} bg="white" borderTop="1px" borderColor="gray.200" py={4}>
          <HStack spacing={3} width="100%" justify="space-between">
            <Box>
              {selectedCustomer && (
                <Text fontSize="sm" color="gray.600">
                  Last updated: {new Date(selectedCustomer.updatedAt).toLocaleDateString()}
                </Text>
              )}
            </Box>
            <HStack>
              <Button variant="outline" onClick={onClose} isDisabled={loading}>
                {isViewMode ? "Close" : "Cancel"}
              </Button>
              {!isViewMode && (
                <Button colorScheme="blue" onClick={handleSave} isLoading={loading} leftIcon={<FiUser />}>
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