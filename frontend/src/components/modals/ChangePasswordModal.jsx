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
  FormErrorMessage,
  Alert,
  AlertIcon,
  InputGroup,
  InputRightElement,
  Icon,
  useToast,
  HStack,
  Box,
  Text,
} from "@chakra-ui/react";
import { MemoizedInput as Input } from "../memoizedinput/memoizedinput";
import { FiEye, FiEyeOff } from "react-icons/fi";

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const ChangePasswordModal = ({ isOpen, onClose }) => {
  const toast = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  
  const [formData, setFormData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [errors, setErrors] = useState({});

  const validateForm = () => {
    const newErrors = {};

    if (!formData.currentPassword.trim()) {
      newErrors.currentPassword = "Current password is required";
    }

    if (!formData.newPassword.trim()) {
      newErrors.newPassword = "New password is required";
    } else if (formData.newPassword.length < 8) {
      newErrors.newPassword = "Password must be at least 8 characters";
    }

    if (!formData.confirmPassword.trim()) {
      newErrors.confirmPassword = "Please confirm your new password";
    } else if (formData.newPassword !== formData.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }

    if (formData.currentPassword === formData.newPassword) {
      newErrors.newPassword = "New password must be different from current password";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      toast({
        title: "Validation Error",
        description: "Please fix the errors above",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    setIsLoading(true);
    setSuccessMessage("");

    try {
      const response = await fetch(`${API_BASE_URL}/auth/change-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ sessionStorage.getItem("token") ||localStorage.getItem("token")}`,
        },
        body: JSON.stringify({
          currentPassword: formData.currentPassword,
          newPassword: formData.newPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast({
          title: "Error",
          description: data.error || "Failed to change password",
          status: "error",
          duration: 4000,
          isClosable: true,
        });
        return;
      }

      setSuccessMessage("Password changed successfully!");
      toast({
        title: "Success",
        description: "Your password has been changed successfully",
        status: "success",
        duration: 4000,
        isClosable: true,
      });

      // Clear form after 1.5 seconds
      setTimeout(() => {
        resetForm();
        onClose();
      }, 1500);
    } catch (error) {
      console.error("Error changing password:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to change password",
        status: "error",
        duration: 4000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    });
    setErrors({});
    setSuccessMessage("");
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    // Clear error for this field as user types
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ""
      }));
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} isCentered size="md">
      <ModalOverlay backdropFilter="blur(4px)" />
      <ModalContent borderRadius="xl">
        <ModalHeader borderTopRadius={"lg "} borderBottomWidth="1px" py={4} bg={"blue.500"}>
          <Text fontSize="lg" color={"white"} fontWeight="bold">
            Change Password
          </Text>
          <ModalCloseButton color={"white"} />
        </ModalHeader>

        <ModalBody py={6}>
          <VStack spacing={4} align="stretch">
            {successMessage && (
              <Alert status="success" borderRadius="lg" bg="green.50" borderLeft="4px solid" borderColor="green.500">
                <AlertIcon />
                <Box>
                  <Text fontWeight="600" color="green.800">{successMessage}</Text>
                </Box>
              </Alert>
            )}

            <FormControl isInvalid={!!errors.currentPassword}>
              <FormLabel fontSize="sm" fontWeight="600" color="gray.700">
                Current Password
              </FormLabel>
              <InputGroup>
                <Input
                  type={showCurrentPassword ? "text" : "password"}
                  placeholder="Enter your current password"
                  value={formData.currentPassword}
                  onChange={(e) => handleChange("currentPassword", e.target.value)}
                  borderRadius="lg"
                  fontSize="sm"
                  _focus={{ borderColor: "blue.400", boxShadow: "0 0 0 1px var(--chakra-colors-blue-400)" }}
                  disabled={isLoading || !!successMessage}
                />
                <InputRightElement>
                  <Icon
                    as={showCurrentPassword ? FiEyeOff : FiEye}
                    color="gray.400"
                    cursor="pointer"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    _hover={{ color: "gray.600" }}
                  />
                </InputRightElement>
              </InputGroup>
              <FormErrorMessage fontSize="xs">{errors.currentPassword}</FormErrorMessage>
            </FormControl>

            <FormControl isInvalid={!!errors.newPassword}>
              <FormLabel fontSize="sm" fontWeight="600" color="gray.700">
                New Password
              </FormLabel>
              <InputGroup>
                <Input
                  type={showNewPassword ? "text" : "password"}
                  placeholder="Enter your new password (min. 8 characters)"
                  value={formData.newPassword}
                  onChange={(e) => handleChange("newPassword", e.target.value)}
                  borderRadius="lg"
                  fontSize="sm"
                  _focus={{ borderColor: "blue.400", boxShadow: "0 0 0 1px var(--chakra-colors-blue-400)" }}
                  disabled={isLoading || !!successMessage}
                />
                <InputRightElement>
                  <Icon
                    as={showNewPassword ? FiEyeOff : FiEye}
                    color="gray.400"
                    cursor="pointer"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    _hover={{ color: "gray.600" }}
                  />
                </InputRightElement>
              </InputGroup>
              <FormErrorMessage fontSize="xs">{errors.newPassword}</FormErrorMessage>
            </FormControl>

            <FormControl isInvalid={!!errors.confirmPassword}>
              <FormLabel fontSize="sm" fontWeight="600" color="gray.700">
                Confirm New Password
              </FormLabel>
              <InputGroup>
                <Input
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Confirm your new password"
                  value={formData.confirmPassword}
                  onChange={(e) => handleChange("confirmPassword", e.target.value)}
                  borderRadius="lg"
                  fontSize="sm"
                  _focus={{ borderColor: "blue.400", boxShadow: "0 0 0 1px var(--chakra-colors-blue-400)" }}
                  disabled={isLoading || !!successMessage}
                />
                <InputRightElement>
                  <Icon
                    as={showConfirmPassword ? FiEyeOff : FiEye}
                    color="gray.400"
                    cursor="pointer"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    _hover={{ color: "gray.600" }}
                  />
                </InputRightElement>
              </InputGroup>
              <FormErrorMessage fontSize="xs">{errors.confirmPassword}</FormErrorMessage>
            </FormControl>

            {/* <Alert status="info" borderRadius="lg" bg="blue.50" borderLeft="4px solid" borderColor="blue.500" mt={2}>
              <AlertIcon />
              <Box fontSize="xs" color="blue.800">
                <Text fontWeight="600">Password Requirements:</Text>
                <Text mt={1}>• Minimum 8 characters</Text>
                <Text>• Must be different from your current password</Text>
              </Box>
            </Alert> */}
          </VStack>
        </ModalBody>

        <ModalFooter bg="gray.50" borderBottomRadius="xl" py={3}>
          <HStack spacing={3}>
            <Button
              variant="ghost"
              onClick={handleClose}
              isDisabled={isLoading || !!successMessage}
              size="sm"
            >
              Cancel
            </Button>
            <Button
              colorScheme="blue"
              onClick={handleSubmit}
              isLoading={isLoading}
              loadingText="Changing..."
              size="sm"
              px={6}
              isDisabled={!!successMessage}
            >
              Change Password
            </Button>
          </HStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default ChangePasswordModal;
