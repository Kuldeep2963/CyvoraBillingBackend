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
  Textarea,
  Box,
  Text,
  Badge,
  useToast,
  Heading,
} from "@chakra-ui/react";
import { raiseDispute } from "../../utils/api";

const RaiseDisputeModal = ({
  isOpen,
  onClose,
  selectedAccount,
  mismatchedCount,
  invoiceNumbers,
  disputeAmount,
  onSuccess,
}) => {
  const toast = useToast();
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!comment.trim()) {
      toast({
        title: "Comment required",
        description: "Please provide a reason for the dispute.",
        status: "warning",
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    if (!selectedAccount?.customerCode) {
      toast({
        title: "Error",
        description: "No customer code found for this account.",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await raiseDispute({
        customerId: selectedAccount.customerCode,
        comment,
        mismatchedCount,
        invoiceNumber: invoiceNumbers,
        disputeAmount,
      });

      setIsSubmitting(false);
      toast({
        title: "Dispute Raised",
        description: `A dispute has been initiated for ${mismatchedCount} mismatched invoices for ${selectedAccount?.accountName}. Notification sent to admin.`,
        status: "success",
        duration: 5000,
        isClosable: true,
      });
      setComment("");
      if (onSuccess) onSuccess();
      onClose();
    } catch (error) {
      setIsSubmitting(false);
      toast({
        title: "Error",
        description: error.message || "Failed to raise dispute. Please try again.",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader bg="blue.500" color="white" borderTopRadius="md">
          <Heading size="md">Raise Dispute</Heading>
        </ModalHeader>
        <ModalCloseButton color="white" />
        <ModalBody py={6}>
          <VStack spacing={4} align="stretch">
            <Box>
              <Text fontWeight="bold" mb={1} color="gray.700">Account</Text>
              <Text color="gray.600" fontSize="md">{selectedAccount?.accountName}</Text>
            </Box>
            <Box>
              <Text fontWeight="bold" mb={1} color="gray.700">Disputed Invoices</Text>
              <Badge colorScheme="red" fontSize="sm" px={2} py={1} borderRadius="md">
                {mismatchedCount} Mismatches detected
              </Badge>
              {invoiceNumbers && (
                <Box mt={2} p={2} bg="gray.50" borderRadius="md" maxH="120px" overflowY="auto">
                  <Text fontSize="xs" color="gray.600" whiteSpace="pre-wrap" fontFamily="mono">
                    {invoiceNumbers}
                  </Text>
                </Box>
              )}
              {disputeAmount > 0 && (
                <Text fontSize="sm" color="red.600" fontWeight="bold" mt={2}>
                  Total Disputed Amount: ${disputeAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                </Text>
              )}
            </Box>
            <FormControl isRequired>
              <FormLabel fontWeight="bold" color="gray.700">Reason for Dispute</FormLabel>
              <Textarea
                placeholder="Please provide details about why you are raising this dispute (e.g., amount mismatch, date errors, missing data)..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                minH="150px"
                focusBorderColor="green.500"
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
            onClick={handleSubmit}
            isLoading={isSubmitting}
            isDisabled={!comment.trim() || isSubmitting}
          >
            Submit Dispute
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default RaiseDisputeModal;
