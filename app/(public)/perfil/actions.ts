"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/data-access/supabase-server-client";
import { getCurrentUserProfile } from "@/lib/data-access/userProfile";

export interface UpdateProfileState {
  error?: string;
  success?: boolean;
}

const MAX_AVATAR_BYTES = 3 * 1024 * 1024; // 3 MB

export async function updateProfile(
  _prevState: UpdateProfileState | undefined,
  formData: FormData,
): Promise<UpdateProfileState> {
  const client = await createSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return { error: "Tu sesión expiró — vuelve a ingresar." };

  const profile = await getCurrentUserProfile(client);
  if (!profile) return { error: "No encontramos tu perfil." };

  const fullName = String(formData.get("fullName") ?? "").trim();
  const companyName = String(formData.get("companyName") ?? "").trim();
  if (!fullName) return { error: "El nombre no puede quedar vacío." };

  const patch: Record<string, string> = { full_name: fullName, company_name: companyName };

  const avatarFile = formData.get("avatar");
  if (avatarFile instanceof File && avatarFile.size > 0) {
    if (avatarFile.size > MAX_AVATAR_BYTES) {
      return { error: "La foto no puede pesar más de 3 MB." };
    }
    const ext = avatarFile.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${user.id}/avatar-${Date.now()}.${ext}`;

    const { error: uploadError } = await client.storage.from("avatars").upload(path, avatarFile, {
      contentType: avatarFile.type || undefined,
      upsert: true,
    });
    if (uploadError) {
      return { error: `No pudimos subir la foto: ${uploadError.message}` };
    }

    const { data: publicUrl } = client.storage.from("avatars").getPublicUrl(path);
    patch.avatar_url = publicUrl.publicUrl;
  }

  const { error: updateError } = await client.from("user_profile").update(patch).eq("id", profile.id);
  if (updateError) {
    return { error: `No pudimos guardar los cambios: ${updateError.message}` };
  }

  revalidatePath("/", "layout");
  return { success: true };
}
