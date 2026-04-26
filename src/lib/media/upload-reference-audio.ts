import { buildMediaUploadUrl } from "@/components/notes/media-auth";

interface UploadMediaPayload {
  error?: string;
  data?: {
    files?: string[];
  };
  file?: {
    key?: string;
    size?: number;
    contentType?: string;
  };
}

export interface UploadedReferenceAudio {
  key: string;
  url: string;
  size: number;
  contentType: string;
  originalFilename: string;
}

export async function uploadReferenceAudioFile(
  file: File,
  accessToken: string
): Promise<UploadedReferenceAudio> {
  const formData = new FormData();
  formData.append("mediaKind", "audio");
  formData.append("files[0]", file);

  const response = await fetch(buildMediaUploadUrl(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: formData,
  });

  const payload = (await response.json()) as UploadMediaPayload;
  if (!response.ok) {
    throw new Error(payload.error || "Audio upload failed.");
  }

  const key = payload.file?.key;
  const url = payload.data?.files?.[0];
  if (!key || !url) {
    throw new Error("Audio upload completed without a media URL.");
  }

  return {
    key,
    url,
    size: payload.file?.size ?? file.size,
    contentType: payload.file?.contentType || file.type || "audio/mpeg",
    originalFilename: file.name,
  };
}
