import "dotenv/config";
import { createApp } from "./app.js";
import { pool } from "./db.js";
import { createAuthenticate } from "./middleware/authenticate.js";

const jwtSecret = process.env.JWT_SECRET;
const authenticate = createAuthenticate({ secret: jwtSecret, pool });
const app = createApp({ pool, authenticate, jwtSecret });
const port = Number(process.env.PORT || 3000);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be an integer between 1 and 65535.");
}

const server = app.listen(port, () => {
  console.log(`Lead reassignment API listening on port ${port}`);
});

function shutdown(signal) {
  console.log(`${signal} received; closing server.`);
  server.close(async (error) => {
    await pool.end();
    if (error) {
      console.error("Error while closing server:", error);
      process.exitCode = 1;
    }
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
