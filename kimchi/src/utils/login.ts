import axios, { AxiosInstance } from "axios";
import { RegistrationDeviceInfo } from "../types/register/request";
import { CodePairs } from "../types/codepairs/success";
import { Account } from "../types/register/success";
import { domainMap, generateDeviceInfo, MarketplaceId } from "./amazon";
import Proxies from "../utils/proxies";

const getRegisterURI = (marketplaceId: MarketplaceId) =>
  `https://api.amazon.${domainMap[marketplaceId]}/auth/register`;

const getCreateCodePairUri = (marketplaceId: MarketplaceId) =>
  `https://api.amazon.${domainMap[marketplaceId]}/auth/create/codepair`;

const getCodeURI = (marketplaceId: MarketplaceId) =>
  `https://www.amazon.${domainMap[marketplaceId]}/a/code`;

const getNewAxiosSession = (marketplaceId: MarketplaceId): AxiosInstance =>
  axios.create({
    timeout: 5000,
    //proxy: Proxies.etc.next(),
    withCredentials: true,
    validateStatus: null,
    headers: {
      "x-amzn-identity-auth-domain": `api.amazon.${domainMap[marketplaceId]}`,
      "User-Agent":
        "Mozilla/5.0 (iPhone; CPU iPhone OS 14_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148",
    },
  });

export default class AmazonLogin {
  private deviceInfo: RegistrationDeviceInfo = generateDeviceInfo();
  private http: AxiosInstance = getNewAxiosSession(this.marketplaceId);
  constructor(
    public readonly cookieString: string,
    public readonly marketplaceId: MarketplaceId
  ) {}

  private async getNewCodePair(): Promise<CodePairs> {
    const resp = await this.http({
      method: "POST",
      url: getCreateCodePairUri(this.marketplaceId),
      data: { code_data: this.deviceInfo },
    });

    const data = resp.data;

    if (data.error)
      throw new Error(
        `Error when generating code pairs: [${data.error}] ${data.error_description}`
      );

    return data;
  }

  private async registerDevice(codePairs: CodePairs): Promise<Account> {
    const resp = await this.http({
      method: "POST",
      url: getRegisterURI(this.marketplaceId),
      data: {
        auth_data: {
          use_global_authentication: "true",
          code_pair: {
            public_code: codePairs.public_code,
            private_code: codePairs.private_code,
          },
        },
        registration_data: this.deviceInfo,
        requested_token_type: [
          "bearer",
          "mac_dms",
          "store_authentication_cookie",
          "website_cookies",
        ],
        cookies: {
          domain: `.amazon.${domainMap[this.marketplaceId]}`,
          website_cookies: [],
        },
        requested_extensions: ["device_info", "customer_info"],
      },
    });

    const error = resp.data.response.error;
    const success: Account = resp.data.response.success;

    if (error) {
      throw new Error(
        `Error when registering: [${error.code}] ${error.message}`
      );
    }

    return success;
  }

  private async getCodeAuthorizationCSRF(): Promise<string> {
    const resp = await this.http({
      url: getCodeURI(this.marketplaceId),
      headers: {
        Cookie: this.cookieString,
      },
    });

    if (resp.data.includes("ap_password"))
      throw new Error("Encountered password verification");

    const csrfSplits: string[] = resp.data.split(`csrfToken' value='`);

    if (csrfSplits.length > 1) return csrfSplits[1].split(`'`)[0];

    throw new Error("Couldn't find CSRF token for authorizing code");
  }

  private async authorizeCode(codePairs: CodePairs): Promise<void> {
    const csrfCode = await this.getCodeAuthorizationCSRF();
    const resp = await this.http({
      method: "POST",
      url: `${getCodeURI(this.marketplaceId)}`,
      headers: {
        Cookie: this.cookieString,
      },
      maxRedirects: 0,
      data: `csrfToken=${encodeURIComponent(csrfCode)}&cbl-code=${
        codePairs.public_code
      }&language=en_US`,
    });

    const location: string = resp.headers["location"];

    if (location.includes("successfully_authorized_user_code")) return;

    throw new Error("Incorrect redirect when authorizing code: " + location);
  }

