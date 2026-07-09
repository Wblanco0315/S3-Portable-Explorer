import { create } from "zustand";
import { supabase } from "./supabaseClient";
import { Session, User, RealtimeChannel } from "@supabase/supabase-js";
import { isPermissionGranted, requestPermission, sendNotification } from "@tauri-apps/plugin-notification";
import { clearAwsCredentials, getActiveAwsCredentials } from "../aws/s3Client";

// --- Types ---
export interface Profile {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: 'superadmin' | 'admin' | 'user';
  created_at: string;
}

export interface Group {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
  owner?: Profile;
}

export interface GroupMember {
  id: string;
  group_id: string;
  user_id: string;
  role: 'admin' | 'member';
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  profiles?: Profile;
}

export interface AwsCredential {
  id: string;
  owner_id: string;
  name: string;
  access_key_id: string;
  secret_access_key: string;
  session_token?: string;
  region: string;
  created_at: string;
}

export interface CloudRoute {
  id: string;
  name: string;
  bucket: string;
  prefix: string;
  region: string;
  aws_credentials_id: string | null;
  created_by: string;
  created_at: string;
  aws_credentials?: AwsCredential | null;
  profiles?: Profile;
}

export interface AccessRequest {
  id: string;
  user_id: string;
  route_id: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  expires_at: string;
  created_at: string;
  profiles?: Profile;
  routes?: CloudRoute;
}

interface SupabaseState {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  isOnline: boolean;
  groups: Group[];
  groupMembers: Record<string, GroupMember[]>; // groupId -> members
  routes: CloudRoute[];
  credentials: AwsCredential[];
  accessRequests: AccessRequest[]; // Incoming and Outgoing combined
  isLoading: boolean;
  error: string | null;
  realtimeChannel: RealtimeChannel | null;

