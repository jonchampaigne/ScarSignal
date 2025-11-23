import React, { useState, useEffect, useRef } from 'react';

interface TerminalInputProps {
  onSubmit: (value: string) => void;
  disabled: boolean;
  location: string;
  user?: string;
  host?: string;
}

const TerminalInput: React.FC<TerminalInputProps> = ({ 
  onSubmit, 
  disabled, 
  location = "~", 
  user = "kaia", 
  host = "deck-v1.5"
}) => {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const [currentTime, setCurrentTime] = useState("");

  // Keep focus on input unless user explicitly clicks away (CLI feel)
  useEffect(() => {
    if (!disabled && inputRef.current) {
      inputRef.current.focus();
    }
  }, [disabled]);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('en-GB', { hour12: false }));
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim() || disabled) return;
    onSubmit(value);
    setValue("");
  };

  return (
    <div className="w-full font-terminal text-sm md:text-base p-2 bg-black/50 border-t border-[#333]">
      <form onSubmit={handleSubmit} className="flex flex-col w-full">
        {/* Top Line: [User@Host]-[Path]-[Time] */}
        <div className="flex flex-wrap items-center space-x-0 mb-1 leading-none select-none">
          
          {/* Segment 1: User@Host */}
          <div className="flex bg-[#1a1a1a] text-xs md:text-sm">
            <div className="bg-[#2a2a2a] text-[#00ff9d] px-2 py-0.5 font-bold">
              ┌──({user}㉿{host})
            </div>
            <div className="text-[#2a2a2a] bg-[#1a1a1a] -ml-1 z-10"></div>
          </div>

          {/* Segment 2: Location */}
          <div className="flex bg-[#1a1a1a] text-xs md:text-sm">
             <div className="bg-[#1a1a1a] text-[#bd93f9] px-2 py-0.5 font-bold">
               -[{location}]
             </div>
          </div>
          
           {/* Segment 3: Time */}
           <div className="hidden md:flex ml-auto text-xs text-stone-600 px-2">
             [{currentTime}]
           </div>

        </div>

        {/* Bottom Line: Prompt + Input */}
        <div className="flex items-center w-full">
          <span className="text-[#00ff9d] font-bold mr-2 text-lg">└─$</span>
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={disabled}
            className="flex-1 bg-transparent border-none outline-none text-[#ffb000] placeholder-stone-700 font-bold"
            placeholder={disabled ? "PROCESSING SIGNAL..." : ""}
            autoComplete="off"
            autoCorrect="off"
            spellCheck="false"
          />
        </div>
      </form>
    </div>
  );
};

export default TerminalInput;