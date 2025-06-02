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