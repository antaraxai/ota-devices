import React, { useEffect, useRef } from 'react';
import { Eyes } from '../utils/eyes';
import './CretaExpression.css';

interface CretaExpressionProps {
  className?: string;
  status: 'online' | 'offline' | 'updating';
  health: 'good' | 'warning' | 'critical';
}

const CretaExpression: React.FC<CretaExpressionProps> = ({ 
  className, 
  status,
  health
}) => {
  const eyesRef = useRef<Eyes | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Initialize eyes instance
  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      eyesRef.current = new Eyes();
      eyesRef.current.initialize(container);
    }

    return () => {
      if (eyesRef.current) {
        eyesRef.current.cleanup();
      }
    };
  }, []); // Only run once on mount

  // Update expression when status or health changes
  useEffect(() => {
    if (eyesRef.current) {
      const expression = 
        status === 'offline' ? 'sad' :
        status === 'updating' ? 'focused' :
        health === 'critical' ? 'angry' :
        health === 'warning' ? 'confused' : 'happy';

      console.log(`Setting expression: ${expression} for status: ${status}, health: ${health}`);
      eyesRef.current.express({ type: expression });
    }
  }, [status, health]);

  return (
    <div className={className} ref={containerRef}>
      <div className="face">
        <div className="eye left">
          <div className="eyelid upper"></div>
          <div className="eyelid lower"></div>
        </div>
        <div className="eye right">
          <div className="eyelid upper"></div>
          <div className="eyelid lower"></div>
        </div>
      </div>
    </div>
  );
};

export default CretaExpression; 