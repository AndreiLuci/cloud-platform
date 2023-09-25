import { MarketplaceId } from "./amazon";

export class HostCycle {
  private index: number;
  private hosts: string[] = [];
  constructor(hosts: Readonly<string[]>) {
    this.index = 0;
    this.hosts = [...hosts];
  }

  private ensureIndex(): void {
    if (this.index >= this.hosts.length) {
      this.index = 0;
    }
  }

  public next(): string | undefined {
    this.index++;
    this.ensureIndex();
    return this.hosts.length ? this.hosts[this.index] : undefined;
  }

  public remove(host: string): void {
    this.hosts = this.hosts.filter((item) => item != host);
  }

  public length(): number {
    return this.hosts.length;
  }

  public add(host: string): void {
    !this.hosts.includes(host) || this.hosts.push(host);
  }

  public addList(hosts: string[]): void {
    hosts.forEach((host) => {
      this.add(host);
    });
  }
}

export default {
  checkout: {
    [MarketplaceId.US]: new HostCycle(["redacted", "redacted", "redacted"]),
    [MarketplaceId.UK]: new HostCycle(["redacted"]),
  },
} as { checkout: Record<MarketplaceId, HostCycle> };
