import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  isAwsAuthenticated,
  getCurrentActiveProfile,
  clearAwsCredentials,
  setAwsCredentials,
} from "../../features/aws/s3Client";
import { getLocalSSOCredentials } from "../../features/aws/awsCli";
import { Route, incrementRouteVisit } from "../../features/favorites/favoritesStore";
import { useLoadingStore } from "./useLoadingStore";

export function useRouteNavigator() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const showLoading = useLoadingStore((state) => state.showLoading);
  const hideLoading = useLoadingStore((state) => state.hideLoading);

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
          showLoading(t("buckets.switching_sso_account"));
          const storedToken = localStorage.getItem("aws_sso_token");
          const expiresAtStr = localStorage.getItem("aws_sso_token_expires_at");
          const hasToken = storedToken && expiresAtStr && parseInt(expiresAtStr, 10) > Date.now();
          const storedRoleName = localStorage.getItem("aws_sso_role_name");
          const targetAccountId = targetProfile.replace("sso-native-", "");
          const targetRegion = localStorage.getItem("aws_region") || "us-east-1";

          if (hasToken) {
            console.log(`Attempting automatic native SSO login for account: ${targetAccountId}`);
            const { loginToNativeSsoAccount } = await import("../../features/aws/awsSsoOidc");
            const creds = await loginToNativeSsoAccount(
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

            // Save persistent profile configs for the active account
            localStorage.setItem("aws_sso_profile", targetProfile);
            localStorage.setItem("aws_sso_account_id", targetAccountId);
            localStorage.setItem("aws_sso_account_name", creds.accountName);
            localStorage.setItem("aws_sso_role_name", creds.roleName);
            localStorage.setItem("aws_auth_method", "sso-native");

            sessionStorage.removeItem("redirect_after_login");
            console.log("Automatic native SSO login successful. Redirecting directly to bucket.");
            navigate(targetPath);
          } else {
            throw new Error("Missing or expired native SSO credentials/token");
          }
        } catch (err) {
          console.warn(`Automatic native SSO login failed for '${targetProfile}'. Directing to login screen.`, err);
          sessionStorage.removeItem("redirect_after_login");
          navigate("/buckets");
        } finally {
          hideLoading();
        }
      } else {
        try {
          showLoading(t("buckets.profile_login", { profile: targetProfile }));
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
        } finally {
          hideLoading();
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
          showLoading(t("buckets.auto_sso_login"));
          const storedToken = localStorage.getItem("aws_sso_token");
          const expiresAtStr = localStorage.getItem("aws_sso_token_expires_at");
          const hasToken = storedToken && expiresAtStr && parseInt(expiresAtStr, 10) > Date.now();
          const storedRoleName = localStorage.getItem("aws_sso_role_name");
          const targetAccountId = targetProfile.replace("sso-native-", "");
          const targetRegion = localStorage.getItem("aws_region") || "us-east-1";

          if (hasToken) {
            console.log(`Attempting automatic native SSO login for account: ${targetAccountId}`);
            const { loginToNativeSsoAccount } = await import("../../features/aws/awsSsoOidc");
            const creds = await loginToNativeSsoAccount(
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

            // Save persistent profile configs for the active account
            localStorage.setItem("aws_sso_profile", targetProfile);
            localStorage.setItem("aws_sso_account_id", targetAccountId);
            localStorage.setItem("aws_sso_account_name", creds.accountName);
            localStorage.setItem("aws_sso_role_name", creds.roleName);
            localStorage.setItem("aws_auth_method", "sso-native");

            sessionStorage.removeItem("redirect_after_login");
            console.log("Automatic native SSO login successful. Redirecting directly to bucket.");
            navigate(targetPath);
          } else {
            throw new Error("Missing or expired native SSO credentials/token");
          }
        } catch (err) {
          console.warn(`Automatic native SSO login failed for '${targetProfile}'. Directing to login screen.`, err);
          sessionStorage.removeItem("redirect_after_login");
          navigate("/buckets");
        } finally {
          hideLoading();
        }
      } else {
        try {
          showLoading(t("buckets.profile_login", { profile: targetProfile }));
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
        } finally {
          hideLoading();
        }
      }
      return;
    }

    // Same profile and already authenticated, navigate directly
    navigate(targetPath);
  };

  return { navigateToRoute };
}
