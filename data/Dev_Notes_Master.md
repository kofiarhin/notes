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

> API Key: `ca357c71903c409f2ce08d61e75700a6`

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
http://api.openweathermap.org/data/2.5/weather?lat=...&lon=...&appid=9416fd85aeaf46aae2638dbf0f766109
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
