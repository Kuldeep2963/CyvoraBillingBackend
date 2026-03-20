import React from "react";
import { Flex, Box, Heading, Text, HStack } from "@chakra-ui/react";

/**
 * PageNavBar Component
 * A reusable sticky navbar for all pages with consistent styling
 * 
 * @param {string} title - Main heading of the page
 * @param {string} description - Subtitle/description text
 * @param {React.ReactNode} rightContent - Optional content to display on the right (buttons, filters, etc.)
 * @param {object} props - Additional Chakra UI Flex props
 */
const PageNavBar = ({ 
  title = "", 
  description = "", 
  rightContent = null,
  ...props 
}) => {
  return (
    <Flex
    //   mb={5}
      px={5}
      py={2}
      borderRadius="12px"
      bgGradient="linear(to-r, blue.100, blue.200, blue.300)"
      align={{ base: "flex-start", md: "center" }}
      justify="space-between"
      direction={{ base: "column", md: "row" }}
      gap={{ base: 4, md: 0 }}
      position="sticky"
      top={0}
      zIndex={20}
      boxShadow="md"
      {...props}
    >
      <Box minW={0}>
        <Heading 
          size={{ base: "md", md: "lg" }} 
          color="gray.600"
          fontWeight="600"
          whiteSpace="nowrap"
          overflow="hidden"
          textOverflow="ellipsis"
        >
          {title}
        </Heading>
        {description && (
          <Text 
            color="gray.500" 
            fontSize="sm"
            noOfLines={2}
          >
            {description}
          </Text>
        )}
      </Box>

      {rightContent && (
        <HStack
          spacing={3}
          w={{ base: "full", md: "auto" }}
          justify={{ base: "flex-start", md: "flex-end" }}
        >
          {rightContent}
        </HStack>
      )}
    </Flex>
  );
};

export default PageNavBar;
