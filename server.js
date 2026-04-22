const express = require("express");
const path = require("path");

const app = express();
const rootDir = __dirname;
const port = process.env.PORT || 3000;

app.disable("x-powered-by");
app.use(express.static(rootDir, { extensions: ["html"] }));

app.get("/", (_request, response) => {
  response.sendFile(path.join(rootDir, "index.html"));
});

app.get("/portal", (_request, response) => {
  response.sendFile(path.join(rootDir, "portal.html"));
});

app.listen(port, () => {
  console.log(`Maylin Mattress app listening on port ${port}`);
});
