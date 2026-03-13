import { 
  Box, 
  Heading, 
  Text, 
  Button, 
  VStack,
  Icon,
  Container,
  useColorModeValue,
  Divider,
  HStack,
  Badge
} from "@chakra-ui/react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { FaLock, FaHome, FaArrowLeft, FaExclamationTriangle } from "react-icons/fa";

const Unauthorized = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  // Dynamic colors based on color mode
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const textColor = useColorModeValue('gray.600', 'gray.400');
  const iconColor = useColorModeValue('red.500', 'red.300');

  // Get the attempted path from location state or default to previous page
  const attemptedPath = location.state?.from?.pathname || 'this page';

  const handleGoBack = () => {
    if (window.history.length > 2) {
      navigate(-1);
    } else {
      navigate('/dashboard');
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <Container maxW="lg" py={6}>
      <Box
        p={8}
        bg={bgColor}
        borderRadius="xl"
        boxShadow="xl"
        border="1px"
        borderColor={borderColor}
        textAlign="center"
      >
        <VStack spacing={4}>
          {/* Lock Icon with Animation */}
          <Box position="relative">
            <Icon 
              as={FaLock} 
              w={20} 
              h={20} 
              color={iconColor}
              opacity={0.8}
            />
            <Icon
              as={FaExclamationTriangle}
              position="absolute"
              top={0}
              right={0}
              color="yellow.500"
              boxSize={6}
            />
          </Box>

          {/* Main Heading */}
          <VStack spacing={2}>
            <Heading 
              color={iconColor}
              fontSize="4xl"
              fontWeight="bold"
            >
              403
            </Heading>
            <Heading 
              size="lg"
              bgGradient="linear(to-r, red.500, orange.500)"
              bgClip="text"
            >
              Access Denied
            </Heading>
          </VStack>

          {/* User Info (if logged in) */}
          {user && (
            <Badge 
              colorScheme="blue" 
              px={3} 
              py={1} 
              borderRadius="full"
              fontSize="sm"
            >
              Logged in as: {user.email || user.username}
            </Badge>
          )}

          {/* Error Messages */}
          <VStack spacing={3} textAlign="center">
            <Text color={textColor} fontSize="lg">
              You don't have permission to view <strong>{attemptedPath}</strong>.
            </Text>
            
            <Text color={textColor} fontSize="md">
              This might be because:
            </Text>
            
            <VStack align="start" spacing={2} pl={4}>
              <Text color={textColor} fontSize="sm">
                • Your account doesn't have the required role
              </Text>
              <Text color={textColor} fontSize="sm">
                • You need additional permissions
              </Text>
              <Text color={textColor} fontSize="sm">
                • The resource is restricted to specific users
              </Text>
            </VStack>

            {user && (
              <Text color={textColor} fontSize="sm" fontStyle="italic" mt={2}>
                Current role: {user.role || 'Standard User'}
              </Text>
            )}
          </VStack>

          <Divider />

          {/* Action Buttons */}
          <VStack spacing={3} w="full">
            <Button
              leftIcon={<Icon as={FaHome} />}
              colorScheme="blue"
              size="lg"
              w="full"
              onClick={() => navigate('/dashboard')}
            >
              Go to Dashboard
            </Button>

            <HStack w="full" spacing={3}>
              <Button
                leftIcon={<Icon as={FaArrowLeft} />}
                variant="outline"
                colorScheme="blue"
                flex={1}
                onClick={handleGoBack}
              >
                Go Back
              </Button>

              {user && (
                <Button
                  variant="ghost"
                  colorScheme="red"
                  flex={1}
                  onClick={handleLogout}
                >
                  Logout
                </Button>
              )}
            </HStack>
          </VStack>

          {/* Contact Support Link */}
          <Text fontSize="sm" color={textColor}>
            Need help?{' '}
            <Button
              variant="link"
              colorScheme="blue"
              onClick={() => window.location.href = 'mailto:kt639539@gmail.com'}
            >
              Contact Support
            </Button>
          </Text>
        </VStack>
      </Box>
    </Container>
  );
};

export default Unauthorized;