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
  Input,
  Select,
  FormControl,
  FormLabel,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
} from "@chakra-ui/react";
import { FiFileText } from "react-icons/fi";

const GenerateInvoiceModal = ({
  isOpen,
  onClose,
  generateForm,
  setGenerateForm,
  customers,
  onGenerate,
}) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl" scrollBehavior="inside">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader borderTopRadius={"md"} bg={"blue.500"} borderBottomWidth="1px">
          <Heading size="md" color={"white"}>
            Generate New Invoice
          </Heading>
        </ModalHeader>
        <ModalCloseButton color={"white"} />

        <ModalBody>
          <VStack spacing={6} align="stretch">
            {/* Customer Selection */}
            <FormControl isRequired>
              <FormLabel>Select Customer</FormLabel>
              <Select
                placeholder="Choose a customer..."
                value={generateForm.customerId}
                onChange={(e) =>
                  setGenerateForm({
                    ...generateForm,
                    customerId: e.target.value,
                  })
                }
                size="md"
              >
                {customers.map((customer) => (
                  <option
                    key={customer.accountId}
                    value={
                      customer.gatewayId ||
                      customer.customerCode ||
                      customer.accountId
                    }
                  >
                    {customer.accountName} (
                    {customer.gatewayId || customer.customerCode})
                  </option>
                ))}
              </Select>
            </FormControl>

            {/* Billing Period */}
            <Box>
              <FormLabel>Billing Period</FormLabel>
              <HStack spacing={4}>
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
                  />
                </FormControl>
                <Text>to</Text>
                <FormControl isRequired>
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
                  />
                </FormControl>
              </HStack>
            </Box>

            {/* Billing Cycle */}
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
                size="md"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="annually">Annually</option>
              </Select>
            </FormControl>

            {/* Customer Preview */}
            {generateForm.customerId && (
              <Alert status="info" borderRadius="md">
                <AlertIcon />
                <Box>
                  <AlertTitle>Selected Customer</AlertTitle>
                  <AlertDescription>
                    {(() => {
                      const customer = customers.find(
                        (c) =>
                          c.gatewayId === generateForm.customerId ||
                          c.customerCode === generateForm.customerId ||
                          c.accountId === generateForm.customerId
                      );
                      return customer ? (
                        <VStack align="start" spacing={1}>
                          <Text>
                            <strong>Name:</strong> {customer.accountName}
                          </Text>
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
                        </VStack>
                      ) : null;
                    })()}
                  </AlertDescription>
                </Box>
              </Alert>
            )}
          </VStack>
        </ModalBody>
        <ModalFooter borderTopWidth="1px">
          <Button variant="outline" mr={3} onClick={onClose}>
            Cancel
          </Button>
          <Button
            colorScheme="blue"
            onClick={onGenerate}
            isDisabled={!generateForm.customerId}
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
