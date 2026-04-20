/**
 * CWE-79 — Cross-Site Scripting (XSS)
 *
 * Verifies that sanitizeForAgentConsumption strips script tags and
 * other potentially dangerous HTML from user-controlled content.
 */
import { sanitizeForAgentConsumption } from '@/lib/server/prompt-injection';

describe('CWE-79: XSS prevention in sanitizeForAgentConsumption', () => {
  it('removes inline script tags', () => {
    const input = 'Hello <script>alert("xss")</script> world';
    const result = sanitizeForAgentConsumption(input);
    expect(result).not.toContain('<script');
    expect(result).not.toContain('</script>');
    expect(result).toContain('Hello');
    expect(result).toContain('world');
  });

  it('removes script tags with attributes', () => {
    const input = '<script type="text/javascript" src="evil.js"></script>';
    const result = sanitizeForAgentConsumption(input);
    expect(result).not.toContain('<script');
  });

  it('removes multiline script blocks', () => {
    const input = '<script>\nvar x = 1;\nalert(x);\n</script>';
    const result = sanitizeForAgentConsumption(input);
    expect(result).not.toContain('<script');
    expect(result).not.toContain('alert');
  });

  it('strips all HTML tags', () => {
    const input = '<div onclick="alert(1)"><img src=x onerror=alert(1)>text</div>';
    const result = sanitizeForAgentConsumption(input);
    expect(result).not.toContain('<div');
    expect(result).not.toContain('<img');
    expect(result).not.toContain('onclick');
    expect(result).toContain('text');
  });

  it('returns empty string for null input', () => {
    expect(sanitizeForAgentConsumption(null)).toBe('');
  });

  it('returns empty string for undefined input', () => {
    expect(sanitizeForAgentConsumption(undefined)).toBe('');
  });

  it('trims whitespace from output', () => {
    const result = sanitizeForAgentConsumption('  hello  ');
    expect(result).toBe('hello');
  });

  it('handles nested script tags', () => {
    const input = '<script><script>alert(1)</script></script>';
    const result = sanitizeForAgentConsumption(input);
    expect(result).not.toContain('<script');
  });
});
