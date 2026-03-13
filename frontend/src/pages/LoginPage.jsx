import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Button,
  Center,
  FormControl,
  FormLabel,
  Heading,
  Input,
  VStack,
  Text,
  Link,
  HStack,
  Icon,
  Divider,
  Checkbox,
  InputGroup,
  InputRightElement,
  Flex,
  Badge,
  Image,
  useToast,
} from "@chakra-ui/react";
import { keyframes } from "@emotion/react";
import {
  FaEnvelope,
  FaLock,
  FaEye,
  FaEyeSlash,
  FaGoogle,
  FaGithub,
  FaArrowRight,
} from "react-icons/fa";

// Animation keyframes
const float = keyframes`
  0% { transform: translateY(0px); }
  50% { transform: translateY(-10px); }
  100% { transform: translateY(0px); }
`;

const glow = keyframes`
  0% { box-shadow: 0 0 5px rgba(102, 126, 234, 0.2); }
  50% { box-shadow: 0 0 20px rgba(102, 126, 234, 0.6); }
  100% { box-shadow: 0 0 5px rgba(102, 126, 234, 0.2); }
`;

const LoginPage = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    rememberMe: false,
  });

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await login(formData.email, formData.password, formData.rememberMe);
      toast({
        title: "Login successful",
        status: "success",
        duration: 3000,
        isClosable: true,
      });
      navigate("/");
    } catch (error) {
      toast({
        title: "Login failed",
        description: error.message,
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Box minH="100vh" position="relative" overflow="hidden" bg="#000000">
      {/* Subtle animated background elements */}
      <Box
        position="absolute"
        top="-20%"
        right="-10%"
        width="600px"
        height="600px"
        borderRadius="full"
        bg="rgba(102, 126, 234, 0.15)"
        filter="blur(100px)"
        animation={`${float} 15s ease-in-out infinite`}
      />
      <Box
        position="absolute"
        bottom="-20%"
        left="-10%"
        width="700px"
        height="700px"
        borderRadius="full"
        bg="rgba(118, 75, 162, 0.15)"
        filter="blur(120px)"
        animation={`${float} 20s ease-in-out infinite reverse`}
      />

      {/* Tiny floating particles */}
      {[...Array(15)].map((_, i) => (
        <Box
          key={i}
          position="absolute"
          top={`${Math.random() * 100}%`}
          left={`${Math.random() * 100}%`}
          width="2px"
          height="2px"
          borderRadius="full"
          bg="rgba(255, 255, 255, 0.3)"
          animation={`${float} ${Math.random() * 10 + 15}s ease-in-out infinite`}
          style={{
            animationDelay: `${Math.random() * 5}s`,
          }}
        />
      ))}

      {/* Main Content - Login Box Only */}
      <Center minH="100vh" position="relative" zIndex={1} p={4}>
        <Box
          maxW="450px"
          width="100%"
          bg="rgba(10, 10, 10, 0.95)"
          backdropFilter="blur(10px)"
          borderRadius="2xl"
          overflow="hidden"
          boxShadow="0 20px 50px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.05)"
          position="relative"
          animation={`${glow} 4s ease-in-out infinite`}
          border="1px solid rgba(255, 255, 255, 0.03)"
        >
          {/* Subtle gradient overlay */}
          <Box
            position="absolute"
            top="0"
            left="0"
            right="0"
            height="200px"
            bg="linear-gradient(180deg, rgba(102, 126, 234, 0.1) 0%, transparent 100%)"
            pointerEvents="none"
          />

          {/* Content */}
          <Box p={10}>
            <VStack spacing={6} align="stretch">
              {/* Header */}
              <VStack spacing={2} mb={4}>
                <Image
                  src="./pai-telecom-logo.png" // Replace with your image path
                  alt="CDR Billing Logo"
                  height="60px" // Adjust as needed
                  width="auto"
                  objectFit="contain"
                />
                <Text color="gray.500" fontSize="sm">
                  Welcome back! Please sign in to continue
                </Text>
              </VStack>

              {/* Form */}
              <form onSubmit={handleSubmit} style={{ width: "100%" }}>
                <VStack spacing={5}>
                  <FormControl isRequired>
                    <FormLabel
                      color="gray.400"
                      fontWeight="medium"
                      fontSize="sm"
                    >
                      Email
                    </FormLabel>
                    <InputGroup size="md">
                      <Input
                        name="email"
                        type="email"
                        value={formData.email}
                        onChange={handleChange}
                        placeholder="Enter email..."
                        bg="rgba(0, 0, 0, 0.5)"
                        border="1px solid"
                        borderColor="rgba(255, 255, 255, 0.1)"
                        color="white"
                        _hover={{ borderColor: "#667eea" }}
                        _focus={{
                          borderColor: "#764ba2",
                          boxShadow: "0 0 0 3px rgba(102, 126, 234, 0.2)",
                          bg: "rgba(0, 0, 0, 0.7)",
                          outline: "none",
                        }}
                        pl={10}
                        transition="all 0.2s"
                      />
                      <Icon
                        as={FaEnvelope}
                        position="absolute"
                        left={3}
                        top="50%"
                        transform="translateY(-50%)"
                        color={formData.email ? "#667eea" : "gray.600"}
                        zIndex={2}
                        transition="color 0.2s"
                      />
                    </InputGroup>
                  </FormControl>

                  <FormControl isRequired>
                    <FormLabel
                      color="gray.400"
                      fontWeight="medium"
                      fontSize="sm"
                    >
                      Password
                    </FormLabel>
                    <InputGroup size="md">
                      <Input
                        name="password"
                        type={showPassword ? "text" : "password"}
                        value={formData.password}
                        onChange={handleChange}
                        placeholder="Enter your password"
                        bg="rgba(0, 0, 0, 0.5)"
                        border="1px solid"
                        borderColor="rgba(255, 255, 255, 0.1)"
                        color="white"
                        _hover={{ borderColor: "#667eea" }}
                        _focus={{
                          borderColor: "#764ba2",
                          boxShadow: "0 0 0 3px rgba(102, 126, 234, 0.2)",
                          bg: "rgba(0, 0, 0, 0.7)",
                          outline: "none",
                        }}
                        pl={10}
                        transition="all 0.2s"
                      />
                      <Icon
                        as={FaLock}
                        position="absolute"
                        left={3}
                        top="50%"
                        transform="translateY(-50%)"
                        color={formData.password ? "#667eea" : "gray.600"}
                        zIndex={2}
                        transition="color 0.2s"
                      />
                      <InputRightElement h="full">
                        <Button
                          variant="ghost"
                          onClick={() => setShowPassword(!showPassword)}
                          size="sm"
                          _hover={{ bg: "transparent" }}
                          _active={{ bg: "transparent" }}
                        >
                          <Icon
                            as={showPassword ? FaEyeSlash : FaEye}
                            color="gray.500"
                            boxSize={5}
                          />
                        </Button>
                      </InputRightElement>
                    </InputGroup>
                  </FormControl>

                  <Flex justify="space-between" align="center" width="full">
                    <Checkbox
                      name="rememberMe"
                      isChecked={formData.rememberMe}
                      onChange={handleChange}
                      colorScheme="purple"
                      size="md"
                      borderColor="rgba(255, 255, 255, 0.2)"
                    >
                      <Text color="gray.400" fontSize="sm">
                        Remember me
                      </Text>
                    </Checkbox>
                    <Link
                      color="#667eea"
                      fontSize="sm"
                      fontWeight="medium"
                      _hover={{ color: "#764ba2", textDecoration: "none" }}
                    >
                      Forgot password?
                    </Link>
                  </Flex>

                  <Button
                    type="submit"
                    bgGradient="linear(to-r, #667eea, #764ba2)"
                    color="white"
                    width="full"
                    size="lg"
                    fontSize="md"
                    isLoading={isLoading}
                    loadingText="Signing in"
                    _hover={{
                      bgGradient: "linear(to-r, #764ba2, #667eea)",
                      transform: "translateY(-2px)",
                      boxShadow: "0 10px 30px -5px rgba(102, 126, 234, 0.5)",
                    }}
                    _active={{
                      transform: "translateY(0)",
                    }}
                    transition="all 0.3s"
                    rightIcon={<Icon as={FaArrowRight} />}
                    position="relative"
                    overflow="hidden"
                    mt={4}
                  >
                    Sign In
                  </Button>
                </VStack>
              </form>
            </VStack>
          </Box>
        </Box>
      </Center>
    </Box>
  );
};

export default LoginPage;
