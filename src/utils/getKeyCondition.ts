/**
 * create - throw if item exists
 * upsert - create or update
 * update - throw if item does not exist
 */
type Mode = "create" | "upsert" | "update";

export function getConditionExpression(
  primaryKeyFields: string[],
  mode: "create" | "upsert" | "update"
): string | undefined {
  if (mode === "upsert") {
    return undefined;
  }

  if (mode === "create") {
    return primaryKeyFields
      .map((k) => `attribute_not_exists(${k})`)
      .join(" AND ");
  }

  if (mode === "update") {
    return primaryKeyFields.map((k) => `attribute_exists(${k})`).join(" AND ");
  }

  throw new Error("Invalid mode: " + mode);
}
