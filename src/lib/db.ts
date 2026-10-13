import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import initSqlJs, { type Database, type SqlValue } from "sql.js";

/**
 * WorksOps DB — SQLite 파일 하나 (sql.js).
 *
 * 운영 서버가 Node 20 이라 내장 node:sqlite 를 못 쓰고, 네이티브 빌드가 필요한 better-sqlite3 는
 * 배포 서버 빌드가 실패할 위험이 있어 WASM 으로 도는 sql.js 를 쓴다. DB 는 메모리에 올려 두고
 * 쓸 때마다 파일로 내보낸다.
 *
 * 파일 위치는 앱 폴더의 `.data/worksops.db` 이고 git·배포 전송에서 빠진다(.gitignore, 배포 tar 제외).
 * 다른 곳에 두려면 WORKSOPS_DATA_DIR 을 준다. Next 프로세스는 하나라 쓰기를 프로세스 안에서 한 줄로
 * 세우고, 임시 파일에 쓴 뒤 rename 해 쓰는 도중에 끊겨도 파일이 반쯤 남지 않게 한다.
 */
const DATA_DIR = process.env.WORKSOPS_DATA_DIR || path.join(process.cwd(), ".data");
const FILE = path.join(DATA_DIR, "worksops.db");

/** 테이블은 기능을 붙일 때 여기에 CREATE TABLE IF NOT EXISTS 로 더한다. */
const SCHEMA = ``;

let dbPromise: Promise<Database> | null = null;

function openDb(): Promise<Database> {
  dbPromise ??= (async () => {
    const SQL = await initSqlJs({
      // 번들하지 않으므로(next.config serverExternalPackages) node_modules 의 wasm 을 직접 읽는다.
      locateFile: (file) => path.join(process.cwd(), "node_modules", "sql.js", "dist", file),
    });
    let bytes: Uint8Array | undefined;
    try {
      bytes = await fs.readFile(FILE);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    const db = new SQL.Database(bytes);
    if (SCHEMA.trim()) db.exec(SCHEMA);
    return db;
  })().catch((error) => {
    // 다음 요청에서 다시 열어 보게 한다.
    dbPromise = null;
    throw error;
  });
  return dbPromise;
}

export async function persist(db: Database): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true, mode: 0o700 });
  const tmp = `${FILE}.${process.pid}.${Date.now()}.tmp`;
  // 사내 데이터라 서비스 계정만 읽고 쓴다.
  await fs.writeFile(tmp, db.export(), { mode: 0o600 });
  await fs.rename(tmp, FILE);
}

let queue: Promise<unknown> = Promise.resolve();

/** 읽기·쓰기를 한 번에 하나씩 */
export function serialized<T>(task: (db: Database) => Promise<T> | T): Promise<T> {
  const run = queue.then(async () => task(await openDb()));
  queue = run.catch(() => undefined);
  return run;
}

/** SELECT 결과를 행 객체로 */
export function selectRows(db: Database, sql: string, params: SqlValue[] = []): Record<string, SqlValue>[] {
  const statement = db.prepare(sql);
  try {
    statement.bind(params);
    const result: Record<string, SqlValue>[] = [];
    while (statement.step()) result.push(statement.getAsObject());
    return result;
  } finally {
    statement.free();
  }
}
