import React from "react";
import { Flex, Box, Text, Divider } from "@chakra-ui/react";

/**
 * PageNavBar Component
 * A reusable sticky navbar for all pages with consistent styling
 * 
 * @param {string} title - Main heading of the page
 * @param {string} description - Subtitle/description text
 * @param {React.ReactNode} rightContent - Optional content to display on the right (buttons, filters, etc.)
 * @param {React.ReactNode} bottomContent - Optional sticky content rendered below the header row
 * @param {object} props - Additional Chakra UI Box props
 */
const PageNavBar = ({ 
  title = "", 
  description = "", 
  rightContent = null,
  bottomContent = null,
  ...props 
}) => {
  return (
    <Box
      px={5}
      py={2}
      borderRadius="12px"
      bgGradient="linear(to-r, blue.100, blue.200, blue.300)"
      position="sticky"
      top={0}
      zIndex="20"
      boxShadow="md"
      {...props}
    >
      <Flex
        align={{ base: "flex-start", md: "center" }}
        justify="space-between"
        direction={{ base: "column", md: "row" }}
        gap={{ base: 4, md: 0 }}
      >
        <Box>
          <Text fontSize="25px" fontFamily="sans-serif" fontWeight="600" color="gray.600">
            {title}
          </Text>
          {description && (
            <Text color="gray.500" fontSize="sm">
              {description}
            </Text>
          )}
        </Box>

        {rightContent && (
          <Flex
            w={{ base: "full", md: "auto" }}
            justify={{ base: "flex-start", md: "flex-end" }}
            gap={4}
          >
            {rightContent}
          </Flex>
        )}
      </Flex>

      {bottomContent && (
        <Box mt={4}>
          <Divider borderColor="blue.200" mb={4} />
          {bottomContent}
        </Box>
      )}
    </Box>
  );
};

export default PageNavBar;
