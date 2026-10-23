import { createApp } from "./app.js";
import { createDatabase } from "./database.js";

const db = createDatabase();
const app = createApp(db);
const port = Number(process.env.PORT ?? 3001);

app.listen(port, () => {
  console.log(`Lead pipeline API listening on http://localhost:${port}`);
});
