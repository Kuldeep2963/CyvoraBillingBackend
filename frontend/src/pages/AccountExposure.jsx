import React, { useState, useEffect, useRef } from "react";
import {
  Box,
  Flex,
  Text,
  Input,
  Button,
  VStack,
  HStack,
  useToast,
} from "@chakra-ui/react";
import { keyframes } from "@emotion/react";

/* ── Keyframe animations ── */
const gridDrift = keyframes`
  from { transform: translate(0, 0); }
  to   { transform: translate(80px, 80px); }
`;

const scanLine = keyframes`
  0%   { top: -2px; opacity: 0; }
  5%   { opacity: 0.6; }
  95%  { opacity: 0.6; }
  100% { top: 100%; opacity: 0; }
`;

const fadeUp = keyframes`
  from { opacity: 0; transform: translateY(24px); }
  to   { opacity: 1; transform: translateY(0); }
`;

const flicker = keyframes`
  0%, 100% { opacity: 1; }
  92%       { opacity: 1; }
  93%       { opacity: 0.4; }
  94%       { opacity: 1; }
  96%       { opacity: 0.6; }
  97%       { opacity: 1; }
`;

const pulseRust = keyframes`
  0%, 100% { box-shadow: 0 0 0 0 rgba(201,79,39,0); }
  50%       { box-shadow: 0 0 24px 4px rgba(201,79,39,0.35); }
`;

const cursorBlink = keyframes`
  0%, 100% { opacity: 1; }
  50%       { opacity: 0; }
`;

/* ── Countdown unit block ── */
const CountUnit = ({ value, label, delay }) => (
  <Box
    textAlign="center"
    animation={`${fadeUp} 0.8s ease both`}
    style={{ animationDelay: delay }}
  >
    <Box
      position="relative"
      w={{ base: "72px", md: "96px" }}
      h={{ base: "72px", md: "96px" }}
      border="1px solid"
      borderColor="rgba(201,79,39,0.4)"
      borderRadius="2px"
      display="flex"
      alignItems="center"
      justifyContent="center"
      bg="rgba(201,79,39,0.04)"
      _before={{
        content: '""',
        position: "absolute",
        inset: "3px",
        border: "1px solid rgba(201,79,39,0.12)",
        borderRadius: "1px",
        pointerEvents: "none",
      }}
    >
      <Text
        fontFamily="'Bebas Neue', sans-serif"
        fontSize={{ base: "3xl", md: "5xl" }}
        color="#f2ede6"
        lineHeight="1"
        letterSpacing="wider"
        animation={`${flicker} 8s ease infinite`}
        style={{ animationDelay: delay }}
      >
        {String(value).padStart(2, "0")}
      </Text>
    </Box>
    <Text
      mt={2}
      fontFamily="'DM Mono', monospace"
      fontSize="9px"
      letterSpacing="0.3em"
      color="#7a7265"
      textTransform="uppercase"
    >
      {label}
    </Text>
  </Box>
);

