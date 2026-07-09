export interface ValidationResult {
  valid: boolean;
  message?: string;
  suggestion?: string;
}

export function validatePort(value: string): ValidationResult {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return {
      valid: false,
      message: `PORT must be a number between 1 and 65535`,
      suggestion: `PORT=3000`,
    };
  }
  return { valid: true };
}

export function validateUrl(value: string): ValidationResult {
  if (!value.includes('://')) {
    return {
      valid: false,
      message: 'Invalid URL — missing protocol',
      suggestion: `Did you mean https://${value} or a protocol-specific URL?`,
    };
  }

  try {
    const url = new URL(value);
    if (!url.protocol || url.protocol === ':') {
      throw new Error('Missing protocol');
    }
    return { valid: true };
  } catch {
    return {
      valid: false,
      message: 'Invalid URL',
      suggestion: `Check the URL format`,
    };
  }
}

export function validateNodeEnv(value: string): ValidationResult {
  const allowed = ['development', 'production', 'test'];
  if (!allowed.includes(value)) {
    return {
      valid: false,
      message: `NODE_ENV should be 'development', 'production', or 'test'`,
      suggestion: `NODE_ENV=${value === 'dev' ? 'development' : value === 'prod' ? 'production' : 'development'}`,
    };
  }
  return { valid: true };
}

export function validateSecret(value: string, key: string): ValidationResult {
  const forbidden = ['default', 'secret', 'test', 'password', '123456'];
  if (value.length < 16) {
    return {
      valid: false,
      message: `${key} is too short (${value.length} characters)`,
      suggestion: `Use at least 16 random characters. Generate one: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`,
    };
  }
  if (forbidden.includes(value.toLowerCase())) {
    return {
      valid: false,
      message: `${key} uses a weak placeholder value`,
      suggestion: `Generate a strong random secret`,
    };
  }
  return { valid: true };
}

export function validateBoolean(value: string, key: string): ValidationResult {
  const normalized = value.toLowerCase();
  if (normalized === 'true' || normalized === 'false') {
    return { valid: true };
  }
  const boolMap: Record<string, string> = {
    yes: 'true',
    no: 'false',
    '1': 'true',
    '0': 'false',
    on: 'true',
    off: 'false',
  };
  if (normalized in boolMap) {
    return {
      valid: false,
      message: `${key} should be 'true' or 'false' for boolean values`,
      suggestion: `${key}=${boolMap[normalized]}`,
    };
  }
  return {
    valid: false,
    message: `${key} is not a valid boolean value`,
    suggestion: `${key}=true`,
  };
}

export function isSecretKey(key: string): boolean {
  const secretPatterns = /SECRET|KEY|TOKEN|PASSWORD|PRIVATE|ACCESS|CREDENTIAL|AUTH/i;
  return secretPatterns.test(key);
}
