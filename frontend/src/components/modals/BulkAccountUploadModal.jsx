import React, { useRef, useState } from "react";
import {
  Alert,
  AlertIcon,
  Box,
  Button,
  FormControl,
  FormHelperText,
  FormLabel,
  HStack,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Text,
  VStack,
  useToast,
} from "@chakra-ui/react";
import { FiDownload, FiUpload } from "react-icons/fi";
import Papa from "papaparse";
import { bulkCreateCustomers } from "../../utils/api";

const sampleHeaders = [
  "accountId",
  "accountName",
  "accountRole",
  "accountStatus",
  "email",
  "phone",
  "addressLine1",
  "city",
  "postalCode",
  "country",
  "billingType",
  "billingCycle",
  "lastbillingdate",
  "customerCode",
  "vendorCode",
  "gatewayId",
  "contactPerson",
  "contactPersonEmail",
  "contactPersonPhone",
];

const sampleRows = [
  [
    "ACC10001",
    "Acme Telecom LLC",
    "customer",
    "active",
    "billing@acme.com",
    "+12025550111",
    "100 Main Street",
    "New York",
    "10001",
    "US",
    "prepaid",
    "monthly",
    "2026-03-01",
    "C_10001",
    "",
    "GW-ACME-01",
    "John Doe",
    "john.doe@acme.com",
    "+12025550112",
  ],
  [
    "ACC10002",
    "Vertex Routes Ltd",
    "vendor",
    "active",
    "ops@vertex.com",
    "+442070001111",
    "22 Fleet Street",
    "London",
    "EC4Y1AA",
    "GB",
    "postpaid",
    "monthly",
    "2026-03-01",
    "",
    "P_20002",
    "GW-VERTEX-01",
    "Alice Smith",
    "alice.smith@vertex.com",
    "+442070001112",
  ],
];

const BulkAccountUploadModal = ({ isOpen, onClose, onUploaded }) => {
  const toast = useToast();
  const fileInputRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  const closeAndReset = () => {
    setSelectedFile(null);
    onClose();
  };

  const downloadSampleCsv = () => {
    const csv = [
      sampleHeaders.join(","),
      ...sampleRows.map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "account_bulk_upload_sample.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  };

  const mapCsvRowToAccount = (row) => {
    const lowered = Object.entries(row || {}).reduce((acc, [k, v]) => {
      acc[String(k || "").trim().toLowerCase()] = v;
      return acc;
    }, {});

    const pick = (...keys) => {
      for (const key of keys) {
        const raw = lowered[String(key).trim().toLowerCase()];
        if (raw !== undefined && raw !== null && String(raw).trim() !== "") {
          return String(raw).trim();
        }
      }
      return "";
    };

    const accountRole = (pick("accountrole", "role") || "customer").toLowerCase();
    const accountStatus = (pick("accountstatus", "status") || "active").toLowerCase();
    const today = new Date().toISOString().split("T")[0];

    return {
      accountId: pick("accountid", "account_id"),
      accountName: pick("accountname", "account_name", "name"),
      accountRole: ["customer", "vendor", "both"].includes(accountRole) ? accountRole : "customer",
      accountStatus: ["active", "inactive", "suspended", "pending"].includes(accountStatus) ? accountStatus : "active",
      active: accountStatus === "active",
      email: pick("email"),
      phone: pick("phone", "phonenumber", "primaryphone"),
      addressLine1: pick("addressline1", "address1", "address"),
      city: pick("city"),
      postalCode: pick("postalcode", "zip", "zipcode"),
      country: pick("country") || "US",
      countryCode: pick("countrycode") || "US",
      billingType: (pick("billingtype") || "prepaid").toLowerCase(),
      billingClass: pick("billingclass") || "paiusa",
      billingTimezone: pick("billingtimezone") || "UTC",
      billingStartDate: pick("billingstartdate") || today,
      billingCycle: (pick("billingcycle") || "monthly").toLowerCase(),
      lastbillingdate: pick("lastbillingdate", "last_billing_date"),
      customerCode: pick("customercode", "customer_code"),
      vendorCode: pick("vendorcode", "vendor_code"),
      gatewayId: pick("gatewayid", "gateway_id"),
      contactPerson: pick("contactperson", "contact_person"),
      contactPersonEmail: pick("contactpersonemail", "contact_person_email") || pick("email"),
      contactPersonPhone: pick("contactpersonphone", "contact_person_phone") || pick("phone"),
    };
  };

  const handleUpload = async () => {
    if (!selectedFile || isUploading) return;

    setIsUploading(true);
    try {
      const parsed = await new Promise((resolve, reject) => {
        Papa.parse(selectedFile, {
          header: true,
          skipEmptyLines: true,
          complete: resolve,
          error: reject,
        });
      });

      const rows = Array.isArray(parsed?.data) ? parsed.data : [];
      if (rows.length === 0) {
        throw new Error("CSV has no data rows");
      }

      const accounts = rows.map(mapCsvRowToAccount);
      const result = await bulkCreateCustomers({ accounts, continueOnError: true });

      const created = Number(result?.createdCount || 0);
      const failed = Number(result?.failedCount || 0);
      const firstError = Array.isArray(result?.errors) && result.errors.length > 0
        ? result.errors[0]?.error
        : "";

      toast({
        title: "Bulk upload completed",
        description: `Created: ${created}, Failed: ${failed}${firstError ? ` | First error: ${firstError}` : ""}`,
        status: failed > 0 ? "warning" : "success",
        duration: 7000,
        isClosable: true,
      });

      if (typeof onUploaded === "function") {
        await onUploaded();
      }
      closeAndReset();
    } catch (error) {
      toast({
        title: "Bulk upload failed",
        description: error.message,
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={closeAndReset} size="lg" closeOnOverlayClick={!isUploading}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader borderTopRadius={"md"} bg={"blue.500"} color={"white"}>Bulk Upload Accounts</ModalHeader>
        <ModalCloseButton color={"white"} isDisabled={isUploading} />
        <ModalBody>
          <VStack spacing={4} align="stretch">
            <HStack>
              <Button  colorScheme="green" size={"sm"} leftIcon={<FiDownload />} variant="outline" onClick={downloadSampleCsv}>
                Download Sample CSV
              </Button>
            </HStack>

            <FormControl>
              <FormLabel>Account CSV File</FormLabel>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                disabled={isUploading}
              />
              <FormHelperText>
                Required columns: accountId, accountName, email, phone, addressLine1, city, postalCode, country, lastbillingdate.
              </FormHelperText>
            </FormControl>

            {selectedFile && (
              <Box p={3} borderWidth="1px" borderRadius="md" bg="gray.50">
                <Text fontSize="sm">Selected file: {selectedFile.name}</Text>
              </Box>
            )}
          </VStack>
        </ModalBody>
        <ModalFooter>
          <HStack>
            <Button variant="outline" onClick={closeAndReset} isDisabled={isUploading}>
              Cancel
            </Button>
            <Button
              colorScheme="blue"
              leftIcon={<FiUpload />}
              onClick={handleUpload}
              isLoading={isUploading}
              isDisabled={!selectedFile || isUploading}
            >
              Upload Accounts
            </Button>
          </HStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default BulkAccountUploadModal;
