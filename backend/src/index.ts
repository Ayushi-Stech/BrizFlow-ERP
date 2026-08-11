import { createApp } from "./app";
import { env } from "./env";

const app = createApp();

app.listen(env.port, () => {
  console.log(`BizFlow ERP API listening on http://localhost:${env.port} (${env.nodeEnv})`);
});
