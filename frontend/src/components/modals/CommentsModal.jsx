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
  Box,
  Text,
  Textarea,
  HStack,
  Icon,
  useColorModeValue,
  Divider,
} from "@chakra-ui/react";
import { FiMessageSquare, FiUser, FiClock } from "react-icons/fi";
import { format } from "date-fns";

const CommentsModal = ({
  isOpen,
  onClose,
  comments = [],
  onAddComment,
  isLoading = false,
  disputeInfo,
}) => {
  const [newComment, setNewComment] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const bgColor = useColorModeValue("white", "gray.800");
  const borderColor = useColorModeValue("gray.200", "gray.700");
  const commentBg = useColorModeValue("gray.50", "gray.700");

  const handleAddComment = async () => {
    if (!newComment.trim()) return;

    setIsAdding(true);
    try {
      await onAddComment(newComment.trim());
      setNewComment("");
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md" scrollBehavior="inside">
      <ModalOverlay backdropFilter="blur(3px)" />
      <ModalContent borderRadius="12px" overflow="hidden">
        <ModalHeader
          bgGradient="linear(to-r, blue.500, blue.600)"
          color="white"
          py={4}
          px={5}
        >
          <HStack spacing={3}>
            <Box p={2} bg="whiteAlpha.200" borderRadius="8px">
              <FiMessageSquare size={18} />
            </Box>
            <Box>
              <Text fontSize="sm" fontWeight="700">
                Dispute Comments
              </Text>
              {disputeInfo && (
                <Text fontSize="xs" opacity={0.8} fontWeight="400">
                  {disputeInfo}
                </Text>
              )}
            </Box>
          </HStack>
        </ModalHeader>
        <ModalCloseButton color="white" top={4} right={4} />

        <ModalBody py={5} px={5} maxH="500px" overflowY="auto">
          <VStack spacing={4} align="stretch">
            {/* Previous Comments */}
            {comments && comments.length > 0 && (
              <Box>
                <Text fontSize="12px" fontWeight="700" color="gray.500" textTransform="uppercase" mb={3}>
                  Previous Comments
                </Text>
                <VStack spacing={3} align="stretch">
                  {comments.map((comment, idx) => (
                    <Box
                      key={idx}
                      p={3}
                      bg={commentBg}
                      borderRadius="8px"
                      borderLeft="3px solid"
                      borderColor="blue.400"
                    >
                      <HStack spacing={2} mb={2} justify="space-between">
                        <HStack spacing={1} fontSize="xs" color="gray.500">
                          <Icon as={FiUser} boxSize={3.5} />
                          <Text fontWeight="600">{comment.userName}</Text>
                        </HStack>
                        {comment.timestamp && (
                          <HStack spacing={1} fontSize="xs" color="gray.400">
                            <Icon as={FiClock} boxSize={3.5} />
                            <Text>
                              {format(
                                new Date(comment.timestamp),
                                "MMM dd, yyyy · HH:mm"
                              )}
                            </Text>
                          </HStack>
                        )}
                      </HStack>
                      <Text fontSize="sm" color="gray.700" lineHeight="1.5">
                        {comment.text}
                      </Text>
                    </Box>
                  ))}
                </VStack>
              </Box>
            )}

            {(!comments || comments.length === 0) && (
              <Box
                py={6}
                textAlign="center"
                bg={commentBg}
                borderRadius="8px"
                border="1px dashed"
                borderColor={borderColor}
              >
                <Icon as={FiMessageSquare} boxSize={6} color="gray.300" mb={2} />
                <Text color="gray.400" fontSize="sm">
                  No comments yet
                </Text>
              </Box>
            )}

            <Divider />

            {/* Add New Comment */}
            <Box>
              <Text
                fontSize="12px"
                fontWeight="700"
                color="gray.500"
                textTransform="uppercase"
                mb={3}
              >
                Add Comment
              </Text>
              <VStack spacing={2} align="stretch">
                <Textarea
                  placeholder="Type your comment here..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  borderRadius="8px"
                  borderColor={borderColor}
                  fontSize="13px"
                  minH="100px"
                  resize="vertical"
                  _focus={{
                    borderColor: "blue.400",
                    boxShadow: "0 0 0 1px var(--chakra-colors-blue-400)",
                  }}
                  isDisabled={isLoading || isAdding}
                />
              </VStack>
            </Box>
          </VStack>
        </ModalBody>

        <ModalFooter borderTop="1px" borderColor={borderColor} py={3} px={5}>
          <HStack spacing={2} ml="auto">
            <Button
              size="sm"
              variant="ghost"
              colorScheme="gray"
              onClick={onClose}
              borderRadius="8px"
              isDisabled={isAdding}
            >
              Close
            </Button>
            <Button
              size="sm"
              colorScheme="blue"
              onClick={handleAddComment}
              isLoading={isAdding}
              isDisabled={!newComment.trim() || isLoading}
              borderRadius="8px"
            >
              Add Comment
            </Button>
          </HStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default CommentsModal;
