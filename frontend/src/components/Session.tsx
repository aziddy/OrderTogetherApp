import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  VStack,
  Heading,
  Input,
  Button,
  List,
  ListItem,
  Text,
  HStack,
  IconButton,
  useToast,
  Container,
} from '@chakra-ui/react';
import { DeleteIcon } from '@chakra-ui/icons';

interface Order {
  id: string;
  item: string;
  quantity: number;
  notes: string;
  timestamp: string;
}

const Session = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [newItem, setNewItem] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  const [isConnecting, setIsConnecting] = useState(true);
  const navigate = useNavigate();
  const toast = useToast();

  useEffect(() => {
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 3;
    let websocket: WebSocket | null = null;
    let isErrorShown = false;

    const showError = (title: string, description: string) => {
      if (!isErrorShown) {
        isErrorShown = true;
        toast({
          title,
          description,
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
      }
    };

    const connectWebSocket = () => {
      if (isErrorShown) return;
      
      setIsConnecting(true);
      websocket = new WebSocket(`ws://localhost:5001`);

      websocket.onopen = () => {
        console.log('WebSocket connected');
        setIsConnecting(false);
        isErrorShown = false;
        reconnectAttempts = 0;
        
        websocket?.send(JSON.stringify({
          type: 'join',
          sessionId,
        }));
      };

      websocket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'orders') {
            setOrders(data.orders);
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      websocket.onclose = (event) => {
        console.log('WebSocket closed:', event.code, event.reason);
        setIsConnecting(true);
        
        // Only attempt reconnect if it wasn't closed due to an error
        if (!isErrorShown && reconnectAttempts < maxReconnectAttempts) {
          reconnectAttempts++;
          console.log(`Reconnecting... Attempt ${reconnectAttempts}`);
          setTimeout(connectWebSocket, 1000 * reconnectAttempts);
        } else if (!isErrorShown) {
          showError(
            'Connection lost',
            'Unable to reconnect to the session'
          );
          navigate('/');
        }
      };

      websocket.onerror = (error) => {
        console.error('WebSocket error:', error);
        showError(
          'Connection error',
          'Error connecting to the session'
        );
      };

      setWs(websocket);
    };

    connectWebSocket();

    return () => {
      isErrorShown = true; // Prevent any new error messages during cleanup
      if (websocket) {
        websocket.close();
      }
    };
  }, [sessionId, navigate, toast]);

  const addOrder = () => {
    if (!newItem.trim()) {
      toast({
        title: 'Please enter an item',
        status: 'warning',
        duration: 3000,
      });
      return;
    }

    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'add_order',
        order: {
          item: newItem.trim(),
          quantity,
          notes: notes.trim(),
        },
      }));

      setNewItem('');
      setQuantity(1);
      setNotes('');
    } else {
      toast({
        title: 'Connection error',
        description: 'Please wait for connection to be established',
        status: 'error',
        duration: 3000,
      });
    }
  };

  const removeOrder = (orderId: string) => {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'remove_order',
        orderId,
      }));
    } else {
      toast({
        title: 'Connection error',
        description: 'Please wait for connection to be established',
        status: 'error',
        duration: 3000,
      });
    }
  };

  const copySessionLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    toast({
      title: 'Session link copied!',
      status: 'success',
      duration: 2000,
    });
  };

  return (
    <Container maxW="container.md">
      <VStack spacing={6} align="stretch">
        <Box textAlign="center">
          <Heading as="h1" size="xl" mb={2}>
            Order Session
          </Heading>
          <Text fontSize="lg" color="gray.600" mb={2}>
            Session Code: {sessionId}
          </Text>
          <Button size="sm" onClick={copySessionLink}>
            Copy Session Link
          </Button>
          {isConnecting && (
            <Text color="orange.500" mt={2}>
              Connecting to session...
            </Text>
          )}
        </Box>

        <Box bg="white" p={6} borderRadius="lg" boxShadow="md">
          <VStack spacing={4}>
            <Input
              placeholder="Item name"
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              isDisabled={isConnecting}
            />
            <HStack width="full">
              <Input
                type="number"
                placeholder="Quantity"
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                min={1}
                isDisabled={isConnecting}
              />
              <Input
                placeholder="Notes (optional)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                isDisabled={isConnecting}
              />
            </HStack>
            <Button 
              colorScheme="teal" 
              width="full" 
              onClick={addOrder}
              isDisabled={isConnecting}
            >
              Add to Order
            </Button>
          </VStack>
        </Box>

        <Box bg="white" p={6} borderRadius="lg" boxShadow="md">
          <Heading as="h2" size="md" mb={4}>
            Current Orders
          </Heading>
          <List spacing={3}>
            {orders.map((order) => (
              <ListItem
                key={order.id}
                p={3}
                bg="gray.50"
                borderRadius="md"
                display="flex"
                justifyContent="space-between"
                alignItems="center"
              >
                <VStack align="start" spacing={1}>
                  <Text fontWeight="bold">
                    {order.quantity}x {order.item}
                  </Text>
                  {order.notes && (
                    <Text fontSize="sm" color="gray.600">
                      Note: {order.notes}
                    </Text>
                  )}
                </VStack>
                <IconButton
                  aria-label="Remove order"
                  icon={<DeleteIcon />}
                  size="sm"
                  colorScheme="red"
                  variant="ghost"
                  onClick={() => removeOrder(order.id)}
                  isDisabled={isConnecting}
                />
              </ListItem>
            ))}
            {orders.length === 0 && (
              <Text color="gray.500" textAlign="center">
                No orders yet. Add something to get started!
              </Text>
            )}
          </List>
        </Box>
      </VStack>
    </Container>
  );
};

export default Session; 