import axios from "axios";

import { Product } from "../types/internal";
import { RegistrationDeviceInfo } from "../types/register/request";
import crypto from "crypto";
import Proxies from "./proxies";

import { EchoAccountInfo } from "../types/alexaMe";

export enum MarketplaceId {
  US = "ATVPDKIKX0DER",
  UK = "A1F83G8C2ARO7P",
}

export const domainMap: Record<MarketplaceId, string> = {
  [MarketplaceId.US]: "com",
  [MarketplaceId.UK]: "co.uk",
};

export const TestProducts: Record<MarketplaceId, Product> = {
  [MarketplaceId.US]: {
    instock: true,
    input: "B01C3LW5JC",
    site: "amazonUS",
    ts: 1619758696478,
    extraData: {
      marketplaceId: MarketplaceId.US,
      productString:
        "Carhartt Men's Knit Cuffed Beanie, Dark Brown/Sandstone, One Size",
      condition: true,
      price: 16.99,
      seller: "Amazon",
      offer:
        "Aweg8kHVQz3F9Zo%2FvQprIWf7YDM6Ohrgqa7pJ7G9vmjCKrx3Y3V4tvLiVgSzvz5cBOC51koNq5IvvVM0d6mFpRRiRyCn4y%2Fsw3c4SHVHgz6RT0z04L6L8TWqpe3zZ5m4BXmvkP%2BktCfHnMIwUvn0%2Bw%3D%3D",
      shipping: 0,
      imageURL:
        "https://ws-na.amazon-adsystem.com/widgets/q?_encoding=UTF8&MarketPlace=US&ASIN=B01C3LW5JC&ServiceVersion=20070822&ID=AsinImage&WS=1&Format=SL250",
    },
  },
  [MarketplaceId.UK]: {
    instock: true,
    input: "B07PJV3JPR",
    site: "amazonUK",
    ts: 1619758696478,
    extraData: {
      marketplaceId: MarketplaceId.UK,
      productString:
        "Echo Dot (3rd Gen) - Smart speaker with Alexa - Charcoal Fabric",
      condition: true,
      price: 39.99,
      seller: "Amazon",
      offer:
        "ff9%2BNp%2FnHDt%2FfXBWsyly0O3K9Vh6K%2B3EDAsX12MmajTWz%2BJHE6ghX4a3CcT%2FWw6K9xZLlXVK2CsI2wOIVHXsuCTfKner0mF7DGo4GHKmyFXG%2FdLqA%2FPYJ32eVVTZbDqI",
      shipping: 0,
      imageURL:
        "https://ws-na.amazon-adsystem.com/widgets/q?_encoding=UTF8&MarketPlace=US&ASIN=B07PJV3JPR&ServiceVersion=20070822&ID=AsinImage&WS=1&Format=SL250",
    },
  },
};

export const ExtraAccountAllowedAsins = [
  "B08FC6MR62",
  "B08FC5L3RG",
  "B09DP86ZDH",
  "B09DFHJTF5",
  "B09DFCB66S",
  "B08H75RTZ8",
  "B0981BNN9M",
  "B0981CTCKS",
  "B09V1T5G3M",
  "B09V1QWJLB",
  "B09V1S84TK",
  "B09V1T7W2G",
  "B09SZJF44D",
  "B09V1RFGYD",

  // Horizon PS5
  "B0B16656Z2",
  "B0B167VTXQ",

  // UK
  "B08H97NYGP",
  "B08H95Y452",
];

export const asinRegex = /^[A-Z0-9]{10}$/;

export const generateAmazonRID = (): string =>
  crypto.randomBytes(10).toString("hex").toUpperCase();

export const generateAppUUID = () => crypto.randomBytes(8).toString("hex");

export const getAccountFromCookies = async (
  cookieString: string,
  marketplaceId: MarketplaceId
): Promise<EchoAccountInfo | undefined> => {
  try {
    var resp = await axios({
      validateStatus: null,
      url: `https://alexa.amazon.${domainMap[marketplaceId]}/api/users/me`,
      proxy: Proxies.etc.next(),
      headers: {
        Connection: "keep-alive",
        "Cache-Control": "max-age=0",
        "Upgrade-Insecure-Requests": "1",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
        "Sec-GPC": "1",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-User": "?1",
        "Sec-Fetch-Dest": "document",
        "Accept-Encoding": "gzip, deflate, br",
        "Accept-Language": "en-US,en;q=0.9",
        Cookie: cookieString,
      },
      transformResponse: [],
    });

    return JSON.parse(resp.data);
  } catch {
    return undefined;
  }
};

export const generateDeviceInfo = (): RegistrationDeviceInfo => {
  return {
    domain: "Device",
    app_version: "0.0",
    device_type: "A3NWHXTQ4EBCZS",
    os_version: "14.3",
    device_serial: crypto.randomBytes(12).toString("hex"),
    device_model: "iPhone",
    app_name: "Amazon Shopping",
    software_version: "1",
  };
};
