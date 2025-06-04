# 🎬 LinearMovieList Component (React + SCSS)

## ✅ Purpose
Create a horizontally scrollable, fully responsive movie list (like Netflix UI) using React and SCSS.

---

## 🧱 Component Structure

**Component Name:** `LinearMovieList`

**Files:**
- `LinearMovieList.jsx` — Main list component
- `LinearMovieList.styles.scss` — Responsive styles for layout
- `MovieCard.jsx` — Reusable movie card component
- `MovieCard.styles.scss` — Styling for each card

---

## 📦 Key Features

- 🔁 **Horizontal scroll** with snap alignment
- 📱 **Responsive layout** using media queries
- 🧼 **Hidden scrollbars** for a clean visual experience
- 🔧 **Reusable** and **data-driven** via props

---

## 🧩 Example Usage

```jsx
<LinearMovieList title="New Releases" movies={movieArray} />