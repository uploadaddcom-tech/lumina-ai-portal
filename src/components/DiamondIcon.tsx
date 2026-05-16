import React from 'react';

export function DiamondIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg 
      viewBox="0 0 100 100" 
      className={className}
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Faceted Diamond shape based on user input */}
      {/* Top Section */}
      <path d="M20 35L50 10L80 35H20Z" fill="#29B6F6" />
      <path d="M50 10L80 35L95 35L75 10L50 10Z" fill="#0288D1" />
      <path d="M50 10L20 35L5 35L25 10L50 10Z" fill="#81D4FA" />
      
      {/* Bottom Section */}
      <path d="M20 35L50 90L50 55L20 35Z" fill="#03A9F4" />
      <path d="M80 35L50 90L50 55L80 35Z" fill="#0D47A1" />
      
      {/* Middle Front Facets */}
      <path d="M20 35L50 55L80 35H20Z" fill="#00B0FF" />
      
      {/* Side Profile Facets */}
      <path d="M5 35L20 35L50 90L5 35Z" fill="#00E5FF" />
      <path d="M95 35L80 35L50 90L95 35Z" fill="#1565C0" />
      
      {/* Highlights */}
      <path d="M35 25L50 15L65 25L50 35L35 25Z" fill="white" fillOpacity="0.2" />
      
      {/* Sparkles */}
      <circle cx="30" cy="30" r="2" fill="white">
        <animate attributeName="opacity" values="0;1;0" dur="2s" repeatCount="indefinite" />
      </circle>
      <circle cx="70" cy="40" r="1.5" fill="white">
        <animate attributeName="opacity" values="0;1;0" dur="1.5s" repeatCount="indefinite" begin="0.5s" />
      </circle>
    </svg>
  );
}
