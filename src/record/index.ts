import { WriteOptions, StorageRecord, StorageRecordTag, StorageRecordValue } from '../storage';

export default function createRecord (
  key: string,
  value: StorageRecordValue,
  tags: StorageRecordTag[],
  options: WriteOptions = {}): StorageRecord {
  const { expiresIn = 0 } = options;

  const record = {
    key,
    value,
    tags,
    permanent: expiresIn === 0,
    expiresIn,
    createdAt: Date.now()
  };

  if (value === undefined) {
    return {
      ...record,
      tags: []
    };
  }

  return record;
}

export interface RecordErrorContext {
  record: StorageRecord;
  recordValue: any;
}
