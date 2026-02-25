import {
  Box,
  Button,
  Card,
  CardBody,
  CardHeader,
  Flex,
  FormControl,
  FormLabel,
  FormErrorMessage,
  Grid,
  Heading,
  HStack,
  Input,
  InputGroup,
  InputLeftElement,
  InputRightElement,
  Select,
  SimpleGrid,
  Text,
  VStack,
  Badge,
  Divider,
  Icon,
  useColorModeValue,
  useToast,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  Avatar,
  Tooltip,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  Progress,
  Circle,
  Tag,
  TagLabel,
} from "@chakra-ui/react";
import { useState, useRef, useCallback } from "react";
import {
  FiUploadCloud,
  FiFile,
  FiX,
  FiCalendar,
  FiHash,
  FiDollarSign,
  FiClock,
  FiCheck,
  FiChevronRight,
  FiTruck,
  FiAlertTriangle,
  FiCheckCircle,
  FiPlus,
  FiRefreshCw,
  FiRotateCcw,
} from "react-icons/fi";

// ── Vendor list ────────────────────────────────────────────────
const VENDORS = [
  { id: "v1", name: "Tata Communications",   code: "TATA",  country: "IN" },
  { id: "v2", name: "Lumen Technologies",    code: "LMNT",  country: "US" },
  { id: "v3", name: "BICS",                  code: "BICS",  country: "BE" },
  { id: "v4", name: "Syniverse",             code: "SYNV",  country: "US" },
  { id: "v5", name: "Bandwidth Inc.",        code: "BWDI",  country: "US" },
  { id: "v6", name: "Twilio",                code: "TWLO",  country: "US" },
  { id: "v7", name: "Telecom Italia Sparkle",code: "TISPK", country: "IT" },
  { id: "v8", name: "Orange Wholesale",      code: "ORNG",  country: "FR" },
];

const CURRENCY = ["USD", "EUR", "GBP", "INR", "AED", "SGD"];

const fmtBytes = (b) => {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
};

const fmtSeconds = (s) => {
  if (!s) return "—";
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const parts = [];
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  if (sec) parts.push(`${sec}s`);
  return parts.join(" ") || "0s";
};

