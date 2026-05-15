import { useCallback } from 'react';
import { useToast, Box, Text, HStack, Button } from '@chakra-ui/react';

export default function useNotify() {
  const toast = useToast();
  return useCallback((opts = {}, maybeDescription) => {
    let title = '';
    let description = '';
    let status = 'info';
    let duration = 4000;
    let isClosable = true;

    // Support legacy positional calls: notify(status, message)
    if (typeof opts === 'string') {
      status = opts;
      description = maybeDescription || '';
    } else if (opts && typeof opts === 'object') {
      title = opts.title || '';
      description = opts.description || maybeDescription || '';
      status = opts.status || 'info';
      duration = typeof opts.duration === 'number' ? opts.duration : 4000;
      isClosable = typeof opts.isClosable === 'boolean' ? opts.isClosable : true;
    }
    const bgMap = {
      success: 'green.50',
      error: 'red.50',
      warning: 'yellow.50',
      info: 'gray.50',
    };
    const borderMap = {
      success: 'green.100',
      error: 'red.100',
      warning: 'yellow.100',
      info: 'blue.100',
    };
    const titleColor = {
      success: 'green.800',
      error: 'red.800',
      warning: 'yellow.800',
      info: 'blue.800',
    };
    const descColor = {
      success: 'green.700',
      error: 'red.700',
      warning: 'yellow.700',
      info: 'blue.600',
    };

    toast({
      position: 'top-right',
      duration,
      isClosable,
      render: ({ onClose }) => (
        <Box
          bg={bgMap[status] || bgMap.info}
          borderWidth="1px"
          borderColor={borderMap[status] || borderMap.info}
          px={4}
          py={3}
          borderRadius="10px"
          boxShadow="sm"
          minW="300px"
        >
          <HStack justify="space-between" align="start">
            <Box>
              {title ? (
                <Text fontSize="14px" fontWeight="600" color={titleColor[status] || titleColor.info}>
                  {title}
                </Text>
              ) : null}
              {description && (
                <Text fontSize="13px" color={descColor[status] || descColor.info} mt={1}>
                  {description}
                </Text>
              )}
            </Box>
            {isClosable && (
              <Button size="xs" variant="ghost" onClick={onClose} ml={3}>
                Close
              </Button>
            )}
          </HStack>
        </Box>
      ),
    });
  }, [toast]);
}
