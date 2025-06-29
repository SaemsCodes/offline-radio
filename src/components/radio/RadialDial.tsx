
import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';

interface RadialDialProps {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  label: string;
  color: 'orange' | 'green' | 'blue';
}

export const RadialDial: React.FC<RadialDialProps> = ({
  value,
  min,
  max,
  onChange,
  disabled = false,
  label,
  color
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const dialRef = useRef<HTMLDivElement>(null);
  const startAngleRef = useRef(0);
  const startValueRef = useRef(value);

  const colorClasses = {
    orange: 'border-orange-400 bg-orange-400/10 shadow-orange-400/20',
    green: 'border-green-400 bg-green-400/10 shadow-green-400/20',
    blue: 'border-blue-400 bg-blue-400/10 shadow-blue-400/20'
  };

  const indicatorColors = {
    orange: 'bg-orange-400',
    green: 'bg-green-400',
    blue: 'bg-blue-400'
  };

  // Convert value to angle (0-270 degrees)
  const valueToAngle = (val: number) => {
    const normalizedValue = (val - min) / (max - min);
    return normalizedValue * 270 - 135; // -135 to +135 degrees
  };

  const angleToValue = (angle: number) => {
    const normalizedAngle = (angle + 135) / 270; // Convert back to 0-1 range
    const newValue = Math.round(min + normalizedAngle * (max - min));
    return Math.max(min, Math.min(max, newValue));
  };

  const getAngleFromPoint = (centerX: number, centerY: number, x: number, y: number) => {
    return Math.atan2(y - centerY, x - centerX) * (180 / Math.PI);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (disabled) return;
    
    e.preventDefault();
    setIsDragging(true);
    
    const rect = dialRef.current!.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    startAngleRef.current = getAngleFromPoint(centerX, centerY, e.clientX, e.clientY);
    startValueRef.current = value;

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging || disabled) return;

    const rect = dialRef.current!.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    const currentAngle = getAngleFromPoint(centerX, centerY, e.clientX, e.clientY);
    const angleDiff = currentAngle - startAngleRef.current;
    
    // Convert angle difference to value change
    const valueChange = (angleDiff / 270) * (max - min);
    const newValue = startValueRef.current + valueChange;
    
    const clampedValue = Math.max(min, Math.min(max, Math.round(newValue)));
    onChange(clampedValue);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };

  // Touch events for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    if (disabled) return;
    
    e.preventDefault();
    const touch = e.touches[0];
    setIsDragging(true);
    
    const rect = dialRef.current!.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    startAngleRef.current = getAngleFromPoint(centerX, centerY, touch.clientX, touch.clientY);
    startValueRef.current = value;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || disabled) return;
    
    e.preventDefault();
    const touch = e.touches[0];
    
    const rect = dialRef.current!.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    const currentAngle = getAngleFromPoint(centerX, centerY, touch.clientX, touch.clientY);
    const angleDiff = currentAngle - startAngleRef.current;
    
    const valueChange = (angleDiff / 270) * (max - min);
    const newValue = startValueRef.current + valueChange;
    
    const clampedValue = Math.max(min, Math.min(max, Math.round(newValue)));
    onChange(clampedValue);
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const currentAngle = valueToAngle(value);

  return (
    <div className="flex flex-col items-center">
      <div
        ref={dialRef}
        className={`relative w-16 h-16 rounded-full border-4 cursor-grab active:cursor-grabbing select-none shadow-lg transition-all ${
          disabled 
            ? 'border-gray-600 bg-gray-800/30 shadow-none' 
            : colorClasses[color]
        } ${isDragging ? 'scale-110 shadow-xl' : ''}`}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ 
          transition: isDragging ? 'none' : 'all 0.2s ease-out',
          touchAction: 'none'
        }}
      >
        {/* Enhanced Dial Markings */}
        {Array.from({ length: 21 }, (_, i) => {
          const angle = (i / 20) * 270 - 135;
          const isMajor = i % 5 === 0;
          const isActive = i <= ((value - min) / (max - min)) * 20;
          return (
            <div
              key={i}
              className={`absolute ${isMajor ? 'w-1 h-3' : 'w-0.5 h-2'} ${
                disabled 
                  ? 'bg-gray-600' 
                  : isActive 
                  ? indicatorColors[color] 
                  : 'bg-gray-600'
              } ${isMajor ? 'shadow-sm' : ''}`}
              style={{
                top: isMajor ? '2px' : '3px',
                left: '50%',
                transformOrigin: `center ${isMajor ? '30px' : '29px'}`,
                transform: `translateX(-50%) rotate(${angle}deg)`
              }}
            />
          );
        })}
        
        {/* Enhanced Center Indicator */}
        <motion.div
          className={`absolute w-1.5 h-7 ${disabled ? 'bg-gray-500' : indicatorColors[color]} rounded-full shadow-md`}
          style={{
            top: '6px',
            left: '50%',
            transformOrigin: 'center 26px',
            transform: `translateX(-50%) rotate(${currentAngle}deg)`
          }}
          animate={{ rotate: currentAngle }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        />
        
        {/* Enhanced Center Hub */}
        <div className={`absolute w-4 h-4 rounded-full top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 border-2 ${
          disabled 
            ? 'bg-gray-700 border-gray-600' 
            : `bg-gray-900 ${color === 'orange' ? 'border-orange-400' : color === 'green' ? 'border-green-400' : 'border-blue-400'}`
        } shadow-inner`} />
        
        {/* Tactical Texture Overlay */}
        <div className="absolute inset-1 rounded-full bg-gradient-to-br from-transparent via-white/5 to-transparent pointer-events-none" />
      </div>
      
      {/* Enhanced Label and Value Display */}
      <div className="mt-3 text-center bg-black/50 rounded px-2 py-1 border border-gray-700">
        <div className={`text-xs font-mono font-bold ${disabled ? 'text-gray-500' : color === 'orange' ? 'text-orange-400' : color === 'green' ? 'text-green-400' : 'text-blue-400'}`}>
          {label}
        </div>
        <div className={`text-sm font-bold font-mono ${disabled ? 'text-gray-500' : 'text-white'}`}>
          {value.toString().padStart(2, '0')}
        </div>
      </div>
    </div>
  );
};
