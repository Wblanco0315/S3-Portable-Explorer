import { Command } from "@tauri-apps/plugin-shell";

export const getLocalSSOCredentials = async (profile: string) => {
  try {
    const cmd = Command.create("aws", ["configure", "export-credentials", "--profile", profile]);
    const output = await cmd.execute();
    
    if (output.code === 0) {
      const creds = JSON.parse(output.stdout);
      return {
        accessKeyId: creds.AccessKeyId,
        secretAccessKey: creds.SecretAccessKey,
        sessionToken: creds.SessionToken,
      };
    } else {
      throw new Error(output.stderr || "Failed to retrieve credentials. You might need to login first.");
    }
  } catch (error) {
    console.error(error);
    throw error;
  }
};

export const triggerSSOLogin = async (profile: string) => {
  try {
    // This will open the default web browser to the AWS SSO login page
    const cmd = Command.create("aws", ["sso", "login", "--profile", profile]);
    const output = await cmd.execute();
    
    if (output.code !== 0) {
      throw new Error(output.stderr || "Failed to trigger SSO login");
    }
    return true;
  } catch (error) {
    console.error("SSO Login Error:", error);
    throw error;
  }
};

export const checkSSOConfiguration = async (profile: string) => {
  try {
    const cmd = Command.create("aws", ["configure", "get", "sso_start_url", "--profile", profile]);
    const output = await cmd.execute();
    return output.code === 0 && output.stdout.trim().length > 0;
  } catch (error) {
    return false;
  }
};

export const openTerminalForSSO = async (profile: string) => {
  try {
    const platform = navigator.userAgent.toLowerCase();
    let cmd;
    
    if (platform.includes('win')) {
      cmd = Command.create("cmd", ["/c", "start", "cmd", "/k", `aws configure sso --profile ${profile}`]);
    } else if (platform.includes('mac')) {
      cmd = Command.create("osascript", ["-e", `tell application "Terminal" to do script "aws configure sso --profile ${profile}"`]);
    } else {
      throw new Error("Automatic terminal launch is only supported on Windows and macOS. Please run `aws configure sso` in your terminal manually.");
    }
    
    await cmd.execute();
    return true;
  } catch (error) {
    console.error("Failed to open terminal:", error);
    throw error;
  }
};

export const listAwsProfiles = async (): Promise<string[]> => {
  try {
    const cmd = Command.create("aws", ["configure", "list-profiles"]);
    const output = await cmd.execute();
    if (output.code === 0) {
      return output.stdout.split('\n').map(p => p.trim()).filter(p => p.length > 0);
    }
    return ["default"];
  } catch (error) {
    console.error("Failed to list profiles:", error);
    return ["default"];
  }
};
