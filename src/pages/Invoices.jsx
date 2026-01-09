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
import { format } from "date-fns";

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
    periodStart: format(new Date().setDate(1), "yyyy-MM-dd"), // First day of current month
    periodEnd: format(new Date(), "yyyy-MM-dd"), // Today
    billingCycle: "monthly",
  });
  const toast = useToast();

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    filterInvoices();
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

    // Apply search
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (invoice) =>
          invoice.invoiceNumber?.toLowerCase().includes(term) ||
          invoice.customerName?.toLowerCase().includes(term) ||
          invoice.customerId?.toLowerCase().includes(term)
      );
    }

    // Apply status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter((invoice) => invoice.status === statusFilter);
    }

    setFilteredInvoices(filtered);
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

    // Get CDRs for the selected customer and period
    const cdrs = getCDRs();
    const periodStart = new Date(generateForm.periodStart);
    const periodEnd = new Date(generateForm.periodEnd);

    const customerCdrs = cdrs.filter(
      (cdr) =>
        cdr.customer_id === generateForm.customerId &&
        new Date(cdr.starttime) >= periodStart &&
        new Date(cdr.starttime) <= periodEnd
    );

    if (customerCdrs.length === 0) {
      toast({
        title: "No CDRs found",
        description:
          "No call records found for the selected customer and period",
        status: "warning",
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    // Calculate invoice
    const invoice = calculateInvoice(customerCdrs, customer);

    // Create invoice object
    const newInvoice = {
      id: `INV${Date.now().toString().slice(-8)}`,
      invoiceNumber: `INV-${Date.now().toString().slice(-6)}`,
      ...invoice,
      periodStart: generateForm.periodStart,
      periodEnd: generateForm.periodEnd,
      generatedDate: new Date().toISOString(),
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
      status: "generated",
      billingCycle: generateForm.billingCycle,
      items: customerCdrs.map((cdr) => ({
        callId: cdr.id,
        date: cdr.starttime,
        caller: cdr.callere164,
        callee: cdr.calleee164,
        duration: cdr.duration,
        rate: cdr.rate,
        amount: cdr.fee,
      })),
    };

    // Save invoice
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
    });
  };

  const handleViewInvoice = (invoice) => {
    setSelectedInvoice(invoice);
    setIsViewModalOpen(true);
  };

  const handleDownloadInvoice = (invoice) => {
    // Create a printable HTML invoice
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
            <p>Tax (${(invoice.taxRate * 100).toFixed(
              0
            )}%): $${invoice.totalTax.toFixed(2)}</p>
            <p>Total Amount: $${invoice.totalAmount.toFixed(2)}</p>
          </div>
          <div class="footer">
            <p>Thank you for your business!</p>
            <p>This is a computer-generated invoice. No signature required.</p>
          </div>
        </body>
      </html>
    `;

    // Open in new window for printing
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
      });
      return;
    }

    // In a real app, you would integrate with an email service
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
    });
  };

  const columns = [
    {
      key: "invoiceNumber",
      header: "Invoice #",
      render: (value) => (
        <Badge colorScheme="blue" variant="outline">
          {value}
        </Badge>
      ),
    },
    {
      key: "customerName",
      header: "Customer",
      render: (value, row) => (
        <Box>
          <Text fontWeight="medium">{value}</Text>
          <Text fontSize="sm" color="gray.600">
            {row.customerId}
          </Text>
        </Box>
      ),
    },
    {
      key: "periodStart",
      header: "Period",
      render: (value, row) => (
        <Box>
          <Text fontSize="sm">{format(new Date(value), "dd/MM/yyyy")}</Text>
          <Text fontSize="xs" color="gray.600">
            to {format(new Date(row.periodEnd), "dd/MM/yyyy")}
          </Text>
        </Box>
      ),
    },
    {
      key: "totalAmount",
      header: "Amount",
      render: (value) => (
        <Text fontWeight="bold" color="green.600">
          ${parseFloat(value).toFixed(2)}
        </Text>
      ),
    },
    {
      key: "dueDate",
      header: "Due Date",
      render: (value) => format(new Date(value), "dd/MM/yyyy"),
    },
    {
      key: "status",
      header: "Status",
      type: "badge",
      colorMap: {
        generated: "blue",
        sent: "orange",
        paid: "green",
        overdue: "red",
        cancelled: "gray",
      },
    },
    {
      key: "generatedDate",
      header: "Generated",
      render: (value) => format(new Date(value), "dd/MM/yyyy"),
    },
  ];

  const statusOptions = [
    { value: "all", label: "All Statuses" },
    { value: "generated", label: "Generated" },
    { value: "sent", label: "Sent" },
    { value: "paid", label: "Paid" },
    { value: "overdue", label: "Overdue" },
    { value: "cancelled", label: "Cancelled" },
  ];

  return (
    <Container maxW="container.xl" py={2}>
      <VStack spacing={6} align="stretch">
        {/* Header */}
        <HStack justify="space-between">
          <Box>
            <Heading size="lg" mb={2}>
              Invoices
            </Heading>
            <Text color="gray.600">Generate and manage customer invoices</Text>
          </Box>
          <Spacer/>
          <Menu>
            <MenuButton
              as={Button}
              size="sm"
              leftIcon={<FiPlus />}
              variant={"outline"}
              colorScheme="blue"
            >
              Generate Invoice
            </MenuButton>
            <MenuList>
              <MenuItem
                icon={<FiFileText />}
                onClick={() => setIsGenerateModalOpen(true)} // Open manual invoice modal
              >
                Manual Invoice
                <Text fontSize="xs" color="gray.500">
                  Generate invoice for specific customer/period
                </Text>
              </MenuItem>
              <MenuItem
                icon={<FiRefreshCw />}
                onClick={() => handleAutoGenerateInvoices()} // Auto-generate invoices
              >
                Automatic Invoices
                <Text fontSize="xs" color="gray.500">
                  Generate invoices for all due customers
                </Text>
              </MenuItem>
            </MenuList>
          </Menu>
          <Menu>
            <MenuButton
              as={Button}
              size="sm"
              variant={"outline"}

              leftIcon={<FiPlus />}
              colorScheme="blue"
            >
              Actions
            </MenuButton>
            <MenuList>
              {/* Generate Invoice Section */}

              {/* Send Invoice Section */}
              <MenuItem
                icon={<FiMail />}
                onClick={() => handleSendBulkEmail()}
                command="⌘E"
              >
                Send Bulk Email
              </MenuItem>
              <MenuItem
                icon={<FiSend />}
                onClick={() => handleSendSelectedInvoices()}
              >
                Send Selected Invoices
              </MenuItem>

              <MenuDivider />

              {/* Download & Export Section */}
              <MenuItem
                icon={<FiDownload />}
                onClick={() => handleDownloadSelected()}
                command="⌘D"
              >
                Download Selected
              </MenuItem>
              <MenuItem icon={<FiFile />} onClick={() => handleExportToSage()}>
                <Box>
                  <Text>Sage Export</Text>
                  <Text fontSize="xs" color="gray.500">
                    Export to accounting software
                  </Text>
                </Box>
              </MenuItem>
              <MenuItem
                icon={<FiPrinter />}
                onClick={() => handlePrintSelected()}
                command="⌘P"
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
                onClick={() => handleRegenerateSelected()}
              >
                Regenerate Selected
              </MenuItem>
              <MenuItem
                icon={<FiTrash2 />}
                onClick={() => handleDeleteSelected()}
                command="⌘⌫"
                color="red.500"
              >
                Delete Selected
              </MenuItem>
            </MenuList>
          </Menu>
        </HStack>

        {/* Stats Summary */}
        <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4}>
          <Card>
            <CardBody>
              <HStack>
                <Box>
                  <Text fontSize="sm" color="gray.600">
                    Total Invoices
                  </Text>
                  <Text fontSize="2xl" fontWeight="bold">
                    {invoices.length}
                  </Text>
                </Box>
                <Icon as={FiFileText} color="blue.500" boxSize={6} />
              </HStack>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <HStack>
                <Box>
                  <Text fontSize="sm" color="gray.600">
                    Total Revenue
                  </Text>
                  <Text fontSize="2xl" fontWeight="bold" color="green.600">
                    $
                    {invoices
                      .reduce(
                        (sum, inv) => sum + parseFloat(inv.totalAmount || 0),
                        0
                      )
                      .toFixed(2)}
                  </Text>
                </Box>
                <Icon as={FiDollarSign} color="green.500" boxSize={6} />
              </HStack>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <HStack>
                <Box>
                  <Text fontSize="sm" color="gray.600">
                    Pending
                  </Text>
                  <Text fontSize="2xl" fontWeight="bold" color="orange.600">
                    {
                      invoices.filter(
                        (inv) =>
                          inv.status === "generated" || inv.status === "sent"
                      ).length
                    }
                  </Text>
                </Box>
                <Icon as={FiCalendar} color="orange.500" boxSize={6} />
              </HStack>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <HStack>
                <Box>
                  <Text fontSize="sm" color="gray.600">
                    Paid
                  </Text>
                  <Text fontSize="2xl" fontWeight="bold" color="green.600">
                    {invoices.filter((inv) => inv.status === "paid").length}
                  </Text>
                </Box>
                <Icon as={FiUser} color="purple.500" boxSize={6} />
              </HStack>
            </CardBody>
          </Card>
        </SimpleGrid>

        {/* Filters */}
        <HStack spacing={4}>
          <Input
            placeholder="Search invoices..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            flex={1}
          />
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            w="200px"
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
          <ExportButton data={filteredInvoices} fileName="invoices" />
        </HStack>

        {/* Data Table */}
        <DataTable
          columns={columns}
          data={filteredInvoices}
          onView={handleViewInvoice}
          onEdit={(invoice) => handleViewInvoice(invoice)}
          onDelete={() => {}}
          actions={true}
        />

        {/* Custom Actions Column */}
        <Box overflowX="auto">
          <Table size="sm">
            <Thead>
              <Tr>
                <Th>Invoice #</Th>
                <Th>Customer</Th>
                <Th>Amount</Th>
                <Th>Status</Th>
                <Th>Actions</Th>
              </Tr>
            </Thead>
            <Tbody>
              {filteredInvoices.map((invoice) => (
                <Tr key={invoice.id}>
                  <Td>
                    <Badge colorScheme="blue">{invoice.invoiceNumber}</Badge>
                  </Td>
                  <Td>{invoice.customerName}</Td>
                  <Td fontWeight="bold" color="green.600">
                    ${parseFloat(invoice.totalAmount || 0).toFixed(2)}
                  </Td>
                  <Td>
                    <Badge
                      colorScheme={
                        invoice.status === "paid"
                          ? "green"
                          : invoice.status === "overdue"
                          ? "red"
                          : invoice.status === "sent"
                          ? "orange"
                          : invoice.status === "generated"
                          ? "blue"
                          : "gray"
                      }
                    >
                      {invoice.status}
                    </Badge>
                  </Td>
                  <Td>
                    <HStack spacing={2}>
                      <IconButton
                        icon={<FiEye />}
                        size="sm"
                        variant="ghost"
                        onClick={() => handleViewInvoice(invoice)}
                        aria-label="View invoice"
                      />
                      <IconButton
                        icon={<FiDownload />}
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDownloadInvoice(invoice)}
                        aria-label="Download invoice"
                      />
                      <IconButton
                        icon={<FiMail />}
                        size="sm"
                        variant="ghost"
                        onClick={() => handleSendEmail(invoice)}
                        aria-label="Send email"
                      />
                      <Menu>
                        <MenuButton
                          as={IconButton}
                          icon={<FiFilter />}
                          size="sm"
                          variant="ghost"
                          aria-label="Change status"
                        />
                        <MenuList>
                          <MenuItem
                            onClick={() =>
                              handleUpdateStatus(invoice.id, "generated")
                            }
                          >
                            Mark as Generated
                          </MenuItem>
                          <MenuItem
                            onClick={() =>
                              handleUpdateStatus(invoice.id, "sent")
                            }
                          >
                            Mark as Sent
                          </MenuItem>
                          <MenuItem
                            onClick={() =>
                              handleUpdateStatus(invoice.id, "paid")
                            }
                          >
                            Mark as Paid
                          </MenuItem>
                          <MenuItem
                            onClick={() =>
                              handleUpdateStatus(invoice.id, "overdue")
                            }
                          >
                            Mark as Overdue
                          </MenuItem>
                          <MenuItem
                            onClick={() =>
                              handleUpdateStatus(invoice.id, "cancelled")
                            }
                          >
                            Mark as Cancelled
                          </MenuItem>
                        </MenuList>
                      </Menu>
                    </HStack>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </Box>

        {/* View Invoice Modal */}
        <Modal
          isOpen={isViewModalOpen}
          onClose={() => setIsViewModalOpen(false)}
          size="6xl"
        >
          <ModalOverlay />
          <ModalContent>
            <ModalHeader>Invoice {selectedInvoice?.invoiceNumber}</ModalHeader>
            <ModalCloseButton />
            <ModalBody>
              {selectedInvoice && (
                <VStack spacing={6} align="stretch">
                  {/* Invoice Header */}
                  <SimpleGrid columns={2} spacing={6}>
                    <Box>
                      <Text fontSize="sm" color="gray.600">
                        Customer
                      </Text>
                      <Text fontSize="xl" fontWeight="bold">
                        {selectedInvoice.customerName}
                      </Text>
                      <Text>{selectedInvoice.customerId}</Text>
                    </Box>
                    <Box textAlign="right">
                      <Text fontSize="sm" color="gray.600">
                        Invoice Number
                      </Text>
                      <Text fontSize="xl" fontWeight="bold">
                        {selectedInvoice.invoiceNumber}
                      </Text>
                      <Badge
                        colorScheme={
                          selectedInvoice.status === "paid"
                            ? "green"
                            : selectedInvoice.status === "overdue"
                            ? "red"
                            : selectedInvoice.status === "sent"
                            ? "orange"
                            : selectedInvoice.status === "generated"
                            ? "blue"
                            : "gray"
                        }
                      >
                        {selectedInvoice.status}
                      </Badge>
                    </Box>
                  </SimpleGrid>

                  {/* Invoice Details */}
                  <SimpleGrid columns={4} spacing={4}>
                    <Box>
                      <Text fontSize="sm" color="gray.600">
                        Invoice Date
                      </Text>
                      <Text fontWeight="medium">
                        {format(
                          new Date(selectedInvoice.generatedDate),
                          "dd/MM/yyyy"
                        )}
                      </Text>
                    </Box>
                    <Box>
                      <Text fontSize="sm" color="gray.600">
                        Due Date
                      </Text>
                      <Text fontWeight="medium">
                        {format(
                          new Date(selectedInvoice.dueDate),
                          "dd/MM/yyyy"
                        )}
                      </Text>
                    </Box>
                    <Box>
                      <Text fontSize="sm" color="gray.600">
                        Billing Period
                      </Text>
                      <Text fontWeight="medium">
                        {format(
                          new Date(selectedInvoice.periodStart),
                          "dd/MM/yyyy"
                        )}{" "}
                        -{" "}
                        {format(
                          new Date(selectedInvoice.periodEnd),
                          "dd/MM/yyyy"
                        )}
                      </Text>
                    </Box>
                    <Box>
                      <Text fontSize="sm" color="gray.600">
                        Billing Cycle
                      </Text>
                      <Text fontWeight="medium">
                        {selectedInvoice.billingCycle}
                      </Text>
                    </Box>
                  </SimpleGrid>

                  {/* Call Items */}
                  <Box>
                    <Heading size="sm" mb={4}>
                      Call Details
                    </Heading>
                    <Box overflowX="auto">
                      <Table size="sm">
                        <Thead>
                          <Tr>
                            <Th>Date & Time</Th>
                            <Th>Caller</Th>
                            <Th>Callee</Th>
                            <Th>Duration</Th>
                            <Th>Rate</Th>
                            <Th>Amount</Th>
                          </Tr>
                        </Thead>
                        <Tbody>
                          {selectedInvoice.items?.map((item, index) => (
                            <Tr key={index}>
                              <Td>
                                {format(
                                  new Date(item.date),
                                  "dd/MM/yyyy HH:mm"
                                )}
                              </Td>
                              <Td>{item.caller}</Td>
                              <Td>{item.callee}</Td>
                              <Td>{item.duration}s</Td>
                              <Td>${item.rate}/sec</Td>
                              <Td>${item.amount.toFixed(4)}</Td>
                            </Tr>
                          ))}
                        </Tbody>
                      </Table>
                    </Box>
                  </Box>

                  {/* Summary */}
                  <Box p={4} bg="gray.50" borderRadius="md">
                    <SimpleGrid columns={3} spacing={4}>
                      <Box>
                        <Text fontSize="sm" color="gray.600">
                          Total Calls
                        </Text>
                        <Text fontSize="xl" fontWeight="bold">
                          {selectedInvoice.totalCalls}
                        </Text>
                      </Box>
                      <Box>
                        <Text fontSize="sm" color="gray.600">
                          Total Duration
                        </Text>
                        <Text fontSize="xl" fontWeight="bold">
                          {Math.floor(selectedInvoice.totalDuration / 3600)}h{" "}
                          {Math.floor(
                            (selectedInvoice.totalDuration % 3600) / 60
                          )}
                          m
                        </Text>
                      </Box>
                      <Box>
                        <Text fontSize="sm" color="gray.600">
                          Answered Calls
                        </Text>
                        <Text fontSize="xl" fontWeight="bold">
                          {selectedInvoice.answeredCalls}
                        </Text>
                      </Box>
                    </SimpleGrid>
                  </Box>

                  {/* Totals */}
                  <Box p={4} bg="blue.50" borderRadius="md">
                    <SimpleGrid columns={3} spacing={4}>
                      <Box>
                        <Text fontSize="sm" color="gray.600">
                          Subtotal
                        </Text>
                        <Text fontSize="2xl" fontWeight="bold">
                          ${selectedInvoice.totalFee.toFixed(2)}
                        </Text>
                      </Box>
                      <Box>
                        <Text fontSize="sm" color="gray.600">
                          Tax ({(selectedInvoice.taxRate * 100).toFixed(0)}%)
                        </Text>
                        <Text
                          fontSize="2xl"
                          fontWeight="bold"
                          color="orange.600"
                        >
                          ${selectedInvoice.totalTax.toFixed(2)}
                        </Text>
                      </Box>
                      <Box>
                        <Text fontSize="sm" color="gray.600">
                          Total Amount
                        </Text>
                        <Text
                          fontSize="2xl"
                          fontWeight="bold"
                          color="green.600"
                        >
                          ${selectedInvoice.totalAmount.toFixed(2)}
                        </Text>
                      </Box>
                    </SimpleGrid>
                  </Box>
                </VStack>
              )}
            </ModalBody>
            <ModalFooter>
              <HStack spacing={3}>
                <Button
                  leftIcon={<FiPrinter />}
                  onClick={() => handleDownloadInvoice(selectedInvoice)}
                >
                  Print Invoice
                </Button>
                <Button
                  leftIcon={<FiMail />}
                  onClick={() => handleSendEmail(selectedInvoice)}
                >
                  Send Email
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setIsViewModalOpen(false)}
                >
                  Close
                </Button>
              </HStack>
            </ModalFooter>
          </ModalContent>
        </Modal>

        {/* Generate Invoice Modal */}
        <Modal
          isOpen={isGenerateModalOpen}
          onClose={() => setIsGenerateModalOpen(false)}
        >
          <ModalOverlay />
          <ModalContent>
            <ModalHeader>Generate New Invoice</ModalHeader>
            <ModalCloseButton />
            <ModalBody>
              <VStack spacing={4}>
                <FormControl isRequired>
                  <FormLabel>Customer</FormLabel>
                  <Select
                    placeholder="Select customer"
                    value={generateForm.customerId}
                    onChange={(e) =>
                      setGenerateForm({
                        ...generateForm,
                        customerId: e.target.value,
                      })
                    }
                  >
                    {customers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.name} ({customer.id})
                      </option>
                    ))}
                  </Select>
                </FormControl>

                <SimpleGrid columns={2} spacing={4}>
                  <FormControl isRequired>
                    <FormLabel>Period Start</FormLabel>
                    <Input
                      type="date"
                      value={generateForm.periodStart}
                      onChange={(e) =>
                        setGenerateForm({
                          ...generateForm,
                          periodStart: e.target.value,
                        })
                      }
                    />
                  </FormControl>
                  <FormControl isRequired>
                    <FormLabel>Period End</FormLabel>
                    <Input
                      type="date"
                      value={generateForm.periodEnd}
                      onChange={(e) =>
                        setGenerateForm({
                          ...generateForm,
                          periodEnd: e.target.value,
                        })
                      }
                    />
                  </FormControl>
                </SimpleGrid>

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
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="annually">Annually</option>
                  </Select>
                </FormControl>

                {generateForm.customerId && (
                  <Box p={4} bg="gray.50" borderRadius="md" w="100%">
                    <Text fontSize="sm" color="gray.600" mb={2}>
                      Selected Customer Details:
                    </Text>
                    {(() => {
                      const customer = customers.find(
                        (c) => c.id === generateForm.customerId
                      );
                      return customer ? (
                        <VStack align="stretch" spacing={1}>
                          <Text>
                            <strong>Rate:</strong> ${customer.rate}/sec
                          </Text>
                          <Text>
                            <strong>Tax Rate:</strong>{" "}
                            {(customer.taxRate * 100).toFixed(0)}%
                          </Text>
                          <Text>
                            <strong>Email:</strong> {customer.email}
                          </Text>
                          <Text>
                            <strong>Phone:</strong> {customer.phone}
                          </Text>
                        </VStack>
                      ) : null;
                    })()}
                  </Box>
                )}
              </VStack>
            </ModalBody>
            <ModalFooter>
              <Button
                variant="ghost"
                mr={3}
                onClick={() => setIsGenerateModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                colorScheme="blue"
                onClick={handleGenerateInvoice}
                isDisabled={!generateForm.customerId}
              >
                Generate Invoice
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      </VStack>
    </Container>
  );
};

// Helper component for simple grid
const Simplegrid = ({ children, columns = 2, spacing = 4 }) => (
  <Box
    display="grid"
    gridTemplateColumns={`repeat(${columns}, 1fr)`}
    gap={spacing}
  >
    {children}
  </Box>
);

export default Invoices;
