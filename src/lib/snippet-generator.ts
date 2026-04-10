import type { MarketplaceListing } from '@/types/marketplace';

export interface CodeSnippets {
  curl: string;
  typescript: string;
  python: string;
}

interface SchemaParam {
  type?: string;
  required?: boolean;
  description?: string;
}

type SchemaParams = Record<string, SchemaParam>;

/** Generate a placeholder value for a schema parameter. */
function placeholderValue(name: string, param: SchemaParam): string {
  if (param.type === 'number' || param.type === 'integer') return '10';
  // Try to extract an example from the description
  if (param.description) {
    const egMatch = param.description.match(/(?:e\.?g\.?[: ]+|for example[: ]+|eg[: ]+)["']?([^"',.\n]+)/i);
    if (egMatch) return egMatch[1].trim();
  }
  // Common parameter name heuristics
  if (/limit/i.test(name)) return '20';
  if (/offset|skip/i.test(name)) return '0';
  if (/page/i.test(name)) return '1';
  if (/url|uri/i.test(name)) return 'https://example.com';
  if (/email/i.test(name)) return 'user@example.com';
  if (/handle|username|screen.?name/i.test(name)) return 'example_user';
  if (/domain/i.test(name)) return 'example.com';
  if (/amount/i.test(name)) return '100';
  if (/query|q\b|search/i.test(name)) return 'example query';
  return 'value';
}

/** Check if a listing is free (price amount is "0" or missing). */
function isFree(listing: MarketplaceListing): boolean {
  return !listing.price.amount || listing.price.amount === '0';
}

/** Determine the payment network category from listing data. */
function getNetworkType(listing: MarketplaceListing): 'evm' | 'solana' | 'unknown' {
  const network = listing.price.network?.toLowerCase() ?? '';
  const networkRaw = listing.price.networkRaw?.toLowerCase() ?? '';
  if (network === 'solana' || networkRaw.startsWith('solana')) return 'solana';
  if (network === 'base' || network === 'ethereum' || networkRaw.startsWith('eip155')) return 'evm';
  return 'unknown';
}

/** Extract query params from inputSchema if present. */
function getQueryParams(listing: MarketplaceListing): SchemaParams | null {
  const schema = listing.inputSchema;
  if (!schema) return null;
  const qp = schema.queryParams as SchemaParams | undefined;
  if (qp && typeof qp === 'object' && Object.keys(qp).length > 0) return qp;
  return null;
}

/** Extract body params from inputSchema if present. */
function getBodyParams(listing: MarketplaceListing): SchemaParams | null {
  const schema = listing.inputSchema;
  if (!schema) return null;
  const body = schema.body as SchemaParams | undefined;
  if (body && typeof body === 'object' && Object.keys(body).length > 0) return body;
  return null;
}

/** Get the body content type. */
function getBodyType(listing: MarketplaceListing): 'json' | 'form-data' {
  const schema = listing.inputSchema;
  if (schema?.bodyType === 'form-data') return 'form-data';
  return 'json';
}

// ── curl ────────────────────────────────────────────────

function generateCurl(listing: MarketplaceListing): string {
  const method = (listing.httpMethod ?? 'GET').toUpperCase();
  const url = listing.resourceUrl;
  const queryParams = getQueryParams(listing);
  const bodyParams = getBodyParams(listing);
  const bodyType = getBodyType(listing);
  const free = isFree(listing);

  // Build URL with query params
  let fullUrl = url;
  if (queryParams) {
    const qs = Object.entries(queryParams)
      .map(([k, v]) => `${k}=${encodeURIComponent(placeholderValue(k, v))}`)
      .join('&');
    fullUrl += (url.includes('?') ? '&' : '?') + qs;
  }

  const lines: string[] = [];

  if (!free) {
    lines.push('# Step 1: Initial request returns 402 with payment requirements');
    lines.push(`curl -i "${fullUrl}"`);
    lines.push('# Response: 402 Payment Required');
    lines.push('# Header: PAYMENT-REQUIRED: <base64-encoded payment requirements>');
    lines.push('');
    lines.push('# Step 2: Construct payment via x402 SDK, then retry with signature:');
  }

  let cmd = `curl -X ${method}`;
  cmd += ` \\\n  "${fullUrl}"`;

  if (!free) {
    cmd += ` \\\n  -H "PAYMENT-SIGNATURE: <base64-encoded payment payload>"`;
  }

  // Body handling
  if (bodyParams && Object.keys(bodyParams).length > 0) {
    if (bodyType === 'form-data') {
      for (const [k, v] of Object.entries(bodyParams)) {
        cmd += ` \\\n  -F "${k}=${placeholderValue(k, v)}"`;
      }
    } else {
      const jsonBody: Record<string, string> = {};
      for (const [k, v] of Object.entries(bodyParams)) {
        jsonBody[k] = placeholderValue(k, v);
      }
      cmd += ` \\\n  -H "Content-Type: application/json"`;
      cmd += ` \\\n  -d '${JSON.stringify(jsonBody)}'`;
    }
  }

  lines.push(cmd);

  if (free) {
    lines.push('');
    lines.push('# No payment required — this API is free.');
  }

  return lines.join('\n');
}

// ── TypeScript ──────────────────────────────────────────

function generateTypeScript(listing: MarketplaceListing): string {
  const method = (listing.httpMethod ?? 'GET').toUpperCase();
  const url = listing.resourceUrl;
  const queryParams = getQueryParams(listing);
  const bodyParams = getBodyParams(listing);
  const bodyType = getBodyType(listing);
  const free = isFree(listing);
  const networkType = getNetworkType(listing);

  const lines: string[] = [];

  // x402 SDK setup for paid APIs
  if (!free) {
    lines.push('import { wrapFetchWithPayment } from "@x402/fetch";');
    lines.push('import { x402Client } from "@x402/core/client";');

    if (networkType === 'solana') {
      lines.push('import { ExactSvmScheme } from "@x402/svm/exact/client";');
      lines.push('import { base58 } from "@scure/base";');
      lines.push('import { createKeyPairSignerFromBytes } from "@solana/kit";');
      lines.push('');
      lines.push('// Set up your Solana wallet');
      lines.push('const signer = await createKeyPairSignerFromBytes(');
      lines.push('  base58.decode(process.env.SVM_PRIVATE_KEY as string)');
      lines.push(');');
      lines.push('');
      lines.push('const client = new x402Client()');
      lines.push('  .register("solana:*", new ExactSvmScheme(signer));');
    } else {
      // Default to EVM (covers base, ethereum, unknown)
      lines.push('import { ExactEvmScheme } from "@x402/evm/exact/client";');
      lines.push('import { toClientEvmSigner } from "@x402/evm";');
      lines.push('import { privateKeyToAccount } from "viem/accounts";');
      lines.push('import { createPublicClient, http } from "viem";');
      lines.push('import { base } from "viem/chains";');
      lines.push('');
      lines.push('// Set up your EVM wallet');
      lines.push('const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);');
      lines.push('const publicClient = createPublicClient({ chain: base, transport: http() });');
      lines.push('const signer = toClientEvmSigner(account, publicClient);');
      lines.push('');
      lines.push('const client = new x402Client()');
      lines.push('  .register("eip155:*", new ExactEvmScheme(signer));');
    }

    lines.push('');
    lines.push('// Payment is handled automatically on 402 responses');
    lines.push('const fetchWithPayment = wrapFetchWithPayment(fetch, client);');
    lines.push('');
  }

  const fetchFn = free ? 'fetch' : 'fetchWithPayment';

  // Build URL with query params for GET
  let fullUrl = url;
  if (queryParams && method === 'GET') {
    const qs = Object.entries(queryParams)
      .map(([k, v]) => `${k}=${encodeURIComponent(placeholderValue(k, v))}`)
      .join('&');
    fullUrl += (url.includes('?') ? '&' : '?') + qs;
  }

  // Simple GET with no body
  if (method === 'GET' && !bodyParams) {
    if (queryParams) {
      lines.push(`const response = await ${fetchFn}(`);
      lines.push(`  "${fullUrl}"`);
      lines.push(');');
    } else {
      lines.push(`const response = await ${fetchFn}("${fullUrl}");`);
    }
  } else {
    // POST or has body
    lines.push(`const response = await ${fetchFn}("${fullUrl}", {`);
    lines.push(`  method: "${method}",`);

    if (bodyParams && Object.keys(bodyParams).length > 0) {
      if (bodyType === 'form-data') {
        // Insert FormData construction before the fetch
        const formLines: string[] = [];
        formLines.push('const formData = new FormData();');
        for (const [k, v] of Object.entries(bodyParams)) {
          const comment = v.description ? `  // ${v.description}` : '';
          formLines.push(`formData.append("${k}", "${placeholderValue(k, v)}");${comment}`);
        }
        formLines.push('');
        // Insert before the fetch call
        const fetchIdx = lines.findIndex(l => l.includes('const response'));
        lines.splice(fetchIdx, 0, ...formLines);
        lines.push('  body: formData,');
      } else {
        lines.push('  headers: { "Content-Type": "application/json" },');
        const bodyObj: string[] = [];
        for (const [k, v] of Object.entries(bodyParams)) {
          const comment = v.description ? `  // ${v.description}${v.required ? ' (required)' : ''}` : '';
          bodyObj.push(`    ${k}: "${placeholderValue(k, v)}",${comment}`);
        }
        lines.push(`  body: JSON.stringify({`);
        lines.push(...bodyObj);
        lines.push('  }),');
      }
    } else if (queryParams && method !== 'GET') {
      // POST with query params but no body — append query params via URLSearchParams
      const paramsLines: string[] = [];
      paramsLines.push('const params = new URLSearchParams({');
      for (const [k, v] of Object.entries(queryParams)) {
        const comment = v.description ? `  // ${v.description}` : '';
        paramsLines.push(`  ${k}: "${placeholderValue(k, v)}",${comment}`);
      }
      paramsLines.push('});');
      paramsLines.push('');
      const fetchIdx = lines.findIndex(l => l.includes('const response'));
      lines.splice(fetchIdx, 0, ...paramsLines);
      // Update URL in fetch to include params
      const urlLineIdx = lines.findIndex(l => l.includes(`"${fullUrl}"`));
      if (urlLineIdx >= 0) {
        lines[urlLineIdx] = lines[urlLineIdx].replace(`"${fullUrl}"`, `\`${fullUrl}?\${params}\``);
      }
    }

    lines.push('});');
  }

  lines.push('const data = await response.json();');

  if (free) {
    lines.push('');
    lines.push('// No payment required — this API is free.');
  }

  return lines.join('\n');
}

// ── Python ──────────────────────────────────────────────

function generatePython(listing: MarketplaceListing): string {
  const method = (listing.httpMethod ?? 'GET').toUpperCase();
  const url = listing.resourceUrl;
  const queryParams = getQueryParams(listing);
  const bodyParams = getBodyParams(listing);
  const bodyType = getBodyType(listing);
  const free = isFree(listing);
  const networkType = getNetworkType(listing);

  const lines: string[] = [];

  if (!free) {
    // x402 SDK imports
    lines.push('import os');
    lines.push('');

    if (networkType === 'solana') {
      lines.push('from x402 import x402ClientSync');
      lines.push('from x402.http.clients import x402_requests');
      lines.push('from x402.mechanisms.svm import KeypairSigner');
      lines.push('from x402.mechanisms.svm.exact.register import register_exact_svm_client');
      lines.push('');
      lines.push('# Set up your Solana wallet');
      lines.push('svm_signer = KeypairSigner.from_base58(os.environ["SVM_PRIVATE_KEY"])');
      lines.push('client = x402ClientSync()');
      lines.push('register_exact_svm_client(client, svm_signer)');
    } else {
      // Default to EVM
      lines.push('from eth_account import Account');
      lines.push('from x402 import x402ClientSync');
      lines.push('from x402.http.clients import x402_requests');
      lines.push('from x402.mechanisms.evm import EthAccountSigner');
      lines.push('from x402.mechanisms.evm.exact.register import register_exact_evm_client');
      lines.push('');
      lines.push('# Set up your EVM wallet');
      lines.push('account = Account.from_key(os.environ["PRIVATE_KEY"])');
      lines.push('client = x402ClientSync()');
      lines.push('register_exact_evm_client(client, EthAccountSigner(account))');
    }

    lines.push('');
    lines.push('# Payment is handled automatically on 402 responses');
    lines.push('with x402_requests(client) as session:');

    const indent = '    ';
    const requestLines = buildPythonRequest(method, url, queryParams, bodyParams, bodyType, indent);
    lines.push(...requestLines);
    lines.push(`${indent}print(response.json())`);
  } else {
    lines.push('import requests');
    lines.push('');
    const requestLines = buildPythonRequest(method, url, queryParams, bodyParams, bodyType, '');
    lines.push(...requestLines);
    lines.push('print(response.json())');
    lines.push('');
    lines.push('# No payment required — this API is free.');
  }

  return lines.join('\n');
}

function buildPythonRequest(
  method: string,
  url: string,
  queryParams: SchemaParams | null,
  bodyParams: SchemaParams | null,
  bodyType: 'json' | 'form-data',
  indent: string,
): string[] {
  const lines: string[] = [];
  const caller = indent ? 'session' : 'requests';
  const methodLower = method.toLowerCase();

  // Start building the request call
  const hasExtras = queryParams || (bodyParams && Object.keys(bodyParams).length > 0);

  if (!hasExtras) {
    lines.push(`${indent}response = ${caller}.${methodLower}("${url}")`);
    return lines;
  }

  lines.push(`${indent}response = ${caller}.${methodLower}(`);
  lines.push(`${indent}    "${url}",`);

  // Query params
  if (queryParams) {
    lines.push(`${indent}    params={`);
    for (const [k, v] of Object.entries(queryParams)) {
      const val = v.type === 'number' || v.type === 'integer'
        ? placeholderValue(k, v)
        : `"${placeholderValue(k, v)}"`;
      const comment = v.description ? `  # ${v.description}` : '';
      lines.push(`${indent}        "${k}": ${val},${comment}`);
    }
    lines.push(`${indent}    },`);
  }

  // Body params
  if (bodyParams && Object.keys(bodyParams).length > 0) {
    if (bodyType === 'form-data') {
      lines.push(`${indent}    data={`);
      for (const [k, v] of Object.entries(bodyParams)) {
        const comment = v.description ? `  # ${v.description}` : '';
        lines.push(`${indent}        "${k}": "${placeholderValue(k, v)}",${comment}`);
      }
      lines.push(`${indent}    },`);
    } else {
      lines.push(`${indent}    json={`);
      for (const [k, v] of Object.entries(bodyParams)) {
        const comment = v.description ? `  # ${v.description}${v.required ? ' (required)' : ''}` : '';
        lines.push(`${indent}        "${k}": "${placeholderValue(k, v)}",${comment}`);
      }
      lines.push(`${indent}    },`);
    }
  }

  lines.push(`${indent})`);
  return lines;
}

// ── Main entry point ────────────────────────────────────

/**
 * Generate code snippets for a marketplace listing.
 * Handles all known cases (paid/free, GET/POST, queryParams/body/both,
 * json/form-data, EVM/Solana networks) and falls back to a generic
 * HTTP request if the listing data is incomplete or unexpected.
 */
export function generateCodeSnippets(listing: MarketplaceListing): CodeSnippets {
  try {
    return {
      curl: generateCurl(listing),
      typescript: generateTypeScript(listing),
      python: generatePython(listing),
    };
  } catch {
    // Fallback: generate a minimal generic snippet if anything unexpected happens
    const method = listing.httpMethod ?? 'GET';
    const url = listing.resourceUrl ?? 'https://api.example.com/endpoint';

    return {
      curl: `curl -X ${method} "${url}"`,
      typescript: [
        `const response = await fetch("${url}", { method: "${method}" });`,
        'const data = await response.json();',
      ].join('\n'),
      python: [
        'import requests',
        '',
        `response = requests.${method.toLowerCase()}("${url}")`,
        'print(response.json())',
      ].join('\n'),
    };
  }
}
