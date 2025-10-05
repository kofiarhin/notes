const fs = require('fs');
const path = require('path');

const parseArgs = () => {
  const defaults = {
    source: 'notes',
    out: 'giant_note.md',
    report: 'redaction_report.json'
  };
  process.argv.slice(2).forEach((arg) => {
    const [key, value] = arg.split('=');
    if (key && value) {
      const normalizedKey = key.replace(/^--/, '');
      if (normalizedKey in defaults) {
        defaults[normalizedKey] = value;
      }
    }
  });
  return defaults;
};

const IGNORE_DIRS = new Set(['node_modules', '.git', '.github', 'dist', 'build', '.venv', 'coverage', '.next', 'out']);
const ALLOWED_EXTENSIONS = new Set(['.md', '.txt', '.env', '.json', '.js', '.jsx', '.ts', '.tsx']);
const CODE_LANG_MAP = {
  '.js': 'javascript',
  '.jsx': 'jsx',
  '.ts': 'typescript',
  '.tsx': 'tsx',
  '.json': 'json',
  '.env': '',
  '.txt': '',
  '.md': ''
};

const sensitiveKeyPattern = /^(api[_-]?key|apikey|secret|token|access_token|private_key|client_secret|jwt_secret|password|pwd)$/i;
const jsonKeyRegex = new RegExp('("?(?:api[_-]?key|apikey|secret|token|access_token|private_key|client_secret|jwt_secret|password|pwd)"?\s*:\s*)(["\']?)([^"\'\n\r]*)(["\']?)', 'gi');
const envLineRegex = /^(\s*)([A-Za-z0-9_.-]+)(\s*=\s*)(.*)$/;

const privateKeyBlockRegex = /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----[\s\S]+?-----END (?:RSA |EC )?PRIVATE KEY-----/g;
const googleApiRegex = /AIza[0-9A-Za-z\-_]{35}/g;
const awsAccessKeyRegex = /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g;
const awsSecretRegex = /(aws_secret_access_key|AWS_SECRET_ACCESS_KEY)(\s*[:=]\s*)['"]?([A-Za-z0-9\/+=]{20,})['"]?/gi;
const stripeSecretRegex = /\bsk_(?:live|test)_[A-Za-z0-9]{24,}\b/g;
const jwtRegex = /\beyJ[A-Za-z0-9-_]{10,}\.[A-Za-z0-9-_]{10,}\.[A-Za-z0-9-_]{10,}\b/g;
const inlinePasswordRegex = /(password|pwd|pass)(\s*[:=]\s*)['"]?([^'"\s]+)['"]?/gi;
const genericSecretRegex = /\b([A-Fa-f0-9]{32,}|[A-Za-z0-9+/]{40,}={0,2})\b/g;

const trimTrailingWhitespace = (input) => input.replace(/[ \t]+$/gm, '');

const recordReplacement = (changes, type, placeholder, extra = {}) => {
  changes.push({ type, replacement: placeholder, ...extra });
};

const applyRedactions = (content) => {
  let updated = content;
  const changes = [];

  updated = updated.replace(privateKeyBlockRegex, () => {
    recordReplacement(changes, 'PRIVATE_KEY_BLOCK', '<<REDACTED_PRIVATE_KEY_BLOCK>>');
    return '<<REDACTED_PRIVATE_KEY_BLOCK>>';
  });

  updated = updated.replace(googleApiRegex, () => {
    recordReplacement(changes, 'GOOGLE_API_KEY', '<<REDACTED_GOOGLE_API_KEY>>');
    return '<<REDACTED_GOOGLE_API_KEY>>';
  });

  updated = updated.replace(awsAccessKeyRegex, () => {
    recordReplacement(changes, 'AWS_ACCESS_KEY', '<<REDACTED_AWS_ACCESS_KEY>>');
    return '<<REDACTED_AWS_ACCESS_KEY>>';
  });

  updated = updated.replace(awsSecretRegex, (match, key, separator) => {
    recordReplacement(changes, 'AWS_SECRET', 'KEY=<<REDACTED_AWS_SECRET>>', { key });
    const normalizedSeparator = separator.replace(/[:=]/, '=');
    return `${key}${normalizedSeparator}<<REDACTED_AWS_SECRET>>`;
  });

  updated = updated.replace(stripeSecretRegex, () => {
    recordReplacement(changes, 'STRIPE_SECRET', '<<REDACTED_STRIPE_KEY>>');
    return '<<REDACTED_STRIPE_KEY>>';
  });

  updated = updated.replace(jwtRegex, () => {
    recordReplacement(changes, 'JWT', '<<REDACTED_JWT>>');
    return '<<REDACTED_JWT>>';
  });

  updated = updated.replace(inlinePasswordRegex, (match, key, separator) => {
    if (match.includes('<<REDACTED_PASSWORD>>')) {
      return match;
    }
    recordReplacement(changes, 'INLINE_PASSWORD', '<<REDACTED_PASSWORD>>', { key });
    return `${key}${separator}<<REDACTED_PASSWORD>>`;
  });

  updated = updated.replace(jsonKeyRegex, (match, prefix, opening, value, closing) => {
    const keyMatch = prefix.match(/"?([^"\s:=]+)"?/);
    const keyName = keyMatch ? keyMatch[1] : undefined;
    if (keyName && sensitiveKeyPattern.test(keyName)) {
      const trimmedValue = value.trim();
      if (trimmedValue === '<<REDACTED_KEY>>') {
        return match;
      }
      recordReplacement(changes, 'KEY_VALUE', '<<REDACTED_KEY>>', { key: keyName });
      let replacementValue = '<<REDACTED_KEY>>';
      if (opening && closing) {
        replacementValue = `${opening}<<REDACTED_KEY>>${closing}`;
      } else if (opening && !closing) {
        replacementValue = `${opening}<<REDACTED_KEY>>`;
      } else if (!opening && closing) {
        replacementValue = `<<REDACTED_KEY>>${closing}`;
      }
      return prefix + replacementValue;
    }
    return match;
  });

  const lines = updated.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const envMatch = line.match(envLineRegex);
    if (envMatch) {
      const [, leading, key, separator, value] = envMatch;
      if (sensitiveKeyPattern.test(key)) {
        let comment = '';
        let actualValue = value;
        const commentIndex = value.indexOf(' #');
        if (commentIndex !== -1) {
          comment = value.slice(commentIndex);
          actualValue = value.slice(0, commentIndex).trim();
        }
        const normalizedValue = actualValue.trim().replace(/^['"]|['"]$/g, '');
        if (normalizedValue !== '<<REDACTED_KEY>>') {
          recordReplacement(changes, 'ENV_VALUE', '<<REDACTED_KEY>>', { key });
        }
        lines[i] = `${leading}${key}${separator}<<REDACTED_KEY>>${comment}`;
      }
    }
  }
  updated = lines.join('\n');

  updated = updated.replace(genericSecretRegex, (match) => {
    if (match.startsWith('<<REDACTED_')) {
      return match;
    }
    recordReplacement(changes, 'GENERIC_SECRET', '<<REDACTED_SECRET>>');
    return '<<REDACTED_SECRET>>';
  });

  return { content: trimTrailingWhitespace(updated), changes };
};

const determineLanguage = (ext) => CODE_LANG_MAP[ext] || '';

const isBinaryContent = (buffer) => {
  for (let i = 0; i < buffer.length; i += 1) {
    if (buffer[i] === 0) {
      return true;
    }
  }
  return false;
};

const walkDirectory = async (dir, options, results) => {
  const entries = await fs.promises.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relativePath = path.relative(options.root, fullPath);
    if (entry.isDirectory()) {
      if (IGNORE_DIRS.has(entry.name)) {
        continue;
      }
      await walkDirectory(fullPath, options, results);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name);
      if (!ALLOWED_EXTENSIONS.has(ext)) {
        continue;
      }
      if (options.excludedFiles.has(fullPath)) {
        continue;
      }
      results.push({ fullPath, relativePath });
    }
  }
};

