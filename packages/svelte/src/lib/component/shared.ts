import type {
  ExpandedRouteConfig,
  UploadThingError,
} from "@uploadthing/shared";
import type { UploadFileType } from "uploadthing/client";
import type {
  ErrorMessage,
  FileRouter,
  inferEndpointInput,
  inferErrorShape,
} from "uploadthing/server";

export const generatePermittedFileTypes = (config?: ExpandedRouteConfig) => {
  const fileTypes = config ? Object.keys(config) : [];

  const maxFileCount = config
    ? Object.values(config).map((v) => v.maxFileCount)
    : [];

  return { fileTypes, multiple: maxFileCount.some((v) => v && v > 1) };
};

export const allowedContentTextLabelGenerator = (
  config?: ExpandedRouteConfig,
): string => {
  return capitalizeStart(INTERNAL_doFormatting(config));
};

export const capitalizeStart = (str: string) => {
  return str.charAt(0).toUpperCase() + str.slice(1);
};

const INTERNAL_doFormatting = (config?: ExpandedRouteConfig): string => {
  if (!config) return "";

  const allowedTypes = Object.keys(config) as (keyof ExpandedRouteConfig)[];

  const formattedTypes = allowedTypes.map((f) => {
    if (f.includes("/")) return `${f.split("/")[1].toUpperCase()} file`;
    return f === "blob" ? "file" : f;
  });

  // Format multi-type uploader label as "Supports videos, images and files";
  if (formattedTypes.length > 1) {
    const lastType = formattedTypes.pop();
    return `${formattedTypes.join("s, ")} and ${lastType}s`;
  }

  // Single type uploader label
  const key = allowedTypes[0];
  const formattedKey = formattedTypes[0];

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const { maxFileSize, maxFileCount } = config[key]!;

  if (maxFileCount && maxFileCount > 1) {
    return `${formattedKey}s up to ${maxFileSize}, max ${maxFileCount}`;
  } else {
    return `${formattedKey} (${maxFileSize})`;
  }
};

export type UploadthingComponentProps<TRouter extends FileRouter> = {
  [TEndpoint in keyof TRouter]: {
    endpoint: TEndpoint;

    onUploadProgress?: (progress: number) => void;
    onClientUploadComplete?: (
      res?: Awaited<ReturnType<UploadFileType<TRouter>>>,
    ) => void;
    onUploadError?: (error: UploadThingError<inferErrorShape<TRouter>>) => void;
    url?: string;
  } & (undefined extends inferEndpointInput<TRouter[TEndpoint]>
    ? {}
    : {
        input: inferEndpointInput<TRouter[TEndpoint]>;
      });
}[keyof TRouter];

export const progressHeights: { [key: number]: string } = {
  0: "after:ut-w-0",
  10: "after:ut-w-[10%]",
  20: "after:ut-w-[20%]",
  30: "after:ut-w-[30%]",
  40: "after:ut-w-[40%]",
  50: "after:ut-w-[50%]",
  60: "after:ut-w-[60%]",
  70: "after:ut-w-[70%]",
  80: "after:ut-w-[80%]",
  90: "after:ut-w-[90%]",
  100: "after:ut-w-[100%]",
};

/**
 * @example
 * const uploader = createUploader<OurFileRouter>({
 *   endpoint="someEndpoint",
 *   onUploadComplete={(res) => console.log(res)},
 *   onUploadError={(err) => console.log(err)},
 * })
 */
export function createUploader<TRouter extends FileRouter>(
  props: FileRouter extends TRouter
    ? ErrorMessage<"You forgot to pass the generic">
    : UploadthingComponentProps<TRouter>,
) {
  // Cast back to UploadthingComponentProps<TRouter> to get the correct type
  // since the ErrorMessage messes it up otherwise
  return props as UploadthingComponentProps<TRouter>;
}
