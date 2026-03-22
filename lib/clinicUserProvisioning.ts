import "server-only";

import { getClinicById } from "@/lib/clinics";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type ClinicUserRow = {
  clinic_id: string;
  user_id: string;
  role: string;
};

const DEFAULT_APP_URL = "https://app.appoclick.com";

export class ClinicUserProvisioningError extends Error {
  status: number;
  details?: Record<string, unknown>;

  constructor(message: string, status = 500, details?: Record<string, unknown>) {
    super(message);
    this.name = "ClinicUserProvisioningError";
    this.status = status;
    this.details = details;
  }
}

function getRecoveryRedirectTo() {
  const appUrl =
    process.env.APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    DEFAULT_APP_URL;

  return `${appUrl.replace(/\/+$/, "")}/reset-password`;
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

async function findAuthUserByEmail(email: string) {
  let page = 1;
  const perPage = 200;

  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) {
      throw new ClinicUserProvisioningError(error.message);
    }

    const existingUser =
      data.users.find((user) => user.email?.trim().toLowerCase() === email) ??
      null;

    if (existingUser) {
      return existingUser;
    }

    if (data.users.length < perPage) {
      return null;
    }

    page += 1;
  }
}

async function getClinicMembershipForUser(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("clinic_users")
    .select("clinic_id, user_id, role")
    .eq("user_id", userId)
    .maybeSingle<ClinicUserRow>();

  if (error) {
    throw new ClinicUserProvisioningError(error.message);
  }

  return data ?? null;
}

async function createClinicMembership(clinicId: string, userId: string) {
  const { error } = await supabaseAdmin.from("clinic_users").insert({
    clinic_id: clinicId,
    user_id: userId,
    role: "owner",
  });

  if (error) {
    throw new ClinicUserProvisioningError(error.message);
  }
}

async function sendPasswordSetupEmail(email: string) {
  const redirectTo = getRecoveryRedirectTo();
  const { error } = await supabaseAdmin.auth.resetPasswordForEmail(email, {
    redirectTo,
  });

  if (error) {
    throw new ClinicUserProvisioningError(error.message);
  }

  return redirectTo;
}

export async function provisionClinicUserAccess(input: {
  email: string;
  clinicId: string;
}) {
  const email = normalizeEmail(input.email);
  const clinicId = input.clinicId.trim();

  if (!email) {
    throw new ClinicUserProvisioningError("email is required", 400);
  }

  if (!clinicId) {
    throw new ClinicUserProvisioningError("clinic_id is required", 400);
  }

  const clinic = await getClinicById(clinicId);
  if (!clinic) {
    throw new ClinicUserProvisioningError("Clinic not found", 404);
  }

  let authUser = await findAuthUserByEmail(email);
  let userCreated = false;

  if (!authUser) {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: {
        clinic_id: clinic.id,
        clinic_slug: clinic.slug,
        source: "create-clinic-user-api",
      },
    });

    if (error || !data.user) {
      throw new ClinicUserProvisioningError(
        error?.message ?? "Could not create auth user",
      );
    }

    authUser = data.user;
    userCreated = true;
  }

  const membership = await getClinicMembershipForUser(authUser.id);
  let clinicLinkCreated = false;

  if (membership && membership.clinic_id !== clinic.id) {
    throw new ClinicUserProvisioningError(
      "User is already linked to another clinic",
      409,
      {
        user_id: authUser.id,
        linked_clinic_id: membership.clinic_id,
      },
    );
  }

  if (!membership) {
    await createClinicMembership(clinic.id, authUser.id);
    clinicLinkCreated = true;
  }

  const recoveryRedirectTo = await sendPasswordSetupEmail(email);

  return {
    userId: authUser.id,
    email,
    clinicId: clinic.id,
    clinicSlug: clinic.slug,
    userCreated,
    clinicLinkCreated,
    recoveryEmailSent: true,
    recoveryRedirectTo,
  };
}
