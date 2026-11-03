import fs from 'node:fs/promises';
import { createDatasetWorkbook, parseDatasetWorkbook } from '../src/lib/dataset-workbook';
const source = JSON.parse(await fs.readFile('.local/seduluran-test.json', 'utf8'));
const buffer = await createDatasetWorkbook(source.people, source.marriages);
const result = await parseDatasetWorkbook(new Uint8Array(buffer).buffer);
await fs.writeFile('.local/seduluran-test.xlsx', new Uint8Array(buffer));
await fs.writeFile('.local/seduluran-import-test.json', JSON.stringify(result));
console.log(result.people.length, result.marriages.length, result.warnings);
