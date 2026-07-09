-- -------------------------------------------------------------
-- Supabase Schema for S3 Portable Explorer
-- Paste this script into the Supabase SQL Editor to set up.
-- -------------------------------------------------------------

-- 1. Profiles Table
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('superadmin', 'admin', 'user')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS on Profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 2. Groups Table
CREATE TABLE public.groups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  owner_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS on Groups
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

-- 3. Group Members Table
CREATE TABLE public.group_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  status TEXT NOT NULL DEFAULT 'approved' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(group_id, user_id)
);

-- Enable RLS on Group Members
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

-- 4. AWS Credentials Table
CREATE TABLE public.aws_credentials (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  access_key_id TEXT NOT NULL,
  secret_access_key TEXT NOT NULL,
  session_token TEXT,
  region TEXT DEFAULT 'us-east-1' NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS on AWS Credentials
ALTER TABLE public.aws_credentials ENABLE ROW LEVEL SECURITY;

-- 5. Routes Table
CREATE TABLE public.routes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  bucket TEXT NOT NULL,
  prefix TEXT NOT NULL,
  region TEXT DEFAULT 'us-east-1' NOT NULL,
  aws_credentials_id UUID REFERENCES public.aws_credentials(id) ON DELETE SET NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS on Routes
ALTER TABLE public.routes ENABLE ROW LEVEL SECURITY;

-- 6. Route Permissions Table
CREATE TABLE public.route_permissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  route_id UUID REFERENCES public.routes(id) ON DELETE CASCADE NOT NULL,
  group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  shared_with_all BOOLEAN DEFAULT false NOT NULL,
  is_approved BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS on Route Permissions
ALTER TABLE public.route_permissions ENABLE ROW LEVEL SECURITY;

-- 7. Access Requests Table
CREATE TABLE public.access_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  route_id UUID REFERENCES public.routes(id) ON DELETE CASCADE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  resolved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  resolved_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS on Access Requests
ALTER TABLE public.access_requests ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- ROW LEVEL SECURITY POLICIES (RECURSION-FREE VIA HELPER FUNCTIONS)
-- ==========================================

-- --- SECURITY DEFINER HELPER FUNCTIONS ---
-- These functions bypass RLS to prevent PostgreSQL policy evaluation recursion loops.

CREATE OR REPLACE FUNCTION public.is_group_member(group_id UUID, user_id UUID)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.group_members gm
    WHERE gm.group_id = $1 AND gm.user_id = $2 AND gm.status = 'approved'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_group_admin(group_id UUID, user_id UUID)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.group_members gm
    WHERE gm.group_id = $1 AND gm.user_id = $2 AND gm.role = 'admin' AND gm.status = 'approved'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_group_owner(group_id UUID, user_id UUID)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.groups g
    WHERE g.id = $1 AND g.owner_id = $2
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_route_owner(route_id UUID, user_id UUID)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.routes r
    WHERE r.id = $1 AND r.created_by = $2
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.has_route_access(route_id UUID, user_id UUID)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.route_permissions rp
    WHERE rp.route_id = $1 AND (
      rp.shared_with_all = true OR
      rp.user_id = $2 OR
      (
        rp.group_id IS NOT NULL AND
        public.is_group_member(rp.group_id, $2)
      )
    )
  ) OR EXISTS (
    SELECT 1 FROM public.access_requests ar
    WHERE ar.route_id = $1 AND ar.user_id = $2
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.has_credential_access(cred_id UUID, user_id UUID)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.routes r
    WHERE r.aws_credentials_id = $1 AND (
      r.created_by = $2 OR
      EXISTS (
        SELECT 1 FROM public.route_permissions rp
        WHERE rp.route_id = r.id AND (
          rp.shared_with_all = true OR
          rp.user_id = $2 OR
          (
            rp.group_id IS NOT NULL AND
            public.is_group_member(rp.group_id, $2)
          )
        )
      ) OR
      EXISTS (
        SELECT 1 FROM public.access_requests ar
        WHERE ar.route_id = r.id AND ar.user_id = $2 AND ar.status = 'approved' AND ar.expires_at > now()
      )
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_route_group_admin(route_id UUID, user_id UUID)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.route_permissions rp
    WHERE rp.route_id = $1 AND rp.group_id IS NOT NULL AND (
      public.is_group_admin(rp.group_id, $2) OR 
      public.is_group_owner(rp.group_id, $2)
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- --- Profiles Policies ---
CREATE POLICY "Profiles are readable by authenticated users" ON public.profiles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can update their own profile details" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id);

-- --- Groups Policies ---
CREATE POLICY "Groups are readable by members and owners" ON public.groups
  FOR SELECT TO authenticated USING (
    owner_id = auth.uid() OR public.is_group_member(id, auth.uid())
  );

CREATE POLICY "Authenticated users can create groups" ON public.groups
  FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Group owners can update/delete their groups" ON public.groups
  FOR ALL TO authenticated USING (owner_id = auth.uid());

-- --- Group Members Policies ---
CREATE POLICY "Group members list is readable by group members" ON public.group_members
  FOR SELECT TO authenticated USING (
    public.is_group_owner(group_id, auth.uid()) OR public.is_group_member(group_id, auth.uid())
  );

CREATE POLICY "Group admins/owners can manage members" ON public.group_members
  FOR ALL TO authenticated USING (
    public.is_group_owner(group_id, auth.uid()) OR public.is_group_admin(group_id, auth.uid())
  );

CREATE POLICY "Users can insert themselves to apply to a group" ON public.group_members
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- --- AWS Credentials Policies ---
CREATE POLICY "Credentials are readable by owner or authorized session members" ON public.aws_credentials
  FOR SELECT TO authenticated USING (
    owner_id = auth.uid() OR public.has_credential_access(id, auth.uid())
  );

CREATE POLICY "Users can manage their own credentials" ON public.aws_credentials
  FOR ALL TO authenticated USING (owner_id = auth.uid());

-- --- Routes Policies ---
CREATE POLICY "Routes are readable by all authenticated users" ON public.routes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can create routes" ON public.routes
  FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update/delete their own routes" ON public.routes
  FOR ALL TO authenticated USING (created_by = auth.uid());

-- --- Route Permissions Policies ---
CREATE POLICY "Route permissions are readable by route owner or shared members" ON public.route_permissions
  FOR SELECT TO authenticated USING (
    public.is_route_owner(route_id, auth.uid()) OR 
    shared_with_all = true OR 
    user_id = auth.uid() OR 
    (group_id IS NOT NULL AND public.is_group_member(group_id, auth.uid()))
  );

CREATE POLICY "Route owners or group admins can manage route permissions" ON public.route_permissions
  FOR ALL TO authenticated USING (
    public.is_route_owner(route_id, auth.uid()) OR 
    (group_id IS NOT NULL AND public.is_group_admin(group_id, auth.uid()))
  );

-- --- Access Requests Policies ---
CREATE POLICY "Users can read their own requests and route owners/admins can read requests for their routes" ON public.access_requests
  FOR SELECT TO authenticated USING (
    user_id = auth.uid() OR 
    public.is_route_owner(route_id, auth.uid()) OR 
    public.is_route_group_admin(route_id, auth.uid())
  );

CREATE POLICY "Authenticated users can create access requests" ON public.access_requests
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "Route creators or group admins can approve/reject requests" ON public.access_requests
  FOR UPDATE TO authenticated USING (
    public.is_route_owner(route_id, auth.uid()) OR 
    public.is_route_group_admin(route_id, auth.uid())
  );

-- ==========================================
-- TRIGGERS AND FUNCTIONS
-- ==========================================

-- Automatically create profile on user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, first_name, last_name, role)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'first_name', ''),
    COALESCE(new.raw_user_meta_data->>'last_name', ''),
    'user'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists, then create it
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Enable Realtime replication
ALTER PUBLICATION supabase_realtime ADD TABLE public.access_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.routes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.route_permissions;
