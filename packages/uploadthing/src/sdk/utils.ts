import type { Json } from "@uploadthing/shared";
import {
  generateUploadThingURL,
  pollForFileData,
  UploadThingError,
} from "@uploadthing/shared";

export type FileEsque = Blob & { name: string };

export const uploadFilesInternal = async (
  data: {
    files: FileEsque[];
    metadata: Json;
  },
  opts: {
    apiKey: string;
    utVersion: string;
  },
) => {
  // Request presigned URLs for each file
  const fileData = data.files.map((file) => ({
    name: file.name,
    type: file.type,
    size: file.size,
  }));
  const res = await fetch(generateUploadThingURL("/api/uploadFiles"), {
    method: "POST",
    headers: {
      "x-uploadthing-api-key": opts.apiKey,
      "x-uploadthing-version": opts.utVersion,
    },
    cache: "no-store",
    body: JSON.stringify({
      files: fileData,
      metadata: data.metadata,
    }),
  });

  const json = (await res.json()) as
    | {
        data: {
          presignedUrl: string; // url to post to
          fields: Record<string, string>;
          key: string;
          fileUrl: string; // the final url of the file after upload
        }[];
      }
    | { error: string };

  if (!res.ok || "error" in json) {
    throw UploadThingError.fromResponse(res);
  }

  // Upload each file to S3
  const uploads = await Promise.allSettled(
    data.files.map(async (file, i) => {
      const { presignedUrl, fields, key, fileUrl } = json.data[i];

      if (!presignedUrl || !fields) {
        throw new UploadThingError({
          code: "URL_GENERATION_FAILED",
          message: "Failed to generate presigned URL",
          cause: JSON.stringify(json.data[i]),
        });
      }

      const formData = new FormData();
      formData.append("Content-Type", file.type);
      Object.entries(fields).forEach(([key, value]) => {
        formData.append(key, value);
      });
      formData.append("file", file);

      // Do S3 upload
      const s3res = await fetch(presignedUrl, {
        method: "POST",
        body: formData,
        headers: new Headers({
          Accept: "application/xml",
        }),
      });

      if (!s3res.ok) {
        throw new UploadThingError({
          code: "UPLOAD_FAILED",
          message: "Failed to upload file to storage provider",
          cause: s3res,
        });
      }

      // Poll for file to be available
      await pollForFileData(key);

      return {
        key,
        url: fileUrl,
      };
    }),
  );

  return uploads.map((upload) => {
    if (upload.status === "fulfilled") {
      return { data: upload.value, error: null };
    }
    return {
      data: null,
      error: UploadThingError.toObject(upload.reason as UploadThingError),
    };
  });
};
