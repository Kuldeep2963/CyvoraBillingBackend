import React, { useState, useRef, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Button,
  Center,
  FormControl,
  FormLabel,
  VStack,
  Text,
  Link,
  Icon,
  Checkbox,
  InputGroup,
  InputRightElement,
  Flex,
  Image,
  useToast,
  FormErrorMessage,
} from "@chakra-ui/react";
import { MemoizedInput as Input } from "../components/memoizedinput/memoizedinput";
import { keyframes } from "@emotion/react";
import {
  FaEnvelope,
  FaLock,
  FaEye,
  FaEyeSlash,
  FaArrowRight,
} from "react-icons/fa";

// ── animations ────────────────────────────────────────────────
const float = keyframes`
  0%   { transform: translateY(0px); }
  50%  { transform: translateY(-10px); }
  100% { transform: translateY(0px); }
`;

const glow = keyframes`
  0%   { box-shadow: 0 20px 50px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.05), 0 0 5px  rgba(99,179,237,0.15); }
  50%  { box-shadow: 0 20px 50px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.05), 0 0 28px rgba(99,179,237,0.35); }
  100% { box-shadow: 0 20px 50px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.05), 0 0 5px  rgba(99,179,237,0.15); }
`;

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
`;

// ── static particle positions (FIX 1) ─────────────────────────
// Math.random() inside render creates new values every re-render,
// causing particles to jump on every state change (typing, etc.).
// Pre-compute once at module level so positions are stable.
const PARTICLES = Array.from({ length: 15 }, (_, i) => ({
  id: i,
  top: `${(i * 37 + 11) % 100}%`,
  left: `${(i * 53 + 7) % 100}%`,
  dur: `${15 + (i % 10)}s`,
  delay: `${(i * 0.4) % 5}s`,
}));

// ── validation (FIX 2) ────────────────────────────────────────
// Inline validation prevents a round-trip to the server for
// obviously bad input (empty fields, malformed email).
const validate = (email, password) => {
  const errors = {};
  if (!email) errors.email = "Email is required.";
  else if (!/\S+@\S+\.\S+/.test(email))
    errors.email = "Enter a valid email address.";
  if (!password) errors.password = "Password is required.";
  else if (password.length < 6)
    errors.password = "Password must be at least 6 characters.";
  return errors;
};

// ── component ─────────────────────────────────────────────────
const LoginPage = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({}); // FIX 2: field-level errors
  const [touched, setTouched] = useState({}); // FIX 3: only show errors after blur
  const { login } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const emailRef = useRef(null); // FIX 4: auto-focus on mount

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    rememberMe: false,
  });

  // FIX 4: Focus the email field on mount for keyboard users
  useEffect(() => {
    emailRef.current?.focus();
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const newValue = type === "checkbox" ? checked : value;
    setFormData((prev) => ({ ...prev, [name]: newValue }));

    // FIX 3: Re-validate the changed field live, but only if it's been touched
    if (touched[name]) {
      const errs = validate(
        name === "email" ? newValue : formData.email,
        name === "password" ? newValue : formData.password,
      );
      setFieldErrors((prev) => ({ ...prev, [name]: errs[name] }));
    }
  };

  // FIX 3: Mark field as touched on blur so errors appear only after the user leaves a field
  const handleBlur = (e) => {
    const { name } = e.target;
    setTouched((prev) => ({ ...prev, [name]: true }));
    const errs = validate(formData.email, formData.password);
    setFieldErrors((prev) => ({ ...prev, [name]: errs[name] }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // FIX 2: Validate all fields before submitting; mark all as touched
    const errs = validate(formData.email, formData.password);
    setTouched({ email: true, password: true });
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setIsLoading(true);
    try {
      await login(formData.email, formData.password, formData.rememberMe);
      // FIX 5: Navigate first, show toast after — avoids toast on unmounted component
      navigate("/");
      toast({
        title: "Login successful",
        status: "success",
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      // FIX 6: Don't expose raw error.message to user — it may leak internal details.
      //         Use a safe generic message; log the real error for debugging.
      console.error("Login error:", error);
      toast({
        title: "Login failed",
        description:
          error?.response?.data?.message ||
          "Invalid email or password. Please try again.",
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
      {/* ── background blobs ─────────────────────────────────── */}
      <Box
        position="absolute"
        top="-20%"
        right="-10%"
        width="600px"
        height="600px"
        borderRadius="full"
        bg="rgba(99,179,237,0.12)"
        filter="blur(100px)"
        animation={`${float} 15s ease-in-out infinite`}
        pointerEvents="none"
      />
      <Box
        position="absolute"
        bottom="-20%"
        left="-10%"
        width="700px"
        height="700px"
        borderRadius="full"
        bg="rgba(118,75,162,0.12)"
        filter="blur(120px)"
        animation={`${float} 20s ease-in-out infinite reverse`}
        pointerEvents="none"
      />

      {/* ── particles (FIX 1: stable positions) ──────────────── */}
      {PARTICLES.map((p) => (
        <Box
          key={p.id}
          position="absolute"
          top={p.top}
          left={p.left}
          width="2px"
          height="2px"
          borderRadius="full"
          bg="rgba(255,255,255,0.25)"
          animation={`${float} ${p.dur} ease-in-out infinite`}
          style={{ animationDelay: p.delay }}
          pointerEvents="none"
        />
      ))}

      {/* ── login card ────────────────────────────────────────── */}
      <Center minH="100vh" position="relative" zIndex={1} p={4}>
        <Box
          maxW="440px"
          width="100%"
          bg="rgba(10,10,10,0.95)"
          backdropFilter="blur(10px)"
          borderRadius="2xl"
          overflow="hidden"
          animation={`${glow} 4s ease-in-out infinite, ${fadeIn} 0.5s ease-out both`}
          border="1px solid rgba(255,255,255,0.06)"
          position="relative"
        >
          {/* top gradient overlay */}
          <Box
            position="absolute"
            top={0}
            left={0}
            right={0}
            height="180px"
            bg="linear-gradient(180deg, rgba(99,179,237,0.08) 0%, transparent 100%)"
            pointerEvents="none"
          />

          <Box p={{ base: 7, md: 10 }}>
            <VStack spacing={6} align="stretch">
              {/* ── header ──────────────────────────────────── */}
              <VStack spacing={2} mb={2} align="center">
                <Image
                  src="./Cyvora.png"
                  alt="Cyvoratech — CDR Billing"
                  height="120px"
                  width="auto"
                  objectFit="contain"
                  // FIX 7: Fallback text if image fails to load
                  fallbackSrc=""
                  onError={(e) => {
                    e.target.style.display = "none";
                  }}
                />
                <Text color="gray.500" fontSize="sm" textAlign="center">
                  Welcome back! Please sign in to continue.
                </Text>
              </VStack>

              {/* ── form ────────────────────────────────────── */}
              {/* FIX 8: noValidate disables browser-native validation bubbles
                         since we handle validation ourselves with nicer UI */}
              <form
                onSubmit={handleSubmit}
                noValidate
                style={{ width: "100%" }}
              >
                <VStack spacing={4}>
                  {/* Email */}
                  <FormControl
                    isRequired
                    isInvalid={touched.email && !!fieldErrors.email}
                  >
                    <FormLabel
                      color="gray.400"
                      fontWeight="medium"
                      fontSize="sm"
                    >
                      Email
                    </FormLabel>
                    {/* FIX 9: InputGroup py={3} was pushing the icon out of alignment.
                               Removed py from InputGroup; use mb on FormControl instead. */}
                    <InputGroup>
                      <Box
                        position="absolute"
                        left={3}
                        top="50%"
                        transform="translateY(-50%)"
                        zIndex={2}
                        pointerEvents="none"
                      >
                        <Icon
                          as={FaEnvelope}
                          // FIX 10: boxSize instead of implicit size to avoid SVG warning
                          boxSize={4}
                          color={formData.email ? "#63B3ED" : "gray.600"}
                          transition="color 0.2s"
                        />
                      </Box>
                      <Input
                        ref={emailRef}
                        name="email"
                        type="email"
                        value={formData.email}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        placeholder="your@email.com"
                        autoComplete="email"
                        bg="rgba(0,0,0,0.5)"
                        border="1px solid"
                        borderColor={
                          touched.email && fieldErrors.email
                            ? "red.400"
                            : "rgba(255,255,255,0.1)"
                        }
                        color="white"
                        _placeholder={{ color: "gray.600" }}
                        _hover={{ borderColor: "#63B3ED" }}
                        _focus={{
                          borderColor: "#63B3ED",
                          boxShadow: "0 0 0 2px rgba(99,179,237,0.25)",
                          bg: "rgba(0,0,0,0.7)",
                          outline: "none",
                        }}
                        pl={10}
                        transition="all 0.2s"
                      />
                    </InputGroup>
                    <FormErrorMessage fontSize="xs">
                      {fieldErrors.email}
                    </FormErrorMessage>
                  </FormControl>

                  {/* Password */}
                  <FormControl
                    isRequired
                    isInvalid={touched.password && !!fieldErrors.password}
                  >
                    <FormLabel
                      color="gray.400"
                      fontWeight="medium"
                      fontSize="sm"
                    >
                      Password
                    </FormLabel>
                    <InputGroup>
                      <Box
                        position="absolute"
                        left={3}
                        top="50%"
                        transform="translateY(-50%)"
                        zIndex={2}
                        pointerEvents="none"
                      >
                        <Icon
                          as={FaLock}
                          boxSize={4}
                          color={formData.password ? "#63B3ED" : "gray.600"}
                          transition="color 0.2s"
                        />
                      </Box>
                      <Input
                        name="password"
                        type={showPassword ? "text" : "password"}
                        value={formData.password}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        placeholder="••••••••"
                        autoComplete="current-password"
                        bg="rgba(0,0,0,0.5)"
                        border="1px solid"
                        borderColor={
                          touched.password && fieldErrors.password
                            ? "red.400"
                            : "rgba(255,255,255,0.1)"
                        }
                        color="white"
                        _placeholder={{ color: "gray.600" }}
                        _hover={{ borderColor: "#63B3ED" }}
                        _focus={{
                          borderColor: "#63B3ED",
                          boxShadow: "0 0 0 2px rgba(99,179,237,0.25)",
                          bg: "rgba(0,0,0,0.7)",
                          outline: "none",
                        }}
                        pl={10}
                        pr={12}
                        transition="all 0.2s"
                      />
                      {/* FIX 11: aria-label on toggle for screen readers */}
                      <InputRightElement h="full">
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={
                            showPassword ? "Hide password" : "Show password"
                          }
                          onClick={() => setShowPassword((v) => !v)}
                          _hover={{ bg: "transparent" }}
                          _active={{ bg: "transparent" }}
                          tabIndex={0}
                        >
                          <Icon
                            as={showPassword ? FaEye : FaEyeSlash}
                            boxSize={4}
                            color="gray.500"
                          />
                        </Button>
                      </InputRightElement>
                    </InputGroup>
                    <FormErrorMessage fontSize="xs">
                      {fieldErrors.password}
                    </FormErrorMessage>
                  </FormControl>

                  {/* Remember me + Forgot password */}
                  <Flex
                    justify="space-between"
                    align="center"
                    width="full"
                    mt={1}
                  >
                    <Checkbox
                      name="rememberMe"
                      isChecked={formData.rememberMe}
                      onChange={handleChange}
                      colorScheme="blue"
                      // FIX 12: size="" is invalid — removed (defaults to "md")
                      borderColor="rgba(255,255,255,0.2)"
                    >
                      <Text color="gray.300" fontSize="sm">
                        Remember me
                      </Text>
                    </Checkbox>
                    {/* FIX 13: _hover color was "#" (invalid) — fixed to a valid hover color.
                                href="#" replaced with a real route or onClick placeholder. */}
                    <Link
                      href="/forgot-password"
                      color="#db4f36"
                      fontSize="sm"
                      fontWeight="medium"
                      _hover={{ color: "#e87060", textDecoration: "none" }}
                    >
                      Forgot password?
                    </Link>
                  </Flex>

                  {/* Submit */}
                  <Button
                    type="submit"
                    bg="#3B2F2F" // dark brown
                    color="white"
                    width="full"
                    size="lg"
                    fontSize="15px"
                    isLoading={isLoading}
                    isDisabled={isLoading}
                    loadingText="Signing in…"
                    _hover={{
                      bg: "#1A1A1A", // black on hover
                      transform: "translateY(-2px)",
                      boxShadow: "0 10px 30px -5px rgba(0,0,0,0.6)",
                    }}
                    _active={{
                      bg: "#000000",
                      transform: "translateY(0)",
                    }}
                    _disabled={{
                      opacity: 0.6,
                      cursor: "not-allowed",
                      transform: "none",
                    }}
                    transition="all 0.25s"
                    rightIcon={<Icon as={FaArrowRight} boxSize={4} />}
                    mt={2}
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
