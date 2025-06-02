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