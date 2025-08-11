import { Box, Text } from '@chakra-ui/react';
import { Icon } from '@chakra-ui/react';

interface LogoProps {
  size?: string | number | (string | number)[];
  color?: string;
}

const Logo = ({ size = "40px", color = "teal.500" }: LogoProps) => {
  return (
    <Box display="flex" alignItems="center" gap={2}>
      {/* <Icon viewBox="0 0 24 24" boxSize={size} color={color}>
        <path
          fill="currentColor"
          d="M12,3L1,9L12,15L21,10.09V17H23V9M5,13.18V17.18L12,21L19,17.18V13.18L12,17L5,13.18Z"
        />
      </Icon> */}
      <Text
        fontSize={size}
        fontWeight="bold"
        color={color}
        display={["none", "none", "block"]}
      >
        Order Together
      </Text>
    </Box>
  );
};

export default Logo; 