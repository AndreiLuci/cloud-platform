require("express-async-errors");
import { PrismaClient } from "@prisma/client";
import ExpressApp from "express";
import { Express } from "express-serve-static-core";
import { Server } from "node:http";
import morgan from "morgan";
import apiRouter from "../routes/api";
import health from "../routes/health";
import AccountCollection from "./account/collection";
import { ServersideMonitor } from "./monitor";
import { logger } from "../utils/etc";
import client from "prom-client";
import promBundle from "express-prom-bundle";
import basicAuth from "express-basic-auth";
import { MarketplaceId } from "../utils/amazon";
import { errorMiddleware } from "../utils/middleware";

export default class Kimchi {
  private prisma: PrismaClient = new PrismaClient();
  private app: Express = ExpressApp();
  private server?: Server;
  public accountCollection: AccountCollection = new AccountCollection(
    this.prisma
  );
  public monitor: ServersideMonitor = new ServersideMonitor();

  constructor(public port: number) {
    this.configureApp();
    this.addAllAccounts();
    this.addMonitorListener();
  }

  private configureApp() {
    const metricsMiddleware = promBundle({
      includeMethod: true,
      includePath: true,
    });
    const routerArgs = {
      prisma: this.prisma,
      accountCollection: this.accountCollection,
      app: this.app,
    };

    this.app.use(health(routerArgs));

    this.app.use(
      "/metrics",
      basicAuth({ users: { grafana: process.env.METRICS_SECRET as string } })
    );

    this.setupClientGauges();

    this.app.use(metricsMiddleware);

    this.app.use(
      morgan(
        "┌> [:date[web]] [:req[cf-ipcountry] :req[x-forwarded-for]] [:req[user-agent]] \n└> [:method :url :status] [:response-time ms] [:res[x-identity]::req[authorization]::req[x-hwid]::req[api-key]]"
      )
    );
    this.app.use(apiRouter(routerArgs));

    this.app.use(errorMiddleware);
  }
  public setupClientGauges(): void {
    const prisma = this.prisma;

    client.collectDefaultMetrics();

    new client.Gauge({
      name: "amazon_us_accounts",
      help: "How many accounts are currently running on Amazon US.",
      async collect() {
        const count = await prisma.account.count({
          where: { marketplaceId: MarketplaceId.US },
        });
        this.set(count);
      },
    });

    new client.Gauge({
      name: "amazon_uk_accounts",
      help: "How many accounts are currently running on Amazon UK.",
      async collect() {
        const count = await prisma.account.count({
          where: { marketplaceId: MarketplaceId.UK },
        });
        this.set(count);
      },
    });

    new client.Gauge({
      name: "users_count",
      help: "How many users have used the API more than once.",
      async collect() {
        const count = await prisma.user.count();
        this.set(count);
      },
    });

    new client.Gauge({
      name: "users_with_us_account",
      help: "How many users have at least 1 Amazon US account.",
      async collect() {
        const count = await prisma.user.count({
          where: { accounts: { some: { marketplaceId: MarketplaceId.US } } },
        });
        this.set(count);
      },
    });

    new client.Gauge({
      name: "users_with_uk_account",
      help: "How many users have at least 1 Amazon UK account.",
      async collect() {
        const count = await prisma.user.count({
          where: { accounts: { some: { marketplaceId: MarketplaceId.UK } } },
        });
        this.set(count);
      },
    });

    new client.Gauge({
      name: "users_with_webhooks",
      help: "How many users have a webhook attached.",
      async collect() {
        const count = await prisma.user.count({
          where: { NOT: { webhookURL: null } },
        });
        this.set(count);
      },
    });
  }

  public async addMonitorListener(): Promise<void> {
    this.monitor.on(
      "stock-update",
      this.accountCollection.startAccountsLoop.bind(this.accountCollection)
    );
    logger.green("Added monitor listener");
  }

  public async addAllAccounts(): Promise<void> {
    const accounts = await this.prisma.account.findMany({
      include: { User: true },
    });

    accounts.forEach((account) => {
      try {
        this.accountCollection.add(account, account.User.key);
      } catch (err: any) {
        logger.red(
          "Error when adding initial account: " + err.message,
          account.marketplaceId,
          account.email
        );
      }
    });
    logger.green(`Added ${this.accountCollection.length} initial accounts`);

    // this.accountCollection.startAccountsLoop(TestProducts[MarketplaceId.US]);

    // this.accountCollection.startAccountsLoop({
    //   instock: true,
    //   input: "B08Q7BMHVD",
    //   site: "amazonUS",
    //   ts: Date.now(),
    //   extraData: {
    //     marketplaceId: MarketplaceId.US,
    //     productString:
    //       "MSI Gaming GeForce RTX 3070 8GB GDRR6 256-Bit HDMI/DP 1920 MHz Ampere Architecture OC Graphics Card (RTX 3070 Suprim X 8G)",
    //     condition: true,
    //     price: 0,
    //     seller: "Amazon",
    //     offer:
    //       "zdlXKXWkP9201UU5ku7Hh57bfplabPNuf%2FUO%2B3koUdQ9idHWUG6OsLTRra5%2B1G2ujX6yUfa9PT%2FXo5f52qeh2FgjFivHuaHTGl6Be%2FgmliI3SgyogmdnggDu7QlFu10Pd5uzIhieQXXhVKneQvEqyQ%3D%3D",
    //     shipping: 0,
    //     imageURL:
    //       "https://ws-na.amazon-adsystem.com/widgets/q?_encoding=UTF8&MarketPlace=US&ASIN=B08Q7BMHVD&ServiceVersion=20070822&ID=AsinImage&WS=1&Format=SL250",
    //   },
    // });
  }

  public start(cb: () => void) {
    this.server = this.app.listen(this.port, cb);
  }

  public stop(): Promise<any> {
    this.server?.close();
    return this.prisma.$disconnect();
  }
}