const buildNote = async () => {
  const args = parseArgs();
  const root = process.cwd();
  const sourcePath = path.resolve(root, args.source);
  const sourceExists = fs.existsSync(sourcePath);
  const effectiveSource = sourceExists ? sourcePath : root;
  const outputPath = path.resolve(root, args.out);
  const reportPath = path.resolve(root, args.report);

  const excludedFiles = new Set([outputPath, reportPath]);

  const walkResults = [];
  await walkDirectory(effectiveSource, { root, excludedFiles }, walkResults);

  const filesData = [];
  const report = {
    filesScanned: 0,
    filesMerged: 0,
    replacements: [],
    errors: []
  };

  for (const fileInfo of walkResults.sort((a, b) => a.relativePath.localeCompare(b.relativePath))) {
    report.filesScanned += 1;
    try {
      const buffer = await fs.promises.readFile(fileInfo.fullPath);
      if (isBinaryContent(buffer)) {
        report.errors.push({ file: fileInfo.relativePath, error: 'Binary file skipped' });
        continue;
      }
      const content = buffer.toString('utf8');
      const { content: redactedContent, changes } = applyRedactions(content, fileInfo.relativePath);
      filesData.push({ ...fileInfo, ext: path.extname(fileInfo.fullPath), content: redactedContent, changes });
      report.filesMerged += 1;
      if (changes.length > 0) {
        report.replacements.push({ file: fileInfo.relativePath, changes });
      }
    } catch (error) {
      report.errors.push({ file: fileInfo.relativePath, error: error.message });
    }
  }

  const lines = ['# Consolidated Notes', ''];
  for (const file of filesData) {
    lines.push('---');
    lines.push(`### ${file.relativePath}`);
    lines.push('');
    const ext = file.ext;
    if (ext === '.md' || ext === '.txt') {
      lines.push(file.content);
    } else {
      const lang = determineLanguage(ext);
      const fence = lang ? `\`\`\`${lang}` : '```';
      lines.push(fence);
      lines.push(file.content);
      lines.push('```');
    }
    lines.push('');
  }

  await fs.promises.writeFile(outputPath, lines.join('\n'), 'utf8');
  await fs.promises.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
};

buildNote().catch((error) => {
  console.error('Error creating consolidated note:', error);
  process.exitCode = 1;
});