// ── Component ─────────────────────────────────────────────────
export default function VendorInvoiceUpload() {
  const toast = useToast();
  const fileRef = useRef();
  const [dragOver, setDragOver] = useState(false);
  const [files, setFiles] = useState([]);           // [{file, id, progress, done}]
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [form, setForm] = useState({
    vendorId: "",
    invoiceNumber: "",
    issueDate: "",
    startDate: "",
    endDate: "",
    grandTotal: "",
    currency: "USD",
    totalSeconds: "",
  });
  const [errors, setErrors] = useState({});

  // ── colors ────────────────────────────────────────────────────
  const cardBg      = useColorModeValue("white", "gray.800");
  const border      = useColorModeValue("gray.200", "gray.700");
  const label       = useColorModeValue("gray.500", "gray.400");
  const dropBg      = useColorModeValue("blue.50",  "blue.900");
  const dropBorder  = dragOver ? "blue.400" : useColorModeValue("blue.200", "blue.700");
  const statBg      = useColorModeValue("gray.50", "gray.750");

  // ── handlers ─────────────────────────────────────────────────
  const handleField = (k, v) => {
    setForm(p => ({ ...p, [k]: v }));
    if (errors[k]) setErrors(p => ({ ...p, [k]: "" }));
  };

  const addFiles = (incoming) => {
    const valid = [...incoming].filter(f =>
      ["application/pdf","image/png","image/jpeg","image/jpg",
       "application/vnd.ms-excel",
       "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
       "text/csv"].includes(f.type)
    );
    if (valid.length !== incoming.length) {
      toast({ title: "Some files were skipped", description: "Only PDF, PNG, JPG, CSV, XLS/XLSX allowed.", status: "warning", duration: 3000 });
    }
    const newEntries = valid.map(f => ({ file: f, id: Math.random().toString(36).slice(2), progress: 0, done: false }));
    setFiles(p => [...p, ...newEntries]);

    // simulate upload progress per file
    newEntries.forEach(entry => {
      let prog = 0;
      const iv = setInterval(() => {
        prog += Math.random() * 25 + 5;
        if (prog >= 100) { prog = 100; clearInterval(iv); }
        setFiles(p => p.map(f => f.id === entry.id ? { ...f, progress: Math.round(prog), done: prog >= 100 } : f));
      }, 200);
    });
  };

  const removeFile = (id) => setFiles(p => p.filter(f => f.id !== id));

  const onDrop = useCallback((e) => {
    e.preventDefault(); setDragOver(false);
    addFiles(e.dataTransfer.files);
  }, []);

  const validate = () => {
    const e = {};
    if (!form.vendorId)      e.vendorId      = "Please select a vendor";
    if (!form.invoiceNumber) e.invoiceNumber = "Invoice number is required";
    if (!form.issueDate)     e.issueDate     = "Issue date is required";
    if (!form.startDate)     e.startDate     = "Start date is required";
    if (!form.endDate)       e.endDate       = "End date is required";
    if (form.startDate && form.endDate && form.startDate > form.endDate)
      e.endDate = "End date must be after start date";
    if (!form.grandTotal)    e.grandTotal    = "Grand total is required";
    else if (isNaN(form.grandTotal) || +form.grandTotal < 0)
      e.grandTotal = "Enter a valid amount";
    if (!form.totalSeconds)  e.totalSeconds  = "Total seconds is required";
    else if (isNaN(form.totalSeconds) || +form.totalSeconds < 0)
      e.totalSeconds = "Enter a valid number";
    if (files.length === 0)  e.files         = "Please attach at least one invoice file";
    return e;
  };

  const handleSubmit = async () => {
    const e = validate();
    if (Object.keys(e).length) {
      setErrors(e);
      toast({ title: "Please fix the highlighted fields", status: "error", duration: 3000, isClosable: true });
      return;
    }
    setIsSubmitting(true);
    await new Promise(r => setTimeout(r, 2000));
    setIsSubmitting(false);
    setSubmitted(true);
    toast({
      title: "Invoice Submitted Successfully",
      description: `Invoice ${form.invoiceNumber} has been queued for processing.`,
      status: "success", duration: 5000, isClosable: true,
    });
  };

  const handleReset = () => {
    setForm({ vendorId: "", invoiceNumber: "", issueDate: "", startDate: "", endDate: "", grandTotal: "", currency: "USD", totalSeconds: "" });
    setFiles([]); setErrors({}); setSubmitted(false);
  };

  const selectedVendor = VENDORS.find(v => v.id === form.vendorId);

  // ── Success screen ────────────────────────────────────────────
  if (submitted) {
    return (
      <Box display="flex" alignItems="center" justifyContent="center" p={6}>
        <Card bg={cardBg} border="1px" borderColor={border} shadow="lg" maxW="480px" w="full" textAlign="center">
          <CardBody py={12} px={10}>
            <Circle size="80px" bg="green.50" border="2px" borderColor="green.200" mx="auto" mb={6}>
              <Box color="green.500" fontSize="3xl"><FiCheck /></Box>
            </Circle>
            <Heading size="md" color="gray.800" mb={2}>Invoice Submitted!</Heading>
            <Text color="gray.500" fontSize="sm" mb={1}>Invoice <b>{form.invoiceNumber}</b></Text>
            <Text color="gray.500" fontSize="sm" mb={6}>
              {selectedVendor?.name} · {files.length} file{files.length !== 1 ? "s" : ""} attached
            </Text>
            <HStack justify="center" spacing={3}>
              <Button colorScheme="blue" size="sm" onClick={handleReset}>Upload Another</Button>
              <Button variant="outline" size="sm" borderColor={border}>View All Invoices</Button>
            </HStack>
          </CardBody>
        </Card>
      </Box>
    );
  }

  // ── Main UI ───────────────────────────────────────────────────
  return (
    <Box>
      {/* Header Section */}
      <Flex justify="space-between" align="center" bgGradient="linear(to-r,blue.100,blue.200,blue.300)" px={4} py={2} borderRadius={"12px"} mb={6}>
        <Box>
          <Heading size="lg" color="gray.600">
            Vendor Invoice Upload
          </Heading>
          <Text color="gray.600" fontSize="sm">
            Submit vendor usage invoices for CDR reconciliation and billing processing.
          </Text>
        </Box>
        <HStack spacing={4}>
          <Button variant="outline" size="sm" bg="white" borderColor={border} color="gray.500" onClick={handleReset}>Clear</Button>
          <Button size="sm" colorScheme="green"
            onClick={handleSubmit} isLoading={isSubmitting} loadingText="Submitting…" px={6} leftIcon={<FiUploadCloud />}>
            Submit Invoice
          </Button>
        </HStack>
      </Flex>

      <Box mx="auto">
        <Grid templateColumns={{ base: "1fr", lg: "1fr 300px" }} gap={6}>

          {/* ── LEFT ──────────────────────────────────────────── */}
          <VStack spacing={6} align="stretch">

            {/* ── File Upload Drop Zone ──────────────────────── */}
            <Card bg={cardBg} border="1px" borderColor={errors.files ? "red.300" : border} shadow="sm">
              <CardHeader pb={3}>
                <HStack>
                  <Box w={1} h={5} bg="blue.500" borderRadius="full" />
                  <Heading size="sm" color="gray.800">Invoice Documents</Heading>
                  <Badge colorScheme="red" variant="subtle" fontSize="xs">Required</Badge>
                </HStack>
              </CardHeader>
              <CardBody pt={0}>
                {/* Drop zone */}
                <Box
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={onDrop}
                  onClick={() => fileRef.current?.click()}
                  cursor="pointer"
                  bg={dragOver ? dropBg : "transparent"}
                  border="2px dashed"
                  borderColor={dropBorder}
                  borderRadius="xl"
                  p={8}
                  textAlign="center"
                  transition="all 0.2s"
                  _hover={{ bg: dropBg, borderColor: "blue.300" }}
                  mb={files.length ? 4 : 0}
                >
                  <input ref={fileRef} type="file" multiple hidden accept=".pdf,.png,.jpg,.jpeg,.csv,.xls,.xlsx"
                    onChange={e => { addFiles(e.target.files); e.target.value = ""; }} />
                  <Box color="blue.400" mb={3} display="flex" justifyContent="center"><FiUploadCloud size={40} /></Box>
                  <Text fontWeight="600" fontSize="sm" color="gray.700" mb={1}>
                    Drag & drop invoice files here
                  </Text>
                  <Text fontSize="xs" color="gray.400" mb={3}>PDF, PNG, JPG, CSV, XLS / XLSX • Max 25 MB each</Text>
                  <Button size="xs" colorScheme="blue" variant="outline" pointerEvents="none">
                    Browse Files
                  </Button>
                </Box>

                {/* File list */}
                {files.length > 0 && (
                  <VStack spacing={2} align="stretch">
                    {files.map(({ file, id, progress, done }) => (
                      <Box key={id} p={3} bg={statBg} borderRadius="lg" border="1px" borderColor={border}>
                        <Flex align="center" justify="space-between" mb={done ? 0 : 1.5}>
                          <HStack spacing={3} flex={1} minW={0}>
                            <Box color={done ? "teal.500" : "blue.400"} flexShrink={0}>
                              {done ? <FiCheck /> : <FiFile />}
                            </Box>
                            <Box minW={0}>
                              <Text fontSize="xs" fontWeight="600" color="gray.700" isTruncated>{file.name}</Text>
                              <Text fontSize="xs" color="gray.400">{fmtBytes(file.size)}</Text>
                            </Box>
                          </HStack>
                          <HStack spacing={2}>
                            {done && <Badge colorScheme="green" fontSize="xs">Uploaded</Badge>}
                            <Box cursor="pointer" color="gray.400" _hover={{ color: "red.400" }}
                              onClick={() => removeFile(id)}>
                              <FiX />
                            </Box>
                          </HStack>
                        </Flex>
                        {!done && (
                          <Progress value={progress} size="xs" colorScheme="blue" borderRadius="full" bg="blue.50" />
                        )}
                      </Box>
                    ))}
                  </VStack>
                )}

                {errors.files && (
                  <HStack mt={2} color="red.500" spacing={1}>
                    <FiAlertTriangle /><Text fontSize="xs">{errors.files}</Text>
                  </HStack>
                )}
              </CardBody>
            </Card>

            {/* ── Vendor & Invoice Details ───────────────────── */}
            <Card bg={cardBg} border="1px" borderColor={border} shadow="sm">
              <CardHeader pb={3}>
                <HStack>
                  <Box w={1} h={5} bg="blue.500" borderRadius="full" />
                  <Heading size="sm" color="gray.800">Vendor & Invoice Details</Heading>
                </HStack>
              </CardHeader>
              <CardBody pt={0}>
                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>

                  {/* Vendor */}
                  <FormControl isInvalid={!!errors.vendorId} isRequired gridColumn={{ md: "span 2" }}>
                    <FormLabel fontSize="sm" color={label} fontWeight="500">Vendor</FormLabel>
                    <InputGroup>
                      <InputLeftElement pointerEvents="none" color="gray.400"><FiTruck /></InputLeftElement>
                      <Select pl={10} placeholder="Select vendor…" value={form.vendorId}
                        onChange={e => handleField("vendorId", e.target.value)}
                        borderColor={border} fontSize="sm"
                        _focus={{ borderColor: "blue.400", boxShadow: "0 0 0 1px var(--chakra-colors-blue-400)" }}>
                        {VENDORS.map(v => (
                          <option key={v.id} value={v.id}>{v.name} ({v.code})</option>
                        ))}
                      </Select>
                    </InputGroup>
                    <FormErrorMessage fontSize="xs">{errors.vendorId}</FormErrorMessage>
                  </FormControl>

                  {/* Invoice Number */}
                  <FormControl isInvalid={!!errors.invoiceNumber} isRequired>
                    <FormLabel fontSize="sm" color={label} fontWeight="500">Invoice Number</FormLabel>
                    <InputGroup>
                      <InputLeftElement pointerEvents="none" color="gray.400"><FiHash /></InputLeftElement>
                      <Input pl={10} placeholder="INV-2024-00123"
                        value={form.invoiceNumber}
                        onChange={e => handleField("invoiceNumber", e.target.value)}
                        borderColor={border} fontSize="sm"
                        _focus={{ borderColor: "blue.400", boxShadow: "0 0 0 1px var(--chakra-colors-blue-400)" }} />
                    </InputGroup>
                    <FormErrorMessage fontSize="xs">{errors.invoiceNumber}</FormErrorMessage>
                  </FormControl>

                  {/* Issue Date */}
                  <FormControl isInvalid={!!errors.issueDate} isRequired>
                    <FormLabel fontSize="sm" color={label} fontWeight="500">Issue Date</FormLabel>
                    <InputGroup>
                      <InputLeftElement pointerEvents="none" color="gray.400"><FiCalendar /></InputLeftElement>
                      <Input pl={10} type="date"
                        value={form.issueDate}
                        onChange={e => handleField("issueDate", e.target.value)}
                        borderColor={border} fontSize="sm"
                        _focus={{ borderColor: "blue.400", boxShadow: "0 0 0 1px var(--chakra-colors-blue-400)" }} />
                    </InputGroup>
                    <FormErrorMessage fontSize="xs">{errors.issueDate}</FormErrorMessage>
                  </FormControl>
                </SimpleGrid>
              </CardBody>
            </Card>

            {/* ── Billing Period ─────────────────────────────── */}
            <Card bg={cardBg} border="1px" borderColor={border} shadow="sm">
              <CardHeader pb={3}>
                <HStack>
                  <Box w={1} h={5} bg="purple.500" borderRadius="full" />
                  <Heading size="sm" color="gray.800">Billing Period</Heading>
                </HStack>
              </CardHeader>
              <CardBody pt={0}>
                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                  <FormControl isInvalid={!!errors.startDate} isRequired>
                    <FormLabel fontSize="sm" color={label} fontWeight="500">Usage Start Date</FormLabel>
                    <InputGroup>
                      <InputLeftElement pointerEvents="none" color="gray.400"><FiCalendar /></InputLeftElement>
                      <Input pl={10} type="date"
                        value={form.startDate}
                        onChange={e => handleField("startDate", e.target.value)}
                        borderColor={border} fontSize="sm"
                        _focus={{ borderColor: "blue.400", boxShadow: "0 0 0 1px var(--chakra-colors-blue-400)" }} />
                    </InputGroup>
                    <FormErrorMessage fontSize="xs">{errors.startDate}</FormErrorMessage>
                  </FormControl>

                  <FormControl isInvalid={!!errors.endDate} isRequired>
                    <FormLabel fontSize="sm" color={label} fontWeight="500">Usage End Date</FormLabel>
                    <InputGroup>
                      <InputLeftElement pointerEvents="none" color="gray.400"><FiCalendar /></InputLeftElement>
                      <Input pl={10} type="date"
                        value={form.endDate}
                        onChange={e => handleField("endDate", e.target.value)}
                        borderColor={border} fontSize="sm"
                        _focus={{ borderColor: "blue.400", boxShadow: "0 0 0 1px var(--chakra-colors-blue-400)" }} />
                    </InputGroup>
                    <FormErrorMessage fontSize="xs">{errors.endDate}</FormErrorMessage>
                  </FormControl>

                  {/* Period indicator */}
                  {form.startDate && form.endDate && form.startDate <= form.endDate && (
                    <Box gridColumn={{ md: "span 2" }} p={3} bg="purple.50" borderRadius="lg" border="1px" borderColor="purple.100">
                      <HStack spacing={2}>
                        <Box color="purple.500"><FiCalendar /></Box>
                        <Text fontSize="xs" color="purple.700" fontWeight="500">
                          Billing period:{" "}
                          {Math.round((new Date(form.endDate) - new Date(form.startDate)) / (1000 * 60 * 60 * 24) + 1)} days
                          &nbsp;({new Date(form.startDate).toLocaleDateString("en-GB", { day:"2-digit", month:"short", year:"numeric" })}
                          &nbsp;→&nbsp;
                          {new Date(form.endDate).toLocaleDateString("en-GB", { day:"2-digit", month:"short", year:"numeric" })})
                        </Text>
                      </HStack>
                    </Box>
                  )}
                </SimpleGrid>
              </CardBody>
            </Card>

            {/* ── Financials ─────────────────────────────────── */}
            <Card bg={cardBg} border="1px" borderColor={border} shadow="sm">
              <CardHeader pb={3}>
                <HStack>
                  <Box w={1} h={5} bg="green.500" borderRadius="full" />
                  <Heading size="sm" color="gray.800">Financial & Usage Summary</Heading>
                </HStack>
              </CardHeader>
              <CardBody pt={0}>
                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                  {/* Grand Total */}
                  <FormControl isInvalid={!!errors.grandTotal} isRequired>
                    <FormLabel fontSize="sm" color={label} fontWeight="500">Grand Total</FormLabel>
                    <InputGroup>
                      <InputLeftElement pointerEvents="none" color="gray.400"><FiDollarSign /></InputLeftElement>
                      <Input
                        pl={10}
                        pr="90px"
                        type="number"
                        min={0}
                        step="0.01"
                        placeholder="0.00"
                        value={form.grandTotal}
                        onChange={e => handleField("grandTotal", e.target.value)}
                        borderColor={border} fontSize="sm"
                        _focus={{ borderColor: "blue.400", boxShadow: "0 0 0 1px var(--chakra-colors-blue-400)" }} />
                      <InputRightElement w="80px" pr={1}>
                        <Select size="xs" value={form.currency} border="none"
                          onChange={e => handleField("currency", e.target.value)}
                          fontWeight="600" fontSize="xs" color="gray.600" bg="transparent" cursor="pointer">
                          {CURRENCY.map(c => <option key={c} value={c}>{c}</option>)}
                        </Select>
                      </InputRightElement>
                    </InputGroup>
                    <FormErrorMessage fontSize="xs">{errors.grandTotal}</FormErrorMessage>
                  </FormControl>

                  {/* Total Seconds */}
                  <FormControl isInvalid={!!errors.totalSeconds} isRequired>
                    <FormLabel fontSize="sm" color={label} fontWeight="500">
                      Total Seconds (Usage)
                      <Tooltip label="Sum of all call durations in seconds as reported by the vendor" placement="top">
                        <Box as="span" ml={1.5} color="gray.400" display="inline-flex" verticalAlign="middle">
                          <FiAlertTriangle />
                        </Box>
                      </Tooltip>
                    </FormLabel>
                    <InputGroup>
                      <InputLeftElement pointerEvents="none" color="gray.400"><FiClock /></InputLeftElement>
                      <Input pl={10} type="number" min={0} placeholder="e.g. 3600000"
                        value={form.totalSeconds}
                        onChange={e => handleField("totalSeconds", e.target.value)}
                        borderColor={border} fontSize="sm"
                        _focus={{ borderColor: "blue.400", boxShadow: "0 0 0 1px var(--chakra-colors-blue-400)" }} />
                    </InputGroup>
                    {form.totalSeconds && !isNaN(form.totalSeconds) && +form.totalSeconds > 0 && (
                      <Text fontSize="xs" color="teal.600" mt={1} fontWeight="500">
                        ≈ {fmtSeconds(+form.totalSeconds)}
                      </Text>
                    )}
                    <FormErrorMessage fontSize="xs">{errors.totalSeconds}</FormErrorMessage>
                  </FormControl>

                  {/* Cost-per-second derived */}
                  {form.grandTotal && form.totalSeconds && +form.totalSeconds > 0 && !isNaN(form.grandTotal) && (
                    <Box gridColumn={{ md: "span 2" }} p={3} bg="green.50" borderRadius="lg" border="1px" borderColor="green.100">
                      <HStack spacing={6} flexWrap="wrap">
                        <Box>
                          <Text fontSize="xs" color="green.600" fontWeight="500" mb={0.5}>Cost Per Second</Text>
                          <Text fontSize="sm" fontWeight="700" color="green.800">
                            {form.currency} {(+form.grandTotal / +form.totalSeconds).toFixed(6)}
                          </Text>
                        </Box>
                        <Box>
                          <Text fontSize="xs" color="green.600" fontWeight="500" mb={0.5}>Cost Per Minute</Text>
                          <Text fontSize="sm" fontWeight="700" color="green.800">
                            {form.currency} {(+form.grandTotal / +form.totalSeconds * 60).toFixed(4)}
                          </Text>
                        </Box>
                        <Box>
                          <Text fontSize="xs" color="green.600" fontWeight="500" mb={0.5}>Total Minutes</Text>
                          <Text fontSize="sm" fontWeight="700" color="green.800">
                            {(+form.totalSeconds / 60).toFixed(1)} min
                          </Text>
                        </Box>
                      </HStack>
                    </Box>
                  )}
                </SimpleGrid>
              </CardBody>
            </Card>
          </VStack>

          {/* ── RIGHT COLUMN ─────────────────────────────────── */}
          <VStack spacing={5} align="stretch">

            {/* Invoice Summary Card */}
            <Card bg="blue.700" border="none" shadow="md" color="white">
              <CardBody p={5}>
                <Text fontSize="xs" fontWeight="600" color="whiteAlpha.800" letterSpacing="1px" mb={4} textTransform="uppercase">
                  Invoice Summary
                </Text>
                <VStack spacing={3} align="stretch">
                  {[
                    { label: "Vendor",   value: selectedVendor?.name || "—" },
                    { label: "Invoice #", value: form.invoiceNumber || "—" },
                    { label: "Issue Date", value: form.issueDate ? new Date(form.issueDate).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"}) : "—" },
                    { label: "Period",   value: form.startDate && form.endDate ? `${new Date(form.startDate).toLocaleDateString("en-GB",{day:"2-digit",month:"short"})} – ${new Date(form.endDate).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"})}` : "—" },
                  ].map(({ label: l, value: v }) => (
                    <Flex key={l} justify="space-between" align="flex-start">
                      <Text fontSize="xs" color="whiteAlpha.600">{l}</Text>
                      <Text fontSize="xs" fontWeight="600" textAlign="right" maxW="60%" color="white">{v}</Text>
                    </Flex>
                  ))}
                  <Divider borderColor="whiteAlpha.200" />
                  <Flex justify="space-between" align="baseline">
                    <Text fontSize="xs" color="whiteAlpha.600">Grand Total</Text>
                    <Text fontSize="xl" fontWeight="800" color="white" letterSpacing="-0.5px">
                      {form.grandTotal ? `${form.currency} ${Number(form.grandTotal).toLocaleString("en", {minimumFractionDigits:2,maximumFractionDigits:2})}` : "—"}
                    </Text>
                  </Flex>
                  <Flex justify="space-between" align="center">
                    <Text fontSize="xs" color="whiteAlpha.600">Total Duration</Text>
                    <Text fontSize="sm" fontWeight="600" color="teal.200">
                      {form.totalSeconds ? fmtSeconds(+form.totalSeconds) : "—"}
                    </Text>
                  </Flex>
                  <Flex justify="space-between" align="center">
                    <Text fontSize="xs" color="whiteAlpha.600">Files Attached</Text>
                    <Badge colorScheme={files.filter(f=>f.done).length === files.length && files.length > 0 ? "green" : "yellow"} fontSize="xs">
                      {files.filter(f=>f.done).length}/{files.length} ready
                    </Badge>
                  </Flex>
                </VStack>
              </CardBody>
            </Card>

            {/* Quick stats */}
            {selectedVendor && (
              <Card bg={cardBg} border="1px" borderColor={border} shadow="sm">
                <CardBody p={4}>
                  <Text fontSize="xs" fontWeight="600" color="gray.400" letterSpacing="1px" mb={3} textTransform="uppercase">
                    Vendor Info
                  </Text>
                  <HStack spacing={3} mb={3}>
                    <Circle size="36px" bg="blue.50" border="1px" borderColor="blue.100">
                      <Text fontSize="xs" fontWeight="700" color="blue.600">{selectedVendor.code}</Text>
                    </Circle>
                    <Box>
                      <Text fontSize="sm" fontWeight="600" color="gray.800">{selectedVendor.name}</Text>
                      <Text fontSize="xs" color="gray.400">Country: {selectedVendor.country}</Text>
                    </Box>
                  </HStack>
                  <HStack spacing={2} flexWrap="wrap">
                    <Tag size="sm" colorScheme="blue" variant="subtle"><TagLabel>Active Vendor</TagLabel></Tag>
                    <Tag size="sm" colorScheme="green" variant="subtle"><TagLabel>Verified</TagLabel></Tag>
                  </HStack>
                </CardBody>
              </Card>
            )}

            {/* Checklist */}
            <Card bg={cardBg} border="1px" borderColor={border} shadow="sm">
              <CardBody p={4}>
                <Text fontSize="xs" fontWeight="600" color="gray.400" letterSpacing="1px" mb={3} textTransform="uppercase">
                  Completion
                </Text>
                <VStack spacing={2} align="stretch">
                  {[
                    { label: "Vendor selected",      done: !!form.vendorId },
                    { label: "Invoice number",        done: !!form.invoiceNumber },
                    { label: "Issue date",            done: !!form.issueDate },
                    { label: "Billing period",        done: !!form.startDate && !!form.endDate },
                    { label: "Grand total",           done: !!form.grandTotal },
                    { label: "Total seconds",         done: !!form.totalSeconds },
                    { label: "File(s) attached",      done: files.length > 0 && files.every(f=>f.done) },
                  ].map(({ label: l, done }) => (
                    <Flex key={l} align="center" justify="space-between">
                      <HStack spacing={2}>
                        <Circle size="18px" bg={done ? "green.100" : "gray.100"} border="1px" borderColor={done ? "green.200" : "gray.200"}>
                          <Box color={done ? "green.500" : "gray.300"} transform="scale(0.8)"><FiCheck /></Box>
                        </Circle>
                        <Text fontSize="xs" color={done ? "gray.700" : "gray.400"} fontWeight={done ? "500" : "400"}>{l}</Text>
                      </HStack>
                      {done && <Badge colorScheme="green" fontSize="xs" variant="subtle">✓</Badge>}
                    </Flex>
                  ))}
                </VStack>
                <Box mt={3}>
                  {(() => {
                    const checks = [!!form.vendorId, !!form.invoiceNumber, !!form.issueDate, !!form.startDate && !!form.endDate, !!form.grandTotal, !!form.totalSeconds, files.length > 0 && files.every(f=>f.done)];
                    const pct = Math.round(checks.filter(Boolean).length / checks.length * 100);
                    return (
                      <>
                        <Flex justify="space-between" mb={1}>
                          <Text fontSize="xs" color="gray.400">Form completion</Text>
                          <Text fontSize="xs" fontWeight="600" color={pct === 100 ? "green.500" : "blue.500"}>{pct}%</Text>
                        </Flex>
                        <Progress value={pct} size="sm" colorScheme={pct === 100 ? "green" : "blue"} borderRadius="full" bg="gray.100" />
                      </>
                    );
                  })()}
                </Box>
              </CardBody>
            </Card>

            {/* Submit button */}
            <VStack spacing={2}>
              <Button w="full" colorScheme="green"
                size="md" fontWeight="600" onClick={handleSubmit}
                isLoading={isSubmitting} loadingText="Submitting…">
                Submit Invoice
              </Button>
              <Button w="full" variant="ghost" leftIcon={<FiRotateCcw/>} size="sm" color="gray.600" onClick={handleReset}>
                Reset Form
              </Button>
            </VStack>
          </VStack>
        </Grid>
      </Box>
    </Box>
  );
}