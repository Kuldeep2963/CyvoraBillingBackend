import { 
  Box, 
  Heading, 
  Text, 
  Button, 
  VStack,
  Icon,
  Container,
  useColorModeValue,
  HStack,
  ScaleFade
} from "@chakra-ui/react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
// Swapped to Feather Icons (fi) for a much cleaner, minimal look
import { FiLock, FiHome, FiArrowLeft, FiLogOut } from "react-icons/fi";

const Unauthorized = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  // Minimal, sophisticated color palette
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.100', 'gray.700');
  const mutedText = useColorModeValue('gray.500', 'gray.400');
  const headingColor = useColorModeValue('gray.800', 'white');
  const iconBg = useColorModeValue('gray.50', 'gray.700');
  
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
    navigate('/', { replace: true });
  };

  return (
    <Container maxW="md" py={12}>
      {/* ScaleFade provides a smooth, subtle entry animation */}
      <ScaleFade initialScale={0.95} in={true}>
        <Box
          p={8}
          bg={bgColor}
          borderRadius="2xl"
          boxShadow="sm"
          border="1px solid"
          borderColor={borderColor}
          textAlign="center"
        >
          <VStack spacing={6}>
            
            {/* Minimal Icon Container */}
            <Box 
              p={4} 
              bg={iconBg} 
              borderRadius="full"
              color={mutedText}
            >
              <Icon as={FiLock} w={8} h={8} strokeWidth={1.5} />
            </Box>

            {/* Clean Typography */}
            <VStack spacing={2}>
              <Heading size="md" color={headingColor} fontWeight="600">
                Access Restricted
              </Heading>
              <Text color={mutedText} fontSize="sm" px={4}>
                You don't have the necessary permissions to view <strong>{attemptedPath}</strong>. 
                Please contact your administrator if you believe this is a mistake.
              </Text>
            </VStack>

            {/* Optional: Minimal User Context */}
            {user && (
              <Box 
                bg={iconBg} 
                px={4} 
                py={2} 
                borderRadius="md" 
                w="full"
                fontSize="xs"
                color={mutedText}
              >
                Signed in as <strong>{user.email || user.username}</strong> 
                {user.role && ` • ${user.role}`}
              </Box>
            )}

            {/* Restructured, Industry-Standard Buttons */}
            <VStack spacing={3} w="full" pt={2}>
              <Button
                leftIcon={<Icon as={FiHome} />}
                colorScheme="blue"
                variant="solid"
                size="md"
                w="full"
                onClick={() => navigate('/dashboard')}
                fontWeight="500"
              >
                Return to Dashboard
              </Button>

              <HStack w="full" spacing={3}>
                <Button
                  leftIcon={<Icon as={FiArrowLeft} />}
                  variant="outline"
                  size="md"
                  flex={1}
                  onClick={handleGoBack}
                  fontWeight="500"
                  color={mutedText}
                >
                  Go Back
                </Button>

                {user && (
                  <Button
                    leftIcon={<Icon as={FiLogOut} />}
                    variant="ghost"
                    size="md"
                    flex={1}
                    onClick={handleLogout}  
                    fontWeight="500"
                    color={mutedText}
                    _hover={{ bg: 'red.50', color: 'red.500' }}
                  >
                    Logout
                  </Button>
                )}
              </HStack>
            </VStack>
          </VStack>
        </Box>
      </ScaleFade>
    </Container>
  );
};

export default Unauthorized;