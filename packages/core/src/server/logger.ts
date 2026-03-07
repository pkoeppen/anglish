import process from "node:process";
import { createLogger, format, transports } from "winston";

const logFormat = format.printf((info) => {
  return `${info.timestamp}-${info.level}: ${info.message}`;
});

const logger = createLogger({
  transports: [
    new transports.Console({
      level: process.env.LOG_LEVEL || (process.env.NODE_ENV === "development" ? "debug" : "info"),
      format: format.combine(format.timestamp(), format.colorize(), logFormat),
    }),
  ],
});

export default logger;