  public async login(): Promise<Account> {
    const codePairs = await this.getNewCodePair();
    await this.authorizeCode(codePairs);

    return await this.registerDevice(codePairs);
  }
}

new AmazonLogin(
  'ubid-main=130-9588514-1799649; session-id=142-3770549-9116253; ubid-acbus=130-9588514-1799649; x-acbus=MV4g948lCmnj4HXKfortFyIOAUnrzA4MEYjE7nd?r@6@FT92mTmdFlDciYmNtrWS; session-id-eu=262-8261842-2537865; ubid-acbuk=261-2201784-3578521; session-id-time-eu=2324058461l; AMCV_4A8581745834114C0A495E2B%40AdobeOrg=-2121179033%7CMCIDTS%7C19622%7CMCMID%7C67940865779765862406295129088946447878%7CMCAID%7CNONE%7CMCOPTOUT-1695344704s%7CNONE%7CvVersion%7C5.3.0; mbox=session#0652b663665842fd853bd4814b1bf825#1695339365|PC#0652b663665842fd853bd4814b1bf825.37_0#1758582305; skin=noskin; session-token="jBlE3HUya0lFR2TEOHmu7O1UaE0NZ6/Q25P+Fi51DvycUk4b3dIxtOkyhx7vkKx9YWhKJ2d11kd8YVubYj8I29JBA92d71KZ88616fHVpOn1ELUXvmh89ZmnS0boLjLWV/UVh9yE/Z/fPGNdo+eNF3Gu03DpT1kM8S8h1D+TwJfG/pKmhs07pufVelec+KWF0dwBkWF7F/n0Zf05z/YoyKqLYPPMR+Phqno8e81j3Ed01lcS+ZpKQfmfU6kd+J12y9Dur7a7f+qRjHO8xjw4f7wWufxrgy6TqJOJYrWXj/MRct9nE5qURsMPw5pyqKHst2oVx9GtBHx/Os3BnOJZfr5Wp59ufWhb2lF8zhSbfKYJoRAMj4MWQQ=="; x-main="m@FcsUw8v?I4zN36ucReGI?Q2?3yzr98OC9MHM7W5DGZ8qPBeEXFg4J@3CO5ugXi"; at-main=Atza|IwEBIFvmFZ_qrnqIVE9wbCd5XiNteDQejv3iuZk3Gt7OZq-npyqdjoO29aGub5UEtR2Wfdu5Y9c7VSc2SCpsa8KPucp-Qqs6voJPVaIuUJYLXVaJAYpUIzqLbvc_LJlE-bRr50KQYrk0nzU5Hnn1KAbmjXnmKV-VJw1eWqDlVJdygF6RXiYLUAPC3wYKfv-VZiwzScpLEvqdCIuLAm0GgPiBB3dv5HyDSWlMiu9dO0SH38bHfQ; sess-at-main="yWWQLeS77Qp0DTbNXwjCu0rdkbxbFjPzd3Bu7mVbGCw="; sst-main=Sst1|PQGkDtIRvH4AJxjXJAZLvS5rCY53csZnR54cgdaq6_7TiXesV_MbXrVM84osn_R1U_GQGChDdrlLn6yOy-rkBbnduQefFmmpcsx2dscSOZzE21KLLHLxID-hMHWTcpCWFV01Hd7gVIteUpsePIZAtgWCkHRotLB3b2_29WhpbD5EvuGON4NRNcpKATroHGzNIgLrewrjotfuQ3p3HP9ljLW1-eHEULRdDzzUqL84Apo6-vMoyoUd09vTpCNFor2wLFTtx-wnZHNy_yV6hhH4IuS8Fn6g7dkvmZpwuJYrEHHXGME; lc-main=en_US; session-id-time=2082787201l; i18n-prefs=USD; sp-cdn="L5Z9:RO"; csm-hit=tb:9X32Z39461MSW8EAAMBB+s-MNEWHSA4D64Y7D0TMKD5|1695340335898&t:1695340335898&adb:adblk_yes',
  MarketplaceId.US
);
