
import React from 'react';

const CreditCardIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    fill="none" 
    viewBox="0 0 24 24" 
    strokeWidth={2} 
    stroke="currentColor" 
    className={className}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-10.5-11.25h21a2.25 2.25 0 012.25 2.25v12a2.25 2.25 0 01-2.25 2.25h-21a2.25 2.25 0 01-2.25-2.25v-12a2.25 2.25 0 012.25-2.25z" />
  </svg>
);

export default CreditCardIcon;
