import { 
  SSOOIDCClient, 
  RegisterClientCommand, 
  StartDeviceAuthorizationCommand, 
  CreateTokenCommand 
} from "@aws-sdk/client-sso-oidc";
import { 
  SSOClient, 
  ListAccountsCommand, 
  ListAccountRolesCommand, 
  GetRoleCredentialsCommand,
  AccountInfo,
  RoleInfo
} from "@aws-sdk/client-sso";

export interface SsoDeviceAuthResponse {
  deviceCode: string;
  userCode: string;
  verificationUriComplete: string;
  interval: number;
  expiresIn: number;
  clientId: string;
  clientSecret: string;
}

export interface SsoCredentialsResponse {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string;
  expiration?: number;
}

/**
 * Registers a dynamic client and requests a device authorization code from AWS OIDC.
 */
export const startSsoOidcFlow = async (
  startUrl: string,
  ssoRegion: string
): Promise<SsoDeviceAuthResponse> => {
  const oidcClient = new SSOOIDCClient({ region: ssoRegion });

  console.log(`[SSO-OIDC] Registering client in region ${ssoRegion}...`);
  const registerRes = await oidcClient.send(
    new RegisterClientCommand({
      clientName: "s3-explorer-desktop",
      clientType: "public",
    })
  );

  const clientId = registerRes.clientId;
  const clientSecret = registerRes.clientSecret;

  if (!clientId || !clientSecret) {
    throw new Error("Failed to dynamically register client with AWS OIDC.");
  }

  console.log(`[SSO-OIDC] Starting device authorization for ${startUrl}...`);
  const authRes = await oidcClient.send(
    new StartDeviceAuthorizationCommand({
      clientId,
      clientSecret,
      startUrl,
    })
  );

  const { deviceCode, userCode, verificationUriComplete, interval, expiresIn } = authRes;

  if (!deviceCode || !userCode || !verificationUriComplete) {
    throw new Error("Failed to start device authorization.");
  }

  return {
    deviceCode,
    userCode,
    verificationUriComplete,
    interval: interval || 5,
    expiresIn: expiresIn || 600,
    clientId,
    clientSecret,
  };
};

/**
 * Polls the OIDC service until the user has successfully authorized the device in the browser.
 */
export const pollForOidcToken = async (
  clientId: string,
  clientSecret: string,
  deviceCode: string,
  intervalSeconds: number,
  ssoRegion: string,
  onProgress?: (message: string) => void
): Promise<{ accessToken: string; expiresIn: number }> => {
  const oidcClient = new SSOOIDCClient({ region: ssoRegion });
  const pollIntervalMs = intervalSeconds * 1000;
  
  console.log(`[SSO-OIDC] Starting token polling (interval: ${intervalSeconds}s)...`);
  
  while (true) {
    try {
      const tokenRes = await oidcClient.send(
        new CreateTokenCommand({
          clientId,
          clientSecret,
          deviceCode,
          grantType: "urn:ietf:params:oauth:grant-type:device_code",
        })
      );
      
      if (tokenRes.accessToken) {
        console.log("[SSO-OIDC] Access token retrieved successfully.");
        return {
          accessToken: tokenRes.accessToken,
          expiresIn: tokenRes.expiresIn || 28800 // Default 8 hours (28800s)
        };
      }
      throw new Error("Token response did not include an access token.");
    } catch (err: any) {
      if (err.name === "AuthorizationPendingException") {
        if (onProgress) onProgress("Waiting for approval in browser...");
        await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
      } else if (err.name === "SlowDownException") {
        // AWS requested to slow down, increase poll wait by 5s
        if (onProgress) onProgress("Slowing down polling...");
        await new Promise((resolve) => setTimeout(resolve, pollIntervalMs + 5000));
      } else {
        console.error("[SSO-OIDC] Polling error:", err);
        throw err;
      }
    }
  }
};

/**
 * Lists AWS accounts associated with the OIDC access token.
 */
export const listAwsAccounts = async (
  accessToken: string,
  ssoRegion: string
): Promise<AccountInfo[]> => {
  const ssoClient = new SSOClient({ region: ssoRegion });
  
  console.log("[SSO] Fetching accessible AWS accounts...");
  const res = await ssoClient.send(
    new ListAccountsCommand({ accessToken })
  );
  
  return res.accountList || [];
};

/**
 * Lists IAM Identity Center roles available to the user in a specific AWS account.
 */
export const listAwsAccountRoles = async (
  accessToken: string,
  accountId: string,
  ssoRegion: string
): Promise<RoleInfo[]> => {
  const ssoClient = new SSOClient({ region: ssoRegion });
  
  console.log(`[SSO] Fetching roles for account ${accountId}...`);
  const res = await ssoClient.send(
    new ListAccountRolesCommand({
      accessToken,
      accountId,
    })
  );
  
  return res.roleList || [];
};

/**
 * Retrieves temporary AWS credentials for a given role in a specific account.
 */
export const getRoleCredentials = async (
  accessToken: string,
  accountId: string,
  roleName: string,
  ssoRegion: string
): Promise<SsoCredentialsResponse> => {
  const ssoClient = new SSOClient({ region: ssoRegion });
  
  console.log(`[SSO] Requesting temporary credentials for account ${accountId}, role ${roleName}...`);
  const res = await ssoClient.send(
    new GetRoleCredentialsCommand({
      accessToken,
      accountId,
      roleName,
    })
  );
  
  const creds = res.roleCredentials;
  if (!creds || !creds.accessKeyId || !creds.secretAccessKey || !creds.sessionToken) {
    throw new Error("AWS SSO returned incomplete or invalid role credentials.");
  }
  
  return {
    accessKeyId: creds.accessKeyId,
    secretAccessKey: creds.secretAccessKey,
    sessionToken: creds.sessionToken,
    expiration: creds.expiration,
  };
};
