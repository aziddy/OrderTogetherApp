import React from 'react';
import { ChakraProvider, Container } from '@chakra-ui/react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './components/Home';
import Session from './components/Session';

function App() {
  return (
    <ChakraProvider>
      <Router>
        <Container maxW="container.xl" py={8}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/session/:sessionId" element={<Session />} />
          </Routes>
        </Container>
      </Router>
    </ChakraProvider>
  );
}

export default App;
