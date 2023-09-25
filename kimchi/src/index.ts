import Kimchi from "./structures/kimchi";
import { logger } from "./utils/etc";

if (typeof process.env.HYPER_API_KEY !== "string") {
  throw new Error("No HYPER_API_KEY found in process envoirment");
} else if (typeof process.env.METRICS_SECRET !== "string") {
  throw new Error("No METRICS_SECRET found in process envoirment");
} else if (typeof process.env.MASTER_API_KEY !== "string") {
  throw new Error("No MASTER_API_KEY found in process envoirment");
}

logger.green(
  "Starting with version " +
    process.env.npm_package_version +
    " in " +
    process.env.NODE_ENV +
    " envoirment"
);

const app = new Kimchi(8844);

app.start(() => {
  logger.green("Started kimchi on port " + app.port);
});
