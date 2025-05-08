import ngrok from "ngrok";
import { config } from "dotenv";
import winston from "winston";

config();

const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple(),
    }),
  ],
});

async function startNgrok() {
  try {
    const url = await ngrok.connect({
      addr: process.env.PORT || 8080,
      authtoken: process.env.NGROK_AUTH_TOKEN,
      region: "us", // or 'eu', 'ap', 'au', 'sa', 'jp', 'in'
      proto: "http",
      onStatusChange: (status) => {
        logger.info(`Ngrok status: ${status}`);
      },
      onLogEvent: (data) => {
        logger.info(`Ngrok log: ${data}`);
      },
    });

    logger.info(`Ngrok tunnel is running at: ${url}`);
    logger.info(`Swagger documentation is available at: ${url}/api-docs`);

    // Save the URL to a file for the server to read
    const fs = require("fs");
    fs.writeFileSync("ngrok-url.txt", url);

    // Handle process termination
    process.on("SIGINT", async () => {
      logger.info("Shutting down ngrok tunnel...");
      await ngrok.kill();
      process.exit(0);
    });
  } catch (error) {
    logger.error("Failed to start ngrok tunnel:", error);
    process.exit(1);
  }
}

startNgrok();
