import React, { useState, useEffect } from "react";
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  Button,
  VStack,
  FormControl,
  FormLabel,
  FormHelperText,
  SimpleGrid,
  Heading,
  Alert,
  AlertIcon,
  Spinner,
  Text,
  Flex,
  Box,
  HStack,
  Badge,
  Divider,
} from "@chakra-ui/react";
import { fetchLiteInvoices } from "../../../utils/api";
import { MemoizedInput as Input, MemoizedSelect as Select } from "../../memoizedinput/memoizedinput";

const RecordPaymentModal = ({
  isOpen,
  onClose,
  paymentForm,
  setPaymentForm,
  customers,
  onRecordPayment,
  isSubmitting = false,
  mode = "customer",
  title = "Record Payment",
  lockEntitySelection = false,
  showCreditNote = false,
  creditNoteMax = 0,
  currency = "USD",
}) => {
  const isVendorMode = mode === "vendor";
  const [customerInvoices, setCustomerInvoices] = useState([]);
  const [isLoadingInvoices, setIsLoadingInvoices] = useState(false);

  const selectedCustomer = customers.find((c) => {
    const value = paymentForm.customerId;
    if (!value) return false;
    return (
      String(c.customerCode || "") === String(value) ||
      String(c.gatewayId || "") === String(value) ||
      String(c.accountId || "") === String(value)
    );
  });

  const isPostpaidCustomer = String(selectedCustomer?.billingType || "").toLowerCase() === "postpaid";
  const accountFundsLabel = "Use Account Funds";
  const postpaidLimit = Number(selectedCustomer?.originalCreditLimit ?? 0);
  const availableFunds = isPostpaidCustomer
    ? postpaidLimit + Number(selectedCustomer?.balance || 0)
    : Number(selectedCustomer?.balance || 0);
  const shouldShowCreditNote = isVendorMode || showCreditNote;
  const vendorGrossAmount = Number(creditNoteMax || 0);
  const vendorCreditNoteAmount = Number(paymentForm.creditNoteAmount || 0);
  const vendorPayableAmount = Math.max(0, vendorGrossAmount - vendorCreditNoteAmount);

  useEffect(() => {
    if (!isVendorMode && isOpen && paymentForm.customerId) {
      loadCustomerInvoices(paymentForm.customerId);
    } else {
      setCustomerInvoices([]);
    }
  }, [isOpen, paymentForm.customerId, isVendorMode]);

  const loadCustomerInvoices = async (customerId) => {
    setIsLoadingInvoices(true);
    try {
      // Fetch only unpaid/partial invoices for this customer
      const response = await fetchLiteInvoices({ 
        customerId: customerId,
        // status: 'pending' // Optional: filter by status if needed
      });
      
      if (response.success) {
        // Keep only invoices that are not fully paid.
        const unpaid = response.data.filter((inv) => inv.status !== 'paid');
        setCustomerInvoices(unpaid);
      }
    } catch (error) {
      console.error("Error loading customer invoices:", error);
    } finally {
      setIsLoadingInvoices(false);
    }
  };

  const handleInvoiceChange = (invoiceId) => {
    if (!invoiceId) {
      setPaymentForm({
        ...paymentForm,
        invoiceId: "",
        amount: "",
        notes: ""
      });
      return;
    }

    const selectedInvoice = customerInvoices.find(inv => inv.id.toString() === invoiceId.toString());
    if (selectedInvoice) {
      setPaymentForm({
        ...paymentForm,
        invoiceId: selectedInvoice.id,
        amount: selectedInvoice.balanceAmount || selectedInvoice.totalAmount,
        notes: `Payment for invoice ${selectedInvoice.invoiceNumber}`
      });
    }
  };

  const handleCreditNoteChange = (value) => {
    const numericValue = Number(value || 0);
    const max = Number(creditNoteMax || 0);
    const boundedCreditNote = Number.isNaN(numericValue)
      ? 0
      : Math.min(Math.max(numericValue, 0), max);
    const payableAmount = Math.max(0, max - boundedCreditNote);

    setPaymentForm({
      ...paymentForm,
      creditNoteAmount: String(value ?? ""),
      amount: payableAmount.toFixed(2),
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg" scrollBehavior="inside" closeOnOverlayClick={!isSubmitting}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader bg="blue.500" color="white" borderTopRadius="md">
          <Heading size="md">{title}</Heading>
        </ModalHeader>
        <ModalCloseButton color="white" />
        <ModalBody py={6} maxH="60vh" overflowY="auto">
          <VStack spacing={4} align="stretch">
            <FormControl isRequired>
              <FormLabel>{isVendorMode ? "Vendor" : "Customer"}</FormLabel>
              <Select
                placeholder={isVendorMode ? "Select vendor" : "Select customer"}
                value={paymentForm.customerId}
                onChange={(e) =>
                  setPaymentForm({ 
                    ...paymentForm, 
                    customerId: e.target.value,
                    paymentSource: "new_payment",
                    invoiceId: "", // Reset invoice when customer changes
                    amount: ""
                  })
                }
                isDisabled={isSubmitting || lockEntitySelection}
              >
                {customers.map((c) => (
                  <option
                    key={c.accountId}
                    value={c.customerCode || c.vendorCode || c.gatewayId || c.accountId}
                  >
                    {c.accountName}
                  </option>
                ))}
              </Select>
            </FormControl>

            {!isVendorMode && paymentForm.customerId && (
              <FormControl isRequired>
                <FormLabel>Pay Using</FormLabel>
                <Select
                  value={paymentForm.paymentSource || "new_payment"}
                  onChange={(e) =>
                    setPaymentForm({
                      ...paymentForm,
                      paymentSource: e.target.value,
                    })
                  }
                  isDisabled={isSubmitting}
                >
                  <option value="new_payment">Record New Payment</option>
                  <option value="account_funds">{accountFundsLabel}</option>
                </Select>
              </FormControl>
            )}

            {!isVendorMode && paymentForm.customerId && paymentForm.paymentSource === "account_funds" && (
              <Alert status="info" borderRadius="md" fontSize="sm">
                <AlertIcon />
                {isPostpaidCustomer
                  ? `Available funds remaining: $${availableFunds.toFixed(4)}`
                  : `Available balance: $${availableFunds.toFixed(4)}`}
              </Alert>
            )}

            {!isVendorMode && paymentForm.customerId && (
              <FormControl isRequired>
                <FormLabel>
                  Select Invoice 
                  {isLoadingInvoices && <Spinner size="xs" ml={2} />}
                </FormLabel>
                <Select
                  placeholder={isLoadingInvoices ? "Loading invoices..." : "Select an unpaid invoice"}
                  value={paymentForm.invoiceId}
                  onChange={(e) => handleInvoiceChange(e.target.value)}
                  isDisabled={isLoadingInvoices || isSubmitting}
                >
                  {customerInvoices.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      {inv.invoiceNumber} - Bal: ${parseFloat(inv.balanceAmount).toFixed(4)} ({inv.status})
                    </option>
                  ))}
                </Select>
                {customerInvoices.length === 0 && !isLoadingInvoices && (
                  <Text fontSize="xs" color="gray.500" mt={1}>
                    No unpaid invoices found for this customer.
                  </Text>
                )}
              </FormControl>
            )}

            {isVendorMode && (
  <Flex
    justify="space-between"
    align="center"
    p={3}
    bg="orange.50"
    border="1px solid"
    borderColor="orange.200"
    borderRadius="md"
  >
    <Text fontSize="sm" fontWeight="500" color="gray.700">
      Payable Amount
    </Text>

    <Text
      fontSize="md"
      fontWeight="500"
      color="orange.600"
    >
      {currency} {Number(paymentForm.amount || 0).toFixed(2)}
    </Text>
  </Flex>
)}

            <SimpleGrid columns={2} spacing={4}>
              {!isVendorMode && (
                <FormControl isRequired>
                  <FormLabel>Amount</FormLabel>
                  <Input
                    type="number"
                    value={paymentForm.amount}
                    onChange={(e) =>
                      setPaymentForm({ ...paymentForm, amount: e.target.value })
                    }
                    isDisabled={isSubmitting || Boolean(paymentForm.invoiceId)}
                  />
                  {paymentForm.invoiceId && (
                    <FormHelperText>
                      Amount is locked to the selected invoice outstanding balance.
                    </FormHelperText>
                  )}
                </FormControl>
              )}
              <FormControl isRequired>
                <FormLabel>Payment Date</FormLabel>
                <Input
                  type="date"
                  value={paymentForm.paymentDate}
                  onChange={(e) =>
                    setPaymentForm({
                      ...paymentForm,
                      paymentDate: e.target.value,
                    })
                  }
                  isDisabled={isSubmitting}
                />
              </FormControl>
            </SimpleGrid>

            {shouldShowCreditNote && (
              <FormControl>
                <FormLabel>Credit Note Amount</FormLabel>
                <Input
                  type="number"
                  min={0}
                  max={Number(creditNoteMax || 0)}
                  step="0.01"
                  value={paymentForm.creditNoteAmount ?? "0"}
                  onChange={(e) => handleCreditNoteChange(e.target.value)}
                  isDisabled={isSubmitting}
                />
              </FormControl>
            )}

           {isVendorMode && (
  <Box
    bg="linear-gradient(180deg, #F8FAFF 0%, #EEF4FF 100%)"
    border="1px solid"
    borderColor="blue.100"
    borderRadius="lg"
    p={4}
  >
    <VStack align="stretch" spacing={3}>
      <Text
        fontSize="xs"
        fontWeight="700"
        color="blue.600"
        textTransform="uppercase"
        letterSpacing="0.5px"
      >
        Payment Summary
      </Text>

      <HStack justify="space-between">
        <Text fontSize="sm" color="gray.600">
          Invoice Amount
        </Text>
        <Text fontSize="sm" fontWeight="600">
          {currency} {vendorGrossAmount.toFixed(4)}
        </Text>
      </HStack>

      <HStack justify="space-between">
        <Text fontSize="sm" color="gray.600">
          Credit Note
        </Text>
        <Badge
          colorScheme={vendorCreditNoteAmount > 0 ? "orange" : "gray"}
          borderRadius="full"
          px={2}
          py={1}
        >
          {currency} {vendorCreditNoteAmount.toFixed(4)}
        </Badge>
      </HStack>

      <Divider borderColor="blue.100" />

      <Flex
        justify="space-between"
        align="center"
        bg="white"
        p={3}
        borderRadius="md"
        border="1px solid"
        borderColor="blue.200"
      >
        <Box>
          <Text
            fontSize="xs"
            color="gray.500"
            textTransform="uppercase"
            fontWeight="600"
          >
            Actually Payable
          </Text>
          <Text fontSize="xs" color="gray.500">
            Final vendor settlement amount
          </Text>
        </Box>

        <Text
          fontSize="xl"
          fontWeight="700"
          color="blue.600"
        >
          {currency} {vendorPayableAmount.toFixed(4)}
        </Text>
      </Flex>
    </VStack>
  </Box>
)}

            {(isVendorMode || paymentForm.paymentSource !== "account_funds") && (
              <>
                <FormControl isRequired>
                  <FormLabel>Payment Method</FormLabel>
                  <Select
                    value={paymentForm.paymentMethod}
                    onChange={(e) =>
                      setPaymentForm({
                        ...paymentForm,
                        paymentMethod: e.target.value,
                      })
                    }
                    isDisabled={isSubmitting}
                  >
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="usdt">USDT</option>
                    <option value="cash">Cash</option>
                    <option value="cheque">Cheque</option>
                    <option value="credit_card">Credit Card</option>
                    <option value="other">Other</option>
                  </Select>
                </FormControl>

                <SimpleGrid columns={2} spacing={4}>
                  <FormControl>
                    <FormLabel>Transaction ID</FormLabel>
                    <Input
                      placeholder={isVendorMode ? "e.g. Bank Txn ID" : "e.g. Payment Gateway Txn ID"}
                      value={paymentForm.transactionId}
                      onChange={(e) =>
                        setPaymentForm({
                          ...paymentForm,
                          transactionId: e.target.value,
                        })
                      }
                      isDisabled={isSubmitting}
                    />
                  </FormControl>
                  <FormControl>
                    <FormLabel>Ref Number</FormLabel>
                    <Input
                      placeholder="e.g. Cheque number or any reference"
                      value={paymentForm.referenceNumber}
                      onChange={(e) =>
                        setPaymentForm({
                          ...paymentForm,
                          referenceNumber: e.target.value,
                        })
                      }
                      isDisabled={isSubmitting}
                    />
                  </FormControl>
                </SimpleGrid>
              </>
            )}

            <FormControl>
              <FormLabel>Notes</FormLabel>
              <Input
                placeholder="Any additional information about this payment"
                value={paymentForm.notes}
                onChange={(e) =>
                  setPaymentForm({ ...paymentForm, notes: e.target.value })
                }
                isDisabled={isSubmitting}
              />
            </FormControl>
          </VStack>
        </ModalBody>
        <ModalFooter borderTopWidth="1px">
          <Button variant="ghost" mr={3} onClick={onClose} isDisabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            colorScheme="blue"
            onClick={onRecordPayment}
            isLoading={isSubmitting}
            loadingText="Recording..."
            isDisabled={!paymentForm.customerId || !paymentForm.paymentDate || (!isVendorMode && !paymentForm.amount) || isSubmitting}
          >
            Record Payment
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default RecordPaymentModal;
