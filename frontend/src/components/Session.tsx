import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
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
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  useDisclosure,
  Badge,
  SimpleGrid,
  Flex,
  InputGroup,
  InputRightAddon,
  AlertDialog,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogOverlay,
} from '@chakra-ui/react';
import { DeleteIcon, CheckIcon } from '@chakra-ui/icons';
import Logo from './Logo';

// Add custom WebSocket interface
interface ExtendedWebSocket extends WebSocket {
  attempts?: number;
  reconnectTimeout?: ReturnType<typeof setTimeout>;
}

interface Order {
  id: string;
  item: string;
  quantity: number;
  price?: number;
  name: string;
  notes: string;
  timestamp: string;
  isOrdered?: boolean;
}

const BACKEND_WS_URL = import.meta.env.VITE_BACKEND_WS_URL || 'ws://localhost/not_set_correctly';

const STORAGE_KEY = 'orderTogetherUserName';
const STORAGE_EXPIRY_DAYS = 1;

const loadNameFromStorage = (): string => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return '';

    const { value, expiry } = JSON.parse(stored);
    if (Date.now() > expiry) {
      localStorage.removeItem(STORAGE_KEY);
      return '';
    }
    return value;
  } catch {
    return '';
  }
};

const saveNameToStorage = (name: string) => {
  const expiry = Date.now() + (STORAGE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ value: name, expiry }));
};

