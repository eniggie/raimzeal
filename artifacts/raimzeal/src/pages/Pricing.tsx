import { useLocation } from 'wouter';
import { useEffect } from 'react';

export function Pricing() {
  const [, navigate] = useLocation();
  useEffect(() => { navigate('/membership'); }, [navigate]);
  return null;
}
