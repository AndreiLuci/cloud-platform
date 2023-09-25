import { AxiosProxyConfig } from "axios";
import chalk from "chalk";

export const shuffleArray = <T extends Array<any>>(array: T): T => {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * i);
    const temp = array[i];
    array[i] = array[j];
    array[j] = temp;
  }
  return array;
};

export const randomRange = (min: number, max: number): number => {
  return ~~(Math.random() * (max - min + 1)) + min;
};

export const codeBlock = (language: string, data: string): string =>
  "```" + language + "\n" + data + "```";

export const proxyToString = (proxy: AxiosProxyConfig): string =>
  proxy.protocol +
  "://" +
  (proxy.auth ? proxy.auth.username + ":" + proxy.auth.password + "@" : "") +
  proxy.host +
  ":" +
  proxy.port.toString();

export const sleep = (ms: number): Promise<void> =>
  new Promise((res) => setTimeout(res, ms));

export const logger = {
  log: (color: typeof chalk.ForegroundColor, message: string, ...etc: any[]) =>
    console.log(
      chalk[color](
        `[${new Date().toLocaleString()}] ${etc
          .map((str) => `[${str}]`)
          .join(" ")}${etc.length > 0 ? " " : ""}| ${message}`
      )
    ),
  yellow: (message: string, ...etc: any[]) =>
    logger.log("yellow", message, ...etc),
  red: (message: string, ...etc: any[]) => logger.log("red", message, ...etc),
  green: (message: string, ...etc: any[]) =>
    logger.log("green", message, ...etc),
};
