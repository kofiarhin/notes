const express = require("express");

const app = express();

app.get("/", (req, res) => {
  return res.json({ message: "send file" });
});

module.exports = app;
