export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

/** 两个运行端加载同一份产品入口。page 指向产品提供的单文件 HTML。 */
export interface Product<Data extends Json = Json> {
  page: string;
  initial: Data;
  /** 单次提交的 JSON 请求体上限，按 UTF-8 字节计。 */
  maxDraftBytes?: number;
  prepareSave(draft: unknown): Data;
}

export class InvalidDraft extends Error {}
