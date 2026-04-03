import { app } from "./app";
import { config } from "./config";
import { disconnectDb } from "./services/storage";
import { startDeltaStream } from "./services/stream";

const server = app.listen(config.port, () => {
  if (!config.isServerless) {
    startDeltaStream();
  }
  console.log(`Crypto Trading Journal API listening on http://localhost:${config.port}`);
});

async function shutdown() {
  server.close(async () => {
    await disconnectDb();
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
