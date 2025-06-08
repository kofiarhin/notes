
# 🚀 Developer Productivity & Creativity Toolkit

A quick-access Markdown cheat sheet to streamline creative development with Groq/OpenAI APIs, TMDB integration, styling assets, lazy loading, fonts, and more.

---

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
  `https://image.tmdb.org/t/p/w1280/qGA31gx01iIJMgk2MyVgurhCGeO.jpg`

```html
<img src="https://image.tmdb.org/t/p/w1280/qGA31gx01iIJMgk2MyVgurhCGeO.jpg" />
```

---

## 🌤️ OpenWeather Sample API

```txt
http://api.openweathermap.org/data/2.5/weather?lat=42.2358&lon=-96.4725&appid=YOUR_API_KEY
```

---

## 📁 CPanel Access Link

```txt
https://server345.web-hosting.com:2083/cpsess5822070867/frontend/jupiter/filemanager/index.html?dir=%2fhome%2fdevkbtwj%2fpublic_html
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
JWT_SECRET=your_jwt_secret

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
