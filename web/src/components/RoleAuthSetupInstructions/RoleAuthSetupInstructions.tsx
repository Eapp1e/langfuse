import {
  buildStorageRolePermissionPolicy,
  buildStorageRoleTrustPolicy,
  type StorageRoleActions,
} from "@langfuse/shared";

import { CodeSection } from "@/src/components/design-system/CodeSection/CodeSection";
import { MaskedExternalId } from "@/src/components/RoleAuthSetupInstructions/MaskedExternalId";
import { type RevealableExternalId } from "@/src/components/RoleAuthSetupInstructions/types";

export function RoleAuthSetupInstructions({
  accessRoleArn,
  externalId,
  roleArn,
  bucketName,
  prefix,
  actions,
  description,
}: {
  accessRoleArn: string;
  externalId: RevealableExternalId;
  roleArn: string;
  bucketName: string;
  prefix: string | null | undefined;
  actions: StorageRoleActions;
  description: string;
}) {
  if (!externalId.isSet) {
    return (
      <p className="text-muted-foreground text-sm">
        Save the integration to generate the external ID for your role&apos;s
        trust policy.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-muted-foreground text-sm">{description}</p>
      <CodeSection title="Langfuse access role" content={accessRoleArn} />
      {externalId.value ? (
        <>
          <CodeSection title="External ID" content={externalId.value} />
          <CodeSection
            title="Trust policy"
            language="json"
            content={JSON.stringify(
              buildStorageRoleTrustPolicy({
                accessRoleArn,
                externalId: externalId.value,
              }),
              null,
              2,
            )}
          />
        </>
      ) : (
        <MaskedExternalId
          isLoading={externalId.isLoading}
          onReveal={externalId.reveal}
        />
      )}
      <CodeSection
        title="Permission policy"
        language="json"
        content={JSON.stringify(
          buildStorageRolePermissionPolicy({
            roleArn: roleArn || "arn:aws:iam::123456789012:role/role-name",
            bucketName: bucketName || "bucket-name",
            prefix,
            actions,
          }),
          null,
          2,
        )}
      />
    </div>
  );
}
