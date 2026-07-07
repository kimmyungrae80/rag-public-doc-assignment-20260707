import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { answerQuestion } from "../src/rag.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const host = process.env.HOST ?? "127.0.0.1";
const port = Number.parseInt(process.env.PORT ?? "3000", 10);

const server = http.createServer(async (request, response) => {
  try {
    if (request.method === "GET" && request.url === "/") {
      const html = await fs.readFile(path.join(root, "public", "index.html"), "utf8");
      send(response, 200, html, "text/html; charset=utf-8");
      return;
    }

    if (request.method === "POST" && request.url === "/api/ask") {
      const body = await readJson(request);
      const result = await answerQuestion(body.question ?? "", {
        mode: body.mode === "naive" ? "naive" : "advanced",
        local: Boolean(body.local),
        offline: Boolean(body.offline)
      });
      send(response, 200, JSON.stringify(result), "application/json; charset=utf-8");
      return;
    }

    send(response, 404, "Not found", "text/plain; charset=utf-8");
  } catch (error) {
    send(response, 500, JSON.stringify({ error: error.message }), "application/json; charset=utf-8");
  }
});

server.listen(port, host, () => {
  console.log(`RAG assignment server: http://${host}:${port}`);
});

function send(response, statusCode, body, contentType) {
  response.writeHead(statusCode, {
    "Content-Type": contentType,
    "Cache-Control": "no-store"
  });
  response.end(body);
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let raw = "";
    request.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) {
        request.destroy();
        reject(new Error("Request body too large"));
      }
    });
    request.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(error);
      }
    });
    request.on("error", reject);
  });
}
