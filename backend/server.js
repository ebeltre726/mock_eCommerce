import app from "./src/app.js";
import express from "express";

const PORT = process.env.PORT || 3000;

app.use(express.static('public'));

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});;