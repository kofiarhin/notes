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