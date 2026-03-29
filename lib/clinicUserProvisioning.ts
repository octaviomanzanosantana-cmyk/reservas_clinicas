import "server-only";

import { sendClinicAccessRecoveryEmail } from "@/lib/clinicAccessEmails";
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

async function getClinicMembershipForClinic(clinicId: string) {
  const { data, error } = await supabaseAdmin
    .from("clinic_users")
    .select("clinic_id, user_id, role")
    .eq("clinic_id", clinicId)
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

async function inviteClinicUser(input: {
  email: string;
  clinicId: string;
  clinicSlug: string;
}) {
  const redirectTo = getRecoveryRedirectTo();
  const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(
    input.email,
    {
      data: {
        clinic_id: input.clinicId,
        clinic_slug: input.clinicSlug,
        source: "create-clinic-user-api",
      },
      redirectTo,
    },
  );

  if (error || !data.user) {
    throw new ClinicUserProvisioningError(
      error?.message ?? "Could not invite auth user",
    );
  }

  return {
    user: data.user,
    redirectTo,
  };
}

async function sendPasswordSetupEmail(email: string, clinicName: string) {
  const redirectTo = getRecoveryRedirectTo();
  const { data, error } = await supabaseAdmin.auth.admin.generateLink({
    type: "recovery",
    email,
    options: {
      redirectTo,
    },
  });

  if (error) {
    throw new ClinicUserProvisioningError(error.message);
  }

  const actionLink = data.properties?.action_link?.trim();
  if (!actionLink) {
    throw new ClinicUserProvisioningError("Could not generate recovery link");
  }

  try {
    await sendClinicAccessRecoveryEmail({
      to: email,
      clinicName,
      resetLink: actionLink,
    });
  } catch (error) {
    throw new ClinicUserProvisioningError(
      error instanceof Error
        ? error.message
        : "Could not send recovery email",
    );
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
  let recoveryRedirectTo = getRecoveryRedirectTo();
  const clinicMembership = await getClinicMembershipForClinic(clinic.id);

  if (clinicMembership) {
    if (!authUser || clinicMembership.user_id !== authUser.id) {
      throw new ClinicUserProvisioningError(
        "Clinic already has an owner user linked",
        409,
        {
          clinic_id: clinic.id,
          linked_user_id: clinicMembership.user_id,
        },
      );
    }
  }

  if (!authUser) {
    const inviteResult = await inviteClinicUser({
      email,
      clinicId: clinic.id,
      clinicSlug: clinic.slug,
    });

    authUser = inviteResult.user;
    userCreated = true;
    recoveryRedirectTo = inviteResult.redirectTo;
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

  if (!membership && !clinicMembership) {
    await createClinicMembership(clinic.id, authUser.id);
    clinicLinkCreated = true;
  }

  if (!userCreated) {
    recoveryRedirectTo = await sendPasswordSetupEmail(email, clinic.name);
  }

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
