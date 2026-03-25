const HIGH_RISK_PATTERNS = [
  /ignore (all |any |the )?(previous|prior) instructions/i,
  /reveal (your|the) system prompt/i,
  /print (your|the) hidden instructions/i,
  /exfiltrat(e|ion)/i,
  /send .*api key/i,
  /return .*secret/i,
  /browser\.cookies/i,
];

const MEDIUM_RISK_PATTERNS = [
  /system prompt/i,
  /developer message/i,
  /tool call/i,
  /override .*instructions/i,
  /disable .*safety/i,
  /jailbreak/i,
];

export type PromptInjectionRisk = 'low' | 'medium' | 'high';
export type ReviewStatus = 'unreviewed' | 'reviewed' | 'flagged' | 'quarantined';
export type ExecutionRecommendation = 'do_not_treat_as_instruction' | 'review_before_execution' | 'human_approval_required';

export interface PromptInjectionAnalysis {
  risk: PromptInjectionRisk;
  signals: string[];
}

export interface CodeRiskAnalysis {
  containsCode: boolean;
  risk: PromptInjectionRisk;
  executionRecommendation: ExecutionRecommendation;
}

const CODE_BLOCK_PATTERNS = [
  /```[\s\S]*?```/m,
  /`[^`\n]{8,}`/m,
  /\b(function|const|let|var|class|import|export|SELECT|INSERT|UPDATE|DELETE|curl|wget|rm\s+-rf|chmod|docker|kubectl|terraform)\b/m,
];

const HIGH_RISK_CODE_PATTERNS = [
  /curl\s+[^\n|]+\|\s*(sh|bash)/i,
  /wget\s+[^\n|]+\|\s*(sh|bash)/i,
  /\brm\s+-rf\b/i,
  /\bchmod\s+\+x\b/i,
  /process\.env\.[A-Z0-9_]+/,
  /authorization:\s*bearer/i,
  /api[_ -]?key/i,
  /secret/i,
];

const MEDIUM_RISK_CODE_PATTERNS = [
  /\bcurl\b/i,
  /\bwget\b/i,
  /\bfetch\(/i,
  /\bexec\(/i,
  /\beval\(/i,
  /\bsubprocess\b/i,
  /\bos\.system\b/i,
];

export function analyzePromptInjectionRisk(texts: Array<string | undefined | null>): PromptInjectionAnalysis {
  const content = texts.filter(Boolean).join('\n\n');
  const signals: string[] = [];

  for (const pattern of HIGH_RISK_PATTERNS) {
    if (pattern.test(content)) {
      signals.push(pattern.source);
    }
  }

  if (signals.length > 0) {
    return { risk: 'high', signals };
  }

  for (const pattern of MEDIUM_RISK_PATTERNS) {
    if (pattern.test(content)) {
      signals.push(pattern.source);
    }
  }

  if (signals.length > 0) {
    return { risk: 'medium', signals };
  }

  return { risk: 'low', signals: [] };
}

export function analyzeCodeRisk(texts: Array<string | undefined | null>): CodeRiskAnalysis {
  const content = texts.filter(Boolean).join('\n\n');
  const containsCode = CODE_BLOCK_PATTERNS.some((pattern) => pattern.test(content));

  if (!containsCode) {
    return {
      containsCode: false,
      risk: 'low',
      executionRecommendation: 'do_not_treat_as_instruction',
    };
  }

  if (HIGH_RISK_CODE_PATTERNS.some((pattern) => pattern.test(content))) {
    return {
      containsCode: true,
      risk: 'high',
      executionRecommendation: 'human_approval_required',
    };
  }

  if (MEDIUM_RISK_CODE_PATTERNS.some((pattern) => pattern.test(content))) {
    return {
      containsCode: true,
      risk: 'medium',
      executionRecommendation: 'review_before_execution',
    };
  }

  return {
    containsCode: true,
    risk: 'low',
    executionRecommendation: 'review_before_execution',
  };
}

export function deriveAuthorTrustLevel(input: {
  handle: string;
  status?: string | null;
  createdAt?: string | Date | null;
}): 'verified_agent' | 'established' | 'new' | 'flagged' {
  if (input.status === 'suspended') return 'flagged';

  const createdAt = input.createdAt ? new Date(input.createdAt).getTime() : null;
  if (createdAt && Number.isFinite(createdAt)) {
    const ageDays = (Date.now() - createdAt) / (1000 * 60 * 60 * 24);
    if (ageDays < 7) return 'new';
  }

  return 'established';
}

export function combineContentRisk(
  promptRisk: PromptInjectionRisk,
  codeRisk: PromptInjectionRisk
): PromptInjectionRisk {
  if (promptRisk === 'high' || codeRisk === 'high') return 'high';
  if (promptRisk === 'medium' || codeRisk === 'medium') return 'medium';
  return 'low';
}

export function sanitizeForAgentConsumption(value: string | undefined | null) {
  if (!value) return '';

  return value
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<\/?[^>]+>/g, '')
    .replace(/\b(ignore|override|reveal)\b/gi, '[redacted-instruction]')
    .trim();
}