/* ── Main page ── */
const AccountExposure = () => {
  const LAUNCH_DATE = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days from now

  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [typedText, setTypedText] = useState("");
  const toast = useToast();
  const fullText = "Something remarkable is being built.";
  const typingRef = useRef(null);

  /* countdown */
  useEffect(() => {
    const tick = () => {
      const diff = LAUNCH_DATE - Date.now();
      if (diff <= 0) return;
      setTimeLeft({
        days:    Math.floor(diff / 86400000),
        hours:   Math.floor((diff % 86400000) / 3600000),
        minutes: Math.floor((diff % 3600000)  / 60000),
        seconds: Math.floor((diff % 60000)    / 1000),
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  /* typewriter */
  useEffect(() => {
    let i = 0;
    typingRef.current = setInterval(() => {
      setTypedText(fullText.slice(0, i + 1));
      i++;
      if (i >= fullText.length) clearInterval(typingRef.current);
    }, 55);
    return () => clearInterval(typingRef.current);
  }, []);

  const handleNotify = () => {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast({ title: "Enter a valid email", status: "warning", duration: 2500, isClosable: true, position: "bottom" });
      return;
    }
    setSubmitted(true);
    toast({ title: "You're on the list.", description: "We'll reach out when we launch.", status: "success", duration: 3000, isClosable: true, position: "bottom" });
  };

  return (
    <>
      {/* Google fonts */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Mono:ital,wght@0,300;0,400;1,300&display=swap');
        * { cursor: crosshair !important; }
        ::selection { background: rgba(201,79,39,0.4); color: #f2ede6; }
        input { cursor: text !important; }
        button { cursor: crosshair !important; }
      `}</style>

      <Box
        position="relative"
        minH="100vh"
        bg="#0a0a08"
        overflow="hidden"
        fontFamily="'DM Mono', monospace"
      >
        {/* Animated grid */}
        <Box
          position="absolute" inset={0} zIndex={1}
          backgroundImage="linear-gradient(rgba(242,237,230,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(242,237,230,0.03) 1px, transparent 1px)"
          backgroundSize="80px 80px"
          animation={`${gridDrift} 30s linear infinite`}
          pointerEvents="none"
        />

        {/* Radial glow */}
        <Box
          position="absolute" inset={0} zIndex={2}
          bgGradient="radial(ellipse 65% 55% at 50% 50%, rgba(201,79,39,0.09) 0%, transparent 70%)"
          pointerEvents="none"
        />

        {/* Scan line */}
        <Box
          position="absolute" left={0} right={0} h="2px" zIndex={3}
          bgGradient="linear(to-r, transparent, #c94f27, transparent)"
          animation={`${scanLine} 9s ease-in-out infinite`}
          pointerEvents="none"
        />

        {/* Grain overlay via SVG filter */}
        <Box
          position="absolute" inset={0} zIndex={4}
          opacity={0.045}
          mixBlendMode="overlay"
          pointerEvents="none"
          backgroundImage={`url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`}
          backgroundSize="180px 180px"
        />

        {/* Corner marks */}
        {[
          { top: "20px", left: "20px",  borderTop: "1px solid", borderLeft:  "1px solid" },
          { top: "20px", right: "20px", borderTop: "1px solid", borderRight: "1px solid" },
          { bottom: "20px", left: "20px",  borderBottom: "1px solid", borderLeft:  "1px solid" },
          { bottom: "20px", right: "20px", borderBottom: "1px solid", borderRight: "1px solid" },
        ].map((styles, i) => (
          <Box
            key={i}
            position="absolute" zIndex={5}
            w="24px" h="24px"
            borderColor="rgba(201,79,39,0.35)"
            {...styles}
          />
        ))}

        {/* Main content */}
        <Flex
          position="relative" zIndex={10}
          minH="100vh"
          direction="column"
          align="center"
          justify="center"
          px={6}
          py={16}
        >
          {/* Status pill */}
          <Box
            animation={`${fadeUp} 0.6s ease both`}
            mb={10}
          >
            <HStack
              spacing={2}
              px={4} py={1.5}
              border="1px solid rgba(201,79,39,0.3)"
              borderRadius="2px"
              bg="rgba(201,79,39,0.06)"
            >
              <Box
                w="6px" h="6px" borderRadius="full"
                bg="#c94f27"
                animation={`${pulseRust} 2s ease infinite`}
              />
              <Text
                fontFamily="'DM Mono', monospace"
                fontSize="10px"
                letterSpacing="0.25em"
                color="#c94f27"
                textTransform="uppercase"
              >
                Under Construction
              </Text>
            </HStack>
          </Box>

          {/* Headline */}
          <VStack spacing={0} mb={8} textAlign="center">
            <Text
              fontFamily="'Bebas Neue', sans-serif"
              fontSize={{ base: "15vw", sm: "100px", md: "130px", lg: "160px" }}
              lineHeight="0.88"
              color="#f2ede6"
              letterSpacing="0.02em"
              animation={`${fadeUp} 0.7s 0.1s ease both`}
              userSelect="none"
            >
              COMING
            </Text>
            <Text
              fontFamily="'Bebas Neue', sans-serif"
              fontSize={{ base: "15vw", sm: "100px", md: "130px", lg: "160px" }}
              lineHeight="0.88"
              color="transparent"
              letterSpacing="0.02em"
              animation={`${fadeUp} 0.7s 0.2s ease both`}
              style={{
                WebkitTextStroke: "1.5px #c94f27",
              }}
              userSelect="none"
            >
              SOON
            </Text>
          </VStack>

          {/* Typewriter subtitle */}
          <Box
            animation={`${fadeUp} 0.7s 0.3s ease both`}
            mb={12}
            minH="20px"
          >
            <Text
              fontFamily="'DM Mono', monospace"
              fontSize={{ base: "xs", md: "sm" }}
              color="#7a7265"
              letterSpacing="0.12em"
              fontStyle="italic"
            >
              {typedText}
              <Box
                as="span"
                display="inline-block"
                w="2px" h="14px"
                bg="#c94f27"
                ml="2px"
                verticalAlign="middle"
                animation={`${cursorBlink} 1s step-end infinite`}
              />
            </Text>
          </Box>

          {/* Countdown */}
          <HStack
            spacing={{ base: 3, md: 6 }}
            mb={14}
            animation={`${fadeUp} 0.7s 0.4s ease both`}
          >
            <CountUnit value={timeLeft.days}    label="Days"    delay="0.5s" />
            <Text fontFamily="'Bebas Neue', sans-serif" fontSize="3xl" color="rgba(201,79,39,0.5)" pb={6}>:</Text>
            <CountUnit value={timeLeft.hours}   label="Hours"   delay="0.55s" />
            <Text fontFamily="'Bebas Neue', sans-serif" fontSize="3xl" color="rgba(201,79,39,0.5)" pb={6}>:</Text>
            <CountUnit value={timeLeft.minutes} label="Minutes" delay="0.6s" />
            <Text fontFamily="'Bebas Neue', sans-serif" fontSize="3xl" color="rgba(201,79,39,0.5)" pb={6}>:</Text>
            <CountUnit value={timeLeft.seconds} label="Seconds" delay="0.65s" />
          </HStack>

          {/* Divider */}
          <Box
            w={{ base: "80px", md: "120px" }}
            h="1px"
            bg="linear-gradient(90deg, transparent, rgba(201,79,39,0.5), transparent)"
            mb={10}
            animation={`${fadeUp} 0.7s 0.7s ease both`}
          />

          {/* Email capture */}
          <Box
            w="100%"
            maxW="420px"
            animation={`${fadeUp} 0.7s 0.8s ease both`}
          >
            {!submitted ? (
              <VStack spacing={3}>
                <Text
                  fontFamily="'DM Mono', monospace"
                  fontSize="10px"
                  letterSpacing="0.25em"
                  color="#7a7265"
                  textTransform="uppercase"
                  mb={1}
                >
                  Get notified at launch
                </Text>
                <HStack w="100%" spacing={0}>
                  <Input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleNotify()}
                    placeholder="your@email.com"
                    fontFamily="'DM Mono', monospace"
                    fontSize="sm"
                    color="#f2ede6"
                    bg="rgba(242,237,230,0.04)"
                    border="1px solid rgba(242,237,230,0.12)"
                    borderRight="none"
                    borderRadius="2px 0 0 2px"
                    h="44px"
                    px={4}
                    _placeholder={{ color: "#4a4740", fontStyle: "italic" }}
                    _focus={{
                      outline: "none",
                      boxShadow: "none",
                      borderColor: "rgba(201,79,39,0.5)",
                      bg: "rgba(201,79,39,0.04)",
                    }}
                    _hover={{ borderColor: "rgba(242,237,230,0.2)" }}
                  />
                  <Button
                    onClick={handleNotify}
                    h="44px"
                    px={5}
                    bg="#c94f27"
                    color="#f2ede6"
                    fontFamily="'DM Mono', monospace"
                    fontSize="10px"
                    letterSpacing="0.2em"
                    textTransform="uppercase"
                    borderRadius="0 2px 2px 0"
                    border="1px solid #c94f27"
                    _hover={{ bg: "#a8401e", borderColor: "#a8401e" }}
                    _active={{ bg: "#8c3419" }}
                    flexShrink={0}
                  >
                    Notify Me
                  </Button>
                </HStack>
              </VStack>
            ) : (
              <VStack spacing={2}>
                <HStack spacing={3}>
                  <Box w="6px" h="6px" borderRadius="full" bg="#c94f27" animation={`${pulseRust} 2s ease infinite`} />
                  <Text fontFamily="'DM Mono', monospace" fontSize="sm" color="#f2ede6" letterSpacing="0.08em">
                    You're on the list.
                  </Text>
                </HStack>
                <Text fontFamily="'DM Mono', monospace" fontSize="10px" color="#7a7265" letterSpacing="0.1em">
                  We'll reach out when we're ready.
                </Text>
              </VStack>
            )}
          </Box>

          {/* Bottom label */}
          <Box
            position="absolute"
            bottom="28px"
            animation={`${fadeUp} 0.7s 1s ease both`}
          >
            <Text
              fontFamily="'DM Mono', monospace"
              fontSize="9px"
              letterSpacing="0.3em"
              color="rgba(122,114,101,0.5)"
              textTransform="uppercase"
            >
              © {new Date().getFullYear()} — All rights reserved
            </Text>
          </Box>
        </Flex>
      </Box>
    </>
  );
};

export default AccountExposure;