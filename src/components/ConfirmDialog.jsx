import React from 'react';
import {
  AlertDialog,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogOverlay,
  Button,
  Text,
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
    <AlertDialog
      isOpen={isOpen}
      leastDestructiveRef={cancelRef}
      onClose={onClose}
      isCentered
    >
      <AlertDialogOverlay>
        <AlertDialogContent>
          <AlertDialogHeader fontSize="lg" fontWeight="bold" display="flex" alignItems="center">
            <Icon as={FiAlertTriangle} mr={2} color={getIconColor()} />
            {title}
          </AlertDialogHeader>

          <AlertDialogBody>
            <Text>{message}</Text>
            <Text fontSize="sm" color="gray.500" mt={2}>
              This action cannot be undone.
            </Text>
          </AlertDialogBody>

          <AlertDialogFooter>
            <Button ref={cancelRef} onClick={onClose} isDisabled={isLoading}>
              {cancelText}
            </Button>
            <Button
              colorScheme={getColorScheme()}
              onClick={onConfirm}
              ml={3}
              isLoading={isLoading}
              loadingText="Processing..."
            >
              {confirmText}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialogOverlay>
    </AlertDialog>
  );
};

export default ConfirmDialog;