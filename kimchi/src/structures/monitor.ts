import ReconnectingWebsocket from "reconnecting-websocket";
import { EventEmitter } from "events";
import WebSocket from "ws";
import { Product } from "../types/internal";
import { logger } from "../utils/etc";

const SOCKET_URI = "wss://cloud-monitor.onrender.com/amazon";
const CLOUD_SECRET = "yDLJ963twC44fdenbfGjqrEnnxAw2Gg8";

export class ServersideMonitor extends EventEmitter {
  private pingInterval: NodeJS.Timeout;
  private socket = new ReconnectingWebsocket(SOCKET_URI, [], {
    WebSocket,
    maxReconnectionDelay: 1000,
    minReconnectionDelay: 100,
  });

  constructor() {
    super();

    this.pingInterval = setInterval(this.ping.bind(this), 7e3);
    this.setupSocketEventListeners();
  }

  private ping(): void {
    this.socket.send("ping");
  }

  private setupSocketEventListeners() {
    this.socket.addEventListener("error", (error) => {
      logger.red("Error in serverside monitor: " + error.message);
    });
    this.socket.addEventListener("open", this.$onOpen.bind(this));
    this.socket.addEventListener("close", () => {
      logger.red("Monitor socket closed. attempting to re-connect.");
    });
    this.socket.addEventListener("message", this.$onMessage.bind(this));
  }

  private $onOpen() {
    logger.green("Monitor connected");
    this.socket.send(CLOUD_SECRET);
  }

  private $onMessage({ data }: any) {
    if (data === "ping") {
      return this.socket.send("pong");
    } else if (data === "pong") {
      return;
    }

    const parsedData = JSON.parse(data);
    parsedData.forEach((data: Product) => {
      this.emit(`stock-update`, data);
    });
  }
}
