import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  VStack,
  Heading,
  Input,
  Text,
  useToast,
  Container,
} from '@chakra-ui/react';

const API_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost/not_set_correctly';

const Home = () => {
  const [sessionCode, setSessionCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();

  const createSession = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`${API_URL}/api/sessions`, {
        method: 'POST',
      });
      const data = await response.json();
      navigate(`/session/${data.sessionId}`);
    } catch (error) {
      toast({
        title: 'Error creating session',
        status: 'error',
        duration: 3000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const joinSession = async () => {
    if (!sessionCode) {
      toast({
        title: 'Please enter a session code',
        status: 'warning',
        duration: 3000,
      });
      return;
    }

    try {
      setIsLoading(true);
      const response = await fetch(`${API_URL}/api/sessions/${sessionCode}`);
      const data = await response.json();

      if (data.exists) {
        navigate(`/session/${sessionCode}`);
      } else {
        toast({
          title: 'Session not found',
          status: 'error',
          duration: 3000,
        });
      }
    } catch (error) {
      toast({
        title: 'Error joining session',
        status: 'error',
        duration: 3000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Container maxW="container.sm">
      <VStack spacing={8} align="stretch">
        <Box textAlign="center">
          <Heading as="h1" size="2xl" mb={4}>
            OrderTogether
          </Heading>
          <Text fontSize="xl" color="gray.600">
            Coordinate your group orders in real-time
          </Text>
        </Box>

        <VStack spacing={4} p={6} bg="white" borderRadius="lg" boxShadow="md">
          <Button
            colorScheme="teal"
            size="lg"
            width="full"
            onClick={createSession}
            isLoading={isLoading}
          >
            Create New Session
          </Button>

          <Text textAlign="center" color="gray.500">
            or
          </Text>

          <VStack width="full" spacing={3}>
            <Input
              placeholder="Enter session code"
              value={sessionCode}
              onChange={(e) => setSessionCode(e.target.value.toUpperCase())}
              size="lg"
              maxLength={6}
            />
            <Button
              colorScheme="blue"
              size="lg"
              width="full"
              onClick={joinSession}
              isLoading={isLoading}
            >
              Join Session
            </Button>
          </VStack>
        </VStack>
      </VStack>
    </Container>
  );
};

export default Home; 