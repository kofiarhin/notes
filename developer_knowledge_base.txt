
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
- [Primary](https://server345.web-hosting.com:2083/cpsess4200318636/frontend/jupiter/filemanager/index.html)
- [Namespace Link](https://server345.web-hosting.com:2083/cpsess5822070867/frontend/jupiter/filemanager/index.html?dir=%2fhome%2fdevkbtwj%2fpublic_html)

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
- **API Key**: `ca357c71903c409f2ce08d61e75700a6`

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
- **API Key**: `9416fd85aeaf46aae2638dbf0f766109`
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
