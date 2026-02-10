import { useState } from "react";
import { Input, InputGroup, HStack, IconButton } from "@chakra-ui/react";
import { FiEye, FiEyeOff, FiCopy } from "react-icons/fi";
import { toaster } from "../ui/toaster";

interface MaskedInputProps {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
}

export function MaskedInput({
  value,
  onChange,
  placeholder,
  label,
}: MaskedInputProps) {
  const [showValue, setShowValue] = useState(false);

  const handleCopy = () => {
    if (value) {
      navigator.clipboard.writeText(value);
      toaster.create({ title: "Copied to clipboard", type: "success" });
    }
  };

  return (
    <InputGroup>
      <HStack width="100%">
        <Input
          type={showValue ? "text" : "password"}
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-label={label}
        />
        <IconButton
          aria-label={showValue ? "Hide value" : "Show value"}
          onClick={() => setShowValue(!showValue)}
          size="sm"
          variant="ghost"
        >
          {showValue ? <FiEyeOff /> : <FiEye />}
        </IconButton>
        <IconButton
          aria-label="Copy value"
          onClick={handleCopy}
          size="sm"
          variant="ghost"
          disabled={!value}
        >
          <FiCopy />
        </IconButton>
      </HStack>
    </InputGroup>
  );
}
