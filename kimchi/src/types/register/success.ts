export interface Account {
  extensions: Extensions;
  tokens: Tokens;
  customer_id: string;
}
export interface Extensions {
  device_info: DeviceInfo;
  customer_info: CustomerInfo;
}
export interface DeviceInfo {
  device_name: string;
  device_serial_number: string;
  device_type: string;
}
export interface CustomerInfo {
  account_pool: string;
  preferred_marketplace: string;
  country_of_residence: string;
  user_id: string;
  home_region: string;
  name: string;
  given_name: string;
  source_of_country_of_residence: string;
}
export interface Tokens {
  website_cookies?: WebsiteCookiesEntity[];
  store_authentication_cookie: StoreAuthenticationCookie;
  mac_dms: MacDms;
  bearer: Bearer;
}
export interface WebsiteCookiesEntity {
  Path: string;
  Secure: string;
  Value: string;
  Expires: string;
  Domain: string;
  HttpOnly: string;
  Name: string;
}
export interface StoreAuthenticationCookie {
  cookie: string;
}
export interface MacDms {
  device_private_key: string;
  adp_token: string;
}
export interface Bearer {
  access_token: string;
  refresh_token: string;
  expires_in: string;
}