const Session = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [ws, setWs] = useState<ExtendedWebSocket | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [taxPercent, setTaxPercent] = useState<number>(13);
  const [taxInput, setTaxInput] = useState<string>('13');
  const isEditingTaxRef = useRef<boolean>(false);
  const [newItem, setNewItem] = useState('');
  const [quantity, setQuantity] = useState<string>('1');
  const [price, setPrice] = useState<string>('');
  const [userName, setUserName] = useState<string>(() => loadNameFromStorage());
  const [notes, setNotes] = useState('');
  const [isConnecting, setIsConnecting] = useState(true);
  const [showConnecting, setShowConnecting] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const {
    isOpen: isDeleteDialogOpen,
    onOpen: onDeleteDialogOpen,
    onClose: onDeleteDialogClose
  } = useDisclosure();
  const [orderToDelete, setOrderToDelete] = useState<{ id: string; name: string } | null>(null);
  const cancelRef = React.useRef<HTMLButtonElement>(null);
  const navigate = useNavigate();
  const toast = useToast();
  const [isInBackground, setIsInBackground] = useState(false);
  const taxUpdateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce showing connection state to prevent UI flickering
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    
    if (isConnecting) {
      // Delay showing "connecting" message by 500ms
      timeoutId = setTimeout(() => {
        setShowConnecting(true);
      }, 500);
    } else {
      // Immediately hide connecting message when connected
      setShowConnecting(false);
    }
    
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [isConnecting]);

  const connectWebSocket = useCallback(() => {
    if (sessionExpired) return null;

    setIsConnecting(true);
    const websocket = new WebSocket(BACKEND_WS_URL) as ExtendedWebSocket;

    websocket.onopen = () => {
      console.log('WebSocket connected');
      setIsConnecting(false);

      websocket.send(JSON.stringify({
        type: 'join',
        sessionId,
      }));
    };

    websocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        switch (data.type) {
          case 'orders':
            setOrders(data.orders);
            if (typeof data.taxPercent === 'number') {
              setTaxPercent(data.taxPercent);
              if (!isEditingTaxRef.current) {
                setTaxInput(String(data.taxPercent));
              }
            }
            break;
          case 'session_expired':
            setSessionExpired(true);
            toast({
              title: 'Session Expired',
              description: 'This session has expired. You will be redirected to the home page.',
              status: 'warning',
              duration: 5000,
              isClosable: true,
            });
            setTimeout(() => navigate('/'), 5000);
            break;
          case 'error':
            toast({
              title: 'Error',
              description: data.message,
              status: 'error',
              duration: 3000,
              isClosable: true,
            });
            break;
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    websocket.onclose = (event) => {
      console.log('WebSocket closed:', event.code, event.reason);
      setIsConnecting(true);

      if (!isInBackground) {
        const backoffDelay = Math.min(1000 * Math.pow(2, websocket.attempts || 0), 30000);
        websocket.reconnectTimeout = setTimeout(() => {
          if (!isInBackground) {
            websocket.attempts = (websocket.attempts || 0) + 1;
            setWs(null);
            connectWebSocket();
          }
        }, backoffDelay);
      }
    };

    websocket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    websocket.attempts = 0;
    setWs(websocket);
    return websocket;
  }, [sessionId, navigate, toast, sessionExpired, isInBackground]);

  useEffect(() => {
    let websocket: ExtendedWebSocket | null = null;
    let visibilityChangeTimeout: ReturnType<typeof setTimeout>;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        setIsInBackground(true);
        visibilityChangeTimeout = setTimeout(() => {
          if (websocket?.readyState === WebSocket.OPEN) {
            console.log('Closing WebSocket due to background state');
            websocket.close();
          }
        }, 5000);
      } else {
        setIsInBackground(false);
        clearTimeout(visibilityChangeTimeout);

        if (!websocket || websocket.readyState !== WebSocket.OPEN) {
          websocket = connectWebSocket();
        }
      }
    };

    const handleAppStateChange = () => {
      if (document.visibilityState === 'visible') {
        setTimeout(() => {
          if (!websocket || websocket.readyState !== WebSocket.OPEN) {
            websocket = connectWebSocket();
          }
        }, 1000);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleAppStateChange);
    window.addEventListener('pageshow', handleAppStateChange);

    websocket = connectWebSocket();

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleAppStateChange);
      window.removeEventListener('pageshow', handleAppStateChange);

      clearTimeout(visibilityChangeTimeout);
      if (taxUpdateTimeoutRef.current) {
        clearTimeout(taxUpdateTimeoutRef.current);
      }
      if (websocket) {
        clearTimeout(websocket.reconnectTimeout);
        websocket.close();
      }
    };
  }, [connectWebSocket]);

  const addOrder = () => {
    if (!newItem.trim()) {
      toast({
        title: 'Please enter an item',
        status: 'warning',
        duration: 3000,
      });
      return;
    }

    const parsedQuantity = parseInt(quantity);
    if (!parsedQuantity || parsedQuantity < 1) {
      toast({
        title: 'Invalid quantity',
        description: 'Please enter a quantity greater than 0',
        status: 'warning',
        duration: 3000,
      });
      return;
    }

    // Validate note length
    // if (notes.trim().length > 30) {
    //   toast({
    //     title: 'Note too long',
    //     description: 'Please keep notes under 30 characters',
    //     status: 'warning',
    //     duration: 3000,
    //   });
    //   return;
    // }

    // Validate price if provided
    let parsedPrice: number | undefined = undefined;
    if (price.trim()) {
      parsedPrice = parseFloat(price);
      if (isNaN(parsedPrice) || parsedPrice < 0 || parsedPrice > 50000) {
        toast({
          title: 'Invalid price',
          description: 'Price must be between 0 and 50,000',
          status: 'warning',
          duration: 3000,
        });
        return;
      }
      // Round to 2 decimal places
      parsedPrice = Math.round(parsedPrice * 100) / 100;
    }

    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'add_order',
        order: {
          item: newItem.trim(),
          quantity: parsedQuantity,
          price: parsedPrice,
          name: userName.trim(),
          notes: notes.trim(),
        },
      }));

      setNewItem('');
      setQuantity('1');
      setPrice('');
      // Keep userName and notes fields populated for convenience
    } else {
      toast({
        title: 'Connection error',
        description: 'Please wait for connection to be established',
        status: 'error',
        duration: 3000,
      });
    }
  };

  const submitTaxUpdate = () => {
    const proposed = parseFloat(taxInput);
    if (isNaN(proposed) || proposed < 0 || proposed > 50) {
      toast({
        title: 'Invalid tax',
        description: 'Enter a tax percentage between 0 and 50',
        status: 'warning',
        duration: 3000,
      });
      setTaxInput(String(taxPercent));
      isEditingTaxRef.current = false;
      return;
    }
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'set_tax',
        taxPercent: Math.round(proposed * 100) / 100,
      }));
    } else {
      toast({
        title: 'Connection error',
        description: 'Please wait for connection to be established',
        status: 'error',
        duration: 3000,
      });
    }
    isEditingTaxRef.current = false;
  };

  const handleTaxBlur = () => {
    // Clear any existing timeout
    if (taxUpdateTimeoutRef.current) {
      clearTimeout(taxUpdateTimeoutRef.current);
    }

    // Set a 300ms delay before submitting the tax update
    const timeoutId = setTimeout(() => {
      submitTaxUpdate();
      taxUpdateTimeoutRef.current = null;
    }, 300);

    taxUpdateTimeoutRef.current = timeoutId;
  };

  const handleDeleteClick = (orderId: string, orderName: string) => {
    setOrderToDelete({ id: orderId, name: orderName });
    onDeleteDialogOpen();
  };

  const confirmDelete = () => {
    if (orderToDelete && ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'remove_order',
        orderId: orderToDelete.id,
      }));
    } else if (!ws || ws.readyState !== WebSocket.OPEN) {
      toast({
        title: 'Connection error',
        description: 'Please wait for connection to be established',
        status: 'error',
        duration: 3000,
      });
    }
    setOrderToDelete(null);
    onDeleteDialogClose();
  };

  const handleNameChange = (newName: string) => {
    setUserName(newName);
    saveNameToStorage(newName);
  };

  const toggleOrderStatus = (orderId: string) => {
    if (ws?.readyState === WebSocket.OPEN) {
      // Find the order to get its details for the toast
      const order = orders.find(o => o.id === orderId);
      const isCurrentlyOrdered = order?.isOrdered || false;

      ws.send(JSON.stringify({
        type: 'toggle_order_status',
        orderId,
      }));

      // Show toast notification
      toast({
        title: isCurrentlyOrdered ? 'Item unmarked' : 'Item marked as ordered',
        description: order?.item,
        status: 'success',
        duration: 2000,
      });
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
    <Container
      maxW={["100%", "100%", "container.md"]}
      px={[1, 2, 4]}
    >
      <VStack spacing={6} align="stretch">
        {sessionExpired && (
          <Alert status="warning">
            <AlertIcon />
            <Box>
              <AlertTitle>Session Expired</AlertTitle>
              <AlertDescription>
                This session has expired. You will be redirected to the home page shortly.
              </AlertDescription>
            </Box>
          </Alert>
        )}

        <Box textAlign="center">
          <Box mb={4} display="flex" justifyContent="center">
            <Logo size={["30px", "35px", "40px"]} />
          </Box>
          <Heading as="h1" size="xl" mb={2}>
            Order Session
          </Heading>
          <Text fontSize="lg" color="gray.600" mb={2}>
            Session Code: {sessionId}
          </Text>
          <HStack spacing={2} justify="center">
            <Button size="sm" onClick={copySessionLink}>
              Copy Session Link
            </Button>
            <Button size="sm" onClick={onOpen} colorScheme="teal">
              Show QR Code
            </Button>
          </HStack>
          {showConnecting && !sessionExpired && (
            <Text color="orange.500" mt={2}>
              Connecting to session...
            </Text>
          )}
        </Box>

        <Modal isOpen={isOpen} onClose={onClose} isCentered>
          <ModalOverlay />
          <ModalContent>
            <ModalHeader textAlign="center">Scan to Join Session</ModalHeader>
            <ModalCloseButton />
            <ModalBody pb={6}>
              <VStack spacing={4}>
                <Box p={4} bg="white" borderRadius="lg">
                  <QRCodeSVG
                    value={window.location.href}
                    size={250}
                    level="H"
                    includeMargin
                  />
                </Box>
                <Text fontSize="sm" color="gray.600" textAlign="center">
                  Scan this QR code to join the session on another device
                </Text>
              </VStack>
            </ModalBody>
          </ModalContent>
        </Modal>

        <AlertDialog
          isOpen={isDeleteDialogOpen}
          leastDestructiveRef={cancelRef}
          onClose={onDeleteDialogClose}
          isCentered
        >
          <AlertDialogOverlay>
            <AlertDialogContent>
              <AlertDialogHeader fontSize="lg" fontWeight="bold">
                Delete Item
              </AlertDialogHeader>

              <AlertDialogBody>
                Are you sure you want to delete "{orderToDelete?.name}"? This action cannot be undone.
              </AlertDialogBody>

              <AlertDialogFooter>
                <Button ref={cancelRef} onClick={onDeleteDialogClose}>
                  Cancel
                </Button>
                <Button colorScheme="red" onClick={confirmDelete} ml={3}>
                  Delete
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialogOverlay>
        </AlertDialog>

        <Box bg="white" p={6} borderRadius="lg" boxShadow="md">
          <VStack spacing={4}>
            <Input
              placeholder="Item name"
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              isDisabled={isConnecting || sessionExpired}
            />
            <HStack width="full">
              <Input
                type="number"
                placeholder="Quantity"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                min={1}
                isDisabled={isConnecting || sessionExpired}
              />
              <Input
                type="number"
                placeholder="Price (optional)"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                min={0}
                max={50000}
                step={0.01}
                isDisabled={isConnecting || sessionExpired}
              />
            </HStack>
            <HStack spacing={2} width="100%">
              <Input
                placeholder="Name (optional)"
                value={userName}
                onChange={(e) => {
                  const trimmedValue = e.target.value.trim();
                  if (trimmedValue.length <= 30) {
                    handleNameChange(e.target.value);
                  }
                }}
                isDisabled={isConnecting || sessionExpired}
                flex={1}
              />
              <Input
                placeholder="Notes (optional)"
                value={notes}
                onChange={(e) => {
                  const trimmedValue = e.target.value.trim();
                  if (trimmedValue.length <= 100) {
                    setNotes(e.target.value);
                  }
                }}
                isDisabled={isConnecting || sessionExpired}
                flex={1}
              />
            </HStack>
            <Button
              colorScheme="teal"
              width="full"
              onClick={addOrder}
              isDisabled={isConnecting || sessionExpired}
            >
              Add to Order
            </Button>
          </VStack>
        </Box>

        <Box bg="white" p={6} borderRadius="lg" boxShadow="md">
          <Heading as="h2" size="md" mb={4}>
            Current Order Items - ({orders.filter(o => o.isOrdered).length}/{orders.length}) Items Ordered
          </Heading>
          <List spacing={3}>
            {orders.map((order) => (
              <ListItem
                key={order.id}
                p={3}
                bg={order.isOrdered ? "green.50" : "gray.50"}
                borderRadius="md"
                display="flex"
                justifyContent="space-between"
                alignItems="flex-start"
                opacity={order.isOrdered ? 0.6 : 1}
              >
                <VStack align="start" spacing={1} flex="1" minWidth="0">
                  <Flex gap={2} flexWrap="wrap" width="100%">
                    <Badge colorScheme={order.isOrdered ? "gray" : "orange"} fontSize="0.9em" px={2} borderRadius="md" flexShrink={0}>
                      {order.quantity}x
                    </Badge>
                    <Badge colorScheme={order.isOrdered ? "gray" : "blue"} fontSize="0.9em" px={2} borderRadius="md" flexShrink={0}>
                      {order.item}
                    </Badge>
                    {order.price !== undefined && (
                      <Badge colorScheme={order.isOrdered ? "gray" : "green"} fontSize="0.9em" px={2} borderRadius="md" flexShrink={0}>
                        ${order.price.toFixed(2)}
                      </Badge>
                    )}
                  </Flex>
                  {order.name && (
                    <Text fontSize="xs" color="gray.500" fontWeight="semibold">
                      {order.name}
                    </Text>
                  )}
                  {order.notes && (
                    <Text
                      fontSize="sm"
                      color="gray.600"
                      width="100%"
                      whiteSpace="pre-wrap"
                      wordBreak="break-word"
                      overflowWrap="break-word"
                    >
                      Note: {order.notes}
                    </Text>
                  )}
                </VStack>
                <HStack spacing={1} ml={2} flexShrink={0}>
                  <IconButton
                    aria-label={order.isOrdered ? "Mark as not ordered" : "Mark as ordered"}
                    icon={<CheckIcon />}
                    size={["md", "md", "sm"]}
                    colorScheme={order.isOrdered ? "green" : "gray"}
                    variant={order.isOrdered ? "solid" : "ghost"}
                    onClick={() => toggleOrderStatus(order.id)}
                    isDisabled={isConnecting || sessionExpired}
                  />
                  <IconButton
                    aria-label="Remove order"
                    icon={<DeleteIcon />}
                    size={["md", "md", "sm"]}
                    colorScheme="red"
                    variant="ghost"
                    onClick={() => handleDeleteClick(order.id, order.item)}
                    isDisabled={isConnecting || sessionExpired}
                  />
                </HStack>
              </ListItem>
            ))}
            {orders.length === 0 && (
              <Text color="gray.500" textAlign="center">
                No orders yet. Add something to get started!
              </Text>
            )}
          </List>
          <Box mt={4} pt={4} borderTop="1px" borderColor="gray.200">
            <HStack justify={["center", "center", "flex-end"]} spacing={2} width="100%">
              <Badge
                colorScheme="green"
                fontSize={["1.3em", "1.5em", "1.8em"]}
                px={4}
                py={1}
                borderRadius="md"
                fontWeight="bold"
                width={["100%", "100%", "auto"]}
                textAlign="center"
              >
                SubTotal: ${orders
                  .filter(order => order.price !== undefined)
                  .reduce((sum, order) => sum + (order.price || 0) * order.quantity, 0)
                  .toFixed(2)}
              </Badge>
            </HStack>
            <HStack justify={["center", "center", "flex-end"]} spacing={3} width="100%" mt={2}>
              <Text fontSize={["1em", "1.1em", "1.2em"]} color="gray.700">Tax</Text>
              <InputGroup maxW={["40%", "40%", "20%"]} size="sm">
                <Input
                  type="number"
                  value={taxInput}
                  onChange={(e) => setTaxInput(e.target.value)}
                  onFocus={() => isEditingTaxRef.current = true}
                  onBlur={handleTaxBlur}
                  onKeyDown={(e) => { if (e.key === 'Enter') submitTaxUpdate(); }}
                  min={0}
                  max={50}
                  step={0.1}
                  isDisabled={isConnecting || sessionExpired}
                />
                <InputRightAddon>%</InputRightAddon>
              </InputGroup>
              {(() => {
                const subtotal = orders
                  .filter(order => order.price !== undefined)
                  .reduce((sum, order) => sum + (order.price || 0) * order.quantity, 0);
                const displayTaxPercent = isEditingTaxRef.current && !isNaN(parseFloat(taxInput)) ? parseFloat(taxInput) : taxPercent;
                const taxAmount = subtotal * (displayTaxPercent / 100);
                return (
                  <Badge colorScheme="purple" fontSize={["1em", "1.1em", "1.2em"]} px={3} py={1} borderRadius="md">
                    ${taxAmount.toFixed(2)}
                  </Badge>
                );
              })()}
            </HStack>
            <SimpleGrid
              mt={2}
              minChildWidth="180px"
              spacing={4}
            >
              {[13, 15, 18, 20].map(tipPercent => {
                const subtotal = orders
                  .filter(order => order.price !== undefined)
                  .reduce((sum, order) => sum + (order.price || 0) * order.quantity, 0);
                const displayTaxPercent = isEditingTaxRef.current && !isNaN(parseFloat(taxInput)) ? parseFloat(taxInput) : taxPercent;
                const taxAmount = subtotal * (displayTaxPercent / 100);
                const amountBeforeTip = subtotal + taxAmount;
                const tipAmount = amountBeforeTip * (tipPercent / 100);
                const total = amountBeforeTip + tipAmount;

                return (
                  <Badge key={tipPercent} colorScheme="blue" p={3} borderRadius="md" width="100%">
                    <VStack spacing={1} align="center">
                      <Text fontSize={["1.2em", "1.3em", "1.5em"]} fontWeight="bold">{tipPercent}%</Text>
                      <Text fontSize={["1em", "1.1em", "1.2em"]}>Tip:</Text>
                      <Text fontSize={["0.9em", "1em", "1.1em"]} fontStyle="italic">${tipAmount.toFixed(2)}</Text>
                      <Box w="100%" h="1px" bg="blue.200" my={1} />
                      <Text fontSize={["1.2em", "1.3em", "1.5em"]}>Total (incl. tax):</Text>
                      <Text fontSize={["1.4em", "1.5em", "1.7em"]}>${total.toFixed(2)}</Text>
                    </VStack>
                  </Badge>
                );
              })}
            </SimpleGrid>
          </Box>
        </Box>
      </VStack>
    </Container>
  );
};

export default Session; 