import { AxiosProxyConfig as Proxy } from "axios";
import fs from "fs";
import path from "path";

export class ProxyCycle {
  private index: number;
  constructor(private proxies: Proxy[]) {
    this.index = 0;
  }

  private ensureIndex(): void {
    if (this.index >= this.proxies.length) {
      this.index = 0;
    }
  }

  public next(): Proxy | undefined {
    this.index++;
    this.ensureIndex();
    return this.proxies.length ? this.proxies[this.index] : undefined;
  }

  public remove(proxy: Proxy): void {
    this.proxies = this.proxies.filter((item) => item != proxy);
  }

  public length(): number {
    return this.proxies.length;
  }

  public add(proxy: Proxy): void {
    !this.proxies.includes(proxy) || this.proxies.push(proxy);
  }

  public addList(proxies: Proxy[]): void {
    proxies.forEach((proxy) => {
      this.add(proxy);
    });
  }
}

export const getProxiesFromPath = (
  protocol: "http" | "https",
  pathToProxies: string
): Proxy[] => {
  const proxies = [];

  const proxiesRaw = fs.readFileSync(pathToProxies, "utf8");

  const proxieLines = proxiesRaw.split("\n");

  for (const line of proxieLines) {
    const parts = line.split(":");
    if (parts.length !== 4) continue;
    const proxy = {
      protocol,
      auth: {
        username: parts[2].trim(),
        password: parts[3].trim(),
      },
      host: parts[0].trim(),
      port: parseInt(parts[1].trim()),
    };
    proxies.push(proxy);
  }

  return proxies;
};

export default {
  checkout: new ProxyCycle(
    getProxiesFromPath(
      "http",
      path.join(__dirname, "..", "..", "data", "checkoutProxies.txt")
    )
  ),
  etc: new ProxyCycle(
    getProxiesFromPath(
      "http",
      path.join(__dirname, "..", "..", "data", "loginProxies.txt")
    )
  ),
};
