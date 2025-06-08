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