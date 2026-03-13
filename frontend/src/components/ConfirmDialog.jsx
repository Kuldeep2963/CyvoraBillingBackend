import React from 'react';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  Button,
  Text,
  VStack,
  Icon,
} from '@chakra-ui/react';
import { FiAlertTriangle } from 'react-icons/fi';

const ConfirmDialog = ({
  isOpen,
  onClose,
  onConfirm,
  title = "Confirm Action",
  message = "Are you sure you want to proceed?",
  confirmText = "Confirm",
  cancelText = "Cancel",
  type = "danger", // 'danger', 'warning', 'info'
  isLoading = false,
}) => {
  const cancelRef = React.useRef();

  const getColorScheme = () => {
    switch (type) {
      case 'danger': return 'red';
      case 'warning': return 'orange';
      case 'info': return 'blue';
      default: return 'blue';
    }
  };

  const getIconColor = () => {
    switch (type) {
      case 'danger': return 'red.500';
      case 'warning': return 'orange.500';
      case 'info': return 'blue.500';
      default: return 'blue.500';
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} isCentered size="md">
      <ModalOverlay backdropFilter="blur(4px)" />
      <ModalContent borderRadius="xl">
        <ModalHeader borderBottomWidth="1px" py={4}>
          <Text fontSize="lg" fontWeight="bold">
            {title}
          </Text>
          <ModalCloseButton top={3} ref={cancelRef} />
        </ModalHeader>

        <ModalBody py={4}>
          <VStack spacing={4} align="center" textAlign="center">
            <Icon as={FiAlertTriangle} boxSize={12} color={getIconColor()} />
            <Text color="gray.600" fontSize="md">
              {message}
            </Text>
            <Text fontSize="sm" color="gray.500">
              This action cannot be undone.
            </Text>
          </VStack>
        </ModalBody>

        <ModalFooter bg="gray.50" borderBottomRadius="xl" py={3}>
          <Button 
            variant="ghost" 
            mr={3} 
            onClick={onClose} 
            size="sm"
            isDisabled={isLoading}
          >
            {cancelText}
          </Button>
          <Button
            colorScheme={getColorScheme()}
            onClick={onConfirm}
            size="sm"
            px={6}
            isLoading={isLoading}
            loadingText="Processing..."
          >
            {confirmText}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default ConfirmDialog;