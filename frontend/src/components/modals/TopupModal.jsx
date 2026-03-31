import React, { useState } from "react";
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
  Heading,
  Alert,
  AlertIcon,
  Spinner,
  Text,
  Box,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  NumberIncrementStepper,
  NumberDecrementStepper,
} from "@chakra-ui/react";
import { topupAccount } from "../../utils/api";
import { toDateInput } from "../../utils/dateInput";
import { MemoizedInput as Input, MemoizedSelect as Select } from "../memoizedinput/memoizedinput";

const TopupModal = ({
  isOpen,
  onClose,
  account,
  onTopupSuccess,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [topupForm, setTopupForm] = useState({
    amount: "",
    paymentMethod: "bank_transfer",
    paymentReference: "",
    paymentProof: "",
    notes: "",
    topupDate: toDateInput(new Date()),
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setTopupForm({
      ...topupForm,
      [name]: value,
    });
    if (error) setError("");
  };

  const handleAmountChange = (value) => {
    setTopupForm({
      ...topupForm,
      amount: value,
    });
    if (error) setError("");
  };

  const handleSubmit = async () => {
    if (!account) {
      setError("No account selected for topup");
      return;
    }

    const numericAmount = parseFloat(topupForm.amount);

    // Validate inputs
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError("Please enter a valid topup amount");
      return;
    }

    if (!topupForm.paymentMethod) {
      setError("Please select a payment method");
      return;
    }

    if (!topupForm.paymentReference || !topupForm.paymentReference.trim()) {
      setError("Please provide a payment reference or transaction ID");
      return;
    }

    const topupTimestamp = new Date(topupForm.topupDate).getTime();
    if (!Number.isFinite(topupTimestamp)) {
      setError("Please select a valid topup date");
      return;
    }

    setIsLoading(true);
    try {
      const payload = {
        customerId: account.customerCode || account.gatewayId || account.accountId,
        amount: numericAmount,
        paymentMethod: topupForm.paymentMethod,
        paymentReference: topupForm.paymentReference.trim(),
        paymentProof: topupForm.paymentProof,
        notes: topupForm.notes?.trim() || "",
        topupDate: topupTimestamp,
      };

      const response = await topupAccount(payload);

      if (response.success) {
        // Reset form
        setTopupForm({
          amount: "",
          paymentMethod: "bank_transfer",
          paymentReference: "",
          paymentProof: "",
          notes: "",
          topupDate: toDateInput(new Date()),
        });
        setError("");
        onTopupSuccess(response.newBalance);
        onClose();
      }
    } catch (err) {
      setError(err.message || "Failed to process topup");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg" scrollBehavior="inside">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader bg="blue.500" color="white" borderTopRadius="md">
          <Heading size="md">Account Topup</Heading>
        </ModalHeader>
        <ModalCloseButton color="white" isDisabled={isLoading} />
        <ModalBody py={6} maxH="70vh" overflowY="auto">
          <VStack spacing={4} align="stretch">
            {error && (
              <Alert status="error" borderRadius="md">
                <AlertIcon />
                {error}
              </Alert>
            )}

            {account && (
              <Box bg="blue.50" p={4} borderRadius="md">
                <Text fontSize="sm" color="gray.600">
                  <strong>Account:</strong>   {account.accountName}
                </Text>
                <Text fontSize="sm" color="gray.600">
                  <strong>Current Balance:</strong> ${parseFloat(account.balance || 0).toFixed(2)}
                </Text>
                <Text fontSize="sm" color="gray.600">
                  <strong>Account Type:</strong> Prepaid
                </Text>
              </Box>
            )}

            <FormControl isRequired>
              <FormLabel fontWeight="600" fontSize="sm">
                Topup Amount
              </FormLabel>
              <NumberInput
                value={topupForm.amount}
                onChange={handleAmountChange}
                min={0}
                step={0.01}
              >
                <NumberInputField placeholder="Enter topup amount" />
                <NumberInputStepper>
                  <NumberIncrementStepper />
                  <NumberDecrementStepper />
                </NumberInputStepper>
              </NumberInput>
            </FormControl>

            <FormControl isRequired>
              <FormLabel fontWeight="600" fontSize="sm">
                Payment Method
              </FormLabel>
              <Select
                name="paymentMethod"
                value={topupForm.paymentMethod}
                onChange={handleInputChange}
              >
                <option value="bank_transfer">Bank Transfer</option>
                <option value="usdt">USDT</option>
                <option value="credit_card">Credit Card</option>
                <option value="debit_card">Debit Card</option>
                <option value="paypal">PayPal</option>
                <option value="stripe">Stripe</option>
                <option value="cheque">Cheque</option>
                <option value="cash">Cash</option>
                <option value="other">Other</option>
              </Select>
            </FormControl>

            <FormControl isRequired>
              <FormLabel fontWeight="600" fontSize="sm">
                Payment Reference / Transaction ID
              </FormLabel>
              <Input
                type="text"
                name="paymentReference"
                placeholder="e.g., TXN-123456 or Cheque #9876"
                value={topupForm.paymentReference}
                onChange={handleInputChange}
              />
            </FormControl>

            {/* <FormControl>
              <FormLabel fontWeight="600" fontSize="sm">
                Payment Proof (Document Reference)
              </FormLabel>
              <Input
                type="text"
                name="paymentProof"
                placeholder="e.g., Bank receipt ID, Invoice #"
                value={topupForm.paymentProof}
                onChange={handleInputChange}
              />
            </FormControl> */}

            <FormControl isRequired>
              <FormLabel fontWeight="600" fontSize="sm">
                Topup Date
              </FormLabel>
              <Input
                type="date"
                name="topupDate"
                value={topupForm.topupDate}
                onChange={handleInputChange}
              />
            </FormControl>

            <FormControl>
              <FormLabel fontWeight="600" fontSize="sm">
                Notes
              </FormLabel>
              <Input
                type="text"
                name="notes"
                placeholder="Additional notes (optional)"
                value={topupForm.notes}
                onChange={handleInputChange}
              />
            </FormControl>

            <Box bg="blue.50" p={3} borderRadius="md">
              <Text fontSize="xs" color="gray.600">
                <strong>New Balance:</strong> ${(parseFloat(account?.balance || 0) + parseFloat(topupForm.amount || 0)).toFixed(2)}
              </Text>
            </Box>
          </VStack>
        </ModalBody>
        <ModalFooter gap={3} pt={4} borderTop="1px solid" borderTopColor="gray.200">
          <Button variant="outline" onClick={onClose} isDisabled={isLoading}>
            Cancel
          </Button>
          <Button
            colorScheme="blue"
            onClick={handleSubmit}
            isDisabled={!topupForm.amount || parseFloat(topupForm.amount) <= 0}
            isLoading={isLoading}
            loadingText="Processing..."
          >
            Confirm Topup
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default TopupModal;
