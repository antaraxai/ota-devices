// Environment configuration for Antara
// This file serves as a centralized place for environment-specific configuration

// Stripe checkout URLs
export const STRIPE_URLS = {
  production: {
    pro: import.meta.env.VITE_STRIPE_PRO_URL || 'https://buy.stripe.com/14kg26getfNx3rW3cd',
    free: import.meta.env.VITE_STRIPE_FREE_URL || 'https://buy.stripe.com/8wMg268M1atd1jO5km'
  },
  test: {
    pro: import.meta.env.VITE_STRIPE_TEST_PRO_URL || 'https://buy.stripe.com/test_bIYeVF0aba3t4PmdQS',
    free: import.meta.env.VITE_STRIPE_TEST_FREE_URL || 'https://buy.stripe.com/test_5kAdRB4qrdfF4PmbIJ'
  }
};

// Default environment mode
export const DEFAULT_TEST_MODE = import.meta.env.VITE_DEFAULT_TEST_MODE === 'true';

// API endpoints
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001';
