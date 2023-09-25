import axios, { AxiosResponse } from "axios";
import { getPurchaseInitiateURI } from "../structures/account";
import InitiateResponse from "../types/initiate";
import { generateAmazonRID, MarketplaceId, TestProducts } from "./amazon";
import { logger } from "./etc";
import Hosts from "./hosts";
import Proxies from "./proxies";

export const cookiesCanCheckout = async (
  email: string,
  marketplaceId: MarketplaceId,
  cookieString: string,
  accessToken: string
): Promise<boolean> => {
  const testProduct = TestProducts[marketplaceId];
  const host = Hosts.checkout[marketplaceId].next();

  if (!host) {
    logger.red("Invalid host when testing checkout " + host);
    return false;
  }

  try {
    const resp: AxiosResponse<InitiateResponse> = await axios({
      timeout: 5000,
      method: "POST",
      validateStatus: null,
      proxy: Proxies.etc.next(),
      url: getPurchaseInitiateURI(marketplaceId, host),
      headers: {
        "x-amz-access-token": accessToken,
        cookie: cookieString,
        "x-amzn-RequestId": generateAmazonRID(),
      },
      data: {
        items: [
          {
            asin: testProduct.input,
            offerId: testProduct.extraData.offer,
            quantity: 1,
          },
        ],
      },
    });

    if (typeof resp.data?.entity?.purchaseState === "undefined") {
      logger.red(
        "Invalid checkout response " +
          resp.statusText +
          JSON.stringify(resp.data)
      );
      return false;
    }

    logger.green(
      "Tested checkout with Purchase STATE: " +
        resp.data?.entity?.purchaseState,
      email
    );
    return resp.data?.entity?.purchaseState?.includes("OK") ?? false;
  } catch (err) {
    return false;
  }
};
