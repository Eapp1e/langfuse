// Client-safe contracts for IAM role auth on customer-owned S3 buckets.

export const STORAGE_ROLE_ARN_REGEX =
  /^arn:aws[a-z-]*:iam::\d{12}:role\/[\w+=,.@/-]{1,512}$/;

export const STORAGE_ROLE_ARN_INVALID_MESSAGE =
  "Role ARN must look like arn:aws:iam::123456789012:role/role-name";

// IAM treats `*`, `?` and `$` in resources and StringLike values as
// wildcards or variables, so a user-entered prefix must be escaped.
export function escapeIamPolicyString(value: string) {
  return value.replace(/[*?$]/g, (char) => `\${${char}}`);
}

/**
 * Media prefixes are directories: "" means the whole bucket, anything else
 * ends in exactly one "/". Keeps the app's key check and the IAM resources in
 * agreement for inputs like "/" or "media//".
 */
export function normalizeStorageReadPrefix(prefix: string | null | undefined) {
  const trimmed = (prefix ?? "").trim();
  let end = trimmed.length;
  while (end > 0 && trimmed[end - 1] === "/") end--;
  return end > 0 ? `${trimmed.slice(0, end)}/` : "";
}

export function getArnPartition(arn: string) {
  return arn.split(":")[1] || "aws";
}

/**
 * Trust policy the customer attaches to their role so the Langfuse access
 * role can assume it with the integration's external ID.
 */
export function buildStorageRoleTrustPolicy({
  accessRoleArn,
  externalId,
}: {
  accessRoleArn: string;
  externalId: string;
}) {
  return {
    Version: "2012-10-17",
    Statement: [
      {
        Effect: "Allow",
        Principal: { AWS: accessRoleArn },
        Action: "sts:AssumeRole",
        Condition: { StringEquals: { "sts:ExternalId": externalId } },
      },
      {
        Effect: "Allow",
        Principal: { AWS: accessRoleArn },
        Action: ["sts:TagSession", "sts:SetSourceIdentity"],
      },
    ],
  };
}

export const STORAGE_ROLE_READ_ACTIONS = {
  s3: ["s3:GetObject"],
  kms: ["kms:Decrypt"],
};

// Multipart uploads need kms:Decrypt to complete on SSE-KMS buckets.
export const STORAGE_ROLE_WRITE_ACTIONS = {
  s3: ["s3:PutObject", "s3:AbortMultipartUpload", "s3:DeleteObject"],
  kms: ["kms:GenerateDataKey", "kms:Decrypt"],
};

export type StorageRoleActions = typeof STORAGE_ROLE_READ_ACTIONS;

/**
 * Minimal S3 permissions the customer role needs for the given actions on
 * objects under the prefix.
 */
export function buildStorageRolePermissionPolicy({
  roleArn,
  bucketName,
  prefix,
  actions,
}: {
  roleArn: string;
  bucketName: string;
  prefix: string | null | undefined;
  actions: StorageRoleActions;
}) {
  const partition = getArnPartition(roleArn);
  return {
    Version: "2012-10-17",
    Statement: [
      {
        Effect: "Allow",
        Action: actions.s3,
        Resource: `arn:${partition}:s3:::${bucketName}/${escapeIamPolicyString(prefix ?? "")}*`,
      },
    ],
  };
}
