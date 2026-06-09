import { useNavigate } from "react-router-dom";
import {
  isAwsAuthenticated,
  getCurrentActiveProfile,
  clearAwsCredentials,
  setAwsCredentials,
} from "../../features/aws/s3Client";
import { getLocalSSOCredentials } from "../../features/aws/awsCli";
import { Route, incrementRouteVisit } from "../../features/favorites/favoritesStore";

export function useRouteNavigator() {
  const navigate = useNavigate();

  const navigateToRoute = async (route: Route) => {
    if (route.id) {
      incrementRouteVisit(route.id).catch((err) =>
        console.error("Failed to increment route visit count:", err)
      );
    }
    const targetPath = `/buckets/${route.bucket}?prefix=${encodeURIComponent(route.prefix)}`;
    const currentProfile = getCurrentActiveProfile();
    const targetProfile = route.profile || "default";
    const isTargetNativeSSO = targetProfile.startsWith("sso-native-");

    if (currentProfile && currentProfile !== targetProfile) {
      console.log(`Profile mismatch: current active is '${currentProfile}', target is '${targetProfile}'. Resetting session...`);
      
      // 1. Log out from the current profile session
      clearAwsCredentials();
      localStorage.removeItem("aws_sso_profile");
      localStorage.removeItem("aws_auth_method");

      // 2. Set the target profile variables
      localStorage.setItem("aws_sso_profile", targetProfile);
      localStorage.setItem("aws_auth_method", isTargetNativeSSO ? "sso-native" : "sso");

      // 3. Save target route to session storage to navigate to after authentication
      sessionStorage.setItem("redirect_after_login", targetPath);

      // 4. Try automatic login for the target profile
      if (isTargetNativeSSO) {
        try {
          const storedToken = localStorage.getItem("aws_sso_token");
          const expiresAtStr = localStorage.getItem("aws_sso_token_expires_at");
          const hasToken = storedToken && expiresAtStr && parseInt(expiresAtStr, 10) > Date.now();
          const storedAccountId = localStorage.getItem("aws_sso_account_id");
          const storedRoleName = localStorage.getItem("aws_sso_role_name");
          const targetAccountId = targetProfile.replace("sso-native-", "");
          const targetRegion = localStorage.getItem("aws_region") || "us-east-1";

          if (hasToken && storedAccountId === targetAccountId && storedRoleName) {
            console.log(`Attempting automatic native SSO login for account: ${targetAccountId}`);
            const { getRoleCredentials } = await import("../../features/aws/awsSsoOidc");
            const creds = await getRoleCredentials(
              storedToken,
              targetAccountId,
              storedRoleName,
              targetRegion
            );
            setAwsCredentials(
              creds.accessKeyId,
              creds.secretAccessKey,
              creds.sessionToken,
              targetRegion
            );
            sessionStorage.removeItem("redirect_after_login");
            console.log("Automatic native SSO login successful. Redirecting directly to bucket.");
            navigate(targetPath);
          } else {
            throw new Error("Missing or expired native SSO credentials/token");
          }
        } catch (err) {
          console.warn(`Automatic native SSO login failed for '${targetProfile}'. Directing to login screen.`, err);
          navigate("/buckets");
        }
      } else {
        try {
          console.log(`Attempting automatic login for target profile: '${targetProfile}'`);
          const creds = await getLocalSSOCredentials(targetProfile);
          setAwsCredentials(
            creds.accessKeyId,
            creds.secretAccessKey,
            creds.sessionToken,
            localStorage.getItem("aws_region") || "us-east-1"
          );
          sessionStorage.removeItem("redirect_after_login");
          console.log("Automatic login successful. Redirecting directly to bucket.");
          navigate(targetPath);
        } catch (err) {
          console.warn(`Automatic login failed for '${targetProfile}' (token probably expired/invalid). Directing to login screen.`, err);
          navigate("/buckets");
        }
      }
      return;
    }

    // Same profile, but not authenticated
    if (!isAwsAuthenticated()) {
      localStorage.setItem("aws_sso_profile", targetProfile);
      localStorage.setItem("aws_auth_method", isTargetNativeSSO ? "sso-native" : "sso");
      sessionStorage.setItem("redirect_after_login", targetPath);

      if (isTargetNativeSSO) {
        try {
          const storedToken = localStorage.getItem("aws_sso_token");
          const expiresAtStr = localStorage.getItem("aws_sso_token_expires_at");
          const hasToken = storedToken && expiresAtStr && parseInt(expiresAtStr, 10) > Date.now();
          const storedAccountId = localStorage.getItem("aws_sso_account_id");
          const storedRoleName = localStorage.getItem("aws_sso_role_name");
          const targetAccountId = targetProfile.replace("sso-native-", "");
          const targetRegion = localStorage.getItem("aws_region") || "us-east-1";

          if (hasToken && storedAccountId === targetAccountId && storedRoleName) {
            console.log(`Attempting automatic native SSO login for account: ${targetAccountId}`);
            const { getRoleCredentials } = await import("../../features/aws/awsSsoOidc");
            const creds = await getRoleCredentials(
              storedToken,
              targetAccountId,
              storedRoleName,
              targetRegion
            );
            setAwsCredentials(
              creds.accessKeyId,
              creds.secretAccessKey,
              creds.sessionToken,
              targetRegion
            );
            sessionStorage.removeItem("redirect_after_login");
            console.log("Automatic native SSO login successful. Redirecting directly to bucket.");
            navigate(targetPath);
          } else {
            throw new Error("Missing or expired native SSO credentials/token");
          }
        } catch (err) {
          console.warn(`Automatic native SSO login failed for '${targetProfile}'. Directing to login screen.`, err);
          navigate("/buckets");
        }
      } else {
        try {
          console.log(`Attempting automatic login for profile: '${targetProfile}'`);
          const creds = await getLocalSSOCredentials(targetProfile);
          setAwsCredentials(
            creds.accessKeyId,
            creds.secretAccessKey,
            creds.sessionToken,
            localStorage.getItem("aws_region") || "us-east-1"
          );
          sessionStorage.removeItem("redirect_after_login");
          console.log("Automatic login successful. Redirecting directly to bucket.");
          navigate(targetPath);
        } catch (err) {
          console.warn(`Automatic login failed for '${targetProfile}'. Navigating to login screen.`, err);
          navigate("/buckets");
        }
      }
      return;
    }

    // Same profile and already authenticated, navigate directly
    navigate(targetPath);
  };

  return { navigateToRoute };
}
