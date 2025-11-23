import React, { useState, useEffect } from 'react';

interface TypewriterTextProps {
  text: string;
  speed?: number;
  onComplete?: () => void;
}

const TypewriterText: React.FC<TypewriterTextProps> = ({ text, speed = 10, onComplete }) => {
  const [displayedText, setDisplayedText] = useState('');

  useEffect(() => {
    // If text is extremely long, speed it up automatically
    const adjustedSpeed = text.length > 500 ? speed / 2 : speed;
    let i = 0;
    
    setDisplayedText(''); // Reset on text change

    const timer = setInterval(() => {
      if (i < text.length) {
        // Add a few chars at once for performance if long text
        const chunk = text.slice(i, i + 3);
        setDisplayedText((prev) => prev + chunk);
        i += 3;
      } else {
        clearInterval(timer);
        setDisplayedText(text); // Ensure full text is there
        if (onComplete) onComplete();
      }
    }, adjustedSpeed);

    return () => clearInterval(timer);
  }, [text, speed, onComplete]);

  return <span>{displayedText}</span>;
};

export default TypewriterText;