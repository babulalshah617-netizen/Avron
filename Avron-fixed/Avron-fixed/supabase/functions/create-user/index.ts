import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const respond = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

    // Guard: check required env vars are present
    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      console.error("create-user: Missing required environment variables", {
        hasUrl: !!supabaseUrl,
        hasServiceKey: !!serviceRoleKey,
        hasAnonKey: !!anonKey,
      });
      return respond({ error: "Server configuration error. Please contact the IT team." }, 500);
    }

    // Verify requesting user's session
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return respond({ error: "Unauthorized: No authorization header provided." }, 401);
    }

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: callerUser }, error: callerErr } = await callerClient.auth.getUser();
    if (callerErr || !callerUser) {
      console.error("create-user: Caller auth failed", callerErr?.message);
      return respond({ error: "Unauthorized: Invalid or expired session." }, 401);
    }

    // Use admin client for all subsequent operations
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Verify caller's role
    const { data: callerProfile, error: profileErr } = await adminClient
      .from("profiles")
      .select("role, full_name")
      .eq("id", callerUser.id)
      .maybeSingle();

    if (profileErr) {
      console.error("create-user: Failed to fetch caller profile", profileErr.message);
      return respond({ error: "Failed to verify permissions. Please try again." }, 500);
    }

    if (!callerProfile || !["super_admin", "md"].includes(callerProfile.role)) {
      return respond({
        error: `Forbidden: You must be a Super Admin or Medical Director to create users. Current role: ${callerProfile?.role ?? "unknown"}`,
      }, 403);
    }

    // Parse and validate request body
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return respond({ error: "Invalid request body: JSON expected." }, 400);
    }

    const { email, password, full_name, role, employee_id, department_id, phone } = body as {
      email?: string; password?: string; full_name?: string; role?: string;
      employee_id?: string; department_id?: string; phone?: string;
    };

    if (!email || !password || !full_name || !role) {
      return respond({ error: "Missing required fields: email, password, full_name, role." }, 400);
    }

    // Role-specific restrictions
    if (role === "md" && callerProfile.role !== "md") {
      return respond({ error: "Only a Medical Director can create another MD account." }, 403);
    }

    // Valid hospital roles
    const VALID_ROLES = [
      "super_admin", "md", "department_head", "floor_supervisor",
      "staff", "it_team", "maintenance_team", "biomedical_team",
    ];
    if (!VALID_ROLES.includes(role)) {
      return respond({ error: `Invalid role: "${role}". Must be one of: ${VALID_ROLES.join(", ")}.` }, 400);
    }

    // Create auth user via Admin API
    const { data: newUserData, error: createErr } = await adminClient.auth.admin.createUser({
      email: (email as string).trim().toLowerCase(),
      password: password as string,
      email_confirm: true,
      user_metadata: {
        full_name: (full_name as string).trim(),
        role,
      },
    });

    if (createErr) {
      console.error("create-user: auth.admin.createUser failed", {
        message: createErr.message,
        email,
        role,
        calledBy: callerProfile.full_name,
      });

      if (
        createErr.message.includes("already registered") ||
        createErr.message.includes("already exists") ||
        createErr.message.includes("already been registered")
      ) {
        return respond({ error: "An account with this email address already exists." }, 409);
      }

      return respond({ error: `Failed to create account: ${createErr.message}` }, 400);
    }

    if (!newUserData?.user) {
      return respond({ error: "User creation returned no data. Please try again." }, 500);
    }

    const newUserId = newUserData.user.id;

    // The handle_new_user trigger creates a basic profile automatically.
    // Update it with the full details provided.
    const updatePayload: Record<string, unknown> = {
      full_name: (full_name as string).trim(),
      role,
      employee_id: employee_id?.trim() || null,
      department_id: department_id || null,
      phone: (phone as string | undefined)?.trim() || null,
      is_active: true,
    };

    // Retry update a couple of times — trigger may not have run yet
    let profileErr2: { message: string } | null = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      if (attempt > 1) await new Promise(r => setTimeout(r, attempt * 200));

      const { error } = await adminClient
        .from("profiles")
        .update(updatePayload)
        .eq("id", newUserId);

      profileErr2 = error;
      if (!error) break;
    }

    if (profileErr2) {
      // User was created but profile update failed — upsert as last resort
      console.error("create-user: profile update failed after retries, attempting upsert", profileErr2.message);
      const { error: upsertErr } = await adminClient
        .from("profiles")
        .upsert({ id: newUserId, ...updatePayload }, { onConflict: "id" });

      if (upsertErr) {
        console.error("create-user: profile upsert also failed", upsertErr.message, { userId: newUserId });
        // Don't return error to client — user was created. The profile trigger will have run.
      }
    }

    // Log the action
    await adminClient.from("audit_logs").insert({
      user_id: callerUser.id,
      action: "create",
      entity_type: "user",
      entity_id: newUserId,
      details: {
        name: (full_name as string).trim(),
        email: (email as string).trim().toLowerCase(),
        role,
        created_by: callerProfile.full_name,
        created_by_role: callerProfile.role,
      },
    });

    return respond({
      user: { id: newUserId, email: newUserData.user.email },
      message: `User "${(full_name as string).trim()}" created successfully.`,
    });

  } catch (err) {
    console.error("create-user: Unhandled error", String(err));
    return respond({
      error: "An unexpected server error occurred. Please check the Edge Function logs.",
    }, 500);
  }
});
