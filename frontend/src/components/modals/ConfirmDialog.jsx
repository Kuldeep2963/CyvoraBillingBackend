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
  HStack,
  Icon,
} from '@chakra-ui/react';
import { FiAlertTriangle, FiAlertCircle, FiInfo } from 'react-icons/fi';

const TYPE_CONFIG = {
  danger: {
    colorScheme: 'red',
    iconColor: 'red.500',
    icon: FiAlertTriangle,
    headerBorder: 'red.100',
  },
  warning: {
    colorScheme: 'orange',
    iconColor: 'orange.500',
    icon: FiAlertCircle,
    headerBorder: 'orange.100',
  },
  info: {
    colorScheme: 'blue',
    iconColor: 'blue.500',
    icon: FiInfo,
    headerBorder: 'blue.100',
  },
};

const ConfirmDialog = ({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirm Action',
  message = 'Are you sure you want to proceed?',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'danger',
  isLoading = false,
  showWarningNote = true,        // only shown for danger/warning by default
  warningNote = 'This action cannot be undone.',
}) => {
  const cancelRef = React.useRef();
  const bodyId = React.useId();
  const config = TYPE_CONFIG[type] ?? TYPE_CONFIG.info;

  // Allow Enter key to confirm when dialog is open
  React.useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e) => {
      if (e.key === 'Enter' && !isLoading) onConfirm();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, isLoading, onConfirm]);

  const shouldShowNote =
    showWarningNote && warningNote && type !== 'info';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      isCentered
      size="md"
      aria-describedby={bodyId}
      closeOnOverlayClick={!isLoading}
    >
      <ModalOverlay bg="blackAlpha.400" />
      <ModalContent borderRadius="xl" overflow="hidden" boxShadow="xl">

        {/* ── Header ── */}
        <ModalHeader
          display="flex"
          alignItems="center"
          justifyContent="space-between"
          borderBottomWidth="1px"
          borderColor="gray.100"
          py={4}
          px={5}
        >
          <Text fontSize="md" fontWeight="semibold" color="gray.800">
            {title}
          </Text>
          {/* CloseButton outside title flow — no overlap */}
          <ModalCloseButton
            position="relative"
            top="unset"
            right="unset"
            size="sm"
            isDisabled={isLoading}
          />
        </ModalHeader>

        {/* ── Body ── */}
        <ModalBody id={bodyId} py={6} px={5}>
          <VStack spacing={3} align="center" textAlign="center">
            <Icon
              as={config.icon}
              boxSize={10}
              color={config.iconColor}
              aria-hidden="true"
            />
            <Text color="gray.700" fontSize="sm" lineHeight="tall">
              {message}
            </Text>
            {shouldShowNote && (
              <Text fontSize="xs" color="gray.400" fontWeight="medium">
                {warningNote}
              </Text>
            )}
          </VStack>
        </ModalBody>

        {/* ── Footer ── */}
        <ModalFooter borderTopWidth="1px" borderColor="gray.100" py={3} px={5}>
          <HStack spacing={2} justify="flex-end" w="full">
            <Button
              ref={cancelRef}        // focus trap lands here — correct a11y target
              variant="ghost"
              size="sm"
              onClick={onClose}
              isDisabled={isLoading}
              color="gray.600"
              _hover={{ bg: 'gray.100' }}
            >
              {cancelText}
            </Button>
            <Button
              colorScheme={config.colorScheme}
              size="sm"
              px={5}
              onClick={onConfirm}
              isLoading={isLoading}
              isDisabled={isLoading}
              loadingText="Processing…"
            >
              {confirmText}
            </Button>
          </HStack>
        </ModalFooter>

      </ModalContent>
    </Modal>
  );
};

export default ConfirmDialog;