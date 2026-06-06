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

    if (currentProfile && currentProfile !== targetProfile) {
      console.log(`Profile mismatch: current active is '${currentProfile}', target is '${targetProfile}'. Resetting session...`);
      
      // 1. Log out from the current profile session
      clearAwsCredentials();
      localStorage.removeItem("aws_sso_profile");
      localStorage.removeItem("aws_auth_method");

      // 2. Set the target profile variables
      localStorage.setItem("aws_sso_profile", targetProfile);
      localStorage.setItem("aws_auth_method", "sso");

      // 3. Save target route to session storage to navigate to after authentication
      sessionStorage.setItem("redirect_after_login", targetPath);

      // 4. Try automatic login for the target profile
      try {
        console.log(`Attempting automatic login for target profile: '${targetProfile}'`);
        const creds = await getLocalSSOCredentials(targetProfile);
        setAwsCredentials(
          creds.accessKeyId,
          creds.secretAccessKey,
          creds.sessionToken,
          localStorage.getItem("aws_region") || "us-east-1"
        );
        // Clean pending redirection since we authenticated automatically
        sessionStorage.removeItem("redirect_after_login");
        console.log("Automatic login successful. Redirecting directly to bucket.");
        navigate(targetPath);
      } catch (err) {
        console.warn(`Automatic login failed for '${targetProfile}' (token probably expired/invalid). Directing to login screen.`, err);
        // Redirect to /buckets which will trigger manual login flow and pre-select targetProfile
        navigate("/buckets");
      }
      return;
    }

    // Same profile, but not authenticated
    if (!isAwsAuthenticated()) {
      localStorage.setItem("aws_sso_profile", targetProfile);
      localStorage.setItem("aws_auth_method", "sso");
      sessionStorage.setItem("redirect_after_login", targetPath);

      // Try automatic login
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
        console.warn(`Automatic login failed for '${targetProfile}'. Navigating to login screen.`);
        navigate("/buckets");
      }
      return;
    }

    // Same profile and already authenticated, navigate directly
    navigate(targetPath);
  };

  return { navigateToRoute };
}
