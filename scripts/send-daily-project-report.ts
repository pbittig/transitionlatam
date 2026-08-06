import dotenv from "dotenv";
import { sendDailyProjectUpdatesReport } from "../lib/reports/dailyProjectUpdates";

dotenv.config({ path: ".env.local" });

const since = new Date();
since.setDate(since.getDate() - 1);
since.setHours(0, 0, 0, 0);

sendDailyProjectUpdatesReport(since)
  .then((summary) => console.log(JSON.stringify(summary, null, 2)))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
