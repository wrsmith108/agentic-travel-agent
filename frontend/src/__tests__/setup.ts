import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock environment variables
process.env.VITE_API_BASE_URL = 'http://localhost:3001';
process.env.VITE_DEMO_MODE_ENABLED = 'true';
process.env.VITE_SHOW_DEMO_TOGGLE = 'true';
process.env.VITE_APP_NAME = 'Agentic Travel Agent';
process.env.VITE_APP_VERSION = '1.0.0';
process.env.VITE_DEFAULT_CURRENCY = 'CAD';
process.env.VITE_DEFAULT_TIMEZONE = 'America/Toronto';

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});