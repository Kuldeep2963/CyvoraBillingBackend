import React from "react";
import {
  Box,
  Heading,
  VStack,
  Text,
  Button,
  HStack,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  FormControl,
  FormLabel,
  Alert,
  AlertIcon,
  FormErrorMessage,
  AlertTitle,
  AlertDescription,
} from "@chakra-ui/react";
import { FiFileText } from "react-icons/fi";
import { MemoizedInput as Input, MemoizedSelect as Select } from "../memoizedinput/memoizedinput";
import {
  calculateNextBillingDate,
  currentBillingPeriodWindow,
  getAutoLastBillingDate,
} from "../../utils/billingDateUtils";

const pad2 = (value) => String(value).padStart(2, "0");

const toLocalDateInputValue = (value) => {
  if (!value) return "";

  const source = value instanceof Date ? value : new Date(String(value).slice(0, 10) + "T00:00:00");
  if (Number.isNaN(source.getTime())) return "";

  return `${source.getFullYear()}-${pad2(source.getMonth() + 1)}-${pad2(source.getDate())}`;
};

const GenerateInvoiceModal = ({
  isOpen,
  onClose,
  generateForm,
  setGenerateForm,
  customers,
  onGenerate,
  isSubmitting = false,
}) => {
  const buildBillingPeriodValues = (selectedAccount) => {
    const billingCycle = selectedAccount?.billingCycle || "monthly";
    const customerLastBillingDate =
      selectedAccount?.customerLastBillingDate ||
      selectedAccount?.lastbillingdate ||
      "";
    const customerNextBillingDate =
      selectedAccount?.customerNextBillingDate ||
      selectedAccount?.nextbillingdate ||
      "";

    if (customerLastBillingDate) {
      const window = currentBillingPeriodWindow(customerLastBillingDate, billingCycle);
      return {
        periodStart: window.periodStart || "",
        periodEnd: window.periodEnd || "",
      };
    }

    if (customerNextBillingDate) {
      const fallbackLastBillingDate = getAutoLastBillingDate(
        billingCycle,
        selectedAccount?.billingStartDate || selectedAccount?.createdAt || new Date(),
      );
      const window = currentBillingPeriodWindow(fallbackLastBillingDate, billingCycle);
      return {
        periodStart: window.periodStart || "",
        periodEnd: window.periodEnd || customerNextBillingDate,
      };
    }

    const referenceDate =
      selectedAccount?.billingStartDate ||
      selectedAccount?.createdAt ||
      new Date();
    const fallbackLastBillingDate = getAutoLastBillingDate(billingCycle, referenceDate);
    const window = currentBillingPeriodWindow(fallbackLastBillingDate, billingCycle);
    return {
      periodStart: window.periodStart || "",
      periodEnd: window.periodEnd || calculateNextBillingDate(fallbackLastBillingDate, billingCycle) || "",
    };
  };

  const getAccountSelectionValue = (account) => {
    return String(
      account.gatewayId ||
      account.customerCode ||
      account.accountId ||
      ""
    );
  };

  const getSelectedAccount = (selectionValue) => {
    const normalizedSelectionValue = String(selectionValue || "");

    return customers.find((account) => {
      // Only show customers
      if (!(account.accountRole === "customer" || account.accountRole === "both")) {
        return false;
      }
      return getAccountSelectionValue(account) === normalizedSelectionValue;
    });
  };

  const handleAccountChange = (selectionValue) => {
    const selectedAccount = getSelectedAccount(selectionValue);

    if (!selectedAccount) {
      setGenerateForm((prev) => ({
        ...prev,
        customerId: selectionValue,
        periodStart: "",
        periodEnd: "",
      }));
      return;
    }

    const { periodStart, periodEnd } = buildBillingPeriodValues(selectedAccount);

    setGenerateForm((prev) => ({
      ...prev,
      customerId: selectionValue,
      periodStart,
      periodEnd,
    }));
  };

  React.useEffect(() => {
    if (!generateForm.customerId || customers.length === 0) return;

    const selectedAccount = getSelectedAccount(generateForm.customerId);
    if (!selectedAccount) return;

    const nextValues = buildBillingPeriodValues(selectedAccount);

    if (
      nextValues.periodStart === generateForm.periodStart &&
      nextValues.periodEnd === generateForm.periodEnd
    ) {
      return;
    }

    setGenerateForm((prev) => ({
      ...prev,
      ...nextValues,
    }));
  }, [customers, generateForm.customerId, generateForm.periodStart, generateForm.periodEnd, setGenerateForm]);

  // Validation helper: check if period end date is not greater than today
  const getTodayDate = () => toLocalDateInputValue(new Date());
  const isEndDateInFuture = generateForm.periodEnd && generateForm.periodEnd > getTodayDate();
  const isStartAfterEnd = generateForm.periodStart && generateForm.periodEnd && generateForm.periodStart > generateForm.periodEnd;
  const hasDateError = isEndDateInFuture || isStartAfterEnd;
  const canSubmit = generateForm.customerId && !hasDateError && !isSubmitting;

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl" scrollBehavior="inside" closeOnOverlayClick={!isSubmitting}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader
          borderTopRadius={"md"}
          bg={"blue.500"}
          borderBottomWidth="1px"
        >
          <Heading size="md" color={"white"}>
            Generate New Invoice
          </Heading>
        </ModalHeader>
        <ModalCloseButton color={"white"} />

        <ModalBody>
          <VStack spacing={6} align="stretch">
            {/* Customer Selection */}
            <FormControl isRequired>
              <FormLabel fontWeight={"bold"} color={"blue.700"}>
                Select Customer
              </FormLabel>
              <Select
                placeholder="Choose a customer..."
                value={generateForm.customerId}
                onChange={(e) => handleAccountChange(e.target.value)}
                size="md"
                isDisabled={isSubmitting}
              >
                {customers
                  .filter((c) => {
                    return c.accountRole === "customer" || c.accountRole === "both";
                  })
                  .map((customer) => (
                    <option
                      key={customer.accountId}
                      value={getAccountSelectionValue(customer)}
                    >
                      {customer.accountName} (
                      {customer.customerCode || customer.gatewayId}
                      )
                    </option>
                  ))}
              </Select>
            </FormControl>

            {/* Billing Period */}
            <Box>
              <FormLabel fontWeight={"bold"} color={"blue.700"}>
                Billing Period
              </FormLabel>
              <HStack spacing={4} align="flex-start">
                <FormControl isRequired>
                  <Input
                    type="date"
                    value={generateForm.periodStart}
                    onChange={(e) =>
                      setGenerateForm({
                        ...generateForm,
                        periodStart: e.target.value,
                      })
                    }
                    size="md"
                    isDisabled={isSubmitting}
                  />
                </FormControl>
                <Text pt={2}>to</Text>
                <FormControl isRequired isInvalid={hasDateError}>
                  <Input
                    type="date"
                    value={generateForm.periodEnd}
                    onChange={(e) =>
                      setGenerateForm({
                        ...generateForm,
                        periodEnd: e.target.value,
                      })
                    }
                    size="md"
                    isDisabled={isSubmitting}
                  />
                </FormControl>
              </HStack>
              {isStartAfterEnd && (
                <Alert status="error" mt={2} borderRadius="md" variant="subtle">
                  <AlertIcon />
                  <Box>
                    {/* <AlertTitle fontSize="sm">Invalid Date Range</AlertTitle> */}
                    <AlertDescription fontSize="xs">The end date must be greater then start date.</AlertDescription>
                  </Box>
                </Alert>
              )}
              {isEndDateInFuture && (
                <Alert status="error" mt={2} borderRadius="md" variant="subtle">
                  <AlertIcon />
                  <Box>
                    {/* <AlertTitle fontSize="sm">Future Date Not Allowed</AlertTitle> */}
                    <AlertDescription fontSize="xs">The billing period end date cannot be greater than today.</AlertDescription>
                  </Box>
                </Alert>
              )}
            </Box>

          </VStack>
        </ModalBody>
        <ModalFooter borderTopWidth="1px">
          <Button variant="outline" mr={3} onClick={onClose} isDisabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            colorScheme="blue"
            onClick={onGenerate}
            isLoading={isSubmitting}
            loadingText="Generating..."
            isDisabled={!canSubmit}
            leftIcon={<FiFileText />}
            size="md"
          >
            Generate Invoice
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default GenerateInvoiceModal;
