import { z } from "zod";
import {
  InferIdType,
  InferInputType,
  InferObjectType,
  Repository,
} from "../repository";
import { getDocumentClient } from "./utils/getDocumentClient";
import { tableConfig } from "./utils/tableConfig";
enum CommunityFieldType {
  a = "a",
}

enum PreferenceOperator {
  b = "b",
}

export type CommunityId = InferIdType<ReturnType<typeof _getCommunityRepo>>;
export type CommunityDb = InferObjectType<ReturnType<typeof _getCommunityRepo>>;
export type CommunityInput = InferInputType<
  ReturnType<typeof _getCommunityRepo>
>;

const hooks = {};

const _getCommunityRepo = () => {
  return new Repository(
    {
      typeName: "Community",
      tableName: tableConfig.tableName,
      schema: z.object({
        communityId: z.string(),
        name: z
          .string()
          .min(1)
          .max(256)
          .transform((s) => s.trim()),
        description: z
          .string()
          .min(0)
          .max(2000)
          .transform((s) => s.trim()),
        prompts: z.array(
          z.object({
            id: z.string(),
            name: z.string(),
          })
        ),
        visibility: z.enum(["LISTED", "UNLISTED"]).default("UNLISTED"),
        fields: z.array(
          z.object({
            id: z.string(),
            name: z.string(),
            type: z.nativeEnum(CommunityFieldType),
            operator: z.nativeEnum(PreferenceOperator),
          })
        ),
        settings: z
          .object({
            minPhotos: z.number().int().min(0).max(6).default(1),
            minPrompts: z.number().int().min(0).max(6).default(1),
          })
          .default({}),
      }),
      primaryIndex: {
        ...tableConfig.primaryIndex,
        fields: ["communityId"],
      },
      on: {
        get: () => {
          return;
        },
      },
    },
    getDocumentClient()
  );
};

const input: CommunityInput = {
  communityId: "1234",
  description: "1234",
  fields: [
    {
      id: "hi",
      name: "hey",
      operator: PreferenceOperator.b,
      type: CommunityFieldType.a,
    },
  ],
  prompts: [],
  name: "abc",
};

const id: CommunityId = {
  communityId: "1234",
};

const db: CommunityDb = {
  communityId: "1234",
  description: "1234",
  fields: [
    {
      id: "hi",
      name: "hey",
      operator: PreferenceOperator.b,
      type: CommunityFieldType.a,
    },
  ],
  prompts: [],
  name: "abc",
  settings: {
    minPhotos: 1,
    minPrompts: 2,
  },
  visibility: "LISTED",
};

test("pass", () => expect(true).toBe(true));
