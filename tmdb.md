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