  // Actions
  init: () => Promise<void>;
  signUp: (email: string, password: string, firstName: string, lastName: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  
  fetchProfile: () => Promise<void>;
  fetchGroups: () => Promise<void>;
  createGroup: (name: string) => Promise<void>;
  fetchGroupMembers: (groupId: string) => Promise<void>;
  addMemberToGroup: (groupId: string, email: string, role?: 'admin' | 'member') => Promise<void>;
  updateMemberStatus: (groupId: string, memberId: string, status: 'approved' | 'rejected') => Promise<void>;
  updateMemberRole: (groupId: string, memberId: string, role: 'admin' | 'member') => Promise<void>;
  removeMemberFromGroup: (groupId: string, userId: string) => Promise<void>;

  fetchCredentials: () => Promise<void>;
  createCredentials: (name: string, accessKey: string, secretKey: string, token: string, region: string) => Promise<void>;
  deleteCredentials: (id: string) => Promise<void>;

  fetchRoutes: () => Promise<void>;
  syncLocalCredentialsToCloud: () => Promise<string | null>;
  createRoute: (name: string, bucket: string, prefix: string, region: string, credId: string | null) => Promise<CloudRoute | null>;
  shareRouteWithGroup: (routeId: string, groupId: string) => Promise<void>;
  unshareRouteWithGroup: (routeId: string, groupId: string) => Promise<void>;
  shareRouteWithAll: (routeId: string) => Promise<void>;
  deleteRoute: (id: string) => Promise<void>;

  fetchAccessRequests: () => Promise<void>;
  createAccessRequest: (routeId: string) => Promise<AccessRequest | null>;
  closeAccessRequest: (requestId: string) => Promise<void>;
  approveAccessRequest: (requestId: string) => Promise<void>;
  rejectAccessRequest: (requestId: string) => Promise<void>;
  
  subscribeToAccessRequests: () => void;
  unsubscribeFromAccessRequests: () => void;
}

// --- Native Notification Helper ---
async function triggerDesktopNotification(title: string, body: string) {
  try {
    let allowed = await isPermissionGranted();
    if (!allowed) {
      const permission = await requestPermission();
      allowed = permission === "granted";
    }
    if (allowed) {
      sendNotification({ title, body });
    }
  } catch (err) {
    console.error("[DesktopNotification] Error triggering alert:", err);
  }
}

export const useSupabaseStore = create<SupabaseState>((set, get) => ({
  session: null,
  user: null,
  profile: null,
  isOnline: false,
  groups: [],
  groupMembers: {},
  routes: [],
  credentials: [],
  accessRequests: [],
  isLoading: false,
  error: null,
  realtimeChannel: null,

  init: async () => {
    set({ isLoading: true });
    // 1. Get initial session
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session) {
      set({ session, user: session.user, isOnline: true });
      
      // Load user profile
      const { data: profile, error: pErr } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .single();

      if (!pErr && profile) {
        set({ profile });
      }

      // Load all data
      await get().fetchGroups();
      await get().fetchCredentials();
      await get().fetchRoutes();
      await get().fetchAccessRequests();
      
      // Start Realtime listener
      get().subscribeToAccessRequests();
    } else {
      set({ session: null, user: null, profile: null, isOnline: false });
    }

    set({ isLoading: false });

    // 2. Listen to Auth changes
    supabase.auth.onAuthStateChange(async (event, newSession) => {
      console.log("[SupabaseAuth] Auth state change:", event);
      if (newSession) {
        set({ session: newSession, user: newSession.user, isOnline: true });
        
        const { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", newSession.user.id)
          .single();
        
        if (profile) {
          set({ profile });
        }
        
        await get().fetchGroups();
        await get().fetchCredentials();
        await get().fetchRoutes();
        await get().fetchAccessRequests();
        
        get().subscribeToAccessRequests();
      } else {
        // Clear all states
        get().unsubscribeFromAccessRequests();
        clearAwsCredentials();
        localStorage.removeItem("aws_auth_method");
        localStorage.removeItem("cloud_route_name");
        set({
          session: null,
          user: null,
          profile: null,
          isOnline: false,
          groups: [],
          groupMembers: {},
          routes: [],
          credentials: [],
          accessRequests: [],
          error: null
        });
      }
    });
  },

  signUp: async (email, password, firstName, lastName) => {
    set({ isLoading: true, error: null });
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: firstName,
          last_name: lastName
        }
      }
    });

