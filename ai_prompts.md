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
JWT_SECRET=your_jwt_secret_here

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