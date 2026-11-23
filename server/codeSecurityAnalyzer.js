/**
 * ULTRON Code Security & Static Vulnerability Analyzer
 * Performs rule-based static security analysis on user-supplied code or project files.
 * Identifies injections, credential leaks, path traversals, unsafe deserialization,
 * weak crypto, and unhandled errors with severity ratings and remediation guidance.
 */

const fs = require('fs');
const path = require('path');

const SECURITY_RULES = [
  // 1. SQL Injection
  {
    id: 'SEC-SQL-001',
    category: 'SQL_INJECTION',
    severity: 'HIGH',
    title: 'Potential SQL Injection via String Concatenation',
    pattern: /(SELECT|INSERT|UPDATE|DELETE|DROP|UNION)\s+.*(\+|%s|\${|concat|format\(|\.format|f['"])/i,
    remediation: 'Use parameterized queries or prepared statements instead of dynamic SQL string formatting.'
  },

  // 2. Command Injection / Arbitrary Shell Execution
  {
    id: 'SEC-CMD-001',
    category: 'COMMAND_INJECTION',
    severity: 'CRITICAL',
    title: 'Arbitrary Shell Execution Primitive Detected',
    pattern: /(child_process\.exec\s*\(|child_process\.execSync\s*\(|Runtime\.getRuntime\(\)\.exec\s*\(|os\.system\s*\(|subprocess\.Popen\s*\(.*shell\s*=\s*True|\bsystem\s*\()/i,
    remediation: 'Avoid invoking the system shell with unvalidated input. Use parameterized spawn or allowlisted APIs.'
  },

  // 3. Hardcoded Secrets & Credentials
  {
    id: 'SEC-KEY-001',
    category: 'HARDCODED_SECRET',
    severity: 'CRITICAL',
    title: 'Exposed Hardcoded API Key or Secret',
    pattern: /(api[_-]?key|secret|password|auth_token|bearer|private_key)\s*[:=]\s*['"][A-Za-z0-9_\-\/+=]{16,}['"]/i,
    remediation: 'Store credentials in environment variables or a dedicated secret vault. Never hardcode keys in source code.'
  },
  {
    id: 'SEC-AWS-001',
    category: 'HARDCODED_SECRET',
    severity: 'CRITICAL',
    title: 'Hardcoded AWS Access Key',
    pattern: /AKIA[0-9A-Z]{16}/,
    remediation: 'Revoke this access key immediately and migrate to IAM roles or environment variables.'
  },
  {
    id: 'SEC-PK-001',
    category: 'HARDCODED_SECRET',
    severity: 'CRITICAL',
    title: 'Embedded RSA / Private Key Block',
    pattern: /-----BEGIN (RSA|OPENSSH|EC|PGP|ENCRYPTED)?\s?PRIVATE KEY-----/,
    remediation: 'Remove the private key from the codebase and ensure it is not tracked in version control.'
  },

  // 4. Insecure Deserialization & Dynamic Code Execution
  {
    id: 'SEC-EVAL-001',
    category: 'DANGEROUS_EVAL',
    severity: 'CRITICAL',
    title: 'Unsafe Dynamic Code Evaluation (eval / Function)',
    pattern: /(\beval\s*\(|new\s+Function\s*\(|pickle\.loads\s*\(|yaml\.load\s*\([^,)]*\))/i,
    remediation: 'Refactor away from dynamic code execution. For YAML/Pickle, use safe loaders (e.g. yaml.safe_load).'
  },

  // 5. Path Traversal & Unvalidated File Operations
  {
    id: 'SEC-PATH-001',
    category: 'PATH_TRAVERSAL',
    severity: 'HIGH',
    title: 'Potential Path Traversal in File Access',
    pattern: /(fs\.(readFile|writeFile|unlink|createReadStream|createWriteStream)|open)\s*\([^)]*(\.\.|\+.*req\.|req\.params|req\.query)/i,
    remediation: 'Resolve and sanitize all file paths using path.normalize and verify they reside within the intended directory.'
  },

  // 6. Cross-Site Scripting (XSS)
  {
    id: 'SEC-XSS-001',
    category: 'CROSS_SITE_SCRIPTING',
    severity: 'HIGH',
    title: 'Unsafe HTML Injection (innerHTML / dangerouslySetInnerHTML)',
    pattern: /(\.innerHTML\s*=|\.outerHTML\s*=|dangerouslySetInnerHTML\s*=|document\.write\s*\()/i,
    remediation: 'Use textContent, innerText, or a DOM sanitization library like DOMPurify before rendering HTML.'
  },

  // 7. Weak Cryptography & Pseudo-Randomness
  {
    id: 'SEC-CRYPTO-001',
    category: 'WEAK_CRYPTOGRAPHY',
    severity: 'MEDIUM',
    title: 'Deprecated Hash Algorithm (MD5 / SHA-1)',
    pattern: /(createHash\s*\(\s*['"](md5|sha1)['"]|MessageDigest\.getInstance\s*\(\s*['"](MD5|SHA-1)['"]|hashlib\.(md5|sha1)\s*\()/i,
    remediation: 'Upgrade to SHA-256, SHA-512, or argon2/bcrypt for password hashing.'
  },
  {
    id: 'SEC-RAND-001',
    category: 'INSECURE_RANDOM',
    severity: 'LOW',
    title: 'Non-Cryptographic Pseudo-Random Number Generator',
    pattern: /Math\.random\s*\(\)|random\.random\s*\(\)|rand\s*\(\)/,
    remediation: 'For security-sensitive contexts (tokens, salts, keys), use crypto.getRandomValues() or secrets module.'
  },

  // 8. Unhandled Promise Rejections & Resource Leaks
  {
    id: 'SEC-RES-001',
    category: 'RESOURCE_LEAK',
    severity: 'LOW',
    title: 'Missing Catch Handler on Async Operation',
    pattern: /\.then\s*\([^)]+\)(?!\s*\.catch)/,
    remediation: 'Ensure all asynchronous operations have explicit .catch handlers or try/catch blocks.'
  }
];

/**
 * Analyzes arbitrary code strings against security rules
 */
function analyzeCode(codeString, filename = 'snippet') {
  if (!codeString || typeof codeString !== 'string') {
    return {
      filename,
      findings: [],
      summary: { total: 0, critical: 0, high: 0, medium: 0, low: 0 },
      spokenSummary: 'No code provided for security inspection.'
    };
  }

  const lines = codeString.split(/\r?\n/);
  const findings = [];
  const severityCounts = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0 };

  lines.forEach((line, idx) => {
    const lineNum = idx + 1;
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('#')) return;

    for (const rule of SECURITY_RULES) {
      if (rule.pattern.test(line)) {
        findings.push({
          id: rule.id,
          category: rule.category,
          severity: rule.severity,
          title: rule.title,
          line: lineNum,
          evidence: trimmed.length > 120 ? trimmed.substring(0, 117) + '...' : trimmed,
          remediation: rule.remediation
        });
        severityCounts[rule.severity]++;
      }
    }
  });

  // Compose authoritative spoken summary for ULTRON
  let spokenSummary;
  if (findings.length === 0) {
    spokenSummary = `Static security analysis complete. Inspected ${lines.length} lines of code. Zero rule violations detected. Static verification does not guarantee absolute runtime security.`;
  } else {
    const critAndHigh = severityCounts.CRITICAL + severityCounts.HIGH;
    spokenSummary = `Security analysis complete. Inspected ${lines.length} lines. Identified ${findings.length} potential issues: ${severityCounts.CRITICAL} critical, ${severityCounts.HIGH} high, and ${severityCounts.MEDIUM} medium. Primary finding: ${findings[0].title} on line ${findings[0].line}. Recommended action: ${findings[0].remediation}`;
  }

  return {
    filename,
    linesCount: lines.length,
    findings,
    summary: {
      total: findings.length,
      ...severityCounts
    },
    spokenSummary
  };
}

/**
 * Safely inspects files in an allowlisted directory
 */
function analyzeProjectFile(filePath, workspaceRoot) {
  const normalized = path.normalize(filePath);
  const root = path.normalize(workspaceRoot || process.cwd());

  if (!normalized.startsWith(root)) {
    throw new Error('Access denied: target path is outside allowed workspace.');
  }

  const content = fs.readFileSync(normalized, 'utf8');
  return analyzeCode(content, path.basename(normalized));
}

const codeSecurityAnalyzerInstance = {
  auditFile(filePath, workspaceRoot) {
    const res = analyzeProjectFile(filePath, workspaceRoot);
    const crit = (res.summary && res.summary.CRITICAL) || 0;
    const high = (res.summary && res.summary.HIGH) || 0;
    const med = (res.summary && res.summary.MEDIUM) || 0;
    const low = (res.summary && res.summary.LOW) || 0;
    const riskScore = Math.min(100, crit * 30 + high * 20 + med * 10 + low * 5);
    return {
      filename: res.filename,
      issues: res.findings,
      findings: res.findings,
      summary: res.summary,
      riskScore,
      spokenSummary: res.spokenSummary
    };
  },
  analyzeCode,
  analyzeProjectFile
};

module.exports = {
  analyzeCode,
  analyzeProjectFile,
  codeSecurityAnalyzerInstance,
  SECURITY_RULES
};