    if (error) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
    set({ isLoading: false });
  },

  signIn: async (email, password) => {
    set({ isLoading: true, error: null });
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
    set({ isLoading: false });
  },

  resetPassword: async (email) => {
    set({ isLoading: true, error: null });
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
    set({ isLoading: false });
  },

  signOut: async () => {
    set({ isLoading: true });
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("[SupabaseAuth] Signout error:", error);
    }
    set({ isLoading: false });
  },

  fetchProfile: async () => {
    const user = get().user;
    if (!user) return;
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();
    if (!error && data) {
      set({ profile: data });
    }
  },

  fetchGroups: async () => {
    const user = get().user;
    if (!user) return;
    set({ error: null });

    const { data, error } = await supabase
      .from("groups")
      .select(`
        *,
        owner:profiles!groups_owner_id_fkey(*)
      `);

    if (error) {
      set({ error: error.message });
      return;
    }

    set({ groups: data || [] });
  },

  createGroup: async (name) => {
    const user = get().user;
    if (!user) return;
    set({ isLoading: true, error: null });

    const { data: newGroup, error: gError } = await supabase
      .from("groups")
      .insert({ name, owner_id: user.id })
      .select()
      .single();

    if (gError) {
      set({ error: gError.message, isLoading: false });
      return;
    }

    // Auto add owner as admin member
    const { error: mError } = await supabase
      .from("group_members")
      .insert({
        group_id: newGroup.id,
        user_id: user.id,
        role: "admin",
        status: "approved"
      });

    if (mError) {
      console.error("[SupabaseGroups] Owner membership insert failed:", mError);
    }

    await get().fetchGroups();
    set({ isLoading: false });
  },

  fetchGroupMembers: async (groupId) => {
    const { data, error } = await supabase
      .from("group_members")
      .select(`
        *,
        profiles!group_members_user_id_fkey(*)
      `)
      .eq("group_id", groupId);

    if (!error && data) {
      set((state) => ({
        groupMembers: {
          ...state.groupMembers,
          [groupId]: data
        }
      }));
    }
  },

  addMemberToGroup: async (groupId, email, role = "member") => {
    set({ isLoading: true, error: null });

    // 1. Find profile by email
    const { data: targetProfile, error: pError } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (pError || !targetProfile) {
      set({ error: "User profile with this email not found.", isLoading: false });
      return;
    }

    // 2. Insert group member
    const { error: mError } = await supabase
      .from("group_members")
      .insert({
        group_id: groupId,
        user_id: targetProfile.id,
        role,
        status: "approved" // added directly by admin/owner
      });

    if (mError) {
      set({ error: mError.message, isLoading: false });
      return;
    }

    await get().fetchGroupMembers(groupId);
    set({ isLoading: false });
  },

  updateMemberStatus: async (groupId, memberId, status) => {
    set({ isLoading: true });
    const { error } = await supabase
      .from("group_members")
      .update({ status })
      .eq("id", memberId);

    if (error) {
      set({ error: error.message });
    } else {
      await get().fetchGroupMembers(groupId);
    }
    set({ isLoading: false });
  },

  updateMemberRole: async (groupId, memberId, role) => {
    set({ isLoading: true });
    const { error } = await supabase
      .from("group_members")
      .update({ role })
      .eq("id", memberId);

    if (error) {
      set({ error: error.message });
    } else {
      await get().fetchGroupMembers(groupId);
    }
    set({ isLoading: false });
  },

  removeMemberFromGroup: async (groupId, userId) => {
    set({ isLoading: true });
    const { error } = await supabase
      .from("group_members")
      .delete()
      .eq("group_id", groupId)
      .eq("user_id", userId);

    if (error) {
      set({ error: error.message });
    } else {
      await get().fetchGroupMembers(groupId);
    }
    set({ isLoading: false });
  },

  fetchCredentials: async () => {
    const user = get().user;
    if (!user) return;
    const { data, error } = await supabase
      .from("aws_credentials")
      .select("*")
      .eq("owner_id", user.id);
    if (!error && data) {
      set({ credentials: data });
    }
  },

  createCredentials: async (name, accessKey, secretKey, token, region) => {
    const user = get().user;
    if (!user) return;
    set({ isLoading: true, error: null });

    const { error } = await supabase
      .from("aws_credentials")
      .insert({
        owner_id: user.id,
        name,
        access_key_id: accessKey,
        secret_access_key: secretKey,
        session_token: token || null,
        region: region || "us-east-1"
      });

    if (error) {
      set({ error: error.message, isLoading: false });
      return;
    }

    await get().fetchCredentials();
    set({ isLoading: false });
  },

  deleteCredentials: async (id) => {
    set({ isLoading: true });
    const { error } = await supabase
      .from("aws_credentials")
      .delete()
      .eq("id", id);
    if (error) {
      set({ error: error.message });
    } else {
      await get().fetchCredentials();
    }
    set({ isLoading: false });
  },

  fetchRoutes: async () => {
    const user = get().user;
    if (!user) return;
    set({ error: null });

    // Fetch routes and their linked credentials (if visible by policy)
    const { data, error } = await supabase
      .from("routes")
      .select(`
        *,
        aws_credentials(*),
        profiles!routes_created_by_fkey(*)
      `);

    if (error) {
      set({ error: error.message });
      return;
    }

    set({ routes: data || [] });
  },

  syncLocalCredentialsToCloud: async () => {
    const user = get().user;
    if (!user) return null;

    const activeCreds = getActiveAwsCredentials();
    if (!activeCreds) return null;

    // Check if these credentials (by access_key_id) already exist in Supabase for this user
    const { data: existing, error: fetchErr } = await supabase
      .from("aws_credentials")
      .select("id")
      .eq("owner_id", user.id)
      .eq("access_key_id", activeCreds.accessKeyId)
      .maybeSingle();

    if (!fetchErr && existing) {
      return existing.id;
    }

    // Otherwise, insert them
    const profileName = localStorage.getItem("aws_sso_profile") || "default";
    const name = `Local Creds (${profileName})`;

    const { data: newCred, error: insertErr } = await supabase
      .from("aws_credentials")
      .insert({
        owner_id: user.id,
        name,
        access_key_id: activeCreds.accessKeyId,
        secret_access_key: activeCreds.secretAccessKey,
        session_token: activeCreds.sessionToken || null,
        region: activeCreds.region
      })
      .select()
      .single();

    if (insertErr || !newCred) {
      console.error("Failed to auto-upload credentials to cloud:", insertErr);
      return null;
    }

    await get().fetchCredentials();
    return newCred.id;
  },

  createRoute: async (name, bucket, prefix, region, credId) => {
    const user = get().user;
    if (!user) return null;
    set({ isLoading: true, error: null });

    let finalCredId = credId;

    // Auto-sync local credentials if no credId is provided and user is admin
    const profile = get().profile;
    const isAdmin = profile?.role === "admin" || profile?.role === "superadmin";
    if (!finalCredId && isAdmin) {
      finalCredId = await get().syncLocalCredentialsToCloud();
    }

    const { data, error } = await supabase
      .from("routes")
      .insert({
        name,
        bucket,
        prefix,
        region,
        aws_credentials_id: finalCredId,
        created_by: user.id
      })
      .select()
      .single();

    if (error) {
      set({ error: error.message, isLoading: false });
      return null;
    }

    await get().fetchRoutes();
    set({ isLoading: false });
    return data;
  },

  shareRouteWithGroup: async (routeId, groupId) => {
    set({ isLoading: true, error: null });
    const { error } = await supabase
      .from("route_permissions")
      .insert({
        route_id: routeId,
        group_id: groupId,
        shared_with_all: false
      });
    if (error) {
      set({ error: error.message });
    }
    set({ isLoading: false });
  },

  unshareRouteWithGroup: async (routeId, groupId) => {
    set({ isLoading: true, error: null });
    const { error } = await supabase
      .from("route_permissions")
      .delete()
      .eq("route_id", routeId)
      .eq("group_id", groupId);
    if (error) {
      set({ error: error.message });
    }
    set({ isLoading: false });
  },

  shareRouteWithAll: async (routeId) => {
    set({ isLoading: true, error: null });
    const { error } = await supabase
      .from("route_permissions")
      .insert({
        route_id: routeId,
        shared_with_all: true
      });
    if (error) {
      set({ error: error.message });
    }
    set({ isLoading: false });
  },

  deleteRoute: async (id) => {
    set({ isLoading: true });
    const { error } = await supabase
      .from("routes")
      .delete()
      .eq("id", id);
    if (error) {
      set({ error: error.message });
    } else {
      await get().fetchRoutes();
    }
    set({ isLoading: false });
  },

  fetchAccessRequests: async () => {
    const user = get().user;
    if (!user) return;

    const { data, error } = await supabase
      .from("access_requests")
      .select(`
        *,
        profiles!access_requests_user_id_fkey(*),
        routes(*)
      `)
      .order("created_at", { ascending: false });

    if (!error && data) {
      set({ accessRequests: data });
    }
  },

  createAccessRequest: async (routeId) => {
    const user = get().user;
    if (!user) return null;
    set({ error: null });

    // Expiration date (10 minutes from now)
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from("access_requests")
      .insert({
        user_id: user.id,
        route_id: routeId,
        expires_at: expiresAt,
        status: "pending"
      })
      .select()
      .single();

    if (error) {
      set({ error: error.message });
      return null;
    }

    await get().fetchAccessRequests();
    return data;
  },

  closeAccessRequest: async (requestId) => {
    const { error } = await supabase
      .from("access_requests")
      .update({ status: "expired" })
      .eq("id", requestId);

    if (!error) {
      await get().fetchAccessRequests();
    }
  },

  approveAccessRequest: async (requestId) => {
    const user = get().user;
    if (!user) return;
    set({ error: null });

    const { error } = await supabase
      .from("access_requests")
      .update({
        status: "approved",
        resolved_by: user.id,
        resolved_at: new Date().toISOString()
      })
      .eq("id", requestId);

    if (error) {
      set({ error: error.message });
    } else {
      await get().fetchAccessRequests();
    }
  },

  rejectAccessRequest: async (requestId) => {
    const user = get().user;
    if (!user) return;
    set({ error: null });

    const { error } = await supabase
      .from("access_requests")
      .update({
        status: "rejected",
        resolved_by: user.id,
        resolved_at: new Date().toISOString()
      })
      .eq("id", requestId);

    if (error) {
      set({ error: error.message });
    } else {
      await get().fetchAccessRequests();
    }
  },

  subscribeToAccessRequests: () => {
    const user = get().user;
    if (!user) return;

    // Unsubscribe from any active channel first
    get().unsubscribeFromAccessRequests();

    console.log("[SupabaseRealtime] Subscribing to access_requests...");

    const channel = supabase
      .channel("access_requests_changes")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "access_requests" },
        async (payload) => {
          console.log("[SupabaseRealtime] New access request received:", payload);
          await get().fetchAccessRequests();

          const newReq = payload.new as AccessRequest;
          
          // Verify if this new request is for a route owned by the current user
          const ownedRoutes = get().routes.filter(r => r.created_by === user.id);
          const isForOwnedRoute = ownedRoutes.some(r => r.id === newReq.route_id);

          if (isForOwnedRoute && newReq.user_id !== user.id) {
            // Fetch requesting user email for notification
            const { data: requestor } = await supabase
              .from("profiles")
              .select("email, first_name, last_name")
              .eq("id", newReq.user_id)
              .single();

            const name = requestor 
              ? `${requestor.first_name} ${requestor.last_name}`.trim() || requestor.email
              : "Un usuario";

            const route = ownedRoutes.find(r => r.id === newReq.route_id);
            const routeName = route ? route.name : "una ruta S3";

            triggerDesktopNotification(
              "Solicitud de Acceso S3",
              `${name} solicita autorización para ingresar a '${routeName}'.`
            );
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "access_requests" },
        async (payload) => {
          console.log("[SupabaseRealtime] Access request updated:", payload);
          await get().fetchAccessRequests();

          const updatedReq = payload.new as AccessRequest;
          
          // If the update is for a request created by the current user
          if (updatedReq.user_id === user.id) {
            const route = get().routes.find(r => r.id === updatedReq.route_id);
            const routeName = route ? route.name : "tu ruta S3";

            if (updatedReq.status === "approved") {
              triggerDesktopNotification(
                "Solicitud Aprobada",
                `Tu solicitud para entrar a '${routeName}' ha sido aprobada por el administrador.`
              );
            } else if (updatedReq.status === "rejected") {
              triggerDesktopNotification(
                "Solicitud Rechazada",
                `Tu solicitud para entrar a '${routeName}' fue rechazada por el administrador.`
              );
            }
          }
        }
      )
      .subscribe();

    set({ realtimeChannel: channel });
  },

  unsubscribeFromAccessRequests: () => {
    const channel = get().realtimeChannel;
    if (channel) {
      console.log("[SupabaseRealtime] Unsubscribing from access_requests...");
      supabase.removeChannel(channel);
      set({ realtimeChannel: null });
    }
  }
}));
