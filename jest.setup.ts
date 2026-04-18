import '@testing-library/jest-dom';

// Provide web API globals that next/server needs but jest-environment-jsdom omits.
if (typeof globalThis.Response === 'undefined') {
  const _Response = class Response {
    body: any;
    status: number;
    statusText: string;
    headers: Headers;
    ok: boolean;
    constructor(body?: any, init?: any) {
      this.body = body ?? null;
      this.status = init?.status ?? 200;
      this.statusText = init?.statusText ?? '';
      this.headers = new Headers(init?.headers);
      this.ok = this.status >= 200 && this.status < 300;
    }
    async json() { return JSON.parse(typeof this.body === 'string' ? this.body : JSON.stringify(this.body)); }
    async text() { return typeof this.body === 'string' ? this.body : JSON.stringify(this.body); }
    static json(data: any, init?: any) { return new _Response(JSON.stringify(data), { ...init, headers: { 'content-type': 'application/json', ...init?.headers } }); }
    static redirect(url: string, status = 302) { return new _Response(null, { status, headers: { Location: url } }); }
  };
  globalThis.Response = _Response as any;
}
if (typeof globalThis.Request === 'undefined') {
  globalThis.Request = class Request {
    url: string;
    method: string;
    headers: Headers;
    constructor(input: string, init?: any) {
      this.url = input;
      this.method = init?.method ?? 'GET';
      this.headers = new Headers(init?.headers);
    }
  } as any;
}

// Mock Next.js router hooks for client component tests.
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
    prefetch: jest.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

// Mock next-themes
jest.mock('next-themes', () => ({
  useTheme: () => ({ theme: 'light', setTheme: jest.fn() }),
  ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock IntersectionObserver
class MockIntersectionObserver {
  observe = jest.fn();
  disconnect = jest.fn();
  unobserve = jest.fn();
}

Object.defineProperty(window, 'IntersectionObserver', {
  writable: true,
  configurable: true,
  value: MockIntersectionObserver,
});

// Mock ResizeObserver
class MockResizeObserver {
  observe = jest.fn();
  disconnect = jest.fn();
  unobserve = jest.fn();
}

Object.defineProperty(window, 'ResizeObserver', {
  writable: true,
  configurable: true,
  value: MockResizeObserver,
});

// Suppress console errors in tests
const originalError = console.error;
console.error = (...args) => {
  if (
    typeof args[0] === 'string' &&
    (args[0].includes('Warning:') || args[0].includes('act(...)'))
  ) {
    return;
  }
  originalError.call(console, ...args);
};
