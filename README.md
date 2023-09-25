Overview

The Checkout Cloud Platform is a versatile repository that provides an API for authorized users to manage their Amazon accounts and check their account status. This platform allows users to add, delete, and modify their accounts, as well as check how many accounts they have. It leverages a database to store account information and periodically checks the login session validity.

Proxy Integration

The primary feature of this enhanced platform is the seamless integration of proxies into the checkout process. Here's how it works:

Proxy Support:  
It assigns a randon proxy for their Amazon accounts from the proxy checkout list.

Anonymous Checkout:  
When users initiate a checkout process, the platform will route the request through the specified proxy, ensuring that Amazon sees the request as originating from the proxy's location.

Account Security:  
This proxy integration helps protect user Amazon accounts by preventing Amazon from associating the checkout requests with the user's actual location or IP address.


Features

Account Management: Authorized users can add, delete, and modify their Amazon accounts using the provided API endpoints.

Account Status Checking: Automatically checks the status of their Amazon accounts to verify if the login sessions are still valid.

Database Storage: The platform stores account cookies securely in a database for easy retrieval and management.

Authentication: Access to the API is restricted to authorized users to ensure data security.

Integration with Discord: Users can use a Discord command to query the platform and retrieve information about their accounts.
