export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

export interface ModuleStore {
  get(key: string): Json | undefined;
  set(key: string, value: Json): void;
  delete(key: string): void;
  entries(): [string, Json][];
}

/** 操作成功后统一提交，抛错或 Promise 被拒绝时整体回滚。 */
export type Operation = (input: unknown, store: ModuleStore) => Json | void | Promise<Json | void>;

export interface ProductModule {
  id: string;
  requires?: readonly string[];
  operations: Readonly<Record<string, Operation>>;
}

interface ProductOptions {
  /** 单文件 HTML 或含 index.html 的前端构建目录。 */
  page: string;
  /** 单次提交的 JSON 请求体上限，按 UTF-8 字节计。 */
  maxDraftBytes?: number;
  modules?: readonly ProductModule[];
  /** 让指定记录继续读写旧版产品的单条资料。 */
  legacyRecord?: { module: string; key: string };
}

export interface Product<Data extends Json = Json> extends ProductOptions {
  initial: Data;
  prepareSave(draft: unknown): Data;
}

export interface ModularProduct extends ProductOptions {
  modules: readonly ProductModule[];
}

export type ProductEntry = Product | (ModularProduct & { initial?: never; prepareSave?: never });

export class InvalidDraft extends Error {}
