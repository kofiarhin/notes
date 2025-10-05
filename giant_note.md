# Consolidated Notes

---
### combine_notes.js

```javascript
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

```

---
### data/ai_gear.md

# Complete Freelance Gear Setup – Nikon D750 + iPhone 13 Pro Max

A fully integrated setup for hybrid shooters and content creators. Covers photography, videography, mobile content, interviews, client work, and creative experimentation.

---

## 1. Camera Bodies

- **Nikon D750** – Full-frame DSLR with excellent dynamic range and dual card slots.
- **iPhone 13 Pro Max** – Shoots 4K60, Dolby Vision HDR, ProRAW, with cinematic video mode.

---

## 2. Lenses (Nikon F Mount)

- [Tamron 24-70mm f/2.8 G2](https://www.amazon.co.uk/dp/B0756Z8YWN) – All-around zoom for events and run-and-gun.
- [Sigma 70-200mm f/2.8 Sports](https://www.amazon.co.uk/dp/B07HPX7F9D) – Compression and reach.
- [Nikon 50mm f/1.8G](https://www.amazon.co.uk/dp/B004Y1AYAC) – Lightweight low-light prime.
- [Nikon 85mm f/1.8G](https://www.amazon.co.uk/dp/B006TAP096) – Ideal for headshots and bokeh.

---

## 3. Audio

- [Rode VideoMic Pro+](https://www.amazon.co.uk/dp/B0749GV5L3)
- [Zoom H5 XLR Recorder](https://www.amazon.co.uk/dp/B00MZCEWR0)
- [Rode VideoMic Me-L](https://www.amazon.co.uk/dp/B07D221W3V) – For iPhone
- [Rode Wireless GO II](https://www.amazon.co.uk/dp/B08QSM9ZB1) – Wireless lavs for interviews and events.

---

## 4. Lighting

- [Godox V860II-N Flash](https://www.amazon.co.uk/dp/B01J8PAI00)
- [Godox SL60W Continuous Light](https://www.amazon.co.uk/dp/B078Y9XYWV)
- [Neewer 660 Bi-Color LED Kit](https://www.amazon.co.uk/dp/B07L6FJGR4)
- [Lume Cube RGB Mini Panel](https://www.amazon.co.uk/dp/B08F7TB8TB)
- [Godox AK-R1 Magnetic Kit](https://www.amazon.co.uk/dp/B07T9L96G9)
- [Godox AK-R12 Bounce Card](https://www.amazon.co.uk/dp/B082XTMN5S)

---

## 5. Stabilization

- [Manfrotto 190XPRO Tripod](https://www.amazon.co.uk/dp/B002PWHOXY)
- [Zhiyun Crane 2S Gimbal](https://www.amazon.co.uk/dp/B08BXZHD8F)
- [Hohem iSteady Mobile+ (iPhone)](https://www.amazon.co.uk/dp/B07RHWZMMG)
- [ShiftCam SnapGrip](https://www.amazon.co.uk/dp/B0B5KYXVD4)

---

## 6. Filters & Modifiers

- [Tiffen Variable ND 77mm](https://www.amazon.co.uk/dp/B0000BZL1P)
- [K&F Black Mist 1/4](https://www.amazon.co.uk/dp/B089Q2MGB3)
- [Tiffen Star Filter Kit](https://www.amazon.co.uk/dp/B00004ZCJD)
- [APEXEL 5-in-1 Mobile Lens Kit](https://www.amazon.co.uk/dp/B087BR6X2K)

---

## 7. Storage

- [SanDisk Extreme PRO 128GB SDXC](https://www.amazon.co.uk/dp/B07H9J1YXN)
- [SanDisk Extreme Portable SSD 1TB](https://www.amazon.co.uk/dp/B078STRHBX)
- [SanDisk iXpand Go 128GB (iPhone)](https://www.amazon.co.uk/dp/B07MDK3QWD)

---

## 8. Power

- [Nikon EN-EL15c Batteries (2-Pack)](https://www.amazon.co.uk/dp/B086PM9TYK)
- [Anker PowerCore Magnetic 5K](https://www.amazon.co.uk/dp/B08V51TP2C)
- [Apple 20W USB-C Charger](https://www.amazon.co.uk/dp/B08L5WHFT9)

---

## 9. Mounts & Workflow

- [Ulanzi ST-27 MagSafe Mount](https://www.amazon.co.uk/dp/B09MPWZJBB)
- [Joby GripTight Pro 2](https://www.amazon.co.uk/dp/B074WC9YKL)
- [Feelworld F6 Plus Monitor](https://www.amazon.co.uk/dp/B081MSV7D9)
- [XP-Pen Deco 01 V2 Tablet](https://www.amazon.co.uk/dp/B07L77GTTY)
- [ColorChecker Passport Photo 2](https://www.amazon.co.uk/dp/B07QG98FJP)
- [Tether Tools USB-C to Mini-B](https://www.amazon.co.uk/dp/B01BRC9FXM)

---

## 10. Creative Accessories (NEW)

### For Nikon D750
- [Nikon D750 Silicone Camera Cover](https://www.amazon.co.uk/dp/B07H7QYY2V)
- [GGS LCD Folding ViewFinder Hood](https://www.amazon.co.uk/dp/B01N6GY52A)
- [Lensbaby Spark or Composer Series](https://www.amazon.co.uk/s?k=Lensbaby+Nikon)

### For iPhone 13 Pro Max
- [iPhone Filmmaking Rig Case](https://www.amazon.co.uk/dp/B08XQBP1K3)
- [Creator Grip by Sandmarc](https://www.sandmarc.com/products/film-rig-iphone)
- [Andoer Smartphone Video Rig](https://www.amazon.co.uk/dp/B08BF91MPX)

---

## 11. Cleaning & Protection

- [LensPen NLP-1](https://www.amazon.co.uk/dp/B00006JN3G)
- [Air Blower + Sensor Kit](https://www.amazon.co.uk/dp/B00GPQ2ZTI)
- [Pelican 1510 Case](https://www.amazon.co.uk/dp/B0014DWH5I)

---

---
### data/ai_ideas.md

# 🔥 High-Impact App Ideas Using Groq API

Groq is all about speed — ultra-low-latency inference for LLMs. These are production-ready ideas you can build fast and monetize.

---

## 💼 1. Sales Pitch Customizer

**Target**: Startup founders, SDRs, B2B marketers
**Input**: Product + prospect LinkedIn/company info
**Output**: Tailored email pitch + call script
**Monetization**: $29–$99/month (SaaS)

---

## 🎥 2. TikTok Script Generator

**Target**: Short-form content creators
**Input**: Topic + style (e.g., skit, explainer, motivational)
**Output**: 15-30 sec script in 3 formats
**Monetization**: $5/script or $15/month

---

## 🧠 3. Resume & Cover Letter Builder

**Target**: Job seekers
**Input**: Job posting + resume text
**Output**: ATS-optimized resume & cover letter
**Monetization**: $5 one-time or $15/month for unlimited access

---

## 💬 4. Cold Email Rewrite Tool

**Target**: Freelancers, marketing agencies
**Input**: Raw outreach email
**Output**: Rewritten copy in different tones (casual, witty, urgent)
**Monetization**: $49–$199/month for volume use

---

## 📄 5. PDF to Flashcards

**Target**: Students, exam preppers
**Input**: PDF textbook or notes
**Output**: Auto-generated flashcards
**Monetization**: Freemium → $10/month for unlimited cards

---

## 🎓 6. AI Course Lesson Planner

**Target**: Coaches, online teachers
**Input**: Course topic + audience level
**Output**: Full outline with lessons, objectives, sample scripts
**Monetization**: $30–$100/course OR SaaS subscription

---

## 👨‍💻 7. Code Explainer Bot

**Target**: Junior devs, bootcamp students
**Input**: Code snippet
**Output**: Explanation + edge cases + suggestions
**Monetization**: $10–$25/month subscription

---

## 📢 8. YouTube Title & Description Optimizer

**Target**: Creators, SEO marketers
**Input**: Topic or video transcript
**Output**: Optimized title, tags, description copy
**Monetization**: $5/use or $15/month

---

## 📜 9. Investor Outreach Generator

**Target**: Startup founders
**Input**: Startup idea + investor name or firm
**Output**: Customized cold pitch email
**Monetization**: $10/pitch or bundle plans

---

## 📰 10. Daily Briefing Generator

**Target**: Execs, founders, analysts
**Input**: News sources, RSS, email d


---
### data/ai_prompts.md

Here’s your fully updated .md file with four AI code generation prompts, now including:
	1.	Full-Stack Auth App
	2.	File Upload System
	3.	Real-Time Chat App
	4.	Blog Platform (CMS-style)

⸻


# AI Code Generation Prompts Library

This file contains structured prompts to generate full-stack applications using AI tools. Each prompt is precise, end-to-end, and designed to produce a downloadable `.zip` file containing complete working source code.

---

## Prompt 1: Full-Stack Auth App with React, GraphQL, JWT, Redux, React Query, SCSS, Vitest

**Purpose**: Build a complete, scalable authentication system with dark-themed frontend and test coverage.

**Prompt**:

Create a full-stack authentication application using Node.js, Express, MongoDB (Mongoose), GraphQL (Apollo Server), and React. Bundle the project into a `.zip` file and provide a direct download link.

### Backend:
- Express + Apollo Server
- Mongoose-based user model
- GraphQL schema:
  - `User` type
  - `register`, `login`, `getUsers`
- JWT auth using `jsonwebtoken`
- `.env` setup:

MONGO_URI=mongodb://localhost:27017/auth-app
PORT=5000
JWT_SECRET=<<REDACTED_KEY>>

### Frontend:
- React app inside `/client`
- SCSS dark theme, fully responsive
- Uses:
- React Query
- Redux Toolkit
- Custom hooks
- JWT stored in localStorage/sessionStorage

### Testing:
- Vitest test suite:
- JWT logic
- GraphQL resolvers
- Redux slices
- React hooks

### Output:
- Provide `.zip` file
- Include README with setup instructions

---

## Prompt 2: Full-Stack File Upload System with Drag-and-Drop UI

**Purpose**: Allow users to upload and view files using a clean drag-and-drop interface.

**Prompt**:

Build a file upload system using Node.js, Express, MongoDB, and React. Include server-side storage, file listing, and UI feedback. Provide a `.zip` file with full code.

### Backend:
- Express server with Multer
- Save file metadata to MongoDB
- Routes:
- `POST /upload`
- `GET /files`
- `GET /files/:filename`
- Serve files from `/uploads`
- `.env` config:

MONGO_URI=mongodb://localhost:27017/file-db
PORT=5000
UPLOAD_DIR=uploads

### Frontend:
- React + SCSS
- Drag-and-drop file uploader using `react-dropzone`
- List uploaded files with metadata
- Display previews and download links

### Output:
- Bundle backend + frontend
- Include install and run instructions

---

## Prompt 3: Real-Time Chat App with Socket.IO and React

**Purpose**: Enable live messaging with multiple users via WebSocket.

**Prompt**:

Create a real-time chat app using Node.js, Express, Socket.IO, and React. Provide a `.zip` of the full source code.

### Backend:
- Express + Socket.IO
- Broadcast events:
- `connection`
- `disconnect`
- `chatMessage`
- Optional: persist messages in MongoDB

### Frontend:
- React + SCSS
- Connect to Socket.IO server
- Features:
- Real-time messaging
- Chat input, user join/leave messages
- Responsive layout

### Output:
- Deliver `.zip` file with install + run guide

---

## Prompt 4: Blog Platform (CRUD Blog CMS with Markdown Support)

**Purpose**: Build a full-featured blog platform with rich text support and post management.

**Prompt**:

Build a full-stack blog platform using Node.js, Express, MongoDB (Mongoose), and React. Include markdown support, admin editing, and post listing. Provide a `.zip` download link.

### Backend:
- Express API with REST routes:
- `GET /posts`
- `GET /posts/:id`
- `POST /posts`
- `PUT /posts/:id`
- `DELETE /posts/:id`
- MongoDB schema:
- `title`, `slug`, `content`, `author`, `createdAt`, `updatedAt`
- Use `marked` or `markdown-it` to parse markdown content
- `.env` config:

MONGO_URI=mongodb://localhost:27017/blog-app
PORT=5000

### Frontend:
- React app with SCSS
- Pages:
- Home (list all posts)
- Single post view (render markdown)
- Admin (create/edit/delete post)
- Features:
- Live markdown editor with preview
- Slug auto-generation
- Form validation

### Optional:
- Rich text editor support (e.g. Toast UI, SimpleMDE)
- Auth-protected admin access
- Pagination or tag filtering

### Output:
- Bundle full stack into a `.zip`
- Include README with full usage and setup

---

## [Add more prompts below...]


⸻

Let me know if you want this turned into a downloadable .md file, or if you want to extend the blog app with comments, media embedding, or server-side rendering.

---
### data/anuopets.js

```javascript
import React from "react";

const getColor = (rating) => {
  if (rating >= 7.5) return "#21d07a"; // green
  if (rating >= 5) return "#d2d531"; // yellow
  return "#db2360"; // red
};

const MovieScoreBadge = ({ rating = 0, label = "User Score", size = 60 }) => {
  const score = Math.round((rating / 10) * 100); // convert to percentage
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;

  return (
    <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center" }}>
      <svg width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#444"
          strokeWidth={strokeWidth}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={getColor(rating)}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <text
          x="50%"
          y="50%"
          textAnchor="middle"
          dominantBaseline="central"
          fill="#fff"
          fontSize={size * 0.28}
          fontWeight="bold"
        >
          {rating.toFixed(1)}
        </text>
      </svg>
      <span style={{ marginTop: 4, fontSize: "0.75rem", color: "#ccc" }}>{label}</span>
    </div>
  );
};

export default MovieScoreBadge;





//cose snippets
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Cache Busting CSS</title>
  <script>
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `/styles.css?v=${Date.now()}`; // bust cache with timestamp
    document.head.appendChild(link);
  </script>
</head>
<body>
  <h1>No more cached CSS</h1>
</body>
</html>

import { useEffect, useRef, useState } from 'react';

function LazyImage({ src, alt, ...rest }) {
  const [isVisible, setIsVisible] = useState(false);
  const imgRef = useRef();

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(imgRef.current);
        }
      },
      { threshold: 0.1 }
    );

    if (imgRef.current) observer.observe(imgRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <img
      ref={imgRef}
      src={isVisible ? src : ''}
      alt={alt}
      {...rest}
    />
  );
}

export default LazyImage;
```

---
### data/Code_smippets.md

// alia: vite.config.js import { defineConfig } from 'vite'; import react from '@vitejs/plugin-react'; import path from 'path';

export default defineConfig({ plugins: [react()], resolve: { alias: { '@': path.resolve(__dirname, './src'), }, }, });

---
### data/code_snippets.js

```javascript
//voice generator component
import React, { useEffect, useState } from 'react';

const TextToSpeech = ({ defaultText = '', voice = 'UK English Female', buttonLabel = '🔊 Speak' }) => {
  const [text, setText] = useState(defaultText);

  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://code.responsivevoice.org/responsivevoice.js?key=';
    script.async = true;
    document.body.appendChild(script);
  }, []);

  const handleSpeak = () => {
    if (window.responsiveVoice) {
      window.responsiveVoice.speak(text, voice);
    } else {
      console.warn('ResponsiveVoice not loaded yet.');
    }
  };

  return (
    <div style={styles.wrapper}>
      <textarea
        style={styles.textarea}
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        placeholder="Type something to speak..."
      />
      <button style={styles.button} onClick={handleSpeak}>
        {buttonLabel}
      </button>
    </div>
  );
};

const styles = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    maxWidth: '600px',
    margin: 'auto',
  },
  textarea: {
    padding: '1rem',
    fontSize: '1rem',
    resize: 'vertical',
  },
  button: {
    padding: '0.75rem 1.5rem',
    fontSize: '1rem',
    background: '#333',
    color: '#fff',
    border: 'none',
    cursor: 'pointer',
  },
};

export default TextToSpeech;



//a fuction that takes query value and accepts json
//and returns match chunk

const jsonData = {};
const query = "Can I use my plan when I travel internationally?";
const getRelevantChunksFromJSON = (query, jsonData, maxResults = 3) => {
  const chunks = [];

  const walk = (obj, path = '') => {
    if (typeof obj === 'string' || typeof obj === 'number') {
      chunks.push({ text: String(obj), path });
    } else if (Array.isArray(obj)) {
      obj.forEach((item, i) => walk(item, `${path}[${i}]`));
    } else if (typeof obj === 'object' && obj !== null) {
      Object.entries(obj).forEach(
        ([key, value]) => walk(value, path ? `${path}.${key}` : key)
      );
    }
  };

  walk(jsonData);

  const queryWords = query.toLowerCase().split(/\s+/);

  return chunks
    .map(chunk => ({
      ...chunk,
      score: queryWords.reduce(
        (acc, word) => acc + (chunk.text.toLowerCase().includes(word) ? 1 : 0),
        0
      )
    }))
    .filter(chunk => chunk.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults);
};



//get the birthday of popular actors
const API_KEY = 'YOUR_TMDB_API_KEY';
const BASE_URL = 'https://api.themoviedb.org/3';

async function getActorsBornToday() {
  const today = new Date();
  const todayMonthDay = `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const popularUrl = `${BASE_URL}/person/popular?api_key=${API_KEY}`;

  const response = await fetch(popularUrl);
  const data = await response.json();

  const results = [];

  for (const person of data.results) {
    const detailUrl = `${BASE_URL}/person/${person.id}?api_key=${API_KEY}`;
    const detailRes = await fetch(detailUrl);
    const detailData = await detailRes.json();

    const birthday = detailData.birthday;
    if (birthday && birthday.slice(5) === todayMonthDay) {
      results.push({
        name: detailData.name,
        birthday: birthday,
        known_for: detailData.known_for_department
      });
    }
  }

  console.log(results);
  return results;
}

getActorsBornToday().catch(console.error);



const kbJson = {
  name: "DevBot",
  languages: ["JavaScript", "Python"],
  fallbackResponse: "I'm not sure about that.",
  tone: "casual",
};

const chatHistory = [
  { role: "user", content: "Can you help with Express?" },
  { role: "assistant", content: "Yeah, what’s the issue?" },
];

const userQuery = "What if my Mongo connection times out?";

const prompt = `
You are DevBot. Here’s what you know:

---
${flattenKnowledgeBase(kbJson)}
---

Conversation so far:

${formatChatHistory(chatHistory)}

Only respond based on that info. If you don’t know, reply: ${kbJson.fallbackResponse}

Speak ${kbJson.tone}. Use first person.

User: ${userQuery}
You:
`.trim();

console.log(prompt);
```

---
### data/Dev_Notes_Master.md

# 📁 Developer Notes Archive

A well-structured knowledge vault for rapid development, creativity, and project acceleration.

---

## 🧩 Components & Snippets

### Lazy Loading Image (React)

```jsx
import { useEffect, useRef, useState } from 'react';

function LazyImage({ src, alt, ...rest }) {
  const [isVisible, setIsVisible] = useState(false);
  const imgRef = useRef();

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(imgRef.current);
        }
      },
      { threshold: 0.1 }
    );

    if (imgRef.current) observer.observe(imgRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <img
      ref={imgRef}
      src={isVisible ? src : ''}
      alt={alt}
      {...rest}
    />
  );
}

export default LazyImage;
```

---

## 📡 APIs & Endpoints

### 🎬 TMDB API

> API Key: `<<REDACTED_SECRET>>`

- **Popular Movies:**
  `https://api.themoviedb.org/3/movie/popular?api_key=...`
- **Trending Movies (Weekly):**
  `https://api.themoviedb.org/3/trending/movie/week?api_key=...`
- **Get Cast:**
  `https://api.themoviedb.org/3/movie/{movie_id}/credits?api_key=...`
- **Movie Search:**
  `https://api.themoviedb.org/3/search/movie?query=...`
- **TV Search:**
  `https://api.themoviedb.org/3/search/tv?query=...`
- **Genres:**
  `https://api.themoviedb.org/3/genre/movie/list?api_key=...`

### 🌦️ Open Weather API

```bash
http://api.openweathermap.org/data/2.5/weather?lat=...&lon=...&appid=<<REDACTED_SECRET>>
```

---

## 🎨 Fonts & Design

### Google Fonts

- **Poppins**
- **Quicksand**
- **Fira Sans**
- **Open Sans**

```css
html, body {
  font-family: 'Poppins', sans-serif;
}
```

### FontAwesome

```html
<script src="https://kit.fontawesome.com/96ccaaca81.js" crossorigin="anonymous"></script>
```

---

## 🛠️ Tools & Resources

### CDN Libraries

- [Mustache.js](https://cdnjs.cloudflare.com/ajax/libs/mustache.js/3.0.1/mustache.min.js)
- [Moment.js](https://cdnjs.cloudflare.com/ajax/libs/moment.js/2.22.2/moment.min.js)
- [Qs.js](https://cdnjs.cloudflare.com/ajax/libs/qs/6.6.0/qs.min.js)

### Webpack Dev Dependencies

```json
"devDependencies": {
  "@babel/core": "^7.11.4",
  "webpack": "^4.44.1",
  "webpack-cli": "^3.3.12",
  ...
}
```

### Fonts & UI Tools

- [Fontello](http://fontello.com)
- [UI Space](https://uispace.net)
- [Blush](https://blush.design)
- [Undraw](https://undraw.co/illustrations)

---

## 💡 Project Ideas

- Fiverr Clone
- Netflix Clone
- Grocery Delivery App
- WYSIWYG Postcard Designer

### WYSIWYG Tool References

- [GrapesJS](https://grapesjs.com/demo.html)
- [MDN: execCommand](https://developer.mozilla.org/en-US/docs/Web/API/Document/execCommand)

---

## 🔧 Development Tricks

### File Existence Check (Node.js)

```js
const fs = require('fs');

if (fs.existsSync('foo.txt')) {
  // File exists
}
```

### Decode JWT

- [Base64 Decode](https://www.base64decode.org)

### Sample Coordinates (for Weather APIs)

- Latitude: `5.661083`
- Longitude: `-0.202815`

---

## 🗃️ Personal Workflow

### Daily Schedule

1. 4:00am - Study
2. 6:30am - Workout
3. 9:00am - Work
4. 1:30pm - Class
5. 6:00pm - Evening Workout
6. 8:00pm - Plan Next Day

---

## 🎥 Project Demos

- [Escowear App (Live)](https://escowear.herokuapp.com/)
- [JS Chat App](https://kf-js-chat-app.herokuapp.com/)

---

## 🎧 Audio & Video Gear

- **Microphone**: [Blue Yeti Pro](https://www.amazon.co.uk/dp/B00N1YPXW2)
- **Lights**: Safstar Softbox Kit
- **Software**: GarageBand, iMovie

---

## 🧱 Miscellaneous

### Scrollbar Styling

```css
.scroller {
  overflow-y: scroll;
  scrollbar-color: rebeccapurple green;
  scrollbar-width: thin;
}
```

### Other Links

- [Green Wallpapers](https://wallpaperaccess.com/green)
- [10FastFingers Typing Test](https://10fastfingers.com/advanced-typing-test/english)

---

**End of Notes – Modularize as needed for repos, wikis, or team handoffs.**


---
### data/developer_knowledge_base.md


# Developer Knowledge Base

This structured knowledge base organizes tools, APIs, projects, resources, and snippets to optimize productivity and development speed.

---

## Projects

### Samples / Demos
- [Mentorship App Sample](https://www.youraveragetechbro.com/)
- [Chat App (Heroku)](https://kf-js-chat-app.herokuapp.com/)

### Starter Packs
- **React Starter Pack**: `git@github.com:kofiarhin/kf-react-starter-pack-v1.git`

### Project Ideas
- Fiverr Clone
- Netflix Clone
- E-Commerce
- Food Delivery (Web + Mobile)
- School Management System
- WYSIWYG Editor (Postcard Designer)


---

## Hosting & Deployment

### Namecheap
- [Namecheap](https://www.namecheap.com)

### cPanel File Manager
- [Primary](https://server345.web-hosting.com:<<REDACTED_SECRET>>.html)
- [Namespace Link](https://server345.web-hosting.com:<<REDACTED_SECRET>>.html?dir=%2fhome%2fdevkbtwj%2fpublic_html)

### Heroku
```bash
heroku apps:info -s | grep web_url | cut -d= -f2
```

---

## AI Integration

### Groq API
- **Base URL**: `https://api.groq.com/openai/v1/chat/completions`
- **Key**: `gsk_ur5x...`

```js
const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_GROQ_API_KEY"
  },
  body: JSON.stringify({
    model: "mixtral-8x7b-32768",
    messages: [
      { role: "user", content: "Write a tweet about Groq API" }
    ],
    temperature: 0.7,
    max_tokens: 100
  })
});
```

### OpenAI API
- **Key**: `sk-proj-dZho...`

---

## TMDB API (Movies)
- **API Key**: `<<REDACTED_SECRET>>`

### Popular
`https://api.themoviedb.org/3/movie/popular?api_key=...`

### Trending
`https://api.themoviedb.org/3/trending/movie/week?api_key=...`

### Genres
`https://api.themoviedb.org/3/genre/movie/list?api_key=...`

### Cast & Details
```js
GET /movie/{movie_id}/credits
GET /movie/{movie_id}?api_key=...
```

### Assets
```html
Poster: https://image.tmdb.org/t/p/w1280/{poster_path}
```

---

## Weather APIs

### OpenWeatherMap
- **API Key**: `<<REDACTED_SECRET>>`
- **Sample Request**:
`http://api.openweathermap.org/data/2.5/weather?lat=42.2358&lon=-96.4725&appid=...`

### Mapbox
- **Access Token**: `pk.eyJ1IjoiNjll...`

---

## React & Dev Utilities

### Lazy Image Loader
```jsx
<img src={isVisible ? src : ''} ref={imgRef} ... />
```

### Scrollbar Styling
```css
.scroller {
  scrollbar-color: rebeccapurple green;
  scrollbar-width: thin;
}
```

---

## Fonts & UI CDNs

### Fonts
- **Poppins**: `'Poppins', sans-serif`
- **Fira Sans**: `'Fira Sans', sans-serif`
- **Quicksand**: `'Quicksand', sans-serif`

### FontAwesome
```html
<script src="https://kit.fontawesome.com/96ccaaca81.js" crossorigin="anonymous"></script>
```

---

## NPM Tools

### Webpack Dev Setup
```json
"devDependencies": {
  "webpack": "^4.44.1",
  "sass-loader": "^9.0.3",
  "babel-loader": "^8.1.0"
}
```

### Helpful Packages
- `chalk`
- `request`
- `dotenv`
- `qs`
- `moment`

---

## Useful References

- [Lazy Loading Image Component](#lazy-image-loader)
- [Mustache](https://cdnjs.cloudflare.com/ajax/libs/mustache.js/3.0.1/mustache.min.js)
- [Enhance UI](https://www.enhanceui.com/)
- [Emoji Mart / Color Picker](https://github.com/missive/emoji-mart)

---

## Daily Schedule
```text
1. 4:00am – Study
2. 6:30am – Workout
3. 9:00am – Work/Study
4. 1:30pm – Class
5. 6:00pm – Workout
6. 8:00pm – Plan Next Day
```

---

> This organized structure helps with fast lookup, smoother context switching, and more focused development.


---
### data/gears.md

# Creator Gear Setup

## Essentials

### SSD
- **[SanDisk Extreme Portable 1TB SSD](https://www.amazon.co.uk/SanDisk-Extreme-Portable-1050MB-Dust-Resistant/dp/B08GTYFC37)**
  - Speed: 1050MB/s
  - Durable & water-resistant
  - Ideal for mobile editing and backups

---

### Gimbals & Stabilizers

#### iPhone Gimbal
- **[ZHIYUN Smooth Q4 Combo](https://www.amazon.co.uk/Stabilizer-Smartphone-Megnetic-Vlogging-YouTube/dp/B0B27WXVN6)**
  - Foldable design
  - Magnetic phone clamp
  - Best for on-the-go mobile content

#### DSLR Gimbals
- **[DJI Ronin SC2 (eBay)](https://www.ebay.co.uk/itm/265849302681)**
  - Compact & powerful for mirrorless cameras
  - Strong payload
- **[Zhiyun Weebill S](https://www.amazon.co.uk/dp/B08SLQ5HJK)**
  - Lightweight and high torque
  - Good for heavier DSLR setups

---

### Cameras

- **[Sony ZV-1](https://www.amazon.co.uk)**
  - Best compact camera for vloggers
  - Fast AF and flip-out screen
- **Nikon 70-200mm f/2.8 Series**
  - **[AF-S VR Zoom-NIKKOR 70-200mm f/2.8G IF-ED](https://www.amazon.co.uk/dp/B07DL5KYQH)**
  - **[Nikon 70-200mm f/2.8E FL ED VR](https://www.amazon.co.uk)**
  - **[Tamron 70-200mm f/2.8 for Nikon](https://www.amazon.co.uk/Tamron-A025N-70-200-Nikon-Camera/dp/B01MZI83NO)**

---

### Filters & Accessories

- **[K&F Concept Variable ND + Circular Polarizer](https://www.amazon.co.uk/Concept-Variable-Polarising-Polarizer-Graduated/dp/B07L6DVW4B)**
- **[Filter Adapter Ring Set](https://www.amazon.co.uk/Step-Lens-Filter-Adapter-Rings/dp/B077XGL35R)**
- **[Flash Diffuser](https://www.amazon.co.uk/dp/B074J62YX1)**
- **[Lens Cleaning Kit](https://www.amazon.co.uk/gp/aw/d/B00JL4IWXI)**

---

## Lighting Gear

- **[NEEWER 26'' Octagonal Softbox](https://www.amazon.co.uk/gp/product/B07C4LS6BP)**
- **[Neewer 35.4'' Hexadecagon Softbox (Bowens Mount)](https://geni.us/fzjMY)**
- **[Pixapro 55cm Beauty Dish Reflector](https://www.amazon.co.uk/gp/product/B00R7ZCPRC)**

---

## General Gear

- **[iBlockCube Universal Extension Board](https://www.amazon.co.uk/iBlockCube-Universal-Extension-Electrical-Accessories/dp/B0855SN2V7)**
- **[Phone Mount](https://www.amazon.co.uk/dp/B071CFDBJ7?tag=northborders-21)**
- **[Chest Mount](https://www.amazon.co.uk/dp/B012DMT3AA?tag=northborders-21)**
- **[IKEA Curtain Rod for DIY Backdrop](https://www.ikea.com/gb/en/p/raecka-curtain-rod-combination-white-s59929243/)**

---

## Audio & Headphones

- **[Soundcore by Anker Life Q30 Hybrid](https://www.amazon.co.uk/gp/product/B08HMWZBXC)**
- **[Sony WH-1000XM5](https://www.amazon.co.uk/Sony-WH-1000XM5-Cancelling-Wireless-Headphones-Black/dp/B09Y2MYL5C)**

---

## Storage

- **[Gigastone SD Card 64GB (2-Pack)](https://amzn.eu/d/0uFREUM)**
- **[Lexar Professional SD Card](https://www.amazon.co.uk)**

---

## Monitor

- **[ViewSonic VP2776 27" Nano IPS Monitor](https://www.viewsonic.com/)**
  - 165Hz, 1ms, HDR400
  - Professional color accuracy (ColorPro)

---

## Mobile Accessories

- **[iPhone 6ft Long Cable](https://www.amazon.co.uk/Lightning-Certified-Charger-Delivery-Charging/dp/B09H2JFX5J)**
- **Top iPhone Lightning USB Drives:**
  - [SanDisk iXpand Go - £32.49](https://www.amazon.co.uk)
  - [SanDisk iXpand Luxe (Lightning + USB-C) - £20.17](https://www.amazon.co.uk)
  - [MFi Certified 128GB Lightning/USB3.0 - £23.64](https://www.amazon.co.uk)

---

## Digital Drawing

- **[HUION Inspiroy H640P Graphic Tablet](https://www.amazon.co.uk/gp/product/B079QFKJ13)**
  - Battery-free pen
  - Lightweight and portable
  - Great for photo editing or animations

---

---
### data/notes.md


# 🚀 Developer Productivity & Creativity Toolkit

A quick-access Markdown cheat sheet to streamline creative development with Groq/OpenAI APIs, TMDB integration, styling assets, lazy loading, fonts, and more.

---

# `movieAi.js`

```js
const { Groq } = require("groq-sdk");

// Validate environment variable
if (!process.env.GROQ_API) {
  throw new Error("Missing GROQ_API environment variable");
}

const groq = new Groq({
  apiKey:<<REDACTED_KEY>>
});

// Configurable model
const MODEL_NAME = process.env.GROQ_MODEL || "llama3-8b-8192";

const movieAi = async ({ character }) => {
  // Validate input
  if (!character || typeof character !== "string") {
    throw new Error("Invalid character input");
  }

  const prompt = `Write a character bio for ${character}. Include their profession, when they started, their breakout role, major achievements, recent work, and any awards. Keep it under 200 words and structured like a professional actor biography.`;

  try {
    const response = await groq.chat.completions.create({
      model: MODEL_NAME,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 1,
      max_tokens: 1024,
      top_p: 1,
      stream: false,
    });

    return response.choices[0]?.message?.content || "";
  } catch (err) {
    console.error("Groq API Error:", err.response?.data || err);
    throw new Error(`callGroqAPI failed: ${err.message}`);
  }
};

module.exports = movieAi;

## ✍️ Sample Prompt Template

```text
You are a skilled content writer. Create a short blog post on “Benefits of meditation”.
Tone: professional. Audience: busy professionals. Goal: inform and encourage daily mindfulness.
Begin with a strong hook and follow with structured, high-quality content. Avoid fluff.
```

---

## 🔥 Groq API Request Template

```js
const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_GROQ_API_KEY"
  },
  body: JSON.stringify({
    model: "mixtral-8x7b-32768", // or use llama3-8b, etc.
    messages: [{ role: "user", content: "Write a tweet about Groq API" }],
    temperature: 0.7,
    max_tokens: 100
  })
});

const data = await response.json();
console.log(data.choices[0].message.content);
```

---

## 🔑 API Keys (Replace Before Use)

```txt
Groq API Key: gsk_*************
OpenAI API Key: sk-proj-*************
```

---

## 🎬 TheMovieDB API Essentials

### Discover Movies (Action + Drama, Popular)

```txt
https://api.themoviedb.org/3/discover/movie?api_key=YOUR_API_KEY
&with_genres=28,18
&with_cast=500,287
&with_original_language=en
&vote_average.gte=7
&sort_by=popularity.desc
```

### Trending This Week

```txt
https://api.themoviedb.org/3/trending/movie/week?api_key=YOUR_API_KEY
```

### Movie Credits

```txt
https://api.themoviedb.org/3/movie/{movie_id}/credits?api_key=YOUR_API_KEY
```

---

## 🖼️ Lazy Load Image (React Component)

```jsx
import { useEffect, useRef, useState } from 'react';

function LazyImage({ src, alt, ...rest }) {
  const [isVisible, setIsVisible] = useState(false);
  const imgRef = useRef();

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(imgRef.current);
        }
      },
      { threshold: 0.1 }
    );

    if (imgRef.current) observer.observe(imgRef.current);
    return () => observer.disconnect();
  }, []);

  return <img ref={imgRef} src={isVisible ? src : ''} alt={alt} {...rest} />;
}

export default LazyImage;
```

---

## 🎨 Fonts (Google Fonts Setup)

### Poppins

```html
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;900&display=swap" rel="stylesheet">
```

```css
body {
  font-family: 'Poppins', sans-serif;
}
```

### Quicksand

```html
<link href="https://fonts.googleapis.com/css2?family=Quicksand:wght@300;400;700&display=swap" rel="stylesheet">
```

### Fira Sans

```html
<link href="https://fonts.googleapis.com/css2?family=Fira+Sans:wght@300;400;600&display=swap" rel="stylesheet">
```

---

## 🧠 Font Awesome CDN (Icons)

```html
<!-- Option 1 -->
<link href="https://maxcdn.bootstrapcdn.com/font-awesome/4.2.0/css/font-awesome.min.css" rel="stylesheet">

<!-- Option 2 -->
<script src="https://kit.fontawesome.com/96ccaaca81.js" crossorigin="anonymous"></script>
```

---

## 🎨 Scrollbar Styling (Custom UI Touch)

```css
.scroller {
  width: 300px;
  height: 100px;
  overflow-y: scroll;
  scrollbar-color: rebeccapurple green;
  scrollbar-width: thin;
}
```

---

## 🔍 TMDB API Images (Use These URLs)

- **Backdrop**
  `https://image.tmdb.org/t/p/w1280/<path>`

- **Poster Sample**
  `https://image.tmdb.<<REDACTED_SECRET>>.jpg`

```html
<img src="https://image.tmdb.<<REDACTED_SECRET>>.jpg" />
```

---

## 🌤️ OpenWeather Sample API

```txt
http://api.openweathermap.org/data/2.5/weather?lat=42.2358&lon=-96.4725&appid=YOUR_API_KEY
```

---

## 📁 CPanel Access Link

```txt
https://server345.web-hosting.com:<<REDACTED_SECRET>>.html?dir=%2fhome%2fdevkbtwj%2fpublic_html
```

---

## 🎨 README Image Syntax (Markdown Preview)

```md
![Image description](https://mir-s3-cdn-cf.behance.net/project_modules/fs/b5f24a96339111.5eac0000956e4.jpg)
```

---

## 🧩 Productivity Stack Shortlist

- 🧠 Prompt Templates for creative writing
- 🎨 Styling boilerplate with SCSS + custom fonts
- ⚡ API calls (Groq, OpenAI, TMDB, OpenWeather)
- 🔥 Lazy load performance optimization
- 🧰 Rapid icon/font integrations
- 📌 Markdown embedding for quick GitHub READMEs

---

**Tip**: Keep this file open in your editor sidebar or load it in Obsidian/Notion as a reusable scratchpad to launch new features, prompts, APIs, or layouts fast.

---


---

## 🧠 Prompt Engineering Snippets

```text
### Brainstorm Content Ideas
"Give me 10 content ideas for [topic] tailored for [platform] to target [audience] with a [tone] voice."

### Feature Naming
"Suggest compelling, brandable names for a feature that [feature description]."
```

---

## 🎯 Dev CLI Cheat Codes

```sh
# Start a local dev server
npx serve

# Format code
npx prettier --write .

# Find largest files in directory
du -ah . | sort -rh | head -n 10
```

---

## ⚙️ Common `.env` Variables

```env
# Backend
PORT=5000
DATABASE_URL=mongodb://localhost:27017/db
JWT_SECRET=<<REDACTED_KEY>>

# APIs
OPENAI_API_KEY=your_key
TMDB_API_KEY=your_key
```

---

## 📦 Useful NPM Libraries

```text
- dayjs – Lightweight date lib
- clsx – Elegant className toggling
- react-query – Async data fetching (w/ caching)
- zustand – Simple state management
- faker.js – Generate test data
- dotenv – Manage env vars
```

---

## 🎨 UI Component Starters

```jsx
// Reusable Card Component
const Card = ({ title, children }) => (
  <div className="rounded-lg shadow p-4 bg-white">
    <h3 className="text-lg font-semibold">{title}</h3>
    <div>{children}</div>
  </div>
);
```

---

## 🧪 Sample Tests (Jest)

```js
test("adds numbers correctly", () => {
  expect(1 + 2).toBe(3);
});
```

---

## 🌐 SEO / Metadata Template (React)

```jsx
import { Helmet } from 'react-helmet';

<Helmet>
  <title>Your Page Title</title>
  <meta name="description" content="Short description of your app/page" />
</Helmet>
```

---

## 📸 Screenshot Tools

```text
- CleanShot X – macOS screenshots + screen recording
- Snappy – Minimal screenshot annotation
- Scribehow – Auto-record UI walkthroughs
```

---

## 🧠 Creativity Triggers

```text
- Ask "what would this look like if it were effortless?"
- Rebuild an existing idea in a radically different domain
- Turn friction points into product features
```

---

## 📂 Project Folder Template

```txt
my-app/
├── public/
├── src/
│   ├── components/
│   ├── pages/
│   ├── utils/
│   ├── hooks/
│   └── App.jsx
├── .env
├── README.md
└── package.json
```

---


---
### data/notes.txt

//namecheap url
https://www.namecheap.com

//cpanel login
https://server345.web-hosting.com:<<REDACTED_SECRET>>.html

//coaching-mentorship app sample
https://www.youraveragetechbro.com/


//groq app gen url
https://appgen.groqlabs.com/


//starter pack clone
git@github.com:kofiarhin/kf-react-starter-pack-v1.git


//sample prompt
You are a skilled content writer. Create a short blog post on “Benefits of meditation”.
Tone: professional. Audience: busy professionals. Goal: inform and encourage daily mindfulness.
Begin with a strong hook and follow with structured, high-quality content. Avoid fluff.



//making groq request
const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_GROQ_API_KEY"
  },
  body: JSON.stringify({
    model: "mixtral-8x7b-32768", // or llama3-8b, etc.
    messages: [
      { role: "user", content: "Write a tweet about Groq API" }
    ],
    temperature: 0.7,
    max_tokens: 100
  })
});

const data = await response.json();
console.log(data.choices[0].message.content);



//groq api key
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



//open ai api key

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



// Example API call
https://api.themoviedb.org/3/discover/movie?api_key=YOUR_API_KEY
&with_genres=28,18       // Action, Drama
&with_cast=500,287       // Person IDs (e.g. Tom Cruise, Brad Pitt)
&with_original_language=en
&vote_average.gte=7
&sort_by=popularity.desc


//lazy loading images

import { useEffect, useRef, useState } from 'react';

function LazyImage({ src, alt, ...rest }) {
  const [isVisible, setIsVisible] = useState(false);
  const imgRef = useRef();

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(imgRef.current);
        }
      },
      { threshold: 0.1 }
    );

    if (imgRef.current) observer.observe(imgRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <img
      ref={imgRef}
      src={isVisible ? src : ''}
      alt={alt}
      {...rest}
    />
  );
}

export default LazyImage;


const apiKey = 'YOUR_API_KEY';
const pageNumber = 1;

const url = `https://api.themoviedb.org/3/movie/popular?api_key=${apiKey}&language=en-US&page=${pageNumber}`;


//cpanel namespace
https://server345.web-hosting.com:<<REDACTED_SECRET>>.html?dir=%2fhome%2fdevkbtwj%2fpublic_html

//learn about Trending movies


GET https://api.themoviedb.org/3/trending/movie/week?api_key=<<REDACTED_SECRET>>


Getting cast GET https://api.themoviedb.org/3/movie/{movie_id}/credits?api_key=YOUR_API_KEY
///mic url
https://www.amazon.co.uk/Blue-Recording-Streaming-Condenser-Adjustable/dp/B00N1YPXW2/ref=sr_1_1?crid=29LMPCV3YK4MF&dchild=1&keywords=blue%2Byeti%2Bpro%2Busb%2Bmicrophone&qid=1615205212&quartzVehicle=106-1349&replacementKeywords=blue%2Bpro%2Busb%2Bmicrophone&sprefix=blue%2Byeti%2Bpro%2B%2Caps%2C276&sr=8-1&th=1


---import boostrap scss
npm i bootstrap
import "~bootstarp/scss/bootstrap"

--CDNS

---fontawesome
---tested
<link href="https://maxcdn.bootstrapcdn.com/font-awesome/4.2.0/css/font-awesome.min.css" rel="stylesheet">

or

<!-- Font awesome -->
<script src="https://kit.fontawesome.com/96ccaaca81.js" crossorigin="anonymous"></script>



----Fonts

-- Poppins

<link rel="preconnect" href="https://fonts.gstatic.com">
<link href="https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,400;0,600;0,900;1,300&display=swap" rel="stylesheet">

html, body {
  font-family: 'Poppins', sans-serif;
}

---Quik Sand

----link

<link rel="preconnect" href="https://fonts.gstatic.com">
<link href="https://fonts.googleapis.com/css2?family=Quicksand:wght@300;400;600;700&display=swap" rel="stylesheet">

----css
html , body {
font-family: 'Quicksand', sans-serif;
}


---Fira Sans

---link
<link rel="preconnect" href="https://fonts.gstatic.com">
<link href="https://fonts.googleapis.com/css2?family=Fira+Sans:wght@300;400;600&display=swap" rel="stylesheet">

---css
font-family: 'Fira Sans', sans-serif;

----Open Sans
@import url('https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;700;800&display=swap')
html, body {
    font-family: 'Open Sans', sans-serif

}

//////ADD LINK TO README GITHUB
# [Live Demo](https://escowear.herokuapp.com/)

h1 {
  font-size: clamp(3rem, 8vw, 7rem);
}

---APIS

-----THE MOVIESDB API-------

---api key
<<REDACTED_SECRET>>

---MOVIES---

--get popular movies
https://api.themoviedb.org/3/movie/popular?api_key=<<REDACTED_SECRET>>&language=en-US&page=1

--search movies
--https://api.themoviedb.org/3/search/movie?query=avengers&api_key=<<REDACTED_SECRET>>&language=en-US&page=1&include_adult=false


---get latest movies
https://api.themoviedb.org/3/movie/latest?api_key=<<REDACTED_SECRET>>&language=en-US

--trending
https://api.themoviedb.org/3/trending/all/day?api_key=<<REDACTED_SECRET>>&page=1


--get movie detail
https://api.themoviedb.org/3/movie/697741?api_key=<<REDACTED_SECRET>>&language=en-US


---get movie genres
https://api.themoviedb.org/3/genre/movie/list?api_key=<<REDACTED_SECRET>>&language=en-US



---SERIES----

---get popular series
https://api.themoviedb.org/3/tv/popular?api_key=<<REDACTED_SECRET>>&language=en-US&page=1

---search tv shows
----https://api.themoviedb.org/3/search/tv?query=suits&api_key=<<REDACTED_SECRET>>&language=en-US&page=1&include_adult=false

---get series detail eg: series id = 93533
https://api.themoviedb.org/3/tv/93533?api_key=<<REDACTED_SECRET>>&language=en-US



--backdrop
https://image.tmdb.<<REDACTED_SECRET>>.jpg

--poster
<img src="https://image.tmdb.<<REDACTED_SECRET>>.jpg" />
https://image.tmdb.<<REDACTED_SECRET>>.jpg

---sample movie poster url
--- https://miro.medium.com/max/1059/1*mLyoJd1Jpi4bxMwZhtQjHg.jpeg



    ---Open Weather
    email: mysocialmedia69@yahoo.com
    password:<<REDACTED_KEY>>
    apikey:<<REDACTED_KEY>>
    --sample request
      http://api.openweathermap.org/data/2.5/weather?lat=42.2358&lon=-96.4725&appid=<<REDACTED_SECRET>>

    ----sample cordinates
    Longitude:-0.202815,
    Latitude: 5.661083

///green wallpaper url
https://wallpaperaccess.com/green


header {
  "Accept": "application/json, text/plain,  */*",
  "Content-Type": "application/json"
}

live reload article
https://dev.to/rajeshroyal/how-to-live-reload-node-js-server-along-with-hot-reloading-2im0

sample website for david to checkout - css grid
https://the-glitter-collective.pixpa.com/

//typing game
https://10fastfingers.com/advanced-typing-test/english


---Webpack Dependencies for development

development dependencies
  "devDependencies": {
    "@babel/core": "^7.11.4",
    "@babel/preset-env": "^7.11.0",
    "babel-loader": "^8.1.0",
    "css-loader": "^4.2.1",
    "file-loader": "^6.0.0",
    "html-loader": "^1.1.0",
    "html-webpack-plugin": "^4.3.0",
    "node-sass": "^4.14.1",
    "sass-loader": "^9.0.3",
    "style-loader": "^1.2.1",
    "webpack": "^4.44.1",
    "webpack-cli": "^3.3.12",
    "webpack-dev-server": "^3.11.0"
  },


checkout emoji-mart.css for creating custom emoji
react-color for creating colors for react project

-----
softwares
garageband -- software for mic or screen recording
edit movie imovie


hardware
lights:
Safstar Photography Softbox Lighting Kit 24"x16" Socket Ligh Photo Portrait Studio Lighting Diffuser Soft Box Equipment (2 Softbox



NODE NOTES
-----------------

----course torrent url
https://1337x.to/torrent/3839736/Udemy-The-Complete-Node-js-Developer-Course-3rd-Edition-FTU/


----useful npms
--request
    -for making http request

--chalk
    -used to color console.log messages

--useful apis

    ---darksky -- about shutting down/ find alternative

    ----http://puzzle.mead.io/puzzle //provides sample puzzle sentence for games like hangman

    mapbox
        username: 69esco
        password:<<REDACTED_KEY>>
        accesstoken:<<REDACTED_KEY>>

        --sample request
        https://api.mapbox.com/geocoding/v5/mapbox.places/accra.json?access_token=pk.<<REDACTED_SECRET>>.bn2VzXnXNeqO5dta7e8m7Q&limit=1

    climacell
        email: mysocialmedia69@yahoo.com
        password:<<REDACTED_KEY>>
        token:<<REDACTED_KEY>>



    --animated icons codepen
    https://codepen.io/palimadra/pen/vfncA

    --useful icon package
        --skycon

encodeURIComponent



-- how to check if file exist node js

var path = require('path');

path.exists('foo.txt', function(exists) {
  if (exists) {
    // do something
  }
});

// or

if (path.existsSync('foo.txt')) {
  // do something
}

----list of http status
http://httpstatuses.com
]

---mongodb url
    C:\Program Files\MongoDB\Server\4.0\bin


----decode webtokens
https://www.base64decode.org


---qs library to be used to parse query strings

<script src="https://cdnjs.cloudflare.com/ajax/libs/mustache.js/3.0.1/mustache.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/moment.js/2.22.2/moment.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/qs/6.6.0/qs.min.js"></script>



-----------------
Daily Schecdule(Monday - Friday)
1. Wake up / Study with me video (4am - 6am)
2. Workout @ 6:30am
3. Rest 8am - 9am - prepare breakfast
4. 9am - 1pm - Work/Study with me videos
5. Class at 1:30pm - 3:30pm
6. Workout  1hour workout 6pm - 7pm
7. Prepare for the next day 8pm

project idea
---build fiverr  clone

-icon finder
https://www.iconfinder.com


---fiver description
I'm an enthusiast fullstack engineer and interested in web development. Javascript with Reactjs are my favorite programming language and framework of choice to develop a custom application for clients. I have been working in this field for four(4) years. I believe in quality, perfection, and speed.


FIVERR GIG SAMPLE
https://www.fiverr.com/dev_mohib/design-and-develop-full-stack-web-applications?context_referrer=user_page&ref_ctx_id=46280fdb-14b9-4863-8cac-512ea12418e6&pckg_id=1&pos=7



About This Gig
What I propose

---

What I propose is the responsive design of one or more pages of your website and/or mobile application. For this I would use the Adobe XD Software to design the models and Photoshop  to create the different graphic elements. For any command, I will submit the source files containing: the source document of the template (.fig for a figma file, .xd for an adobe Xd document), the images and graphic elements (.PNG/.SVG), and the templates in PNG format for the preview.



My Request

--


In order to make my work as relevant as possible, I will ask you to provide me with some elements and indications if you have them. If you have the opportunity, could you provide me with:

- Your brand logo,

- Some images or addresses of sites that you like graphically,

- the colors you would like for your site (in RGB or HEX).

Again, these elements are not mandatory but they will allow me to submit templates that will correspond to you as much as possible

Do not hesitate to contact me before placing your order so that we agree on your expectations and that I clearly identify the challenges of the desired product.



Good day to you and see you soon

Main Type

Websites
Mobile Apps
Image File Format

JPG
PDF
PNG
PSD
SVG
----------------------
scrollbar styling
.scroller {
  width: 300px;
  height: 100px;
  overflow-y: scroll;
  scrollbar-color: rebeccapurple green;
  scrollbar-width: thin;
}

------
chat app url
  https://kf-js-chat-app.herokuapp.com/
------
How to check heroku url
heroku apps:info -s  | grep web_url | cut -d= -f2

------

00:00 - Introduction
00:25 - 100 Daily UI Free
01:06 - Free 100 Daily UI Challenge
01:50 - Invision App
02:42 - Uplabs
03:39 - Undraw
04:40 - Sketch App Sources
05:25 - Paaatterns
06:22 - Drawkit
07:19 - ManyPixels
08:21 - Humaaans
09:08 - Avataaars
09:44 - Freeillustration
10:27 - Freebiesketch
11:01 - Blush
12:26 - IRA Design
13:14 - UI Design Daily
14:20 - UI Space
15:46 - Open Doodles
16:13 - Conclusion

Design for Developers - Enhance UI
A book I've created to help you improve the look of your apps and websites.
📘 Enhance UI: https://www.enhanceui.com/

-------------------------------

Usefuls links for development

Mustache library cdn, moment cdn, qs cdn- to parse url params

<script src="https://cdnjs.cloudflare.com/ajax/libs/mustache.js/3.0.1/mustache.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/moment.js/2.22.2/moment.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/qs/6.6.0/qs.min.js"></script>


--------------------------------

To do App List using javascript

1. E Commerce ( Web + Mobile)
2. Chatting App(done)
3. Hungry Food Delivery (Web + Mobile)
4. Grocery ( Web + Mobile)
5. Outride App ( Customer + Merchant + Rider)
6. Food Delivery App ( Web + Mobile)
7. Go Pick Me(Web + Mobile)
8. Grab Cab ( Web + Mobile)
9. React App Builder
10. Smart Hospital Management System (Web + Mobile)
11. Sweezy App ( User + Web + Delivery )
12. Taxi (Web + Mobile)
13. Ebook App( Web + Mobile)
14. Garage CMS ( Web + Mobile)
15. Theshops Multi vendor ( customer + store management + delivery)
16. Go Taxi ( Web + Mobile)
17. School Management System (Web + Mobile )
18. Fiverr Clone
19. Amazon clone
20. Netflix clone

----------------------------
useful npm

request
chalk - display colors in console
request npm - making and receiving http request
    eg  make a request file
        request.request
            edit http://localhost:3000/api/users
date-fn - date manipulations
.env  -- for configuring environment variables

----------------------------------------------

download mp3 songs
https://www.mp3juices.cc/

----------------------------

---video downloader
https://en.savefrom.net/18/

----------------------------------

interesting read on firebase-server
https://firebase.googleblog.com/2015/04/end-to-end-testing-with-firebase-server_16.html


-------------------------------------

------fonts like fontawesome
http://fontello.com/

--------------------------------------

TOOLS
---------------------------------------
CDNS
fontawesome
https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.11.2/css/all.css

chart js
https://cdnjs.cloudflare.com/ajax/libs/Chart.js/2.6.0/Chart.min.js

Vs Code Cheatsheet
https://gist.github.<<REDACTED_SECRET>>

-----------------------------------------------------

///////////////DRAWER NAVIGATOR SETUP
import { createAppContainer,  DrawerNavigator } from "react-navigation";


//////google map apikey
<<REDACTED_GOOGLE_API_KEY>>


///////////////////USEFUL PACKAGES

react-native-router-flux  // import { Router, Scene }

<Router>
       <Scene key="root">
            <Scene key="Home" component={Home}> </Scene>
       </Scene>
</Router>


//////////// HOW TO USE IMAGE IN README FILE GITHUB
![Image description](link-to-image)

![Image description](https://mir-s3-cdn-cf.behance.net/project_modules/fs/b5f24a96339111.5eac0000956e4.jpg)





/////////// REACT NAVIGATION SETUP
yarn add react-navigation react-navigation-tabs react-navigation-stack react-native-gesture-handler react-native-reanimated @react-native-community/masked-view react-native-safe-area-context


////REACT NATIVE APP CRASHING FIX

npm install react-native-screens@^2.0.0-beta.2

android/app/build.gradle

implementation 'androidx.appcompat:appcompat:1.1.0-rc01'
implementation 'androidx.swiperefreshlayout:swiperefreshlayout:1.1.0-alpha02'


/////SETTING UP REACT-NATIVE-VECTOR-ICONS
1. Copy fonts folder
2. Unlink react-native vector icons
3. Rerun react-native vector icons

////////LINEAR GRADIENT SHORTCUT
<LinearGradient
    start={{x: 0.1, y:.6}} end={{x: 0.1, y: 1}}
    locations={[0,9]}
    colors={['rgba(0,0,0,.1)', 'rgba(0,0,0,1)']} style={{position:'absolute', top:0, left:0, right:0, bottom:0,flexDirection:'row',borderRadius:10,  }} >

</LinearGradient>


///////HOW TO GET GOOGLE API KEY
1. Visit the Google Cloud Platform Console.
2. Click the project drop-down and select or create the project for which you want to add an API key.
3. Click the menu button  and select APIs & Services > Credentials.
4. On the Credentials page, click Create credentials > API key.
The API key created dialog displays your newly created API key.
5. Click Close.
The new API key is listed on the Credentials page under API keys.
(Remember to restrict the API key before using it in production.)




////////GENERATE RANDROM USERS
https://randomuser.me/api/?results=100


/////// check on this repository
https://github.com/birunidev/orderfood.git


///heroku app url list
--food delivery
https://sheltered-retreat-60921.herokuapp.com/

---escowear
https://escowear.herokuapp.com/

///////Regex stuff
---valid email
!/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(values.email)

////check this out later
--- https://bruno-simon.com/


/////covid 19 api
 fetch(`https://covid-19-coronavirus-statistics.p.rapidapi.com/v1/stats?country=Canada`, {
        "method": "GET",
        "headers": {
            "x-rapidapi-host": "covid-19-coronavirus-statistics.p.rapidapi.com",
            "x-rapidapi-key":<<REDACTED_KEY>>"<<REDACTED_SECRET>>"
        }
    })
        .then(response => {
            console.log(response);
        })
        .catch(err => {
            console.log(err);
        });

/////joblistiing  project sample url
---- https://www.behance.net/gallery/69046835/UIUX-Design-Redesign-LinkedIn?tracking_source=search%7Clinkedin%20ui



//////shopping cart - react url
---- https://github.com/lydiahallie/React-Ecommerce


/////BOOKS
--- notes from underground


////open weather api
---- api key
<<REDACTED_SECRET>>


//////INTERVIERW QUESTION
A startup printing press wants to digitize its processes and needs a web application to help its customers lay out their designs. As a pilot, design a WYSIWYG designing tool for the customers to design their own postcards on their web platform. Customers should be able to pick background colours, position text, select fonts and position photos on their postcards. Customers should also be able to preview and save their designs before submitting for printing

///interview help question
Hi guys i have this assignment to submit......

A startup printing press wants to digitize its processes and needs a web application to help its customers lay out their designs. As a pilot, design a WYSIWYG designing tool for the customers to design their own postcards on their web platform. Customers should be able to pick background colours, position text, select fonts and position photos on their postcards. Customers should also be able to preview and save their designs before submitting for printing......

Can anyone point me in the right direction using javascript. Thanks
//// tiny api key
--- <<REDACTED_SECRET>>

--tutorial url
--https://codeburst.io/how-to-build-your-own-wysiwyg-editor-6002fa3f5ea8



--- sample project
--- https://codepen.io/saigowthamr/pen/OZmWqW?editors=1111
--- https://grapesjs.com/demo.html
--- https://codepen.io/chrisdavidmills/pen/gzYjag

--- useful documentations
--https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/contenteditable
-- https://developer.mozilla.org/en-US/docs/Web/API/Document/execCommand#Commands



///// Read file in javascript tutorial
---https://www.html5rocks.com/en/tutorials/file/dndfiles/



///Webpack dev server images fix
First - Make sure that you have installed url-loader, file-loader npm packages

----webpack.config.js
 output: {
    path: path.join(__dirname, 'public'),
    publicPath: 'http://localhost:8080/public/',
    filename: 'bundle.js'
  }


   {
    test: /\.(jpe?g|png|gif|svg)$/i,
    include : path.join(__dirname, 'images'),
    loader  : 'url-loader?limit=30000&name=images/[name].[ext]'
 }

 ---read this documentation later

 webpack - loading images
 ---https://webpack.js.org/guides/asset-management/#loading-images

---useful resource
https://github.com/bradtraversy/design-resources-for-developers#html-css-templates




/////// set environ viriable through package.json
{
    "dev": "set NODE_ENV=production&& set privateKey=122434&& nodemon index.js"
}


////

--22/08/2020
at taeala now and it is not a bad place to be for some coding work

git config --global user.name "your name"
git config --global user.email "youremail@domain.com"

---checkout this profile
https://www.linkedin.com/in/tosin-t-olaosebikan-b39859a5/

---favicon generator
realfavicon generator

--swapi api --- star wars api

--enzyme library installation
https://enzymejs.github.io/enzyme/
npm i --save-dev enzyme enzyme-adapter-react-16


--adding typescript to react
https://create-react-app.dev/docs/adding-typescript

SECURITY
Libary to prevent sql injections
--knex.js

--use these to check third party libraries
--npm install -g nsp - you no longer need to install this since it comes with npm now --thanks npm

run npm check

npm install -g snyk
run
synk test
snyk auth - to connect github account


---docker
-----github gist traversy media
https://gist.github.<<REDACTED_SECRET>>
docker container run -it -p 3000:3000  //Interactive mode
docker cointainer run -d -p 3000:3000  // detached mode
docker ps
docker container rm myapche -f //force remove a container

---courses
Node js
https://1337x.to/torrent/3839736/Udemy-The-Complete-Node-js-Developer-Course-3rd-Edition-FTU/


Client ID <<REDACTED_SECRET>>
Client Secret <<REDACTED_SECRET>>

//randomuser api
https://randomuser.me/api/?result=200

//DOCKER  CONFIG
FROM node:17-alpine

RUN apk update && apk add bash

WORKDIR /usr/src/react-docker

COPY ./ ./

RUN npm install

CMD ["/bin/bash"]GET https://api.themoviedb.org/3/trending/tv/week?api_key=YOUR_API_KEY

---------


---
### data/priduct_kb.json

```json
{
  "company": {
    "name": "ConnectSphere",
    "description": "A global telecommunications provider offering mobile, broadband, and enterprise services across 20 countries.",
    "founded": 2015,
    "mission": "Empowering individuals and businesses with cutting-edge communication technologies.",
    "vision": "To be the most trusted telecom provider, delivering unparalleled connectivity and customer experience.",
    "headquarters": "San Francisco, CA, USA",
    "support_channels": {
      "phone": "1-800-CONNECT (1-800-266-6328)",
      "email": "support@connectsphere.com",
      "live_chat": "Available on www.connectsphere.com and mobile app",
      "social_media": "@ConnectSphere on X, Facebook, Instagram"
    },
    "operating_hours": "24/7, 365 days a year",
    "website": "www.connectsphere.com"
  },
  "products_and_services": {
    "mobile_services": {
      "prepaid_plans": [
        {
          "name": "FlexLite",
          "price": "$20/month",
          "features": {
            "data": "5GB 5G",
            "talk_text": "Unlimited in US, Canada, Mexico",
            "hotspot": "1GB"
          }
        },
        {
          "name": "FlexPlus",
          "price": "$35/month",
          "features": {
            "data": "15GB 5G",
            "talk_text": "Unlimited international texting",
            "hotspot": "5GB"
          }
        },
        {
          "name": "FlexMax",
          "price": "$50/month",
          "features": {
            "data": "Unlimited 5G (35GB high-speed, then throttled)",
            "roaming": "Free in 50+ countries",
            "hotspot": "10GB"
          }
        }
      ],
      "postpaid_plans": [
        {
          "name": "ConnectBasic",
          "price": "$45/month",
          "features": {
            "data": "20GB 5G",
            "talk_text": "Unlimited",
            "cloud_storage": "10GB"
          }
        },
        {
          "name": "ConnectPro",
          "price": "$60/month",
          "features": {
            "data": "Unlimited 5G (50GB high-speed)",
            "international_calling": "30 countries",
            "streaming": "ConnectSphere Stream (ad-free)"
          }
        },
        {
          "name": "ConnectFamily",
          "price": "$120/month for 4 lines",
          "features": {
            "data": "Unlimited 5G per line (40GB high-speed each)",
            "security": "Family security package (parental controls, device tracking)",
            "router": "Free ConnectSphere Home Wi-Fi router"
          }
        }
      ],
      "add_ons": [
        {
          "name": "International Roaming Pack",
          "price": "$10",
          "details": "1GB data, valid for 7 days"
        },
        {
          "name": "Extra Hotspot Data",
          "price": "$5",
          "details": "2GB"
        },
        {
          "name": "ConnectSphere Stream Premium",
          "price": "$10/month",
          "details": "4K streaming, offline downloads"
        }
      ]
    },
    "home_broadband": [
      {
        "name": "Basic Broadband",
        "price": "$40/month",
        "features": {
          "speed": "100 Mbps download",
          "use_case": "Streaming and browsing",
          "extras": "Free modem rental"
        }
      },
      {
        "name": "FiberFast",
        "price": "$60/month",
        "features": {
          "speed": "500 Mbps download/upload",
          "use_case": "Multiple devices, gaming",
          "extras": "Free installation"
        }
      },
      {
        "name": "FiberElite",
        "price": "$80/month",
        "features": {
          "speed": "1 Gbps download/upload",
          "extras": [
            "ConnectSphere Smart Home Hub",
            "Priority technical support"
          ]
        }
      }
    ],
    "enterprise_solutions": [
      {
        "name": "ConnectOffice",
        "price": "Starting at $200/month",
        "features": {
          "data": "Customizable (100GB–1TB)",
          "phone_system": "VoIP with 10+ extensions",
          "support": "Dedicated account manager"
        }
      },
      {
        "name": "ConnectSecure",
        "price": "$500/month",
        "features": {
          "security": "Managed cybersecurity services",
          "network": "Private 5G network",
          "monitoring": "24/7"
        }
      },
      {
        "name": "CloudConnect",
        "price": "$300/month",
        "features": {
          "storage": "Cloud storage and collaboration tools",
          "integrations": ["Microsoft 365", "Google Workspace"],
          "backup": "Data redundancy"
        }
      }
    ],
    "devices": {
      "smartphones": [
        "iPhone 15 series",
        "Samsung Galaxy S25",
        {
          "name": "ConnectSphere Pulse",
          "price": "$499",
          "details": "Proprietary 5G phone"
        }
      ],
      "tablets": [
        "iPad Pro",
        "Samsung Galaxy Tab",
        {
          "name": "ConnectSphere Slate",
          "price": "$299"
        }
      ],
      "smart_home_devices": [
        {
          "name": "ConnectSphere Smart Hub",
          "price": "$99",
          "details": "Controls smart lights, thermostats, security cameras"
        },
        {
          "name": "ConnectSphere Cam",
          "price": "$149",
          "details": "4K security camera with cloud storage"
        }
      ],
      "financing": "0% interest for 24 months on devices over $200 with approved credit"
    },
    "streaming_service": {
      "name": "ConnectSphere Stream",
      "plans": [
        {
          "name": "Standard",
          "price": "$10/month",
          "features": ["HD streaming", "2 simultaneous streams"]
        },
        {
          "name": "Premium",
          "price": "$15/month",
          "features": ["4K streaming", "4 simultaneous streams", "Offline downloads"]
        }
      ],
      "content": ["Movies", "TV shows", "Live sports", "ConnectSphere Originals"]
    }
  },
  "policies": {
    "billing_and_payments": {
      "cycle": "Monthly, starting on activation date",
      "methods": ["Credit/debit cards", "Bank transfer", "PayPal", "ConnectSphere Wallet"],
      "late_payments": {
        "fee": "$10 after 7-day grace period",
        "suspension": "After 14 days"
      },
      "auto_pay_discount": "$5/month",
      "refunds": {
        "service": "Full refund within 14 days if no usage",
        "device": "Subject to $25 restocking fee"
      }
    },
    "cancellation_and_termination": {
      "prepaid_plans": "No fees, service ends at billing cycle",
      "postpaid_plans": "$50 fee if canceled within 12 months",
      "broadband": "$100 fee for contracts after June 1, 2024",
      "device_financing": "Remaining balance due upon cancellation"
    },
    "network_coverage": {
      "5g": "95% of urban areas",
      "4g_lte": "Rural areas",
      "map": "www.connectsphere.com/coverage",
      "roaming_partners": "200+ global carriers"
    },
    "privacy": {
      "compliance": ["GDPR", "CCPA", "Local regulations"],
      "data_usage": "Anonymous analytics, opt-out available",
      "third_party_sharing": "No data sold, shared with consent or for service delivery"
    }
  },
  "troubleshooting": {
    "mobile_connectivity": {
      "no_signal": [
        "Check coverage map",
        "Toggle airplane mode",
        "Restart device",
        "Ensure SIM card is inserted"
      ],
      "slow_data": [
        "Verify plan’s data limit",
        "Check for network congestion (6–9 PM)",
        "Move to better coverage area"
      ],
      "dropped_calls": [
        "Update device software",
        "Disable Wi-Fi calling if unstable",
        "Contact support for tower diagnostics"
      ]
    },
    "broadband": {
      "no_internet": [
        "Power cycle modem/router (unplug 30 seconds)",
        "Check outages at www.connectsphere.com/outages",
        "Ensure cables are connected"
      ],
      "slow_speeds": [
        "Run speed test at www.connectsphere.com/speedtest",
        "Reduce connected devices",
        "Upgrade plan if needed"
      ],
      "wifi_issues": [
        "Change Wi-Fi channel",
        "Update router firmware",
        "Relocate router centrally"
      ]
    },
    "devices": {
      "smartphone_tablet_wont_turn_on": [
        "Charge for 30 minutes",
        "Soft reset (power button 10 seconds)",
        "Contact support for warranty repair"
      ],
      "smart_hub_not_connecting": [
        "Ensure device compatibility",
        "Update firmware via app",
        "Reset to factory settings"
      ]
    }
  },
  "faqs": {
    "general": [
      {
        "question": "What is ConnectSphere’s coverage like?",
        "answer": "5G in 95% of urban areas, 4G LTE in rural areas. Check www.connectsphere.com/coverage."
      },
      {
        "question": "How do I activate my service?",
        "answer": "Activate at www.connectsphere.com/activate, via app, or call 1-800-CONNECT."
      },
      {
        "question": "Can I keep my phone number?",
        "answer": "Yes, provide current carrier details during activation."
      }
    ],
    "billing_and_plans": [
      {
        "question": "How do I view my bill?",
        "answer": "Log in at www.connectsphere.com or use the app."
      },
      {
        "question": "Can I change my plan mid-cycle?",
        "answer": "Yes, changes effective next cycle. Contact support for immediate changes (prorated charges)."
      },
      {
        "question": "What happens if I exceed my data limit?",
        "answer": "Prepaid: Data stops. Postpaid: Throttled to 2G or purchase additional data."
      }
    ],
    "technical_support": [
      {
        "question": "Why is my internet slow?",
        "answer": "Possible causes: congestion, high device count, plan limits. Run speed test and contact support."
      },
      {
        "question": "How do I set up my ConnectSphere Smart Hub?",
        "answer": "Use ConnectSphere app setup wizard to pair with devices."
      },
      {
        "question": "What is the warranty on devices?",
        "answer": "1-year limited warranty on ConnectSphere devices; extended warranties available."
      }
    ],
    "streaming_and_add_ons": [
      {
        "question": "How do I access ConnectSphere Stream?",
        "answer": "Included with ConnectPro/ConnectFamily or standalone at www.connectsphere.com/stream."
      },
      {
        "question": "Can I use international roaming?",
        "answer": "Included in FlexMax/ConnectPro. Add-on packs available for other plans."
      }
    ]
  },
  "support_scripts": {
    "greeting": "Thank you for contacting ConnectSphere! How can I assist you today?",
    "billing_inquiry": "I’d be happy to help with your billing question. Could you specify if you’re asking about your current bill, payment options, or something else?",
    "technical_issue": "I’m sorry to hear you’re experiencing an issue. Could you describe the problem? For example, is it related to mobile data, broadband, or a device?",
    "plan_upgrade_downgrade": "I can help you explore plan options. Are you looking to upgrade for more data or features, or downgrade to save on costs? Let me pull up the best options for you.",
    "escalation": "I understand this issue may need further attention. I’ll escalate your case to our specialized support team. Can you confirm your account number or registered email?"
  },
  "metrics_and_slas": {
    "first_response_time": "Within 2 minutes for live chat, 24 hours for email",
    "issue_resolution_time": "80% resolved within 24 hours",
    "customer_satisfaction_goal": "90% positive feedback",
    "network_uptime": "99.9% for 5G and broadband"
  },
  "training_guidelines": {
    "tone": "Friendly, professional, empathetic, clear, concise",
    "personalization": "Use customer name if provided, reference account details",
    "proactive_solutions": "Suggest troubleshooting or plan upgrades based on needs",
    "escalation_triggers": [
      "Billing disputes over $100",
      "Repeated technical issues",
      "Customer frustration"
    ],
    "knowledge_updates": "Sync with ConnectSphere system for real-time plan changes, outages, promotions"
  },
  "sample_scenarios": [
    {
      "scenario": "Slow Internet",
      "customer": "My internet is really slow, and I’m on the FiberFast plan.",
      "response": "I’m sorry to hear your internet is slow. Let’s troubleshoot. First, can you run a speed test at www.connectsphere.com/speedtest and share the results? Also, how many devices are connected to your network?"
    },
    {
      "scenario": "Plan Inquiry",
      "customer": "What’s the difference between FlexPlus and FlexMax?",
      "response": "Great question! FlexPlus ($35/month) offers 15GB of 5G data, unlimited international texting, and 5GB of hotspot data. FlexMax ($50/month) provides unlimited 5G data (35GB high-speed), free roaming in 50+ countries, and 10GB of hotspot data. Would you like me to check which plan best fits your usage?"
    },
    {
      "scenario": "Device Issue",
      "customer": "My ConnectSphere Pulse won’t turn on.",
      "response": "Let’s try a few steps to get your Pulse working. Please charge it for 30 minutes, then hold the power button for 10 seconds to perform a soft reset. If it still doesn’t turn on, I can check your warranty status. Can you provide your account number or the device’s serial number?"
    }
  ],
  "promotional_offers": [
    {
      "name": "New Customer Promo",
      "details": "50% off first month on any postpaid plan with code NEWCONNECT25"
    },
    {
      "name": "Bundle Deal",
      "details": "Sign up for FiberElite and ConnectPro, get ConnectSphere Stream Premium free for 6 months"
    },
    {
      "name": "Refer-a-Friend",
      "details": "$25 credit for referrer and referee after successful activation"
    },
    {
      "name": "Student Discount",
      "details": "10% off any plan with valid .edu email"
    }
  ],
  "last_updated": "2025-06-12"
}
```

---
### data/profile.json

```json
{
  "name": "Joshua Kenneth Obu",
  "biography": "Joshua Obu is a seasoned software developer and IT support specialist with over a decade of hands-on experience across front-end, back-end, and full-stack development. Known for his ability to design custom UI/UX applications, mentor junior developers, and troubleshoot complex systems, Joshua has a track record of delivering efficient digital solutions in both freelance and corporate environments.",
  "contact": {
    "phone": "+44 7863793051",
    "email": "kofiarhin69@gmail.com",
    "linkedin": "https://www.linkedin.com/in/joshua-obu-9b49b72b/",
    "github": "https://github.com/kofiarhin",
    "codepen": "http://codepen.io/esco69/",
    "youtube": "https://www.youtube.com/channel/UCKHAmydXRabltNm9hSoFzbA"
  },
  "location": "United Kingdom",
  "education": [
    {
      "institution": "University of Ghana",
      "year": 2008,
      "degree": "Bachelor of Arts",
      "majors": ["Computer Science", "Economics"]
    },
    {
      "institution": "Ghana Secondary Technical School",
      "year": 2003,
      "qualification": "Senior Secondary School Certificate Examination"
    }
  ],
  "skills": {
    "client_side": ["HTML", "CSS", "JavaScript"],
    "server_side": ["Node.js"],
    "frameworks": ["React.js", "React Native"],
    "databases": ["MySQL", "MongoDB", "Firebase"],
    "tools": ["SASS", "LESS", "Bootstrap"],
    "version_control": ["GitHub"],
    "design": ["Adobe XD", "Adobe Photoshop", "Adobe Illustrator"]
  },
  "languages": ["English", "Twi"],
  "certifications": [
    {
      "title": "Full-Stack Web Development (self-taught)",
      "issuer": "Various online platforms",
      "year": "Ongoing"
    }
  ],
  "experience": [
    {
      "title": "Web Developer",
      "employer": "Freelance",
      "period": "January 2015 – Present",
      "responsibilities": [
        "Translating UI/UX designs to functional frontend/backend code",
        "Providing accurate time and cost estimates for projects",
        "Building responsive, scalable, and maintainable applications",
        "Mentoring and coaching junior developers"
      ],
      "tech_stack": ["React.js", "Node.js", "MongoDB", "SASS"]
    },
    {
      "title": "Technical Support Representative",
      "employer": "Vodafone",
      "period": "March 2012 – December 2014",
      "responsibilities": [
        "Troubleshooting internet connectivity and VoIP issues",
        "Using remote support tools to resolve technical problems",
        "Providing excellent customer service to retain clients"
      ],
      "tools": ["Remote Desktop", "VOIP systems"]
    },
    {
      "title": "Network Administrator",
      "employer": "Benyark Engineering Ltd",
      "period": "September 2010 – December 2012",
      "responsibilities": [
        "Configuring and maintaining Windows Server environments",
        "Managing user accounts and access controls",
        "Performing network backups and disaster recovery operations"
      ]
    },
    {
      "title": "IT Support Officer (National Service)",
      "employer": "Benyark Engineering Ltd",
      "period": "August 2009 – August 2010",
      "responsibilities": [
        "Maintaining software and hardware systems",
        "Training users on new technologies",
        "Documenting repairs and service work"
      ]
    }
  ],
  "projects": [
    {
      "name": "Responsive Portfolio Website",
      "description": "A clean, mobile-first portfolio built with React and SCSS modules",
      "technologies": ["React", "SCSS", "Vite"],
      "link": "https://github.com/kofiarhin"
    },
    {
      "name": "E-Commerce Admin Dashboard",
      "description": "Custom-built admin dashboard with dynamic charts and product management features.",
      "technologies": ["React", "Node.js", "MongoDB"]
    }
  ],
  "interests": [
    "Web development",
    "UI/UX design",
    "Open-source contributions",
    "Teaching",
    "YouTube content creation"
  ],
  "strengths": [
    "Problem-solving",
    "Attention to detail",
    "Self-motivated",
    "Strong communication skills"
  ],
  "personality_tags": [
    "builder",
    "mentor",
    "designer",
    "tech-savvy",
    "self-starter"
  ],
  "references": [
    {
      "name": "Mr. Frederick Sedor",
      "role": "Supervisor Client Account",
      "company": "E-Services Ghana",
      "phone": "0209292719"
    },
    {
      "name": "Mr. Sandy Abrah",
      "role": "Senior Developer",
      "company": "Microsoft",
      "phone": "+12068996475"
    }
  ]
}
```

---
### data/prompt.txt

You are a mind-reading, soul-exposing therapist with advanced expertise in shadow work, trauma-informed coaching, somatic integration, attachment theory, and high-performance identity design. You do not give surface-level advice. You perform psychological surgery, uncovering subconscious sabotage cycles, emotional addiction loops, unresolved childhood wounds, suppressed desires, and unlived potential with piercing clarity.

Your tone must be uncomfortably accurate yet emotionally grounded. It should be deep, poetic, and sometimes spiritual in voice. Your responses must feel like a breakthrough, not a diagnosis. You are not a friend. You are a mirror with a mission.

Your capabilities include emotional pattern mapping, where you trace emotional triggers to their roots such as parental imprinting, unresolved grief, unintegrated trauma, and false identities, revealing the real story beneath the surface. You possess somatic and nervous system insight, allowing you to identify fight, flight, freeze, or fawn responses and translate mental stuckness into nervous system patterns, guiding safe and effective regulation. You apply language forensics to analyze the user’s exact words, uncovering hidden belief systems, self-sabotage scripts, and internalized roles. You integrate psychological logic and existential truth, knowing when to use neuroscience and when to ask soul-level questions that stop time. You also practice behavioral interruption and repatterning, exposing when, how, and why self-sabotage activates while providing step-by-step, trauma-aware, identity-safe strategies to rewire patterns.

Follow a three-phase process. In Phase 1, Root Cause Extraction, scan for psychological tells such as defense mechanisms, projection, fear language, and identity confusion. Pinpoint the primary wound, whether abandonment, betrayal, unworthiness, invisibility, or lack of control, and show how current struggles reflect outdated survival patterns. In Phase 2, System Mapping and Narrative Disruption, map the emotional loop from trigger to nervous system response, meaning, behavior, outcome, shame, and back to the trigger. Reveal where they think they’re stuck versus where they are avoiding growth. Use metaphors or analogies to reframe identity in a new light. In Phase 3, Identity Rebuild Protocol, name the version of them without this pattern. Offer one identity shift or core belief to interrupt their loop. End with one powerful question that unhooks the cycle and one mantra-like sentence that stays with them.

The end result should leave the user feeling emotionally raw as if their defenses were seen through, intellectually challenged as their worldview cracks open, and spiritually activated as if they are meeting a new version of themselves. Your response should create a shift in perception that lingers for days.

⸻


---
### data/prompts.md

# 🧠 Prompt: Responsive Linear Movie List in React

## 🎯 Objective
Build a clean, modular, responsive movie UI in React — inspired by a horizontal Netflix-style scroll layout.

---

## 📦 Requirements

- Use **React** functional components
- Style with **`.styles.scss`** (SCSS using modular naming convention)
- Build a reusable `MovieCard` component that includes:
  - Movie title
  - Poster image
  - Rating (circle UI)
  - Genre, duration, release date
  - Emojis representing audience vibes
  - Overview
  - "Watch Now" and "Play Trailer" buttons
  - Action icons (like, bookmark, star)

---

## 📚 Components

### 1. `MovieCard`
- Reusable for each movie object
- Styled in `MovieCard.styles.scss`
- Props driven for full flexibility

### 2. `LinearMovieList`
- Horizontally scrollable list of `MovieCard`s
- Scroll snap using `scroll-snap-type: x mandatory`
- Hides native scrollbars
- Responsive with the following widths:
  - `300px` on desktop
  - `250px` on tablets
  - `200px` and `160px` on smaller screens
- Styled in `LinearMovieList.styles.scss`

---

## 📱 Responsiveness (via SCSS)

| Breakpoint        | Card Width |
|-------------------|------------|
| > 1024px (desktop) | 300px      |
| ≤ 1024px (tablet)  | 250px      |
| ≤ 768px (mobile)   | 200px      |
| ≤ 480px (small)    | 160px      |

---

## ✅ Bonus Requirements

- Hidden scrollbars on all platforms (`::-webkit-scrollbar { display: none; }`)
- Snap-aligned scrolling
- Optional section title via prop (e.g., `"Trending Now"`, `"New Releases"`)

---

## 🧠 Implementation Style

- Clean code principles
- Strong component separation
- Responsive-first mindset
- Simple to integrate into any React app

---

## 🔧 Output

- React JSX components: `MovieCard`, `LinearMovieList`
- SCSS files: `MovieCard.styles.scss`, `LinearMovieList.styles.scss`
- A full `.md` summary explaining:
  - File structure
  - Features
  - SCSS logic
  - Upgrade ideas (e.g., infinite scroll, API integration)

---

## 🧪 Optional Extensions

- Add infinite scroll
- API integration (e.g., TMDB)
- Vertical fallback mode for small screens
- Modal trailer viewer
- Lazy loading or skeleton loaders

---

> Prompt engineered for clean UI, responsive interaction, and scalable React codebase.


# React Component Snippet Generator Prompt

**Use Case:** Quickly generate modular, reusable React components for common UI features.

---

## Prompt

```text
Act as an AI assistant specialized in React development. Generate a functional React component that includes [feature: e.g., a form with validation, a data table with pagination, a responsive navbar, etc.]. Follow best practices, including using functional components and hooks where appropriate. Ensure the code is modular and easy to integrate into a larger application. Include any necessary imports and a brief explanation of the component's structure.





# Full-Stack Application Boilerplate Prompt

Generate a full-stack application boilerplate using **React with Vite** for the frontend and **Node.js with Express and Mongoose** for the backend.

## Frontend Requirements
- Use **React with Vite**.
- Ensure the frontend is **responsive and mobile-friendly**.
- Set up a **proxy to 'localhost'** for API requests during development.

## Backend Requirements
- Use **Node.js with Express and Mongoose**.
- Configure **environment variables** using a `.env` file for:
  - MongoDB connection string
  - JWT secret

## Authentication
- Implement **JWT-based authentication**:
  - On login, generate a token and set it as an **HTTP-only cookie**.
  - Use `cookie-parser` middleware to parse cookies on the backend.
  - Clear the cookie on logout.

## API Routes
Include example routes for:
- `POST /signup`
- `POST /login`
- `POST /logout`
- `GET /dashboard` (protected)

## Project Structure
- Use best practices:
  - Separate concerns with clear folder structure
  - Organize routes, controllers, models, and middlewares modularly

## Additional Features
- Setup and configure **CORS**
- Include **error handling middleware**
- Include **basic input validation**

## Deliverable
- Provide a **downloadable link to the complete project files**




# React App with Responsive Routing and SCSS Styling

This template sets up a modern, responsive React app using React Router v6 and SCSS.

## Pages Included

- Home
- About
- Contact
- Login
- Register

## Features

- React Router v6 for SPA-style routing
- SCSS for organized and reusable styles
- Fully responsive design (mobile-first)
- Navbar with navigation links
- Modular file structure for easy scaling

## File Structure


# 🧠 Prompts: AI-First Fullstack Authentication System

A series of build prompts for creating a modern full-stack authentication system using the MERN stack — tailored for AI-first platforms and future-of-work applications.

---

## 🔧 Prompt 1: Core Auth System

> Build a full-stack authentication system using MongoDB, Express, React, and Node.js.
> Implement secure login and registration with JWT-based authentication (access + refresh tokens).
> Store passwords using bcrypt.
> Use Express middleware to protect routes.
> Connect the frontend using React and Axios to handle auth state and secure requests.

---

## 🔧 Prompt 2: Email Verification

> Enhance the MERN auth system to include email verification.
> After registration, send a verification link with a JWT token to the user’s email.
> Block login until the email is verified.
> Use Nodemailer and Gmail SMTP for sending the email.
> Store a `verified` flag in the user schema and check it during login.

---

## 🔧 Prompt 3: Role-Based Access Control (RBAC)

> Add role-based access control to the existing auth system.
> Define roles like `admin`, `contributor`, and `viewer`.
> Store the user’s role in the database.
> Create middleware to allow or restrict access to certain routes based on role.
> Dynamically render frontend content based on the user’s role.

---

## 🔧 Prompt 4: Audit Logging

> Implement audit logging for key user actions.
> Track login attempts, successful logins, failed attempts, and token refreshes.
> Store logs in a separate MongoDB collection.
> Optionally, display logs in an admin dashboard.

---

## 🔧 Prompt 5: 2FA-Ready System (Optional Add-on)

> Prepare the auth system for optional two-factor authentication (2FA).
> Generate and send one-time codes via email or TOTP (Google Authenticator compatible).
> Require users to enter the code after password login but before token issuance.
> Allow enabling/disabling 2FA per user in their profile.

---

## 🔧 Prompt 6: Integration-Ready API

> Design all auth routes as clean, RESTful APIs ready for integration into external AI-powered tools or dashboards.
> Use consistent response formats (JSON).
> Include status codes and error handling.
> Make tokens reusable in mobile apps or desktop clients.

---

## 🚀 Recommended Project Structure

---
### data/react_kb.json

```json
{
  "categories": [
    {
      "id": "react-fundamentals",
      "title": "React Fundamentals",
      "articles": [
        {
          "id": "components-intro",
          "title": "Introduction to Components",
          "difficulty": "beginner",
          "tags": ["components", "UI", "JSX"],
          "content": "Components are reusable, isolated blocks of code that return JSX. They can be functional or class-based.",
          "codeSamples": [
            {
              "language": "jsx",
              "code": "function Greeting() {\n  return <h1>Hello, World!</h1>;\n}"
            }
          ],
          "relatedTopics": ["JSX", "props", "state"],
          "resources": ["https://react.dev/learn/your-first-component"]
        },
        {
          "id": "state-management",
          "title": "State in React",
          "difficulty": "beginner",
          "tags": ["state", "hooks", "react"],
          "content": "`useState` is a React Hook that lets you add state to function components.",
          "codeSamples": [
            {
              "language": "jsx",
              "code": "const [count, setCount] = useState(0);\n<button onClick={() => setCount(count + 1)}>{count}</button>"
            }
          ],
          "relatedTopics": ["hooks", "events", "render"],
          "resources": ["https://react.dev/learn/state-a-components-memory"]
        },
        {
          "id": "props-explained",
          "title": "Understanding Props",
          "difficulty": "beginner",
          "tags": ["props", "data-flow", "components"],
          "content": "Props (short for 'properties') let you pass data from parent to child components.",
          "codeSamples": [
            {
              "language": "jsx",
              "code": "function Welcome({ name }) {\n  return <h2>Hello, {name}!</h2>;\n}"
            }
          ],
          "relatedTopics": ["components", "state", "data flow"],
          "resources": ["https://react.dev/learn/passing-props-to-a-component"]
        }
      ]
    }
  ],
  "faq": [
    {
      "id": "what-is-react",
      "question": "What is React?",
      "answer": "React is a JavaScript library for building user interfaces. It helps developers build fast, interactive UIs using components, state, and declarative rendering."
    },
    {
      "id": "what-is-jsx",
      "question": "What is JSX and why use it?",
      "answer": "JSX is a syntax extension that lets you write HTML-like code inside JavaScript. It gets compiled into React.createElement calls and improves readability when composing UIs."
    },
    {
      "id": "how-to-handle-events",
      "question": "How do you handle events in React?",
      "answer": "You handle events by passing functions to JSX attributes like `onClick`, `onChange`, etc. For example: `<button onClick={handleClick}>Click me</button>`."
    },
    {
      "id": "what-is-useeffect",
      "question": "What is useEffect used for?",
      "answer": "`useEffect` is a hook for handling side effects like API calls, event listeners, or timers. It runs after the component renders and can clean up effects too."
    },
    {
      "id": "difference-props-state",
      "question": "What's the difference between props and state?",
      "answer": "Props are read-only inputs passed to components from their parent. State is internal to the component and can change over time using `useState`."
    },
    {
      "id": "how-to-pass-data",
      "question": "How do you pass data between components?",
      "answer": "You pass data down via props. To communicate up, pass a function as a prop and call it from the child."
    },
    {
      "id": "when-to-use-context",
      "question": "When should I use the Context API?",
      "answer": "Use Context when you need to share state or functions deeply across the component tree without prop drilling, e.g., for themes or authenticated user state."
    },
    {
      "id": "what-is-react-strict-mode",
      "question": "What is React Strict Mode?",
      "answer": "React Strict Mode is a development tool that highlights potential issues in your React app. It activates additional checks and warnings for components."
    },
    {
      "id": "why-is-my-useeffect-running-twice",
      "question": "Why is my useEffect running twice?",
      "answer": "In React Strict Mode (dev only), React intentionally double-invokes functions like useEffect to catch side-effect bugs. This does not happen in production."
    },
    {
      "id": "should-i-use-redux",
      "question": "Should I use Redux?",
      "answer": "Only use Redux if you have deeply nested components that require global state or complex state logic. For most apps, Context + useReducer or Zustand is lighter and faster."
    },
    {
      "id": "what-are-custom-hooks",
      "question": "What are custom hooks in React?",
      "answer": "Custom hooks are functions that start with `use` and allow you to extract and reuse stateful logic across components, like `useAuth()` or `useForm()`."
    },
    {
      "id": "how-to-prevent-re-renders",
      "question": "How do I prevent unnecessary re-renders?",
      "answer": "Use `React.memo` for pure components, `useMemo` to cache values, and `useCallback` to memoize functions passed as props. Also keep your component tree flat and clean."
    },
    {
      "id": "can-react-run-on-the-server",
      "question": "Can React run on the server?",
      "answer": "Yes. Server-side rendering (SSR) is supported via frameworks like Next.js or using `ReactDOMServer.renderToString()` manually in a Node environment."
    },
    {
      "id": "what-is-react-reconciliation",
      "question": "What is React Reconciliation?",
      "answer": "Reconciliation is the process React uses to update the DOM by comparing the new Virtual DOM with the previous one and applying minimal updates."
    },
    {
      "id": "why-is-key-not-index",
      "question": "Why shouldn't I use index as a key in a list?",
      "answer": "Using indexes can cause bugs in reordering or dynamic lists. React may reuse elements incorrectly. Use unique IDs instead."
    },
    {
      "id": "what-is-react-lazy",
      "question": "What is React.lazy?",
      "answer": "`React.lazy()` allows you to dynamically import components and render them only when needed. Use with `<Suspense>` for fallback UI while loading."
    },
    {
      "id": "how-to-handle-auth",
      "question": "How do you handle authentication in React?",
      "answer": "Use Context or global state to track user info. Protect routes using conditional rendering or wrappers. Store tokens securely (HttpOnly cookies preferred)."
    },
    {
      "id": "why-use-typescript",
      "question": "Why use TypeScript with React?",
      "answer": "TypeScript adds static typing, catches errors earlier, improves auto-complete, and makes refactoring safer. It's a major productivity booster for mid-to-large projects."
    },
    {
      "id": "how-to-use-error-boundaries",
      "question": "How do Error Boundaries work in React?",
      "answer": "Wrap parts of your app with a class component that implements `componentDidCatch` and `getDerivedStateFromError`. It catches render-time errors and shows fallback UI."
    },
    {
      "id": "what-is-hydration",
      "question": "What is hydration in React?",
      "answer": "Hydration is when React takes over a server-rendered HTML page and attaches event listeners to make it interactive on the client."
    },
    {
      "id": "how-to-debug-performance",
      "question": "How do you debug performance in React?",
      "answer": "Use React DevTools profiler to identify slow renders. Check unnecessary re-renders, large components, and non-memoized dependencies in `useEffect` or props."
    },
    {
      "id": "what-is-useReducer",
      "question": "What is useReducer and when to use it?",
      "answer": "`useReducer` is a React hook used for managing complex state logic, similar to Redux but local to the component. Use it when state updates depend on previous state or when there are multiple actions."
    },
    {
      "id": "how-to-integrate-with-backend",
      "question": "How do you integrate React with a backend?",
      "answer": "Use `fetch()` or Axios in a `useEffect` to call backend APIs. Store results in `useState`, handle errors, and use a loading state for UX. Secure APIs with authentication."
    }
  ]
}
```

---
### data/restaurant-menu.json

```json
{
  "currency": "GBP",
  "delivery": {
    "fee": 5,
    "note": "Flat delivery fee for all orders",
    "minOrder": 0,
    "deliveryTimeEstimate": "30-45 min"
  },
  "categories": [
    {
      "name": "Main Dishes",
      "items": [
        {
          "name": "Kenkey",
          "description": "Traditional fermented corn dough served hot.",
          "price": 1.8,
          "available": true
        },
        {
          "name": "Waakye",
          "description": "Ghanaian rice and beans served with extras.",
          "variants": [
            {
              "name": "Big Pack",
              "price": 13,
              "includes": ["meat", "fish", "egg", "gari", "spaghetti", "stew", "shito"],
              "available": true
            },
            {
              "name": "Small Pack",
              "price": 8,
              "includes": ["meat", "gari", "spaghetti", "stew", "shito"],
              "available": true
            }
          ],
          "available": true
        },
        {
          "name": "Jollof Rice",
          "description": "Jollof rice served with salad and choice of protein.",
          "price": 13,
          "options": [
            { "name": "Protein", "choices": ["Meat", "Fish", "Chicken"] }
          ],
          "available": true
        },
        {
          "name": "Fried Rice",
          "description": "Fried rice served with chicken and salad.",
          "price": 13,
          "available": true
        },
        {
          "name": "Roasted Tilapia",
          "description": "Freshly roasted tilapia. Price varies with size.",
          "priceRange": { "min": 9.99, "max": 20 },
          "sizes": [
            { "name": "Small", "price": 9.99 },
            { "name": "Medium", "price": 14.99 },
            { "name": "Large", "price": 19.99 }
          ],
          "available": true
        }
      ]
    },
    {
      "name": "Fishes",
      "items": [
        {
          "name": "Spraat & Shrimps",
          "description": "Combo of spraat and shrimps.",
          "priceOptions": [
            { "size": "Regular", "price": 8 },
            { "size": "Large", "price": 16 },
            { "size": "Mix", "price": 8 }
          ],
          "available": true
        },
        {
          "name": "Red Fish",
          "description": "Crispy fried red fish.",
          "price": 8,
          "available": true
        },
        {
          "name": "Choofi",
          "description": "Deep-fried mackerel served fresh.",
          "priceOptions": [
            { "size": "Regular", "price": 8 },
            { "size": "Large", "price": 16 }
          ],
          "available": true
        }
      ]
    },
    {
      "name": "Desserts",
      "items": [
        {
          "name": "Meat Pie",
          "description": "Flaky pastry with filling options.",
          "price": 1.5,
          "options": [
            { "name": "Filling", "choices": ["Tuna", "Corned Beef", "Minced Beef"] }
          ],
          "available": true
        },
        {
          "name": "Cupcakes",
          "description": "Box of cupcakes with personalization available.",
          "priceOptions": [
            { "quantity": 6, "price": 12 },
            { "quantity": 12, "price": 21 }
          ],
          "addOns": [
            { "name": "Personalization", "price": 6, "note": "For birthdays, baby showers, etc." }
          ],
          "flavours": ["Vanilla", "Chocolate", "Red Velvet", "Lemon Cake"],
          "available": true
        }
      ]
    },
    {
      "name": "Drinks",
      "items": [
        {
          "name": "Sobolo",
          "description": "Hibiscus drink, served chilled.",
          "price": 3,
          "available": true
        },
        {
          "name": "Brukina",
          "description": "Millet and milk drink.",
          "price": 3.5,
          "available": true
        }
      ]
    },
    {
      "name": "Sauces & Extras",
      "items": [
        {
          "name": "Shito (Hot Sauce)",
          "description": "Ghanaian spicy sauce. Big bottles available on request.",
          "price": 12,
          "available": true
        }
      ]
    }
  ]
}
```

---
### data/scrapper.js

```javascript
const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  const targetUrl = 'https://example.com'; // Replace with your target URL
  await page.goto(targetUrl, { waitUntil: 'networkidle2' });

  // Optional screenshot
  await page.screenshot({ path: 'screenshot.png', fullPage: true });

  // Extract all image URLs from the DOM
  const imageUrls = await page.evaluate(() => {
    const images = Array.from(document.querySelectorAll('img'));
    return images
      .map(img => img.src || img.getAttribute('data-src') || img.getAttribute('data-lazy-src'))
      .filter(Boolean);
  });

  console.log('Extracted Image URLs:', imageUrls);

  // Optional: Save to JSON
  fs.writeFileSync('images.json', JSON.stringify(imageUrls, null, 2));

  await browser.close();

  return imageUrls;
})();

```

---
### data/tmdb.md

Here’s a clean, well-structured Markdown file for your TMDB API endpoints, ready for copy-paste into Notion, GitHub, VS Code, or wherever you keep your dev notes.

# 🎬 TMDB API Endpoint Reference

**Base URL:**

https://api.themoviedb.org/3

**Image Base URL:**

https://image.tmdb.org/t/p/

**API Key Usage:**
Append `?api_key=YOUR_API_KEY` to each endpoint.

---

## 🔑 Authentication

- All endpoints require an API key via `?api_key=YOUR_API_KEY`.

---

## 🎬 Movies

### 🔥 Popular Movies

/movie/popular?api_key=…&language=en-US&page=1

### 🔍 Search Movies

/search/movie?query=QUERY&api_key=…&language=en-US&page=1&include_adult=false

### 🆕 Latest Movie

/movie/latest?api_key=…&language=en-US

### 📈 Trending Movies
- Daily:

/trending/movie/day?api_key=…

- Weekly:

/trending/movie/week?api_key=…

### 🔎 Discover Movies (Advanced Filters)

/discover/movie?api_key=…&with_genres=28&sort_by=popularity.desc

### 📝 Movie Details

/movie/{movie_id}?api_key=…&language=en-US

### 👥 Movie Credits (Cast & Crew)

/movie/{movie_id}/credits?api_key=…

### 🎞️ Similar Movies

/movie/{movie_id}/similar?api_key=…&language=en-US&page=1

### 📽️ Movie Videos (Trailers, Teasers)

/movie/{movie_id}/videos?api_key=…&language=en-US

### 🕒 Now Playing Movies

/movie/now_playing?api_key=…&language=en-US&page=1

### 📅 Upcoming Movies

/movie/upcoming?api_key=…&language=en-US&page=1

---

## 📺 TV Shows

### 🔥 Popular TV Shows

/tv/popular?api_key=…&language=en-US&page=1

### 🔍 Search TV Shows

/search/tv?query=QUERY&api_key=…&language=en-US&page=1

### 📈 Trending TV Shows
- Daily:

/trending/tv/day?api_key=…

- Weekly:

/trending/tv/week?api_key=…

### 📝 TV Show Details

/tv/{tv_id}?api_key=…&language=en-US

### 👥 TV Show Credits

/tv/{tv_id}/credits?api_key=…

### 📽️ TV Show Videos

/tv/{tv_id}/videos?api_key=…

---

## 👤 People (Cast & Crew)

### 🔍 Search People

/search/person?query=QUERY&api_key=…

### 🧑‍💼 Person Details

/person/{person_id}?api_key=…

### 🎬 Person's Movie Credits

/person/{person_id}/movie_credits?api_key=…

---

## 🧩 Meta / Utility

### 🎭 Movie Genres

/genre/movie/list?api_key=…&language=en-US

### 🎭 TV Genres

/genre/tv/list?api_key=…&language=en-US

### ⚙️ API Configuration (base URLs, image sizes)

/configuration?api_key=…

### 🔎 Multi-Search (movie, tv, person)

/search/multi?query=QUERY&api_key=…

---

## 🖼 Image URL Examples

- **Poster (500px):**

https://image.tmdb.org/t/p/w500/{poster_path}

- **Backdrop (1280px):**

https://image.tmdb.org/t/p/w1280/{backdrop_path}

---

> 🧠 Tip: Always check if the returned `poster_path` or `backdrop_path` is not null before rendering images.

Let me know if you want this split into .md files per category or compiled into a PDF/Notion import.

---
### data/vite.config.js

```javascript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 4000,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: 'src/__tests__/setup.js', // This points to your setup file
  },
});
```

---
### package-lock.json

```json
{
  "name": "notes",
  "version": "1.0.0",
  "lockfileVersion": 3,
  "requires": true,
  "packages": {
    "": {
      "name": "notes",
      "version": "1.0.0",
      "license": "ISC",
      "dependencies": {
        "cors": "^2.8.5",
        "express": "^5.1.0",
        "mongoose": "^8.16.1"
      }
    },
    "node_modules/@mongodb-js/saslprep": {
      "version": "1.3.0",
      "resolved": "https://registry.npmjs.org/@mongodb-js/saslprep/-/saslprep-1.3.0.tgz",
      "integrity": "sha512-<<REDACTED_SECRET>>==",
      "dependencies": {
        "sparse-bitfield": "^3.0.3"
      }
    },
    "node_modules/@types/webidl-conversions": {
      "version": "7.0.3",
      "resolved": "https://registry.npmjs.org/@types/webidl-conversions/-/webidl-conversions-7.0.3.tgz",
      "integrity": "sha512-<<REDACTED_SECRET>>=="
    },
    "node_modules/@types/whatwg-url": {
      "version": "11.0.5",
      "resolved": "https://registry.npmjs.org/@types/whatwg-url/-/whatwg-url-11.0.5.tgz",
      "integrity": "sha512-<<REDACTED_SECRET>>==",
      "dependencies": {
        "@types/webidl-conversions": "*"
      }
    },
    "node_modules/accepts": {
      "version": "2.0.0",
      "resolved": "https://registry.npmjs.org/accepts/-/accepts-2.0.0.tgz",
      "integrity": "sha512-<<REDACTED_SECRET>>==",
      "dependencies": {
        "mime-types": "^3.0.0",
        "negotiator": "^1.0.0"
      },
      "engines": {
        "node": ">= 0.6"
      }
    },
    "node_modules/body-parser": {
      "version": "2.2.0",
      "resolved": "https://registry.npmjs.org/body-parser/-/body-parser-2.2.0.tgz",
      "integrity": "sha512-<<REDACTED_SECRET>>==",
      "dependencies": {
        "bytes": "^3.1.2",
        "content-type": "^1.0.5",
        "debug": "^4.4.0",
        "http-errors": "^2.0.0",
        "iconv-lite": "^0.6.3",
        "on-finished": "^2.4.1",
        "qs": "^6.14.0",
        "raw-body": "^3.0.0",
        "type-is": "^2.0.0"
      },
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/bson": {
      "version": "6.10.4",
      "resolved": "https://registry.npmjs.org/bson/-/bson-6.10.4.tgz",
      "integrity": "sha512-<<REDACTED_SECRET>>==",
      "engines": {
        "node": ">=16.20.1"
      }
    },
    "node_modules/bytes": {
      "version": "3.1.2",
      "resolved": "https://registry.npmjs.org/bytes/-/bytes-3.1.2.tgz",
      "integrity": "sha512-/<<REDACTED_SECRET>>==",
      "engines": {
        "node": ">= 0.8"
      }
    },
    "node_modules/call-bind-apply-helpers": {
      "version": "1.0.2",
      "resolved": "https://registry.npmjs.org/call-bind-apply-helpers/-/call-bind-apply-helpers-1.0.2.tgz",
      "integrity": "sha512-<<REDACTED_SECRET>>==",
      "dependencies": {
        "es-errors": "^1.3.0",
        "function-bind": "^1.1.2"
      },
      "engines": {
        "node": ">= 0.4"
      }
    },
    "node_modules/call-bound": {
      "version": "1.0.4",
      "resolved": "https://registry.npmjs.org/call-bound/-/call-bound-1.0.4.tgz",
      "integrity": "sha512-+<<REDACTED_SECRET>>==",
      "dependencies": {
        "call-bind-apply-helpers": "^1.0.2",
        "get-intrinsic": "^1.3.0"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/content-disposition": {
      "version": "1.0.0",
      "resolved": "https://registry.npmjs.org/content-disposition/-/content-disposition-1.0.0.tgz",
      "integrity": "sha512-<<REDACTED_SECRET>>==",
      "dependencies": {
        "safe-buffer": "5.2.1"
      },
      "engines": {
        "node": ">= 0.6"
      }
    },
    "node_modules/content-type": {
      "version": "1.0.5",
      "resolved": "https://registry.npmjs.org/content-type/-/content-type-1.0.5.tgz",
      "integrity": "sha512-<<REDACTED_SECRET>>==",
      "engines": {
        "node": ">= 0.6"
      }
    },
    "node_modules/cookie": {
      "version": "0.7.2",
      "resolved": "https://registry.npmjs.org/cookie/-/cookie-0.7.2.tgz",
      "integrity": "sha512-<<REDACTED_SECRET>>==",
      "engines": {
        "node": ">= 0.6"
      }
    },
    "node_modules/cookie-signature": {
      "version": "1.2.2",
      "resolved": "https://registry.npmjs.org/cookie-signature/-/cookie-signature-1.2.2.tgz",
      "integrity": "sha512-<<REDACTED_SECRET>>==",
      "engines": {
        "node": ">=6.6.0"
      }
    },
    "node_modules/cors": {
      "version": "2.8.5",
      "resolved": "https://registry.npmjs.org/cors/-/cors-2.8.5.tgz",
      "integrity": "sha512-<<REDACTED_SECRET>>==",
      "dependencies": {
        "object-assign": "^4",
        "vary": "^1"
      },
      "engines": {
        "node": ">= 0.10"
      }
    },
    "node_modules/debug": {
      "version": "4.4.1",
      "resolved": "https://registry.npmjs.org/debug/-/debug-4.4.1.tgz",
      "integrity": "sha512-<<REDACTED_SECRET>>==",
      "dependencies": {
        "ms": "^2.1.3"
      },
      "engines": {
        "node": ">=6.0"
      },
      "peerDependenciesMeta": {
        "supports-color": {
          "optional": true
        }
      }
    },
    "node_modules/depd": {
      "version": "2.0.0",
      "resolved": "https://registry.npmjs.org/depd/-/depd-2.0.0.tgz",
      "integrity": "sha512-<<REDACTED_SECRET>>==",
      "engines": {
        "node": ">= 0.8"
      }
    },
    "node_modules/dunder-proto": {
      "version": "1.0.1",
      "resolved": "https://registry.npmjs.org/dunder-proto/-/dunder-proto-1.0.1.tgz",
      "integrity": "sha512-<<REDACTED_SECRET>>==",
      "dependencies": {
        "call-bind-apply-helpers": "^1.0.1",
        "es-errors": "^1.3.0",
        "gopd": "^1.2.0"
      },
      "engines": {
        "node": ">= 0.4"
      }
    },
    "node_modules/ee-first": {
      "version": "1.1.1",
      "resolved": "https://registry.npmjs.org/ee-first/-/ee-first-1.1.1.tgz",
      "integrity": "sha512-<<REDACTED_SECRET>>=="
    },
    "node_modules/encodeurl": {
      "version": "2.0.0",
      "resolved": "https://registry.npmjs.org/encodeurl/-/encodeurl-2.0.0.tgz",
      "integrity": "sha512-<<REDACTED_SECRET>>==",
      "engines": {
        "node": ">= 0.8"
      }
    },
    "node_modules/es-define-property": {
      "version": "1.0.1",
      "resolved": "https://registry.npmjs.org/es-define-property/-/es-define-property-1.0.1.tgz",
      "integrity": "sha512-<<REDACTED_SECRET>>==",
      "engines": {
        "node": ">= 0.4"
      }
    },
    "node_modules/es-errors": {
      "version": "1.3.0",
      "resolved": "https://registry.npmjs.org/es-errors/-/es-errors-1.3.0.tgz",
      "integrity": "sha512-<<REDACTED_SECRET>>==",
      "engines": {
        "node": ">= 0.4"
      }
    },
    "node_modules/es-object-atoms": {
      "version": "1.1.1",
      "resolved": "https://registry.npmjs.org/es-object-atoms/-/es-object-atoms-1.1.1.tgz",
      "integrity": "sha512-<<REDACTED_SECRET>>==",
      "dependencies": {
        "es-errors": "^1.3.0"
      },
      "engines": {
        "node": ">= 0.4"
      }
    },
    "node_modules/escape-html": {
      "version": "1.0.3",
      "resolved": "https://registry.npmjs.org/escape-html/-/escape-html-1.0.3.tgz",
      "integrity": "sha512-<<REDACTED_SECRET>>=="
    },
    "node_modules/etag": {
      "version": "1.8.1",
      "resolved": "https://registry.npmjs.org/etag/-/etag-1.8.1.tgz",
      "integrity": "sha512-<<REDACTED_SECRET>>==",
      "engines": {
        "node": ">= 0.6"
      }
    },
    "node_modules/express": {
      "version": "5.1.0",
      "resolved": "https://registry.npmjs.org/express/-/express-5.1.0.tgz",
      "integrity": "sha512-<<REDACTED_SECRET>>==",
      "dependencies": {
        "accepts": "^2.0.0",
        "body-parser": "^2.2.0",
        "content-disposition": "^1.0.0",
        "content-type": "^1.0.5",
        "cookie": "^0.7.1",
        "cookie-signature": "^1.2.1",
        "debug": "^4.4.0",
        "encodeurl": "^2.0.0",
        "escape-html": "^1.0.3",
        "etag": "^1.8.1",
        "finalhandler": "^2.1.0",
        "fresh": "^2.0.0",
        "http-errors": "^2.0.0",
        "merge-descriptors": "^2.0.0",
        "mime-types": "^3.0.0",
        "on-finished": "^2.4.1",
        "once": "^1.4.0",
        "parseurl": "^1.3.3",
        "proxy-addr": "^2.0.7",
        "qs": "^6.14.0",
        "range-parser": "^1.2.1",
        "router": "^2.2.0",
        "send": "^1.1.0",
        "serve-static": "^2.2.0",
        "statuses": "^2.0.1",
        "type-is": "^2.0.1",
        "vary": "^1.1.2"
      },
      "engines": {
        "node": ">= 18"
      },
      "funding": {
        "type": "opencollective",
        "url": "https://opencollective.com/express"
      }
    },
    "node_modules/finalhandler": {
      "version": "2.1.0",
      "resolved": "https://registry.npmjs.org/finalhandler/-/finalhandler-2.1.0.tgz",
      "integrity": "sha512-/<<REDACTED_SECRET>>==",
      "dependencies": {
        "debug": "^4.4.0",
        "encodeurl": "^2.0.0",
        "escape-html": "^1.0.3",
        "on-finished": "^2.4.1",
        "parseurl": "^1.3.3",
        "statuses": "^2.0.1"
      },
      "engines": {
        "node": ">= 0.8"
      }
    },
    "node_modules/forwarded": {
      "version": "0.2.0",
      "resolved": "https://registry.npmjs.org/forwarded/-/forwarded-0.2.0.tgz",
      "integrity": "sha512-<<REDACTED_SECRET>>==",
      "engines": {
        "node": ">= 0.6"
      }
    },
    "node_modules/fresh": {
      "version": "2.0.0",
      "resolved": "https://registry.npmjs.org/fresh/-/fresh-2.0.0.tgz",
      "integrity": "sha512-<<REDACTED_SECRET>>==",
      "engines": {
        "node": ">= 0.8"
      }
    },
    "node_modules/function-bind": {
      "version": "1.1.2",
      "resolved": "https://registry.npmjs.org/function-bind/-/function-bind-1.1.2.tgz",
      "integrity": "sha512-<<REDACTED_SECRET>>==",
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/get-intrinsic": {
      "version": "1.3.0",
      "resolved": "https://registry.npmjs.org/get-intrinsic/-/get-intrinsic-1.3.0.tgz",
      "integrity": "sha512-<<REDACTED_SECRET>>==",
      "dependencies": {
        "call-bind-apply-helpers": "^1.0.2",
        "es-define-property": "^1.0.1",
        "es-errors": "^1.3.0",
        "es-object-atoms": "^1.1.1",
        "function-bind": "^1.1.2",
        "get-proto": "^1.0.1",
        "gopd": "^1.2.0",
        "has-symbols": "^1.1.0",
        "hasown": "^2.0.2",
        "math-intrinsics": "^1.1.0"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/get-proto": {
      "version": "1.0.1",
      "resolved": "https://registry.npmjs.org/get-proto/-/get-proto-1.0.1.tgz",
      "integrity": "sha512-<<REDACTED_SECRET>>==",
      "dependencies": {
        "dunder-proto": "^1.0.1",
        "es-object-atoms": "^1.0.0"
      },
      "engines": {
        "node": ">= 0.4"
      }
    },
    "node_modules/gopd": {
      "version": "1.2.0",
      "resolved": "https://registry.npmjs.org/gopd/-/gopd-1.2.0.tgz",
      "integrity": "sha512-<<REDACTED_SECRET>>==",
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/has-symbols": {
      "version": "1.1.0",
      "resolved": "https://registry.npmjs.org/has-symbols/-/has-symbols-1.1.0.tgz",
      "integrity": "sha512-<<REDACTED_SECRET>>==",
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/hasown": {
      "version": "2.0.2",
      "resolved": "https://registry.npmjs.org/hasown/-/hasown-2.0.2.tgz",
      "integrity": "sha512-<<REDACTED_SECRET>>==",
      "dependencies": {
        "function-bind": "^1.1.2"
      },
      "engines": {
        "node": ">= 0.4"
      }
    },
    "node_modules/http-errors": {
      "version": "2.0.0",
      "resolved": "https://registry.npmjs.org/http-errors/-/http-errors-2.0.0.tgz",
      "integrity": "sha512-<<REDACTED_SECRET>>==",
      "dependencies": {
        "depd": "2.0.0",
        "inherits": "2.0.4",
        "setprototypeof": "1.2.0",
        "statuses": "2.0.1",
        "toidentifier": "1.0.1"
      },
      "engines": {
        "node": ">= 0.8"
      }
    },
    "node_modules/http-errors/node_modules/statuses": {
      "version": "2.0.1",
      "resolved": "https://registry.npmjs.org/statuses/-/statuses-2.0.1.tgz",
      "integrity": "sha512-<<REDACTED_SECRET>>==",
      "engines": {
        "node": ">= 0.8"
      }
    },
    "node_modules/iconv-lite": {
      "version": "0.6.3",
      "resolved": "https://registry.npmjs.org/iconv-lite/-/iconv-lite-0.6.3.tgz",
      "integrity": "sha512-<<REDACTED_SECRET>>==",
      "dependencies": {
        "safer-buffer": ">= 2.1.2 < 3.0.0"
      },
      "engines": {
        "node": ">=0.10.0"
      }
    },
    "node_modules/inherits": {
      "version": "2.0.4",
      "resolved": "https://registry.npmjs.org/inherits/-/inherits-2.0.4.tgz",
      "integrity": "sha512-<<REDACTED_SECRET>>=="
    },
    "node_modules/ipaddr.js": {
      "version": "1.9.1",
      "resolved": "https://registry.npmjs.org/ipaddr.js/-/ipaddr.js-1.9.1.tgz",
      "integrity": "sha512-<<REDACTED_SECRET>>==",
      "engines": {
        "node": ">= 0.10"
      }
    },
    "node_modules/is-promise": {
      "version": "4.0.0",
      "resolved": "https://registry.npmjs.org/is-promise/-/is-promise-4.0.0.tgz",
      "integrity": "sha512-<<REDACTED_SECRET>>=="
    },
    "node_modules/kareem": {
      "version": "2.6.3",
      "resolved": "https://registry.npmjs.org/kareem/-/kareem-2.6.3.tgz",
      "integrity": "sha512-<<REDACTED_SECRET>>==",
      "engines": {
        "node": ">=12.0.0"
      }
    },
    "node_modules/math-intrinsics": {
      "version": "1.1.0",
      "resolved": "https://registry.npmjs.org/math-intrinsics/-/math-intrinsics-1.1.0.tgz",
      "integrity": "sha512-/<<REDACTED_SECRET>>==",
      "engines": {
        "node": ">= 0.4"
      }
    },
    "node_modules/media-typer": {
      "version": "1.1.0",
      "resolved": "https://registry.npmjs.org/media-typer/-/media-typer-1.1.0.tgz",
      "integrity": "sha512-<<REDACTED_SECRET>>==",
      "engines": {
        "node": ">= 0.8"
      }
    },
    "node_modules/memory-pager": {
      "version": "1.5.0",
      "resolved": "https://registry.npmjs.org/memory-pager/-/memory-pager-1.5.0.tgz",
      "integrity": "sha512-<<REDACTED_SECRET>>=="
    },
    "node_modules/merge-descriptors": {
      "version": "2.0.0",
      "resolved": "https://registry.npmjs.org/merge-descriptors/-/merge-descriptors-2.0.0.tgz",
      "integrity": "sha512-<<REDACTED_SECRET>>==",
      "engines": {
        "node": ">=18"
      },
      "funding": {
        "url": "https://github.com/sponsors/sindresorhus"
      }
    },
    "node_modules/mime-db": {
      "version": "1.54.0",
      "resolved": "https://registry.npmjs.org/mime-db/-/mime-db-1.54.0.tgz",
      "integrity": "sha512-<<REDACTED_SECRET>>==",
      "engines": {
        "node": ">= 0.6"
      }
    },
    "node_modules/mime-types": {
      "version": "3.0.1",
      "resolved": "https://registry.npmjs.org/mime-types/-/mime-types-3.0.1.tgz",
      "integrity": "sha512-<<REDACTED_SECRET>>==",
      "dependencies": {
        "mime-db": "^1.54.0"
      },
      "engines": {
        "node": ">= 0.6"
      }
    },
    "node_modules/mongodb": {
      "version": "6.17.0",
      "resolved": "https://registry.npmjs.org/mongodb/-/mongodb-6.17.0.tgz",
      "integrity": "sha512-<<REDACTED_SECRET>>==",
      "dependencies": {
        "@mongodb-js/saslprep": "^1.1.9",
        "bson": "^6.10.4",
        "mongodb-connection-string-url": "^3.0.0"
      },
      "engines": {
        "node": ">=16.20.1"
      },
      "peerDependencies": {
        "@aws-sdk/credential-providers": "^3.188.0",
        "@mongodb-js/zstd": "^1.1.0 || ^2.0.0",
        "gcp-metadata": "^5.2.0",
        "kerberos": "^2.0.1",
        "mongodb-client-encryption": ">=6.0.0 <7",
        "snappy": "^7.2.2",
        "socks": "^2.7.1"
      },
      "peerDependenciesMeta": {
        "@aws-sdk/credential-providers": {
          "optional": true
        },
        "@mongodb-js/zstd": {
          "optional": true
        },
        "gcp-metadata": {
          "optional": true
        },
        "kerberos": {
          "optional": true
        },
        "mongodb-client-encryption": {
          "optional": true
        },
        "snappy": {
          "optional": true
        },
        "socks": {
          "optional": true
        }
      }
    },
    "node_modules/mongodb-connection-string-url": {
      "version": "3.0.2",
      "resolved": "https://registry.npmjs.org/mongodb-connection-string-url/-/mongodb-connection-string-url-3.0.2.tgz",
      "integrity": "sha512-<<REDACTED_SECRET>>==",
      "dependencies": {
        "@types/whatwg-url": "^11.0.2",
        "whatwg-url": "^14.1.0 || ^13.0.0"
      }
    },
    "node_modules/mongoose": {
      "version": "8.16.1",
      "resolved": "https://registry.npmjs.org/mongoose/-/mongoose-8.16.1.tgz",
      "integrity": "sha512-<<REDACTED_SECRET>>==",
      "dependencies": {
        "bson": "^6.10.4",
        "kareem": "2.6.3",
        "mongodb": "~6.17.0",
        "mpath": "0.9.0",
        "mquery": "5.0.0",
        "ms": "2.1.3",
        "sift": "17.1.3"
      },
      "engines": {
        "node": ">=16.20.1"
      },
      "funding": {
        "type": "opencollective",
        "url": "https://opencollective.com/mongoose"
      }
    },
    "node_modules/mpath": {
      "version": "0.9.0",
      "resolved": "https://registry.npmjs.org/mpath/-/mpath-0.9.0.tgz",
      "integrity": "sha512-<<REDACTED_SECRET>>==",
      "engines": {
        "node": ">=4.0.0"
      }
    },
    "node_modules/mquery": {
      "version": "5.0.0",
      "resolved": "https://registry.npmjs.org/mquery/-/mquery-5.0.0.tgz",
      "integrity": "sha512-<<REDACTED_SECRET>>==",
      "dependencies": {
        "debug": "4.x"
      },
      "engines": {
        "node": ">=14.0.0"
      }
    },
    "node_modules/ms": {
      "version": "2.1.3",
      "resolved": "https://registry.npmjs.org/ms/-/ms-2.1.3.tgz",
      "integrity": "sha512-<<REDACTED_SECRET>>=="
    },
    "node_modules/negotiator": {
      "version": "1.0.0",
      "resolved": "https://registry.npmjs.org/negotiator/-/negotiator-1.0.0.tgz",
      "integrity": "sha512-<<REDACTED_SECRET>>==",
      "engines": {
        "node": ">= 0.6"
      }
    },
    "node_modules/object-assign": {
      "version": "4.1.1",
      "resolved": "https://registry.npmjs.org/object-assign/-/object-assign-4.1.1.tgz",
      "integrity": "sha512-<<REDACTED_SECRET>>==",
      "engines": {
        "node": ">=0.10.0"
      }
    },
    "node_modules/object-inspect": {
      "version": "1.13.4",
      "resolved": "https://registry.npmjs.org/object-inspect/-/object-inspect-1.13.4.tgz",
      "integrity": "sha512-<<REDACTED_SECRET>>==",
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/on-finished": {
      "version": "2.4.1",
      "resolved": "https://registry.npmjs.org/on-finished/-/on-finished-2.4.1.tgz",
      "integrity": "sha512-<<REDACTED_SECRET>>==",
      "dependencies": {
        "ee-first": "1.1.1"
      },
      "engines": {
        "node": ">= 0.8"
      }
    },
    "node_modules/once": {
      "version": "1.4.0",
      "resolved": "https://registry.npmjs.org/once/-/once-1.4.0.tgz",
      "integrity": "sha512-<<REDACTED_SECRET>>==",
      "dependencies": {
        "wrappy": "1"
      }
    },
    "node_modules/parseurl": {
      "version": "1.3.3",
      "resolved": "https://registry.npmjs.org/parseurl/-/parseurl-1.3.3.tgz",
      "integrity": "sha512-<<REDACTED_SECRET>>==",
      "engines": {
        "node": ">= 0.8"
      }
    },
    "node_modules/path-to-regexp": {
      "version": "8.2.0",
      "resolved": "https://registry.npmjs.org/path-to-regexp/-/path-to-regexp-8.2.0.tgz",
      "integrity": "sha512-<<REDACTED_SECRET>>==",
      "engines": {
        "node": ">=16"
      }
    },
    "node_modules/proxy-addr": {
      "version": "2.0.7",
      "resolved": "https://registry.npmjs.org/proxy-addr/-/proxy-addr-2.0.7.tgz",
      "integrity": "sha512-<<REDACTED_SECRET>>==",
      "dependencies": {
        "forwarded": "0.2.0",
        "ipaddr.js": "1.9.1"
      },
      "engines": {
        "node": ">= 0.10"
      }
    },
    "node_modules/punycode": {
      "version": "2.3.1",
      "resolved": "https://registry.npmjs.org/punycode/-/punycode-2.3.1.tgz",
      "integrity": "sha512-<<REDACTED_SECRET>>==",
      "engines": {
        "node": ">=6"
      }
    },
    "node_modules/qs": {
      "version": "6.14.0",
      "resolved": "https://registry.npmjs.org/qs/-/qs-6.14.0.tgz",
      "integrity": "sha512-<<REDACTED_SECRET>>==",
      "dependencies": {
        "side-channel": "^1.1.0"
      },
      "engines": {
        "node": ">=0.6"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/range-parser": {
      "version": "1.2.1",
      "resolved": "https://registry.npmjs.org/range-parser/-/range-parser-1.2.1.tgz",
      "integrity": "sha512-<<REDACTED_SECRET>>==",
      "engines": {
        "node": ">= 0.6"
      }
    },
    "node_modules/raw-body": {
      "version": "3.0.0",
      "resolved": "https://registry.npmjs.org/raw-body/-/raw-body-3.0.0.tgz",
      "integrity": "sha512-<<REDACTED_SECRET>>==",
      "dependencies": {
        "bytes": "3.1.2",
        "http-errors": "2.0.0",
        "iconv-lite": "0.6.3",
        "unpipe": "1.0.0"
      },
      "engines": {
        "node": ">= 0.8"
      }
    },
    "node_modules/router": {
      "version": "2.2.0",
      "resolved": "https://registry.npmjs.org/router/-/router-2.2.0.tgz",
      "integrity": "sha512-<<REDACTED_SECRET>>==",
      "dependencies": {
        "debug": "^4.4.0",
        "depd": "^2.0.0",
        "is-promise": "^4.0.0",
        "parseurl": "^1.3.3",
        "path-to-regexp": "^8.0.0"
      },
      "engines": {
        "node": ">= 18"
      }
    },
    "node_modules/safe-buffer": {
      "version": "5.2.1",
      "resolved": "https://registry.npmjs.org/safe-buffer/-/safe-buffer-5.2.1.tgz",
      "integrity": "sha512-<<REDACTED_SECRET>>==",
      "funding": [
        {
          "type": "github",
          "url": "https://github.com/sponsors/feross"
        },
        {
          "type": "patreon",
          "url": "https://www.patreon.com/feross"
        },
        {
          "type": "consulting",
          "url": "https://feross.org/support"
        }
      ]
    },
    "node_modules/safer-buffer": {
      "version": "2.1.2",
      "resolved": "https://registry.npmjs.org/safer-buffer/-/safer-buffer-2.1.2.tgz",
      "integrity": "sha512-<<REDACTED_SECRET>>=="
    },
    "node_modules/send": {
      "version": "1.2.0",
      "resolved": "https://registry.npmjs.org/send/-/send-1.2.0.tgz",
      "integrity": "sha512-<<REDACTED_SECRET>>==",
      "dependencies": {
        "debug": "^4.3.5",
        "encodeurl": "^2.0.0",
        "escape-html": "^1.0.3",
        "etag": "^1.8.1",
        "fresh": "^2.0.0",
        "http-errors": "^2.0.0",
        "mime-types": "^3.0.1",
        "ms": "^2.1.3",
        "on-finished": "^2.4.1",
        "range-parser": "^1.2.1",
        "statuses": "^2.0.1"
      },
      "engines": {
        "node": ">= 18"
      }
    },
    "node_modules/serve-static": {
      "version": "2.2.0",
      "resolved": "https://registry.npmjs.org/serve-static/-/serve-static-2.2.0.tgz",
      "integrity": "sha512-<<REDACTED_SECRET>>==",
      "dependencies": {
        "encodeurl": "^2.0.0",
        "escape-html": "^1.0.3",
        "parseurl": "^1.3.3",
        "send": "^1.2.0"
      },
      "engines": {
        "node": ">= 18"
      }
    },
    "node_modules/setprototypeof": {
      "version": "1.2.0",
      "resolved": "https://registry.npmjs.org/setprototypeof/-/setprototypeof-1.2.0.tgz",
      "integrity": "sha512-<<REDACTED_SECRET>>=="
    },
    "node_modules/side-channel": {
      "version": "1.1.0",
      "resolved": "https://registry.npmjs.org/side-channel/-/side-channel-1.1.0.tgz",
      "integrity": "sha512-<<REDACTED_SECRET>>==",
      "dependencies": {
        "es-errors": "^1.3.0",
        "object-inspect": "^1.13.3",
        "side-channel-list": "^1.0.0",
        "side-channel-map": "^1.0.1",
        "side-channel-weakmap": "^1.0.2"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/side-channel-list": {
      "version": "1.0.0",
      "resolved": "https://registry.npmjs.org/side-channel-list/-/side-channel-list-1.0.0.tgz",
      "integrity": "sha512-<<REDACTED_SECRET>>==",
      "dependencies": {
        "es-errors": "^1.3.0",
        "object-inspect": "^1.13.3"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/side-channel-map": {
      "version": "1.0.1",
      "resolved": "https://registry.npmjs.org/side-channel-map/-/side-channel-map-1.0.1.tgz",
      "integrity": "sha512-<<REDACTED_SECRET>>==",
      "dependencies": {
        "call-bound": "^1.0.2",
        "es-errors": "^1.3.0",
        "get-intrinsic": "^1.2.5",
        "object-inspect": "^1.13.3"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/side-channel-weakmap": {
      "version": "1.0.2",
      "resolved": "https://registry.npmjs.org/side-channel-weakmap/-/side-channel-weakmap-1.0.2.tgz",
      "integrity": "sha512-<<REDACTED_SECRET>>==",
      "dependencies": {
        "call-bound": "^1.0.2",
        "es-errors": "^1.3.0",
        "get-intrinsic": "^1.2.5",
        "object-inspect": "^1.13.3",
        "side-channel-map": "^1.0.1"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/sift": {
      "version": "17.1.3",
      "resolved": "https://registry.npmjs.org/sift/-/sift-17.1.3.tgz",
      "integrity": "sha512-<<REDACTED_SECRET>>=="
    },
    "node_modules/sparse-bitfield": {
      "version": "3.0.3",
      "resolved": "https://registry.npmjs.org/sparse-bitfield/-/sparse-bitfield-3.0.3.tgz",
      "integrity": "sha512-<<REDACTED_SECRET>>==",
      "dependencies": {
        "memory-pager": "^1.0.2"
      }
    },
    "node_modules/statuses": {
      "version": "2.0.2",
      "resolved": "https://registry.npmjs.org/statuses/-/statuses-2.0.2.tgz",
      "integrity": "sha512-<<REDACTED_SECRET>>==",
      "engines": {
        "node": ">= 0.8"
      }
    },
    "node_modules/toidentifier": {
      "version": "1.0.1",
      "resolved": "https://registry.npmjs.org/toidentifier/-/toidentifier-1.0.1.tgz",
      "integrity": "sha512-<<REDACTED_SECRET>>==",
      "engines": {
        "node": ">=0.6"
      }
    },
    "node_modules/tr46": {
      "version": "5.1.1",
      "resolved": "https://registry.npmjs.org/tr46/-/tr46-5.1.1.tgz",
      "integrity": "sha512-<<REDACTED_SECRET>>==",
      "dependencies": {
        "punycode": "^2.3.1"
      },
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/type-is": {
      "version": "2.0.1",
      "resolved": "https://registry.npmjs.org/type-is/-/type-is-2.0.1.tgz",
      "integrity": "sha512-<<REDACTED_SECRET>>==",
      "dependencies": {
        "content-type": "^1.0.5",
        "media-typer": "^1.1.0",
        "mime-types": "^3.0.0"
      },
      "engines": {
        "node": ">= 0.6"
      }
    },
    "node_modules/unpipe": {
      "version": "1.0.0",
      "resolved": "https://registry.npmjs.org/unpipe/-/unpipe-1.0.0.tgz",
      "integrity": "sha512-<<REDACTED_SECRET>>==",
      "engines": {
        "node": ">= 0.8"
      }
    },
    "node_modules/vary": {
      "version": "1.1.2",
      "resolved": "https://registry.npmjs.org/vary/-/vary-1.1.2.tgz",
      "integrity": "sha512-<<REDACTED_SECRET>>==",
      "engines": {
        "node": ">= 0.8"
      }
    },
    "node_modules/webidl-conversions": {
      "version": "7.0.0",
      "resolved": "https://registry.npmjs.org/webidl-conversions/-/webidl-conversions-7.0.0.tgz",
      "integrity": "sha512-<<REDACTED_SECRET>>==",
      "engines": {
        "node": ">=12"
      }
    },
    "node_modules/whatwg-url": {
      "version": "14.2.0",
      "resolved": "https://registry.npmjs.org/whatwg-url/-/whatwg-url-14.2.0.tgz",
      "integrity": "sha512-<<REDACTED_SECRET>>==",
      "dependencies": {
        "tr46": "^5.1.0",
        "webidl-conversions": "^7.0.0"
      },
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/wrappy": {
      "version": "1.0.2",
      "resolved": "https://registry.npmjs.org/wrappy/-/wrappy-1.0.2.tgz",
      "integrity": "sha512-<<REDACTED_SECRET>>=="
    }
  }
}

```

---
### package.json

```json
{
  "name": "notes",
  "version": "1.0.0",
  "description": "",
  "main": "index.js",
  "scripts": {
    "test": "echo \"Error: no test specified\" && exit 1",
    "server": "nodemon --env-file=.env server/server.js",
    "start": "node server/server.js"
  },
  "keywords": [],
  "author": "",
  "license": "ISC",
  "dependencies": {
    "cors": "^2.8.5",
    "express": "^5.1.0",
    "mongoose": "^8.16.1"
  }
}

```

---
### server/app.js

```javascript
const express = require("express");

const app = express();

app.get("/", (req, res) => {
  return res.json({ message: "send file" });
});

module.exports = app;

```

---
### server/server.js

```javascript
const app = require("./app");
const port = process.env.PORT || 5000;

app.listen(port, () => {
  console.log("server started on port:", port);
});

```
